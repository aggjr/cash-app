```javascript
const express = require('express');
const router = express.Router();

// Try to load Google Cloud TTS (optional dependency)
let textToSpeech = null;
let ttsClient = null;

try {
    textToSpeech = require('@google-cloud/text-to-speech');
    console.log('📦 Google Cloud TTS module loaded successfully');
} catch (moduleError) {
    console.warn('⚠️ Google Cloud TTS module not found');
    console.warn('   Install with: npm install @google-cloud/text-to-speech');
    console.warn('   Voice tiers 1 and 2 will not work until module is installed.');
}

// Initialize Google Cloud TTS client (if module loaded)
if (textToSpeech) {
    try {
        // Check if credentials are provided as JSON string in environment variable
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            console.log('🔑 Loading Google Cloud credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON...');
            
            try {
                const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
                
                ttsClient = new textToSpeech.TextToSpeechClient({
                    credentials: credentials
                });
                
                console.log('✅ Google Cloud TTS client initialized with JSON credentials');
                console.log(`   Project: ${ credentials.project_id } `);
                console.log(`   Service Account: ${ credentials.client_email } `);
            } catch (parseError) {
                console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', parseError.message);
                throw parseError;
            }
        } 
        // Fallback: try file-based credentials (GOOGLE_APPLICATION_CREDENTIALS path)
        else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.log('🔑 Loading Google Cloud credentials from file:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
            ttsClient = new textToSpeech.TextToSpeechClient();
            console.log('✅ Google Cloud TTS client initialized with file credentials');
        }
        // No credentials configured
        else {
            console.warn('⚠️ No Google Cloud credentials configured');
            console.warn('   Set GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS');
            console.warn('   Voice tiers 1 and 2 will not work.');
        }
    } catch (error) {
        console.error('❌ Google Cloud TTS client failed to initialize:', error.message);
        console.warn('   Voice tiers 1 and 2 will not work.');
        ttsClient = null;
    }
}

/**
 * POST /api/eva/synthesize
 * Synthesize speech using Google Cloud TTS
 * 
 * Request body:
 * - text: string - Text to synthesize
 * - isMale: boolean - Gender selection
 * - rate: number - Speech rate (0.25 to 4.0)
 * - tier: number - Voice tier (1=Standard, 2=Premium)
 */
router.post('/synthesize', async (req, res) => {
    try {
        const { text, isMale, rate, tier } = req.body;

        // Validation
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (tier === undefined || ![1, 2].includes(tier)) {
            return res.status(400).json({ error: 'Tier must be 1 (Standard) or 2 (Premium)' });
        }

        if (!ttsClient) {
            return res.status(503).json({
                error: 'Google Cloud TTS not configured. Please set GOOGLE_APPLICATION_CREDENTIALS.'
            });
        }

        // Select voice based on tier and gender
        let voiceName;

        if (tier === 2) {
            // Premium: Neural2 voices (best quality)
            voiceName = isMale ? 'pt-BR-Neural2-C' : 'pt-BR-Neural2-A';
        } else {
            // Standard: Standard voices (always free up to 4M chars/month)
            voiceName = isMale ? 'pt-BR-Standard-C' : 'pt-BR-Standard-A';
        }

        // Prepare TTS request
        const request = {
            input: { text },
            voice: {
                languageCode: 'pt-BR',
                name: voiceName,
                ssmlGender: isMale ? 'MALE' : 'FEMALE'
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: rate || 1.0,
                pitch: 0.0,
                volumeGainDb: 0.0
            }
        };

        // Call Google Cloud TTS
        const [response] = await ttsClient.synthesizeSpeech(request);

        const tierName = tier === 2 ? 'Premium (Neural2)' : 'Standard';
        const gender = isMale ? 'Male' : 'Female';
        console.log(`[TTS] Synthesized: "${text.substring(0, 50)}..." | ${ voiceName } (${ tierName }, ${ gender }) | Rate: ${ rate } `);

        // Return audio as base64
        res.json({
            audioContent: response.audioContent.toString('base64'),
            voiceName,
            tier: tierName
        });

    } catch (error) {
        console.error('[TTS] Synthesis error:', error);

        // Check for quota/permission errors
        if (error.code === 7) { // PERMISSION_DENIED
            return res.status(403).json({
                error: 'Google Cloud TTS permission denied. Check your service account credentials.'
            });
        }

        if (error.code === 8) { // RESOURCE_EXHAUSTED
            return res.status(429).json({
                error: 'Google Cloud TTS quota exceeded. Consider using tier 1 (Standard) or wait until quota resets.'
            });
        }

        res.status(500).json({
            error: 'Failed to synthesize speech',
            details: error.message
        });
    }
});

module.exports = router;
