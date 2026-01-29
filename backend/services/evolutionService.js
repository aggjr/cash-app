const fileLogger = require('../utils/fileLogger');

class EvolutionApiService {
    constructor() {
        this.baseUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080'; // Fallback to avoid undefined in URL
        this.apiKey = process.env.EVOLUTION_API_KEY || '';
        this.instanceName = 'Cash';

        console.log('EvolutionApiService Initialized with URL:', this.baseUrl);

        if (!process.env.EVOLUTION_API_URL) {
            console.warn('⚠️ WARNING: EVOLUTION_API_URL not set. Using default:', this.baseUrl);
        }
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'apikey': this.apiKey
        };
    }

    /**
     * Send a text message to a phone number
     * @param {string} phone - Phone number (e.g., 553194477070)
     * @param {string} text - Message text
     */
    async sendMessage(phone, text) {
        console.log(`\n========== 🌐 EVOLUTION API - SEND MESSAGE ==========`);
        console.log(`🌐 [EVOLUTION] Phone (original): ${phone}`);
        console.log(`🌐 [EVOLUTION] Text length: ${text?.length || 0} chars`);
        console.log(`🌐 [EVOLUTION] Text preview: "${text?.substring(0, 100)}..."`);

        try {
            // Remove non-numeric characters from phone
            const cleanPhone = phone.replace(/\\D/g, '');
            console.log(`🌐 [EVOLUTION] Phone (cleaned): ${cleanPhone}`);

            // For Evolution API v2, typically just the number (DDI+DDD+NUM) is preferred in the payload.
            // Appending @s.whatsapp.net can sometimes cause issues if the API expects to resolve it.
            // If the user definitely needs JID, we can revert, but standardizing on digits is safer.
            const number = cleanPhone;

            const url = `${this.baseUrl}/message/sendText/${this.instanceName}`;
            console.log(`🌐 [EVOLUTION] URL: ${url}`);

            const payload = {
                number: number,
                text: text,
                options: {
                    delay: 1200,
                    presence: "composing",
                    linkPreview: true
                }
            };

            console.log(`🌐 [EVOLUTION] Payload:`, JSON.stringify(payload, null, 2));
            console.log(`🌐 [EVOLUTION] 🚀 Fazendo requisição POST...`);

            fileLogger.log(`Sending WhatsApp message to ${number} via Evolution API...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            console.log(`🌐 [EVOLUTION] Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`🌐 [EVOLUTION] ❌ Erro na resposta:`);
                console.error(`🌐 [EVOLUTION] Status: ${response.status}`);
                console.error(`🌐 [EVOLUTION] Body: ${errorText}`);
                throw new Error(`Evolution API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log(`🌐 [EVOLUTION] ✅ Mensagem enviada com sucesso!`);
            console.log(`🌐 [EVOLUTION] Response data:`, JSON.stringify(data, null, 2));
            console.log(`========== 🌐 EVOLUTION API - SUCCESS ==========\n`);

            fileLogger.log(`WhatsApp message sent successfully: ${JSON.stringify(data)}`);
            return data;
        } catch (error) {
            console.error(`🌐 [EVOLUTION] ❌ ERRO ao enviar mensagem:`);
            console.error(`🌐 [EVOLUTION] Erro: ${error.message}`);
            console.error(`🌐 [EVOLUTION] Stack: ${error.stack}`);
            console.log(`========== 🌐 EVOLUTION API - FAILED ==========\n`);

            fileLogger.log(`Error sending WhatsApp message: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send a media message (image/video)
     * @param {string} phone 
     * @param {string} mediaUrl - Full public URL of the media
     * @param {string} mediatype - "image" or "video"
     * @param {string} caption 
     */
    async sendMedia(phone, mediaUrl, mediatype, caption) {
        console.log(`\n========== 🌐 EVOLUTION API - SEND MEDIA ==========`);
        console.log(`🌐 [EVOLUTION] Phone (original): ${phone}`);
        console.log(`🌐 [EVOLUTION] Media URL: ${mediaUrl}`);
        console.log(`🌐 [EVOLUTION] Media type: ${mediatype}`);
        console.log(`🌐 [EVOLUTION] Caption length: ${caption?.length || 0} chars`);
        console.log(`🌐 [EVOLUTION] Caption preview: "${caption?.substring(0, 100)}..."`);

        try {
            const cleanPhone = phone.replace(/\\D/g, '');
            const number = cleanPhone; // Evolution v2 prefers digits
            console.log(`🌐 [EVOLUTION] Phone (cleaned): ${cleanPhone}`);

            const url = `${this.baseUrl}/message/sendMedia/${this.instanceName}`;
            console.log(`🌐 [EVOLUTION] URL: ${url}`);

            // Extract pure Base64 if it's a data URI
            let processedMedia = mediaUrl;
            if (mediaUrl.startsWith('data:')) {
                // Support both image and video data URIs
                const base64Match = mediaUrl.match(/data:(image|video)\/[^;]+;base64,(.+)/);
                if (base64Match) {
                    processedMedia = base64Match[2]; // Group 2 is the Base64 part
                    console.log(`🌐 [EVOLUTION] 🔧 Extraído Base64 puro (sem prefixo data:)`);
                    console.log(`🌐 [EVOLUTION] 🔧 Tipo de mídia: ${base64Match[1]}`);
                    console.log(`🌐 [EVOLUTION] 🔧 Base64 length: ${processedMedia.length} chars`);
                    console.log(`🌐 [EVOLUTION] 🔧 Primeiros 50 chars: ${processedMedia.substring(0, 50)}`);
                }
            }

            const payload = {
                number: number,
                media: processedMedia,
                mediatype: mediatype,
                caption: caption,
                options: {
                    delay: 1200,
                    presence: "composing"
                }
            };

            console.log(`🌐 [EVOLUTION] Payload:`, JSON.stringify(payload, null, 2));
            console.log(`🌐 [EVOLUTION] 🚀 Fazendo requisição POST...`);

            fileLogger.log(`Sending WhatsApp MEDIA (${mediatype}) to ${number}...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            console.log(`🌐 [EVOLUTION] Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`🌐 [EVOLUTION] ❌ Erro na resposta:`);
                console.error(`🌐 [EVOLUTION] Status: ${response.status}`);
                console.error(`🌐 [EVOLUTION] Body: ${errorText}`);
                throw new Error(`Evolution API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log(`🌐 [EVOLUTION] ✅ Mídia enviada com sucesso!`);
            console.log(`🌐 [EVOLUTION] Response data:`, JSON.stringify(data, null, 2));
            console.log(`========== 🌐 EVOLUTION API - SUCCESS ==========\n`);

            fileLogger.log(`WhatsApp media sent successfully: ${JSON.stringify(data)}`);
            return data;
        } catch (error) {
            console.error(`🌐 [EVOLUTION] ❌ ERRO ao enviar mídia:`);
            console.error(`🌐 [EVOLUTION] Erro: ${error.message}`);
            console.error(`🌐 [EVOLUTION] Stack: ${error.stack}`);
            console.log(`========== 🌐 EVOLUTION API - FAILED ==========\n`);

            fileLogger.log(`Error sending WhatsApp media: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check connection status of the instance
     */
    async getConnectionStatus() {
        try {
            const url = `${this.baseUrl}/instance/connectionState/${this.instanceName}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Evolution API Error ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            fileLogger.log(`Error checking WhatsApp connection status: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new EvolutionApiService();
