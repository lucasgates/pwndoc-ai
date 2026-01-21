var mongoose = require('mongoose')
var Schema = mongoose.Schema
var fs = require('fs')

var FileSchema = new Schema({
    auditId:    {type: Schema.Types.ObjectId, ref: 'Audit'},
    value:      {type: String, required: true},
    name:       {type: String, required: true},
    mimeType:   {type: String, required: true},
    size:       {type: Number, required: true}
}, {timestamps: true})

/*
*** Statics ***
*/

// Get one file
FileSchema.statics.getOne = (fileId) => {
    return new Promise((resolve, reject) => {
        var query = File.findById(fileId)

        query.select('auditId value name mimeType size')
        query.exec()
        .then((row) => {
            if (row)
                resolve(row)
            else
                throw({fn: 'NotFound', message: 'File not found'});
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Get file metadata only (without the base64 value)
FileSchema.statics.getMetadata = (fileId) => {
    return new Promise((resolve, reject) => {
        var query = File.findById(fileId)

        query.select('auditId name mimeType size')
        query.exec()
        .then((row) => {
            if (row)
                resolve(row)
            else
                throw({fn: 'NotFound', message: 'File not found'});
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Create file
FileSchema.statics.create = (file) => {
    return new Promise((resolve, reject) => {
        var query = new File(file)
        query.save()
        .then((row) => {
            resolve({_id: row._id, name: row.name, mimeType: row.mimeType, size: row.size})
        })
        .catch((err) => {
            console.log(err)
            reject(err)
        })
    })
}

// Delete file
FileSchema.statics.delete = (fileId) => {
    return new Promise((resolve, reject) => {
        var query = File.findByIdAndDelete(fileId)
        query.exec()
        .then((rows) => {
            if (rows)
                resolve(rows)
            else
                reject({fn: 'NotFound', message: 'File not found'})
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Get all files (for backup)
FileSchema.statics.getAll = () => {
    return new Promise((resolve, reject) => {
        var query = File.find()
        query.select('auditId value name mimeType size')
        query.exec()
        .then((rows) => {
            resolve(rows)
        })
        .catch((err) => {
            reject(err)
        })
    })
}

// Backup files
FileSchema.statics.backup = (path) => {
    return new Promise(async (resolve, reject) => {
        try {
            const files = await File.getAll()
            fs.writeFileSync(`${path}/files.json`, JSON.stringify(files))
            resolve({ok: true})
        }
        catch (error) {
            reject({error: error, model: 'File'})
        }
    })
}

// Restore files
FileSchema.statics.restore = (path, mode = 'upsert') => {
    return new Promise(async (resolve, reject) => {
        try {
            const files = JSON.parse(fs.readFileSync(`${path}/files.json`))

            if (mode === 'revert') {
                await File.deleteMany({})
            }

            for (const file of files) {
                if (mode === 'upsert') {
                    await File.findByIdAndUpdate(file._id, file, {upsert: true, new: true})
                } else {
                    await new File(file).save()
                }
            }
            resolve({ok: true})
        }
        catch (error) {
            reject({error: error, model: 'File'})
        }
    })
}

/*
*** Methods ***
*/

var File = mongoose.model('File', FileSchema)
File.syncIndexes()
module.exports = File
