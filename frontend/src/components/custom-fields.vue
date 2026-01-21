<template>
<div>
    <component :is="customElement" v-for="(computedField,idx) of computedFields" :key="idx">
        <div class="row q-col-gutter-md">
            <div v-for="(field,idx2) of computedField" :key="idx2" :class="`col-12 col-md-${field.customField.size||12} offset-md-${field.customField.offset||0}`">
                <q-field
                :id="`field-${field.customField.label}`"
                :ref="`field-${idx}-${idx2}`"
                v-if="field.customField.fieldType === 'text'" 
                label-slot 
                stack-label 
                borderless
                :class="{
                    'bg-diffbackground': isTextInCustomFields(field),
                    'highlighted-border': fieldHighlighted == `field-${field.customField.label}` && commentMode
                }"
                class="basic-editor"
                :hint="field.customField.description"
                hide-bottom-space
                :rules="(field.customField.required)? [val => !!val || 'Field is required']: []"
                lazy-rules="ondemand"
                :value="field.text"
                >
                    <template v-slot:control>
                        <basic-editor 
                        v-if="diff"
                        v-model="field.text"
                        :diff="getTextDiffInCustomFields(field)"
                        :editable=false
                        /> 
                        <basic-editor 
                        v-else
                        ref="basiceditor_custom" 
                        v-model="field.text" 
                        :noSync="noSyncEditor"
                        :editable="!readonly"
                        :fieldName="`field-${field.customField.label}`"
                        :commentMode="commentMode && canCreateComment"
                        :focusedComment="focusedComment"
                        :commentIdList="commentIdList"
                        /> 
                    </template>

                    <template v-slot:label>
                        {{field.customField.label}} <span v-if="field.customField.required" class="text-red">*</span>
                    </template>
                </q-field>

                <q-input
                :ref="`field-${idx}-${idx2}`"
                :for="`field-${field.customField.label}`"
                v-if="field.customField.fieldType === 'input'"
                :label='field.customField.label'
                stack-label
                v-model="field.text"
                :class="{'highlighted-border': fieldHighlighted == `field-${field.customField.label}` && commentMode}"
                :readonly="readonly"
                :bg-color="(isTextInCustomFields(field))?'diffbackground':null"
                :hint="field.customField.description"
                hide-bottom-space
                :rules="(field.customField.required)? [val => !!val || 'Field is required']: []"
                lazy-rules="ondemand"
                outlined
                >
                    <template v-slot:label>
                        {{field.customField.label}} <span v-if="field.customField.required" class="text-red">*</span>
                    </template>
                    <q-badge v-if="commentMode && canCreateComment" color="deep-purple" floating class="cursor-pointer" @click="createComment(`field-${field.customField.label}`)">
                        <q-icon name="add_comment" size="xs" />
                    </q-badge>
                </q-input>

                <q-input
                :ref="`field-${idx}-${idx2}`"
                :for="`field-${field.customField.label}`"
                v-if="field.customField.fieldType === 'date'"
                :label='field.customField.label'
                stack-label
                v-model="field.text"
                :class="{'highlighted-border': fieldHighlighted == `field-${field.customField.label}` && commentMode}"
                :readonly="readonly"
                :bg-color="(isTextInCustomFields(field))?'diffbackground':null"
                :hint="field.customField.description"
                hide-bottom-space
                :rules="(field.customField.required)? [val => !!val || 'Field is required']: []"
                lazy-rules="ondemand"
                outlined
                >
                    <template v-slot:append>
                        <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy ref="qDateProxyField" transition-show="scale" transition-hide="scale">
                            <q-date :readonly="readonly" first-day-of-week="1" mask="YYYY-MM-DD" v-model="field.text" @input="$refs.qDateProxyField.forEach(e => e.hide())" />
                        </q-popup-proxy>
                        </q-icon>
                    </template>
                    <template v-slot:label>
                        {{field.customField.label}} <span v-if="field.customField.required" class="text-red">*</span>
                    </template>
                    <q-badge v-if="commentMode && canCreateComment" color="deep-purple" floating class="cursor-pointer" @click="createComment(`field-${field.customField.label}`)">
                        <q-icon name="add_comment" size="xs" />
                    </q-badge>
                </q-input>

                <q-select
                :ref="`field-${idx}-${idx2}`"
                :id="`field-${field.customField.label}`"
                v-if="field.customField.fieldType === 'select'"
                :label="field.customField.label"
                stack-label
                v-model="field.text"
                :options="field.customField.options.filter(e => e.locale === locale)"
                option-value="value"
                option-label="value"
                emit-value
                clearable
                @clear="field.text = ''"
                options-sanitize
                outlined 
                :readonly="readonly"
                :class="{'highlighted-border': fieldHighlighted == `field-${field.customField.label}` && commentMode}"
                :bg-color="(isTextInCustomFields(field))?'diffbackground':null"
                :hint="field.customField.description"
                hide-bottom-space
                :rules="(field.customField.required)? [val => !!val || 'Field is required']: []"
                lazy-rules="ondemand"
                >
                     <template v-slot:label>
                        {{field.customField.label}} <span v-if="field.customField.required" class="text-red">*</span>
                    </template>
                    <q-badge v-if="commentMode && canCreateComment" color="deep-purple" floating class="cursor-pointer" @click="createComment(`field-${field.customField.label}`)">
                        <q-icon name="add_comment" size="xs" />
                    </q-badge>
                </q-select>

                <q-select
                :ref="`field-${idx}-${idx2}`"
                :id="`field-${field.customField.label}`"
                v-if="field.customField.fieldType === 'select-multiple'"
                :label="field.customField.label"
                stack-label
                v-model="field.text"
                :options="field.customField.options.filter(e => e.locale === locale)"
                option-value="value"
                option-label="value"
                emit-value
                multiple
                use-chips
                clearable
                @clear="field.text = []"
                options-sanitize
                outlined 
                :readonly="readonly"
                :class="{'highlighted-border': fieldHighlighted == `field-${field.customField.label}` && commentMode}"
                :bg-color="(isTextInCustomFields(field))?'diffbackground':null"
                :hint="field.customField.description"
                hide-bottom-space
                :rules="(field.customField.required)? [val => !!val || 'Field is required', val => val && val.length > 0 || 'Field is required']: []"
                lazy-rules="ondemand"
                >
                     <template v-slot:label>
                        {{field.customField.label}} <span v-if="field.customField.required" class="text-red">*</span>
                    </template>
                     <template v-slot:selected-item="scope">
                        <q-chip
                        dense
                        removable
                        @remove="scope.removeAtIndex(scope.index)"
                        :tabindex="scope.tabindex"
                        color="blue-grey-5"
                        text-color="white"
                        :disable="readonly"
                        >
                            {{scope.opt}}
                        </q-chip>
                    </template>
                    <q-badge v-if="commentMode && canCreateComment" color="deep-purple" floating class="cursor-pointer" @click="createComment(`field-${field.customField.label}`)">
                        <q-icon name="add_comment" size="xs" />
                    </q-badge>
                </q-select>

                <q-field
                :id="`field-${field.customField.label}`"
                :ref="`field-${idx}-${idx2}`"
                v-if="field.customField.fieldType === 'checkbox'"
                :label="field.customField.label"
                stack-label
                :value="field.text"
                :hint="field.description"
                hide-bottom-space
                outlined
                :readonly="readonly"
                :class="{'highlighted-border': fieldHighlighted == `field-${field.customField.label}` && commentMode}"
                :bg-color="(isTextInCustomFields(field))?'diffbackground':null"
                :rules="(field.customField.required)? [val => !!val || 'Field is required', val => val && val.length > 0 || 'Field is required']: []"
                lazy-rules="ondemand"
                >
                    <template v-slot:control>
                        <q-option-group
                        type="checkbox"
                        v-model="field.text"
                        :options="getOptionsGroup(field.customField.options)"
                        :disable="readonly"
                        :inline="field.customField.inline"
                        />
                    </template>
                    <template v-slot:label>
                        {{field.customField.label}} <span v-if="field.customField.required" class="text-red">*</span>
                    </template>
                    <q-badge v-if="commentMode && canCreateComment" color="deep-purple" floating class="cursor-pointer" @click="createComment(`field-${field.customField.label}`)">
                        <q-icon name="add_comment" size="xs" />
                    </q-badge>
                </q-field>

                
                <q-field
                :id="`field-${field.customField.label}`"
                :ref="`field-${idx}-${idx2}`"
                v-if="field.customField.fieldType === 'radio'"
                :label="field.customField.label"
                stack-label
                :value="field.text"
                :hint="field.description"
                hide-bottom-space
                outlined
                :readonly="readonly"
                :class="{'highlighted-border': fieldHighlighted == `field-${field.customField.label}` && commentMode}"
                :bg-color="(isTextInCustomFields(field))?'diffbackground':null"
                :rules="(field.customField.required)? [val => !!val || 'Field is required']: []"
                lazy-rules="ondemand"
                >
                    <template v-slot:control>
                        <q-option-group
                        type="radio"
                        v-model="field.text"
                        :options="getOptionsGroup(field.customField.options)"
                        :disable="readonly"
                        :inline="field.customField.inline"
                        />
                    </template>
                    <template v-slot:label>
                        {{field.customField.label}} <span v-if="field.customField.required" class="text-red">*</span>
                    </template>
                    <q-badge v-if="commentMode && canCreateComment" color="deep-purple" floating class="cursor-pointer" @click="createComment(`field-${field.customField.label}`)">
                        <q-icon name="add_comment" size="xs" />
                    </q-badge>
                </q-field>

                <q-field
                :id="`field-${field.customField.label}`"
                :ref="`field-${idx}-${idx2}`"
                v-if="field.customField.fieldType === 'file'"
                :label="field.customField.label"
                stack-label
                :value="field.text"
                :hint="field.customField.description"
                hide-bottom-space
                outlined
                :readonly="readonly"
                :class="{'highlighted-border': fieldHighlighted == `field-${field.customField.label}` && commentMode}"
                :bg-color="(isTextInCustomFields(field))?'diffbackground':null"
                :rules="(field.customField.required)? [val => !!val || 'Field is required']: []"
                lazy-rules="ondemand"
                >
                    <template v-slot:control>
                        <div class="full-width">
                            <div v-if="!field.text || !field.text.fileId">
                                <q-file
                                v-model="fileInputs[`${idx}-${idx2}`]"
                                :label="$t('selectFile')"
                                outlined
                                dense
                                :accept="acceptedFileTypes"
                                :max-file-size="26214400"
                                :disable="readonly"
                                @input="handleFileUpload(field, `${idx}-${idx2}`)"
                                @rejected="onFileRejected"
                                >
                                    <template v-slot:prepend>
                                        <q-icon name="attach_file" />
                                    </template>
                                </q-file>
                            </div>
                            <div v-else class="row items-center q-gutter-sm">
                                <q-chip
                                color="primary"
                                text-color="white"
                                icon="description"
                                >
                                    {{ field.text.fileName }}
                                    <q-tooltip>{{ formatFileSize(field.text.fileSize) }}</q-tooltip>
                                </q-chip>
                                <q-btn
                                flat
                                round
                                dense
                                color="primary"
                                icon="download"
                                @click="downloadFile(field.text.fileId, field.text.fileName)"
                                :disable="readonly"
                                >
                                    <q-tooltip>{{ $t('downloadFile') }}</q-tooltip>
                                </q-btn>
                                <q-btn
                                flat
                                round
                                dense
                                color="negative"
                                icon="delete"
                                @click="removeFile(field)"
                                :disable="readonly"
                                >
                                    <q-tooltip>{{ $t('removeFile') }}</q-tooltip>
                                </q-btn>
                            </div>
                        </div>
                    </template>
                    <template v-slot:label>
                        {{field.customField.label}} <span v-if="field.customField.required" class="text-red">*</span>
                    </template>
                    <q-badge v-if="commentMode && canCreateComment" color="deep-purple" floating class="cursor-pointer" @click="createComment(`field-${field.customField.label}`)">
                        <q-icon name="add_comment" size="xs" />
                    </q-badge>
                </q-field>
            </div>
        </div>
    </component>
