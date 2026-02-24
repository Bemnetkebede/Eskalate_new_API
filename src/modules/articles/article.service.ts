import { prisma } from '../../lib/prisma.js';
import type { CreateArticleInput, UpdateArticleInput } from './article.validation.js';

export class ArticleService {
    async create(authorId: string, data: CreateArticleInput) {
        return prisma.article.create({
            data: {
                title: data.title,
                content: data.content,
                category: data.category || 'General',
                status: data.status || 'DRAFT',
                authorId,
            },
        });
    }

    async getAll(page: number = 1, limit: number = 10, filters: { category?: string, author?: string, q?: string } = {}) {
        const skip = (page - 1) * limit;

        const where: any = { status: 'PUBLISHED', deletedAt: null };

        if (filters.category) {
            where.category = filters.category;
        }

        if (filters.author) {
            where.author = {
                name: { contains: filters.author, mode: 'insensitive' }
            };
        }

        if (filters.q) {
            where.OR = [
                { title: { contains: filters.q, mode: 'insensitive' } },
                { content: { contains: filters.q, mode: 'insensitive' } }
            ];
        }

        const [articles, total] = await Promise.all([
            prisma.article.findMany({
                where,
                include: { author: { select: { name: true } } },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.article.count({ where }),
        ]);

        return { articles, total };
    }

    async getByAuthor(authorId: string, page: number = 1, limit: number = 10, includeDeleted: boolean = false) {
        const skip = (page - 1) * limit;

        const where: any = { authorId };
        if (!includeDeleted) {
            where.deletedAt = null;
        }

        const [articles, total] = await Promise.all([
            prisma.article.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.article.count({ where }),
        ]);

        return { articles, total };
    }

    async getById(id: string) {
        const article = await prisma.article.findFirst({
            where: { id, deletedAt: null },
            include: { author: { select: { name: true } } },
        });

        if (!article) {
            throw new Error('News article no longer available');
        }

        return article;
    }

    async update(id: string, authorId: string, data: UpdateArticleInput) {
        const article = await (prisma.article as any).findFirst({
            where: { id, deletedAt: null },
        });

        if (!article) {
            throw new Error('News article no longer available');
        }

        if (article.authorId !== authorId) {
            throw new Error('Unauthorized to update this article');
        }

        return prisma.article.update({
            where: { id },
            data: data as any,
        });
    }

    async getAuthorDashboard(authorId: string, page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const where = { authorId, deletedAt: null };

        const [articles, total] = await Promise.all([
            prisma.article.findMany({
                where,
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                    dailyAnalytics: {
                        select: {
                            views: true
                        }
                    }
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.article.count({ where }),
        ]);

        const formattedArticles = articles.map((article: any) => ({
            id: article.id,
            title: article.title,
            createdAt: article.createdAt,
            totalViews: article.dailyAnalytics.reduce((sum: number, record: any) => sum + record.views, 0)
        }));

        return { articles: formattedArticles, total };
    }

    async delete(id: string, authorId: string) {
        const article = await (prisma.article as any).findFirst({
            where: { id, deletedAt: null },
        });

        if (!article) {
            throw new Error('News article no longer available');
        }

        if (article.authorId !== authorId) {
            throw new Error('Unauthorized to delete this article');
        }

        return prisma.article.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}

export const articleService = new ArticleService();
