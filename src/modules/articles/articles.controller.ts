import { Request, Response } from 'express';
import { articleService } from './articles.service';
import { createArticleSchema, updateArticleSchema, getArticlesQuerySchema } from './articles.validation';
import { BaseResponse, PaginatedResponse } from '../../core/utils/response';
import { ZodError } from 'zod';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { analyticsEmitter } from '../analytics/analytics.events';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_news_api_key_2026';

export const createArticle = async (req: AuthRequest, res: Response) => {
    try {
        const data = createArticleSchema.parse(req.body);
        const result = await articleService.create(data, req.user!.id);
        const response: BaseResponse<typeof result> = {
            success: true,
            message: 'Article created successfully',
            data: result,
        };
        res.status(201).json(response);
    } catch (error: any) {
        let message = error.message;
        if (error instanceof ZodError) message = error.errors.map(e => e.message).join(', ');
        res.status(400).json({ success: false, error: message });
    }
};

export const getArticles = async (req: Request, res: Response) => {
    try {
        const query = getArticlesQuerySchema.parse(req.query);
        const { articles, total, page, limit } = await articleService.getAll(query);
        const response: PaginatedResponse<typeof articles[0]> = {
            success: true,
            data: articles,
            meta: { total, page, limit },
        };
        res.status(200).json(response);
    } catch (error: any) {
        let message = error.message;
        if (error instanceof ZodError) message = error.errors.map(e => e.message).join(', ');
        res.status(400).json({ success: false, error: message });
    }
};

export const getArticleById = async (req: Request, res: Response) => {
    try {
        const result = await articleService.getById(req.params.id);
        const response: BaseResponse<typeof result> = { success: true, data: result };

        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        let userId: string | undefined;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const payload = jwt.verify(token, JWT_SECRET) as { id: string };
                userId = payload.id;
            } catch (e) { }
        }

        analyticsEmitter.emit('article:read', { articleId: result.id, userId, ipAddress });

        res.status(200).json(response);
    } catch (error: any) {
        res.status(404).json({ success: false, error: error.message });
    }
};

export const updateArticle = async (req: AuthRequest, res: Response) => {
    try {
        const data = updateArticleSchema.parse(req.body);
        const result = await articleService.update(req.params.id, data, req.user!.id, req.user!.role);
        const response: BaseResponse<typeof result> = {
            success: true,
            message: 'Article updated successfully',
            data: result,
        };
        res.status(200).json(response);
    } catch (error: any) {
        let message = error.message;
        let status = 400;
        if (error instanceof ZodError) message = error.errors.map(e => e.message).join(', ');
        if (message === 'Forbidden') status = 403;
        if (message === 'Article not found') status = 404;
        res.status(status).json({ success: false, error: message });
    }
};

export const deleteArticle = async (req: AuthRequest, res: Response) => {
    try {
        await articleService.delete(req.params.id, req.user!.id, req.user!.role);
        const response: BaseResponse = { success: true, message: 'Article deleted successfully' };
        res.status(200).json(response);
    } catch (error: any) {
        let status = 400;
        if (error.message === 'Forbidden') status = 403;
        if (error.message === 'Article not found') status = 404;
        res.status(status).json({ success: false, error: error.message });
    }
};
