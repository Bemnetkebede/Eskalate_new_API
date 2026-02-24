import app from './app.js';
import { env } from './core/config/env.js';
import { startAnalyticsJob } from './jobs/analytics.job.js';

const port = env.PORT;

app.listen(port, () => {
    console.log(`🚀 News API server running on port ${port}`);
    startAnalyticsJob();
});
