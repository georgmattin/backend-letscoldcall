-- Create call_history table
CREATE TABLE call_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_list_id UUID REFERENCES contact_lists(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  
  -- Contact info (stored directly for historical record)
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_company TEXT,
  contact_position TEXT,
  contact_email TEXT,
  contact_location TEXT,
  
  -- Call details
  call_sid TEXT, -- Twilio call ID
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration INTEGER DEFAULT 0, -- Duration in seconds
  
  -- Call outcome and notes
  call_outcome TEXT, -- interested, not_interested, callback, meeting, no_answer, wrong_number
  notes TEXT,
  
  -- Recording info
  recording_url TEXT,
  recording_available BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE call_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own call history" ON call_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own call history" ON call_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own call history" ON call_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_call_history_user_id ON call_history(user_id);
CREATE INDEX idx_call_history_session_id ON call_history(session_id);
CREATE INDEX idx_call_history_started_at ON call_history(started_at);
CREATE INDEX idx_call_history_call_sid ON call_history(call_sid);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_call_history_updated_at
  BEFORE UPDATE ON call_history
  FOR EACH ROW
  EXECUTE FUNCTION update_call_history_updated_at(); 