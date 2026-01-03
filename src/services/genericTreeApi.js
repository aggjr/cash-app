import { getApiBaseUrl } from '../utils/apiConfig.js';

// API Service for Generic Tree Operations

class GenericTreeApi {
    constructor(tableName) {
        this.tableName = tableName;
    }

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

    async getAll() {
        return this.request(`/tree/${this.tableName}`);
    }

    async getTree() {
        return this.request(`/tree/${this.tableName}/tree`);
    }

    async create(data) {
        return this.request(`/tree/${this.tableName}`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async update(id, data) {
        return this.request(`/tree/${this.tableName}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async delete(id) {
        return this.request(`/tree/${this.tableName}/${id}`, {
            method: 'DELETE',
        });
    }

    async move(id, data) {
        return this.request(`/tree/${this.tableName}/${id}/move`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }
}

export default GenericTreeApi;
