const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for server operations
function createSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('❌ Missing Supabase configuration');
        console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
        return null;
    }
    
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

// Upload recording to Supabase Storage
async function uploadRecordingToSupabase(recordingSid, audioBuffer, userId = null) {
    const supabase = createSupabaseClient();
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    
    try {
        // Generate file path
        const timestamp = Date.now();
        const fileName = `recording_${recordingSid}_${timestamp}.wav`;
        const filePath = userId ? `${userId}/${fileName}` : `system/${fileName}`;
        
        console.log('📤 Uploading to Supabase Storage:', filePath);
        
        // Upload file to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(filePath, audioBuffer, {
                contentType: 'audio/wav',
                cacheControl: '3600',
                upsert: false
            });
        
        if (uploadError) {
            console.error('❌ Supabase upload error:', uploadError);
            throw uploadError;
        }
        
        console.log('✅ File uploaded to Supabase:', uploadData.path);
        
        // Get file size
        const fileSize = audioBuffer.length;
        
        return {
            storagePath: uploadData.path,
            fileName: fileName,
            fileSize: fileSize,
            bucket: 'recordings'
        };
        
    } catch (error) {
        console.error('❌ Error uploading to Supabase:', error);
        throw error;
    }
}

// Save recording metadata to database
async function saveRecordingMetadata(recordingData) {
    const supabase = createSupabaseClient();
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    
    try {
        const { data, error } = await supabase
            .from('recordings')
            .insert([recordingData])
            .select()
            .single();
        
        if (error) {
            console.error('❌ Error saving recording metadata:', error);
            throw error;
        }
        
        console.log('✅ Recording metadata saved:', data.id);
        return data;
        
    } catch (error) {
        console.error('❌ Error in saveRecordingMetadata:', error);
        throw error;
    }
}

// Update recording with Supabase storage info
async function updateRecordingWithSupabaseInfo(recordingSid, storageInfo) {
    const supabase = createSupabaseClient();
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    
    try {
        const { data, error } = await supabase
            .from('recordings')
            .update({
                storage_path: storageInfo.storagePath,
                file_size: storageInfo.fileSize,
                download_status: 'completed',
                updated_at: new Date().toISOString()
            })
            .eq('recording_sid', recordingSid)
            .select()
            .single();
        
        if (error) {
            console.error('❌ Error updating recording:', error);
            throw error;
        }
        
        console.log('✅ Recording updated with Supabase info:', data.id);
        return data;
        
    } catch (error) {
        console.error('❌ Error in updateRecordingWithSupabaseInfo:', error);
        throw error;
    }
}

// Get recording metadata
async function getRecordingMetadata(recordingSid) {
    const supabase = createSupabaseClient();
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    
    try {
        const { data, error } = await supabase
            .from('recordings')
            .select('*')
            .eq('recording_sid', recordingSid)
            .single();
        
        if (error) {
            console.error('❌ Error getting recording metadata:', error);
            throw error;
        }
        
        return data;
        
    } catch (error) {
        console.error('❌ Error in getRecordingMetadata:', error);
        throw error;
    }
}

// Download recording from Supabase Storage
async function downloadRecordingFromSupabase(storagePath) {
    const supabase = createSupabaseClient();
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    
    try {
        const { data, error } = await supabase.storage
            .from('recordings')
            .download(storagePath);
        
        if (error) {
            console.error('❌ Error downloading from Supabase:', error);
            throw error;
        }
        
        return data;
        
    } catch (error) {
        console.error('❌ Error in downloadRecordingFromSupabase:', error);
        throw error;
    }
}

// Get signed URL for recording
async function getSignedRecordingUrl(storagePath, expiresIn = 3600) {
    const supabase = createSupabaseClient();
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    
    try {
        const { data, error } = await supabase.storage
            .from('recordings')
            .createSignedUrl(storagePath, expiresIn);
        
        if (error) {
            console.error('❌ Error creating signed URL:', error);
            throw error;
        }
        
        return data.signedUrl;
        
    } catch (error) {
        console.error('❌ Error in getSignedRecordingUrl:', error);
        throw error;
    }
}

// Update recording with transcription data
async function updateRecordingWithTranscription(recordingSid, transcriptionData) {
    const supabase = createSupabaseClient();
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    
    try {
        const updateData = {
            transcription_text: transcriptionData.text || null,
            transcription_status: transcriptionData.success ? 'completed' : 'failed',
            transcription_language: transcriptionData.language || null,
            transcription_duration: transcriptionData.duration || null,
            transcription_error: transcriptionData.error || null,
            transcription_confidence: transcriptionData.confidence || null,
            transcription_segments: transcriptionData.segments ? JSON.stringify(transcriptionData.segments) : null,
            transcription_words: transcriptionData.words ? JSON.stringify(transcriptionData.words) : null,
            transcription_method: transcriptionData.detected_method || 'azure_openai',
            transcribed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('recordings')
            .update(updateData)
            .eq('recording_sid', recordingSid)
            .select()
            .single();
        
        if (error) {
            console.error('❌ Error updating recording with transcription:', error);
            throw error;
        }
        
        console.log('✅ Recording updated with transcription:', data.id);
        return data;
        
    } catch (error) {
        console.error('❌ Error in updateRecordingWithTranscription:', error);
        throw error;
    }
}

// Get recordings with transcription status
async function getRecordingsForTranscription(limit = 10) {
    const supabase = createSupabaseClient();
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    
    try {
        const { data, error } = await supabase
            .from('recordings')
            .select('*')
            .is('transcription_text', null)
            .eq('download_status', 'completed')
            .not('storage_path', 'is', null)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('❌ Error getting recordings for transcription:', error);
            throw error;
        }
        
        return data || [];
        
    } catch (error) {
        console.error('❌ Error in getRecordingsForTranscription:', error);
        throw error;
    }
}

module.exports = {
    createSupabaseClient,
    uploadRecordingToSupabase,
    saveRecordingMetadata,
    updateRecordingWithSupabaseInfo,
    updateRecordingWithTranscription,
    getRecordingMetadata,
    getRecordingsForTranscription,
    downloadRecordingFromSupabase,
    getSignedRecordingUrl
}; 