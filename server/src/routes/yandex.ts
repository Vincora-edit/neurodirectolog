import express from 'express';
import Joi from 'joi';
import { yandexDirectService } from '../services/yandex-direct.service';
import { yandexMetrikaService } from '../services/yandex-metrika.service';
import { clickhouseService } from '../services/clickhouse.service';
import { aiAnalysisService } from '../services/ai-analysis.service';
import { runManualSync } from '../jobs/sync.job';
import { syncService } from '../services/sync.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Validation schemas
const connectSchema = Joi.object({
  code: Joi.string().required(),
  projectId: Joi.string().required(),
  metrikaCounterId: Joi.string().optional().allow(''),
  metrikaToken: Joi.string().optional().allow(''),
  conversionGoals: Joi.array().items(Joi.string()).optional(),
});

const connectSimpleSchema = Joi.object({
  accessToken: Joi.string().required(),
  login: Joi.string().required(),
  projectId: Joi.string().required(),
  metrikaCounterId: Joi.string().optional().allow(''),
  metrikaToken: Joi.string().optional().allow(''),
  conversionGoals: Joi.array().items(Joi.string()).optional(),
});

const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || '';
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.YANDEX_REDIRECT_URI || 'http://localhost:5173/yandex/callback';

/**
 * GET /api/yandex/auth-url
 * Получить URL для OAuth авторизации Яндекс.Директ
 */
router.get('/auth-url', (req, res) => {
  const authUrl = yandexDirectService.getAuthUrl(YANDEX_CLIENT_ID, REDIRECT_URI);
  res.json({ authUrl });
});

/**
 * POST /api/yandex/connect
 * Завершить OAuth и сохранить подключение
 */
router.post('/connect', authenticate, async (req, res, next) => {
  try {
    const { error, value } = connectSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { code, projectId, metrikaCounterId, metrikaToken, conversionGoals } = value;
    const userId = (req as AuthRequest).userId;

    // 1. Обмениваем код на токены
    const tokens = await yandexDirectService.getTokens(
      code,
      YANDEX_CLIENT_ID,
      YANDEX_CLIENT_SECRET,
      REDIRECT_URI
    );

    // 2. Получаем информацию о пользователе
    const userInfo = await yandexDirectService.getUserInfo(tokens.access_token);

    // 3. Валидируем токен Метрики если указан
    if (metrikaToken && metrikaCounterId) {
      const isValid = await yandexMetrikaService.validateToken(metrikaToken, metrikaCounterId);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid Metrika token or counter ID' });
      }
    }

    // 4. Сохраняем подключение в ClickHouse
    const connectionId = await clickhouseService.createConnection({
      userId,
      projectId,
      login: userInfo.login,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      metrikaCounterId: metrikaCounterId || '',
      metrikaToken: metrikaToken || '',
      conversionGoals: JSON.stringify(conversionGoals || []),
      status: 'active',
      lastSyncAt: new Date(),
    });

    // 5. Запускаем первую синхронизацию
    runManualSync(connectionId).catch(err => {
      console.error('Initial sync failed:', err);
    });

    res.json({
      success: true,
      connectionId,
      login: userInfo.login,
    });
  } catch (error: any) {
    console.error('Failed to connect Yandex.Direct:', error);
    res.status(500).json({ error: error.message || 'Failed to connect' });
  }
});

/**
 * POST /api/yandex/connect-simple
 * Упрощенное подключение с фиксированным токеном (без OAuth)
 */
