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
        try {
            // Remove non-numeric characters from phone
            const cleanPhone = phone.replace(/\D/g, '');

            // For Evolution API v2, typically just the number (DDI+DDD+NUM) is preferred in the payload.
            // Appending @s.whatsapp.net can sometimes cause issues if the API expects to resolve it.
            // If the user definitely needs JID, we can revert, but standardizing on digits is safer.
            const number = cleanPhone;

            const url = `${this.baseUrl}/message/sendText/${this.instanceName}`;

            const payload = {
                number: number,
                text: text,
                options: {
                    delay: 1200,
                    presence: "composing",
                    linkPreview: true
                }
            };

            fileLogger.log(`Sending WhatsApp message to ${number} via Evolution API...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Evolution API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            fileLogger.log(`WhatsApp message sent successfully: ${JSON.stringify(data)}`);
            return data;
        } catch (error) {
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
        try {
            const cleanPhone = phone.replace(/\D/g, '');
            const number = cleanPhone; // Evolution v2 prefers digits

            const url = `${this.baseUrl}/message/sendMedia/${this.instanceName}`;

            const payload = {
                number: number,
                media: mediaUrl,
                mediatype: mediatype,
                caption: caption,
                options: {
                    delay: 1200,
                    presence: "composing"
                }
            };

            fileLogger.log(`Sending WhatsApp MEDIA (${mediatype}) to ${number}...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Evolution API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            fileLogger.log(`WhatsApp media sent successfully: ${JSON.stringify(data)}`);
            return data;
        } catch (error) {
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
