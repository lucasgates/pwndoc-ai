#!/bin/bash
#
# PwnDoc-AI Deployment Script
# Deploys to a remote server via SSH/rsync with backup and rollback support
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/deploy.conf"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default values
DRY_RUN=false
ROLLBACK=false
SKIP_BACKUP=false
VERBOSE=false

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Deploy PwnDoc-AI to a remote server with backup and rollback support.

Options:
    -h, --help          Show this help message
    -n, --dry-run       Show what would be synced without making changes
    -r, --rollback      Rollback to the most recent backup
    --skip-backup       Skip pre-deployment backup (not recommended)
    -v, --verbose       Enable verbose output
    --list-backups      List available backups on remote server

Examples:
    $(basename "$0")                    # Full deployment with backup
    $(basename "$0") --dry-run          # Preview changes only
    $(basename "$0") --rollback         # Restore from latest backup
    $(basename "$0") --list-backups     # Show available backups

Configuration:
    Copy deploy.conf.example to deploy.conf and customize for your environment.

EOF
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --list-backups)
            LIST_BACKUPS=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Load configuration
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_error "Configuration file not found: $CONFIG_FILE"
        log_info "Copy deploy.conf.example to deploy.conf and customize it."
        exit 1
    fi
    source "$CONFIG_FILE"

    # Validate required settings
    if [[ -z "$REMOTE_HOST" || "$REMOTE_HOST" == "your-server.example.com" ]]; then
        log_error "REMOTE_HOST not configured in $CONFIG_FILE"
        exit 1
    fi
    if [[ -z "$REMOTE_USER" ]]; then
        log_error "REMOTE_USER not configured in $CONFIG_FILE"
        exit 1
    fi
    if [[ -z "$REMOTE_PATH" ]]; then
        log_error "REMOTE_PATH not configured in $CONFIG_FILE"
        exit 1
    fi

    # Set defaults
    REMOTE_PORT="${REMOTE_PORT:-22}"
    BACKUP_DIR="${BACKUP_DIR:-~/pwndoc-backups}"
    BACKUP_RETENTION="${BACKUP_RETENTION:-5}"
    HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-60}"
    HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-https://localhost:8443}"
    DOCKER_COMPOSE="${DOCKER_COMPOSE:-docker compose}"

    # Build SSH options
    SSH_OPTS="-p ${REMOTE_PORT}"
    if [[ -n "$SSH_KEY" ]]; then
        if [[ ! -f "$SSH_KEY" ]]; then
            log_error "SSH key not found: $SSH_KEY"
            exit 1
        fi
        SSH_OPTS="${SSH_OPTS} -i ${SSH_KEY}"
        log_info "Using SSH key: ${SSH_KEY}"
    fi

    SSH_CMD="ssh ${SSH_OPTS} ${REMOTE_USER}@${REMOTE_HOST}"
    SCP_CMD="scp -P ${REMOTE_PORT}"
    if [[ -n "$SSH_KEY" ]]; then
        SCP_CMD="${SCP_CMD} -i ${SSH_KEY}"
    fi
}

# Test SSH connection
test_connection() {
    log_info "Testing SSH connection to ${REMOTE_USER}@${REMOTE_HOST}..."
    if ! $SSH_CMD "echo 'Connection successful'" &>/dev/null; then
        log_error "Failed to connect to remote server"
        log_info "Check your SSH key and server configuration"
        exit 1
    fi
    log_success "SSH connection OK"
}

# List available backups
list_backups() {
    log_info "Available backups on ${REMOTE_HOST}:"
    $SSH_CMD "ls -lah ${BACKUP_DIR}/*.tar.gz 2>/dev/null || echo 'No backups found'"
}

# Create backup on remote server
create_backup() {
    local backup_name="backup-${TIMESTAMP}.tar.gz"
    log_info "Creating backup: ${backup_name}"

    $SSH_CMD << EOF
        set -e
        mkdir -p ${BACKUP_DIR}
        cd ${REMOTE_PATH}

        # Create backup archive of critical data
        tar -czf ${BACKUP_DIR}/${backup_name} \
            --ignore-failed-read \
            backend/mongo-data \
            backend/ssl \
            backend/backup \
            backend/report-templates \
            backend/src/config \
            frontend/ssl \
            .env \
            frontend/.env \
            2>/dev/null || true

        echo "Backup created: ${BACKUP_DIR}/${backup_name}"

        # Clean up old backups (keep last N)
        cd ${BACKUP_DIR}
        ls -t backup-*.tar.gz 2>/dev/null | tail -n +$((${BACKUP_RETENTION} + 1)) | xargs -r rm -f
        echo "Backup retention policy applied (keeping ${BACKUP_RETENTION} backups)"
EOF

    log_success "Backup completed: ${backup_name}"
}

# Perform rollback from latest backup
do_rollback() {
    log_warn "Starting rollback procedure..."

    # Find the latest backup
    local latest_backup=$($SSH_CMD "ls -t ${BACKUP_DIR}/backup-*.tar.gz 2>/dev/null | head -1")

    if [[ -z "$latest_backup" ]]; then
        log_error "No backups found in ${BACKUP_DIR}"
        exit 1
    fi

    log_info "Rolling back to: $(basename $latest_backup)"

    $SSH_CMD << EOF
        set -e
        cd ${REMOTE_PATH}

        # Stop containers
        ${DOCKER_COMPOSE} down || true

        # Extract backup
        tar -xzf ${latest_backup} --overwrite

        # Restart containers
        ${DOCKER_COMPOSE} up -d --build

        echo "Rollback completed"
EOF

    log_success "Rollback completed from $(basename $latest_backup)"

    # Run health check
    sleep 10
    health_check
}

