import { Router } from 'express';
import { articleController } from './article.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// /author/dashboard
router.get('/dashboard', authenticate, articleController.getDashboard);

export default router;
