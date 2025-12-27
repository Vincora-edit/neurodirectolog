import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { createError } from '../middleware/errorHandler';
import { clickhouseService } from '../services/clickhouse.service';
import { emailService } from '../services/email.service';

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
    await clickhouseService.initializePublicSharesTable();

    // Проверяем, есть ли пользователи
    const userCount = await clickhouseService.countUsers();
    if (userCount === 0) {
      // Создаем админа при первом запуске
      // Пароль берём из переменной окружения или генерируем случайный
      const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD ||
        require('crypto').randomBytes(16).toString('hex');
      const adminPassword = await bcrypt.hash(defaultPassword, 10);
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@neurodirectolog.ru';

      await clickhouseService.createUser({
        id: 'admin-1',
        email: adminEmail,
        passwordHash: adminPassword,
        name: 'Администратор',
        isAdmin: true,
      });

      // Сразу верифицируем админа
      await clickhouseService.verifyUser('admin-1');

      // Выводим пароль только если он был сгенерирован (не из env)
      if (!process.env.ADMIN_DEFAULT_PASSWORD) {
        console.log(`✅ Admin user created: ${adminEmail}`);
        console.log(`   Generated password: ${defaultPassword}`);
        console.log('   ⚠️  Please change this password immediately!');
      } else {
        console.log(`✅ Admin user created: ${adminEmail}`);
      }
    }

    // Тест SMTP если настроен
    if (process.env.SMTP_USER) {
      emailService.testConnection();
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

const verifyEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required(),
});

const resendCodeSchema = Joi.object({
  email: Joi.string().email().required(),
});

/**
 * Регистрация нового пользователя
 * Создает неверифицированного пользователя и отправляет код на почту
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
      // Если пользователь существует но не верифицирован, можно перерегистрироваться
      if (!existingUser.isVerified) {
        // Генерируем и отправляем новый код
        const code = emailService.generateCode();
        await clickhouseService.createVerificationCode(email, code, 'registration');

        const sent = await emailService.sendVerificationCode(email, code);
        if (!sent) {
          throw createError('Failed to send verification email', 500);
        }

        return res.status(200).json({
          success: true,
          message: 'Verification code sent to email',
          requiresVerification: true,
        });
      }
      throw createError('User already exists', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString();

    // Создаем неверифицированного пользователя
    await clickhouseService.createUser({
      id: userId,
      email,
      passwordHash: hashedPassword,
      name,
      isAdmin: false,
    });

    // Генерируем и отправляем код верификации
    const code = emailService.generateCode();
    await clickhouseService.createVerificationCode(email, code, 'registration');

    const sent = await emailService.sendVerificationCode(email, code);
    if (!sent) {
      throw createError('Failed to send verification email', 500);
    }

    res.status(201).json({
      success: true,
      message: 'Verification code sent to email',
      requiresVerification: true,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Подтверждение email по коду
 */
router.post('/verify-email', async (req, res, next) => {
  try {
    const { error, value } = verifyEmailSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { email, code } = value;

    // Проверяем код
    const verificationCode = await clickhouseService.getValidVerificationCode(email, code);
    if (!verificationCode) {
      throw createError('Invalid or expired verification code', 400);
    }

    // Проверяем количество попыток
    if (verificationCode.attempts >= 5) {
      throw createError('Too many attempts. Please request a new code.', 400);
    }

    // Получаем пользователя
    const user = await clickhouseService.getUserByEmail(email);
    if (!user) {
      throw createError('User not found', 404);
    }

    // Помечаем код как использованный
    await clickhouseService.markVerificationCodeUsed(verificationCode.id);

    // Верифицируем пользователя
    await clickhouseService.verifyUser(user.id);

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Email verified successfully',
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

/**
 * Повторная отправка кода верификации
 */
router.post('/resend-code', async (req, res, next) => {
  try {
    const { error, value } = resendCodeSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { email } = value;

    // Проверяем существование пользователя
    const user = await clickhouseService.getUserByEmail(email);
    if (!user) {
      // Не раскрываем существование пользователя
      return res.json({
        success: true,
        message: 'If the email exists, a verification code has been sent',
      });
    }

    if (user.isVerified) {
      throw createError('Email is already verified', 400);
    }

    // Проверяем, не слишком ли часто запрашивают код
    const lastCode = await clickhouseService.getLatestVerificationCode(email);
    if (lastCode) {
      const createdAt = new Date(lastCode.created_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

      if (diffMinutes < 1) {
        throw createError('Please wait before requesting a new code', 429);
      }
    }

    // Генерируем и отправляем новый код
    const code = emailService.generateCode();
    await clickhouseService.createVerificationCode(email, code, 'registration');

    const sent = await emailService.sendVerificationCode(email, code);
    if (!sent) {
      throw createError('Failed to send verification email', 500);
    }

    res.json({
      success: true,
      message: 'Verification code sent to email',
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

    // Проверяем верификацию
    if (!user.isVerified) {
      // Отправляем новый код верификации
      const code = emailService.generateCode();
      await clickhouseService.createVerificationCode(email, code, 'registration');
      await emailService.sendVerificationCode(email, code);

      return res.status(403).json({
        success: false,
        message: 'Email not verified. Verification code sent.',
        requiresVerification: true,
        email: user.email,
      });
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