router.post('/connect-simple', authenticate, async (req, res, next) => {
  try {
    const { error, value } = connectSimpleSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { accessToken, login, projectId, metrikaCounterId, metrikaToken, conversionGoals } = value;
    const userId = (req as AuthRequest).userId;

    // 1. Проверяем токен - пытаемся получить список кампаний
    try {
      await yandexDirectService.getCampaigns(accessToken, login);
    } catch (error: any) {
      return res.status(400).json({ error: 'Invalid access token or login' });
    }

    // 2. Валидируем токен Метрики если указан
    if (metrikaToken && metrikaCounterId) {
      const isValid = await yandexMetrikaService.validateToken(metrikaToken, metrikaCounterId);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid Metrika token or counter ID' });
      }
    }

    // 3. Сохраняем подключение в ClickHouse
    const connectionId = await clickhouseService.createConnection({
      userId,
      projectId,
      login,
      accessToken,
      refreshToken: '', // Нет refresh token в упрощенном режиме
      metrikaCounterId: metrikaCounterId || '',
      metrikaToken: metrikaToken || '',
      conversionGoals: JSON.stringify(conversionGoals || []),
      status: 'active',
      lastSyncAt: new Date(),
    });

    // 4. Запускаем первую синхронизацию
    runManualSync(connectionId).catch(err => {
      console.error('Initial sync failed:', err);
    });

    res.json({
      success: true,
      connectionId,
      login,
    });
  } catch (error: any) {
    console.error('Failed to connect Yandex.Direct (simple):', error);
    res.status(500).json({ error: error.message || 'Failed to connect' });
  }
});

/**
 * GET /api/yandex/connections/:projectId
 * Получить все подключения для проекта (мультиаккаунтность)
 */
