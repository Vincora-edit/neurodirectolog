import dotenv from 'dotenv';

// ВАЖНО: Загружаем переменные окружения ПЕРВЫМ делом
dotenv.config();

import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import semanticsRouter from './routes/semantics';
import campaignRouter from './routes/campaign';
import creativesRouter from './routes/creatives';
import adsRouter from './routes/ads';
import strategyRouter from './routes/strategy';
import minusWordsRouter from './routes/minusWords';
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import analyticsRouter from './routes/analytics';
import keywordsRouter from './routes/keywords';
import yandexRouter from './routes/yandex';
import { startSyncJob } from './jobs/sync.job';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://91.222.239.217:8080',
  'http://91.222.239.217',
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Разрешаем запросы без origin (например, curl, postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Временно разрешаем все для отладки
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/keywords', keywordsRouter);
app.use('/api/semantics', semanticsRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/creatives', creativesRouter);
app.use('/api/ads', adsRouter);
app.use('/api/strategy', strategyRouter);
app.use('/api/minus-words', minusWordsRouter);
app.use('/api/yandex', yandexRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Neurodirectolog API is running' });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start the cron job for Yandex.Direct sync
  startSyncJob();
  console.log(`⏰ Yandex.Direct sync job started`);
});
