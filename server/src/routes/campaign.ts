import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { yandexDirectService } from '../services/yandex.service';
import { excelService } from '../services/excel.service';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * Создание рекламной кампании
 */
router.post('/create', authenticate, async (req, res, next) => {
  try {
    const { campaignData } = req.body;

    if (!campaignData) {
      throw createError('Campaign data is required', 400);
    }

    const result = await yandexDirectService.createCampaign(campaignData);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Получение списка кампаний
 */
router.get('/list', authenticate, async (_req, res, next) => {
  try {
    const campaigns = await yandexDirectService.getCampaigns();

    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Экспорт кампании в Excel/CSV
 */
router.post('/export', authenticate, async (req, res, next) => {
  try {
    const { campaignData, format = 'xlsx' } = req.body;

    if (!campaignData) {
      throw createError('Campaign data is required', 400);
    }

    let filePath: string;
    if (format === 'csv') {
      filePath = await excelService.exportCampaignToCSV(campaignData);
    } else {
      filePath = await excelService.exportCampaignToExcel(campaignData);
    }

    res.json({
      success: true,
      data: {
        filePath,
        format,
        message: `Campaign exported to ${format.toUpperCase()} successfully`
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Получение статистики кампании
 */
router.get('/stats/:campaignId', authenticate, async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const { dateFrom, dateTo } = req.query;

    if (!dateFrom || !dateTo) {
      throw createError('Date range is required', 400);
    }

    const stats = await yandexDirectService.getCampaignStats(
      parseInt(campaignId),
      dateFrom as string,
      dateTo as string
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export default router;
