import { Router } from 'express';
import { articleController } from './article.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Public routes
router.get('/', articleController.getAll);

// Authenticated routes (Reader/Author can view, only Author can manage)
router.get('/:id', authenticate, articleController.getById);

router.post('/', authenticate, articleController.create);
router.put('/:id', authenticate, articleController.update);
router.delete('/:id', authenticate, articleController.delete);

export default router;
