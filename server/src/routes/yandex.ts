import express from 'express';
import Joi from 'joi';
import { yandexDirectService } from '../services/yandex-direct.service';
import { yandexMetrikaService } from '../services/yandex-metrika.service';
import { clickhouseService } from '../services/clickhouse.service';
import { runManualSync } from '../jobs/sync.job';
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
 * Получить детальную статистику с фильтром по цели
 * Поддерживает параметр connectionId для мультиаккаунтности
 */
router.get('/detailed-stats/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days, goalId, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

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

    const stats = await clickhouseService.getDetailedCampaignStats(
      connection.id,
      startDate,
      endDate,
      goalId as string | undefined
    );

    res.json(stats);
  } catch (error: any) {
    console.error('Failed to get detailed stats:', error);
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

export default router;
