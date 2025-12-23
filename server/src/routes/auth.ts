import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { createError } from '../middleware/errorHandler';

const router = Router();

// JWT Secret (fallback для production)
const JWT_SECRET = process.env.JWT_SECRET || 'neurodirectolog-secret-key-2024';

// Файловое хранилище пользователей
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');

// Загрузка пользователей из файла
function loadUsers(): any[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
  return [];
}

// Сохранение пользователей в файл
function saveUsers(users: any[]): void {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

// Инициализация с админским пользователем
let users = loadUsers();
if (users.length === 0) {
  // Создаем админа при первом запуске
  const adminPassword = bcrypt.hashSync('admin123', 10);
  users.push({
    id: 'admin-1',
    email: 'admin@neurodirectolog.ru',
    password: adminPassword,
    name: 'Администратор',
    isAdmin: true,
    createdAt: new Date()
  });
  saveUsers(users);
  console.log('✅ Admin user created: admin@neurodirectolog.ru / admin123');
}

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
    saveUsers(users);

    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
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
      JWT_SECRET,
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