# Sync files to remote server
sync_files() {
    log_info "Syncing files to remote server..."

    local rsync_opts="-avz --delete"
    if [[ "$VERBOSE" == "true" ]]; then
        rsync_opts="${rsync_opts} --progress"
    fi
    if [[ "$DRY_RUN" == "true" ]]; then
        rsync_opts="${rsync_opts} --dry-run"
        log_warn "DRY RUN MODE - No changes will be made"
    fi

    # Exclusions to preserve production data
    local excludes=(
        "--exclude=backend/mongo-data/"
        "--exclude=backend/mongo-data-dev/"
        "--exclude=backend/mongo-data-test/"
        "--exclude=backend/backup/"
        "--exclude=backend/ssl/"
        "--exclude=frontend/ssl/"
        "--exclude=.env"
        "--exclude=frontend/.env"
        "--exclude=deploy.conf"
        "--exclude=node_modules/"
        "--exclude=backend/node_modules/"
        "--exclude=frontend/node_modules/"
        "--exclude=.git/"
        "--exclude=*.log"
        "--exclude=.DS_Store"
        "--exclude=__pycache__/"
        "--exclude=.claude/"
    )

    rsync ${rsync_opts} \
        "${excludes[@]}" \
        -e "ssh ${SSH_OPTS}" \
        "${SCRIPT_DIR}/" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run complete. Run without --dry-run to apply changes."
    else
        log_success "File sync completed"
    fi
}

# Rebuild and restart containers on remote
rebuild_containers() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would rebuild containers on remote server"
        return
    fi

    log_info "Stopping containers..."
    $SSH_CMD "cd ${REMOTE_PATH} && ${DOCKER_COMPOSE} down" || true

    log_info "Building and starting containers..."
    $SSH_CMD "cd ${REMOTE_PATH} && ${DOCKER_COMPOSE} up -d --build"

    log_success "Containers rebuilt and started"
}

# Health check
health_check() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would perform health check"
        return 0
    fi

    log_info "Waiting for services to start (timeout: ${HEALTH_CHECK_TIMEOUT}s)..."

    local start_time=$(date +%s)
    local healthy=false

    while [[ $(($(date +%s) - start_time)) -lt $HEALTH_CHECK_TIMEOUT ]]; do
        # Check if all containers are running (compatible with old docker-compose)
        local containers_running=$($SSH_CMD "cd ${REMOTE_PATH} && ${DOCKER_COMPOSE} ps 2>/dev/null | grep -c 'Up' || echo 0" | tr -d '[:space:]')

        if [[ "$containers_running" -ge 3 ]]; then
            # Test HTTPS endpoint
            local http_status=$($SSH_CMD "curl -sk -o /dev/null -w '%{http_code}' ${HEALTH_CHECK_URL}/api/data/languages 2>/dev/null || echo 000")

            if [[ "$http_status" == "200" || "$http_status" == "401" ]]; then
                healthy=true
                break
            fi
        fi

        echo -n "."
        sleep 5
    done

    echo ""

    if [[ "$healthy" == "true" ]]; then
        log_success "Health check passed - all services are running"

        # Show container status
        log_info "Container status:"
        $SSH_CMD "cd ${REMOTE_PATH} && ${DOCKER_COMPOSE} ps"
        return 0
    else
        log_error "Health check failed - services did not become healthy"
        log_info "Container status:"
        $SSH_CMD "cd ${REMOTE_PATH} && ${DOCKER_COMPOSE} ps" || true
        log_info "Recent logs:"
        $SSH_CMD "cd ${REMOTE_PATH} && ${DOCKER_COMPOSE} logs --tail=20" || true
        return 1
    fi
}

# Main deployment
deploy() {
    log_info "Starting deployment to ${REMOTE_HOST}"
    log_info "Remote path: ${REMOTE_PATH}"
    echo ""

    # Create backup unless skipped
    if [[ "$SKIP_BACKUP" != "true" && "$DRY_RUN" != "true" ]]; then
        create_backup
        echo ""
    elif [[ "$SKIP_BACKUP" == "true" ]]; then
        log_warn "Skipping pre-deployment backup (--skip-backup)"
    fi

    # Sync files
    sync_files
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run complete. No changes were made."
        exit 0
    fi

    # Rebuild containers
    rebuild_containers
    echo ""

    # Health check
    if health_check; then
        echo ""
        log_success "Deployment completed successfully!"
        log_info "Backup available at: ${BACKUP_DIR}/backup-${TIMESTAMP}.tar.gz"
    else
        echo ""
        log_error "Deployment completed but health check failed!"
        log_warn "You may want to rollback: $(basename "$0") --rollback"
        exit 1
    fi
}

# Main execution
main() {
    echo ""
    echo "========================================"
    echo "  PwnDoc-AI Deployment Script"
    echo "========================================"
    echo ""

    load_config
    test_connection

    if [[ "$LIST_BACKUPS" == "true" ]]; then
        list_backups
        exit 0
    fi

    if [[ "$ROLLBACK" == "true" ]]; then
        do_rollback
        exit 0
    fi

    deploy
}

main
