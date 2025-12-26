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

    // Рассчитываем прогресс
    let costProgress = 0;
    let costDayProgress = 0;
    let leadsProgress = 0;
    let leadsDayProgress = 0;
    let cplStatus: 'good' | 'warning' | 'bad' = 'good';

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
