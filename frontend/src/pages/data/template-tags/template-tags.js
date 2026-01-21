import DataService from '@/services/data'
import { copyToClipboard } from 'quasar'

export default {
    data: () => {
        return {
            searchQuery: '',
            expandedSections: {
                auditInfo: true,
                company: false,
                client: false,
                creator: false,
                collaborators: false,
                reviewers: false,
                scope: false,
                findings: true,
                cvss3: false,
                cvss4: false,
                categories: false,
                customSections: true,
                customFields: true
            },
            // Dynamic data from API
            sections: [],
            customFields: [],

            // Static tag definitions
            staticTags: {
                auditInfo: [
                    { tag: '{name}', description: 'Audit name', type: 'string' },
                    { tag: '{auditType}', description: 'Type of audit', type: 'string' },
                    { tag: '{date}', description: 'Redacting date', type: 'string' },
                    { tag: '{date_start}', description: 'Start date of the test', type: 'string' },
                    { tag: '{date_end}', description: 'End date of the test', type: 'string' },
                    { tag: '{language}', description: 'Audit locale (e.g., en, fr)', type: 'string' }
                ],
                company: [
                    { tag: '{company.name}', description: 'Company name', type: 'string' },
                    { tag: '{company.shortName}', description: 'Company short name', type: 'string' },
                    { tag: '{%company.logo}', description: 'Company logo (max width 400px)', type: 'image' },
                    { tag: '{%company.logo_small}', description: 'Company logo small (height 37px)', type: 'image' }
                ],
                client: [
                    { tag: '{client.email}', description: 'Client email', type: 'string' },
                    { tag: '{client.firstname}', description: 'Client first name', type: 'string' },
                    { tag: '{client.lastname}', description: 'Client last name', type: 'string' },
                    { tag: '{client.phone}', description: 'Client phone number', type: 'string' },
                    { tag: '{client.cell}', description: 'Client cell number', type: 'string' },
                    { tag: '{client.title}', description: 'Client title', type: 'string' }
                ],
                creator: [
                    { tag: '{creator.username}', description: 'Creator username', type: 'string' },
                    { tag: '{creator.firstname}', description: 'Creator first name', type: 'string' },
                    { tag: '{creator.lastname}', description: 'Creator last name', type: 'string' },
                    { tag: '{creator.email}', description: 'Creator email', type: 'string' },
                    { tag: '{creator.phone}', description: 'Creator phone', type: 'string' },
                    { tag: '{creator.role}', description: 'Creator role', type: 'string' }
                ],
                collaborators: [
                    { tag: '{#collaborators}...{/collaborators}', description: 'Loop through collaborators', type: 'array', isLoop: true },
                    { tag: '{username}', description: 'Collaborator username (inside loop)', type: 'string', nested: true },
                    { tag: '{firstname}', description: 'Collaborator first name (inside loop)', type: 'string', nested: true },
                    { tag: '{lastname}', description: 'Collaborator last name (inside loop)', type: 'string', nested: true },
                    { tag: '{email}', description: 'Collaborator email (inside loop)', type: 'string', nested: true },
                    { tag: '{phone}', description: 'Collaborator phone (inside loop)', type: 'string', nested: true },
                    { tag: '{role}', description: 'Collaborator role (inside loop)', type: 'string', nested: true }
                ],
                reviewers: [
                    { tag: '{#reviewers}...{/reviewers}', description: 'Loop through reviewers', type: 'array', isLoop: true },
                    { tag: '{username}', description: 'Reviewer username (inside loop)', type: 'string', nested: true },
                    { tag: '{firstname}', description: 'Reviewer first name (inside loop)', type: 'string', nested: true },
                    { tag: '{lastname}', description: 'Reviewer last name (inside loop)', type: 'string', nested: true },
                    { tag: '{email}', description: 'Reviewer email (inside loop)', type: 'string', nested: true },
                    { tag: '{phone}', description: 'Reviewer phone (inside loop)', type: 'string', nested: true },
                    { tag: '{role}', description: 'Reviewer role (inside loop)', type: 'string', nested: true }
                ],
                scope: [
                    { tag: '{#scope}...{/scope}', description: 'Loop through scope items', type: 'array', isLoop: true },
                    { tag: '{name}', description: 'Scope item name (inside loop)', type: 'string', nested: true },
                    { tag: '{#hosts}...{/hosts}', description: 'Loop through hosts (inside scope)', type: 'array', isLoop: true, nested: true },
                    { tag: '{hostname}', description: 'Host hostname (inside hosts loop)', type: 'string', nested: true },
                    { tag: '{ip}', description: 'Host IP address (inside hosts loop)', type: 'string', nested: true },
                    { tag: '{os}', description: 'Host operating system (inside hosts loop)', type: 'string', nested: true },
                    { tag: '{#services}...{/services}', description: 'Loop through services (inside hosts)', type: 'array', isLoop: true, nested: true },
                    { tag: '{port}', description: 'Service port (inside services loop)', type: 'number', nested: true },
                    { tag: '{protocol}', description: 'Service protocol (inside services loop)', type: 'string', nested: true }
                ],
                findings: [
                    { tag: '{#findings}...{/findings}', description: 'Loop through findings', type: 'array', isLoop: true },
                    { tag: '{title}', description: 'Finding title', type: 'string', nested: true },
                    { tag: '{vulnType}', description: 'Vulnerability type', type: 'string', nested: true },
                    { tag: '{-w:p description}{@text | convertHTML}...{/description}', description: 'Finding description (HTML with images)', type: 'html', nested: true },
                    { tag: '{-w:p observation}{@text | convertHTML}...{/observation}', description: 'Finding observation (HTML with images)', type: 'html', nested: true },
                    { tag: '{-w:p remediation}{@text | convertHTML}...{/remediation}', description: 'Finding remediation (HTML with images)', type: 'html', nested: true },
                    { tag: '{remediationComplexity}', description: 'Remediation complexity (1-3)', type: 'number', nested: true },
                    { tag: '{priority}', description: 'Priority (1-4)', type: 'number', nested: true },
                    { tag: '{#references}{.}{/references}', description: 'Loop through references', type: 'array', nested: true },
                    { tag: '{references | join: ", "}', description: 'References as comma-separated string', type: 'string', nested: true },
                    { tag: '{-w:p poc}{@text | convertHTML}...{/poc}', description: 'Proof of concept (HTML with images)', type: 'html', nested: true },
                    { tag: '{@affected | convertHTML}', description: 'Affected scope (HTML)', type: 'html', nested: true },
                    { tag: '{status}', description: 'Finding status (0: done, 1: redacting)', type: 'number', nested: true },
                    { tag: '{category}', description: 'Finding category', type: 'string', nested: true },
                    { tag: '{identifier}', description: 'Finding identifier (e.g., IDX-001)', type: 'string', nested: true },
                    { tag: '{identifier | changeID: "PROJ-"}', description: 'Finding identifier with custom prefix', type: 'string', nested: true },
                    { tag: '{retestStatus}', description: 'Retest status (ok, ko, unknown, partial)', type: 'string', nested: true },
                    { tag: '{-w:p retestDescription}{@text | convertHTML}...{/retestDescription}', description: 'Retest description (HTML with images)', type: 'html', nested: true }
                ],
                cvss3: [
                    { tag: '{cvss.vectorString}', description: 'CVSS 3.1 vector string', type: 'string', nested: true },
                    { tag: '{cvss.baseMetricScore}', description: 'Base metric score', type: 'number', nested: true },
                    { tag: '{cvss.baseSeverity}', description: 'Base severity (None/Low/Medium/High/Critical)', type: 'string', nested: true },
                    { tag: '{cvss.temporalMetricScore}', description: 'Temporal metric score', type: 'number', nested: true },
                    { tag: '{cvss.temporalSeverity}', description: 'Temporal severity', type: 'string', nested: true },
                    { tag: '{cvss.environmentalMetricScore}', description: 'Environmental metric score', type: 'number', nested: true },
                    { tag: '{cvss.environmentalSeverity}', description: 'Environmental severity', type: 'string', nested: true },
                    { tag: '{cvss.cellColor}', description: 'Cell color XML for base severity', type: 'string', nested: true },
                    { tag: '{cvss.temporalCellColor}', description: 'Cell color XML for temporal severity', type: 'string', nested: true },
                    { tag: '{cvss.environmentalCellColor}', description: 'Cell color XML for environmental severity', type: 'string', nested: true },
                    { tag: '{cvssObj.AV}', description: 'Attack Vector', type: 'string', nested: true },
                    { tag: '{cvssObj.AC}', description: 'Attack Complexity', type: 'string', nested: true },
                    { tag: '{cvssObj.PR}', description: 'Privileges Required', type: 'string', nested: true },
                    { tag: '{cvssObj.UI}', description: 'User Interaction', type: 'string', nested: true },
                    { tag: '{cvssObj.S}', description: 'Scope', type: 'string', nested: true },
                    { tag: '{cvssObj.C}', description: 'Confidentiality Impact', type: 'string', nested: true },
                    { tag: '{cvssObj.I}', description: 'Integrity Impact', type: 'string', nested: true },
                    { tag: '{cvssObj.A}', description: 'Availability Impact', type: 'string', nested: true },
                    { tag: '{cvssObj.E}', description: 'Exploit Code Maturity', type: 'string', nested: true },
                    { tag: '{cvssObj.RL}', description: 'Remediation Level', type: 'string', nested: true },
                    { tag: '{cvssObj.RC}', description: 'Report Confidence', type: 'string', nested: true }
                ],
                cvss4: [
                    { tag: '{cvss4.vectorString}', description: 'CVSS 4.0 vector string', type: 'string', nested: true },
                    { tag: '{cvss4.baseScore}', description: 'CVSS 4.0 base score', type: 'number', nested: true },
                    { tag: '{cvss4.baseSeverity}', description: 'CVSS 4.0 base severity', type: 'string', nested: true },
                    { tag: '{cvss4.cellColor}', description: 'Cell color XML for severity', type: 'string', nested: true },
                    { tag: '{cvss4Obj.AV}', description: 'Attack Vector', type: 'string', nested: true },
                    { tag: '{cvss4Obj.AC}', description: 'Attack Complexity', type: 'string', nested: true },
                    { tag: '{cvss4Obj.AT}', description: 'Attack Requirements', type: 'string', nested: true },
                    { tag: '{cvss4Obj.PR}', description: 'Privileges Required', type: 'string', nested: true },
                    { tag: '{cvss4Obj.UI}', description: 'User Interaction', type: 'string', nested: true },
                    { tag: '{cvss4Obj.VC}', description: 'Vulnerable System Confidentiality', type: 'string', nested: true },
                    { tag: '{cvss4Obj.VI}', description: 'Vulnerable System Integrity', type: 'string', nested: true },
                    { tag: '{cvss4Obj.VA}', description: 'Vulnerable System Availability', type: 'string', nested: true },
                    { tag: '{cvss4Obj.SC}', description: 'Subsequent System Confidentiality', type: 'string', nested: true },
                    { tag: '{cvss4Obj.SI}', description: 'Subsequent System Integrity', type: 'string', nested: true },
                    { tag: '{cvss4Obj.SA}', description: 'Subsequent System Availability', type: 'string', nested: true }
                ],
                categories: [
                    { tag: '{#categories}...{/categories}', description: 'Loop through categories (findings grouped by category)', type: 'array', isLoop: true },
                    { tag: '{categoryName}', description: 'Category name (inside loop)', type: 'string', nested: true },
                    { tag: '{#categoryFindings}...{/categoryFindings}', description: 'Loop through findings in this category', type: 'array', isLoop: true, nested: true }
                ]
            }
        }
    },

    computed: {
        // Generate dynamic tags from sections
        dynamicSectionTags() {
            return this.sections.map(section => {
                const sectionFields = this.customFields
                    .filter(f => f.display === 'section' && f.displaySub === section.name)
                    .map(field => this.formatCustomFieldTag(field, `${section.field}.`))

                return {
                    sectionName: section.name,
                    sectionField: section.field,
                    tags: [
                        { tag: `{${section.field}.name}`, description: `${section.name} section display name`, type: 'string' },
                        ...sectionFields
                    ]
                }
            })
        },

        // Generate dynamic tags from custom fields (audit-level general)
        dynamicAuditFieldTags() {
            return this.customFields
                .filter(f => f.display === 'general')
                .map(field => this.formatCustomFieldTag(field, ''))
        },

        // Generate dynamic tags from custom fields (finding-level)
        dynamicFindingFieldTags() {
            return this.customFields
                .filter(f => f.display === 'finding' || f.display === 'vulnerability')
                .map(field => this.formatCustomFieldTag(field, ''))
        },

        // Filter all tags based on search
        filteredStaticTags() {
            if (!this.searchQuery) return this.staticTags
            const query = this.searchQuery.toLowerCase()
            const filtered = {}
            for (const [key, tags] of Object.entries(this.staticTags)) {
                const matchingTags = tags.filter(t =>
                    t.tag.toLowerCase().includes(query) ||
                    t.description.toLowerCase().includes(query)
                )
                if (matchingTags.length > 0) filtered[key] = matchingTags
            }
            return filtered
        },

        filteredDynamicSectionTags() {
            if (!this.searchQuery) return this.dynamicSectionTags
            const query = this.searchQuery.toLowerCase()
            return this.dynamicSectionTags
                .map(section => ({
                    ...section,
                    tags: section.tags.filter(t =>
                        t.tag.toLowerCase().includes(query) ||
                        t.description.toLowerCase().includes(query)
                    )
                }))
                .filter(section => section.tags.length > 0)
        },

        filteredAuditFieldTags() {
            if (!this.searchQuery) return this.dynamicAuditFieldTags
            const query = this.searchQuery.toLowerCase()
            return this.dynamicAuditFieldTags.filter(t =>
                t.tag.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query)
            )
        },

        filteredFindingFieldTags() {
            if (!this.searchQuery) return this.dynamicFindingFieldTags
            const query = this.searchQuery.toLowerCase()
            return this.dynamicFindingFieldTags.filter(t =>
                t.tag.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query)
            )
        },

        hasFilteredResults() {
            return Object.keys(this.filteredStaticTags).length > 0 ||
                   this.filteredDynamicSectionTags.length > 0 ||
                   this.filteredAuditFieldTags.length > 0 ||
                   this.filteredFindingFieldTags.length > 0
        }
    },

    mounted() {
        this.getSections()
        this.getCustomFields()
    },

    methods: {
        getSections() {
            DataService.getSections()
            .then((data) => {
                this.sections = data.data.datas
            })
            .catch((err) => console.log(err))
        },

        getCustomFields() {
            DataService.getCustomFields()
            .then((data) => {
                this.customFields = data.data.datas.filter(e => e.display)
            })
            .catch((err) => console.log(err))
        },

        formatCustomFieldTag(field, prefix) {
            // Normalize label: lowercase, remove diacritics, remove spaces, replace non-word chars with underscore
            const normalizedLabel = field.label
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                .replace(/\s/g, '')
                .replace(/[^\w]/g, '_')

            const isHtml = field.fieldType === 'text'
            const tagName = `${prefix}${normalizedLabel}`

            if (isHtml) {
                return {
                    tag: `{-w:p ${tagName}}{@text | convertHTML}...{/${tagName}}`,
                    description: `Custom field: ${field.label} (HTML with images)`,
                    type: 'html',
                    fieldType: field.fieldType,
                    originalLabel: field.label
                }
            } else {
                return {
                    tag: `{${tagName}}`,
                    description: `Custom field: ${field.label}`,
                    type: field.fieldType === 'checkbox' ? 'boolean' : 'string',
                    fieldType: field.fieldType,
                    originalLabel: field.label
                }
            }
        },

        copyTag(tag) {
            copyToClipboard(tag)
            .then(() => {
                this.$q.notify({
                    message: this.$t('tagCopied'),
                    color: 'positive',
                    textColor: 'white',
                    position: 'top-right',
                    timeout: 1500
                })
            })
        },

        expandAll() {
            Object.keys(this.expandedSections).forEach(key => {
                this.expandedSections[key] = true
            })
        },

        collapseAll() {
            Object.keys(this.expandedSections).forEach(key => {
                this.expandedSections[key] = false
            })
        },

        getTypeIcon(type) {
            switch(type) {
                case 'html': return 'mdi-language-html5'
                case 'array': return 'mdi-code-array'
                case 'image': return 'mdi-image'
                case 'object': return 'mdi-code-braces'
                case 'number': return 'mdi-numeric'
                case 'boolean': return 'mdi-checkbox-marked-outline'
                default: return 'mdi-format-text'
            }
        },

        getTypeColor(type) {
            switch(type) {
                case 'html': return 'orange'
                case 'array': return 'purple'
                case 'image': return 'green'
                case 'object': return 'blue'
                case 'number': return 'teal'
                case 'boolean': return 'pink'
                default: return 'grey'
            }
        },

        getTypeLabel(type) {
            switch(type) {
                case 'html': return 'HTML'
                case 'array': return 'Loop'
                case 'image': return 'Image'
                case 'object': return 'Object'
                case 'number': return 'Number'
                case 'boolean': return 'Boolean'
                default: return 'String'
            }
        }
    }
}
