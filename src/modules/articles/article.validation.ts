import { z } from 'zod';
import { Status } from '@prisma/client';

export const createArticleSchema = z.object({
    title: z.string().min(1, 'Title is required').max(150, 'Title too long'),
    content: z.string().min(50, 'Content must be at least 50 characters'),
    category: z.string().optional(),
    status: z.nativeEnum(Status).optional(),
});

export const updateArticleSchema = createArticleSchema.partial();

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
