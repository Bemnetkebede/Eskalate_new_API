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
            const page = parseInt(String(req.query.page)) || 1;
            const limit = parseInt(String(req.query.limit)) || 10;

            const category = req.query.category as string;
            const author = req.query.author as string;
            const q = req.query.q as string;

            const { articles, total } = await articleService.getAll(page, limit, { category, author, q });
            return res.status(200).json(ResponseProvider.paginated(articles, total, page, limit));
        } catch (error: any) {
            return res.status(400).json(ResponseProvider.error(null, error.message));
        }
    };

    public getMe: RequestHandler = async (req: AuthRequest, res: Response): Promise<any> => {
        try {
            const page = parseInt(String(req.query.page)) || 1;
            const limit = parseInt(String(req.query.limit)) || 10;
            const includeDeleted = req.query.includeDeleted === 'true';

            const { articles, total } = await articleService.getByAuthor(req.user!.id, page, limit, includeDeleted);
            return res.status(200).json(ResponseProvider.paginated(articles, total, page, limit));
        } catch (error: any) {
            return res.status(400).json(ResponseProvider.error(null, error.message));
        }
    };

    public getById: RequestHandler = async (req: AuthRequest, res: Response): Promise<any> => {
        try {
            const id = req.params.id as string;
            const article = await articleService.getById(id);

            // FIRE AND FORGET
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
            const id = req.params.id as string;
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

    public getDashboard: RequestHandler = async (req: AuthRequest, res: Response): Promise<any> => {
        try {
            const page = parseInt(String(req.query.page)) || 1;
            const limit = parseInt(String(req.query.limit)) || 10;

            const { articles, total } = await articleService.getAuthorDashboard(req.user!.id, page, limit);
            return res.status(200).json(ResponseProvider.paginated(articles, total, page, limit));
        } catch (error: any) {
            return res.status(400).json(ResponseProvider.error(null, error.message));
        }
    };

    public delete: RequestHandler = async (req: AuthRequest, res: Response): Promise<any> => {
        try {
            const id = req.params.id as string;
            await articleService.delete(id, req.user!.id);
            return res.status(200).json(ResponseProvider.success(null, 'Article deleted successfully'));
        } catch (error: any) {
            return res.status(400).json(ResponseProvider.error(null, error.message));
        }
    };
}

export const articleController = new ArticleController();
