import { Router, Response, NextFunction } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { projectStore } from '../models/project.model';
import { clickhouseService } from '../services/clickhouse.service';
import { usageService } from '../services/usage.service';

const router = Router();

// Middleware для проверки админских прав
const requireAdmin = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.isAdmin) {
    return next(createError('Admin access required', 403));
  }
  next();
};

/**
 * Получить список всех пользователей
 */
router.get('/users', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const users = await clickhouseService.getAllUsers();

    // Получаем проекты и подключения для каждого пользователя
    const usersWithStats = await Promise.all(users.map(async (user) => {
      // Получаем проекты пользователя
      const projects = await projectStore.getByUserIdLightweight(user.id, false);
      const userProjects = projects.filter(p => p.userId === user.id);

      // Получаем подключения для всех проектов пользователя
      let connectionsCount = 0;
      for (const project of userProjects) {
        try {
          const connections = await clickhouseService.getConnectionsByProjectId(project.id);
          connectionsCount += connections.length;
        } catch (e) {
          // Игнорируем ошибки
        }
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        projectsCount: userProjects.length,
        connectionsCount,
      };
    }));

    res.json(usersWithStats);
  } catch (error) {
    next(error);
  }
});

/**
 * Получить детали пользователя с его проектами и подключениями
 */
router.get('/users/:userId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await clickhouseService.getUserById(userId);

    if (!user) {
      throw createError('User not found', 404);
    }

    // Получаем проекты пользователя
    const projects = await projectStore.getByUserIdLightweight(userId, false);
    const userProjects = projects.filter(p => p.userId === userId);

    // Получаем подключения для каждого проекта
    const projectsWithConnections = await Promise.all(userProjects.map(async (project) => {
      let connections: any[] = [];
      try {
        connections = await clickhouseService.getConnectionsByProjectId(project.id);
      } catch (e) {
        // Игнорируем ошибки
      }

      return {
        ...project,
        connections: connections.map(c => ({
          id: c.id,
          login: c.login,
          status: c.status,
          lastSyncAt: c.lastSyncAt,
        })),
      };
    }));

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      projects: projectsWithConnections,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Удалить пользователя
 */
router.delete('/users/:userId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Нельзя удалить самого себя
    if (userId === (req as AuthRequest).userId) {
      throw createError('Cannot delete yourself', 400);
    }

    const user = await clickhouseService.getUserById(userId);
    if (!user) {
      throw createError('User not found', 404);
    }

    await clickhouseService.deleteUser(userId);

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * Изменить статус админа пользователя
 */
router.put('/users/:userId/admin', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body;

    // Нельзя снять админку с самого себя
    if (userId === (req as AuthRequest).userId && !isAdmin) {
      throw createError('Cannot remove admin from yourself', 400);
    }

    const user = await clickhouseService.getUserById(userId);
    if (!user) {
      throw createError('User not found', 404);
    }

    await clickhouseService.updateUser(userId, { isAdmin });

    res.json({ success: true, message: `Admin status ${isAdmin ? 'granted' : 'revoked'}` });
  } catch (error) {
    next(error);
  }
});

/**
 * Получить статистику системы
 */
