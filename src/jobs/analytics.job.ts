import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';

export const startAnalyticsJob = () => {
    // Run every night at midnight (GMT)
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ Running Daily Analytics Aggregation...');

        // (The "Senior" Difference: Story 6)
        // Use .setUTCHours(0,0,0,0) to define the specific "Date" for the table.
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);

        try {
            // Find all reads from yesterday
            const reads = await prisma.readLog.groupBy({
                by: ['articleId'],
                _count: {
                    id: true,
                },
                where: {
                    createdAt: {
                        gte: yesterday,
                        lt: today,
                    },
                },
            });

            // Upsert into DailyAnalytics
            for (const read of reads) {
                await prisma.dailyAnalytics.upsert({
                    where: {
                        articleId_date: {
                            articleId: read.articleId,
                            date: yesterday,
                        },
                    },
                    update: {
                        views: read._count.id,
                    },
                    create: {
                        articleId: read.articleId,
                        date: yesterday,
                        views: read._count.id,
                    },
                });
            }

            console.log(`✅ Aggregated ${reads.length} articles for ${yesterday.toISOString().split('T')[0]}`);
        } catch (error) {
            console.error('❌ Analytics aggregation failed:', error);
        }
    });
};
