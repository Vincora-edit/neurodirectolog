/**
 * Sync Worker - обработчик задач синхронизации Яндекс.Директ
 *
 * Этот worker обрабатывает задачи из Bull Queue и выполняет синхронизацию данных.
 * Запускается автоматически при старте сервера.
 */

import { Job } from 'bull';
import cron from 'node-cron';
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
        // Выполняем синхронизацию с callback для обновления прогресса
        await syncService.syncConnection(connectionId, async (progress, stage) => {
          await job.progress(progress);
          // Сохраняем stage в data для отображения на клиенте
          if (stage) {
            await job.update({ ...job.data, currentStage: stage });
          }
        });

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
 * Запуск синхронизации по расписанию (cron)
 * Синхронизация 3 раза в день:
 * - 06:00 - свежие данные за вчера к утру
 * - 12:00 - проверка кампаний в середине дня
 * - 18:00 - промежуточные результаты за день
 */
export function startScheduledSync(): void {
  console.log('[SyncWorker] Setting up scheduled sync at 06:00, 12:00, 18:00 (Moscow time)');

  // Синхронизация в 6:00, 12:00 и 18:00 по московскому времени
  // Сервер работает в UTC, поэтому: 06:00 MSK = 03:00 UTC, 12:00 MSK = 09:00 UTC, 18:00 MSK = 15:00 UTC
  cron.schedule('0 3,9,15 * * *', async () => {
    console.log(`[SyncWorker] Scheduled sync triggered at ${new Date().toISOString()}`);
    await triggerScheduledSync();
  });

  console.log('[SyncWorker] Cron jobs scheduled: 03:00, 09:00, 15:00 UTC (06:00, 12:00, 18:00 MSK)');
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