router.get('/stats', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const users = await clickhouseService.getAllUsers();

    // Получаем все проекты
    const allProjects = await projectStore.getByUserIdLightweight('', true);

    // Получаем размер данных из ClickHouse
    let clickhouseStats = {
      totalRows: 0,
      diskUsageMB: 0,
      tables: [] as { name: string; rows: number; sizeMB: number }[],
    };

    try {
      // Получаем статистику по таблицам
      const tablesQuery = `
        SELECT
          table,
          sum(rows) as rows,
          sum(bytes_on_disk) / 1024 / 1024 as size_mb
        FROM system.parts
        WHERE database = 'neurodirectolog' AND active
        GROUP BY table
        ORDER BY size_mb DESC
      `;

      const tablesResult = await clickhouseService.query(tablesQuery);

      if (tablesResult && Array.isArray(tablesResult)) {
        clickhouseStats.tables = tablesResult.map((row: any) => ({
          name: row.table,
          rows: parseInt(row.rows) || 0,
          sizeMB: parseFloat(row.size_mb) || 0,
        }));

        clickhouseStats.totalRows = clickhouseStats.tables.reduce((sum, t) => sum + t.rows, 0);
        clickhouseStats.diskUsageMB = clickhouseStats.tables.reduce((sum, t) => sum + t.sizeMB, 0);
      }
    } catch (e) {
      console.error('Error getting ClickHouse stats:', e);
    }

    // Считаем подключения
    let totalConnections = 0;
    let activeConnections = 0;
    for (const project of allProjects) {
      try {
        const connections = await clickhouseService.getConnectionsByProjectId(project.id);
        totalConnections += connections.length;
        activeConnections += connections.filter(c => c.status === 'active').length;
      } catch (e) {
        // Игнорируем ошибки
      }
    }

    res.json({
      users: {
        total: users.length,
        admins: users.filter(u => u.isAdmin).length,
      },
      projects: {
        total: allProjects.length,
        withSemantics: allProjects.filter(p => p.hasSemantics).length,
        withAds: allProjects.filter(p => p.hasAds || p.hasCompleteAds).length,
      },
      connections: {
        total: totalConnections,
        active: activeConnections,
      },
      storage: {
        clickhouse: {
          totalRows: clickhouseStats.totalRows,
          diskUsageMB: Math.round(clickhouseStats.diskUsageMB * 100) / 100,
          tables: clickhouseStats.tables,
        },
      },
      server: {
        uptime: process.uptime(),
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        nodeVersion: process.version,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Получить все подключения Яндекса
 */
router.get('/connections', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const connections = await clickhouseService.query(`
      SELECT
        id, user_id, project_id, login, status, last_sync_at, created_at
      FROM neurodirectolog.yandex_direct_connections
      ORDER BY created_at DESC
    `);

    res.json(connections || []);
  } catch (error) {
    next(error);
  }
});

/**
 * Получить статистику использования по всем пользователям
 */
router.get('/usage', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const users = (await clickhouseService.getAllUsers()).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
    }));

    const usageData = usageService.getAllUsersUsage(users, days);
    const systemStats = usageService.getSystemUsageStats(days);

    res.json({
      period: `${days} дней`,
      system: systemStats,
      users: usageData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Получить детальную статистику использования по конкретному пользователю
 */
router.get('/usage/:userId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const user = await clickhouseService.getUserById(userId);
    if (!user) {
      return next(createError('User not found', 404));
    }

    const usageRecords = usageService.getUserUsage(userId, days);

    // Подсчёт итогов
    const totalAiRequests = usageRecords.reduce((sum, r) => sum + r.aiRequests, 0);
    const totalAiTokens = usageRecords.reduce((sum, r) => sum + r.aiTokensUsed, 0);
    const totalYandexSyncs = usageRecords.reduce((sum, r) => sum + r.yandexSyncs, 0);
    const totalApiRequests = usageRecords.reduce((sum, r) => sum + r.apiRequests, 0);

    // Расчёт стоимости
    const aiCostRub = (totalAiTokens / 1000) * 5;
    const syncCostRub = totalYandexSyncs * 0.5;
    const estimatedCostRub = Math.round((aiCostRub + syncCostRub) * 100) / 100;

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      period: `${days} дней`,
      summary: {
        totalAiRequests,
        totalAiTokens,
        totalYandexSyncs,
        totalApiRequests,
        estimatedCostRub,
      },
      dailyBreakdown: usageRecords,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Управленческая таблица - сводка по проектам с KPI
 * Админы видят все проекты, обычные пользователи - только свои
 */
router.get('/management', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const isAdmin = req.isAdmin;
    const userId = req.userId;

    // Админы видят все проекты, обычные пользователи - только свои
    const allProjects = isAdmin
      ? await projectStore.getByUserIdLightweight('', true)
      : await projectStore.getByUserIdLightweight(userId!, false);

    // Для каждого проекта получаем подключения, статистику и KPI
    const projectsData = await Promise.all(allProjects.map(async (project) => {
      try {
        const connections = await clickhouseService.getConnectionsByProjectId(project.id);

        if (connections.length === 0) {
          return null; // Пропускаем проекты без подключений
        }

        // Агрегируем статистику по всем подключениям проекта
        let totalStats = {
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          ctr: 0,
          cpl: 0,
        };

        let kpiData: any = null;
        const accountLogins: string[] = [];

        for (const connection of connections) {
          accountLogins.push(connection.login);

          // Получаем статистику за период
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          const stats = await clickhouseService.query(`
            SELECT
              sum(impressions) as impressions,
              sum(clicks) as clicks,
              sum(cost) as cost
            FROM campaign_performance
            WHERE connection_id = {connectionId:String}
              AND date >= {startDate:Date}
              AND date <= {endDate:Date}
          `.replace('{connectionId:String}', `'${connection.id}'`)
           .replace('{startDate:Date}', `'${startDate.toISOString().split('T')[0]}'`)
           .replace('{endDate:Date}', `'${endDate.toISOString().split('T')[0]}'`));

          if (stats && stats.length > 0) {
            totalStats.impressions += parseInt(stats[0].impressions) || 0;
            totalStats.clicks += parseInt(stats[0].clicks) || 0;
            totalStats.cost += parseFloat(stats[0].cost) || 0;
          }

          // Получаем конверсии
          const convStats = await clickhouseService.query(`
            SELECT sum(conversions) as conversions
            FROM campaign_conversions
            WHERE connection_id = {connectionId:String}
              AND date >= {startDate:Date}
              AND date <= {endDate:Date}
          `.replace('{connectionId:String}', `'${connection.id}'`)
           .replace('{startDate:Date}', `'${startDate.toISOString().split('T')[0]}'`)
           .replace('{endDate:Date}', `'${endDate.toISOString().split('T')[0]}'`));

          if (convStats && convStats.length > 0) {
            totalStats.conversions += parseInt(convStats[0].conversions) || 0;
          }

          // Получаем KPI текущего месяца (берем первый попавшийся)
          if (!kpiData) {
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const kpi = await clickhouseService.getAccountKpi(connection.id, month);
            if (kpi) {
              const monthStats = await clickhouseService.getMonthStats(connection.id);
              kpiData = {
                targetCost: kpi.targetCost,
                targetLeads: kpi.targetLeads,
                targetCpl: kpi.targetCpl,
                currentCost: monthStats.currentCost,
                currentLeads: monthStats.currentLeads,
                costProgress: kpi.targetCost > 0 ? Math.round((monthStats.currentCost / kpi.targetCost) * 100) : 0,
                leadsProgress: kpi.targetLeads > 0 ? Math.round((monthStats.currentLeads / kpi.targetLeads) * 100) : 0,
                dayProgress: Math.round(monthStats.dayProgress * 100),
              };
            }
          }
        }

        // Рассчитываем CTR и CPL
        totalStats.ctr = totalStats.impressions > 0
          ? (totalStats.clicks / totalStats.impressions) * 100
          : 0;
        totalStats.cpl = totalStats.conversions > 0
          ? totalStats.cost / totalStats.conversions
          : 0;

        return {
          id: project.id,
          name: project.name,
          accounts: accountLogins,
          stats: totalStats,
          kpi: kpiData,
        };
      } catch (e) {
        console.error(`Error processing project ${project.id}:`, e);
        return null;
      }
    }));

    // Фильтруем null значения
    const filteredProjects = projectsData.filter(p => p !== null);

    res.json({
      period: days,
      projects: filteredProjects,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
