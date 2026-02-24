import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import articleRoutes from './modules/articles/articles.routes';
import { startDailyAggregationJob } from './jobs/dailyAggregation.job';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/articles', articleRoutes);

// Start cron jobs
startDailyAggregationJob();

export default app;
