/**
 * Redis Service
 * Обеспечивает:
 * - Кеширование данных (снижение нагрузки на ClickHouse)
 * - Distributed locks (предотвращение race conditions при синхронизации)
 * - Session storage (готовность к масштабированию)
 */

import Redis from 'ioredis';

// Конфигурация Redis
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0');

// TTL по умолчанию (в секундах)
const DEFAULT_TTL = 300; // 5 минут
const LOCK_TTL = 30000; // 30 секунд для locks (в миллисекундах)

// Флаг для graceful degradation (если Redis недоступен)
let isRedisAvailable = false;

// Создаём клиент Redis
const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  retryStrategy: (times) => {
    if (times > 3) {
      console.warn('⚠️ Redis недоступен, работаем без кеша');
      isRedisAvailable = false;
      return null; // Прекращаем попытки
    }
    return Math.min(times * 200, 2000);
  },
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  lazyConnect: true,
});

// Обработчики событий
redis.on('connect', () => {
  console.log('✅ Redis подключен');
  isRedisAvailable = true;
});

redis.on('error', (err) => {
  if (isRedisAvailable) {
    console.error('❌ Redis ошибка:', err.message);
    isRedisAvailable = false;
  }
});

redis.on('close', () => {
  isRedisAvailable = false;
});

// Префиксы ключей
const CACHE_PREFIX = 'cache:';
const LOCK_PREFIX = 'lock:';
const SESSION_PREFIX = 'session:';

