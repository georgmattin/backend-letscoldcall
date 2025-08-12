-- Google Calendar integrations table
CREATE TABLE IF NOT EXISTS google_calendar_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMPTZ NOT NULL,
    google_email VARCHAR(255) NOT NULL,
    google_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one integration per user
    UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE google_calendar_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own integrations
CREATE POLICY "Users can view own calendar integrations" ON google_calendar_integrations
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert their own integrations
CREATE POLICY "Users can insert own calendar integrations" ON google_calendar_integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own integrations
CREATE POLICY "Users can update own calendar integrations" ON google_calendar_integrations
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can only delete their own integrations
CREATE POLICY "Users can delete own calendar integrations" ON google_calendar_integrations
    FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_google_calendar_integrations_user_id ON google_calendar_integrations(user_id);
CREATE INDEX idx_google_calendar_integrations_active ON google_calendar_integrations(user_id, is_active); 