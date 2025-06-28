-- Add fields to track Connect setup status
ALTER TABLE user_twilio_connect_accounts 
ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS twiml_app_sid TEXT;

-- Add fields to link Twilio configs to Connect accounts
ALTER TABLE user_twilio_configs 
ADD COLUMN IF NOT EXISTS created_via_connect BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS connect_account_id UUID REFERENCES user_twilio_connect_accounts(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_twilio_configs_connect_account ON user_twilio_configs(connect_account_id);
CREATE INDEX IF NOT EXISTS idx_connect_accounts_setup ON user_twilio_connect_accounts(setup_completed);

-- Add comment to explain the relationship
COMMENT ON COLUMN user_twilio_configs.connect_account_id IS 'Links this config to a Twilio Connect account if created via Connect';
COMMENT ON COLUMN user_twilio_connect_accounts.setup_completed IS 'Indicates if automatic setup has been completed for this connected account';
COMMENT ON COLUMN user_twilio_connect_accounts.twiml_app_sid IS 'TwiML Application SID created during automatic setup'; 