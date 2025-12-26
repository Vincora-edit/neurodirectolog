/**
 * Yandex Auth Routes
 * OAuth авторизация и подключение аккаунтов
 */

import express from 'express';
import Joi from 'joi';
import { yandexDirectService } from '../../services/yandex-direct.service';
import { yandexMetrikaService } from '../../services/yandex-metrika.service';
import { clickhouseService } from '../../services/clickhouse.service';
import { runManualSync } from '../../jobs/sync.job';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';

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
 * POST /api/yandex/exchange-code
 * Обменять код авторизации на токен и проверить тип аккаунта (agency/direct)
 */
router.post('/exchange-code', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // 1. Обмениваем код на токены
    const tokens = await yandexDirectService.getTokens(
      code,
      YANDEX_CLIENT_ID,
      YANDEX_CLIENT_SECRET,
      REDIRECT_URI
    );

    // 2. Получаем информацию о пользователе
    const userInfo = await yandexDirectService.getUserInfo(tokens.access_token);

    // 3. Проверяем, является ли это агентским аккаунтом
    const agencyInfo = await yandexDirectService.getAgencyClients(tokens.access_token);

    res.json({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      login: userInfo.login,
      isAgency: agencyInfo?.isAgency || false,
      agencyClients: agencyInfo?.clients || []
    });
  } catch (error: any) {
    console.error('Failed to exchange code:', error);
    res.status(500).json({ error: error.message || 'Failed to exchange authorization code' });
  }
});

/**
 * GET /api/yandex/agency-clients
 * Получить список клиентов агентства по accessToken
 */
router.get('/agency-clients', authenticate, async (req, res) => {
  try {
    const { accessToken } = req.query;
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const agencyInfo = await yandexDirectService.getAgencyClients(accessToken as string);

    if (!agencyInfo) {
      return res.status(500).json({ error: 'Failed to fetch agency clients' });
    }

    res.json({
      isAgency: agencyInfo.isAgency,
      clients: agencyInfo.clients
    });
  } catch (error: any) {
    console.error('Failed to get agency clients:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/yandex/connect-agency-client
 * Подключить конкретного клиента агентства
 */
router.post('/connect-agency-client', authenticate, async (req, res) => {
  try {
    const { accessToken, refreshToken, agencyLogin, clientLogin, projectId, metrikaCounterId, metrikaToken, conversionGoals } = req.body;
    const userId = (req as AuthRequest).userId;

    if (!accessToken || !clientLogin || !projectId) {
      return res.status(400).json({ error: 'accessToken, clientLogin and projectId are required' });
    }

    // 1. Проверяем доступ к клиенту - пытаемся получить кампании с Client-Login
    try {
      await yandexDirectService.getCampaigns(accessToken, clientLogin);
    } catch (error: any) {
      console.error('Failed to access client campaigns:', error);
      return res.status(400).json({ error: 'Cannot access client campaigns. Check permissions.' });
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
      login: clientLogin,
      accessToken,
      refreshToken: refreshToken || '',
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
      login: clientLogin,
      isAgencyClient: true
    });
  } catch (error: any) {
    console.error('Failed to connect agency client:', error);
    res.status(500).json({ error: error.message || 'Failed to connect agency client' });
  }
});

export default router;
