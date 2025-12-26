/**
 * Sync Worker - обработчик задач синхронизации Яндекс.Директ
 *
 * Этот worker обрабатывает задачи из Bull Queue и выполняет синхронизацию данных.
 * Запускается автоматически при старте сервера.
 */

import { Job } from 'bull';
import { queueService, SyncJobData, SyncJobResult } from '../services/queue.service';
import { syncService } from '../services/sync.service';
import { redisService } from '../services/redis.service';

// Конфигурация worker
const CONCURRENCY = parseInt(process.env.SYNC_WORKER_CONCURRENCY || '2'); // Макс 2 одновременных синхронизации

/**
 * Инициализация worker
 */
export function initSyncWorker(): void {
  const queue = queueService.getSyncQueue();

  console.log(`[SyncWorker] Initializing with concurrency: ${CONCURRENCY}`);

  // Регистрируем обработчик задач
  queue.process(CONCURRENCY, async (job: Job<SyncJobData>): Promise<SyncJobResult> => {
    const { connectionId, userId, triggeredBy } = job.data;
    const startTime = Date.now();

    console.log(`[SyncWorker] Processing job ${job.id} for connection ${connectionId}`);
    console.log(`[SyncWorker] Triggered by: ${triggeredBy}, User: ${userId}, Attempt: ${job.attemptsMade + 1}`);

    try {
      // Обновляем прогресс
      await job.progress(10);

      // Пытаемся получить lock через Redis
      const lockId = await redisService.yandexSync.lock(connectionId, 600000); // 10 минут
      if (!lockId) {
        console.warn(`[SyncWorker] Connection ${connectionId} is already being synced`);
        return {
          success: false,
          connectionId,
          error: 'Sync already in progress for this connection',
          duration: Date.now() - startTime,
        };
      }

      try {
        await job.progress(20);

        // Выполняем синхронизацию
        await syncService.syncConnection(connectionId);

        await job.progress(100);

        const duration = Date.now() - startTime;
        console.log(`[SyncWorker] Job ${job.id} completed successfully in ${duration}ms`);

        return {
          success: true,
          connectionId,
          duration,
        };
      } finally {
        // Освобождаем lock
        await redisService.yandexSync.unlock(connectionId, lockId);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[SyncWorker] Job ${job.id} failed after ${duration}ms:`, error.message);

      // Определяем, стоит ли повторять
      const isRetryable = isRetryableError(error);

      if (!isRetryable && job.attemptsMade < (job.opts.attempts || 3) - 1) {
        // Для неповторяемых ошибок - не пытаемся снова
        throw new Error(`Non-retryable error: ${error.message}`);
      }

      throw error; // Bull автоматически повторит если есть попытки
    }
  });

  console.log('[SyncWorker] Worker initialized and listening for jobs');
}

/**
 * Определяем, стоит ли повторять при ошибке
 */
function isRetryableError(error: any): boolean {
  const message = error.message?.toLowerCase() || '';

  // Не повторяем при:
  // - Невалидный токен (нужна реавторизация)
  // - Аккаунт заблокирован
  // - Нет прав доступа
  const nonRetryable = [
    'invalid_token',
    'token expired',
    'unauthorized',
    'forbidden',
    'access denied',
    'account blocked',
    'account suspended',
    'please reconnect',
  ];

  for (const keyword of nonRetryable) {
    if (message.includes(keyword)) {
      return false;
    }
  }

  // Повторяем при:
  // - Сетевые ошибки
  // - Rate limiting
  // - Временные ошибки API
  const retryable = [
    'network',
    'timeout',
    'rate limit',
    'too many requests',
    'service unavailable',
    '503',
    '502',
    'econnreset',
    'enotfound',
    'socket hang up',
  ];

  for (const keyword of retryable) {
    if (message.includes(keyword)) {
      return true;
    }
  }

  // По умолчанию - повторяем
  return true;
}

/**
 * Запуск периодической синхронизации всех подключений
 */
export function startScheduledSync(intervalMinutes: number = 60): NodeJS.Timeout {
  console.log(`[SyncWorker] Starting scheduled sync every ${intervalMinutes} minutes`);

  const intervalMs = intervalMinutes * 60 * 1000;

  // Первый запуск через 5 минут после старта (дать серверу прогреться)
  setTimeout(async () => {
    await triggerScheduledSync();
  }, 5 * 60 * 1000);

  // Затем по расписанию
  return setInterval(async () => {
    await triggerScheduledSync();
  }, intervalMs);
}

/**
 * Триггер синхронизации по расписанию
 */
async function triggerScheduledSync(): Promise<void> {
  console.log('[SyncWorker] Running scheduled sync for all connections');

  try {
    // Импортируем здесь чтобы избежать циклических зависимостей
    const { clickhouseService } = await import('../services/clickhouse.service');

    const connections = await clickhouseService.getAllActiveConnections();

    if (!connections || connections.length === 0) {
      console.log('[SyncWorker] No active connections to sync');
      return;
    }

    console.log(`[SyncWorker] Found ${connections.length} active connections`);

    const added = await queueService.addBulkSyncJobs(
      connections.map(c => ({ id: c.id, userId: c.userId })),
      { triggeredBy: 'schedule' }
    );

    console.log(`[SyncWorker] Added ${added} sync jobs to queue`);
  } catch (error) {
    console.error('[SyncWorker] Failed to trigger scheduled sync:', error);
  }
}

export default { initSyncWorker, startScheduledSync };
