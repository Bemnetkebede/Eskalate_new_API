import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes.js';
import articleRoutes from './modules/articles/article.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/articles', articleRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

export default app;
