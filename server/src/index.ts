import dotenv from 'dotenv';

// ВАЖНО: Загружаем переменные окружения ПЕРВЫМ делом
dotenv.config();

// Валидация критических переменных окружения
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ SECURITY ERROR: JWT_SECRET must be at least 32 characters');
  console.error('   Generate one with: openssl rand -base64 32');
  process.exit(1);
}
if (JWT_SECRET.includes('CHANGE_ME') || JWT_SECRET.includes('your-') || JWT_SECRET === 'test-secret-key-12345') {
  console.error('❌ SECURITY ERROR: JWT_SECRET contains a placeholder value');
  console.error('   Please set a secure random string in your .env file');
  process.exit(1);
}

// Graceful error handling - предотвращает падение сервера
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Даем время на логирование, потом перезапускаемся (Docker restart policy подхватит)
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

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
import adminRouter from './routes/admin';
import { startSyncJob } from './jobs/sync.job';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - нужно для работы за nginx (правильные IP в rate limiter)
app.set('trust proxy', 1);

// Health check - до всех middleware, чтобы работал без CORS
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Neurodirectolog API is running', timestamp: new Date().toISOString() });
});

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://91.222.239.217:8080',
  'https://dashboard.vincora.ru',
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
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 200, // Максимум 200 запросов в минуту
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({
  origin: function(origin, callback) {
    // Разрешаем запросы без origin (curl, cron jobs, внутренние вызовы)
    if (!origin) {
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
app.use('/api/admin', apiLimiter, adminRouter);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start the cron job for Yandex.Direct sync
  startSyncJob();
  console.log(`⏰ Yandex.Direct sync job started`);
});
