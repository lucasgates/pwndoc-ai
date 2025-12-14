module.exports = function(app, io) {

    var Response = require('../lib/httpResponse');
    var Audit = require('mongoose').model('Audit');
    var acl = require('../lib/auth').acl;
    var reportGenerator = require('../lib/report-generator');
    var _ = require('lodash');
    var utils = require('../lib/utils');
    var Settings = require('mongoose').model('Settings');
    var OpenAI = require('openai');

    /* ### AUDITS LIST ### */

    // Get audits list of user (all for admin) with regex filter on findings
    app.get("/api/audits", acl.hasPermission('audits:read'), function(req, res) {
        var getUsersRoom = function(room) {
            return utils.getSockets(io, room).map(s => s.username)
        }
        var filters = {};
        if (req.query.findingTitle) 
            filters['findings.title'] = new RegExp(utils.escapeRegex(req.query.findingTitle), 'i')
        if (req.query.type && req.query.type === 'default')
            filters.$or = [{type: 'default'}, {type: {$exists:false}}]
        if (req.query.type && ['multi', 'retest'].includes(req.query.type))
            filters.type = req.query.type
            
        Audit.getAudits(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.decodedToken.id, filters)
        .then(msg => {
                var result = []
                msg.forEach(audit => {
                    var a = {}
                    a._id = audit._id
                    a.name = audit.name
                    a.language = audit.language
                    a.auditType = audit.auditType
                    a.creator = audit.creator
                    a.collaborators = audit.collaborators
                    a.company = audit.company
                    a.createdAt = audit.createdAt
                    a.reviewers = audit.reviewers
                    a.approvals = audit.approvals
                    a.state = audit.state
                    a.type = audit.type
                    a.parentId = audit.parentId
                    if (acl.isAllowed(req.decodedToken.role, 'audits:users-connected')){
                        a.connected = getUsersRoom(audit._id.toString())
                    }
                    result.push(a)
                })
            Response.Ok(res, result)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Create audit (default or multi) with name, auditType, language provided
    // parentId can be set only if type is default
    app.post("/api/audits", acl.hasPermission('audits:create'), function(req, res) {
        if (!req.body.name || !req.body.language || !req.body.auditType) {
            Response.BadParameters(res, 'Missing some required parameters: name, language, auditType');
            return;
        }

        if (!utils.validFilename(req.body.language)) {
            Response.BadParameters(res, 'Invalid characters for language');
            return;
        }

        var audit = {};
        // Required params
        audit.name = req.body.name;
        audit.language = req.body.language;
        audit.auditType = req.body.auditType;
        audit.type = 'default';

        // Optional params
        if (req.body.type && req.body.type === 'multi') audit.type = req.body.type;
        if (audit.type === 'default' && req.body.parentId) audit.parentId = req.body.parentId; 

        Audit.create(audit, req.decodedToken.id)
        .then(inserted => Response.Created(res, {message: 'Audit created successfully', audit: inserted}))
        .catch(err => Response.Internal(res, err))
    });

    // Get audits children
    app.get("/api/audits/:auditId/children", acl.hasPermission('audits:read'), function(req, res) {
        var getUsersRoom = function(room) {
            return utils.getSockets(io, room).map(s => s.username)
        }
        Audit.getAuditChildren(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id)
        .then(msg => {
                var result = []
                msg.forEach(audit => {
                    var a = {}
                    a._id = audit._id
                    a.name = audit.name
                    a.auditType = audit.auditType
                    a.approvals = audit.approvals
                    a.state = audit.state
                    if (acl.isAllowed(req.decodedToken.role, 'audits:users-connected')){
                        a.connected = getUsersRoom(audit._id.toString())
                    }
                    result.push(a)
                })
            Response.Ok(res, result)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Get audit retest with auditId
    app.get("/api/audits/:auditId/retest", acl.hasPermission('audits:read'), function(req, res) {
        Audit.getRetest(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Create audit retest with auditId
    app.post("/api/audits/:auditId/retest", acl.hasPermission('audits:create'), function(req, res) {
        if (!req.body.auditType) {
            Response.BadParameters(res, 'Missing some required parameters: auditType');
            return;
        }
        Audit.createRetest(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id, req.body.auditType)
        .then(inserted => Response.Created(res, {message: 'Audit Retest created successfully', audit: inserted}))
        .catch(err => Response.Internal(res, err))
    });

    // Delete audit if creator or admin
    app.delete("/api/audits/:auditId", acl.hasPermission('audits:delete'), function(req, res) {
        Audit.delete(acl.isAllowed(req.decodedToken.role, 'audits:delete-all'), req.params.auditId, req.decodedToken.id)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    /* ### AUDITS EDIT ### */

    // Get Audit with ID
    app.get("/api/audits/:auditId", acl.hasPermission('audits:read'), function(req, res) {
        Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Get audit general information
    app.get("/api/audits/:auditId/general", acl.hasPermission('audits:read'), function(req, res) {
        Audit.getGeneral(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Update audit general information
    app.put("/api/audits/:auditId/general", acl.hasPermission('audits:update'), async function(req, res) {
        var update = {};
        
        var settings = await Settings.getAll();
        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id);
        if (settings.reviews.enabled && audit.state !== "EDIT") {
            Response.Forbidden(res, "The audit is not in the EDIT state and therefore cannot be edited.");
            return;
        }

        if (req.body.reviewers) {
            if (req.body.reviewers.some(element => !element._id)) {
                Response.BadParameters(res, "One or more reviewer is missing an _id");
                return;
            }

            // Is the new reviewer the creator of the audit? 
            if (req.body.reviewers.some(element => element._id === audit.creator._id)) {
                Response.BadParameters(res, "A user cannot simultaneously be a reviewer and a collaborator/creator");
                return;
            }

            // Is the new reviewer one of the new collaborators that will override current collaborators? 
            if (req.body.collaborators) {
                req.body.reviewers.forEach((reviewer) => {
                    if (req.body.collaborators.some(element => !element._id || element._id === reviewer._id)) {
                        Response.BadParameters(res, "A user cannot simultaneously be a reviewer and a collaborator/creator");
                        return;
                    }
                });
            }

            // If no new collaborators are being set, is the new reviewer one of the current collaborators? 
            else if (audit.collaborators) {
                req.body.reviewers.forEach((reviewer) => {
                    if (audit.collaborators.some(element => element._id === reviewer._id)) {
                        Response.BadParameters(res, "A user cannot simultaneously be a reviewer and a collaborator/creator");
                        return;
                    }
                });
            }
        }

        if (req.body.collaborators) {
            if (req.body.collaborators.some(element => !element._id)) {
                Response.BadParameters(res, "One or more collaborator is missing an _id");
                return;
            }
            
            // Are the new collaborators part of the current reviewers?
            req.body.collaborators.forEach((collaborator) => {
                if (audit.reviewers.some(element => element._id === collaborator._id)) {
                    Response.BadParameters(res, "A user cannot simultaneously be a reviewer and a collaborator/creator");
                    return;
                }
            });

            // If the new collaborator already gave a review, remove said review, accept collaborator
            if (audit.approvals) {
                var newApprovals = audit.approvals.filter((approval) => !req.body.collaborators.some((collaborator) => approval.toString() === collaborator._id));
                update.approvals = newApprovals;
            }
        }

        // Optional parameters
        if (req.body.name) update.name = req.body.name;
        if (req.body.date) update.date = req.body.date;
        if (req.body.date_start) update.date_start = req.body.date_start;
        if (req.body.date_end) update.date_end = req.body.date_end;
        if (req.body.client !== undefined) update.client = req.body.client
        if (req.body.company !== undefined) {
            update.company = {};
            if (req.body.company && req.body.company._id)
                update.company._id = req.body.company._id;
            else if (req.body.company && req.body.company.name)
                update.company.name = req.body.company.name
            else
                update.company = null
        }
        if (req.body.collaborators) update.collaborators = req.body.collaborators;
        if (req.body.reviewers) update.reviewers = req.body.reviewers;
        if (req.body.language && utils.validFilename(req.body.language)) update.language = req.body.language;
        if (req.body.scope && typeof(req.body.scope === "array")) {
            update.scope = req.body.scope.map(item => {return {name: item}});
        }
        if (req.body.template) update.template = req.body.template;
        if (req.body.customFields) update.customFields = req.body.customFields;
        if (settings.reviews.enabled && settings.reviews.private.removeApprovalsUponUpdate) update.approvals = [];

        Audit.updateGeneral(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, update)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Get audit network information
    app.get("/api/audits/:auditId/network", acl.hasPermission('audits:read'), function(req, res) {
        Audit.getNetwork(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Update audit network information
    app.put("/api/audits/:auditId/network", acl.hasPermission('audits:update'), async function(req, res) {
        var settings = await Settings.getAll();

        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id);
        if (settings.reviews.enabled && audit.state !== "EDIT") {
            Response.Forbidden(res, "The audit is not in the EDIT state and therefore cannot be edited.");
            return;
        }

        var update = {};
        // Optional parameters
        if (req.body.scope) update.scope = req.body.scope;
        if (settings.reviews.enabled && settings.reviews.private.removeApprovalsUponUpdate) update.approvals = [];

        Audit.updateNetwork(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, update)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Add finding to audit
    app.post("/api/audits/:auditId/findings", acl.hasPermission('audits:update'), async function(req, res) {
        var settings = await Settings.getAll();
        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id);
        if (settings.reviews.enabled && audit.state !== "EDIT") {
            Response.Forbidden(res, "The audit is not in the EDIT state and therefore cannot be edited.");
            return;
        }
        if (!req.body.title) {
            Response.BadParameters(res, 'Missing some required parameters: title');
            return;
        }

        var finding = {};
        // Required parameters
        finding.title = req.body.title;
        
        // Optional parameters
        if (req.body.vulnType) finding.vulnType = req.body.vulnType;
        if (req.body.description) finding.description = req.body.description;
        if (req.body.observation) finding.observation = req.body.observation;
        if (req.body.remediation) finding.remediation = req.body.remediation;
        if (req.body.remediationComplexity) finding.remediationComplexity = req.body.remediationComplexity;
        if (req.body.priority) finding.priority = req.body.priority;
        if (req.body.references) finding.references = req.body.references;
        if (req.body.cvssv3) finding.cvssv3 = req.body.cvssv3;
        if (req.body.cvssv4) finding.cvssv4 = req.body.cvssv4;
        if (req.body.poc) finding.poc = req.body.poc;
        if (req.body.scope) finding.scope = req.body.scope;
        if (req.body.status !== undefined) finding.status = req.body.status;
        if (req.body.category) finding.category = req.body.category
        if (req.body.customFields) finding.customFields = req.body.customFields

        if (settings.reviews.enabled && settings.reviews.private.removeApprovalsUponUpdate) {
            Audit.updateGeneral(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, { approvals: [] });
        }

        Audit.createFinding(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, finding)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Get finding of audit
    app.get("/api/audits/:auditId/findings/:findingId", acl.hasPermission('audits:read'), function(req, res) {
        Audit.getFinding(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id, req.params.findingId)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Update finding of audit
    app.put("/api/audits/:auditId/findings/:findingId", acl.hasPermission('audits:update'), async function(req, res) {
        var settings = await Settings.getAll();
        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id);
        if (settings.reviews.enabled && audit.state !== "EDIT") {
            Response.Forbidden(res, "The audit is not in the EDIT state and therefore cannot be edited.");
            return;
        }
        
        var finding = {};
        // Optional parameters
        if (req.body.title) finding.title = req.body.title;
        if (req.body.vulnType) finding.vulnType = req.body.vulnType;
        if (!_.isNil(req.body.description)) finding.description = req.body.description;
        if (!_.isNil(req.body.observation)) finding.observation = req.body.observation;
        if (!_.isNil(req.body.remediation)) finding.remediation = req.body.remediation;
        if (req.body.remediationComplexity) finding.remediationComplexity = req.body.remediationComplexity;
        if (req.body.priority) finding.priority = req.body.priority;
        if (req.body.references) finding.references = req.body.references;
        if (req.body.cvssv3) finding.cvssv3 = req.body.cvssv3;
        if (req.body.cvssv4) finding.cvssv4 = req.body.cvssv4;
        if (!_.isNil(req.body.poc)) finding.poc = req.body.poc;
        if (!_.isNil(req.body.scope)) finding.scope = req.body.scope;
        if (req.body.status !== undefined) finding.status = req.body.status;
        if (req.body.category) finding.category = req.body.category
        if (req.body.customFields) finding.customFields = req.body.customFields
        if (req.body.retestDescription) finding.retestDescription = req.body.retestDescription
        if (req.body.retestStatus) finding.retestStatus = req.body.retestStatus

        if (settings.reviews.enabled && settings.reviews.private.removeApprovalsUponUpdate) {
            Audit.updateGeneral(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, { approvals: [] });
        }

        Audit.updateFinding(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, req.params.findingId, finding)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');            
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Delete finding of audit
    app.delete("/api/audits/:auditId/findings/:findingId", acl.hasPermission('audits:update'), async function(req, res) {
        var settings = await Settings.getAll();
        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id);
        if (settings.reviews.enabled && audit.state !== "EDIT") {
            Response.Forbidden(res, "The audit is not in the EDIT state and therefore cannot be edited.");
            return;
        }
        Audit.deleteFinding(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, req.params.findingId)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');            
            Response.Ok(res, msg);
        })
        .catch(err => Response.Internal(res, err))
    });

    // AI check finding content for spelling, grammar, and clarity
    app.post("/api/audits/:auditId/findings/:findingId/ai-check", acl.hasPermission('audits:read'), async function(req, res) {
        console.log('=== AI CHECK DEBUG START ===');
        console.log('AI Check request received for audit:', req.params.auditId, 'finding:', req.params.findingId);
        console.log('User token:', req.decodedToken.id, req.decodedToken.username);
        
        try {
            console.log('Step 1: Getting AI settings from database...');
            // Get AI settings from database (internal method with actual API key)
            const aiSettings = await Settings.getOpenAIApiKey();
            console.log('AI Settings retrieved:', {
                enabled: aiSettings.enabled,
                model: aiSettings.model,
                hasApiKey: !!(aiSettings.apiKey && aiSettings.apiKey.trim() !== ''),
                apiKeyLength: aiSettings.apiKey ? aiSettings.apiKey.length : 0
            });
            
            // Check if AI is enabled
            if (!aiSettings.enabled) {
                console.log('ERROR: AI features are not enabled');
                Response.BadParameters(res, 'AI features are not enabled');
                return;
            }

            // Check if OpenAI API key is configured
            if (!aiSettings.apiKey || aiSettings.apiKey.trim() === '') {
                console.log('ERROR: OpenAI API key is not configured');
                Response.BadParameters(res, 'OpenAI API key is not configured');
                return;
            }

            console.log('Step 2: Getting finding data...');
            // Get the finding data
            const finding = await Audit.getFinding(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id, req.params.findingId);
            console.log('Finding retrieved:', {
                found: !!finding,
                title: finding ? finding.title : 'N/A',
                hasDescription: !!(finding && finding.description),
                hasObservation: !!(finding && finding.observation),
                hasPoc: !!(finding && finding.poc)
            });
            
            if (!finding) {
                console.log('ERROR: Finding not found');
                Response.BadParameters(res, 'Finding not found');
                return;
            }

            // Get the model to use
            const model = aiSettings.model;
            console.log('Using AI model:', model);

            console.log('Step 3: Initializing OpenAI client...');
            // Initialize OpenAI client
            const openai = new OpenAI({
                apiKey: aiSettings.apiKey,
            });
            console.log('OpenAI client initialized successfully');

            // Helper function to strip HTML tags for analysis
            const stripHtml = (html) => {
                if (!html) return '';
                return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            };

            console.log('Step 4: Preparing content for analysis...');
            // Prepare content for analysis
            const title = finding.title || '';
            const description = stripHtml(finding.description) || '';
            const observation = stripHtml(finding.observation) || '';
            const proof = stripHtml(finding.poc) || '';

            console.log('Content prepared:', {
                titleLength: title.length,
                descriptionLength: description.length,
                observationLength: observation.length,
                proofLength: proof.length
            });

            // Construct the prompt
            const prompt = `You are a professional editor specializing in cybersecurity and penetration testing reports. Please review the following vulnerability finding content for spelling, grammar, and clarity issues. Provide specific, actionable suggestions for improvement while maintaining the technical accuracy and professional tone appropriate for penetration testing reports.

**TITLE:** ${title}

**DESCRIPTION:** ${description}

**OBSERVATION:** ${observation}

**PROOF OF CONCEPT:** ${proof}

Please analyze each section and provide feedback in the following JSON format:
{
  "title": {
    "issues": ["list of specific issues found"],
    "suggestions": ["list of specific improvement suggestions"],
    "corrected": "corrected version if needed, or null if no corrections needed"
  },
  "description": {
    "issues": ["list of specific issues found"],
    "suggestions": ["list of specific improvement suggestions"],
    "corrected": "corrected version if needed, or null if no corrections needed"
  },
  "observation": {
    "issues": ["list of specific issues found"],
    "suggestions": ["list of specific improvement suggestions"],
    "corrected": "corrected version if needed, or null if no corrections needed"
  },
  "proof": {
    "issues": ["list of specific issues found"],
    "suggestions": ["list of specific improvement suggestions"],
    "corrected": "corrected version if needed, or null if no corrections needed"
  },
  "overall": {
    "summary": "brief overall assessment",
    "recommendations": ["general recommendations for improvement"]
  }
}

Focus on:
- Spelling errors
- Grammar mistakes
- Sentence structure and clarity
- Professional tone consistency
- Technical accuracy in language
- Readability improvements

If a section has no content or no issues, set "issues" and "suggestions" to empty arrays and "corrected" to null.
Return only the JSON object, no additional text.`;

            console.log('Step 5: Calling OpenAI API...');
            console.log('Prompt length:', prompt.length);
            
            // Call OpenAI API
            const completion = await openai.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: "system",
                        content: "You are a professional editor specializing in cybersecurity and penetration testing reports. You provide detailed feedback on spelling, grammar, and clarity while maintaining technical accuracy."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 3000,
                temperature: 0.3,
            });

            console.log('OpenAI API call successful');
            console.log('Response received:', {
                choices: completion.choices.length,
                finishReason: completion.choices[0].finish_reason,
                usage: completion.usage
            });

            // Parse the response
            const aiResponse = completion.choices[0].message.content.trim();
            console.log('Step 6: Processing AI response...');
            console.log('Raw AI response length:', aiResponse.length);
            console.log('Raw AI response (first 500 chars):', aiResponse.substring(0, 500));
            
            // Try to parse JSON response
            let analysisResult;
            try {
                console.log('Attempting to parse JSON...');
                analysisResult = JSON.parse(aiResponse);
                console.log('JSON parsing successful');
            } catch (parseError) {
                console.log('JSON parsing failed, trying to extract JSON from response...');
                console.log('Parse error:', parseError.message);
                // If JSON parsing fails, try to extract JSON from the response
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    console.log('Found JSON match, attempting to parse...');
                    analysisResult = JSON.parse(jsonMatch[0]);
                    console.log('JSON extraction and parsing successful');
                } else {
                    console.log('No JSON found in response');
                    throw new Error('Invalid JSON response from AI');
                }
            }

            console.log('Step 7: Validating response structure...');
            console.log('Analysis result keys:', Object.keys(analysisResult));
            
            // Validate the response structure
            if (!analysisResult.title || !analysisResult.description || 
                !analysisResult.observation || !analysisResult.proof || !analysisResult.overall) {
                console.log('ERROR: AI response missing required fields');
                console.log('Missing fields check:', {
                    hasTitle: !!analysisResult.title,
                    hasDescription: !!analysisResult.description,
                    hasObservation: !!analysisResult.observation,
                    hasProof: !!analysisResult.proof,
                    hasOverall: !!analysisResult.overall
                });
                throw new Error('AI response missing required fields');
            }

            console.log('Step 8: Sending successful response...');
            // Return the analysis result
            Response.Ok(res, {
                findingId: req.params.findingId,
                analysis: analysisResult,
                timestamp: new Date().toISOString()
            });
            
            console.log('=== AI CHECK DEBUG SUCCESS ===');

        } catch (error) {
            console.log('=== AI CHECK DEBUG ERROR ===');
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                type: error.type,
                stack: error.stack
            });
            
            // Handle specific error types
            if (error.code === 'insufficient_quota') {
                console.log('Error type: Insufficient quota');
                Response.BadParameters(res, 'OpenAI API quota exceeded. Please try again later.');
            } else if (error.code === 'rate_limit_exceeded') {
                console.log('Error type: Rate limit exceeded');
                Response.BadParameters(res, 'OpenAI API rate limit exceeded. Please try again later.');
            } else if (error.message && error.message.includes('API key')) {
                console.log('Error type: API key issue');
                Response.BadParameters(res, 'Invalid OpenAI API key configuration.');
            } else if (error.message && error.message.includes('JSON')) {
                console.log('Error type: JSON parsing issue');
                Response.BadParameters(res, 'Failed to parse AI response. Please try again.');
            } else {
                console.log('Error type: General/Unknown');
                Response.BadParameters(res, 'OpenAI API is currently unavailable. Please try again later.');
            }
            console.log('=== AI CHECK DEBUG END ===');
        }
    });

    // AI format raw proof data into structured HTML
    app.post("/api/audits/:auditId/findings/:findingId/ai-format-proof", acl.hasPermission('audits:update'), async function(req, res) {
        try {
            // Validate request parameters
            if (!req.body.rawProof || req.body.rawProof.trim() === '') {
                Response.BadParameters(res, 'Required parameter: rawProof');
                return;
            }

            const locale = req.body.locale || 'en';
            if (!['en', 'pt-BR'].includes(locale)) {
                Response.BadParameters(res, 'Invalid locale. Supported: en, pt-BR');
                return;
            }

            // Get AI settings from database
            const aiSettings = await Settings.getOpenAIApiKey();

            // Check if AI is enabled
            if (!aiSettings.enabled) {
                Response.BadParameters(res, 'AI features are not enabled');
                return;
            }

            // Check if OpenAI API key is configured
            if (!aiSettings.apiKey || aiSettings.apiKey.trim() === '') {
                Response.BadParameters(res, 'OpenAI API key is not configured');
                return;
            }

            // Get the finding data for context
            const finding = await Audit.getFinding(
                acl.isAllowed(req.decodedToken.role, 'audits:read-all'),
                req.params.auditId,
                req.decodedToken.id,
                req.params.findingId
            );

            if (!finding) {
                Response.BadParameters(res, 'Finding not found');
                return;
            }

            // Initialize OpenAI client
            const openai = new OpenAI({
                apiKey: aiSettings.apiKey,
            });

            // Build language instruction
            let languageInstruction = '';
            if (locale === 'pt-BR') {
                languageInstruction = 'Write all explanatory text, headers, and descriptions in Brazilian Portuguese. Keep technical terms, code, HTTP headers, and payloads in their original form.';
            } else {
                languageInstruction = 'Write all explanatory text, headers, and descriptions in US English.';
            }

            // Build the prompt
            const prompt = `Format the following raw proof-of-concept data for a vulnerability finding in a penetration testing report.

Vulnerability Context:
- Title: ${finding.title || 'Untitled Finding'}
- Type: ${finding.vulnType || 'Not specified'}

Raw Proof Data:
${req.body.rawProof}

Language: ${languageInstruction}

Requirements:
1. Use <pre><code class="language-http"> tags for HTTP requests/responses
2. Use <pre><code class="language-plaintext"> for generic code/output, DNS interactions, or other technical output
3. Use <p> tags for explanatory text
4. Create clear numbered reproduction steps using <ol><li> tags
5. Highlight important elements using <strong> tags
6. Organize content with clear section headers using <h3> tags
7. Structure the output to include:
   - Brief description of what the proof demonstrates
   - Numbered reproduction steps
   - HTTP requests/responses in code blocks (preserve original formatting)
   - Any relevant output (DNS interactions, error messages, responses, etc.)
   - Explanation of the impact demonstrated

Return ONLY the formatted HTML content. Do not include markdown formatting, code fences, or any text outside the HTML.`;

            // Call OpenAI API
            const completion = await openai.chat.completions.create({
                model: aiSettings.model,
                messages: [
                    {
                        role: "system",
                        content: "You are a cybersecurity professional formatting proof-of-concept data for penetration testing reports. Output only valid HTML suitable for a rich text editor. Do not wrap output in markdown code blocks."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 3000,
                temperature: 0.3,
            });

            let formattedProof = completion.choices[0].message.content.trim();

            // Clean up any markdown code fences if present
            formattedProof = formattedProof
                .replace(/^```html\n?/i, '')
                .replace(/^```\n?/i, '')
                .replace(/\n?```$/i, '')
                .trim();

            Response.Ok(res, { formattedProof: formattedProof });

        } catch (error) {
            console.error('AI Format Proof Error:', error);

            // Handle specific error types
            if (error.code === 'insufficient_quota') {
                Response.BadParameters(res, 'OpenAI API quota exceeded. Please try again later.');
            } else if (error.code === 'rate_limit_exceeded') {
                Response.BadParameters(res, 'OpenAI API rate limit exceeded. Please try again later.');
            } else if (error.message && error.message.includes('API key')) {
                Response.BadParameters(res, 'Invalid OpenAI API key configuration.');
            } else {
                Response.BadParameters(res, 'Failed to format proof with AI. Please try again.');
            }
        }
    });

    // Get section of audit
    app.get("/api/audits/:auditId/sections/:sectionId", acl.hasPermission('audits:read'), function(req, res) {
        Audit.getSection(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id, req.params.sectionId)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Update section of audit
    app.put("/api/audits/:auditId/sections/:sectionId", acl.hasPermission('audits:update'), async function(req, res) {
        var settings = await Settings.getAll();
        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id);
        if (settings.reviews.enabled && audit.state !== "EDIT") {
            Response.Forbidden(res, "The audit is not in the EDIT state and therefore cannot be edited.");
            return;
        }
        if (typeof req.body.customFields === 'undefined') {
            Response.BadParameters(res, 'Missing some required parameters: customFields');
            return;
        }
        var section = {};
        // Mandatory parameters
        section.customFields = req.body.customFields;

        // For retrocompatibility with old section.text usage
        if (req.body.text) section.text = req.body.text; 

        if (settings.reviews.enabled && settings.reviews.private.removeApprovalsUponUpdate) {
            Audit.updateGeneral(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, { approvals: [] });
        }

        Audit.updateSection(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, req.params.sectionId, section)
        .then(msg => {
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err));
    });

    // Generate Report for specific audit
    app.get("/api/audits/:auditId/generate", acl.hasPermission('audits:read'), function(req, res){
        Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id)
        .then(async audit => {
            var settings = await Settings.getAll();

            if (settings.reviews.enabled && settings.reviews.public.mandatoryReview && audit.state !== 'APPROVED') {
                Response.Forbidden(res, "Audit was not approved therefore cannot be exported.");
                return;
            }

            if (!audit.template)
                throw ({fn: 'BadParameters', message: 'Template not defined'})

            var reportDoc = await reportGenerator.generateDoc(audit);
            Response.SendFile(res, `${audit.name.replace(/[\\\/:*?"<>|]/g, "")}.${audit.template.ext || 'docx'}`, reportDoc);
        })
        .catch(err => {
            if (err.code === "ENOENT")
                Response.BadParameters(res, 'Template File not found')
            else
                Response.Internal(res, err)
        });
    });

    // Update sort options of an audit
    app.put("/api/audits/:auditId/sortfindings", acl.hasPermission('audits:update'), async function(req, res) {
        var settings = await Settings.getAll();
        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id);
        if (settings.reviews.enabled && audit.state !== "EDIT") {
            Response.Forbidden(res, "The audit is not in the EDIT state and therefore cannot be edited.");
            return;
        }
        var update = {};
        // Optional parameters
        if (req.body.sortFindings) update.sortFindings = req.body.sortFindings;
        if (settings.reviews.enabled && settings.reviews.private.removeApprovalsUponUpdate) update.approvals = [];
        
        Audit.updateSortFindings(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, update)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Update finding position (oldIndex -> newIndex)
    app.put("/api/audits/:auditId/movefinding", acl.hasPermission('audits:update'), async function(req, res) {
        var settings = await Settings.getAll();
        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id);
        if (settings.reviews.enabled && audit.state !== "EDIT") {
            Response.Forbidden(res, "The audit is not in the EDIT state and therefore cannot be edited.");
            return;
        }
        if (typeof req.body.oldIndex === 'undefined' || typeof req.body.newIndex === 'undefined') {
            Response.BadParameters(res, 'Missing some required parameters: oldIndex, newIndex');
            return;
        }
        
        var move = {};
        // Required parameters
        move.oldIndex = req.body.oldIndex;
        move.newIndex = req.body.newIndex;

        if (settings.reviews.enabled && settings.reviews.private.removeApprovalsUponUpdate) {
            Audit.updateGeneral(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, { approvals: [] });
        }
        
        Audit.moveFindingPosition(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, move)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err));
    });

    // Give or remove a reviewer's approval to an audit
    app.put("/api/audits/:auditId/toggleApproval", acl.hasPermission('audits:review'), async function(req, res) {
        const settings = await Settings.getAll();

        if (!settings.reviews.enabled) {
            Response.Forbidden(res, "Audit reviews are not enabled.");
            return;
        }

        Audit.findById(req.params.auditId)
        .then(audit => {
            if (audit.state !== "REVIEW" && audit.state !== "APPROVED") {
                Response.Forbidden(res, "The audit is not approvable in the current state.");
                return;
            }

            var hasApprovedBefore = false;
            var newApprovalsArray = [];
            if (audit.approvals) {
                audit.approvals.forEach((approval) => {
                    if (approval._id.toString() === req.decodedToken.id) {
                        hasApprovedBefore = true;
                    } else {
                        newApprovalsArray.push(approval);
                    }
                });
            }

            if (!hasApprovedBefore) {
                newApprovalsArray.push({
                    _id: req.decodedToken.id,
                    role: req.decodedToken.role,
                    username: req.decodedToken.username,
                    firstname: req.decodedToken.firstname,
                    lastname: req.decodedToken.lastname
                });
            }

            var update = { approvals : newApprovalsArray};
            Audit.updateApprovals(acl.isAllowed(req.decodedToken.role, 'audits:review-all'), req.params.auditId, req.decodedToken.id, update)
            .then(() => {
                io.to(req.params.auditId).emit('updateAudit');
                Response.Ok(res, "Approval updated successfully.")
            })
            .catch((err) => {
                Response.Internal(res, err);
            })
        })
        .catch((err) => {
            Response.Internal(res, err);
        })
    });

    // Sets the audit state to EDIT or REVIEW
    app.put("/api/audits/:auditId/updateReadyForReview", acl.hasPermission('audits:update'), async function(req, res) {
        const settings = await Settings.getAll();

        if (!settings.reviews.enabled) {
            Response.Forbidden(res, "Audit reviews are not enabled.");
            return;
        }

        var update = {};
        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id);

        if (audit.state !== "EDIT" && audit.state !== "REVIEW") {
            Response.Forbidden(res, "The audit is not in the proper state for this action.");
            return;
        }

        if (req.body.state != undefined && (req.body.state === "EDIT" || req.body.state === "REVIEW")) update.state = req.body.state;

        if (update.state === "EDIT") {
            var newApprovalsArray = [];
            if (audit.approvals) {
                audit.approvals.forEach((approval) => {
                    if (approval._id.toString() !== req.decodedToken.id) {
                        newApprovalsArray.push(approval);
                    }
                });
                update.approvals = newApprovalsArray;
            }
        }

        Audit.updateGeneral(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, update)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err));
    });

    // Update parentId of Audit
    app.put("/api/audits/:auditId/updateParent", acl.hasPermission('audits:create'), async function(req, res) {
        var settings = await Settings.getAll();
        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.body.parentId, req.decodedToken.id);
        if (settings.reviews.enabled && audit.state !== "EDIT") {
            Response.Forbidden(res, "The audit is not in the EDIT state and therefore cannot be edited.");
            return;
        }
        if (!req.body.parentId) {
            Response.BadParameters(res, 'Missing some required parameters: parentId');
            return;
        }
        Audit.updateParent(acl.isAllowed(req.decodedToken.role, 'audits:update-all'), req.params.auditId, req.decodedToken.id, req.body.parentId)
        .then(msg => {
            io.to(req.body.parentId).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Delete parentId of Audit
    app.delete("/api/audits/:auditId/deleteParent", acl.hasPermission('audits:delete'), async function(req, res) {
        var settings = await Settings.getAll();
        var audit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), req.params.auditId, req.decodedToken.id);
        var parentAudit = await Audit.getAudit(acl.isAllowed(req.decodedToken.role, 'audits:read-all'), audit.parentId, req.decodedToken.id);
        if (settings.reviews.enabled && parentAudit.state !== "EDIT") {
            Response.Forbidden(res, "The audit is not in the EDIT state and therefore cannot be edited.");
            return;
        }
        Audit.deleteParent(acl.isAllowed(req.decodedToken.role, 'audits:delete-all'), req.params.auditId, req.decodedToken.id)
        .then(msg => {
            if (msg.parentId)
                io.to(msg.parentId.toString()).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // ### COMMENTS ###

    // Add comment to audit
    app.post("/api/audits/:auditId/comments", acl.hasPermission('audits:comments:create'), function(req, res) {
        if ((!req.body.findingId && !req.body.sectionId) || (req.body.findingId && req.body.sectionId)) {
            Response.BadParameters(res, 'Only set one of "findingId" or "sectionId"');
            return;
        }

        if (!req.body.fieldName || !req.body.authorId) {
            Response.BadParameters(res, 'Missing some required parameters: fieldName, authorId');
            return;
        }

        var comment = {};
        // Required parameters
        if (req.body.findingId) comment.findingId = req.body.findingId;
        if (req.body.sectionId) comment.sectionId = req.body.sectionId;
        comment.fieldName = req.body.fieldName;
        comment.author = req.body.authorId;
        comment.text = (req.body.text) ? req.body.text : '';

        // Optional parameters
        if (req.body.commentId) comment._id = req.body.commentId

        Audit.createComment(acl.isAllowed(req.decodedToken.role, 'audits:comments:create-all'), req.params.auditId, req.decodedToken.id, comment)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');
            Response.Created(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Delete comment of audit
    app.delete("/api/audits/:auditId/comments/:commentId", acl.hasPermission('audits:comments:delete'), async function(req, res) {
        Audit.deleteComment(acl.isAllowed(req.decodedToken.role, 'audits:comments:delete-all'), req.params.auditId, req.decodedToken.id, req.params.commentId)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');            
            Response.Ok(res, msg);
        })
        .catch(err => Response.Internal(res, err))
    });

    // Update comment of audit
    app.put("/api/audits/:auditId/comments/:commentId", acl.hasPermission('audits:comments:update'), async function(req, res) {
        var comment = {};
        // Optional parameters
        if (req.body.text) comment.text = req.body.text;
        if (req.body.replies) comment.replies = req.body.replies;
        if (typeof(req.body.resolved) === 'boolean') comment.resolved = req.body.resolved

        Audit.updateComment(acl.isAllowed(req.decodedToken.role, 'audits:comments:update-all'), req.params.auditId, req.decodedToken.id, req.params.commentId, comment)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });
}
