import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createError } from '../middleware/errorHandler';

const router = Router();

// Временное хранилище пользователей (замените на БД)
const users: any[] = [];

/**
 * Регистрация нового пользователя
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      throw createError('Email, password and name are required', 400);
    }

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      throw createError('User already exists', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      name,
      createdAt: new Date()
    };

    users.push(user);

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      }
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
    const { email, password } = req.body;

    if (!email || !password) {
      throw createError('Email and password are required', 400);
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      throw createError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw createError('Invalid credentials', 401);
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
