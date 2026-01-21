import { Dialog, Notify } from 'quasar';

import BasicEditor from 'components/editor/Editor.vue';
import Breadcrumb from 'components/breadcrumb'
import Cvss3Calculator from 'components/cvss3calculator'
import Cvss4Calculator from 'components/cvss4calculator'
import TextareaArray from 'components/textarea-array'
import CustomFields from 'components/custom-fields'

import VulnerabilityService from '@/services/vulnerability'
import DataService from '@/services/data'
import UserService from '@/services/user'
import Utils from '@/services/utils'

import { $t } from 'boot/i18n'

export default {
    data: () => {
        return {
            UserService: UserService,
            // Vulnerabilities list
            vulnerabilities: [],
            // Loading state
            loading: true,
            // Datatable headers
            dtHeaders: [
                {name: 'title', label: $t('title'), field: 'title', align: 'left', sortable: true},
                {name: 'category', label: $t('category'), field: 'category', align: 'left', sortable: true},
                {name: 'type', label: $t('type'), field: 'type', align: 'left', sortable: true},
                {name: 'action', label: '', field: 'action', align: 'left', sortable: false},
            ],
            // Datatable pagination
            pagination: {
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
            // Vulnerabilities languages
            languages: [],
            locale: '',
            // Search filter
            search: {title: '', type: '', category: '', valid: 0, new: 1, updates: 2},
            // Errors messages
            errors: {title: ''},
            // Selected or New Vulnerability
            currentVulnerability: {
                cvss: '',
                cvss4: '',
                priority: '',
                remediationComplexity: '',
                details: [] 
            },
            currentLanguage: "",
            displayFilters: {valid: true, new: true, updates: true},
            dtLanguage: "",
            currentDetailsIndex: 0,
            vulnerabilityId: '',
            vulnUpdates: [],
            currentUpdate: '',
            currentUpdateLocale: '',
            vulnTypes: [],
            // Merge languages
            mergeLanguageLeft: '',
            mergeLanguageRight: '',
            mergeVulnLeft: '',
            mergeVulnRight: '',
            // Vulnerability categories
            vulnCategories: [],
            currentCategory: null,
            // Custom Fields
            customFields: [],
            // AI Modal
            aiTitle: '',
            aiDescription: '',
            aiLanguage: ''
        }
    },

    components: {
        BasicEditor,
        Breadcrumb,
        Cvss3Calculator,
        Cvss4Calculator,
        TextareaArray,
        CustomFields
    },

    mounted: function() {
        this.getLanguages()
        this.getVulnTypes()
        this.getVulnerabilities()
        this.getVulnerabilityCategories()
        this.getCustomFields()
    },

    watch: {
        currentLanguage: function(val, oldVal) {
            this.setCurrentDetails();
        }
    },

    computed: {
        vulnTypesLang: function() {
            return this.vulnTypes.filter(type => type.locale === this.currentLanguage);
        },

        computedVulnerabilities: function() {
            var result = [];
            this.vulnerabilities.forEach(vuln => {
                for (var i=0; i<vuln.details.length; i++) {
                    if (vuln.details[i].locale === this.dtLanguage && vuln.details[i].title) {
                        result.push(vuln);
                    }
                }
            })
            return result;
        },

        vulnCategoriesOptions: function() {
            var result = this.vulnCategories.map(cat => {return cat.name})
            result.unshift('No Category')
            return result
        },

        vulnTypeOptions: function() {
            var result = this.vulnTypes.filter(type => type.locale === this.dtLanguage).map(type => {return type.name})
            result.unshift('Undefined')
            return result
        },

        aiLanguageOptions: function() {
            return this.languages.map(lang => {
                return {
                    label: lang.language,
                    value: lang.locale
                }
            })
        }
    },

    methods: {
        // Get available languages
        getLanguages: function() {
            DataService.getLanguages()
            .then((data) => {
                this.languages = data.data.datas;
                if (this.languages.length > 0) {
                    this.dtLanguage = this.languages[0].locale;
                    this.cleanCurrentVulnerability();
                }
            })
            .catch((err) => {
                console.log(err)
            })
        },

         // Get available custom fields
         getCustomFields: function() {
            DataService.getCustomFields()
            .then((data) => {
                this.customFields = data.data.datas
            })
            .catch((err) => {
                console.log(err)
            })
        },

        // Get Vulnerabilities types
        getVulnTypes: function() {
            DataService.getVulnerabilityTypes()
            .then((data) => {
                this.vulnTypes = data.data.datas;
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

        getVulnerabilities: function() {
            this.loading = true
            VulnerabilityService.getVulnerabilities()
            .then((data) => {
                this.vulnerabilities = data.data.datas
                this.loading = false
            })
            .catch((err) => {
                console.log(err)
                Notify.create({
                    message: err.response.data.datas,
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right'
                })
            })
        },

        createVulnerability: function() {
            this.cleanErrors();
            var index = this.currentVulnerability.details.findIndex(obj => obj.title !== '');
            if (index < 0)
                this.errors.title = $t('err.titleRequired');
            
            if (this.errors.title)
                return;

            VulnerabilityService.createVulnerabilities([this.currentVulnerability])
            .then(() => {
                this.getVulnerabilities();
                this.$refs.createModal.hide();
                Notify.create({
                    message: $t('msg.vulnerabilityCreatedOk'),
                    color: 'positive',
                    textColor:'white',
                    position: 'top-right'
                })
            })
            .catch((err) => {
                Notify.create({
                    message: err.response.data.datas,
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right'
                })
            })
        },

        updateVulnerability: function() {
            this.cleanErrors();
            var index = this.currentVulnerability.details.findIndex(obj => obj.title !== '');
            if (index < 0)
                this.errors.title = $t('err.titleRequired');
            
            if (this.errors.title)
                return;

            VulnerabilityService.updateVulnerability(this.vulnerabilityId, this.currentVulnerability)
            .then(() => {
                this.getVulnerabilities();
                this.$refs.editModal.hide();
                this.$refs.updatesModal.hide();
                Notify.create({
                    message: $t('msg.vulnerabilityUpdatedOk'),
                    color: 'positive',
                    textColor:'white',
                    position: 'top-right'
                })
            })
            .catch((err) => {
                Notify.create({
                    message: err.response.data.datas,
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right'
                })
            })
        },

        deleteVulnerability: function(vulnerabilityId) {
            VulnerabilityService.deleteVulnerability(vulnerabilityId)
            .then(() => {
                this.getVulnerabilities();
                Notify.create({
                    message: $t('msg.vulnerabilityDeletedOk'),
                    color: 'positive',
                    textColor:'white',
                    position: 'top-right'
                })
            })
            .catch((err) => {
                Notify.create({
                    message: err.response.data.datas,
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right'
                })
            })
        },

        confirmDeleteVulnerability: function(row) {
            Dialog.create({
                title: $t('msg.confirmSuppression'),
                message: $t('msg.vulnerabilityWillBeDeleted'),
                ok: {label: $t('btn.confirm'), color: 'negative'},
                cancel: {label: $t('btn.cancel'), color: 'white'}
            })
            .onOk(() => this.deleteVulnerability(row._id))
        },

        getVulnUpdates: function(vulnId) {
            VulnerabilityService.getVulnUpdates(vulnId)
            .then((data) => {
                this.vulnUpdates = data.data.datas;
                this.vulnUpdates.forEach(vuln => {
                    vuln.customFields = Utils.filterCustomFields('vulnerability', this.currentVulnerability.category, this.customFields, vuln.customFields, vuln.locale)
                })
                if (this.vulnUpdates.length > 0) {
                    this.currentUpdate = this.vulnUpdates[0]._id || null;
                    this.currentLanguage = this.vulnUpdates[0].locale || null;
                }
            })
            .catch((err) => {
                console.log(err)
            })
        },

        clone: function(row) {
            this.cleanCurrentVulnerability();
            
            this.currentVulnerability = this.$_.cloneDeep(row)
            this.setCurrentDetails();
            
            this.vulnerabilityId = row._id;
            if (this.UserService.isAllowed('vulnerabilities:update'))
                this.getVulnUpdates(this.vulnerabilityId);
        },

        editChangeCategory: function(category) {
            Dialog.create({
                title: $t('msg.confirmCategoryChange'),
                message: $t('msg.categoryChangingNotice'),
                ok: {label: $t('btn.confirm'), color: 'negative'},
                cancel: {label: $t('btn.cancel'), color: 'white'}
            })
            .onOk(() => {
                if (category){
                    this.currentVulnerability.category = category.name
                }
                else {
                    this.currentVulnerability.category = null
                }
                this.setCurrentDetails()
            })
        },

        cleanErrors: function() {
            this.errors.title = '';
        },  

        cleanCurrentVulnerability: function() {
            this.cleanErrors();
            this.currentVulnerability.cvssv3 = '';
            this.currentVulnerability.cvssv4 = '';
            this.currentVulnerability.cvssScore = '';
            this.currentVulnerability.priority = '';
            this.currentVulnerability.remediationComplexity = '';
            this.currentVulnerability.details = [];
            this.currentLanguage = this.dtLanguage;
            if (this.currentCategory && this.currentCategory.name) 
                this.currentVulnerability.category = this.currentCategory.name
            else
                this.currentVulnerability.category = null

            this.setCurrentDetails();
        },

        // Create detail if locale doesn't exist else set the currentDetailIndex
        setCurrentDetails: function(value) {
            var index = this.currentVulnerability.details.findIndex(obj => obj.locale === this.currentLanguage);
            if (index < 0) {
                var details = {
                    locale: this.currentLanguage,
                    title: '',
                    vulnType: '',
                    description: '',
                    observation: '',
                    remediation: '',
                    poc: '',
                    references: [],
                    customFields: []
                }
                details.customFields = Utils.filterCustomFields('vulnerability', this.currentVulnerability.category, this.customFields, [], this.currentLanguage)
                
                this.currentVulnerability.details.push(details)
                index = this.currentVulnerability.details.length - 1;
            }
            else {
                this.currentVulnerability.details[index].customFields = Utils.filterCustomFields('vulnerability', this.currentVulnerability.category, this.customFields, this.currentVulnerability.details[index].customFields, this.currentLanguage)
            }
            this.currentDetailsIndex = index;
        },

        isTextInCustomFields: function(field) {

            if (this.currentVulnerability.details[this.currentDetailsIndex].customFields) {
                return typeof this.currentVulnerability.details[this.currentDetailsIndex].customFields.find(f => {
                    return f.customField === field.customField._id && f.text === field.text
                }) === 'undefined'
            }
            return false
        },

        getTextDiffInCustomFields: function(field) {
            var result = ''
            if (this.currentVulnerability.details[this.currentDetailsIndex].customFields) {
                this.currentVulnerability.details[this.currentDetailsIndex].customFields.find(f => {
                    if (f.customField === field.customField._id)
                        result = f.text
                })
            }
            return result
        },

        getDtTitle: function(row) {
            var index = row.details.findIndex(obj => obj.locale === this.dtLanguage);
            if (index < 0 || !row.details[index].title)
                return $t('err.notDefinedLanguage');
            else
                return row.details[index].title;         
        },

        getDtType: function(row) {
            var index = row.details.findIndex(obj => obj.locale === this.dtLanguage);
            if (index < 0 || !row.details[index].vulnType)
                return "Undefined";
            else
                return row.details[index].vulnType;         
        },

        customSort: function(rows, sortBy, descending) {
            if (rows) {
                var data = [...rows];

                if (sortBy === 'type') {
                    (descending)
                        ? data.sort((a, b) => this.getDtType(b).localeCompare(this.getDtType(a)))
                        : data.sort((a, b) => this.getDtType(a).localeCompare(this.getDtType(b)))
                }
                else if (sortBy === 'title') {
                    (descending)
                        ? data.sort((a, b) => this.getDtTitle(b).localeCompare(this.getDtTitle(a)))
                        : data.sort((a, b) => this.getDtTitle(a).localeCompare(this.getDtTitle(b)))
                }
                else if (sortBy === 'category') {
                    (descending)
                        ? data.sort((a, b) => (b.category || $t('noCategory')).localeCompare(a.category || $t('noCategory')))
                        : data.sort((a, b) => (a.category || $t('noCategory')).localeCompare(b.category || $t('noCategory')))
                }
                return data;
            }
        },

        customFilter: function(rows, terms, cols, getCellValue) {
            var result = rows && rows.filter(row => {
                var title = this.getDtTitle(row).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                var type = this.getDtType(row).toLowerCase()
                var category = (row.category || $t('noCategory')).toLowerCase()
                var termTitle = (terms.title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                var termCategory = (terms.category || "").toLowerCase()
                var termVulnType = (terms.type || "").toLowerCase()
                return title.indexOf(termTitle) > -1 && 
                type.indexOf(termVulnType||"") > -1 &&
                category.indexOf(termCategory||"") > -1 &&
                (row.status === terms.valid || row.status === terms.new || row.status === terms.updates)
            })
            this.filteredRowsCount = result.length;
            return result;
        },

        goToAudits: function(row) {
            var title = this.getDtTitle(row);
            this.$router.push({name: 'audits', params: {finding: title}});
        },

        getVulnTitleLocale: function(vuln, locale) {
            for (var i=0; i<vuln.details.length; i++) {
                if (vuln.details[i].locale === locale && vuln.details[i].title) return vuln.details[i].title;
            }
            return "undefined";
        },

        mergeVulnerabilities: function() {
            VulnerabilityService.mergeVulnerability(this.mergeVulnLeft, this.mergeVulnRight, this.mergeLanguageRight)
            .then(() => {
                this.getVulnerabilities();
                Notify.create({
                    message: $t('msg.vulnerabilityMergeOk'),
                    color: 'positive',
                    textColor:'white',
                    position: 'top-right'
                })
            })
            .catch((err) => {
                Notify.create({
                    message: err.response.data.datas,
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right'
                })
            })
        },

        dblClick: function(row) {
            this.clone(row)
            if (this.UserService.isAllowed('vulnerabilities:update') && row.status === 2)
                this.$refs.updatesModal.show()
            else
                this.$refs.editModal.show()
        },

        // AI Modal methods
        showAiModal: function() {
            this.aiTitle = '';
            this.aiDescription = '';
            this.aiLanguage = this.languages.length > 0 ? this.languages[0].locale : 'en';
            this.$refs.aiModal.show();
        },

        closeAiModal: function() {
            this.aiTitle = '';
            this.aiDescription = '';
            this.aiLanguage = this.languages.length > 0 ? this.languages[0].locale : 'en';
        },

        createWithAI: function() {
            // Validate input
            if (!this.aiTitle.trim() && !this.aiDescription.trim()) {
                Notify.create({
                    message: 'Please provide at least a title or description',
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right'
                });
                return;
            }

            // Check AI settings first
            console.log('[DEBUG] Checking AI settings...');
            this.$axios.get('/settings')
            .then((settingsResponse) => {
                console.log('[DEBUG] Current settings:', settingsResponse.data);
                console.log('[DEBUG] Full settings datas:', JSON.stringify(settingsResponse.data.datas, null, 2));
                if (settingsResponse.data && settingsResponse.data.datas && settingsResponse.data.datas.ai) {
                    console.log('[DEBUG] AI settings:', settingsResponse.data.datas.ai);
                    if (!settingsResponse.data.datas.ai.enabled) {
                        Notify.create({
                            message: 'AI features are not enabled. Please enable AI in settings first.',
                            color: 'negative',
                            textColor: 'white',
                            position: 'top-right'
                        });
                        return;
                    }
                    if (!settingsResponse.data.datas.ai.private || !settingsResponse.data.datas.ai.private.apiKeyConfigured) {
                        Notify.create({
                            message: 'OpenAI API key is not configured. Please set your API key in settings first.',
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
                console.log('[DEBUG] Error getting settings:', err);
                // Proceed anyway, let the backend handle the validation
                this.performAIGeneration();
            });
        },

        performAIGeneration: function() {

            // Show loading state
            this.$q.loading.show({
                message: 'Generating vulnerability content with AI...'
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
            console.log('[DEBUG] Sending AI generation request:', requestData);
            console.log('[DEBUG] Request URL: vulnerabilities/ai-generate');
            this.$axios.post('vulnerabilities/ai-generate', requestData)
            .then((response) => {
                console.log('[DEBUG] AI generation response:', response);
                this.$q.loading.hide();
                
                if (response.data && response.data.datas) {
                    var aiData = response.data.datas;
                    
                    // Pre-populate the vulnerability creation form with AI-generated content
                    this.cleanCurrentVulnerability();
                    this.currentLanguage = aiData.locale || this.dtLanguage;
                    this.setCurrentDetails();
                    
                    // Set the generated content
                    this.currentVulnerability.details[this.currentDetailsIndex].title = aiData.title;
                    this.currentVulnerability.details[this.currentDetailsIndex].description = aiData.description;
                    this.currentVulnerability.details[this.currentDetailsIndex].observation = aiData.observation;
                    this.currentVulnerability.details[this.currentDetailsIndex].remediation = aiData.remediation;
                    this.currentVulnerability.details[this.currentDetailsIndex].references = aiData.references || [];
                    
                    // Set CVSS fields if provided by AI
                    if (aiData.cvssv3) {
                        this.currentVulnerability.cvssv3 = aiData.cvssv3;
                    }
                    if (aiData.cvssv4) {
                        this.currentVulnerability.cvssv4 = aiData.cvssv4;
                    }
                    // Note: Don't set cvssScore here - let the CVSS calculator component calculate it
                    // from the vector string to maintain proper reactivity
                    
                    // Set remediation complexity if provided (1=Easy, 2=Medium, 3=Complex)
                    if (aiData.remediationComplexity && aiData.remediationComplexity >= 1 && aiData.remediationComplexity <= 3) {
                        this.currentVulnerability.remediationComplexity = aiData.remediationComplexity;
                    }
                    
                    // Set remediation priority if provided (1=Low, 2=Medium, 3=High, 4=Urgent)
                    if (aiData.priority && aiData.priority >= 1 && aiData.priority <= 4) {
                        this.currentVulnerability.priority = aiData.priority;
                    }
                    
                    // Close AI modal and open the regular creation modal for review
                    this.$refs.aiModal.hide();
                    this.$refs.createModal.show();
                    
                    // Force CVSS calculator and dropdowns to update after modal is shown
                    this.$nextTick(() => {
                        if (aiData.cvssv3) {
                            // Force reactivity by setting the value again
                            this.$set(this.currentVulnerability, 'cvssv3', aiData.cvssv3);
                        }
                        if (aiData.cvssv4) {
                            this.$set(this.currentVulnerability, 'cvssv4', aiData.cvssv4);
                        }
                        // Ensure remediation complexity dropdown is properly updated
                        if (aiData.remediationComplexity && aiData.remediationComplexity >= 1 && aiData.remediationComplexity <= 3) {
                            this.$set(this.currentVulnerability, 'remediationComplexity', aiData.remediationComplexity);
                        }
                        // Ensure priority dropdown is properly updated
                        if (aiData.priority && aiData.priority >= 1 && aiData.priority <= 4) {
                            this.$set(this.currentVulnerability, 'priority', aiData.priority);
                        }
                    });
                    
                    Notify.create({
                        message: 'AI content generated successfully! Please review and modify as needed.',
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
                console.error('AI Generation Error:', error);
                
                // Instead of just showing an error, open the manual creation form
                this.cleanCurrentVulnerability();
                this.currentLanguage = this.dtLanguage;
                this.setCurrentDetails();
                
                // Pre-populate with user's original input
                if (userTitle) {
                    this.currentVulnerability.details[this.currentDetailsIndex].title = userTitle;
                }
                if (userDescription) {
                    this.currentVulnerability.details[this.currentDetailsIndex].description = userDescription;
                }
                
                // Close AI modal and open the regular creation modal
                this.$refs.aiModal.hide();
                this.$refs.createModal.show();
                
                // Show a helpful message explaining the fallback
                Notify.create({
                    message: 'AI generation is currently unavailable. You can continue creating the vulnerability manually with your provided information.',
                    color: 'warning',
                    textColor: 'white',
                    position: 'top-right',
                    timeout: 6000
                });
            });
        }
    }
}
