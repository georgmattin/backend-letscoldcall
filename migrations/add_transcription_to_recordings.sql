-- Add transcription fields to recordings table
-- This migration adds fields for storing Azure OpenAI transcription results

ALTER TABLE recordings 
ADD COLUMN IF NOT EXISTS transcription_text TEXT,
ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS transcription_language VARCHAR(10),
ADD COLUMN IF NOT EXISTS transcription_duration FLOAT,
ADD COLUMN IF NOT EXISTS transcription_error TEXT,
ADD COLUMN IF NOT EXISTS transcription_confidence FLOAT,
ADD COLUMN IF NOT EXISTS transcription_segments JSONB,
ADD COLUMN IF NOT EXISTS transcription_words JSONB,
ADD COLUMN IF NOT EXISTS transcription_method VARCHAR(50) DEFAULT 'azure_openai',
ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMPTZ;

-- Add index for transcription status for efficient queries
CREATE INDEX IF NOT EXISTS idx_recordings_transcription_status 
ON recordings(transcription_status);

-- Add index for transcribed_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_recordings_transcribed_at 
ON recordings(transcribed_at);

-- Add index for finding recordings that need transcription
CREATE INDEX IF NOT EXISTS idx_recordings_needs_transcription 
ON recordings(download_status, transcription_text) 
WHERE download_status = 'completed' AND transcription_text IS NULL;

-- Add comment to document the new fields
COMMENT ON COLUMN recordings.transcription_text IS 'Full transcribed text from Azure OpenAI';
COMMENT ON COLUMN recordings.transcription_status IS 'Status: pending, processing, completed, failed';
COMMENT ON COLUMN recordings.transcription_language IS 'Detected language code (e.g., et, en, ru)';
COMMENT ON COLUMN recordings.transcription_duration IS 'Audio duration in seconds from transcription';
COMMENT ON COLUMN recordings.transcription_error IS 'Error message if transcription failed';
COMMENT ON COLUMN recordings.transcription_confidence IS 'Confidence score from transcription service';
COMMENT ON COLUMN recordings.transcription_segments IS 'Detailed segments with timestamps (JSON)';
COMMENT ON COLUMN recordings.transcription_words IS 'Word-level transcription with timestamps (JSON)';
COMMENT ON COLUMN recordings.transcription_method IS 'Method used for transcription (azure_openai, etc.)';
COMMENT ON COLUMN recordings.transcribed_at IS 'Timestamp when transcription was completed'; 