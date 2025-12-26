/**
 * Queue Service - Bull Queue для фоновых задач
 *
 * Возможности:
 * - Асинхронная синхронизация аккаунтов Яндекс.Директ
 * - Retry при ошибках с exponential backoff
 * - Мониторинг статуса задач
 * - Ограничение concurrent jobs
 */

import Bull, { Job, Queue } from 'bull';

// Конфигурация Redis для Bull
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

// Типы задач
export interface SyncJobData {
  connectionId: string;
  userId: string;
  priority?: 'high' | 'normal' | 'low';
  triggeredBy?: 'manual' | 'schedule' | 'webhook';
}

export interface SyncJobResult {
  success: boolean;
  connectionId: string;
  campaignsCount?: number;
  recordsCount?: number;
  error?: string;
  duration?: number;
}

// Статусы задач для UI
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface JobStatus {
  id: string;
  connectionId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  attempts: number;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
  error?: string;
  result?: SyncJobResult;
}

// Флаг доступности очереди
let isQueueAvailable = false;
let queueReadyPromise: Promise<void>;

// Создаём очередь для синхронизации
const syncQueue: Queue<SyncJobData> = new Bull<SyncJobData>('yandex-sync', {
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 секунд базовая задержка
    },
    removeOnComplete: 100, // Храним последние 100 успешных
    removeOnFail: 50, // Храним последние 50 неудачных
  },
  settings: {
    stalledInterval: 60000, // Проверка зависших задач каждую минуту
    maxStalledCount: 2, // После 2 зависаний - fail
  },
});

// Promise для ожидания готовности очереди
queueReadyPromise = new Promise((resolve) => {
  // Таймаут на случай если Redis не отвечает
  const timeout = setTimeout(() => {
    if (!isQueueAvailable) {
      console.warn('⚠️ Bull Queue: таймаут подключения');
      resolve();
    }
  }, 5000);

  syncQueue.once('ready', () => {
    clearTimeout(timeout);
    resolve();
  });

  syncQueue.once('error', () => {
    clearTimeout(timeout);
    resolve(); // Резолвим чтобы не блокировать запуск
  });
});

// Обработчики событий очереди
syncQueue.on('ready', () => {
  console.log('✅ Bull Queue подключена');
  isQueueAvailable = true;
});

syncQueue.on('error', (error) => {
  console.error('❌ Bull Queue ошибка:', error.message);
  isQueueAvailable = false;
});

syncQueue.on('stalled', (job) => {
  console.warn(`⚠️ Job ${job.id} stalled (connectionId: ${job.data.connectionId})`);
});

// Логирование для отладки
syncQueue.on('active', (job) => {
  console.log(`[Queue] Job ${job.id} started for connection ${job.data.connectionId}`);
});

syncQueue.on('completed', (job, result) => {
  console.log(`[Queue] Job ${job.id} completed for connection ${job.data.connectionId}`);
  if (result) {
    console.log(`[Queue] Result: ${result.recordsCount || 0} records synced in ${result.duration || 0}ms`);
  }
});

syncQueue.on('failed', (job, error) => {
  console.error(`[Queue] Job ${job.id} failed for connection ${job.data.connectionId}:`, error.message);
});

