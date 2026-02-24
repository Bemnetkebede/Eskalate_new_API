import { EventEmitter } from 'events';
import { prisma } from '../../lib/prisma';

export const analyticsEmitter = new EventEmitter();

const readActivityCache = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 30 * 1000;

analyticsEmitter.on('article:read', async ({ articleId, userId, ipAddress }) => {
    try {
        const key = `${articleId}:${ipAddress}`;
        const now = Date.now();
        const lastRead = readActivityCache.get(key);

        if (lastRead && now - lastRead < DEDUPLICATION_WINDOW_MS) {
            return; // Ignore within deduplication window
        }

        // Update cache
        readActivityCache.set(key, now);

        // Persist to DB
        await prisma.readLog.create({
            data: {
                articleId,
                userId: userId || null,
                ipAddress,
            },
        });
    } catch (error) {
        console.error('Error in article:read event listener:', error);
    }
});

// Cache cleanup to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of readActivityCache.entries()) {
        if (now - timestamp > DEDUPLICATION_WINDOW_MS) {
            readActivityCache.delete(key);
        }
    }
}, 60 * 1000); // Purge expired entries every 60s