</div>
</template>

<script>
import BasicEditor from 'components/editor/Editor.vue';
import FileService from '@/services/file';
import { Notify } from 'quasar';

export default {
    name: 'custom-fields',
    props: {
        value: Array,
        customElement: {
            type: String,
            default: 'div'
        },
        noSyncEditor: {
            type: Boolean,
            default: false
        },
        diff: {
            type: Array,
            default: null
        },
        readonly: {
            type: Boolean,
            default: false
        },
        locale: {
            type: String,
            default: ''
        },
        commentMode: {
            type: Boolean,
            default: false
        },
        focusedComment: {
            type: String,
            default: ""
        },
        commentIdList: {
            type: Array,
            default: () => []
        },
        fieldHighlighted: {
            type: String,
            default: ""
        },
        createComment: {
            type: Function,
            default: () => {}
        },
        canCreateComment: {
            type: Boolean,
            default: false
        }
    },

    data: function() {
        return {
            fileInputs: {},
            acceptedFileTypes: '.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.zip'
        }
    },

    components: {
        BasicEditor
    },

    computed: {
         computedFields: function() {
            var result = []
            var tmpArray = []
            this.value.forEach(e => {
                if (e.customField.fieldType === 'space' && e.customField.size === 12) { // full size space creates an empty component as separator
                    result.push(tmpArray)
                    result.push([])
                    tmpArray = []
                }
                else {
                    tmpArray.push(e)
                }
            })
            if (tmpArray.length > 0)
                result.push(tmpArray)
            return result
        }
    },

    methods: {
        isTextInCustomFields: function(field) {
            if (this.diff) {
                return typeof this.diff.find(f => {
                    return f.customField._id === field.customField._id && this.$_.isEqual(f.text, field.text)
                }) === 'undefined'
            }
            return false
        },

        getTextDiffInCustomFields: function(field) {
            var result = ''
            if (this.diff) {
                this.diff.find(f => {
                    if (f.customField._id === field.customField._id)
                        result = f.text
                })
            }
            return result
        },

        validate: function() {
            Object.keys(this.$refs).forEach(key => key.startsWith('field') && this.$refs[key][0].validate())
        },

        requiredFieldsEmpty: function() {
            this.validate()
            return this.value.some(e => e.customField.fieldType !== 'space' && e.customField.required && (!e.text || e.text.length === 0))
        },

        getOptionsGroup: function(options) {
            return options
            .filter(e => e.locale === this.locale)
            .map(e => {return {label: e.value, value: e.value}})
        },

        handleFileUpload: async function(field, inputKey) {
            const file = this.fileInputs[inputKey]
            if (!file) return

            try {
                const reader = new FileReader()
                reader.onload = async (e) => {
                    const base64 = e.target.result
                    const fileData = {
                        value: base64,
                        name: file.name,
                        mimeType: file.type || 'application/octet-stream'
                    }

                    try {
                        const response = await FileService.createFile(fileData)
                        field.text = {
                            fileId: response.data.datas._id,
                            fileName: response.data.datas.name,
                            fileSize: response.data.datas.size
                        }
                        this.fileInputs[inputKey] = null
                        Notify.create({
                            message: this.$t('fileUploadedOk'),
                            color: 'positive',
                            textColor: 'white',
                            position: 'top-right'
                        })
                    } catch (err) {
                        Notify.create({
                            message: err.response?.data?.datas || this.$t('fileUploadError'),
                            color: 'negative',
                            textColor: 'white',
                            position: 'top-right'
                        })
                    }
                }
                reader.readAsDataURL(file)
            } catch (err) {
                console.error('File upload error:', err)
            }
        },

        downloadFile: async function(fileId, fileName) {
            try {
                const response = await FileService.downloadFile(fileId)
                const url = window.URL.createObjectURL(new Blob([response.data]))
                const link = document.createElement('a')
                link.href = url
                link.setAttribute('download', fileName)
                document.body.appendChild(link)
                link.click()
                link.remove()
                window.URL.revokeObjectURL(url)
            } catch (err) {
                Notify.create({
                    message: err.response?.data?.datas || this.$t('fileDownloadError'),
                    color: 'negative',
                    textColor: 'white',
                    position: 'top-right'
                })
            }
        },

        removeFile: async function(field) {
            if (field.text && field.text.fileId) {
                try {
                    await FileService.deleteFile(field.text.fileId)
                    field.text = ''
                    Notify.create({
                        message: this.$t('fileRemovedOk'),
                        color: 'positive',
                        textColor: 'white',
                        position: 'top-right'
                    })
                } catch (err) {
                    Notify.create({
                        message: err.response?.data?.datas || this.$t('fileRemoveError'),
                        color: 'negative',
                        textColor: 'white',
                        position: 'top-right'
                    })
                }
            }
        },

        onFileRejected: function(rejectedEntries) {
            const reason = rejectedEntries[0]?.failedPropValidation
            let message = this.$t('fileRejected')
            if (reason === 'max-file-size') {
                message = this.$t('fileTooLarge')
            } else if (reason === 'accept') {
                message = this.$t('fileTypeNotAllowed')
            }
            Notify.create({
                message: message,
                color: 'negative',
                textColor: 'white',
                position: 'top-right'
            })
        },

        formatFileSize: function(bytes) {
            if (bytes === 0) return '0 Bytes'
            const k = 1024
            const sizes = ['Bytes', 'KB', 'MB', 'GB']
            const i = Math.floor(Math.log(bytes) / Math.log(k))
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
        }
    }
}

</script>

<style>
</style>