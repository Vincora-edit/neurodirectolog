import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from './errorHandler';
import { usageService } from '../services/usage.service';
import { clickhouseService } from '../services/clickhouse.service';
import { redisService } from '../services/redis.service';

// JWT Secret - ОБЯЗАТЕЛЬНАЯ переменная окружения
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set');
}

async function getUserIsAdmin(userId: string): Promise<boolean> {
  // Пробуем получить из Redis кеша
  const cached = await redisService.userCache.get(userId) as { isAdmin: boolean } | null;
  if (cached !== null) {
    return cached.isAdmin;
  }

  try {
    const user = await clickhouseService.getUserById(userId);
    const isAdmin = user?.isAdmin || false;

    // Кешируем в Redis на 60 секунд
    await redisService.userCache.set(userId, { isAdmin }, 60);

    return isAdmin;
  } catch (error) {
    console.error('Error checking user admin status:', error);
    return false;
  }
}

export interface AuthRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw createError('Authentication required', 401);
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; isAdmin?: boolean };
    req.userId = decoded.userId;
    // Проверяем isAdmin из токена, а если нет - читаем из ClickHouse (с кешем)
    req.isAdmin = decoded.isAdmin ?? await getUserIsAdmin(decoded.userId);

    // Трекинг API запроса
    try {
      usageService.trackApiRequest(decoded.userId);
    } catch (e) {
      // Не прерываем запрос из-за ошибки трекинга
      console.error('Usage tracking error:', e);
    }

    next();
  } catch (error) {
    next(createError('Invalid or expired token', 401));
  }
};
