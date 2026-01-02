/**
 * Yandex Connection Routes
 * CRUD операции с подключениями
 */

import express from 'express';
import { clickhouseService } from '../../services/clickhouse.service';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { requireProjectAccess, requireConnectionAccess } from '../../middleware/projectAccess';

const router = express.Router();

/**
 * GET /api/yandex/connections
 * Получить все подключения текущего пользователя (для анализа запросов)
 */
router.get('/connections', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    // Get all projects for user
    const projects = await clickhouseService.getProjectsByUserId(userId);

    // Get connections for all projects
    const allConnections: any[] = [];
    for (const project of projects) {
      const connections = await clickhouseService.getConnectionsByProjectId(project.id);
      for (const conn of connections) {
        allConnections.push({
          id: conn.id,
          login: conn.login,
          projectId: project.id,
          projectName: project.name,
        });
      }
    }

    res.json({ success: true, data: allConnections });
  } catch (error: any) {
    console.error('Failed to get user connections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/yandex/connections/:projectId
 * Получить все подключения для проекта (мультиаккаунтность)
 */
router.get('/connections/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
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
router.get('/connection/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
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
 * DELETE /api/yandex/connection/:connectionId
 * Удалить подключение
 */
router.delete('/connection/:connectionId', authenticate, requireConnectionAccess, async (req: AuthRequest, res) => {
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
router.put('/connection/:connectionId', authenticate, requireConnectionAccess, async (req: AuthRequest, res) => {
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
 * GET /api/yandex/campaigns/:projectId
 * Получить список кампаний для проекта
 */
router.get('/campaigns/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
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

export default router;
