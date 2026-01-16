const fileLogger = require('../utils/fileLogger');

class EvolutionApiService {
    constructor() {
        this.baseUrl = process.env.EVOLUTION_API_URL;
        this.apiKey = process.env.EVOLUTION_API_KEY;
        this.instanceName = 'Cash'; // Based on the screenshot
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

            // Allow user to pass full JID or just number
            const number = cleanPhone.includes('@s.whatsapp.net') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

            const url = `${this.baseUrl}/message/sendText/${this.instanceName}`;

            const payload = {
                number: number,
                text: text,
                options: {
                    delay: 1200,
                    presence: "composing",
                    linkPreview: false
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
