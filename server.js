const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const path = require('path');
const session = require('express-session');
const Database = require('./database');
const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const {
    uploadRecordingToSupabase,
    saveRecordingMetadata,
    updateRecordingWithSupabaseInfo,
    updateRecordingWithTranscription,
    getRecordingMetadata,
    getRecordingsForTranscription,
    downloadRecordingFromSupabase,
    getSignedRecordingUrl
} = require('./utils/supabase-server');

// Import Azure OpenAI transcription utilities
const {
    transcribeAudio,
    transcribeEstonianAudio,
    transcribeMultiLanguageAudio
} = require('./utils/azure-openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize database
const db = new Database();
let twilioConfig = null;
let client = null;

// Create recordings directory if it doesn't exist
const recordingsDir = path.join(__dirname, 'recordings');
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
    console.log('📁 Created recordings directory:', recordingsDir);
}

// Create WebSocket server for Twilio Media Streams
const wss = new WebSocket.Server({ port: 3003 });
console.log('🎵 WebSocket server started on port 3003 for Twilio Media Streams');

// Handle WebSocket connections for audio streaming
wss.on('connection', (ws) => {
    console.log('🎵 New WebSocket connection for audio streaming');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.event === 'connected') {
                console.log('🎵 Media Stream connected:', data);
            } else if (data.event === 'start') {
                console.log('🎵 Media Stream started:', data);
                // Store stream info for this connection
                ws.callSid = data.start.callSid;
                ws.streamSid = data.start.streamSid;
            } else if (data.event === 'media') {
                // This is real-time audio data!
                const audioPayload = data.media.payload;
                const audioBuffer = Buffer.from(audioPayload, 'base64');
                
                // Send to real-time AI analysis
                processRealtimeAudio(audioBuffer, ws.callSid, data.media.timestamp)
                    .catch(error => console.error('🎵 Real-time AI processing error:', error));
                
            } else if (data.event === 'stop') {
                console.log('🎵 Media Stream stopped:', data);
            }
        } catch (error) {
            console.error('🎵 Error processing audio stream message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('🎵 WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
        console.error('🎵 WebSocket error:', error);
    });
});

// Real-time audio processing function
async function processRealtimeAudio(audioBuffer, callSid, timestamp) {
    try {
        // TODO: Implement real-time AI analysis
        // For now, just log that we received audio
        console.log(`🎵 Received ${audioBuffer.length} bytes of audio for call ${callSid} at ${timestamp}`);
        
        // You could:
        // 1. Buffer audio chunks until you have enough for transcription
        // 2. Send to Azure OpenAI Whisper for real-time transcription  
        // 3. Generate AI suggestions based on conversation
        // 4. Send suggestions back to the calling interface
        
    } catch (error) {
        console.error('🎵 Error in processRealtimeAudio:', error);
    }
}

// Function to transcribe audio buffer using Azure OpenAI
async function transcribeRecordingAudio(recordingSid, audioBuffer, fileName) {
    try {
        console.log('🎙️ Starting transcription for recording:', recordingSid);
        
        // Update status to processing
        await updateRecordingWithTranscription(recordingSid, {
            success: false,
            text: '',
            detected_method: 'processing'
        });
        
        // Try multi-language transcription (Estonian, English, Russian)
        const transcriptionResult = await transcribeMultiLanguageAudio(audioBuffer, fileName);
        
        if (transcriptionResult.success && transcriptionResult.text) {
            console.log('✅ Transcription completed:', transcriptionResult.text.substring(0, 100) + '...');
            
            // Save transcription to database
            await updateRecordingWithTranscription(recordingSid, transcriptionResult);
            
            return transcriptionResult;
        } else {
            console.log('⚠️ Transcription failed or empty result');
            
            // Save failed status
            await updateRecordingWithTranscription(recordingSid, {
                success: false,
                text: '',
                error: transcriptionResult.error || 'Transcription failed or returned empty result',
                detected_method: 'failed'
            });
            
            return transcriptionResult;
        }
        
    } catch (error) {
        console.error('❌ Error during transcription:', error);
        
        // Save error to database
        try {
            await updateRecordingWithTranscription(recordingSid, {
                success: false,
                text: '',
                error: error.message,
                detected_method: 'error'
            });
        } catch (dbError) {
            console.error('❌ Error saving transcription error to database:', dbError);
        }
        
        return {
            success: false,
            error: error.message,
            text: ''
        };
    }
}

// Function to download recording from Twilio and save to Supabase Storage
async function downloadRecordingToSupabase(recordingSid, recordingUrl, twilioConfig, userId = null, callSid = null) {
    try {
        console.log('📥 Starting download for recording:', recordingSid);
        
        // Construct the media URL for WAV format
        let mediaUrl = recordingUrl;
        if (!mediaUrl.endsWith('.wav') && !mediaUrl.endsWith('.mp3')) {
            mediaUrl += '.wav';
        }
        
        console.log('📥 Downloading from URL:', mediaUrl);
        
        // Create auth header
        const auth = Buffer.from(`${twilioConfig.account_sid}:${twilioConfig.auth_token}`).toString('base64');
        
        return new Promise(async (resolve, reject) => {
            const options = {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'User-Agent': 'Cold-Call-App/1.0'
                }
            };
            
            console.log('📥 Making HTTPS request with auth headers...');
            
            https.get(mediaUrl, options, async (response) => {
                console.log('📥 Response status:', response.statusCode);
                
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                // Collect all chunks into a buffer
                const chunks = [];
                let downloadedBytes = 0;
                
                response.on('data', (chunk) => {
                    chunks.push(chunk);
                    downloadedBytes += chunk.length;
                });
                
                response.on('end', async () => {
                    try {
                        console.log(`📥 Download completed: ${downloadedBytes} bytes`);
                        
                        // Combine all chunks into a single buffer
                        const audioBuffer = Buffer.concat(chunks);
                        
                        // Upload to Supabase Storage
                        console.log('📤 Uploading to Supabase Storage...');
                        const storageResult = await uploadRecordingToSupabase(recordingSid, audioBuffer, userId);
                        
                        console.log('✅ Recording uploaded to Supabase Storage:', storageResult.storagePath);
                        
                        // Start transcription process (async, don't wait for completion)
                        transcribeRecordingAudio(recordingSid, audioBuffer, storageResult.fileName)
                            .then((transcriptionResult) => {
                                if (transcriptionResult.success) {
                                    console.log('🎙️ Auto-transcription completed for:', recordingSid);
                                } else {
                                    console.log('⚠️ Auto-transcription failed for:', recordingSid, transcriptionResult.error);
                                }
                            })
                            .catch((error) => {
                                console.error('❌ Auto-transcription error for:', recordingSid, error);
                            });
                        
                        resolve({
                            fileName: storageResult.fileName,
                            storagePath: storageResult.storagePath,
                            fileSize: storageResult.fileSize,
                            bucket: storageResult.bucket
                        });
                        
                    } catch (uploadError) {
                        console.error('❌ Error uploading to Supabase:', uploadError);
                        reject(uploadError);
                    }
                });
                
                response.on('error', (error) => {
                    console.error('📥 Download stream error:', error);
                    reject(error);
                });
                
            }).on('error', (error) => {
                console.error('📥 HTTPS request error:', error);
                reject(error);
            });
        });
        
    } catch (error) {
        console.error('📥 Error in downloadRecordingToSupabase:', error);
        throw error;
    }
}

