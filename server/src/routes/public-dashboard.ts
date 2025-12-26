import { Router, Request, Response, NextFunction } from 'express';
import { clickhouseService } from '../services/clickhouse.service';

const router = Router();

// Публичный эндпоинт - БЕЗ авторизации
router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    // Проверяем валидность ссылки
    const { valid, share } = await clickhouseService.isPublicShareValid(token);
    if (!valid || !share) {
      return res.status(404).json({ error: 'Link not found or expired' });
    }

    const connectionId = share.connection_id;

    // Получаем данные подключения
    const connection = await clickhouseService.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Вычисляем даты
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Получаем иерархические данные (кампании)
    const hierarchicalStats = await clickhouseService.getHierarchicalStats(
      connectionId,
      startDate,
      endDate,
      undefined // без фильтра по целям
    );

    // Получаем дневную статистику для графика
    const dailyStats = await clickhouseService.getDailyStats(
      connectionId,
      startDate,
      endDate,
      undefined // без фильтра по целям
    );

    // Вычисляем суммарные метрики
    const totals = {
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      ctr: 0,
      cpc: 0,
      cpl: 0,
    };

    hierarchicalStats.forEach((campaign: any) => {
      totals.impressions += campaign.totalImpressions || 0;
      totals.clicks += campaign.totalClicks || 0;
      totals.cost += campaign.totalCost || 0;
      totals.conversions += campaign.totalConversions || 0;
    });

    if (totals.impressions > 0) {
      totals.ctr = (totals.clicks / totals.impressions) * 100;
    }
    if (totals.clicks > 0) {
      totals.cpc = totals.cost / totals.clicks;
    }
    if (totals.conversions > 0) {
      totals.cpl = totals.cost / totals.conversions;
    }

    // Формируем ответ (без чувствительных данных)
    res.json({
      shareName: share.name,
      accountLogin: connection.login,
      period: {
        startDate: startDateStr,
        endDate: endDateStr,
        days,
      },
      totals,
      campaigns: hierarchicalStats.map((c: any) => ({
        id: c.campaignId,
        name: c.campaignName,
        status: c.status,
        impressions: c.totalImpressions || 0,
        clicks: c.totalClicks || 0,
        cost: c.totalCost || 0,
        conversions: c.totalConversions || 0,
        ctr: c.avgCtr || 0,
        cpc: c.avgCpc || 0,
        cpl: (c.totalConversions || 0) > 0 ? (c.totalCost || 0) / c.totalConversions : 0,
      })),
      dailyStats: dailyStats.map((d: any) => ({
        date: d.date,
        impressions: d.impressions,
        clicks: d.clicks,
        cost: d.cost,
        conversions: d.conversions,
        ctr: d.ctr,
        cpc: d.cpc,
      })),
      lastUpdated: connection.lastSyncAt,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