export const queueService = {
  /**
   * Проверка доступности очереди
   */
  isAvailable(): boolean {
    return isQueueAvailable;
  },

  /**
   * Ожидание готовности очереди
   */
  async waitForReady(): Promise<boolean> {
    await queueReadyPromise;
    return isQueueAvailable;
  },

  /**
   * Получить экземпляр очереди для регистрации worker
   */
  getSyncQueue(): Queue<SyncJobData> {
    return syncQueue;
  },

  /**
   * Добавить задачу синхронизации в очередь
   */
  async addSyncJob(
    connectionId: string,
    userId: string,
    options: {
      priority?: 'high' | 'normal' | 'low';
      triggeredBy?: 'manual' | 'schedule' | 'webhook';
      delay?: number; // Задержка в мс
    } = {}
  ): Promise<Job<SyncJobData> | null> {
    if (!isQueueAvailable) {
      console.warn('[Queue] Queue not available, sync will be executed directly');
      return null;
    }

    const { priority = 'normal', triggeredBy = 'manual', delay } = options;

    // Приоритеты Bull: 1 - высокий, 10 - низкий
    const priorityMap = {
      high: 1,
      normal: 5,
      low: 10,
    };

    try {
      const job = await syncQueue.add(
        {
          connectionId,
          userId,
          priority,
          triggeredBy,
        },
        {
          priority: priorityMap[priority],
          delay,
          jobId: `sync-${connectionId}-${Date.now()}`, // Уникальный ID
        }
      );

      console.log(`[Queue] Added sync job ${job.id} for connection ${connectionId}`);
      return job;
    } catch (error) {
      console.error('[Queue] Failed to add sync job:', error);
      return null;
    }
  },

  /**
   * Добавить задачи для всех подключений (по расписанию)
   */
  async addBulkSyncJobs(
    connections: Array<{ id: string; userId: string }>,
    options: { triggeredBy?: 'schedule' | 'manual' } = {}
  ): Promise<number> {
    if (!isQueueAvailable) {
      console.warn('[Queue] Queue not available for bulk sync');
      return 0;
    }

    const { triggeredBy = 'schedule' } = options;
    let added = 0;

    // Добавляем с небольшой задержкой между задачами чтобы не перегружать API
    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i];
      const job = await this.addSyncJob(conn.id, conn.userId, {
        priority: 'normal',
        triggeredBy,
        delay: i * 10000, // 10 секунд между задачами
      });
      if (job) added++;
    }

    console.log(`[Queue] Added ${added} bulk sync jobs`);
    return added;
  },

  /**
   * Получить статистику очереди
   */
  async getQueueStats(): Promise<QueueStats> {
    if (!isQueueAvailable) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        syncQueue.getWaitingCount(),
        syncQueue.getActiveCount(),
        syncQueue.getCompletedCount(),
        syncQueue.getFailedCount(),
        syncQueue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      console.error('[Queue] Failed to get stats:', error);
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }
  },

  /**
   * Получить статус конкретной задачи
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    if (!isQueueAvailable) return null;

    try {
      const job = await syncQueue.getJob(jobId);
      if (!job) return null;

      const state = await job.getState();

      return {
        id: String(job.id),
        connectionId: job.data.connectionId,
        status: state as JobStatus['status'],
        progress: job.progress() as number,
        attempts: job.attemptsMade,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        error: job.failedReason,
        result: job.returnvalue as SyncJobResult | undefined,
      };
    } catch (error) {
      console.error('[Queue] Failed to get job status:', error);
      return null;
    }
  },

  /**
   * Получить список активных и ожидающих задач
   */
  async getPendingJobs(connectionId?: string): Promise<JobStatus[]> {
    if (!isQueueAvailable) return [];

    try {
      const [waiting, active, delayed] = await Promise.all([
        syncQueue.getWaiting(0, 50),
        syncQueue.getActive(0, 10),
        syncQueue.getDelayed(0, 50),
      ]);

      const allJobs = [...waiting, ...active, ...delayed];

      const jobs: JobStatus[] = await Promise.all(
        allJobs
          .filter(job => !connectionId || job.data.connectionId === connectionId)
          .map(async (job) => {
            const state = await job.getState();
            return {
              id: String(job.id),
              connectionId: job.data.connectionId,
              status: state as JobStatus['status'],
              progress: job.progress() as number,
              attempts: job.attemptsMade,
              createdAt: new Date(job.timestamp),
              processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
              finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
              error: job.failedReason,
              result: job.returnvalue as SyncJobResult | undefined,
            };
          })
      );

      return jobs;
    } catch (error) {
      console.error('[Queue] Failed to get pending jobs:', error);
      return [];
    }
  },

  /**
   * Отменить задачу
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!isQueueAvailable) return false;

    try {
      const job = await syncQueue.getJob(jobId);
      if (!job) return false;

      await job.remove();
      console.log(`[Queue] Job ${jobId} cancelled`);
      return true;
    } catch (error) {
      console.error('[Queue] Failed to cancel job:', error);
      return false;
    }
  },

  /**
   * Повторить неудавшуюся задачу
   */
  async retryJob(jobId: string): Promise<boolean> {
    if (!isQueueAvailable) return false;

    try {
      const job = await syncQueue.getJob(jobId);
      if (!job) return false;

      await job.retry();
      console.log(`[Queue] Job ${jobId} retried`);
      return true;
    } catch (error) {
      console.error('[Queue] Failed to retry job:', error);
      return false;
    }
  },

  /**
   * Очистить завершённые/неудавшиеся задачи
   */
  async cleanOldJobs(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    if (!isQueueAvailable) return;

    try {
      await syncQueue.clean(olderThanMs, 'completed');
      await syncQueue.clean(olderThanMs, 'failed');
      console.log(`[Queue] Cleaned jobs older than ${olderThanMs}ms`);
    } catch (error) {
      console.error('[Queue] Failed to clean old jobs:', error);
    }
  },

  /**
   * Приостановить очередь
   */
  async pause(): Promise<void> {
    if (!isQueueAvailable) return;
    await syncQueue.pause();
    console.log('[Queue] Queue paused');
  },

  /**
   * Возобновить очередь
   */
  async resume(): Promise<void> {
    if (!isQueueAvailable) return;
    await syncQueue.resume();
    console.log('[Queue] Queue resumed');
  },

  /**
   * Закрыть соединение
   */
  async close(): Promise<void> {
    await syncQueue.close();
    isQueueAvailable = false;
    console.log('[Queue] Queue closed');
  },
};

export default queueService;
