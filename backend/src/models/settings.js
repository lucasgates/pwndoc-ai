var mongoose = require('mongoose');//.set('debug', true);
var Schema = mongoose.Schema;
var _ = require('lodash');
var Utils = require('../lib/utils.js');

// https://stackoverflow.com/questions/25822289/what-is-the-best-way-to-store-color-hex-values-in-mongodb-mongoose
const colorValidator = (v) => (/^#([0-9a-f]{3}){1,2}$/i).test(v);

const SettingSchema = new Schema({
    report: { 
        enabled: {type: Boolean, default: true},
        public: {
            cvssColors: {
                noneColor: { type: String, default: "#4a86e8", validate: [colorValidator, 'Invalid color'] },
                lowColor: { type: String, default: "#008000", validate: [colorValidator, 'Invalid color'] },
                mediumColor: { type: String, default: "#f9a009", validate: [colorValidator, 'Invalid color'] },
                highColor: { type: String, default: "#fe0000", validate: [colorValidator, 'Invalid color'] },
                criticalColor: { type: String, default: "#212121", validate: [colorValidator, 'Invalid color'] }
            },
            captions: {
                type: [{type: String, unique: true}],
                default: ['Figure']
            },
            highlightWarning: { type: Boolean, default: false},
            highlightWarningColor: { type: String, default: "#ffff25", validate: [colorValidator, 'Invalid color']},
            requiredFields: {
                company: {type: Boolean, default: false},
                client: {type: Boolean, default: false},
                dateStart: {type: Boolean, default: false},
                dateEnd: {type: Boolean, default: false},
                dateReport: {type: Boolean, default: false},
                scope: {type: Boolean, default: false},
                findingType: {type: Boolean, default: false},
                findingDescription: {type: Boolean, default: false},
                findingObservation: {type: Boolean, default: false},
                findingReferences: {type: Boolean, default: false},
                findingProofs: {type: Boolean, default: false},
                findingAffected: {type: Boolean, default: false},
                findingRemediationDifficulty: {type: Boolean, default: false},
                findingPriority: {type: Boolean, default: false},
                findingRemediation: {type: Boolean, default: false},
            },
            scoringMethods: {
                CVSS3: { type: Boolean, default: true },
                CVSS4: { type: Boolean, default: false }
            }
        },
        private: {
            imageBorder: { type: Boolean, default: false },
            imageBorderColor: { type: String, default: "#000000", validate: [colorValidator, 'Invalid color'] },
        }
     },
    reviews: {
        enabled: { type: Boolean, default: false },
        public: {
            mandatoryReview: { type: Boolean, default: false },
            minReviewers: { type: Number, default: 1, min: 1, max: 100, validate: [Number.isInteger, 'Invalid integer'] }
        },
        private: {
            removeApprovalsUponUpdate: { type: Boolean, default: false }
        }
    },
    ai: {
        enabled: { type: Boolean, default: false },
        public: {
            model: { type: String, default: 'gpt-3.5-turbo' }
        },
        private: {
            openaiApiKey: { type: String, default: '' }
        }
    }
}, {strict: true});

// Get all settings (excluding sensitive data like API keys)
SettingSchema.statics.getAll = () => {
    return new Promise((resolve, reject) => {
        const query = Settings.findOne({});
        query.select('-_id -__v');
        query.exec()
            .then(settings => {
                if (settings) {
                    // Remove sensitive data and add status indicators
                    const sanitizedSettings = settings.toObject();
                    if (sanitizedSettings.ai && sanitizedSettings.ai.private) {
                        // Replace API key with status indicator
                        const hasApiKey = !!(sanitizedSettings.ai.private.openaiApiKey && sanitizedSettings.ai.private.openaiApiKey.trim() !== '');
                        delete sanitizedSettings.ai.private.openaiApiKey;
                        sanitizedSettings.ai.private.apiKeyConfigured = hasApiKey;
                    }
                    resolve(sanitizedSettings);
                } else {
                    resolve(settings);
                }
            })
            .catch(err => reject(err));
    });
};

// Get public settings
SettingSchema.statics.getPublic = () => {
    return new Promise((resolve, reject) => {
        const query = Settings.findOne({});
        query.select('-_id report.enabled report.public reviews.enabled reviews.public ai.enabled ai.public');
        query.exec()
            .then(settings => resolve(settings))
            .catch(err => reject(err));
    });
};

// Update Settings
SettingSchema.statics.update = (settings) => {
    return new Promise(async (resolve, reject) => {
        try {
            // First, get the current settings to preserve sensitive data
            const currentSettings = await Settings.findOne({});
            
            // Preserve the existing API key if it exists and is not being updated
            if (currentSettings && 
                currentSettings.ai && 
                currentSettings.ai.private && 
                currentSettings.ai.private.openaiApiKey &&
                (!settings.ai || !settings.ai.private || !settings.ai.private.hasOwnProperty('openaiApiKey'))) {
                
                // Ensure the AI structure exists in the update
                if (!settings.ai) settings.ai = {};
                if (!settings.ai.private) settings.ai.private = {};
                
                // Preserve the existing API key
                settings.ai.private.openaiApiKey = currentSettings.ai.private.openaiApiKey;
            }
            
            const query = Settings.findOneAndUpdate({}, settings, { new: true, runValidators: true });
            const updatedSettings = await query.exec();
            resolve(updatedSettings);
        } catch (err) {
            reject(err);
        }
    });
};

// Update OpenAI API Key specifically (secure method)
SettingSchema.statics.updateOpenAIApiKey = (apiKey) => {
    return new Promise((resolve, reject) => {
        const query = Settings.findOneAndUpdate(
            {}, 
            { 'ai.private.openaiApiKey': apiKey }, 
            { new: true, runValidators: true, upsert: true }
        );
        query.exec()
            .then(settings => {
                // Return only success status, not the actual key
                const hasApiKey = !!(apiKey && apiKey.trim() !== '');
                resolve({ 
                    success: true, 
                    apiKeyConfigured: hasApiKey,
                    message: hasApiKey ? 'OpenAI API key updated successfully' : 'OpenAI API key removed successfully'
                });
            })
            .catch(err => reject(err));
    });
};

// Get OpenAI API key for internal use (not exposed to frontend)
SettingSchema.statics.getOpenAIApiKey = () => {
    return new Promise((resolve, reject) => {
        const query = Settings.findOne({});
        query.select('ai.enabled ai.public.model ai.private.openaiApiKey');
        query.exec()
            .then(settings => {
                if (settings && settings.ai) {
                    resolve({
                        enabled: settings.ai.enabled,
                        model: settings.ai.public ? settings.ai.public.model : 'gpt-3.5-turbo',
                        apiKey: settings.ai.private ? settings.ai.private.openaiApiKey : ''
                    });
                } else {
                    resolve({
                        enabled: false,
                        model: 'gpt-3.5-turbo',
                        apiKey: ''
                    });
                }
            })
            .catch(err => reject(err));
    });
};


// Restore settings to default
SettingSchema.statics.restoreDefaults = () => {
    return new Promise((resolve, reject) => {
        const query = Settings.deleteMany({});
        query.exec()
            .then(_ => {
                const query = new Settings({});
                query.save()
                    .then(_ => resolve("Restored default settings."))
                    .catch(err => reject(err));
            })
            .catch(err => reject(err));
    });
};

SettingSchema.statics.backup = (path) => {
    return new Promise(async (resolve, reject) => {
        const fs = require('fs')

        function exportSettingsPromise() {
            return new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(`${path}/settings.json`)
                writeStream.write('[')

                let settings = Settings.find().cursor()
                let isFirst = true

                settings.eachAsync(async (document) => {
                    if (!isFirst) {
                        writeStream.write(',')
                    } else {
                        isFirst = false
                    }
                    writeStream.write(JSON.stringify(document, null, 2))
                    return Promise.resolve()
                })
                .then(() => {
                    writeStream.write(']');
                    writeStream.end();
                })
                .catch((error) => {
                    reject(error);
                });

                writeStream.on('finish', () => {
                    resolve('ok');
                });
            
                writeStream.on('error', (error) => {
                    reject(error);
                });
            })
        }

        try {
            await exportSettingsPromise()
            resolve()
        }
        catch (error) {
            reject({error: error, model: 'Settings'})
        }
            
    })
}

