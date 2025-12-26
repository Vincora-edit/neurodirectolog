/**
 * Yandex Stats Routes
 * Статистика: агрегированная, по кампаниям, детальная, иерархическая, по дням
 */

import express from 'express';
import { clickhouseService } from '../../services/clickhouse.service';

const router = express.Router();

/**
 * GET /api/yandex/stats/:projectId
 * Получить агрегированную статистику для проекта
 */
router.get('/stats/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days = '30' } = req.query;

    const connection = await clickhouseService.getConnectionByProjectId(projectId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const stats = await clickhouseService.getAggregatedStats(
      connection.id,
      startDate,
      endDate
    );

    res.json(stats);
  } catch (error: any) {
    console.error('Failed to get stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/campaign-stats/:campaignId
 * Получить детальную статистику по кампании
 */
router.get('/campaign-stats/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { days = '30' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const stats = await clickhouseService.getCampaignStats(
      campaignId,
      startDate,
      endDate
    );

    res.json(stats);
  } catch (error: any) {
    console.error('Failed to get campaign stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/detailed-stats/:projectId
 * Получить детальную статистику с фильтром по целям
 * Поддерживает параметр connectionId для мультиаккаунтности
 */
router.get('/detailed-stats/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, goalId, goalIds, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

    let connection;
    if (connectionId) {
      connection = await clickhouseService.getConnectionById(connectionId as string);
    } else {
      connection = await clickhouseService.getConnectionByProjectId(projectId);
    }

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam as string);
      endDate = new Date(endDateParam as string);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt((days as string) || '30'));
    }

    // Поддержка множественных целей (goalIds через запятую) или одной цели (goalId)
    let goalIdsArray: string[] | undefined;
    if (goalIds) {
      goalIdsArray = (goalIds as string).split(',').map(id => id.trim()).filter(id => id);
    } else if (goalId) {
      goalIdsArray = [goalId as string];
    }

    const stats = await clickhouseService.getDetailedCampaignStats(
      connection.id,
      startDate,
      endDate,
      goalIdsArray
    );

    res.json(stats);
  } catch (error: any) {
    console.error('Failed to get detailed stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/hierarchical-stats/:projectId
 * Получить иерархическую статистику: Кампании → Группы → Объявления
 */
router.get('/hierarchical-stats/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, goalIds, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

    let connection;
    if (connectionId) {
      connection = await clickhouseService.getConnectionById(connectionId as string);
    } else {
      connection = await clickhouseService.getConnectionByProjectId(projectId);
    }

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam as string);
      endDate = new Date(endDateParam as string);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt((days as string) || '30'));
    }

    let goalIdsArray: string[] | undefined;
    if (goalIds) {
      goalIdsArray = (goalIds as string).split(',').map(id => id.trim()).filter(id => id);
    }

    const stats = await clickhouseService.getHierarchicalStats(
      connection.id,
      startDate,
      endDate,
      goalIdsArray
    );

    res.json(stats);
  } catch (error: any) {
    console.error('Failed to get hierarchical stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/daily-stats/:projectId
 * Получить статистику по дням для графиков и таблицы
 * Поддерживает фильтрацию по campaignId, adGroupId, adId
 */
router.get('/daily-stats/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, goalIds, startDate: startDateParam, endDate: endDateParam, connectionId, campaignId, adGroupId, adId } = req.query;

    let connection;
    if (connectionId) {
      connection = await clickhouseService.getConnectionById(connectionId as string);
    } else {
      connection = await clickhouseService.getConnectionByProjectId(projectId);
    }

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam as string);
      endDate = new Date(endDateParam as string);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt((days as string) || '30'));
    }

    let goalIdsArray: string[] | undefined;
    if (goalIds) {
      goalIdsArray = (goalIds as string).split(',').map(id => id.trim()).filter(id => id);
    }

    const stats = await clickhouseService.getDailyStats(
      connection.id,
      startDate,
      endDate,
      goalIdsArray,
      campaignId as string | undefined,
      adGroupId as string | undefined,
      adId as string | undefined
    );

    res.json(stats);
  } catch (error: any) {
    console.error('Failed to get daily stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
