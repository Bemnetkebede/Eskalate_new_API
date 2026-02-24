import { prisma } from '../../lib/prisma';
import { CreateArticleInput, UpdateArticleInput, GetArticlesQuery } from './articles.validation';

export class ArticleService {
    async create(data: CreateArticleInput, authorId: string) {
        return prisma.article.create({
            data: {
                ...data,
                authorId,
            },
        });
    }

    async getAll(query: GetArticlesQuery) {
        const { page, limit, authorId, search } = query;
        const skip = (page - 1) * limit;

        const where: any = { deletedAt: null }; // Ensure we do not fetch deleted articles
        if (authorId) where.authorId = authorId;
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
            ];
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

        return { articles, total, page, limit };
    }

    async getById(id: string) {
        const article = await prisma.article.findUnique({
            where: { id },
        });
        if (!article || article.deletedAt) throw new Error('Article not found');
        return article;
    }

    async update(id: string, data: UpdateArticleInput, authorId: string, role: string) {
        const article = await this.getById(id);
        if (article.authorId !== authorId && role !== 'ADMIN') {
            throw new Error('Forbidden');
        }
        return prisma.article.update({
            where: { id },
            data,
        });
    }

    async delete(id: string, authorId: string, role: string) {
        const article = await this.getById(id);
        if (article.authorId !== authorId && role !== 'ADMIN') {
            throw new Error('Forbidden');
        }
        return prisma.article.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}

export const articleService = new ArticleService();
