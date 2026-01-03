/**
 * EVA Screen Cache
 * Caches screen data for cross-screen analysis and performance
 * TTL-based cleanup to prevent memory leaks
 */

class EvaScreenCache {
    static cache = new Map();
    static TTL = 30 * 60 * 1000; // 30 minutes

    /**
     * Generate cache key
     */
    static getKey(userId, projectId, screenId) {
        return `${userId}:${projectId}:${screenId}`;
    }

    /**
     * Set screen data in cache
     */
    static set(userId, projectId, screenId, data) {
        const key = this.getKey(userId, projectId, screenId);

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            accessCount: 1,
            lastAccessed: Date.now()
        });

        console.log(`[EvaScreenCache] Cached ${screenId} for user ${userId}`);

        // Cleanup old entries
        this.cleanup();
    }

    /**
     * Get screen data from cache
     */
    static get(userId, projectId, screenId) {
        const key = this.getKey(userId, projectId, screenId);
        const cached = this.cache.get(key);

        if (!cached) {
            return null;
        }

        // Check TTL
        if (Date.now() - cached.timestamp > this.TTL) {
            this.cache.delete(key);
            console.log(`[EvaScreenCache] Expired ${screenId} for user ${userId}`);
            return null;
        }

        // Update access stats
        cached.accessCount++;
        cached.lastAccessed = Date.now();

        console.log(`[EvaScreenCache] Hit ${screenId} for user ${userId} (${cached.accessCount} accesses)`);

        return cached.data;
    }

    /**
     * Get most accessed screens for cross-analysis
     */
    static getMostAccessed(userId, projectId, limit = 3) {
        const userPrefix = `${userId}:${projectId}:`;

        const userEntries = Array.from(this.cache.entries())
            .filter(([key]) => key.startsWith(userPrefix))
            .filter(([_, cached]) => Date.now() - cached.timestamp < this.TTL)
            .sort((a, b) => b[1].accessCount - a[1].accessCount)
            .slice(0, limit);

        return userEntries.map(([key, cached]) => ({
            screenId: key.split(':')[2],
            data: cached.data,
            accessCount: cached.accessCount
        }));
    }

    /**
     * Cleanup expired entries
     */
    static cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.TTL) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[EvaScreenCache] Cleaned ${cleaned} expired entries`);
        }
    }

    /**
     * Clear all cache for a user
     */
    static clearUser(userId, projectId) {
        const userPrefix = `${userId}:${projectId}:`;
        let cleared = 0;

        for (const key of this.cache.keys()) {
            if (key.startsWith(userPrefix)) {
                this.cache.delete(key);
                cleared++;
            }
        }

        console.log(`[EvaScreenCache] Cleared ${cleared} entries for user ${userId}`);
    }

    /**
     * Get cache stats
     */
    static getStats() {
        return {
            totalEntries: this.cache.size,
            byUser: this.getEntriesByUser()
        };
    }

    static getEntriesByUser() {
        const byUser = {};

        for (const [key] of this.cache.entries()) {
            const userId = key.split(':')[0];
            byUser[userId] = (byUser[userId] || 0) + 1;
        }

        return byUser;
    }
}

module.exports = EvaScreenCache;
