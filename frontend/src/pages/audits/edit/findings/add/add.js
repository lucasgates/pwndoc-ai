import { Notify } from 'quasar';

import Breadcrumb from 'components/breadcrumb';
import BasicEditor from 'components/editor/Editor.vue';
import Cvss3Calculator from 'components/cvss3calculator';
import Cvss4Calculator from 'components/cvss4calculator';
import TextareaArray from 'components/textarea-array';

import VulnService from '@/services/vulnerability';
import AuditService from '@/services/audit';
import DataService from '@/services/data';
import Utils from '@/services/utils';

import { $t } from '@/boot/i18n'

export default {
    props: {
        frontEndAuditState: Number,
        parentState: String,
        parentApprovals: Array
    },
    data: () => {
        return {
            finding: {},
            findingTitle: '',
            // AI Create
            aiTitle: '',
            aiDescription: '',
            aiLanguage: '',
            aiLoading: false,
            // AI-generated finding for review
            aiFinding: {
                title: '',
                vulnType: '',
                description: '',
                observation: '',
                remediation: '',
                poc: '',
                remediationComplexity: '',
                priority: '',
                references: [],
                cvssv3: '',
                cvssv4: '',
                category: null
            },
            // List of vulnerabilities from knowledge base
            vulnerabilities: [],
            // Loading state
            loading: true,
            // Headers for vulnerabilities datatable
            dtVulnHeaders: [
                {name: 'title', label: $t('title'), field: row => row.detail.title, align: 'left', sortable: true},
                {name: 'category', label: $t('category'), field: 'category', align: 'left', sortable: true},
                {name: 'vulnType', label: $t('vulnType'), field: row => row.detail.vulnType, align: 'left', sortable: true},
                {name: 'action', label: '', field: 'action', align: 'left', sortable: false},
            ],
            // Pagination for vulnerabilities datatable
            vulnPagination: {
                page: 1,
                rowsPerPage: 25,
                sortBy: 'title'
            },
            rowsPerPageOptions: [
                {label:'25', value:25},
                {label:'50', value:50},
                {label:'100', value:100},
                {label:'All', value:0}
            ],
            filteredRowsCount: 0,
            // Search filter
            search: {title: '', vulnType: '', category: ''},
            
            // Vulnerabilities languages
            languages: [],
            dtLanguage: "",
            currentExpand: -1,

            // Vulnerability categories
            vulnCategories: [],

            htmlEncode: Utils.htmlEncode,
            AUDIT_VIEW_STATE: Utils.AUDIT_VIEW_STATE
        }
    },

    components: {
        Breadcrumb,
        BasicEditor,
        Cvss3Calculator,
        Cvss4Calculator,
        TextareaArray
    },

    mounted: function() {
        this.auditId = this.$route.params.auditId;
        this.getLanguages();
        this.dtLanguage = this.$parent.audit.language;
        this.getVulnerabilities();
        this.getVulnerabilityCategories()

        this.$socket.emit('menu', {menu: 'addFindings', room: this.auditId});
    },

    computed: {
        vulnCategoriesOptions: function() {
            return this.$_.uniq(this.$_.map(this.vulnerabilities, vuln => {
                return vuln.category || $t('noCategory')
            }))
        },

        vulnTypeOptions: function() {
            return this.$_.uniq(this.$_.map(this.vulnerabilities, vuln => {
                return vuln.detail.vulnType || $t('undefined')
            }))
        },

        aiLanguageOptions: function() {
            return this.languages.map(lang => ({
                label: lang.language,
                value: lang.locale
            }))
        }
    },

    methods: {
        // Get available languages
        getLanguages: function() {
            DataService.getLanguages()
            .then((data) => {
                this.languages = data.data.datas;
            })
            .catch((err) => {
                console.log(err)
            })
        },

        // Get vulnerabilities by language
        getVulnerabilities: function() {
            this.loading = true
            VulnService.getVulnByLanguage(this.dtLanguage)
            .then((data) => {
                this.vulnerabilities = data.data.datas;
                this.loading = false
            })
            .catch((err) => {
                console.log(err)
            })
        },

        // Get available vulnerability categories
        getVulnerabilityCategories: function() {
            DataService.getVulnerabilityCategories()
            .then((data) => {
                this.vulnCategories = data.data.datas;
            })
            .catch((err) => {
                console.log(err)
            })
        },

        getDtTitle: function(row) {
            var index = row.details.findIndex(obj => obj.locale === this.dtLanguage.locale);
            if (index < 0)
                return $t('err.notDefinedLanguage');
            else
                return row.details[index].title;         
        },

        customFilter: function(rows, terms, cols, getCellValue) {
            var result = rows && rows.filter(row => {
                var title = (row.detail.title || $t('err.notDefinedLanguage')).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                var type = (row.detail.vulnType || $t('undefined')).toLowerCase()
                var category = (row.category || $t('noCategory')).toLowerCase()
                var termTitle = (terms.title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                var termCategory = (terms.category || "").toLowerCase()
                var termVulnType = (terms.vulnType || "").toLowerCase()
                return title.indexOf(termTitle) > -1 && 
                type.indexOf(termVulnType) > -1 &&
                category.indexOf(termCategory) > -1
            })
            this.filteredRowsCount = result.length
            this.filteredRows = result
            return result;
        },

        addFindingFromVuln: function(vuln) {
            var finding = null;
            if (vuln) {
                finding = {
                    title: vuln.detail.title,
                    vulnType: vuln.detail.vulnType,
                    description: vuln.detail.description,
                    observation: vuln.detail.observation,
                    remediation: vuln.detail.remediation,
                    poc: vuln.detail.poc || '',
                    remediationComplexity: vuln.remediationComplexity,
                    priority: vuln.priority,
                    references: vuln.detail.references,
                    cvssv3: vuln.cvssv3,
                    cvssv4: vuln.cvssv4,
                    category: vuln.category,
                    customFields: Utils.filterCustomFields('finding', vuln.category, this.$parent.customFields, vuln.detail.customFields, this.$parent.audit.language)
                };
            }

            if (finding) {
                AuditService.createFinding(this.auditId, finding)
                .then(() => {
                    this.findingTitle = "";
                    Notify.create({
                        message: $t('msg.findingCreateOk'),
                        color: 'positive',
                        textColor:'white',
                        position: 'top-right'
                    })
                })
                .catch((err) => {
                    Notify.create({
                        message: err.response.data.datas,
                        color: 'negative',
                        textColor:'white',
                        position: 'top-right'
                    })
                })
            }
        },

        addFinding: function(category) {
            var finding = null;
            if (category && this.findingTitle) {
                finding = {
                    title: this.findingTitle,
                    vulnType: "",
                    description: "",
                    observation: "",
                    remediation: "",
                    remediationComplexity: "",
                    priority: "",
                    references: [],
                    cvssv3: "",
                    cvssv4: "",
                    category: category.name,
                    customFields: Utils.filterCustomFields('finding', category.name, this.$parent.customFields, [], this.$parent.audit.language)
                };
            }
            else if (this.findingTitle){
                finding = {
                    title: this.findingTitle,
                    vulnType: "",
                    description: "",
                    observation: "",
                    remediation: "",
                    remediationComplexity: "",
                    priority: "",
                    references: [],
                    cvssv3: "",
                    cvssv4: "",
                    customFields: Utils.filterCustomFields('finding', '', this.$parent.customFields, [], this.$parent.audit.language)
                };
            }

            if (finding) {
                AuditService.createFinding(this.auditId, finding)
                .then(() => {
                    this.findingTitle = "";
                    Notify.create({
                        message: $t('msg.findingCreateOk'),
                        color: 'positive',
                        textColor:'white',
                        position: 'top-right'
                    })
                })
                .catch((err) => {
                    Notify.create({
                        message: err.response.data.datas,
                        color: 'negative',
                        textColor:'white',
                        position: 'top-right'
                    })
                })
            }
        },

        // AI Modal methods
        showAiModal: function() {
            this.aiTitle = '';
            this.aiDescription = '';
            this.aiLanguage = this.dtLanguage || (this.languages.length > 0 ? this.languages[0].locale : 'en');
            this.$refs.aiModal.show();
        },

        closeAiModal: function() {
            this.aiTitle = '';
            this.aiDescription = '';
        },

        createWithAI: function() {
            // Validate input
            if (!this.aiTitle.trim() && !this.aiDescription.trim()) {
                Notify.create({
                    message: $t('msg.atLeastTitleOrDescription') || 'Please provide at least a title or description',
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right'
                });
                return;
            }

            // Check AI settings first
            this.$axios.get('/settings')
            .then((settingsResponse) => {
                if (settingsResponse.data && settingsResponse.data.datas && settingsResponse.data.datas.ai) {
                    if (!settingsResponse.data.datas.ai.enabled) {
                        Notify.create({
                            message: $t('msg.aiNotEnabled') || 'AI features are not enabled. Please enable AI in settings first.',
                            color: 'negative',
                            textColor: 'white',
                            position: 'top-right'
                        });
                        return;
                    }
                    if (!settingsResponse.data.datas.ai.private || !settingsResponse.data.datas.ai.private.apiKeyConfigured) {
                        Notify.create({
                            message: $t('msg.aiApiKeyNotConfigured') || 'OpenAI API key is not configured. Please set your API key in settings first.',
                            color: 'negative',
                            textColor: 'white',
                            position: 'top-right'
                        });
                        return;
                    }
                }

                // Proceed with AI generation if settings are OK
                this.performAIGeneration();
            })
            .catch((err) => {
                console.log('Error getting settings:', err);
                // Proceed anyway, let the backend handle the validation
                this.performAIGeneration();
            });
        },

        performAIGeneration: function() {
            this.aiLoading = true;

            // Show loading state
            this.$q.loading.show({
                message: $t('msg.generatingWithAI') || 'Generating finding content with AI...'
            });

            // Prepare request data
            var requestData = {
                title: this.aiTitle.trim(),
                description: this.aiDescription.trim(),
                locale: this.aiLanguage || 'en'
            };

            // Store the user input for fallback
            var userTitle = this.aiTitle.trim();
            var userDescription = this.aiDescription.trim();

            // Call the AI generation API
            this.$axios.post('vulnerabilities/ai-generate', requestData)
            .then((response) => {
                this.$q.loading.hide();
                this.aiLoading = false;

                if (response.data && response.data.datas) {
                    var aiData = response.data.datas;

                    // Populate the review finding with AI-generated content
                    this.aiFinding = {
                        title: aiData.title || userTitle,
                        vulnType: '',
                        description: aiData.description || '',
                        observation: aiData.observation || '',
                        remediation: aiData.remediation || '',
                        poc: aiData.poc || '',
                        remediationComplexity: aiData.remediationComplexity || '',
                        priority: aiData.priority || '',
                        references: aiData.references || [],
                        cvssv3: aiData.cvssv3 || '',
                        cvssv4: aiData.cvssv4 || '',
                        category: null
                    };

                    // Close AI modal and open review modal
                    this.$refs.aiModal.hide();
                    this.$refs.createModal.show();

                    Notify.create({
                        message: $t('msg.aiContentGenerated') || 'AI content generated successfully! Please review and modify as needed.',
                        color: 'positive',
                        textColor: 'white',
                        position: 'top-right',
                        timeout: 5000
                    });
                } else {
                    throw new Error('Invalid response format');
                }
            })
            .catch((error) => {
                this.$q.loading.hide();
                this.aiLoading = false;
                console.error('AI Generation Error:', error);

                // Pre-populate with user's original input for manual creation
                this.aiFinding = {
                    title: userTitle,
                    vulnType: '',
                    description: userDescription,
                    observation: '',
                    remediation: '',
                    poc: '',
                    remediationComplexity: '',
                    priority: '',
                    references: [],
                    cvssv3: '',
                    cvssv4: '',
                    category: null
                };

                // Close AI modal and open review modal for manual completion
                this.$refs.aiModal.hide();
                this.$refs.createModal.show();

                Notify.create({
                    message: $t('msg.aiGenerationFailed') || 'AI generation is currently unavailable. You can continue creating the finding manually.',
                    color: 'warning',
                    textColor: 'white',
                    position: 'top-right',
                    timeout: 6000
                });
            });
        },

        closeCreateModal: function() {
            this.aiFinding = {
                title: '',
                vulnType: '',
                description: '',
                observation: '',
                remediation: '',
                poc: '',
                remediationComplexity: '',
                priority: '',
                references: [],
                cvssv3: '',
                cvssv4: '',
                category: null
            };
        },

        createFindingFromAI: function() {
            if (!this.aiFinding.title.trim()) {
                Notify.create({
                    message: $t('msg.titleRequired') || 'Title is required',
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right'
                });
                return;
            }

            var finding = {
                title: this.aiFinding.title,
                vulnType: this.aiFinding.vulnType || '',
                description: this.aiFinding.description || '',
                observation: this.aiFinding.observation || '',
                remediation: this.aiFinding.remediation || '',
                poc: this.aiFinding.poc || '',
                remediationComplexity: this.aiFinding.remediationComplexity || '',
                priority: this.aiFinding.priority || '',
                references: this.aiFinding.references || [],
                cvssv3: this.aiFinding.cvssv3 || '',
                cvssv4: this.aiFinding.cvssv4 || '',
                category: this.aiFinding.category ? this.aiFinding.category.name : null,
                customFields: Utils.filterCustomFields('finding', this.aiFinding.category ? this.aiFinding.category.name : '', this.$parent.customFields, [], this.$parent.audit.language)
            };

            AuditService.createFinding(this.auditId, finding)
            .then((response) => {
                this.$refs.createModal.hide();

                Notify.create({
                    message: $t('msg.findingCreateOk'),
                    color: 'positive',
                    textColor: 'white',
                    position: 'top-right'
                });

                // Navigate to the edit page for the new finding
                if (response.data && response.data.datas && response.data.datas._id) {
                    this.$router.push(`/audits/${this.auditId}/findings/${response.data.datas._id}`);
                }
            })
            .catch((err) => {
                Notify.create({
                    message: err.response ? err.response.data.datas : 'Error creating finding',
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right'
                });
            });
        }
    }
}