module.exports = function(app) {

    var Response = require('../lib/httpResponse.js')
    var File = require('mongoose').model('File')
    var acl = require('../lib/auth').acl

    // Allowed MIME types
    const ALLOWED_MIME_TYPES = [
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        // Spreadsheets
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        // Images
        'image/png',
        'image/jpeg',
        // Archives
        'application/zip'
    ]

    // Max file size: 25MB
    const MAX_FILE_SIZE = 25 * 1024 * 1024

    // Get file metadata
    app.get("/api/files/:fileId", acl.hasPermission('files:read'), function(req, res) {
        File.getMetadata(req.params.fileId)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    })

    // Create file
    app.post("/api/files/", acl.hasPermission('files:create'), function(req, res) {
        if (!req.body.value) {
            Response.BadParameters(res, 'Missing required parameters: value')
            return
        }
        if (!req.body.name) {
            Response.BadParameters(res, 'Missing required parameters: name')
            return
        }
        if (!req.body.mimeType) {
            Response.BadParameters(res, 'Missing required parameters: mimeType')
            return
        }

        // Type validation
        if (typeof req.body.value !== "string") {
            Response.BadParameters(res, 'value parameter must be a String')
            return
        }

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(req.body.mimeType)) {
            Response.BadParameters(res, `File type not allowed. Allowed types: PDF, DOC, DOCX, TXT, XLS, XLSX, CSV, PNG, JPG, ZIP`)
            return
        }

        // Validate base64 format
        var base64Data = req.body.value
        if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1]
        }

        // Calculate actual file size from base64
        var padding = 0
        if (base64Data.endsWith('==')) padding = 2
        else if (base64Data.endsWith('=')) padding = 1
        var fileSize = Math.floor((base64Data.length * 3) / 4) - padding

        // Validate file size
        if (fileSize > MAX_FILE_SIZE) {
            Response.BadParameters(res, `File too large. Maximum size is 25MB`)
            return
        }

        var file = {}
        // Required parameters
        file.value = req.body.value
        file.name = req.body.name
        file.mimeType = req.body.mimeType
        file.size = fileSize

        // Optional parameters
        if (req.body.auditId) file.auditId = req.body.auditId

        File.create(file)
        .then(data => Response.Created(res, data))
        .catch(err => Response.Internal(res, err))
    })

    // Delete file
    app.delete("/api/files/:fileId", acl.hasPermission('files:delete'), function(req, res) {
        File.delete(req.params.fileId)
        .then(data => {
            Response.Ok(res, 'File deleted successfully')
        })
        .catch(err => {
            Response.Internal(res, err)
        })
    })

    // Download file
    app.get("/api/files/download/:fileId", acl.hasPermission('files:read'), function(req, res) {
        File.getOne(req.params.fileId)
        .then(data => {
            var fileBase64 = data.value
            if (fileBase64.includes(',')) {
                fileBase64 = fileBase64.split(',')[1]
            }
            var fileBuffer = Buffer.from(fileBase64, 'base64')

            res.set({
                'Content-Type': data.mimeType,
                'Content-Length': fileBuffer.length,
                'Content-Disposition': `attachment; filename="${encodeURIComponent(data.name)}"`
            })
            res.status(200).send(fileBuffer)
        })
        .catch(err => {
            Response.Internal(res, err)
        })
    })
}
