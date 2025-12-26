/**
 * Yandex Sync Routes
 * Синхронизация данных через Bull Queue
 */

import express from 'express';
import { clickhouseService } from '../../services/clickhouse.service';
import { runManualSync } from '../../jobs/sync.job';
import { syncService } from '../../services/sync.service';
import { queueService } from '../../services/queue.service';

const router = express.Router();

/**
 * POST /api/yandex/sync/:projectId
 * Запустить синхронизацию вручную
 */
router.post('/sync/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const connection = await clickhouseService.getConnectionByProjectId(projectId);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Если очередь доступна - используем её
    if (queueService.isAvailable()) {
      const job = await queueService.addSyncJob(connection.id, connection.userId, {
        priority: 'high',
        triggeredBy: 'manual',
      });

      if (job) {
        return res.json({
          success: true,
          message: 'Sync job added to queue',
          jobId: String(job.id),
          queuePosition: await queueService.getQueueStats().then(s => s.waiting),
        });
      }
    }

    // Fallback: запускаем синхронизацию напрямую
    runManualSync(connection.id).catch(err => {
      console.error('Manual sync failed:', err);
    });

    res.json({ success: true, message: 'Sync started (direct)' });
  } catch (error: any) {
    console.error('Failed to start sync:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/yandex/sync-all
 * Запустить синхронизацию всех подключений вручную
 */
router.post('/sync-all', async (_req, res) => {
  try {
    // Если очередь доступна - используем bulk добавление
    if (queueService.isAvailable()) {
      const connections = await clickhouseService.getAllActiveConnections();

      if (!connections || connections.length === 0) {
        return res.json({ success: true, message: 'No active connections to sync', count: 0 });
      }

      const added = await queueService.addBulkSyncJobs(
        connections.map(c => ({ id: c.id, userId: c.userId })),
        { triggeredBy: 'manual' }
      );

      return res.json({
        success: true,
        message: `Added ${added} sync jobs to queue`,
        count: added,
      });
    }

    // Fallback: запускаем синхронизацию напрямую
    syncService.syncAllConnections().catch(err => {
      console.error('Sync all failed:', err);
    });

    res.json({ success: true, message: 'Sync all started (direct)' });
  } catch (error: any) {
    console.error('Failed to start sync all:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/sync/queue/stats
 * Получить статистику очереди
 */
router.get('/queue/stats', async (_req, res) => {
  try {
    if (!queueService.isAvailable()) {
      return res.json({
        available: false,
        stats: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
      });
    }

    const stats = await queueService.getQueueStats();

    res.json({
      available: true,
      stats,
    });
  } catch (error: any) {
    console.error('Failed to get queue stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/sync/queue/jobs
 * Получить список задач в очереди
 */
router.get('/queue/jobs', async (req, res) => {
  try {
    const { connectionId } = req.query;

    if (!queueService.isAvailable()) {
      return res.json({ available: false, jobs: [] });
    }

    const jobs = await queueService.getPendingJobs(connectionId as string | undefined);

    res.json({
      available: true,
      jobs,
    });
  } catch (error: any) {
    console.error('Failed to get queue jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/sync/queue/job/:jobId
 * Получить статус конкретной задачи
 */
router.get('/queue/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!queueService.isAvailable()) {
      return res.status(503).json({ error: 'Queue not available' });
    }

    const status = await queueService.getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(status);
  } catch (error: any) {
    console.error('Failed to get job status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/yandex/sync/queue/job/:jobId
 * Отменить задачу
 */
router.delete('/queue/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!queueService.isAvailable()) {
      return res.status(503).json({ error: 'Queue not available' });
    }

    const cancelled = await queueService.cancelJob(jobId);

    if (!cancelled) {
      return res.status(404).json({ error: 'Job not found or cannot be cancelled' });
    }

    res.json({ success: true, message: 'Job cancelled' });
  } catch (error: any) {
    console.error('Failed to cancel job:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/yandex/sync/queue/job/:jobId/retry
 * Повторить неудавшуюся задачу
 */
router.post('/queue/job/:jobId/retry', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!queueService.isAvailable()) {
      return res.status(503).json({ error: 'Queue not available' });
    }

    const retried = await queueService.retryJob(jobId);

    if (!retried) {
      return res.status(404).json({ error: 'Job not found or cannot be retried' });
    }

    res.json({ success: true, message: 'Job retried' });
  } catch (error: any) {
    console.error('Failed to retry job:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
