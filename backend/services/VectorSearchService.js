const https = require('https');
const OpenAI = require('openai');

class VectorSearchService {
    constructor() {
        const url = process.env.QDRANT_URL || 'https://iva-bd.gutoapps.site';
        const parsedUrl = new URL(url);
        this.hostname = parsedUrl.hostname;
        this.port = parsedUrl.port || 443;
        this.protocol = parsedUrl.protocol;

        this.apiKey = process.env.QDRANT_API_KEY;

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        this.collectionName = 'iva_knowledge';
        this.vectorSize = 1536; // para text-embedding-3-small
    }

    /**
     * Helper para chamadas ao Qdrant usando HTTPS nativo
     */
    async request(method, path, data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.hostname,
                port: this.port,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            if (this.apiKey) {
                options.headers['api-key'] = this.apiKey;
            }

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(body));
                        } catch (e) {
                            resolve(body);
                        }
                    } else {
                        reject(new Error(`Qdrant API error (${res.statusCode}): ${body}`));
                    }
                });
            });

            req.on('error', (e) => reject(e));

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    /**
     * Garantir que a coleção existe
     */
    async ensureCollection() {
        try {
            const collectionsResponse = await this.request('GET', '/collections');
            const exists = collectionsResponse.result.collections.some(c => c.name === this.collectionName);

            if (!exists) {
                console.log(`[VectorSearch] Creating collection ${this.collectionName}`);
                await this.request('PUT', `/collections/${this.collectionName}`, {
                    vectors: {
                        size: this.vectorSize,
                        distance: 'Cosine',
                    },
                });
            }
        } catch (error) {
            console.error('[VectorSearch] Error ensuring collection:', error.message);
            throw error;
        }
    }

    /**
     * Gerar embedding para um texto
     */
    async generateEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: text,
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error('[VectorSearch] Error generating embedding:', error.message);
            throw error;
        }
    }

    /**
     * Upsert de conhecimento no Qdrant
     */
    async upsertKnowledge(id, text, metadata) {
        try {
            console.log(`[VectorSearch] 🔄 Starting upsert for ID: ${id}`);
            console.log(`[VectorSearch] 📝 Text to embed: "${text.substring(0, 100)}..."`);

            await this.ensureCollection();
            console.log(`[VectorSearch] ✅ Collection ensured`);

            const vector = await this.generateEmbedding(text);
            console.log(`[VectorSearch] ✅ Embedding generated (dim: ${vector.length})`);

            await this.request('PUT', `/collections/${this.collectionName}/points`, {
                wait: true,
                points: [
                    {
                        id: this.generatePointId(id),
                        vector: vector,
                        payload: {
                            ...metadata,
                            text: text,
                            updated_at: new Date().toISOString(),
                        },
                    },
                ],
            });
            console.log(`[VectorSearch] ✅ Knowledge upserted: ${id}`);
        } catch (error) {
            console.error('[VectorSearch] ❌ Error upserting knowledge:', error.message);
            console.error('[VectorSearch] Stack:', error.stack);
            throw error;
        }
    }

    /**
     * Buscar conhecimento semelhante
     */
    async search(queryText, filters = {}, limit = 5) {
        try {
            await this.ensureCollection();
            const vector = await this.generateEmbedding(queryText);

            const filter = this.buildFilter(filters);

            const searchResponse = await this.request('POST', `/collections/${this.collectionName}/points/search`, {
                vector: vector,
                filter: filter,
                limit: limit,
                with_payload: true,
            });

            return searchResponse.result.map(hit => ({
                id: hit.id,
                score: hit.score,
                ...hit.payload
            }));
        } catch (error) {
            console.error('[VectorSearch] Error searching knowledge:', error.message);
            return [];
        }
    }

    /**
     * Deletar
     */
    async deleteKnowledge(id) {
        try {
            await this.request('POST', `/collections/${this.collectionName}/points/delete`, {
                points: [this.generatePointId(id)],
            });
        } catch (error) {
            console.error('[VectorSearch] Error deleting knowledge:', error.message);
        }
    }

    /**
     * Helper para gerar UUID válido a partir de string ID
     * Qdrant aceita apenas UUID ou integer, não strings arbitrárias
     */
    generatePointId(id) {
        const crypto = require('crypto');

        // Gerar hash MD5 da string (128 bits = 16 bytes)
        const hash = crypto.createHash('md5').update(id).digest('hex');

        // Formatar como UUID v4 (8-4-4-4-12)
        const uuid = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;

        return uuid;
    }

    buildFilter(filters) {
        const must = [];
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                must.push({
                    key: key,
                    match: { value: value }
                });
            }
        }
        return must.length > 0 ? { must } : undefined;
    }
}

module.exports = new VectorSearchService();
