/**
 * Yandex KPI Routes
 * KPI, прогноз бюджета, рекомендации, посадочные страницы
 */

import express from 'express';
import { clickhouseService } from '../../services/clickhouse.service';
import { yandexDirectService } from '../../services/yandex-direct.service';
import { aiAnalysisService } from '../../services/ai-analysis.service';

const router = express.Router();

/**
 * GET /api/yandex/kpi/:connectionId
 * Получить KPI для аккаунта на текущий месяц + статистику прогресса
 */
router.get('/kpi/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Получаем текущий месяц
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Получаем KPI настройки
    const kpi = await clickhouseService.getAccountKpi(connectionId, month);

    // Используем цели из KPI настроек для расчёта статистики
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

    // Рассчитываем прогресс
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
      // Прогресс по расходу (к общему плану)
      costProgress = kpi.targetCost > 0 ? (monthStats.currentCost / kpi.targetCost) * 100 : 0;
      // Прогресс по расходу к текущему дню
      const expectedCostToday = kpi.targetCost * monthStats.dayProgress;
      costDayProgress = expectedCostToday > 0 ? (monthStats.currentCost / expectedCostToday) * 100 : 0;

      // Прогресс по лидам
      leadsProgress = kpi.targetLeads > 0 ? (monthStats.currentLeads / kpi.targetLeads) * 100 : 0;
      const expectedLeadsToday = kpi.targetLeads * monthStats.dayProgress;
      leadsDayProgress = expectedLeadsToday > 0 ? (monthStats.currentLeads / expectedLeadsToday) * 100 : 0;

      // Статус CPL
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

      if (kpi.targetCost > 0 && requiredDailyBudget > 0) {
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

      if (kpi.targetLeads > 0 && remainingDays > 0 && requiredDailyLeads > 0) {
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

    res.json({
      kpi: kpi || {
        targetCost: 0,
        targetCpl: 0,
        targetLeads: 0,
        goalIds: [],
      },
      stats: monthStats,
      progress: {
        costProgress: Math.min(costProgress, 150),
        costDayProgress: Math.min(costDayProgress, 150),
        leadsProgress: Math.min(leadsProgress, 150),
        leadsDayProgress: Math.min(leadsDayProgress, 150),
        cplStatus,
      },
      analysis: kpiAnalysis,
      month,
    });
  } catch (error: any) {
    console.error('Failed to get KPI:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/yandex/kpi/:connectionId
 * Сохранить KPI для аккаунта
 */
router.post('/kpi/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { targetCost, targetCpl, targetLeads, goalIds, month } = req.body;

    const now = new Date();
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const savedKpi = await clickhouseService.saveAccountKpi(connectionId, targetMonth, {
      targetCost: parseFloat(targetCost) || 0,
      targetCpl: parseFloat(targetCpl) || 0,
      targetLeads: parseInt(targetLeads) || 0,
      goalIds: goalIds || [],
    });

    res.json({
      success: true,
      kpi: savedKpi,
    });
  } catch (error: any) {
    console.error('Failed to save KPI:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/landing-pages/:projectId
 * Получить статистику по посадочным страницам
 */
router.get('/landing-pages/:projectId', async (req, res) => {
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

    const stats = await clickhouseService.getLandingPageStats(
      connection.id,
      startDate,
      endDate,
      goalIdsArray
    );

    res.json(stats);
  } catch (error: any) {
    console.error('Failed to get landing page stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/budget-forecast/:connectionId
 * Получить прогноз бюджета
 */
router.get('/budget-forecast/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await clickhouseService.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // 1. Получаем текущий баланс через Yandex API
    const balance = await yandexDirectService.getAccountBalance(
      connection.accessToken,
      connection.login
    );

    if (!balance) {
      return res.json({
        balance: null,
        forecast: null,
        error: 'Не удалось получить баланс аккаунта. Возможно, нет доступа к общему счёту.',
      });
    }

    // 2. Получаем средний расход за последние 7 дней
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const dailyStats = await clickhouseService.getDailyStats(
      connectionId,
      startDate,
      endDate
    );

    // Считаем средний дневной расход
    let totalCost = 0;
    let daysWithData = 0;

    if (Array.isArray(dailyStats) && dailyStats.length > 0) {
      dailyStats.forEach((day: any) => {
        if (day.cost > 0) {
          totalCost += day.cost;
          daysWithData++;
        }
      });
    }

    const avgDailyCost = daysWithData > 0 ? totalCost / daysWithData : 0;
    const daysRemaining = avgDailyCost > 0 ? Math.floor(balance.amount / avgDailyCost) : null;

    // 3. Прогноз до конца месяца
    const today = new Date();
    const daysLeftInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
    const projectedMonthCost = avgDailyCost * daysLeftInMonth;
    const willRunOutBeforeMonthEnd = daysRemaining !== null && daysRemaining < daysLeftInMonth;

    res.json({
      balance: {
        amount: balance.amount,
        currency: balance.currency,
        amountAvailableForTransfer: balance.amountAvailableForTransfer,
        source: balance.source,
      },
      stats: {
        avgDailyCost: Math.round(avgDailyCost * 100) / 100,
        totalCostLast7Days: Math.round(totalCost * 100) / 100,
        daysWithData,
      },
      forecast: {
        daysRemaining,
        daysLeftInMonth,
        projectedMonthCost: Math.round(projectedMonthCost * 100) / 100,
        willRunOutBeforeMonthEnd,
        runOutDate: daysRemaining !== null
          ? new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null,
      },
    });
  } catch (error: any) {
    console.error('Failed to get budget forecast:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/recommendations/:connectionId
 * Получить AI-рекомендации для дашборда
 */
router.get('/recommendations/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await clickhouseService.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const recommendations = await aiAnalysisService.getDashboardRecommendations(connectionId);

    res.json(recommendations);
  } catch (error: any) {
    console.error('Failed to get recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
