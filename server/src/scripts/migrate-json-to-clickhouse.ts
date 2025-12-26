/**
 * Скрипт миграции данных из JSON-файлов в ClickHouse
 *
 * Переносит:
 * - data/users.json -> таблица users
 * - data/projects.json -> таблица projects
 *
 * Запуск: npx ts-node src/scripts/migrate-json-to-clickhouse.ts
 */

import fs from 'fs';
import path from 'path';
import { clickhouseService } from '../services/clickhouse.service';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

async function migrateUsers(): Promise<number> {
  console.log('📦 Миграция пользователей...');

  if (!fs.existsSync(USERS_FILE)) {
    console.log('   ⚠️ Файл users.json не найден, пропускаем');
    return 0;
  }

  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  const users = JSON.parse(data);

  if (!Array.isArray(users) || users.length === 0) {
    console.log('   ⚠️ Нет пользователей для миграции');
    return 0;
  }

  let migrated = 0;
  for (const user of users) {
    try {
      // Проверяем, существует ли пользователь
      const existing = await clickhouseService.getUserById(user.id);
      if (existing) {
        console.log(`   ⏭️  Пользователь ${user.email} уже существует, пропускаем`);
        continue;
      }

      await clickhouseService.createUser({
        id: user.id,
        email: user.email,
        passwordHash: user.password, // В JSON хранится уже хешированный пароль
        name: user.name,
        isAdmin: user.isAdmin || false,
      });

      console.log(`   ✅ Мигрирован: ${user.email}`);
      migrated++;
    } catch (error) {
      console.error(`   ❌ Ошибка миграции ${user.email}:`, error);
    }
  }

  return migrated;
}

async function migrateProjects(): Promise<number> {
  console.log('📦 Миграция проектов...');

  if (!fs.existsSync(PROJECTS_FILE)) {
    console.log('   ⚠️ Файл projects.json не найден, пропускаем');
    return 0;
  }

  const data = fs.readFileSync(PROJECTS_FILE, 'utf-8');
  const projectsObj = JSON.parse(data);

  // projects.json хранит объект { id: project, ... }, а не массив
  const projects = Object.values(projectsObj) as any[];

  if (projects.length === 0) {
    console.log('   ⚠️ Нет проектов для миграции');
    return 0;
  }

  let migrated = 0;
  for (const project of projects) {
    try {
      // Проверяем, существует ли проект
      const existing = await clickhouseService.getProjectById(project.id);
      if (existing) {
        console.log(`   ⏭️  Проект ${project.name} уже существует, пропускаем`);
        continue;
      }

      // Создаём проект
      await clickhouseService.createProject({
        id: project.id,
        userId: project.userId,
        name: project.name,
        brief: project.brief || {},
      });

      // Обновляем с остальными данными если есть
      const updates: any = {};
      if (project.semantics) updates.semantics = project.semantics;
      if (project.creatives) updates.creatives = project.creatives;
      if (project.ads) updates.ads = project.ads;
      if (project.completeAds) updates.completeAds = project.completeAds;
      if (project.minusWords) updates.minusWords = project.minusWords;
      if (project.keywordAnalysis) updates.keywordAnalysis = project.keywordAnalysis;
      if (project.campaigns) updates.campaigns = project.campaigns;
      if (project.strategy) updates.strategy = project.strategy;
      if (project.analytics) updates.analytics = project.analytics;

      if (Object.keys(updates).length > 0) {
        await clickhouseService.updateProject(project.id, updates);
      }

      console.log(`   ✅ Мигрирован: ${project.name}`);
      migrated++;
    } catch (error) {
      console.error(`   ❌ Ошибка миграции ${project.name}:`, error);
    }
  }

  return migrated;
}

async function backupJsonFiles(): Promise<void> {
  console.log('💾 Создание бэкапов JSON-файлов...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (fs.existsSync(USERS_FILE)) {
    const backupPath = USERS_FILE.replace('.json', `.backup-${timestamp}.json`);
    fs.copyFileSync(USERS_FILE, backupPath);
    console.log(`   ✅ Бэкап users.json: ${backupPath}`);
  }

  if (fs.existsSync(PROJECTS_FILE)) {
    const backupPath = PROJECTS_FILE.replace('.json', `.backup-${timestamp}.json`);
    fs.copyFileSync(PROJECTS_FILE, backupPath);
    console.log(`   ✅ Бэкап projects.json: ${backupPath}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('    Миграция JSON → ClickHouse');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Проверяем соединение с ClickHouse
    console.log('🔌 Проверка соединения с ClickHouse...');
    const isConnected = await clickhouseService.ping();
    if (!isConnected) {
      throw new Error('Не удалось подключиться к ClickHouse');
    }
    console.log('   ✅ ClickHouse доступен');
    console.log('');

    // Инициализируем таблицы
    console.log('🏗️  Инициализация таблиц...');
    await clickhouseService.initializeUserProjectsTables();
    console.log('   ✅ Таблицы готовы');
    console.log('');

    // Создаём бэкапы
    await backupJsonFiles();
    console.log('');

    // Мигрируем данные
    const usersMigrated = await migrateUsers();
    console.log('');

    const projectsMigrated = await migrateProjects();
    console.log('');

    // Итоги
    console.log('═══════════════════════════════════════════════════════════');
    console.log('    Миграция завершена!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Пользователей мигрировано: ${usersMigrated}`);
    console.log(`   Проектов мигрировано: ${projectsMigrated}`);
    console.log('');
    console.log('   ⚠️  JSON-файлы сохранены как бэкап, но больше не используются.');
    console.log('   ⚠️  После проверки работоспособности можно удалить data/*.json');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  }
}

main();
