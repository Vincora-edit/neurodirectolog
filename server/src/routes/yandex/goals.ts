/**
 * Yandex Goals Routes
 * Работа с целями конверсий
 */

import express from 'express';
import { clickhouseService } from '../../services/clickhouse.service';
import { yandexDirectService } from '../../services/yandex-direct.service';
import { yandexMetrikaService } from '../../services/yandex-metrika.service';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { requireProjectAccess, requireConnectionAccess } from '../../middleware/projectAccess';

const router = express.Router();

/**
 * GET /api/yandex/available-goals/:projectId
 * Получить список доступных целей для проекта
 */
router.get('/available-goals/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { connectionId } = req.query;

    let connection;
    if (connectionId) {
      connection = await clickhouseService.getConnectionById(connectionId as string);
    } else {
      connection = await clickhouseService.getConnectionByProjectId(projectId);
    }

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

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

    res.json(goals);
  } catch (error: any) {
    console.error('Failed to get available goals:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/yandex/load-goals
 * Загрузить цели из кампаний Яндекс.Директ
 */
router.post('/load-goals', authenticate, async (req: AuthRequest, res) => {
  try {
    const { accessToken, login } = req.body;

    if (!accessToken || !login) {
      return res.status(400).json({ error: 'accessToken and login are required' });
    }

    // Проверяем токен
    try {
      await yandexDirectService.getCampaigns(accessToken, login);
    } catch (error: any) {
      return res.status(400).json({ error: 'Invalid access token or login' });
    }

    // Возвращаем пустой массив - пользователь введет ID целей вручную
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
 * GET /api/yandex/metrika/goals/:counterId
 * Получить список целей из счетчика Метрики
 */
router.get('/metrika/goals/:counterId', authenticate, async (req: AuthRequest, res) => {
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
 * GET /api/yandex/connection/:connectionId/goals
 * Получить все доступные цели из Яндекс.Метрики для подключения
 */
router.get('/connection/:connectionId/goals', authenticate, requireConnectionAccess, async (req: AuthRequest, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await clickhouseService.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Получаем цели из кампаний в базе
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
