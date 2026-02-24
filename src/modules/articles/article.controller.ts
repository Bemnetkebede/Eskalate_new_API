import { articleService } from './article.service.js';
import { createArticleSchema, updateArticleSchema } from './article.validation.js';
import { ResponseProvider } from '../../core/utils/response.js';
import { analyticsEmitter } from '../../core/analytics.emitter.js';
import { ZodError } from 'zod';
import type { Request, Response, RequestHandler } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware.js';

export class ArticleController {
    public create: RequestHandler = async (req: AuthRequest, res: Response): Promise<any> => {
        try {
            const validatedData = createArticleSchema.parse(req.body);
            const article = await articleService.create(req.user!.id, validatedData);
            return res.status(201).json(ResponseProvider.success(article, 'Article created successfully'));
        } catch (error: any) {
            if (error instanceof ZodError) {
                return res.status(400).json(ResponseProvider.error(error.issues, 'Validation error'));
            }
            return res.status(400).json(ResponseProvider.error(null, error.message));
        }
    };

    public getAll: RequestHandler = async (req: Request, res: Response): Promise<any> => {
        try {
            const pageStr = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
            const limitStr = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;

            const page = parseInt(String(pageStr)) || 1;
            const limit = parseInt(String(limitStr)) || 10;

            const { articles, total } = await articleService.getAll(page, limit);
            return res.status(200).json(ResponseProvider.paginated(articles, total, page, limit));
        } catch (error: any) {
            return res.status(400).json(ResponseProvider.error(null, error.message));
        }
    };

    public getById: RequestHandler = async (req: AuthRequest, res: Response): Promise<any> => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) throw new Error('Article ID is required');

            const article = await articleService.getById(id);

            // FIRE AND FORGET (The "Senior" Difference: Story 5)
            analyticsEmitter.emit('trackRead', {
                articleId: id,
                userId: req.user?.id,
                ipAddress: req.ip || 'unknown',
            });

            return res.status(200).json(ResponseProvider.success(article));
        } catch (error: any) {
            return res.status(404).json(ResponseProvider.error(null, error.message));
        }
    };

    public update: RequestHandler = async (req: AuthRequest, res: Response): Promise<any> => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) throw new Error('Article ID is required');

            const validatedData = updateArticleSchema.parse(req.body);
            const article = await articleService.update(id, req.user!.id, validatedData);
            return res.status(200).json(ResponseProvider.success(article, 'Article updated successfully'));
        } catch (error: any) {
            if (error instanceof ZodError) {
                return res.status(400).json(ResponseProvider.error(error.issues, 'Validation error'));
            }
            return res.status(400).json(ResponseProvider.error(null, error.message));
        }
    };

    public delete: RequestHandler = async (req: AuthRequest, res: Response): Promise<any> => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) throw new Error('Article ID is required');

            await articleService.delete(id, req.user!.id);
            return res.status(200).json(ResponseProvider.success(null, 'Article deleted successfully'));
        } catch (error: any) {
            return res.status(400).json(ResponseProvider.error(null, error.message));
        }
    };
}

export const articleController = new ArticleController();
