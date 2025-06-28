const fs = require('fs');
const path = require('path');

function updateWebhookUrl() {
    const newUrl = process.argv[2];
    
    if (!newUrl) {
        console.log('❌ Please provide the new webhook URL');
        console.log('Usage: node update-webhook-url.js https://your-tunnel-url');
        console.log('');
        console.log('This will:');
        console.log('1. Update WEBHOOK_URL in .env file');
        console.log('2. Automatically setup Twilio webhook');
        return;
    }

    if (!newUrl.startsWith('https://')) {
        console.log('❌ Webhook URL must start with https://');
        return;
    }

    try {
        const envPath = path.join(__dirname, '.env');
        
        // Read current .env file
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Update or add WEBHOOK_URL
        const webhookUrlRegex = /^WEBHOOK_URL=.*$/m;
        const newWebhookLine = `WEBHOOK_URL=${newUrl}`;
        
        if (webhookUrlRegex.test(envContent)) {
            // Update existing WEBHOOK_URL
            envContent = envContent.replace(webhookUrlRegex, newWebhookLine);
            console.log('✅ Updated existing WEBHOOK_URL in .env file');
        } else {
            // Add new WEBHOOK_URL after TWILIO_TWIML_APP_SID
            const insertAfter = /^TWILIO_TWIML_APP_SID=.*$/m;
            if (insertAfter.test(envContent)) {
                envContent = envContent.replace(insertAfter, (match) => {
                    return match + '\n\n# Webhook URL for incoming calls (update this when localtunnel URL changes)\n' + newWebhookLine;
                });
                console.log('✅ Added WEBHOOK_URL to .env file');
            } else {
                // Fallback: add at the end
                envContent += '\n\n# Webhook URL for incoming calls\n' + newWebhookLine + '\n';
                console.log('✅ Added WEBHOOK_URL at end of .env file');
            }
        }
        
        // Write back to .env file
        fs.writeFileSync(envPath, envContent);
        
        console.log(`📝 Webhook URL set to: ${newUrl}`);
        
        // Now run the setup script
        console.log('🔧 Setting up Twilio webhook...');
        
        require('dotenv').config(); // Reload .env
        
        const setupScript = require('./setup-incoming-calls.js');
        
    } catch (error) {
        console.error('❌ Error updating .env file:', error.message);
    }
}

// Only run if called directly
if (require.main === module) {
    updateWebhookUrl();
}

module.exports = updateWebhookUrl; 