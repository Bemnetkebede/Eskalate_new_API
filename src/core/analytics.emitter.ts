import EventEmitter from 'node:events';
import { prisma } from '../lib/prisma.js';

export const analyticsEmitter = new EventEmitter();

// In-memory cache for refresh spam protection (30s window)
const readCache = new Map<string, number>();
const CACHE_TTL = 30 * 1000;

analyticsEmitter.on('trackRead', (data: any) => {
    const { articleId, userId, ipAddress } = data;
    const cacheKey = `${articleId}:${userId || ipAddress}`;
    const now = Date.now();
    const lastRead = readCache.get(cacheKey);

    if (lastRead && now - lastRead < CACHE_TTL) {
        return;
    }

    // Fire and forget (The "Senior" Difference)
    (async () => {
        try {
            await prisma.readLog.create({
                data: {
                    articleId,
                    userId,
                    ipAddress,
                },
            });
            readCache.set(cacheKey, now);
        } catch (error) {
            console.error('Failed to log read:', error);
        }
    })();
});

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of readCache.entries()) {
        if (now - timestamp > CACHE_TTL) {
            readCache.delete(key);
        }
    }
}, 60 * 1000);
