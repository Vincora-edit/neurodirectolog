import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { createError } from './errorHandler';
import { usageService } from '../services/usage.service';

// JWT Secret - ОБЯЗАТЕЛЬНАЯ переменная окружения
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set');
}

// Файл пользователей для проверки isAdmin
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');

function getUserIsAdmin(userId: string): boolean {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const users = JSON.parse(data);
      const user = users.find((u: any) => u.id === userId);
      return user?.isAdmin || false;
    }
  } catch (error) {
    console.error('Error checking user admin status:', error);
  }
  return false;
}

export interface AuthRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw createError('Authentication required', 401);
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; isAdmin?: boolean };
    req.userId = decoded.userId;
    // Проверяем isAdmin из токена, а если нет - читаем из файла
    req.isAdmin = decoded.isAdmin ?? getUserIsAdmin(decoded.userId);

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
