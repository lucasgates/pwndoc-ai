# AI Configuration Migration Guide

This document explains the changes made to move the OpenAI API key from environment variables to database configuration, allowing administrators to manage AI settings through the application interface.

## What Changed

### Before
- OpenAI API key was stored in environment variables (`OPENAI_API_KEY`)
- Required server restart to change the API key
- No way to enable/disable AI features without code changes

### After
- OpenAI API key is stored in the database settings
- Administrators can configure AI settings through the admin interface
- AI features can be enabled/disabled at runtime
- Support for different OpenAI models (configurable)

## Database Schema Changes

The Settings model now includes a new `ai` section:

```javascript
ai: {
    enabled: { type: Boolean, default: false },
    public: {
        model: { type: String, default: 'gpt-3.5-turbo' }
    },
    private: {
        openaiApiKey: { type: String, default: '' }
    }
}
```

## Migration Process

### Automatic Migration

1. **Run the migration script** (recommended):
   ```bash
   cd backend
   node migrate-openai-key.js
   ```

   This script will:
   - Check for existing OpenAI API key in environment variables
   - Migrate the key to database settings
   - Enable AI features automatically
   - Provide status updates and next steps

### Manual Migration

If you prefer to migrate manually:

1. **Access admin settings** through the application interface
2. **Navigate to AI Settings** section
3. **Enable AI features** by toggling the enabled switch
4. **Enter your OpenAI API key** in the API key field
5. **Configure the model** (default: gpt-3.5-turbo)
6. **Save settings**

## Configuration Options

### AI Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | Boolean | `false` | Enable/disable AI vulnerability generation |
| `model` | String | `gpt-3.5-turbo` | OpenAI model to use for generation |
| `openaiApiKey` | String | `''` | OpenAI API key (stored securely) |

### Supported Models

- `gpt-3.5-turbo` (default, cost-effective)
- `gpt-4` (higher quality, more expensive)
- `gpt-4-turbo` (latest GPT-4 model)
- Any other OpenAI chat completion model

## Security Considerations

- **API Key Storage**: The OpenAI API key is stored in the `private` section of settings, only accessible to admin users
- **Access Control**: Only users with `settings:read` and `settings:update` permissions can view/modify AI settings
- **Database Security**: Ensure your MongoDB instance is properly secured and encrypted

## API Changes

### Vulnerability Generation Endpoint

The `/api/vulnerabilities/ai-generate` endpoint now:

1. **Checks if AI is enabled** in database settings
2. **Retrieves API key** from database instead of environment
3. **Uses configured model** for generation
4. **Provides better error messages** for configuration issues

### Error Messages

- `AI features are not enabled` - AI is disabled in settings
- `OpenAI API key is not configured` - No API key in database settings
- Previous OpenAI-specific errors remain the same

## Testing the Migration

1. **Verify settings** are properly migrated:
   ```bash
   # Check if AI settings exist in database
   mongo your_database_name
   db.settings.findOne({}, {ai: 1})
   ```

2. **Test AI generation** through the application:
   - Create a new vulnerability
   - Use the AI generation feature
   - Verify it works with database-stored settings

3. **Test admin interface**:
   - Access settings as an admin user
   - Modify AI configuration
   - Verify changes take effect immediately

## Troubleshooting

### Common Issues

1. **"AI features are not enabled"**
   - Solution: Enable AI in admin settings or run migration script

2. **"OpenAI API key is not configured"**
   - Solution: Add API key in admin settings

3. **Migration script fails**
   - Check MongoDB connection
   - Verify config.json exists and is valid
   - Ensure proper permissions

### Rollback Process

If you need to rollback to environment-based configuration:

1. **Disable AI** in database settings
2. **Set environment variable** `OPENAI_API_KEY`
3. **Revert code changes** to use `process.env.OPENAI_API_KEY`

## Benefits

1. **Runtime Configuration**: Change API keys without server restart
2. **Centralized Management**: All settings in one place
3. **Better Security**: Leverages existing role-based access control
4. **Flexibility**: Easy to enable/disable features per environment
5. **Model Selection**: Administrators can choose different OpenAI models

## Next Steps

1. **Remove environment variable**: After successful migration, remove `OPENAI_API_KEY` from your environment
2. **Update documentation**: Update any deployment scripts or documentation that reference the environment variable
3. **Train administrators**: Ensure admin users know how to access and modify AI settings
4. **Monitor usage**: Keep track of OpenAI API usage through the configured key

## Support

If you encounter issues during migration:

1. Check the application logs for detailed error messages
2. Verify database connectivity and permissions
3. Ensure the Settings model is properly initialized
4. Test with a simple API key first

For additional support, refer to the main application documentation or contact your system administrator.
