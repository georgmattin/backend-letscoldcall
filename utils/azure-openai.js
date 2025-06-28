const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

// Azure OpenAI configuration
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://ai-info9558ai206679589008.openai.azure.com/openai/deployments/gpt-4o-transcribe/audio/transcriptions?api-version=2025-03-01-preview';
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || '5PLCGQuggEjd5FU8siUS6z4pus2kCynv1oGr2SqmXfQPvpQbnVzoJQQJ99BAACHYHv6XJ3w3AAAAACOGPI6Y';

/**
 * Transcribes audio using Azure OpenAI
 * @param {Buffer} audioBuffer - The audio file buffer
 * @param {string} fileName - The filename for the audio file (should include extension)
 * @param {Object} options - Optional transcription parameters
 * @returns {Promise<Object>} Transcription result
 */
async function transcribeAudio(audioBuffer, fileName = 'audio.wav', options = {}) {
    try {
        console.log('🎙️ Starting Azure OpenAI transcription for:', fileName);
        console.log('📊 Audio buffer size:', audioBuffer.length, 'bytes');
        
        // Create form data
        const formData = new FormData();
        formData.append('file', audioBuffer, {
            filename: fileName,
            contentType: getContentType(fileName)
        });
        
        // Add model parameter
        formData.append('model', 'gpt-4o-transcribe');
        
        // Add optional parameters
        if (options.language) {
            formData.append('language', options.language);
        }
        if (options.prompt) {
            formData.append('prompt', options.prompt);
        }
        if (options.response_format) {
            formData.append('response_format', options.response_format);
        }
        if (options.temperature !== undefined) {
            formData.append('temperature', options.temperature.toString());
        }
        
        // Make the API request
        const response = await axios.post(AZURE_OPENAI_ENDPOINT, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${AZURE_OPENAI_API_KEY}`,
            },
            timeout: 60000, // 60 second timeout
        });
        
        console.log('✅ Azure OpenAI transcription completed');
        console.log('📝 Transcription length:', response.data.text?.length || 0, 'characters');
        
        return {
            success: true,
            text: response.data.text || '',
            duration: response.data.duration || null,
            language: response.data.language || null,
            segments: response.data.segments || null,
            words: response.data.words || null,
            raw_response: response.data
        };
        
    } catch (error) {
        console.error('❌ Azure OpenAI transcription error:', error.message);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        
        return {
            success: false,
            error: error.message,
            text: '',
            status: error.response?.status || 500
        };
    }
}

/**
 * Get content type based on file extension
 * @param {string} fileName 
 * @returns {string}
 */
function getContentType(fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
        case 'wav':
            return 'audio/wav';
        case 'mp3':
            return 'audio/mpeg';
        case 'mp4':
            return 'audio/mp4';
        case 'm4a':
            return 'audio/m4a';
        case 'flac':
            return 'audio/flac';
        case 'webm':
            return 'audio/webm';
        case 'ogg':
            return 'audio/ogg';
        default:
            return 'audio/wav'; // Default to WAV
    }
}

/**
 * Transcribe audio with Estonian language optimization
 * @param {Buffer} audioBuffer 
 * @param {string} fileName 
 * @returns {Promise<Object>}
 */
async function transcribeEstonianAudio(audioBuffer, fileName = 'audio.wav') {
    return await transcribeAudio(audioBuffer, fileName, {
        language: 'et', // Estonian language code
        response_format: 'json', // Use 'json' instead of 'verbose_json'
        temperature: 0.0 // Lower temperature for more consistent results
    });
}

/**
 * Transcribe audio with multiple languages support
 * @param {Buffer} audioBuffer 
 * @param {string} fileName 
 * @param {string[]} languages - Array of language codes to try
 * @returns {Promise<Object>}
 */
async function transcribeMultiLanguageAudio(audioBuffer, fileName = 'audio.wav', languages = ['et', 'en', 'ru']) {
    // Try automatic language detection first
    const autoResult = await transcribeAudio(audioBuffer, fileName, {
        response_format: 'json', // Use 'json' instead of 'verbose_json'
        temperature: 0.0
    });
    
    if (autoResult.success && autoResult.text && autoResult.text.trim().length > 0) {
        return {
            ...autoResult,
            detected_method: 'auto'
        };
    }
    
    // If auto detection fails, try specific languages
    for (const lang of languages) {
        console.log(`🔄 Trying language: ${lang}`);
        const result = await transcribeAudio(audioBuffer, fileName, {
            language: lang,
            response_format: 'json', // Use 'json' instead of 'verbose_json'
            temperature: 0.0
        });
        
        if (result.success && result.text && result.text.trim().length > 0) {
            return {
                ...result,
                detected_method: 'manual',
                used_language: lang
            };
        }
    }
    
    // Return the auto result even if it failed
    return {
        ...autoResult,
        detected_method: 'fallback'
    };
}

module.exports = {
    transcribeAudio,
    transcribeEstonianAudio,
    transcribeMultiLanguageAudio,
    getContentType
}; 