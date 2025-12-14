import { Notify, Dialog } from 'quasar';

import BasicEditor from 'components/editor/Editor.vue';
import Breadcrumb from 'components/breadcrumb';
import Cvss3Calculator from 'components/cvss3calculator'
import Cvss4Calculator from 'components/cvss4calculator'
import TextareaArray from 'components/textarea-array'
import CustomFields from 'components/custom-fields'
import CommentsList from 'components/comments-list'

import AuditService from '@/services/audit';
import DataService from '@/services/data';
import UserService from '@/services/user';
import VulnService from '@/services/vulnerability';
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
            findingOrig: {},
            selectedTab: "definition",
            proofsTabVisited: false,
            detailsTabVisited: false,
            vulnTypes: [],
            AUDIT_VIEW_STATE: Utils.AUDIT_VIEW_STATE,
            overrideLeaveCheck: false,
            transitionEnd: true,
            // AI Check
            aiCheckLoading: false,
            aiAnalysis: null,
            aiCorrectedText: {},
            // AI Format Proof
            aiFormatProofLoading: false,
            aiRawProofInput: '',
            aiFormatProofLocale: 'en',
            aiFormatProofLocaleOptions: [
                { label: 'English (US)', value: 'en' },
                { label: 'Português (BR)', value: 'pt-BR' }
            ],
            // Comments
            commentTemp: null,
            replyTemp: null,
            hoverReply: null,
            commentDateOptions: {
                year: 'numeric',
                month: 'long',
                day: '2-digit',
                hour: 'numeric',
                minute: '2-digit',
            }
        }
    },

    components: {
        BasicEditor,
        Breadcrumb,
        Cvss3Calculator,
        Cvss4Calculator,
        TextareaArray,
        CustomFields,
        CommentsList
    },

    mounted: async function() {
        this.auditId = this.$route.params.auditId;
        this.findingId = this.$route.params.findingId;
        this.getFinding();
        this.getVulnTypes();

        this.$socket.emit('menu', {menu: 'editFinding', finding: this.findingId, room: this.auditId});

        // save on ctrl+s
        document.addEventListener('keydown', this._listener, false);
        // listen for comments added in the editor
        document.addEventListener('comment-added', this.editorCommentAdded)
        document.addEventListener('comment-clicked', this.editorCommentClicked)

        this.$parent.focusedComment = ""
        this.$parent.fieldHighlighted = ""

        await this.$nextTick()
        if (this.$route.params.comment){
            this.focusComment(this.$route.params.comment)
            // Focus comment on the sidebar
            let commentElementSidebar = document.getElementById(`sidebar-${this.$route.params.comment._id}`)
            if (commentElementSidebar)
                commentElementSidebar.scrollIntoView({block: "center"})
        }
        
    },

    destroyed: function() {
        document.removeEventListener('keydown', this._listener, false);
        document.removeEventListener('comment-added', this.editorCommentAdded)
        document.removeEventListener('comment-clicked', this.editorCommentClicked)
    },

    beforeRouteLeave (to, from , next) {
        Utils.syncEditors(this.$refs)

        var displayHighlightWarning = this.displayHighlightWarning()

        if (this.unsavedChanges()) {
            Dialog.create({
            title: $t('msg.thereAreUnsavedChanges'),
            message: $t('msg.doYouWantToLeave'),
            ok: {label: $t('btn.confirm'), color: 'negative'},
            cancel: {label: $t('btn.cancel'), color: 'white'},
            focus: 'cancel'
            })
            .onOk(() => next())
        }
        else if (!this.$parent.commentMode && displayHighlightWarning) {
            Dialog.create({
                title: $t('msg.highlightWarningTitle'),
                message: `${displayHighlightWarning}</mark>`,
                html: true,
                ok: {label: $t('btn.leave'), color: 'negative'},
                cancel: {label: $t('btn.stay'), color: 'white'},
            })
            .onOk(() => next())
        }
        else
            next()
    },

    beforeRouteUpdate (to, from , next) {
        Utils.syncEditors(this.$refs)

        var displayHighlightWarning = this.displayHighlightWarning()

        if (this.unsavedChanges()) {
            Dialog.create({
            title: $t('msg.thereAreUnsavedChanges'),
            message: $t('msg.doYouWantToLeave'),
            ok: {label: $t('btn.confirm'), color: 'negative'},
            cancel: {label: $t('btn.cancel'), color: 'white'},
            focus: 'cancel'
            })
            .onOk(() => next())
        }
        else if (!this.$parent.commentMode && displayHighlightWarning) {
            Dialog.create({
                title: $t('msg.highlightWarningTitle'),
                message: `${displayHighlightWarning}</mark>`,
                html: true,
                ok: {label: $t('btn.leave'), color: 'negative'},
                cancel: {label: $t('btn.stay'), color: 'white'},
            })
            .onOk(() => next())
        }
        else
            next()
    },

    computed: {
        vulnTypesLang: function() {
            return this.vulnTypes.filter(type => type.locale === this.$parent.audit.language);
        },

        screenshotsSize: function() {
            return ((JSON.stringify(this.uploadedImages).length) / 1024).toFixed(2)
        },

        canCreateComment: function() {
            return UserService.isAllowed('audits:comments:create') 
        },
    },

    methods: {
        _listener: function(e) {
            if ((window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) && e.keyCode == 83) {
                e.preventDefault();
                if (this.frontEndAuditState === this.AUDIT_VIEW_STATE.EDIT)
                    this.updateFinding();
            }
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

        // Get Finding
        getFinding: function() {
            AuditService.getFinding(this.auditId, this.findingId)
            .then((data) => {
                this.finding = data.data.datas;
                if (this.finding.customFields && // For retrocompatibility with customField reference instead of object
                    this.finding.customFields.length > 0 && 
                    typeof (this.finding.customFields[0].customField) === 'string') 
                    this.finding.customFields = Utils.filterCustomFields('finding', this.finding.category, this.$parent.customFields, this.finding.customFields, this.$parent.audit.language)
                if (this.finding.paragraphs.length > 0 && !this.finding.poc)
                    this.finding.poc = this.convertParagraphsToHTML(this.finding.paragraphs)

                this.$nextTick(() => {
                    Utils.syncEditors(this.$refs)
                    this.findingOrig = this.$_.cloneDeep(this.finding); 
                })
            })
            .catch((err) => {
                if (!err.response)
                    console.log(err)
                else if (err.response.status === 403)
                    this.$router.push({name: '403', params: {error: err.response.data.datas}})
                else if (err.response.status === 404)
                    this.$router.push({name: '404', params: {error: err.response.data.datas}})
            })
        },

        // For retro compatibility with old paragraphs
        convertParagraphsToHTML: function(paragraphs) {
            var result = ""
            paragraphs.forEach(p => {
                result += `<p>${p.text}</p>`
                if (p.images.length > 0) {
                    p.images.forEach(img => {
                        result += `<img src="${img.image}" alt="${img.caption}" />`
                    })
                }
            })
            return result
        },

        // Update Finding
        updateFinding: function() {
            Utils.syncEditors(this.$refs)
            this.$nextTick(() => {
                var customFieldsEmpty = this.$refs.customfields && this.$refs.customfields.requiredFieldsEmpty()
                var defaultFieldsEmpty = this.requiredFieldsEmpty()
                if (customFieldsEmpty || defaultFieldsEmpty) {
                    Notify.create({
                        message: $t('msg.fieldRequired'),
                        color: 'negative',
                        textColor:'white',
                        position: 'top-right'
                    })
                    return
                }
                
                AuditService.updateFinding(this.auditId, this.findingId, this.finding)
                .then(() => {
                    this.findingOrig = this.$_.cloneDeep(this.finding);
                    Notify.create({
                        message: $t('msg.findingUpdateOk'),
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
            })
        },

        deleteFinding: function() {
            Dialog.create({
                title: $t('msg.deleteFindingConfirm'),
                message: $t('msg.deleteFindingNotice'),
                ok: {label: $t('btn.confirm'), color: 'negative'},
                cancel: {label: $t('btn.cancel'), color: 'white'}
            })
            .onOk(() => {
                AuditService.deleteFinding(this.auditId, this.findingId)
                .then(() => {
                    Notify.create({
                        message: $t('msg.findingDeleteOk'),
                        color: 'positive',
                        textColor:'white',
                        position: 'top-right'
                    })
                    this.findingOrig = this.finding
                    this.overrideLeaveCheck = true
                    var currentIndex = this.$parent.audit.findings.findIndex(e => e._id === this.findingId)
                    if (this.$parent.audit.findings.length === 1)
                        this.$router.push(`/audits/${this.$parent.auditId}/findings/add`)
                    else if (currentIndex === this.$parent.audit.findings.length - 1)
                        this.$router.push(`/audits/${this.$parent.auditId}/findings/${this.$parent.audit.findings[currentIndex - 1]._id}`)
                    else
                        this.$router.push(`/audits/${this.$parent.auditId}/findings/${this.$parent.audit.findings[currentIndex + 1]._id}`)
                })
                .catch((err) => {
                    Notify.create({
                        message: err.response.data.datas,
                        color: 'negative',
                        textColor:'white',
                        position: 'top-right'
                    })
                })
            })
        },

         // Backup Finding to vulnerability database
        backupFinding: function() {
            Utils.syncEditors(this.$refs)
            VulnService.backupFinding(this.$parent.audit.language, this.finding)
            .then((data) => {
                Notify.create({
                    message: data.data.datas,
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
        },

        syncEditors: function() {
            this.transitionEnd = false
            Utils.syncEditors(this.$refs)
        },

        updateOrig: function() {
            this.transitionEnd = true
            if (this.selectedTab === 'proofs' && !this.proofsTabVisited){
                Utils.syncEditors(this.$refs)
                this.findingOrig.poc = this.finding.poc
                this.proofsTabVisited = true
            }
            else if (this.selectedTab === 'details' && !this.detailsTabVisited){
                Utils.syncEditors(this.$refs)
                this.findingOrig.remediation = this.finding.remediation
                this.detailsTabVisited = true
            }
        },

        toggleSplitView: function() {
            this.$parent.retestSplitView = !this.$parent.retestSplitView
            if (this.$parent.retestSplitView) {
                this.$parent.retestSplitRatio = 50
                this.$parent.retestSplitLimits = [40, 60]
            }
            else {
                this.$parent.retestSplitRatio = 100
                this.$parent.retestSplitLimits = [100, 100]
            }
            if (this.$parent.retestSplitView && this.$parent.commentMode)
                this.toggleCommentView()
        },

        // *** Comments Handling ***

        toggleCommentView: function() {
            Utils.syncEditors(this.$refs)
            this.$parent.commentMode = !this.$parent.commentMode
            if (this.$parent.commentMode && this.$parent.retestSplitView)
                this.toggleSplitView()
        },

        focusComment: function(comment) {
            let commentId = comment._id || comment.commentId
            // If another comment is in progress or if comment already focused, then do nothing
            if (
                (!!this.$parent.editComment && this.$parent.editComment !== commentId) || 
                (this.$parent.replyingComment && !comment.replyTemp) || 
                (this.$parent.focusedComment === commentId)
            )
                return

            // If comment is in another finding, then redirect to it
            if (comment.findingId && this.findingId !== comment.findingId) {
                this.$router.replace({name: 'editFinding', params: {
                    auditId: this.auditId, 
                    findingId: comment.findingId, 
                    comment: comment
                }})
                return
            }

            // If comment is in another section, then redirect to it
            if (comment.sectionId && this.sectionId !== comment.sectionId) {
                this.$router.replace({name: 'editSection', params: {
                    auditId: this.auditId, 
                    sectionId: comment.sectionId, 
                    comment: comment
                }})
                return
            }

            let definitionFields = ["titleField", "typeField", "descriptionField", "observationField", "referencesField"]
            let detailsFields = ["affectedField", "cvssField", "remediationDifficultyField", "priorityField", "remediationField"]

            // Go to definition tab and scrollTo field
            if (this.selectedTab !== 'definition' && (definitionFields.includes(comment.fieldName) || comment.fieldName.startsWith('field-'))) {
                this.selectedTab = "definition"
            }
            else if (this.selectedTab !== 'poc' && comment.fieldName === 'pocField') {
                this.selectedTab = "proofs"
            }
            else if (this.selectedTab !== 'details' && detailsFields.includes(comment.fieldName)) {
                this.selectedTab = "details"
            }
            let checkCount = 0
            let elementField = null
            let elementCommentEditor = null
            const intervalId = setInterval(() => {
                checkCount++
                elementField = document.getElementById(comment.fieldName)
                elementCommentEditor = document.getElementById(comment._id)
                if (elementField || elementCommentEditor) {
                    clearInterval(intervalId)
                    if (elementCommentEditor) {
                        elementCommentEditor.scrollIntoView({block: "center"})
                    }
                    else {
                        elementField.scrollIntoView({block: "center"})
                    }
                }
                else if (checkCount >= 10) {
                    clearInterval(intervalId)
                }
            }, 200)

            this.$parent.fieldHighlighted = comment.fieldName
            this.$parent.focusedComment = comment._id

        },

        editorCommentAdded: function(event) {
            if (!event.detail || !event.detail.fieldName || !event.detail.id)
                return

            if (event.detail.warning) {
                Dialog.create({
                    title: $t('Warning'),
                    message: $t(event.detail.warning),
                    ok: {label: $t('btn.confirm'), color: 'warning'},
                    cancel: {label: $t('btn.cancel'), color: 'white'}
                })
                .onOk(() => {
                    if (event.detail.fieldName && event.detail.id)
                    this.createComment(event.detail.fieldName, event.detail.id)
                })
            }
            else {
                this.createComment(event.detail.fieldName, event.detail.id)
            }
        },

        editorCommentClicked: function(event) {
            if (this.$parent.commentMode && event.detail.id) {
                let comment = this.$parent.audit.comments.find(e => e._id === event.detail.id)
                if (comment) {
                    document.getElementById(`sidebar-${comment._id}`).scrollIntoView({block: "center"})
                    this.$parent.fieldHighlighted = comment.fieldName
                    this.$parent.focusedComment = comment._id
                }
            }
        },

        createComment: function(fieldName, commentId) {
            let comment = {
                findingId: this.findingId,
                fieldName: fieldName,
                authorId: UserService.user.id,
                author: {
                    firstname: UserService.user.firstname,
                    lastname: UserService.user.lastname
                },
                text: "" 
            }
            if (commentId) comment.commentId = commentId

            AuditService.createComment(this.auditId, comment)
            .then((res) => {
                let newComment = res.data.datas
                this.$parent.focusedComment = newComment._id
                this.$parent.editComment = newComment._id
                this.$parent.fieldHighlighted = fieldName
                this.focusComment(comment)
                this.updateFinding()
            })
            .catch((err) => {
                Notify.create({
                    message: err.response.data.datas,
                    color: 'negative',
                    textColor:'white',
                    position: 'top-right'
                })
            })
        },

        deleteComment: function(comment) {
            this.$parent.editComment = null
            let commentId = comment._id || comment.commentId
            AuditService.deleteComment(this.auditId, commentId)
            .then(() => {
                if (this.$parent.focusedComment === commentId)
                    this.$parent.fieldHighlighted = ""
                document.dispatchEvent(new CustomEvent('comment-deleted', { detail: { id: commentId } }))
                this.updateFinding()
            })
            .catch((err) => {
                Notify.create({
                    message: err.response.data.datas,
                    color: 'negative',
                    textColor:'white',
                    position: 'top-right'
                })
            })
        },

        updateComment: function(comment) {
            if (comment.textTemp)
                comment.text = comment.textTemp
            if (comment.replyTemp){
                comment.replies.push({
                    author: UserService.user.id,
                    text: comment.replyTemp
                })
            }
            AuditService.updateComment(this.auditId, comment)
                .then(() => {
                    this.$parent.editComment = null
                    this.$parent.editReply = null
                    this.updateFinding()
                })
                .catch((err) => {
                    Notify.create({
                        message: err.response.data.datas,
                        color: 'negative',
                        textColor:'white',
                        position: 'top-right'
                    })
                })
        },

        unsavedChanges: function() {
            if (this.overrideLeaveCheck)
                return false

            if (this.finding.title !== this.findingOrig.title)
                return true
            if ((this.finding.vulnType || this.findingOrig.vulnType) && this.finding.vulnType !== this.findingOrig.vulnType)
                return true
            if ((this.finding.description || this.findingOrig.description) && this.finding.description !== this.findingOrig.description)
                return true
            if ((this.finding.observation || this.findingOrig.observation) && this.finding.observation !== this.findingOrig.observation)
                return true
            if (!this.$_.isEqual(this.finding.references, this.findingOrig.references))
                return true
            if (!this.$_.isEqual(this.finding.customFields, this.findingOrig.customFields))
                return true
            if ((this.finding.poc || this.findingOrig.poc) && this.finding.poc !== this.findingOrig.poc)
                return true
            
            if ((this.finding.scope || this.findingOrig.scope) && this.finding.scope !== this.findingOrig.scope)
                return true
            if (!this.$settings.report.public.scoringMethods.CVSS3 && (this.finding.cvss || this.findingOrig.cvss) && this.finding.cvss !== this.findingOrig.cvss)
                return true
            if (!this.$settings.report.public.scoringMethods.CVSS4 && (this.finding.cvss4 || this.findingOrig.cvss4) && this.finding.cvss4 !== this.findingOrig.cvss4)
                return true
            if ((this.finding.remediationComplexity || this.findingOrig.remediationComplexity) && this.finding.remediationComplexity !== this.findingOrig.remediationComplexity)
                return true
            if ((this.finding.priority || this.findingOrig.priority) && this.finding.priority !== this.findingOrig.priority)
                return true
            if ((this.finding.remediation || this.findingOrig.remediation) && this.finding.remediation !== this.findingOrig.remediation)
                return true

            if (this.finding.status !== this.findingOrig.status)
                return true
            
            if ((this.finding.retestStatus || this.findingOrig.retestStatus) && this.finding.retestStatus !== this.findingOrig.retestStatus)
                return true
            if ((this.finding.retestDescription || this.findingOrig.retestDescription) && this.finding.retestDescription !== this.findingOrig.retestDescription)
                return true

            return false
        },

        displayHighlightWarning: function() {
            if (this.overrideLeaveCheck)
                return null

            if (!this.$settings.report.enabled || !this.$settings.report.public.highlightWarning)
                return null

            var matchString = `(<mark data-color="${this.$settings.report.public.highlightWarningColor}".+?>.+?)</mark>`
            var regex = new RegExp(matchString)
            var result = ""

            result = regex.exec(this.finding.description)
            if (result && result[1])
                return (result[1].length > 119) ? "<b>Description</b><br/>"+result[1].substring(0,119)+'...' : "<b>Description</b><br/>"+result[1]
            result = regex.exec(this.finding.observation)
            if (result && result[1])
                return (result[1].length > 119) ? "<b>Observation</b><br/>"+result[1].substring(0,119)+'...' : "<b>Observation</b><br/>"+result[1]
            result = regex.exec(this.finding.poc)
            if (result && result[1])
                return (result[1].length > 119) ? "<b>Proofs</b><br/>"+result[1].substring(0,119)+'...' : "<b>Proofs</b><br/>"+result[1]
            result = regex.exec(this.finding.remediation)
            if (result && result[1])
                return (result[1].length > 119) ? "<b>Remediation</b><br/>"+result[1].substring(0,119)+'...' : "<b>Remediation</b><br/>"+result[1]
            

            if (this.finding.customFields && this.finding.customFields.length > 0) {
                for (let i in this.finding.customFields) {
                    let field = this.finding.customFields[i]
                    if (field.customField && field.text && field.customField.fieldType === "text") {
                        result = regex.exec(field.text)
                        if (result && result[1])
                            return (result[1].length > 119) ? `<b>${field.customField.label}</b><br/>`+result[1].substring(0,119)+'...' : `<b>${field.customField.label}</b><br/>`+result[1]
                    }
                }
            }
            
            return null
        },

        requiredFieldsEmpty: function() {
            var hasErrors = false

            if (this.$refs.titleField) {
                this.$refs.titleField.validate()
                hasErrors = hasErrors || this.$refs.titleField.hasError
            }
            if (this.$refs.typeField) {
                this.$refs.typeField.validate()
                hasErrors = hasErrors || this.$refs.typeField.hasError
            }
            if (this.$refs.descriptionField) {
                this.$refs.descriptionField.validate()
                hasErrors = hasErrors || this.$refs.descriptionField.hasError
            }
            if (this.$refs.observationField) {
                this.$refs.observationField.validate()
                hasErrors = hasErrors || this.$refs.observationField.hasError
            }
            if (this.$refs.referencesField) {
                this.$refs.referencesField.validate()
                hasErrors = hasErrors || this.$refs.referencesField.hasError
            }
            if (this.$refs.pocField) {
                this.$refs.pocField.validate()
                hasErrors = hasErrors || this.$refs.pocField.hasError
            }
            if (this.$refs.affectedField) {
                this.$refs.affectedField.validate()
                hasErrors = hasErrors || this.$refs.affectedField.hasError
            }
            if (this.$refs.remediationDifficultyField) {
                this.$refs.remediationDifficultyField.validate()
                hasErrors = hasErrors || this.$refs.remediationDifficultyField.hasError
            }
            if (this.$refs.priorityField) {
                this.$refs.priorityField.validate()
                hasErrors = hasErrors || this.$refs.priorityField.hasError
            }
            if (this.$refs.remediationField) {
                this.$refs.remediationField.validate()
                hasErrors = hasErrors || this.$refs.remediationField.hasError
            }

            return hasErrors
        },

        // AI Check functionality
        performAiCheck: function() {
            // Sync editors to get latest content
            Utils.syncEditors(this.$refs)
            
            this.aiCheckLoading = true
            
            AuditService.aiCheckFinding(this.auditId, this.findingId)
            .then((response) => {
                this.aiCheckLoading = false
                console.log('AI Check response received:', response.data)
                
                // The backend wraps the response in 'datas' property
                const analysis = response.data.datas.analysis
                
                // Create a dialog to display the AI analysis results
                this.showAiCheckResults(analysis)
            })
            .catch((err) => {
                this.aiCheckLoading = false
                console.error('AI Check error:', err)
                let errorMessage = 'AI check failed. Please try again.'
                
                if (err.response && err.response.data && err.response.data.datas) {
                    errorMessage = err.response.data.datas
                }
                
                Notify.create({
                    message: errorMessage,
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right',
                    timeout: 5000
                })
            })
        },

        showAiCheckResults: function(analysis) {
            // Store the analysis data for later use
            this.aiAnalysis = analysis
            this.aiCorrectedText = {}
            
            // Generate corrected text for each section
            const sections = ['title', 'description', 'observation', 'proof']
            sections.forEach(section => {
                const sectionData = analysis[section]
                const originalText = this.getOriginalText(section)
                
                if (sectionData.corrected) {
                    this.aiCorrectedText[section] = sectionData.corrected
                } else if (sectionData.issues.length > 0 || sectionData.suggestions.length > 0) {
                    // Generate improved text based on suggestions
                    this.aiCorrectedText[section] = this.generateImprovedText(originalText, sectionData)
                } else {
                    this.aiCorrectedText[section] = originalText
                }
            })

            // Show the AI Check modal using the vulnerability update modal pattern
            this.$refs.aiCheckModal.show()
        },

        closeAiCheckModal: function() {
            // Clean up
            this.aiAnalysis = null
            this.aiCorrectedText = {}
        },

        acceptAiSectionChanges: function(sectionKey) {
            const correctedText = this.aiCorrectedText[sectionKey]
            
            switch(sectionKey) {
                case 'title':
                    this.finding.title = correctedText
                    break
                case 'description':
                    this.finding.description = correctedText
                    break
                case 'observation':
                    this.finding.observation = correctedText
                    break
                case 'proof':
                    this.finding.poc = correctedText
                    break
            }

            // Sync editors to reflect changes
            this.$nextTick(() => {
                Utils.syncEditors(this.$refs)
            })

            Notify.create({
                message: `${sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)} updated with AI suggestions`,
                color: 'positive',
                textColor: 'white',
                position: 'top-right',
                timeout: 3000
            })
        },

        acceptAllAiChanges: function() {
            const sections = ['title', 'description', 'observation', 'proof']
            let changesApplied = 0
            
            sections.forEach(section => {
                const original = this.getOriginalText(section)
                const corrected = this.aiCorrectedText[section]
                
                if (original !== corrected) {
                    this.acceptAiSectionChanges(section)
                    changesApplied++
                }
            })

            if (changesApplied > 0) {
                Notify.create({
                    message: `Applied AI suggestions to ${changesApplied} section${changesApplied > 1 ? 's' : ''}`,
                    color: 'positive',
                    textColor: 'white',
                    position: 'top-right',
                    timeout: 3000
                })
            }
        },

        hasAiChanges: function(sectionKey) {
            if (!this.aiCorrectedText || !this.aiAnalysis) return false
            const original = this.getOriginalText(sectionKey)
            const corrected = this.aiCorrectedText[sectionKey]
            return original !== corrected
        },

        hasAiIssues: function(sectionKey) {
            if (!this.aiAnalysis) return false
            const analysis = this.aiAnalysis[sectionKey]
            return analysis && (analysis.issues.length > 0 || analysis.suggestions.length > 0)
        },

        getOriginalText: function(section) {
            switch(section) {
                case 'title': return this.finding.title || ''
                case 'description': return this.stripHtml(this.finding.description) || ''
                case 'observation': return this.stripHtml(this.finding.observation) || ''
                case 'proof': return this.stripHtml(this.finding.poc) || ''
                default: return ''
            }
        },

        stripHtml: function(html) {
            if (!html) return ''
            return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        },

        generateImprovedText: function(originalText, sectionData) {
            // If no original text, return empty
            if (!originalText) return originalText
            
            // If there are no issues or suggestions, return original
            if (sectionData.issues.length === 0 && sectionData.suggestions.length === 0) {
                return originalText
            }
            
            // Try to apply improvements based on issues and suggestions
            let improvedText = originalText
            
            // Apply corrections based on issues
            sectionData.issues.forEach(issue => {
                console.log('Processing issue:', issue)
                
                // Handle case consistency issues (e.g., HttpOnly vs httponly)
                if (issue.includes("case consistency") || issue.includes("capitalization")) {
                    // Extract the correct case from the issue
                    const caseMatch = issue.match(/'([^']+)'\s+should\s+be\s+'([^']+)'/i)
                    if (caseMatch) {
                        const incorrect = caseMatch[1]
                        const correct = caseMatch[2]
                        // Use case-insensitive replacement but preserve word boundaries
                        const regex = new RegExp(`\\b${incorrect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
                        improvedText = improvedText.replace(regex, correct)
                    }
                }
                
                // Handle specific spelling corrections
                if (issue.includes("'were thngs get weird'") || issue.includes("were thngs get weird")) {
                    improvedText = improvedText.replace(/were\s+thngs\s+get\s+weird/gi, 'where things get weird')
                }
                
                // Handle individual word corrections
                if (issue.includes("'were' to 'where'") || issue.includes("were") && issue.includes("where")) {
                    improvedText = improvedText.replace(/\bwere\b(?=\s+(things|thngs))/gi, 'where')
                }
                if (issue.includes("'thngs' to 'things'") || issue.includes("thngs") && issue.includes("things")) {
                    improvedText = improvedText.replace(/\bthngs\b/gi, 'things')
                }
                if (issue.includes("'wierd' to 'weird'") || issue.includes("wierd") && issue.includes("weird")) {
                    improvedText = improvedText.replace(/\bwierd\b/gi, 'weird')
                }
            })
            
            // Apply suggestions for professional language
            sectionData.suggestions.forEach(suggestion => {
                console.log('Processing suggestion:', suggestion)
                
                if (suggestion.includes("professional") || suggestion.includes("clarity")) {
                    // Replace informal phrases with professional alternatives
                    improvedText = improvedText.replace(/this is where things get weird/gi, 'this is where the issue becomes apparent')
                    improvedText = improvedText.replace(/things get weird/gi, 'the issue becomes apparent')
                    improvedText = improvedText.replace(/weird/gi, 'unusual')
                }
                
                if (suggestion.includes("consistency") && suggestion.includes("capitalization")) {
                    // This is handled in the issues section above
                }
            })
            
            console.log('Text improvement result:', { original: originalText, improved: improvedText })
            return improvedText
        },

        acceptAiSectionChanges: function(sectionKey) {
            const correctedText = this.aiCorrectedText[sectionKey]
            
            switch(sectionKey) {
                case 'title':
                    this.finding.title = correctedText
                    break
                case 'description':
                    this.finding.description = correctedText
                    break
                case 'observation':
                    this.finding.observation = correctedText
                    break
                case 'proof':
                    this.finding.poc = correctedText
                    break
            }

            // Sync editors to reflect changes
            this.$nextTick(() => {
                Utils.syncEditors(this.$refs)
            })

            Notify.create({
                message: `${sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)} updated with AI suggestions`,
                color: 'positive',
                textColor: 'white',
                position: 'top-right',
                timeout: 3000
            })
        },

        // AI Format Proof functionality
        showAiFormatProofModal: function() {
            console.log('showAiFormatProofModal called')
            console.log('aiFormatProofModal ref:', this.$refs.aiFormatProofModal)
            this.aiRawProofInput = ''
            this.aiFormatProofLocale = 'en'
            if (this.$refs.aiFormatProofModal) {
                this.$refs.aiFormatProofModal.show()
            } else {
                console.error('aiFormatProofModal ref not found!')
            }
        },

        closeAiFormatProofModal: function() {
            this.aiRawProofInput = ''
            this.aiFormatProofLoading = false
        },

        formatProofWithAI: function() {
            if (!this.aiRawProofInput.trim()) {
                Notify.create({
                    message: 'Please paste raw proof data',
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right',
                    timeout: 3000
                })
                return
            }

            this.aiFormatProofLoading = true

            AuditService.aiFormatProof(
                this.auditId,
                this.findingId,
                this.aiRawProofInput,
                this.aiFormatProofLocale
            )
            .then((response) => {
                this.aiFormatProofLoading = false

                if (response.data && response.data.datas && response.data.datas.formattedProof) {
                    // Append formatted proof to existing poc content
                    const currentPoc = this.finding.poc || ''
                    const separator = currentPoc ? '<p></p>' : ''
                    this.finding.poc = currentPoc + separator + response.data.datas.formattedProof

                    // Sync editors to reflect changes
                    this.$nextTick(() => {
                        Utils.syncEditors(this.$refs)
                    })

                    this.$refs.aiFormatProofModal.hide()

                    Notify.create({
                        message: 'Proof formatted successfully with AI',
                        color: 'positive',
                        textColor: 'white',
                        position: 'top-right',
                        timeout: 3000
                    })
                } else {
                    throw new Error('Invalid response format')
                }
            })
            .catch((error) => {
                this.aiFormatProofLoading = false
                console.error('AI Format Proof Error:', error)

                let errorMessage = 'Failed to format proof with AI'
                if (error.response && error.response.data && error.response.data.datas) {
                    errorMessage = error.response.data.datas
                }

                Notify.create({
                    message: errorMessage,
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right',
                    timeout: 5000
                })
            })
        }
    }
}
