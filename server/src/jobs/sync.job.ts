import cron from 'node-cron';
import { syncService } from '../services/sync.service';

/**
 * Cron job для автоматической синхронизации данных из Яндекс.Директ и Метрики
 * Запускается каждые 30 минут
 */
export function startSyncJob() {
  // Запуск каждые 30 минут
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Cron] Starting scheduled sync job');
    try {
      await syncService.syncAllConnections();
      console.log('[Cron] Scheduled sync completed successfully');
    } catch (error) {
      console.error('[Cron] Scheduled sync failed:', error);
    }
  });

  console.log('[Cron] Sync job scheduled to run every 30 minutes');
}

/**
 * Запуск одноразовой синхронизации вручную
 */
export async function runManualSync(connectionId: string) {
  console.log(`[Manual Sync] Starting manual sync for connection ${connectionId}`);
  try {
    await syncService.syncConnection(connectionId);
    console.log(`[Manual Sync] Completed successfully for connection ${connectionId}`);
  } catch (error) {
    console.error(`[Manual Sync] Failed for connection ${connectionId}:`, error);
    throw error;
  }
}
