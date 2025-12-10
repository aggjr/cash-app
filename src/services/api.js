import { getApiBaseUrl } from '../utils/apiConfig.js';

// API Service for CASH Application

class ApiService {
    async request(endpoint, options = {}) {
        const API_BASE_URL = getApiBaseUrl();
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                ...options,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Tipo Entrada API methods
    async getTipoEntrada() {
        return this.request('/tipo-entrada');
    }

    async getTipoEntradaTree() {
        return this.request('/tipo-entrada/tree');
    }

    async createTipoEntrada(data) {
        return this.request('/tipo-entrada', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateTipoEntrada(id, data) {
        return this.request(`/tipo-entrada/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteTipoEntrada(id) {
        return this.request(`/tipo-entrada/${id}`, {
            method: 'DELETE',
        });
    }

    async moveTipoEntrada(id, data) {
        return this.request(`/tipo-entrada/${id}/move`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }
}

export default new ApiService();