SettingSchema.statics.restore = (path) => {
    return new Promise(async (resolve, reject) => {
        const fs = require('fs')

        function importSettingsPromise () {
            return new Promise((resolve, reject) => {
                const readStream = fs.createReadStream(`${path}/settings.json`)
                const JSONStream = require('JSONStream')

                let jsonStream = JSONStream.parse('*')
                readStream.pipe(jsonStream)

                readStream.on('error', (error) => {
                    reject(error)
                })

                jsonStream.on('data', async (document) => {
                    Settings.findOneAndReplace({_id: document._id}, document, { upsert: true })
                    .catch(err => {
                        console.log(err)
                        reject(err)
                    })
                })
                jsonStream.on('end', () => {
                    resolve()
                })
                jsonStream.on('error', (error) => {
                    reject(error)
                })
            })
        }

        try {
            await Settings.deleteMany()
            await importSettingsPromise()
            resolve()
        }
        catch (error) {
            reject({error: error, model: 'Settings'})
        }
    })
}

const Settings = mongoose.model('Settings', SettingSchema);

// Populate/update settings when server starts
Settings.findOne()
.then((liveSettings) => {
  if (!liveSettings) {
    console.log("Initializing Settings");
    Settings.create({}).catch((err) => {
      throw "Error creating the settings in the database : " + err;
    });
  } 
  else {
    var needUpdate = false
    var liveSettingsPaths = Utils.getObjectPaths(liveSettings.toObject())

    liveSettingsPaths.forEach(path => {
        if (!SettingSchema.path(path) && !path.startsWith('_')) {
            needUpdate = true
            _.set(liveSettings, path, undefined)
        }
    })

    if (needUpdate) {
        console.log("Removing unused fields from Settings")
        liveSettings.save()
    }
  }
})
.catch((err) => {
  throw "Error checking for initial settings in the database : " + err;
});

module.exports = Settings;
