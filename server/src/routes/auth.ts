import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { createError } from '../middleware/errorHandler';
import { clickhouseService } from '../services/clickhouse.service';

const router = Router();

// JWT Secret - ОБЯЗАТЕЛЬНАЯ переменная окружения
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set');
}

// Инициализация: создаем таблицы и админа при первом запуске
async function initializeAuth() {
  try {
    // Создаем таблицы если не существуют
    await clickhouseService.initializeUserProjectsTables();

    // Проверяем, есть ли пользователи
    const userCount = await clickhouseService.countUsers();
    if (userCount === 0) {
      // Создаем админа при первом запуске
      const adminPassword = await bcrypt.hash('admin123', 10);
      await clickhouseService.createUser({
        id: 'admin-1',
        email: 'admin@neurodirectolog.ru',
        passwordHash: adminPassword,
        name: 'Администратор',
        isAdmin: true,
      });
      console.log('✅ Admin user created: admin@neurodirectolog.ru / admin123');
    }
  } catch (error) {
    console.error('Error initializing auth:', error);
  }
}

// Запускаем инициализацию асинхронно
initializeAuth();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
  name: Joi.string().min(2).max(100).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

/**
 * Регистрация нового пользователя
 */
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { email, password, name } = value;

    // Проверяем существование пользователя
    const existingUser = await clickhouseService.getUserByEmail(email);
    if (existingUser) {
      throw createError('User already exists', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString();

    await clickhouseService.createUser({
      id: userId,
      email,
      passwordHash: hashedPassword,
      name,
      isAdmin: false,
    });

    const token = jwt.sign(
      { userId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: userId,
          email,
          name,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Вход пользователя
 */
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { email, password } = value;

    const user = await clickhouseService.getUserByEmail(email);
    if (!user) {
      throw createError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw createError('Invalid credentials', 401);
    }

    const token = jwt.sign(
      { userId: user.id, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
