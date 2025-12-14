# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PwnDoc is a pentest reporting application for writing security findings and generating customizable DOCX reports. This fork (pwndoc-ai) adds AI-powered vulnerability generation using OpenAI.

## Architecture

- **Frontend**: Vue.js 2 with Quasar Framework v1, using Tiptap for rich text editing
- **Backend**: Express.js 5 with Mongoose ORM
- **Database**: MongoDB 4.2
- **Deployment**: Docker Compose with three containers (frontend, backend, mongodb)

### Backend Structure (`backend/src/`)
- `app.js` - Main entry point, Express server with HTTPS on port 4242
- `models/` - Mongoose schemas (audit, vulnerability, user, settings, etc.)
- `routes/` - API endpoints (audit, vulnerability, user, backup, etc.)
- `lib/` - Utilities including report generation (`report-generator.js`, `report-filters.js`)

### Frontend Structure (`frontend/src/`)
- `pages/` - Vue page components (audits, vulnerabilities, data management, settings)
- `components/` - Reusable Vue components
- `services/` - API service layer
- `i18n/` - Internationalization files

## Common Commands

### Development (with Docker)

Start backend + database for development:
```bash
docker-compose -f backend/docker-compose.dev.yml up -d --build
```

Start frontend for development:
```bash
docker-compose -f frontend/docker-compose.dev.yml up -d --build
```

View backend logs:
```bash
docker-compose -f backend/docker-compose.dev.yml logs -f pwndoc-backend-dev
```

### Production

Build and run all containers:
```bash
docker-compose up -d --build
```

### Running Tests

Full test suite (stops other containers, runs tests, cleans up):
```bash
./run_tests.sh -f
```

Backend tests directly (inside container or local):
```bash
cd backend && npm test
```

### Local Development (without Docker)

Backend:
```bash
cd backend && npm run dev
```

Frontend:
```bash
cd frontend && npm run dev
```

## Environment Variables

- `APP_PORT` - Frontend exposed port (default: 8443)
- `DB_PORT_HOST` - MongoDB exposed port for development
- `DB_SERVER` - MongoDB hostname (set by Docker)
- `DB_NAME` - Database name (default: pwndoc)

## Key Features

- **AI Vulnerability Generation**: OpenAI integration for generating vulnerability descriptions. Configured via admin settings (stored in database), not environment variables.
- **Report Templates**: DOCX templates in `backend/report-templates/` using docxtemplater
- **Multi-user collaboration**: Socket.IO for real-time audit collaboration
- **Custom fields/sections**: Extensible audit and vulnerability data structures

## Important Notes

- SSL certificates are in `backend/ssl/` - replace for production
- JWT secrets can be configured in `backend/src/config/config.json`
- Database is stored in `backend/mongo-data/` (production) or `backend/mongo-data-dev/` (development)
- The frontend requires `NODE_OPTIONS=--openssl-legacy-provider` due to legacy webpack compatibility
