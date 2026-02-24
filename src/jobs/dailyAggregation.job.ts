import cron from 'node-cron';
import { prisma } from '../lib/prisma';

export const startDailyAggregationJob = () => {
    // Run every day at 00:01 GMT
    cron.schedule('1 0 * * *', async () => {
        try {
            console.log('Running daily aggregation job...');
            const now = new Date();
            // Yesterdays date in UTC
            const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));

            const startOfYesterday = new Date(yesterday.getTime());
            startOfYesterday.setUTCHours(0, 0, 0, 0);

            const endOfYesterday = new Date(yesterday.getTime());
            endOfYesterday.setUTCHours(23, 59, 59, 999);

            const readLogs = await prisma.readLog.groupBy({
                by: ['articleId'],
                _count: {
                    id: true,
                },
                where: {
                    createdAt: {
                        gte: startOfYesterday,
                        lte: endOfYesterday,
                    },
                },
            });

            for (const log of readLogs) {
                await prisma.dailyAnalytics.upsert({
                    where: {
                        articleId_date: {
                            articleId: log.articleId,
                            date: startOfYesterday,
                        }
                    },
                    update: {
                        views: { increment: log._count.id }
                    },
                    create: {
                        articleId: log.articleId,
                        date: startOfYesterday,
                        views: log._count.id,
                    }
                });
            }

            console.log('Daily aggregation completed successfully.');
        } catch (error) {
            console.error('Daily aggregation failed:', error);
        }
    }, {
        timezone: 'UTC'
    });
};