// Legacy function for backward compatibility (now also saves to Supabase)
async function downloadRecordingLocally(recordingSid, recordingUrl, twilioConfig, userId = null, callSid = null) {
    try {
        // Use the new Supabase function, but also save locally for now
        console.log('📥 Starting download for recording (legacy):', recordingSid);
        
        const supabaseResult = await downloadRecordingToSupabase(recordingSid, recordingUrl, twilioConfig, userId, callSid);
        
        // For backward compatibility, also create a local file reference
        const localFileName = `recording_${recordingSid}_${Date.now()}.wav`;
        const localFilePath = path.join(recordingsDir, localFileName);
        
        return {
            fileName: localFileName,
            filePath: localFilePath,
            fileSize: supabaseResult.fileSize,
            // Add Supabase info
            storagePath: supabaseResult.storagePath,
            bucket: supabaseResult.bucket
        };
        
    } catch (error) {
        console.error('📥 Error in downloadRecordingLocally:', error);
        throw error;
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // This is crucial for Twilio webhooks!
app.use(express.static('public')); // Serve static files from public directory

// Session middleware for admin authentication
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Load Twilio configuration from database
async function loadTwilioConfig() {
    try {
        twilioConfig = await db.getTwilioConfig();
        if (twilioConfig) {
            // Initialize Twilio client with database config
            client = twilio(twilioConfig.account_sid, twilioConfig.auth_token);
            console.log('✅ Twilio configuration loaded from database');
            return true;
        } else {
            console.log('⚠️  No Twilio configuration found in database');
            // Fallback to environment variables
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            if (accountSid && authToken) {
                client = twilio(accountSid, authToken);
                twilioConfig = {
                    account_sid: accountSid,
                    auth_token: authToken,
                    api_key: process.env.TWILIO_API_KEY,
                    api_secret: process.env.TWILIO_API_SECRET,
                    phone_number: process.env.TWILIO_PHONE_NUMBER,
                    twiml_app_sid: process.env.TWILIO_TWIML_APP_SID
                };
                console.log('✅ Using environment variables for Twilio config');
                return true;
            }
            return false;
        }
    } catch (error) {
        console.error('❌ Error loading Twilio config:', error);
        return false;
    }
}

// Test Twilio connection
async function testTwilioConnection() {
    try {
        if (!client || !twilioConfig) {
            throw new Error('Twilio not configured');
        }
        
        const account = await client.api.accounts(twilioConfig.account_sid).fetch();
        console.log('✅ Twilio connection successful!');
        console.log(`Account: ${account.friendlyName}`);
        console.log(`Account SID: ${account.sid}`);
        console.log(`Phone Number: ${twilioConfig.phone_number}`);
        return { success: true, account, phoneNumber: twilioConfig.phone_number };
    } catch (error) {
        console.error('❌ Twilio connection failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Routes
app.get('/', (req, res) => {
    res.redirect('/index.html'); // Redirect to dialer interface
});

app.get('/api', (req, res) => {
    res.json({
        message: 'Let\'s Cold Call Backend API',
        version: '2.0.0',
        endpoints: {
            'GET /': 'Dialer interface',
            'GET /admin': 'Admin interface',
            'GET /api': 'API info',
            'GET /api/test-twilio': 'Test Twilio connection',
            'POST /api/make-call': 'Make a phone call',
            'GET /api/call-status/:callSid': 'Get call status',
            'GET /api/access-token': 'Get Access Token for Voice SDK',
            'POST /api/admin/login': 'Admin login',
            'POST /api/admin/logout': 'Admin logout',
            'GET /api/admin/config': 'Get Twilio configuration',
            'POST /api/admin/config': 'Save Twilio configuration'
        },
        twilio: {
            accountSid: twilioConfig?.account_sid || 'Not configured',
            phoneNumber: twilioConfig?.phone_number || 'Not configured',
            status: client ? 'Connected' : 'Not configured'
        }
    });
});

// Generate Access Token for Voice SDK
app.get('/api/access-token', (req, res) => {
    try {
        if (!twilioConfig) {
            throw new Error('Twilio not configured. Please configure Twilio settings in admin panel.');
        }

        const AccessToken = twilio.jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;

        // Use API Key and Secret from database config
        const apiKey = twilioConfig.api_key;
        const apiSecret = twilioConfig.api_secret;

        if (!apiKey || !apiSecret) {
            throw new Error('TWILIO_API_KEY and TWILIO_API_SECRET are required for JWT token generation');
        }

        const token = new AccessToken(
            twilioConfig.account_sid, // Account SID
            apiKey,                   // API Key SID
            apiSecret,                // API Secret
            { 
                identity: 'user_browser_client', // Fixed identity that matches TwiML
                ttl: 3600                // Token valid for 1 hour
            }
        );

        // Create a Voice grant
        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: twilioConfig.twiml_app_sid,  // TwiML App SID for outgoing calls
            incomingAllow: true                                  // Allow incoming calls
        });

        token.addGrant(voiceGrant);

        res.json({
            token: token.toJwt(),
            identity: token.identity
        });

        console.log('✅ Access token generated for identity:', token.identity);

    } catch (error) {
        console.error('❌ Error generating access token:', error);
        res.status(500).json({ 
            error: 'Token generation failed',
            details: error.message 
        });
    }
});

// Manual transcription endpoint
app.post('/api/recording/:recordingSid/transcribe', async (req, res) => {
    try {
        const { recordingSid } = req.params;
        const { force = false } = req.body; // Force re-transcription even if already exists
        
        console.log('🎙️ Manual transcription request for:', recordingSid);
        
        // Get recording metadata
        const recording = await getRecordingMetadata(recordingSid);
        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }
        
        // Check if already transcribed (unless force is true)
        if (!force && recording.transcription_text && recording.transcription_status === 'completed') {
            return res.json({
                success: true,
                message: 'Recording already transcribed',
                transcription: {
                    text: recording.transcription_text,
                    language: recording.transcription_language,
                    status: recording.transcription_status
                }
            });
        }
        
        // Check if recording file exists in Supabase
        if (!recording.storage_path) {
            return res.status(400).json({ error: 'Recording file not available in storage' });
        }
        
        // Download recording from Supabase
        const audioData = await downloadRecordingFromSupabase(recording.storage_path);
        const audioBuffer = Buffer.from(await audioData.arrayBuffer());
        const fileName = recording.storage_path.split('/').pop() || 'recording.wav';
        
        // Start transcription
        const transcriptionResult = await transcribeRecordingAudio(recordingSid, audioBuffer, fileName);
        
        res.json({
            success: transcriptionResult.success,
            message: transcriptionResult.success ? 'Transcription completed' : 'Transcription failed',
            transcription: transcriptionResult.success ? {
                text: transcriptionResult.text,
                language: transcriptionResult.language,
                duration: transcriptionResult.duration,
                method: transcriptionResult.detected_method
            } : null,
            error: transcriptionResult.error || null
        });
        
    } catch (error) {
        console.error('❌ Error in manual transcription:', error);
        res.status(500).json({
            error: 'Failed to transcribe recording',
            details: error.message
        });
    }
});

// Get transcription for a recording
app.get('/api/recording/:recordingSid/transcription', async (req, res) => {
    try {
        const { recordingSid } = req.params;
        
        // Get recording metadata
        const recording = await getRecordingMetadata(recordingSid);
        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }
        
        res.json({
            success: true,
            recording_sid: recordingSid,
            transcription: {
                text: recording.transcription_text || null,
                status: recording.transcription_status || 'pending',
                language: recording.transcription_language || null,
                duration: recording.transcription_duration || null,
                method: recording.transcription_method || null,
                transcribed_at: recording.transcribed_at || null,
                error: recording.transcription_error || null,
                segments: recording.transcription_segments ? JSON.parse(recording.transcription_segments) : null,
                words: recording.transcription_words ? JSON.parse(recording.transcription_words) : null
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting transcription:', error);
        res.status(500).json({
            error: 'Failed to get transcription',
            details: error.message
        });
    }
});

// Batch transcription endpoint for processing multiple recordings
app.post('/api/recordings/transcribe-batch', async (req, res) => {
    try {
        const { limit = 5, force = false } = req.body;
        
        console.log('🎙️ Starting batch transcription, limit:', limit);
        
        // Get recordings that need transcription
        let recordings;
        if (force) {
            // Get all completed recordings if force is true
            const supabase = require('./utils/supabase-server').createSupabaseClient();
            const { data } = await supabase
                .from('recordings')
                .select('*')
                .eq('download_status', 'completed')
                .not('storage_path', 'is', null)
                .order('created_at', { ascending: false })
                .limit(limit);
            recordings = data || [];
        } else {
            recordings = await getRecordingsForTranscription(limit);
        }
        
        if (recordings.length === 0) {
            return res.json({
                success: true,
                message: 'No recordings need transcription',
                processed: 0
            });
        }
        
        console.log(`🎙️ Found ${recordings.length} recordings to transcribe`);
        
        const results = [];
        
        // Process recordings sequentially to avoid overloading the API
        for (const recording of recordings) {
            try {
                console.log('🎙️ Processing recording:', recording.recording_sid);
                
                // Download recording from Supabase
                const audioData = await downloadRecordingFromSupabase(recording.storage_path);
                const audioBuffer = Buffer.from(await audioData.arrayBuffer());
                const fileName = recording.storage_path.split('/').pop() || 'recording.wav';
                
                // Transcribe
                const transcriptionResult = await transcribeRecordingAudio(recording.recording_sid, audioBuffer, fileName);
                
                results.push({
                    recording_sid: recording.recording_sid,
                    success: transcriptionResult.success,
                    text_length: transcriptionResult.text ? transcriptionResult.text.length : 0,
                    error: transcriptionResult.error || null
                });
                
                // Add delay between requests to be respectful to the API
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error('❌ Error processing recording:', recording.recording_sid, error);
                results.push({
                    recording_sid: recording.recording_sid,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const successful = results.filter(r => r.success).length;
        
        res.json({
            success: true,
            message: `Batch transcription completed: ${successful}/${results.length} successful`,
            processed: results.length,
            successful: successful,
            failed: results.length - successful,
            results: results
        });
        
    } catch (error) {
        console.error('❌ Error in batch transcription:', error);
        res.status(500).json({
            error: 'Failed to process batch transcription',
            details: error.message
        });
    }
});

// Test Twilio connection endpoint
app.get('/api/test-twilio', async (req, res) => {
    try {
        const result = await testTwilioConnection();
        if (result.success) {
            res.json({
                success: true,
                message: 'Twilio connection is working',
                account: result.account,
                phoneNumber: result.phoneNumber
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to connect to Twilio',
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error testing Twilio connection',
            error: error.message
        });
    }
});

// Direct call endpoint - bypasses webhook completely
app.post('/api/make-call', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        console.log('📞 Making direct call to:', phoneNumber);
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        if (!client || !twilioConfig) {
            throw new Error('Twilio not configured');
        }

        // Make call directly using Twilio API with recording enabled
        const call = await client.calls.create({
            to: phoneNumber,
            from: twilioConfig.phone_number,
            // TwiML with recording enabled for both parties
            twiml: `<Response>
                        <Say voice="alice" language="en-US">Hello! This call is being recorded for quality purposes.</Say>
                        <Dial record="record-from-ringing" recordingStatusCallback="${req.protocol}://${req.get('host')}/api/recording-status">
                            ${phoneNumber}
                        </Dial>
                    </Response>`
        });

        console.log('✅ Call created successfully:', call.sid);
        
        res.json({
            success: true,
            callSid: call.sid,
            message: 'Call initiated successfully with recording enabled'
        });

    } catch (error) {
        console.error('❌ Error making call:', error);
        res.status(500).json({
            error: 'Call failed',
            details: error.message
        });
    }
});

// TwiML endpoint for Voice SDK calls - handles both incoming and outgoing calls
app.post('/api/voice', (req, res) => {
    try {
        console.log('🔥 TwiML ENDPOINT CALLED! 🔥');
        console.log('📞 Request headers:', req.headers);
        console.log('📞 Request body:', req.body);
        console.log('📞 Request query:', req.query);
        console.log('📞 Request method:', req.method);
        console.log('📞 Request URL:', req.url);
        
        const twiml = new twilio.twiml.VoiceResponse();
    
    // Check if this is an incoming call (someone calling our Twilio number)
    const isIncomingCall = req.body.Direction === 'inbound';
    const caller = req.body.From;
    const calledNumber = req.body.To;
    
    // Additional check: make sure this is not a call FROM our browser client
    const isFromBrowserClient = caller && caller.includes('user_browser_client');
    
    console.log('📞 Call Direction:', req.body.Direction);
    console.log('📞 From:', caller);
    console.log('📞 To:', calledNumber);
    console.log('📞 Is from browser client:', isFromBrowserClient);
    
    if (isIncomingCall && !isFromBrowserClient) {
        console.log('📞 🔔 INCOMING CALL detected from external caller:', caller);
        
        // Add Media Stream for real-time AI analysis of incoming calls
        const streamUrl = process.env.WEBSOCKET_URL || `wss://${req.get('host').replace(':3002', ':3003')}`;
        twiml.start().stream({
            url: `${streamUrl}/audio-stream`,
            track: 'both_tracks' // Capture both caller and called party audio
        });
        
        // For incoming calls, dial to the client (browser) using TwiML App
        const dial = twiml.dial({
            callerId: caller, // Show the original caller's number
            timeout: 30,
            record: 'record-from-ringing',
            recordingStatusCallback: `${req.protocol}://${req.get('host')}/api/recording-status`
        });
        
        // Dial to the client (this will ring in the browser)
        dial.client('user_browser_client');
        
        console.log('📞 ➡️ Forwarding incoming call to browser client');
    } else if (isIncomingCall && isFromBrowserClient) {
        console.log('📞 📤 OUTGOING CALL from browser client - this should not trigger incoming call popup');
        
        // This is actually an outgoing call from our browser client
        // Handle it as outgoing call
        console.log('📞 Debugging outgoing call from browser client - phone number sources:');
        console.log('- req.body.To:', req.body.To);
        console.log('- req.body.Called:', req.body.Called);
        console.log('- req.query.To:', req.query.To);
        console.log('- req.query.Called:', req.query.Called);
        console.log('- req.body (all keys):', Object.keys(req.body));
        console.log('- req.query (all keys):', Object.keys(req.query));
        console.log('- Full req.body:', JSON.stringify(req.body, null, 2));
        console.log('- Full req.query:', JSON.stringify(req.query, null, 2));
        
        // Check for additional possible parameter names
        const allPossibleNumbers = [
          req.body.To,
          req.body.Called,
          req.query.To,
          req.query.Called,
          req.body.to,
          req.body.called,
          req.query.to,
          req.query.called,
          req.body.params?.To,
          req.body.params?.Called,
          req.body.params?.to,
          req.body.params?.called
        ].filter(Boolean);
        console.log('- All possible phone numbers found:', allPossibleNumbers);
        
        const phoneNumber = req.body.To || 
                           req.body.Called || 
                           req.query.To ||
                           req.query.Called ||
                           req.body.PhoneNumber ||
                           req.query.PhoneNumber ||
                           req.body.TargetNumber ||
                           req.query.TargetNumber ||
                           req.body.to ||
                           req.body.called ||
                           req.query.to ||
                           req.query.called ||
                           (req.body.params && req.body.params.To) ||
                           (req.body.params && req.body.params.Called) ||
                           (req.body.params && req.body.params.PhoneNumber);
        
        console.log('📞 Making outgoing call from browser client to:', phoneNumber);
        
        // TEMPORARY FIX: If no phone number is found, use the hardcoded test number
        const finalPhoneNumber = phoneNumber || '+37256272798';
        console.log('📞 Final phone number to dial:', finalPhoneNumber);
        console.log('📞 Original phoneNumber was:', phoneNumber);
        console.log('📞 req.body.params debug:', JSON.stringify(req.body.params, null, 2));
        
        if (finalPhoneNumber && finalPhoneNumber !== twilioConfig?.phone_number) {
            // Add recording notification
            twiml.say('This call is being recorded for quality purposes.');
            
            // Add Media Stream for real-time AI analysis
            const streamUrl = process.env.WEBSOCKET_URL || `wss://${req.get('host').replace(':3002', ':3003')}`;
            twiml.start().stream({
                url: `${streamUrl}/audio-stream`,
                track: 'both_tracks' // Capture both caller and called party audio
            });
            
            // Dial the phone number with recording enabled
            twiml.dial({
                callerId: twilioConfig?.phone_number || '+1234567890',
                record: 'record-from-ringing',
                recordingStatusCallback: `${req.protocol}://${req.get('host')}/api/recording-status`,
                timeout: 30
            }, phoneNumber);
        } else {
            console.log('📞 No valid phone number provided');
            twiml.say('Hello! This is a Voice SDK test call. Please provide a phone number to dial.');
            twiml.hangup();
        }
    } else if (req.body.Direction === 'outbound-api' || !req.body.Direction) {
        // This is for outgoing calls from Voice SDK
        // Voice SDK sends parameters differently - check multiple sources
        console.log('📞 Debugging all possible phone number sources:');
        console.log('- req.body.To:', req.body.To);
        console.log('- req.body.Called:', req.body.Called);
        console.log('- req.query.To:', req.query.To);
        console.log('- req.query.Called:', req.query.Called);
        console.log('- req.body (all keys):', Object.keys(req.body));
        console.log('- req.query (all keys):', Object.keys(req.query));
        console.log('- Full req.body:', JSON.stringify(req.body, null, 2));
        console.log('- Full req.query:', JSON.stringify(req.query, null, 2));
        
        // Check for additional possible parameter names
        const allPossibleNumbers = [
          req.body.To,
          req.body.Called,
          req.query.To,
          req.query.Called,
          req.body.to,
          req.body.called,
          req.query.to,
          req.query.called,
          req.body.params?.To,
          req.body.params?.Called,
          req.body.params?.to,
          req.body.params?.called
        ].filter(Boolean);
        console.log('- All possible phone numbers found:', allPossibleNumbers);
        
        const phoneNumber = req.body.To || 
                           req.body.Called || 
                           req.query.To ||
                           req.query.Called ||
                           req.body.PhoneNumber ||
                           req.query.PhoneNumber ||
                           req.body.TargetNumber ||
                           req.query.TargetNumber ||
                           req.body.to ||
                           req.body.called ||
                           req.query.to ||
                           req.query.called ||
                           (req.body.params && req.body.params.To) ||
                           (req.body.params && req.body.params.Called) ||
                           (req.body.params && req.body.params.PhoneNumber);
        
        console.log('📞 📤 Outgoing Voice SDK call - extracted phone number:', phoneNumber);
        console.log('📞 All request params:', { body: req.body, query: req.query });
        
        if (phoneNumber && phoneNumber !== twilioConfig?.phone_number) {
            console.log('📞 Making outgoing call with recording:', phoneNumber);
            
            // Add recording notification
            twiml.say('This call is being recorded for quality purposes.');
            
            // Add Media Stream for real-time AI analysis
            const streamUrl = process.env.WEBSOCKET_URL || `wss://${req.get('host').replace(':3002', ':3003')}`;
            twiml.start().stream({
                url: `${streamUrl}/audio-stream`,
                track: 'both_tracks' // Capture both caller and called party audio
            });
            
            // Dial the phone number with recording enabled
            twiml.dial({
                callerId: twilioConfig?.phone_number || '+1234567890',
                record: 'record-from-ringing',
                recordingStatusCallback: `${req.protocol}://${req.get('host')}/api/recording-status`,
                timeout: 30
            }, phoneNumber);
        } else {
            console.log('📞 No valid phone number provided for outgoing call, playing test message');
            twiml.say('Hello! This is a Voice SDK test call. Please provide a phone number to dial.');
            
            // For Voice SDK, we need to hang up cleanly
            twiml.hangup();
        }
    } else {
        // Unknown call type
        console.log('📞 ❓ Unknown call direction:', req.body.Direction);
        twiml.say('This is a test call from the Voice SDK. The connection is working.');
        twiml.hangup();
    }

        const twimlString = twiml.toString();
        console.log('📞 Generated TwiML:', twimlString);

        res.type('text/xml');
        res.send(twimlString);
        
        console.log('📞 TwiML response sent successfully!');
        
    } catch (error) {
        console.error('❌ ERROR in webhook:', error);
        
        // Send a basic TwiML response even if there's an error
        const errorTwiml = new twilio.twiml.VoiceResponse();
        errorTwiml.say('I am sorry, there was an error processing your call. Please try again later.');
        errorTwiml.hangup();
        
        res.type('text/xml');
        res.send(errorTwiml.toString());
    }
});

// Add a GET endpoint for testing
app.get('/api/voice', (req, res) => {
    console.log('🔥 TwiML GET ENDPOINT CALLED! 🔥');
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Hello! This is a GET request test. The webhook endpoint is working.');
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Call status callback endpoint
app.post('/api/call-status', (req, res) => {
    console.log('📊 CALL STATUS CALLBACK RECEIVED! 📊');
    console.log('Call status data:', req.body);
    
    const {
        CallSid,
        CallStatus,
        From,
        To,
        Direction,
        Duration,
        CallDuration
    } = req.body;
    
    console.log(`📞 Call ${CallSid}: ${CallStatus}`);
    console.log(`📞 Direction: ${Direction}, From: ${From}, To: ${To}`);
    if (Duration) console.log(`📞 Duration: ${Duration} seconds`);
    
    // You could save call logs to database here if needed
    
    res.status(200).send('OK');
});

// Recording status callback endpoint (both GET and POST)
app.all('/api/recording-status', async (req, res) => {
    console.log('🎙️ RECORDING STATUS CALLBACK RECEIVED! 🎙️');
    console.log('📊 Method:', req.method);
    console.log('📊 Query params:', req.query);
    console.log('📊 Body data:', req.body);
    
    // Twilio can send data in query params (GET) or body (POST)
    const data = req.method === 'GET' ? req.query : req.body;
    
    const {
        AccountSid,
        CallSid,
        RecordingSid,
        RecordingUrl,
        RecordingStatus,
        RecordingDuration,
        RecordingChannels,
        RecordingSource
    } = data;
    
    // Store recording information in database and upload to Supabase Storage
    if (RecordingStatus === 'completed' && RecordingUrl) {
        try {
            console.log('🎙️ Processing completed recording:', RecordingSid);
            
            // First get call history to find user_id
            let userId = null;
            let callHistoryId = null;
            
            try {
                // Get call history from Supabase first
                const supabase = require('./utils/supabase-server').createSupabaseClient();
                if (supabase) {
                    const { data: callHistory, error } = await supabase
                        .from('call_history')
                        .select('id, user_id, call_sid')
                        .eq('call_sid', CallSid)
                        .single();
                    
                    if (!error && callHistory) {
                        userId = callHistory.user_id;
                        callHistoryId = callHistory.id;
                        console.log('📞 Found matching call in Supabase for user:', userId);
                    } else {
                        console.log('⚠️ Call history not found in Supabase for call_sid:', CallSid);
                    }
                } else {
                    console.log('⚠️ Supabase client not available');
                }
                
                // Fallback to legacy database if not found in Supabase
                if (!userId) {
                    try {
                        const callHistory = await db.getCallHistory(); // Get recent call history from legacy DB
                        const matchingCall = callHistory.find(call => call.call_sid === CallSid);
                        if (matchingCall) {
                            userId = matchingCall.user_id;
                            callHistoryId = matchingCall.id;
                            console.log('📞 Found matching call in legacy DB for user:', userId);
                        }
                    } catch (legacyError) {
                        console.log('⚠️ Legacy call history lookup failed:', legacyError.message);
                    }
                }
            } catch (error) {
                console.log('⚠️ Could not find matching call history:', error.message);
            }
            
            // Save recording metadata to Supabase recordings table
            const recordingData = {
                recording_sid: RecordingSid,
                call_sid: CallSid,
                user_id: userId,
                call_history_id: callHistoryId,
                recording_url: RecordingUrl,
                duration: RecordingDuration || 0,
                status: RecordingStatus,
                channels: RecordingChannels || 1,
                source: RecordingSource || 'DialVerb',
                storage_bucket: 'recordings',
                download_status: 'pending'
            };
            
            await saveRecordingMetadata(recordingData);
            console.log('✅ Recording metadata saved to Supabase:', RecordingSid);
            
            // Download recording and upload to Supabase Storage
            if (twilioConfig && (twilioConfig.account_sid || process.env.TWILIO_ACCOUNT_SID)) {
                console.log('📥 Starting automatic download and upload to Supabase:', RecordingSid);
                
                const downloadResult = await downloadRecordingToSupabase(
                    RecordingSid, 
                    RecordingUrl, 
                    {
                        account_sid: twilioConfig?.account_sid || process.env.TWILIO_ACCOUNT_SID,
                        auth_token: twilioConfig?.auth_token || process.env.TWILIO_AUTH_TOKEN
                    },
                    userId,
                    CallSid
                );
                
                // Update recording metadata with Supabase storage info
                await updateRecordingWithSupabaseInfo(RecordingSid, {
                    storagePath: downloadResult.storagePath,
                    fileSize: downloadResult.fileSize
                });
                
                // Also update call_history table if we found a matching call
                if (callHistoryId) {
                    try {
                        // Get signed URL for the recording (valid for 1 hour)
                        const signedUrl = await getSignedRecordingUrl(downloadResult.storagePath, 3600);
                        
                        // Update call_history directly in Supabase
                        const supabase = require('./utils/supabase-server').createSupabaseClient();
                        if (supabase) {
                            const { error } = await supabase
                                .from('call_history')
                                .update({
                                    recording_url: signedUrl,
                                    recording_available: true
                                })
                                .eq('id', callHistoryId);
                            
                            if (error) {
                                console.error('❌ Error updating call_history in Supabase:', error);
                            } else {
                                console.log('✅ Updated call_history with recording URL');
                            }
                        } else {
                            console.log('⚠️ Supabase client not available for call_history update');
                        }
                    } catch (error) {
                        console.error('❌ Error updating call_history:', error);
                    }
                }
                
                // Legacy: Also save to old database for backward compatibility
                try {
                    await db.saveRecording({
                        recording_sid: RecordingSid,
                        call_sid: CallSid,
                        recording_url: RecordingUrl,
                        duration: RecordingDuration || 0,
                        status: RecordingStatus,
                        channels: RecordingChannels || 1,
                        source: RecordingSource || 'DialVerb'
                    });
                    console.log('✅ Recording also saved to legacy database for compatibility');
                } catch (legacyError) {
                    console.log('⚠️ Legacy database save failed (this is okay):', legacyError.message);
                }
                
                console.log('✅ Recording processed and uploaded to Supabase:', downloadResult.fileName);
                
            } else {
                console.log('⚠️ Twilio config not available, skipping automatic download');
            }
            
        } catch (error) {
            console.error('❌ Error processing recording:', error);
        }
    }
    
    // Respond with empty TwiML (required by Twilio)
    res.type('text/xml');
    res.send('<Response></Response>');
});

// Get recordings endpoint (from Supabase with legacy fallback)
app.get('/api/recordings', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const userId = req.query.user_id || null;
        
        let recordings = [];
        
        try {
            // Try to get recordings from Supabase
            const supabase = require('./utils/supabase-server').createSupabaseClient();
            if (supabase) {
                let query = supabase
                    .from('recordings')
                    .select(`
                        *,
                        call_history (
                            contact_name,
                            contact_phone,
                            contact_company
                        )
                    `)
                    .order('created_at', { ascending: false })
                    .limit(limit);
                
                // Filter by user if provided
                if (userId) {
                    query = query.eq('user_id', userId);
                }
                
                const { data: supabaseRecordings, error } = await query;
                
                if (error) {
                    console.error('❌ Supabase query error:', error);
                    throw error;
                }
                
                // Transform Supabase data to match expected format
                recordings = supabaseRecordings.map(recording => ({
                    ...recording,
                    // Add legacy fields for compatibility
                    local_file_path: recording.storage_path,
                    local_file_name: recording.storage_path ? recording.storage_path.split('/').pop() : null,
                    local_file_size: recording.file_size,
                    // Add contact info if available
                    contact_name: recording.call_history?.contact_name || null,
                    contact_phone: recording.call_history?.contact_phone || null,
                    contact_company: recording.call_history?.contact_company || null
                }));
                
                console.log(`📥 Found ${recordings.length} recordings in Supabase`);
            }
        } catch (supabaseError) {
            console.log('⚠️ Supabase query failed, falling back to legacy database:', supabaseError.message);
        }
        
        // If no Supabase recordings or error, fallback to legacy database
        if (recordings.length === 0) {
            try {
                const legacyRecordings = await db.getRecordings(limit);
                recordings = legacyRecordings.map(recording => ({
                    ...recording,
                    // Mark as legacy
                    source_system: 'legacy',
                    download_status: recording.local_file_path ? 'completed' : 'pending'
                }));
                console.log(`📥 Found ${recordings.length} recordings in legacy database`);
            } catch (legacyError) {
                console.error('❌ Legacy database query failed:', legacyError);
                throw legacyError;
            }
        }
        
        res.json({ 
            success: true, 
            recordings,
            total: recordings.length,
            source: recordings.length > 0 && recordings[0].source_system === 'legacy' ? 'legacy' : 'supabase'
        });
        
    } catch (error) {
        console.error('❌ Error fetching recordings:', error);
        res.status(500).json({ 
            error: 'Failed to fetch recordings',
            details: error.message 
        });
    }
});

// Manually sync recordings from Twilio API
app.post('/api/sync-recordings', async (req, res) => {
    try {
        console.log('🔄 Syncing recordings from Twilio API...');
        
        if (!client) {
            throw new Error('Twilio not configured');
        }
        
        // Get recordings from Twilio API
        const twilioRecordings = await client.recordings.list({ limit: 50 });
        console.log(`📥 Found ${twilioRecordings.length} recordings in Twilio`);
        
        let syncedCount = 0;
        let skippedCount = 0;
        
        for (const recording of twilioRecordings) {
            try {
                // Check if recording already exists in our database
                const existingRecording = await db.getRecording(recording.sid);
                
                if (existingRecording) {
                    skippedCount++;
                    continue;
                }
                
                // Save new recording to database
                await db.saveRecording({
                    recording_sid: recording.sid,
                    call_sid: recording.callSid,
                    recording_url: `https://api.twilio.com${recording.uri.replace('.json', '')}`,
                    duration: recording.duration || 0,
                    status: recording.status,
                    channels: recording.channels || 1,
                    source: 'TwilioAPI'
                });
                
                syncedCount++;
                console.log(`✅ Synced recording: ${recording.sid}`);
                
            } catch (error) {
                console.error(`❌ Error syncing recording ${recording.sid}:`, error);
            }
        }
        
        console.log(`🎯 Sync complete: ${syncedCount} new, ${skippedCount} skipped`);
        
        res.json({ 
            success: true, 
            message: `Synced ${syncedCount} new recordings, skipped ${skippedCount} existing ones`,
            synced: syncedCount,
            skipped: skippedCount
        });
        
    } catch (error) {
        console.error('❌ Error syncing recordings:', error);
        res.status(500).json({ error: 'Failed to sync recordings: ' + error.message });
    }
});

// Serve recording files from Supabase Storage
app.get('/api/recording/:recordingSid/local', async (req, res) => {
    try {
        const { recordingSid } = req.params;
        
        // First try to get recording from Supabase
        let recording = null;
        try {
            recording = await getRecordingMetadata(recordingSid);
            console.log('📥 Found recording in Supabase:', recording.id);
        } catch (supabaseError) {
            console.log('⚠️ Recording not found in Supabase, trying legacy database...');
            
            // Fallback to legacy database
            recording = await db.getRecording(recordingSid);
            if (!recording) {
                return res.status(404).json({ error: 'Recording not found' });
            }
            
            // If it's a legacy recording with local file, serve it
            if (recording.local_file_path && fs.existsSync(recording.local_file_path)) {
                console.log('📥 Serving legacy local file');
                res.setHeader('Content-Type', 'audio/wav');
                res.setHeader('Content-Disposition', `inline; filename="${recording.local_file_name}"`);
                res.setHeader('Content-Length', recording.local_file_size || fs.statSync(recording.local_file_path).size);
                
                const fileStream = fs.createReadStream(recording.local_file_path);
                fileStream.pipe(res);
                return;
            } else {
                return res.status(404).json({ error: 'Recording file not found' });
            }
        }
        
        // If we have a Supabase recording, download and stream it
        if (recording.storage_path && recording.download_status === 'completed') {
            console.log('📥 Downloading from Supabase Storage:', recording.storage_path);
            
            try {
                // Download the file from Supabase Storage
                const fileBlob = await downloadRecordingFromSupabase(recording.storage_path);
                const buffer = Buffer.from(await fileBlob.arrayBuffer());
                
                // Set appropriate headers
                res.setHeader('Content-Type', 'audio/wav');
                res.setHeader('Content-Disposition', `inline; filename="recording_${recordingSid}.wav"`);
                res.setHeader('Content-Length', buffer.length);
                res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
                
                // Send the buffer
                res.send(buffer);
                
                console.log('✅ Successfully streamed recording from Supabase Storage');
                
            } catch (downloadError) {
                console.error('❌ Error downloading from Supabase Storage:', downloadError);
                
                // Try to create a signed URL as fallback
                try {
                    const signedUrl = await getSignedRecordingUrl(recording.storage_path, 3600);
                    res.redirect(signedUrl);
                } catch (signedUrlError) {
                    console.error('❌ Error creating signed URL:', signedUrlError);
                    res.status(500).json({ error: 'Failed to access recording file' });
                }
            }
        } else {
            return res.status(404).json({ 
                error: 'Recording not available', 
                status: recording.download_status || 'unknown' 
            });
        }
        
    } catch (error) {
        console.error('❌ Error serving recording:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download recording endpoint
app.get('/api/recording/:recordingSid/download', async (req, res) => {
    try {
        const { recordingSid } = req.params;
        const format = req.query.format || 'wav'; // wav or mp3
        
        // Get recording info from database
        const recording = await db.getRecording(recordingSid);
        
        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }
        
        // Construct Twilio recording URL with format and authentication
        let recordingUrl = recording.recording_url;
        
        // Add format extension
        if (format === 'mp3') {
            recordingUrl += '.mp3';
        } else {
            recordingUrl += '.wav';
        }
        
        // For direct download, we need to proxy through our server with auth
        // or redirect with auth parameters
        if (!client) {
            return res.status(500).json({ error: 'Twilio not configured' });
        }
        
        try {
            // Get the recording from Twilio with proper authentication
            const twilioRecording = await client.recordings(recordingSid).fetch();
            
            // Construct the media URL with authentication
            const mediaUrl = `https://api.twilio.com${twilioRecording.uri.replace('.json', '')}.${format}`;
            
            // Fetch the recording with authentication and stream it to the client
            const https = require('https');
            const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
            
            const options = {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            };
            
            https.get(mediaUrl, options, (twilioResponse) => {
                // Set appropriate headers for download
                res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'audio/wav');
                res.setHeader('Content-Disposition', `attachment; filename="recording_${recordingSid}.${format}"`);
                
                // Pipe the response from Twilio to our client
                twilioResponse.pipe(res);
            }).on('error', (error) => {
                console.error('Error downloading from Twilio:', error);
                res.status(500).json({ error: 'Failed to download recording' });
            });
            
        } catch (error) {
            console.error('Error fetching recording from Twilio:', error);
            res.status(500).json({ error: 'Failed to access recording' });
        }
        
    } catch (error) {
        console.error('❌ Error downloading recording:', error);
        res.status(500).json({
            error: 'Failed to download recording',
            details: error.message
        });
    }
});

// Get call status endpoint
app.get('/api/call-status/:callSid', async (req, res) => {
    try {
        const { callSid } = req.params;
        const call = await client.calls(callSid).fetch();
        
        res.json({
            success: true,
            callSid: call.sid,
            status: call.status,
            duration: call.duration,
            startTime: call.startTime,
            endTime: call.endTime,
            from: call.from,
            to: call.to
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get call status',
            error: error.message
        });
    }
});

// Admin middleware - check if user is authenticated
function requireAuth(req, res, next) {
    if (req.session && req.session.adminId) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
}

// Admin routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const admin = await db.validateAdmin(username, password);
        
        if (admin) {
            req.session.adminId = admin.id;
            req.session.adminUsername = admin.username;
            res.json({ 
                success: true, 
                message: 'Login successful',
                admin: { id: admin.id, username: admin.username, email: admin.email }
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ error: 'Logout failed' });
        } else {
            res.json({ success: true, message: 'Logged out successfully' });
        }
    });
});

// Check authentication status
app.get('/api/admin/check-auth', requireAuth, (req, res) => {
    res.json({ 
        authenticated: true, 
        admin: { 
            id: req.session.adminId, 
            username: req.session.adminUsername 
        } 
    });
});

// Get Twilio configuration
app.get('/api/admin/config', requireAuth, async (req, res) => {
    try {
        const config = await db.getTwilioConfig();
        if (config) {
            // Don't send sensitive data to frontend
            const safeConfig = {
                account_sid: config.account_sid,
                api_key: config.api_key,
                phone_number: config.phone_number,
                twiml_app_sid: config.twiml_app_sid,
                webhook_url: config.webhook_url,
                updated_at: config.updated_at
            };
            res.json(safeConfig);
        } else {
            res.json(null);
        }
    } catch (error) {
        console.error('Error getting config:', error);
        res.status(500).json({ error: 'Failed to get configuration' });
    }
});

// Save Twilio configuration
app.post('/api/admin/config', requireAuth, async (req, res) => {
    try {
        const config = req.body;
        
        // Validate required fields
        const required = ['account_sid', 'auth_token', 'api_key', 'api_secret', 'phone_number', 'twiml_app_sid'];
        for (const field of required) {
            if (!config[field]) {
                return res.status(400).json({ error: `${field} is required` });
            }
        }

        // Save to database
        await db.saveTwilioConfig(config);
        
        // Reload configuration
        await loadTwilioConfig();
        
        res.json({ success: true, message: 'Configuration saved successfully' });
        
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// Change admin password
app.post('/api/admin/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }

        // Validate current password
        const admin = await db.validateAdmin(req.session.adminUsername, currentPassword);
        if (!admin) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update password
        const success = await db.updateAdminPassword(req.session.adminUsername, newPassword);
        
        if (success) {
            res.json({ success: true, message: 'Password changed successfully' });
        } else {
            res.status(500).json({ error: 'Failed to change password' });
        }
        
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Test connection (admin version with more details)
app.get('/api/admin/test-connection', requireAuth, async (req, res) => {
    try {
        const result = await testTwilioConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Initialize and start server
async function startServer() {
    try {
        // Initialize database
        await db.init();
        
        // Load Twilio configuration
        await loadTwilioConfig();
        
        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📱 Dialer: http://localhost:${PORT}`);
            console.log(`⚙️  Admin: http://localhost:${PORT}/admin`);
            console.log('🔗 Testing Twilio connection...');
            testTwilioConnection();
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 