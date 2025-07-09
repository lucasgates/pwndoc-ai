#!/usr/bin/env node

/**
 * Migration script to move OpenAI API key from environment variables to database settings
 * Run this script after updating the codebase to migrate existing configurations
 */

const mongoose = require('mongoose');
const path = require('path');

// Set the base directory for the application
global.__basedir = __dirname;

// Load configuration
const env = process.env.NODE_ENV || 'dev';
const config = require('./src/config/config.json');

// Load the Settings model
require('./src/models/settings');
const Settings = mongoose.model('Settings');

async function migrateOpenAIKey() {
    try {
        console.log('🔄 Starting OpenAI API key migration...');
        
        // Connect to MongoDB
        const dbConfig = config[env].database;
        const mongoUri = `mongodb://${dbConfig.server}:${dbConfig.port}/${dbConfig.name}`;
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Check if there's an OpenAI API key in environment variables
        const envApiKey = process.env.OPENAI_API_KEY;
        
        if (!envApiKey || envApiKey === 'your_openai_api_key_here') {
            console.log('ℹ️  No OpenAI API key found in environment variables');
        } else {
            console.log('🔑 Found OpenAI API key in environment variables');
            
            // Get current settings
            let settings = await Settings.getAll();
            
            if (!settings) {
                console.log('📝 Creating new settings document...');
                settings = new Settings({});
                await settings.save();
                settings = await Settings.getAll();
            }

            // Check if AI settings already exist and have a key
            if (settings.ai && settings.ai.private && settings.ai.private.openaiApiKey && settings.ai.private.openaiApiKey.trim() !== '') {
                console.log('⚠️  OpenAI API key already exists in database settings');
                console.log('   Current key (masked): ' + settings.ai.private.openaiApiKey.substring(0, 8) + '...');
                console.log('   Environment key (masked): ' + envApiKey.substring(0, 8) + '...');
                
                if (settings.ai.private.openaiApiKey !== envApiKey) {
                    console.log('❓ Keys are different. Updating database with environment key...');
                    await Settings.update({
                        'ai.private.openaiApiKey': envApiKey,
                        'ai.enabled': true
                    });
                    console.log('✅ Updated OpenAI API key in database');
                } else {
                    console.log('✅ Keys match, no update needed');
                }
            } else {
                console.log('📝 Migrating OpenAI API key to database...');
                await Settings.update({
                    'ai.enabled': true,
                    'ai.private.openaiApiKey': envApiKey,
                    'ai.public.model': 'gpt-3.5-turbo'
                });
                console.log('✅ Successfully migrated OpenAI API key to database');
                console.log('✅ AI features have been enabled');
            }
        }

        // Display current AI settings
        const finalSettings = await Settings.getAll();
        if (finalSettings && finalSettings.ai) {
            console.log('\n📊 Current AI Settings:');
            console.log('   Enabled:', finalSettings.ai.enabled);
            console.log('   Model:', finalSettings.ai.public ? finalSettings.ai.public.model : 'default');
            console.log('   API Key configured:', !!(finalSettings.ai.private && finalSettings.ai.private.openaiApiKey && finalSettings.ai.private.openaiApiKey.trim() !== ''));
        }

        console.log('\n🎉 Migration completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('   1. Remove OPENAI_API_KEY from your environment variables');
        console.log('   2. Configure AI settings through the admin interface');
        console.log('   3. Test the AI vulnerability generation feature');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the migration
if (require.main === module) {
    migrateOpenAIKey()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = migrateOpenAIKey;