export const redisService = {
  /**
   * Проверка доступности Redis
   */
  isAvailable(): boolean {
    return isRedisAvailable;
  },

  /**
   * Инициализация подключения
   */
  async connect(): Promise<boolean> {
    try {
      await redis.connect();
      return true;
    } catch (error) {
      console.warn('⚠️ Redis недоступен, работаем без кеша');
      return false;
    }
  },

  /**
   * Закрытие соединения
   */
  async disconnect(): Promise<void> {
    if (isRedisAvailable) {
      await redis.quit();
    }
  },

  // ===========================================
  // Кеширование
  // ===========================================

  /**
   * Получить значение из кеша
   */
  async get<T>(key: string): Promise<T | null> {
    if (!isRedisAvailable) return null;

    try {
      const value = await redis.get(CACHE_PREFIX + key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  },

  /**
   * Сохранить значение в кеш
   */
  async set(key: string, value: any, ttlSeconds: number = DEFAULT_TTL): Promise<boolean> {
    if (!isRedisAvailable) return false;

    try {
      await redis.setex(CACHE_PREFIX + key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  },

  /**
   * Удалить значение из кеша
   */
  async del(key: string): Promise<boolean> {
    if (!isRedisAvailable) return false;

    try {
      await redis.del(CACHE_PREFIX + key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  },

  /**
   * Удалить все ключи по паттерну
   */
  async delByPattern(pattern: string): Promise<number> {
    if (!isRedisAvailable) return 0;

    try {
      const keys = await redis.keys(CACHE_PREFIX + pattern);
      if (keys.length === 0) return 0;
      return await redis.del(...keys);
    } catch (error) {
      console.error('Redis delByPattern error:', error);
      return 0;
    }
  },

  /**
   * Получить или установить (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = DEFAULT_TTL
  ): Promise<T> {
    // Пробуем получить из кеша
    const cached = await this.get(key) as T | null;
    if (cached !== null) {
      return cached;
    }

    // Если нет в кеше - вызываем функцию и кешируем
    const value = await fetchFn();
    await this.set(key, value, ttlSeconds);
    return value;
  },

  // ===========================================
  // Distributed Locks
  // ===========================================

  /**
   * Получить блокировку
   * Используется для предотвращения одновременной синхронизации одного аккаунта
   */
  async acquireLock(
    resource: string,
    ttlMs: number = LOCK_TTL
  ): Promise<string | null> {
    if (!isRedisAvailable) {
      // Без Redis возвращаем временный ID (single-instance mode)
      return `local-${Date.now()}`;
    }

    try {
      const lockId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const key = LOCK_PREFIX + resource;

      // SET key value NX PX ttl - атомарная операция
      const result = await redis.set(key, lockId, 'PX', ttlMs, 'NX');

      if (result === 'OK') {
        return lockId;
      }
      return null; // Блокировка уже существует
    } catch (error) {
      console.error('Redis acquireLock error:', error);
      return null;
    }
  },

  /**
   * Освободить блокировку
   */
  async releaseLock(resource: string, lockId: string): Promise<boolean> {
    if (!isRedisAvailable) return true;

    try {
      const key = LOCK_PREFIX + resource;

      // Lua скрипт для атомарного удаления только своей блокировки
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await redis.eval(script, 1, key, lockId);
      return result === 1;
    } catch (error) {
      console.error('Redis releaseLock error:', error);
      return false;
    }
  },

  /**
   * Выполнить функцию под блокировкой
   */
  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    options: { ttlMs?: number; waitMs?: number; retries?: number } = {}
  ): Promise<T | null> {
    const { ttlMs = LOCK_TTL, waitMs = 1000, retries = 3 } = options;

    let lockId: string | null = null;
    let attempts = 0;

    // Пытаемся получить блокировку
    while (attempts < retries) {
      lockId = await this.acquireLock(resource, ttlMs);
      if (lockId) break;

      attempts++;
      if (attempts < retries) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }

    if (!lockId) {
      console.warn(`Не удалось получить блокировку для: ${resource}`);
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(resource, lockId);
    }
  },

  // ===========================================
  // Специфичные методы для приложения
  // ===========================================

  /**
   * Кеш для пользователя
   */
  userCache: {
    async get(userId: string) {
      return redisService.get(`user:${userId}`);
    },
    async set(userId: string, data: any, ttl = 60) {
      return redisService.set(`user:${userId}`, data, ttl);
    },
    async invalidate(userId: string) {
      return redisService.del(`user:${userId}`);
    },
  },

  /**
   * Кеш для проектов
   */
  projectCache: {
    async get(projectId: string) {
      return redisService.get(`project:${projectId}`);
    },
    async set(projectId: string, data: any, ttl = 300) {
      return redisService.set(`project:${projectId}`, data, ttl);
    },
    async invalidate(projectId: string) {
      return redisService.del(`project:${projectId}`);
    },
    async invalidateUserProjects(userId: string) {
      return redisService.delByPattern(`project:*:user:${userId}`);
    },
  },

  /**
   * Кеш для статистики Yandex
   */
  yandexCache: {
    async getStats(connectionId: string, dateKey: string) {
      return redisService.get(`yandex:stats:${connectionId}:${dateKey}`);
    },
    async setStats(connectionId: string, dateKey: string, data: any, ttl = 600) {
      return redisService.set(`yandex:stats:${connectionId}:${dateKey}`, data, ttl);
    },
    async invalidateConnection(connectionId: string) {
      return redisService.delByPattern(`yandex:*:${connectionId}:*`);
    },
  },

  /**
   * Lock для синхронизации Yandex
   */
  yandexSync: {
    async lock(connectionId: string, ttlMs = 300000) { // 5 минут для синхронизации
      return redisService.acquireLock(`sync:yandex:${connectionId}`, ttlMs);
    },
    async unlock(connectionId: string, lockId: string) {
      return redisService.releaseLock(`sync:yandex:${connectionId}`, lockId);
    },
    async withLock<T>(connectionId: string, fn: () => Promise<T>) {
      return redisService.withLock(`sync:yandex:${connectionId}`, fn, {
        ttlMs: 300000,
        waitMs: 5000,
        retries: 1, // Не ждём, если уже идёт синхронизация
      });
    },
  },

  /**
   * Rate limiting
   */
  rateLimit: {
    async check(key: string, limit: number, windowSeconds: number): Promise<boolean> {
      if (!isRedisAvailable) return true; // Без Redis пропускаем

      try {
        const fullKey = `ratelimit:${key}`;
        const current = await redis.incr(fullKey);

        if (current === 1) {
          await redis.expire(fullKey, windowSeconds);
        }

        return current <= limit;
      } catch (error) {
        console.error('Redis rateLimit error:', error);
        return true; // В случае ошибки пропускаем
      }
    },
  },
};

// Экспортируем для использования в других модулях
export default redisService;
