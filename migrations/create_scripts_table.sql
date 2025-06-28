-- Create scripts table
CREATE TABLE IF NOT EXISTS public.scripts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    content TEXT NOT NULL,
    objections JSONB DEFAULT '[]'::jsonb, -- Array of objection objects
    linked_lists TEXT[], -- Array of contact list names
    status VARCHAR(50) DEFAULT 'active',
    usage_count INTEGER DEFAULT 0,
    success_rate INTEGER DEFAULT 0,
    avg_call_duration VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON public.scripts(user_id);

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS idx_scripts_category ON public.scripts(category);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_scripts_status ON public.scripts(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own scripts" ON public.scripts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scripts" ON public.scripts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scripts" ON public.scripts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scripts" ON public.scripts
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON public.scripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample scripts for the current user (if any users exist)
INSERT INTO public.scripts (user_id, name, description, category, content, linked_lists, usage_count, success_rate, avg_call_duration) 
SELECT 
    id as user_id,
    'Default Cold Outreach',
    'Standard cold calling script for new prospects',
    'cold_outreach',
    'Hi [name], this is [my_name] from [my_company_name].

I hope I''m not catching you at a bad time. We specialize in helping companies like [company] [specific value proposition].

I noticed that [specific observation about their company/industry], and I believe we might be able to help you [specific benefit].

Do you have 30 seconds for me to explain why I''m calling?

[Wait for response]

Perfect! We''ve recently helped [similar company] achieve [specific result]. For example:
- [Specific metric/improvement]
- [Another concrete benefit]
- [Third tangible outcome]

I''d love to show you exactly how we did this. Would you be open to a 15-minute conversation this week to explore if this could work for [company]?',
    ARRAY['Q1 2024 Tech Startup', 'Estonian SaaS Companies'],
    45,
    32,
    '4:23'
FROM auth.users 
LIMIT 1
ON CONFLICT DO NOTHING;

 