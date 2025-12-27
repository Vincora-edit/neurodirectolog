import { Router, Request, Response, NextFunction } from 'express';
import { clickhouseService } from '../services/clickhouse.service';
import { yandexDirectService } from '../services/yandex-direct.service';

const router = Router();

// Публичный эндпоинт - БЕЗ авторизации
router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const customStartDate = req.query.startDate as string | undefined;
    const customEndDate = req.query.endDate as string | undefined;

    // Парсим goalIds из query параметра
    let selectedGoalIds: string[] | undefined;
    const goalIdsParam = req.query.goalIds as string | undefined;
    if (goalIdsParam) {
      selectedGoalIds = goalIdsParam.split(',').filter(id => id.trim());
    }

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

    // Получаем валюту аккаунта
    let currency = 'RUB';
    try {
      const balance = await yandexDirectService.getAccountBalance(
        connection.accessToken,
        connection.login
      );
      if (balance?.currency) {
        currency = balance.currency;
      }
    } catch (e) {
      console.log('[PublicDashboard] Could not get currency, using RUB');
    }

    // Получаем доступные цели для селектора
    const availableGoals = await clickhouseService.getAvailableGoals(connectionId);

    // Получаем KPI для текущего месяца
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const kpi = await clickhouseService.getAccountKpi(connectionId, month);
    const kpiGoalIds = kpi?.goalIds && kpi.goalIds.length > 0 ? kpi.goalIds : undefined;
    const monthStats = await clickhouseService.getMonthStats(connectionId, kpiGoalIds);

    // Получаем статистику за последние 7 дней для расчёта среднего
    const last7DaysEnd = new Date();
    const last7DaysStart = new Date();
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);

    const last7DaysStats = await clickhouseService.getDailyStats(
      connectionId,
      last7DaysStart,
      last7DaysEnd,
      kpiGoalIds
    );

    // Рассчитываем средние показатели за 7 дней
    const avgDailyCost = last7DaysStats.length > 0
      ? last7DaysStats.reduce((sum: number, d: any) => sum + (d.cost || 0), 0) / last7DaysStats.length
      : 0;
    const avgDailyLeads = last7DaysStats.length > 0
      ? last7DaysStats.reduce((sum: number, d: any) => sum + (d.conversions || 0), 0) / last7DaysStats.length
      : 0;
    const avgDailyCpl = avgDailyLeads > 0 ? avgDailyCost / avgDailyLeads : 0;

    // Рассчитываем прогресс KPI
    let costProgress = 0;
    let costDayProgress = 0;
    let leadsProgress = 0;
    let leadsDayProgress = 0;
    let cplStatus: 'good' | 'warning' | 'bad' = 'good';

    // Аналитика и рекомендации
    let kpiAnalysis: {
      cost: {
        avgDaily7d: number;
        projectedMonthly: number;
        remainingDays: number;
        remainingBudget: number;
        requiredDailyBudget: number;
        trend: 'on_track' | 'overspending' | 'underspending';
        recommendation: string | null;
      };
      leads: {
        avgDaily7d: number;
        projectedMonthly: number;
        remainingLeads: number;
        requiredDailyLeads: number;
        trend: 'on_track' | 'behind' | 'ahead';
        recommendation: string | null;
      };
      cpl: {
        current: number;
        target: number;
        avgDaily7d: number;
        trend: 'good' | 'warning' | 'bad';
        recommendation: string | null;
      };
      diagnosis: string | null;
    } | null = null;

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

      // Расширенная аналитика
      const remainingDays = monthStats.daysInMonth - monthStats.currentDay;
      const remainingBudget = Math.max(0, kpi.targetCost - monthStats.currentCost);
      const requiredDailyBudget = remainingDays > 0 ? remainingBudget / remainingDays : 0;
      const projectedMonthlyCost = monthStats.currentCost + (avgDailyCost * remainingDays);

      const remainingLeads = Math.max(0, kpi.targetLeads - monthStats.currentLeads);
      const requiredDailyLeads = remainingDays > 0 ? remainingLeads / remainingDays : 0;
      const projectedMonthlyLeads = monthStats.currentLeads + (avgDailyLeads * remainingDays);

      // Определяем тренды
      let costTrend: 'on_track' | 'overspending' | 'underspending' = 'on_track';
      let costRecommendation: string | null = null;

      if (kpi.targetCost > 0) {
        const costDeviation = (avgDailyCost - requiredDailyBudget) / requiredDailyBudget;
        if (costDeviation > 0.15) {
          costTrend = 'overspending';
          const weeklyReduction = Math.round((avgDailyCost - requiredDailyBudget) * 7);
          costRecommendation = `Перерасход. Снизьте расход на ~${weeklyReduction.toLocaleString('ru-RU')} ₽/нед`;
        } else if (costDeviation < -0.15) {
          costTrend = 'underspending';
          const weeklyIncrease = Math.round((requiredDailyBudget - avgDailyCost) * 7);
          costRecommendation = `Недорасход. Увеличьте бюджет на ~${weeklyIncrease.toLocaleString('ru-RU')} ₽/нед`;
        }
      }

      let leadsTrend: 'on_track' | 'behind' | 'ahead' = 'on_track';
      let leadsRecommendation: string | null = null;

      if (kpi.targetLeads > 0 && remainingDays > 0) {
        const leadsDeviation = avgDailyLeads > 0
          ? (avgDailyLeads - requiredDailyLeads) / requiredDailyLeads
          : -1;
        if (leadsDeviation < -0.2) {
          leadsTrend = 'behind';
          const deficit = Math.round(requiredDailyLeads - avgDailyLeads);
          leadsRecommendation = `Отстаём. Нужно +${deficit} лидов/день`;
        } else if (leadsDeviation > 0.2) {
          leadsTrend = 'ahead';
          leadsRecommendation = `Опережаем план`;
        }
      }

      let cplRecommendation: string | null = null;
      if (kpi.targetCpl > 0 && monthStats.currentCpl > 0) {
        const cplDeviation = ((monthStats.currentCpl - kpi.targetCpl) / kpi.targetCpl) * 100;
        if (cplDeviation > 20) {
          cplRecommendation = `CPL выше плана на ${Math.round(cplDeviation)}%`;
        } else if (cplDeviation < -10) {
          cplRecommendation = `CPL ниже плана на ${Math.round(Math.abs(cplDeviation))}%`;
        }
      }

      // Диагностика взаимосвязей
      let diagnosis: string | null = null;
      if (leadsTrend === 'behind' && costTrend === 'on_track') {
        diagnosis = 'Бюджет расходуется по плану, но лидов мало. Проблема в конверсии или стоимости лида — проверьте качество трафика и посадочные страницы.';
      } else if (leadsTrend === 'behind' && costTrend === 'underspending') {
        diagnosis = 'Недостаточный расход и мало лидов. Нужно увеличить бюджет.';
      } else if (leadsTrend === 'ahead' && costTrend === 'overspending') {
        diagnosis = 'Лидов больше плана при перерасходе. Можно снизить бюджет без потери результата.';
      } else if (cplStatus === 'bad' && leadsTrend !== 'ahead') {
        diagnosis = 'Высокая стоимость лида. Оптимизируйте кампании: отключите неэффективные ключи, проверьте ставки.';
      }

      kpiAnalysis = {
        cost: {
          avgDaily7d: avgDailyCost,
          projectedMonthly: projectedMonthlyCost,
          remainingDays,
          remainingBudget,
          requiredDailyBudget,
          trend: costTrend,
          recommendation: costRecommendation,
        },
        leads: {
          avgDaily7d: avgDailyLeads,
          projectedMonthly: projectedMonthlyLeads,
          remainingLeads,
          requiredDailyLeads,
          trend: leadsTrend,
          recommendation: leadsRecommendation,
        },
        cpl: {
          current: monthStats.currentCpl,
          target: kpi.targetCpl,
          avgDaily7d: avgDailyCpl,
          trend: cplStatus,
          recommendation: cplRecommendation,
        },
        diagnosis,
      };
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
    // Если выбраны цели - фильтруем по ним, иначе без фильтра
    const hierarchicalStats = await clickhouseService.getHierarchicalStats(
      connectionId,
      startDate,
      endDate,
      selectedGoalIds
    );

    // Получаем дневную статистику для графика
    const dailyStats = await clickhouseService.getDailyStats(
      connectionId,
      startDate,
      endDate,
      selectedGoalIds
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
      currency,
      availableGoals: availableGoals.map(g => ({
        id: g.goalId,
        name: g.goalName || g.goalId,
      })),
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
      kpiAnalysis,
      month,
      campaigns: hierarchicalStats,
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
