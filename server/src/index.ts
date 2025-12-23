import dotenv from 'dotenv';

// ВАЖНО: Загружаем переменные окружения ПЕРВЫМ делом
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
  process.env.CORS_ORIGIN,
  process.env.PRODUCTION_URL
].filter(Boolean);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting для защиты от brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // Максимум 5 попыток
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // Максимум 100 запросов
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({
  origin: function(origin, callback) {
    // Разрешаем запросы без origin только в development (например, curl, postman)
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/projects', apiLimiter, projectsRouter);
app.use('/api/analytics', apiLimiter, analyticsRouter);
app.use('/api/keywords', apiLimiter, keywordsRouter);
app.use('/api/semantics', apiLimiter, semanticsRouter);
app.use('/api/campaigns', apiLimiter, campaignRouter);
app.use('/api/creatives', apiLimiter, creativesRouter);
app.use('/api/ads', apiLimiter, adsRouter);
app.use('/api/strategy', apiLimiter, strategyRouter);
app.use('/api/minus-words', apiLimiter, minusWordsRouter);
app.use('/api/yandex', apiLimiter, yandexRouter);

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
