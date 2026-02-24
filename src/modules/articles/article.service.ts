import { prisma } from '../../lib/prisma.js';
import type { CreateArticleInput, UpdateArticleInput } from './article.validation.js';

export class ArticleService {
    async create(authorId: string, data: CreateArticleInput) {
        return prisma.article.create({
            data: {
                title: data.title,
                content: data.content,
                status: data.status || 'DRAFT',
                authorId,
            },
        });
    }

    async getAll(page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const [articles, total] = await Promise.all([
            prisma.article.findMany({
                where: { deletedAt: null, status: 'PUBLISHED' },
                include: { author: { select: { name: true } } },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.article.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
        ]);

        return { articles, total };
    }

    async getById(id: string) {
        const article = await prisma.article.findFirst({
            where: { id, deletedAt: null },
            include: { author: { select: { name: true } } },
        });

        if (!article) {
            throw new Error('Article not found');
        }

        return article;
    }

    async update(id: string, authorId: string, data: UpdateArticleInput) {
        const article = await this.getById(id);

        if (article.authorId !== authorId) {
            throw new Error('Unauthorized to update this article');
        }

        // Cast to any to bypass strict Prisma Partial mismatch in this environment
        return prisma.article.update({
            where: { id },
            data: data as any,
        });
    }

    async delete(id: string, authorId: string) {
        const article = await this.getById(id);

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
