import { Router } from 'express';
import { createArticle, getArticles, getArticleById, updateArticle, deleteArticle } from './articles.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/', authenticate, createArticle);
router.get('/', getArticles);
router.get('/:id', getArticleById);
router.put('/:id', authenticate, updateArticle);
router.delete('/:id', authenticate, deleteArticle);

export default router;
