/**
 * IVA Learning Cache
 * Cache volátil de aprendizados durante a sessão
 * Conhecimento de alta frequência é promovido para persistência
 */
class IvaLearningCache {
    constructor() {
        this.cache = new Map();
        this.sessionStart = new Date();

        console.log('[IVA Learning Cache] Iniciado às', this.sessionStart);
    }

    /**
     * Armazena aprendizado temporário na cache
     */
    learn(projectId, type, key, data) {
        const cacheKey = `${projectId}:${type}:${key}`;

        const existing = this.cache.get(cacheKey);

        if (existing) {
            // Incrementa contador de acesso
            existing.accessCount++;
            existing.lastAccess = new Date();
            existing.data = data; // Atualiza com dados mais recentes
        } else {
            // Novo aprendizado
            this.cache.set(cacheKey, {
                projectId,
                type,
                key,
                data,
                learnedAt: new Date(),
                lastAccess: new Date(),
                accessCount: 1
            });
        }

        console.log(`[IVA Learning Cache] Learned: ${cacheKey} (${this.cache.get(cacheKey).accessCount}x)`);

        return this.cache.get(cacheKey);
    }

    /**
     * Recupera conhecimento da cache
     */
    recall(projectId, type, key) {
        const cacheKey = `${projectId}:${type}:${key}`;
        const cached = this.cache.get(cacheKey);

        if (cached) {
            cached.accessCount++;
            cached.lastAccess = new Date();

            console.log(`[IVA Learning Cache] Recalled: ${cacheKey} (${cached.accessCount} total uses)`);
            return cached.data;
        }

        return null;
    }

    /**
     * Verifica se conhecimento específico existe
     */
    has(projectId, type, key) {
        const cacheKey = `${projectId}:${type}:${key}`;
        return this.cache.has(cacheKey);
    }

    /**
     * Remove conhecimento específico
     */
    forget(projectId, type, key) {
        const cacheKey = `${projectId}:${type}:${key}`;
        const deleted = this.cache.delete(cacheKey);

        if (deleted) {
            console.log(`[IVA Learning Cache] Forgot: ${cacheKey}`);
        }

        return deleted;
    }

    /**
     * Limpa toda cache de um projeto
     */
    clearProject(projectId) {
        const keysToDelete = [];

        for (const [key] of this.cache.entries()) {
            if (key.startsWith(`${projectId}:`)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));

        console.log(`[IVA Learning Cache] Cleared ${keysToDelete.length} entries for project ${projectId}`);
        return keysToDelete.length;
    }

    /**
     * Limpa toda a cache
     */
    clearAll() {
        const size = this.cache.size;
        this.cache.clear();

        console.log(`[IVA Learning Cache] Cleared all ${size} entries`);
        return size;
    }

    /**
     * Identifica aprendizados de alto valor (devem ser persistidos)
     * Critério: usados 3 ou mais vezes
     */
    getHighValueLearnings(projectId, minAccessCount = 3) {
        const worthPersisting = [];

        for (const [key, value] of this.cache.entries()) {
            if (key.startsWith(`${projectId}:`) && value.accessCount >= minAccessCount) {
                worthPersisting.push({
                    cacheKey: key,
                    projectId: value.projectId,
                    type: value.type,
                    key: value.key,
                    data: value.data,
                    accessCount: value.accessCount,
                    learnedAt: value.learnedAt,
                    lastAccess: value.lastAccess
                });
            }
        }

        if (worthPersisting.length > 0) {
            console.log(`[IVA Learning Cache] Found ${worthPersisting.length} high-value learnings for project ${projectId}`);
        }

        return worthPersisting;
    }

    /**
     * Retorna estatísticas da cache
     */
    getStats(projectId = null) {
        let entries;

        if (projectId) {
            entries = [];
            for (const [key, value] of this.cache.entries()) {
                if (key.startsWith(`${projectId}:`)) {
                    entries.push(value);
                }
            }
        } else {
            entries = Array.from(this.cache.values());
        }

        const stats = {
            totalEntries: entries.length,
            byType: {},
            totalAccesses: 0,
            averageAccessCount: 0,
            highValueCount: 0,
            sessionAge: Math.floor((new Date() - this.sessionStart) / 1000 / 60) // minutos
        };

        entries.forEach(entry => {
            // Por tipo
            if (!stats.byType[entry.type]) {
                stats.byType[entry.type] = { count: 0, accesses: 0 };
            }
            stats.byType[entry.type].count++;
            stats.byType[entry.type].accesses += entry.accessCount;

            // Total
            stats.totalAccesses += entry.accessCount;

            // High value
            if (entry.accessCount >= 3) {
                stats.highValueCount++;
            }
        });

        if (entries.length > 0) {
            stats.averageAccessCount = (stats.totalAccesses / entries.length).toFixed(2);
        }

        return stats;
    }

    /**
     * Lista todos os aprendizados de um projeto
     */
    listProjectLearnings(projectId) {
        const learnings = [];

        for (const [key, value] of this.cache.entries()) {
            if (key.startsWith(`${projectId}:`)) {
                learnings.push({
                    key,
                    type: value.type,
                    accessCount: value.accessCount,
                    age: Math.floor((new Date() - value.learnedAt) / 1000 / 60), // minutos
                    lastUsed: Math.floor((new Date() - value.lastAccess) / 1000) // segundos
                });
            }
        }

        // Ordenar por access count (mais usado primeiro)
        learnings.sort((a, b) => b.accessCount - a.accessCount);

        return learnings;
    }
}

// Singleton global
const ivaLearningCache = new IvaLearningCache();

module.exports = ivaLearningCache;
