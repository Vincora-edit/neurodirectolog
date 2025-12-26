/**
 * Yandex Sync Routes
 * Синхронизация данных
 */

import express from 'express';
import { clickhouseService } from '../../services/clickhouse.service';
import { runManualSync } from '../../jobs/sync.job';
import { syncService } from '../../services/sync.service';

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

    // Запускаем синхронизацию асинхронно
    runManualSync(connection.id).catch(err => {
      console.error('Manual sync failed:', err);
    });

    res.json({ success: true, message: 'Sync started' });
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
    // Запускаем синхронизацию асинхронно
    syncService.syncAllConnections().catch(err => {
      console.error('Sync all failed:', err);
    });

    res.json({ success: true, message: 'Sync all started' });
  } catch (error: any) {
    console.error('Failed to start sync all:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