router.get('/connections/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const connections = await clickhouseService.getConnectionsByProjectId(projectId);

    // Не отправляем токены на фронтенд
    const safeConnections = connections.map(conn => {
      const { accessToken, refreshToken, ...safe } = conn;
      return safe;
    });

    res.json(safeConnections);
  } catch (error: any) {
    console.error('Failed to get connections:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/connection/:projectId
 * Получить информацию о подключении для проекта (первое найденное)
 */
router.get('/connection/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const connection = await clickhouseService.getConnectionByProjectId(projectId);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Не отправляем токены на фронтенд
    const { accessToken, refreshToken, ...safeConnection } = connection;

    res.json(safeConnection);
  } catch (error: any) {
    console.error('Failed to get connection:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/campaigns/:projectId
 * Получить список кампаний для проекта
 */
router.get('/campaigns/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const connection = await clickhouseService.getConnectionByProjectId(projectId);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    res.json(campaigns);
  } catch (error: any) {
    console.error('Failed to get campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

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
router.post('/sync-all', async (req, res) => {
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

/**
 * POST /api/yandex/load-goals
 * Загрузить цели из кампаний Яндекс.Директ (упрощенная версия - просто дает ввести ID вручную)
 */
router.post('/load-goals', async (req, res) => {
  try {
    const { accessToken, login } = req.body;

    if (!accessToken || !login) {
      return res.status(400).json({ error: 'accessToken and login are required' });
    }

    // Проверяем токен - пытаемся получить список кампаний
    try {
      await yandexDirectService.getCampaigns(accessToken, login);
    } catch (error: any) {
      return res.status(400).json({ error: 'Invalid access token or login' });
    }

    // Возвращаем пустой массив - пользователь введет ID целей вручную
    // В будущем можно доработать, чтобы тянуть цели из API
    res.json({
      success: true,
      goals: [],
      message: 'Введите ID целей вручную (из настроек кампаний в Яндекс.Директ)',
    });
  } catch (error: any) {
    console.error('Failed to load goals:', error);
    res.status(500).json({ error: error.message || 'Failed to load goals' });
  }
});

/**
 * GET /api/yandex/detailed-stats/:projectId
 * Получить детальную статистику с фильтром по целям
 * Поддерживает параметр connectionId для мультиаккаунтности
 * Поддерживает множественный выбор целей через goalIds (через запятую)
 */
router.get('/detailed-stats/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, goalId, goalIds, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

    // Если указан connectionId - используем его, иначе берем первое подключение
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

    // Используем кастомные даты если указаны, иначе рассчитываем по days
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
 * Поддерживает connectionId для мультиаккаунтности
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
 * Поддерживает connectionId для мультиаккаунтности и фильтр по целям
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

/**
 * GET /api/yandex/available-goals/:projectId
 * Получить список доступных целей для проекта
 * Поддерживает параметр connectionId для мультиаккаунтности
 */
router.get('/available-goals/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { connectionId } = req.query;
    console.log('[available-goals] Getting goals for projectId:', projectId, 'connectionId:', connectionId);

    // Если указан connectionId - используем его, иначе берем первое подключение
    let connection;
    if (connectionId) {
      connection = await clickhouseService.getConnectionById(connectionId as string);
    } else {
      connection = await clickhouseService.getConnectionByProjectId(projectId);
    }

    if (!connection) {
      console.log('[available-goals] Connection not found');
      return res.status(404).json({ error: 'Connection not found' });
    }

    console.log('[available-goals] Found connection:', connection.id, 'goals:', connection.conversionGoals);

    // Парсим цели напрямую из connection
    let goalIds: string[] = [];
    if (connection.conversionGoals) {
      try {
        goalIds = JSON.parse(connection.conversionGoals);
      } catch (e) {
        console.error('[available-goals] Failed to parse goals:', e);
      }
    }

    // Загружаем названия целей из Метрики если есть токен
    let goals: any[] = [];
    if (connection.metrikaToken && connection.metrikaCounterId && goalIds.length > 0) {
      try {
        const goalNames = await yandexMetrikaService.getGoalNames(
          connection.metrikaToken,
          connection.metrikaCounterId,
          goalIds
        );

        goals = goalIds.map(goalId => ({
          goalId,
          goalName: goalNames.get(goalId) || undefined,
        }));
      } catch (error) {
        console.error('[available-goals] Failed to load goal names:', error);
        // Если не удалось загрузить имена, возвращаем без них
        goals = goalIds.map(goalId => ({
          goalId,
          goalName: undefined,
        }));
      }
    } else {
      goals = goalIds.map(goalId => ({
        goalId,
        goalName: undefined,
      }));
    }

    console.log('[available-goals] Returning goals:', goals);
    res.json(goals);
  } catch (error: any) {
    console.error('Failed to get available goals:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/metrika/goals/:counterId
 * Получить список целей из счетчика Метрики
 */
router.get('/metrika/goals/:counterId', async (req, res) => {
  try {
    const { counterId } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const goals = await yandexMetrikaService.getCounterGoals(
      token as string,
      counterId
    );

    res.json(goals);
  } catch (error: any) {
    console.error('Failed to get Metrika goals:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/yandex/connection/:connectionId
 * Удалить подключение
 */
router.delete('/connection/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;

    await clickhouseService.deleteConnection(connectionId);

    res.json({ success: true, message: 'Connection deleted' });
  } catch (error: any) {
    console.error('Failed to delete connection:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/yandex/connection/:connectionId
 * Обновить подключение (токен, цели и т.д.)
 */
router.put('/connection/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { accessToken, refreshToken, conversionGoals, metrikaCounterId, metrikaToken } = req.body;

    // Получаем текущее подключение
    const connection = await clickhouseService.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Обновляем подключение
    await clickhouseService.updateConnection(connectionId, {
      accessToken: accessToken || connection.accessToken,
      refreshToken: refreshToken || connection.refreshToken,
      conversionGoals: conversionGoals !== undefined ? JSON.stringify(conversionGoals) : connection.conversionGoals,
      metrikaCounterId: metrikaCounterId !== undefined ? metrikaCounterId : connection.metrikaCounterId,
      metrikaToken: metrikaToken !== undefined ? metrikaToken : connection.metrikaToken,
    });

    res.json({ success: true, message: 'Connection updated' });
  } catch (error: any) {
    console.error('Failed to update connection:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/connection/:connectionId/goals
 * Получить все доступные цели из Яндекс.Метрики для подключения
 */
router.get('/connection/:connectionId/goals', async (req, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await clickhouseService.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Получаем цели из кампаний в базе (уже синхронизированные)
    const goals = await clickhouseService.getAvailableGoalsForConnection(connectionId);

    res.json({
      goals,
      selectedGoals: connection.conversionGoals ? JSON.parse(connection.conversionGoals) : [],
    });
  } catch (error: any) {
    console.error('Failed to get goals:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== KPI Endpoints ====================

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
    // Это ключевое изменение - KPI использует свои привязанные цели, а не глобальный фильтр
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
      // Прогресс по расходу к текущему дню (сколько должны были потратить)
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
        costProgress: Math.min(costProgress, 150), // cap at 150%
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

    // Используем указанный месяц или текущий
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
 * Получить прогноз бюджета (баланс аккаунта и на сколько дней хватит)
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
        source: balance.source, // 'shared_account' или 'campaigns_sum'
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

/**
 * GET /api/yandex/geo-stats/:projectId
 * Получить статистику по регионам
 */
router.get('/geo-stats/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

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

    // Получаем список кампаний для этого подключения
    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    // Форматируем даты для API
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Получаем статистику по регионам напрямую из Yandex API
    const geoStats = await yandexDirectService.getGeoStats(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo
    );

    // Агрегируем данные по регионам
    const geoMap = new Map<string, {
      region: string;
      impressions: number;
      clicks: number;
      cost: number;
      bounces: number;
    }>();

    geoStats.forEach((row: any) => {
      const region = row.LocationOfPresenceName || 'Неизвестный регион';
      const existing = geoMap.get(region) || {
        region,
        impressions: 0,
        clicks: 0,
        cost: 0,
        bounces: 0,
      };

      existing.impressions += parseInt(row.Impressions) || 0;
      existing.clicks += parseInt(row.Clicks) || 0;
      existing.cost += parseFloat(row.Cost) || 0;
      const bounceRate = parseFloat(row.BounceRate) || 0;
      const clicks = parseInt(row.Clicks) || 0;
      existing.bounces += Math.round(clicks * bounceRate / 100);

      geoMap.set(region, existing);
    });

    // Преобразуем в массив с вычисленными метриками
    const result = Array.from(geoMap.values()).map(g => ({
      region: g.region,
      impressions: g.impressions,
      clicks: g.clicks,
      cost: Math.round(g.cost * 100) / 100,
      ctr: g.impressions > 0 ? Math.round((g.clicks / g.impressions) * 10000) / 100 : 0,
      avgCpc: g.clicks > 0 ? Math.round((g.cost / g.clicks) * 100) / 100 : 0,
      bounceRate: g.clicks > 0 ? Math.round((g.bounces / g.clicks) * 10000) / 100 : 0,
    }));

    // Сортируем по расходу (убывание)
    result.sort((a, b) => b.cost - a.cost);

    // Ограничиваем топ-20 регионов
    res.json(result.slice(0, 20));
  } catch (error: any) {
    console.error('Failed to get geo stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/device-stats/:projectId
 * Получить статистику по устройствам (Desktop/Mobile/Tablet)
 * Читаем из ClickHouse, fallback на Яндекс API
 */
router.get('/device-stats/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

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

    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Сначала пробуем из ClickHouse
    try {
      const cachedData = await clickhouseService.getCachedDeviceStats(connection.id, dateFrom, dateTo);
      if (cachedData && cachedData.length > 0) {
        console.log(`[device-stats] Returning ${cachedData.length} cached records from ClickHouse`);
        return res.json(cachedData);
      }
    } catch (cacheError) {
      console.log(`[device-stats] ClickHouse cache miss, falling back to API`);
    }

    // Fallback на Яндекс API
    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    // Получаем goalIds для запроса реальных конверсий
    let goalIds: string[] = [];
    try {
      if (connection.conversionGoals) {
        goalIds = JSON.parse(connection.conversionGoals);
      }
    } catch (e) {
      console.log('[device-stats] No conversion goals configured');
    }

    const deviceStats = await yandexDirectService.getDeviceStats(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    // Агрегируем данные по устройствам
    const deviceMap = new Map<string, {
      device: string;
      impressions: number;
      clicks: number;
      cost: number;
      bounces: number;
      conversions: number;
    }>();

    deviceStats.forEach((row: any) => {
      const device = row.Device || 'UNKNOWN';
      const existing = deviceMap.get(device) || {
        device,
        impressions: 0,
        clicks: 0,
        cost: 0,
        bounces: 0,
        conversions: 0,
      };

      existing.impressions += parseInt(row.Impressions) || 0;
      existing.clicks += parseInt(row.Clicks) || 0;
      existing.cost += parseFloat(row.Cost) || 0;
      existing.conversions += parseInt(row.Conversions) || 0;
      const bounceRate = parseFloat(row.BounceRate) || 0;
      const clicks = parseInt(row.Clicks) || 0;
      existing.bounces += Math.round(clicks * bounceRate / 100);

      deviceMap.set(device, existing);
    });

    const result = Array.from(deviceMap.values()).map(d => ({
      device: d.device,
      deviceName: d.device === 'DESKTOP' ? 'Десктоп' :
                  d.device === 'MOBILE' ? 'Мобильный' :
                  d.device === 'TABLET' ? 'Планшет' : d.device,
      impressions: d.impressions,
      clicks: d.clicks,
      cost: Math.round(d.cost * 100) / 100,
      ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
      avgCpc: d.clicks > 0 ? Math.round((d.cost / d.clicks) * 100) / 100 : 0,
      bounceRate: d.clicks > 0 ? Math.round((d.bounces / d.clicks) * 10000) / 100 : 0,
      conversions: d.conversions,
    }));

    result.sort((a, b) => b.clicks - a.clicks);

    res.json(result);
  } catch (error: any) {
    console.error('Failed to get device stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/search-queries/:projectId
 * Получить статистику по поисковым запросам
 * Сначала пробуем из ClickHouse (синхронизированные данные), fallback на Яндекс API
 */
router.get('/search-queries/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

    let connection;
    if (connectionId) {
      connection = await clickhouseService.getConnectionById(connectionId as string);
    } else {
      connection = await clickhouseService.getConnectionByProjectId(projectId);
    }

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Сначала пробуем получить из ClickHouse (быстро, без лимитов API)
    try {
      const cachedData = await clickhouseService.getSearchQueries(connection.id);
      if (cachedData && cachedData.length > 0) {
        console.log(`[search-queries] Returning ${cachedData.length} cached records from ClickHouse`);
        return res.json(cachedData);
      }
    } catch (cacheError) {
      console.log(`[search-queries] ClickHouse cache miss, falling back to API`);
    }

    // Fallback на Яндекс API
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

    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Получаем goalIds для запроса реальных конверсий
    let goalIds: string[] = [];
    try {
      if (connection.conversionGoals) {
        goalIds = JSON.parse(connection.conversionGoals);
      }
    } catch (e) {
      console.log('[search-queries] No conversion goals configured');
    }

    const searchQueries = await yandexDirectService.getSearchQueryReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    // Данные уже содержат реальные конверсии (или 0 если API не поддерживает)
    res.json(searchQueries);
  } catch (error: any) {
    console.error('Failed to get search queries:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/demographics/:projectId
 * Получить статистику по полу и возрасту
 * Читаем из ClickHouse (campaign_performance), fallback на Яндекс API
 */
router.get('/demographics/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

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

    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Сначала пробуем из ClickHouse
    try {
      const cachedData = await clickhouseService.getDemographics(connection.id, dateFrom, dateTo);
      if (cachedData && cachedData.length > 0) {
        console.log(`[demographics] Returning ${cachedData.length} cached records from ClickHouse`);
        return res.json(cachedData);
      }
    } catch (cacheError) {
      console.log(`[demographics] ClickHouse cache miss, falling back to API`);
    }

    // Fallback на Яндекс API
    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    // Получаем goalIds для запроса реальных конверсий
    let goalIds: string[] = [];
    try {
      if (connection.conversionGoals) {
        goalIds = JSON.parse(connection.conversionGoals);
      }
    } catch (e) {
      console.log('[demographics] No conversion goals configured');
    }

    const demographics = await yandexDirectService.getDemographicsReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    // Данные уже содержат реальные конверсии
    res.json(demographics);
  } catch (error: any) {
    console.error('Failed to get demographics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/geo-report/:projectId
 * Получить статистику по регионам
 * Читаем из ClickHouse (campaign_performance), fallback на Яндекс API
 */
router.get('/geo-report/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

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

    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Сначала пробуем из ClickHouse
    try {
      const cachedData = await clickhouseService.getGeoStats(connection.id, dateFrom, dateTo);
      if (cachedData && cachedData.length > 0) {
        console.log(`[geo-report] Returning ${cachedData.length} cached records from ClickHouse`);
        return res.json(cachedData);
      }
    } catch (cacheError) {
      console.log(`[geo-report] ClickHouse cache miss, falling back to API`);
    }

    // Fallback на Яндекс API
    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    // Получаем goalIds для запроса реальных конверсий
    let goalIds: string[] = [];
    try {
      if (connection.conversionGoals) {
        goalIds = JSON.parse(connection.conversionGoals);
      }
    } catch (e) {
      console.log('[geo-report] No conversion goals configured');
    }

    const geoReport = await yandexDirectService.getGeoStats(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    // Трансформируем данные в формат для UI
    const result = geoReport.map((row: any) => ({
      region: row.LocationOfPresenceName || 'Неизвестно',
      impressions: parseInt(row.Impressions) || 0,
      clicks: parseInt(row.Clicks) || 0,
      cost: parseFloat(row.Cost) || 0,
      conversions: parseInt(row.Conversions) || 0,
      ctr: row.Impressions > 0 ? (parseInt(row.Clicks) / parseInt(row.Impressions)) * 100 : 0,
      avgCpc: row.Clicks > 0 ? parseFloat(row.Cost) / parseInt(row.Clicks) : 0,
    }));

    res.json(result);
  } catch (error: any) {
    console.error('Failed to get geo report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/placements/:projectId
 * Получить статистику по площадкам (РСЯ, Поиск и т.д.)
 */
router.get('/placements/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

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

    // Получаем список кампаний для этого подключения
    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    // Форматируем даты для API
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Получаем статистику по площадкам
    const placements = await yandexDirectService.getPlacementsReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo
    );

    // Примечание: Yandex API не поддерживает конверсии с разбивкой по площадкам
    // Возвращаем данные без конверсий
    res.json(placements);
  } catch (error: any) {
    console.error('Failed to get placements:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/income/:projectId
 * Получить статистику по платёжеспособности (IncomeGrade)
 * Читаем из ClickHouse, fallback на Яндекс API
 */
router.get('/income/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

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

    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Сначала пробуем из ClickHouse
    try {
      const cachedData = await clickhouseService.getIncomeStats(connection.id, dateFrom, dateTo);
      if (cachedData && cachedData.length > 0) {
        console.log(`[income] Returning ${cachedData.length} cached records from ClickHouse`);
        return res.json(cachedData);
      }
    } catch (cacheError) {
      console.log(`[income] ClickHouse cache miss, falling back to API`);
    }

    // Fallback на Яндекс API
    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const incomeData = await yandexDirectService.getIncomeReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo
    );

    // Примечание: Yandex API не поддерживает конверсии с разбивкой по доходу
    // Возвращаем данные без конверсий
    res.json(incomeData);
  } catch (error: any) {
    console.error('Failed to get income data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/targeting-categories/:projectId
 * Получить статистику по категориям таргетинга
 */
router.get('/targeting-categories/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

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

    // Получаем список кампаний для этого подключения
    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    // Форматируем даты для API
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Получаем статистику по категориям таргетинга
    const categoriesData = await yandexDirectService.getTargetingCategoryReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo
    );

    // Примечание: Yandex API не поддерживает конверсии с разбивкой по категориям таргетинга
    // Возвращаем данные без конверсий
    res.json(categoriesData);
  } catch (error: any) {
    console.error('Failed to get targeting categories:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/criteria/:projectId
 * Получить статистику по условиям показа (ключевым словам)
 */
router.get('/criteria/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

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

    // Получаем список кампаний для этого подключения
    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    // Форматируем даты для API
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Получаем статистику по условиям показа
    const criteriaData = await yandexDirectService.getCriteriaReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo
    );

    // Примечание: Yandex API не поддерживает конверсии с разбивкой по условиям показа
    // Возвращаем данные без конверсий
    res.json(criteriaData);
  } catch (error: any) {
    console.error('Failed to get criteria:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/ad-texts/:projectId
 * Получить статистику по текстам объявлений
 * Читаем из ClickHouse (ad_performance + ad_contents), fallback на Яндекс API
 */
router.get('/ad-texts/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

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

    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Сначала пробуем из ClickHouse
    try {
      const cachedData = await clickhouseService.getAdTexts(connection.id, dateFrom, dateTo);
      if (cachedData && cachedData.length > 0) {
        console.log(`[ad-texts] Returning ${cachedData.length} cached records from ClickHouse`);
        return res.json(cachedData);
      }
    } catch (cacheError) {
      console.log(`[ad-texts] ClickHouse cache miss, falling back to API`);
    }

    // Fallback на Яндекс API
    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const adTextsData = await yandexDirectService.getAdTextReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo
    );

    res.json(adTextsData);
  } catch (error: any) {
    console.error('Failed to get ad texts:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
