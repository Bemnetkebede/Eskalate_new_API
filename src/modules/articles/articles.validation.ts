import { z } from 'zod';

export const createArticleSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Content is required'),
});

export const updateArticleSchema = z.object({
    title: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
});

export const getArticlesQuerySchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
    authorId: z.string().optional(),
    search: z.string().optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type GetArticlesQuery = z.infer<typeof getArticlesQuerySchema>;
