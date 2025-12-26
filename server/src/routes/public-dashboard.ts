import { Router, Request, Response, NextFunction } from 'express';
import { clickhouseService } from '../services/clickhouse.service';

const router = Router();

// Публичный эндпоинт - БЕЗ авторизации
router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const customStartDate = req.query.startDate as string | undefined;
    const customEndDate = req.query.endDate as string | undefined;

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

    // Получаем KPI для текущего месяца
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const kpi = await clickhouseService.getAccountKpi(connectionId, month);
    const kpiGoalIds = kpi?.goalIds && kpi.goalIds.length > 0 ? kpi.goalIds : undefined;
    const monthStats = await clickhouseService.getMonthStats(connectionId, kpiGoalIds);

    // Рассчитываем прогресс KPI
    let costProgress = 0;
    let costDayProgress = 0;
    let leadsProgress = 0;
    let leadsDayProgress = 0;
    let cplStatus: 'good' | 'warning' | 'bad' = 'good';

    if (kpi) {
      costProgress = kpi.targetCost > 0 ? (monthStats.currentCost / kpi.targetCost) * 100 : 0;
      const expectedCostToday = kpi.targetCost * monthStats.dayProgress;
      costDayProgress = expectedCostToday > 0 ? (monthStats.currentCost / expectedCostToday) * 100 : 0;

      leadsProgress = kpi.targetLeads > 0 ? (monthStats.currentLeads / kpi.targetLeads) * 100 : 0;
      const expectedLeadsToday = kpi.targetLeads * monthStats.dayProgress;
      leadsDayProgress = expectedLeadsToday > 0 ? (monthStats.currentLeads / expectedLeadsToday) * 100 : 0;

      if (kpi.targetCpl > 0 && monthStats.currentCpl > 0) {
        const cplRatio = monthStats.currentCpl / kpi.targetCpl;
        if (cplRatio <= 1) cplStatus = 'good';
        else if (cplRatio <= 1.2) cplStatus = 'warning';
        else cplStatus = 'bad';
      }
    }

    // Вычисляем даты
    let startDate: Date;
    let endDate: Date;

    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

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
      kpi: kpi ? {
        targetCost: kpi.targetCost,
        targetCpl: kpi.targetCpl,
        targetLeads: kpi.targetLeads,
      } : null,
      kpiStats: {
        currentCost: monthStats.currentCost,
        currentLeads: monthStats.currentLeads,
        currentCpl: monthStats.currentCpl,
        dayProgress: monthStats.dayProgress,
        daysInMonth: monthStats.daysInMonth,
        currentDay: monthStats.currentDay,
      },
      kpiProgress: {
        costProgress: Math.min(costProgress, 150),
        costDayProgress: Math.min(costDayProgress, 150),
        leadsProgress: Math.min(leadsProgress, 150),
        leadsDayProgress: Math.min(leadsDayProgress, 150),
        cplStatus,
      },
      month,
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
        bounceRate: c.avgBounceRate || null,
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
