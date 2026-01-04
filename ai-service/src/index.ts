/**
 * AI Microservice for Neurodirectolog
 *
 * This service handles all AI-powered analysis:
 * - Search query analysis
 * - Campaign analysis
 * - Competitor analysis
 * - AI recommendations
 *
 * Deployed on Amsterdam server (outside Russia) to access OpenAI API
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import queryAnalysisRoutes from './routes/query-analysis';
import campaignAnalysisRoutes from './routes/campaign-analysis';
import competitorAnalysisRoutes from './routes/competitor-analysis';
import recommendationsRoutes from './routes/recommendations';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://dashboard.vincora.ru'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-service',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API routes - all require authentication
app.use('/api/ai/queries', authMiddleware, queryAnalysisRoutes);
app.use('/api/ai/campaigns', authMiddleware, campaignAnalysisRoutes);
app.use('/api/ai/competitors', authMiddleware, competitorAnalysisRoutes);
app.use('/api/ai/recommendations', authMiddleware, recommendationsRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[AI Service Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`[AI Service] Running on port ${PORT}`);
  console.log(`[AI Service] OpenAI configured: ${!!process.env.OPENAI_API_KEY}`);
});
