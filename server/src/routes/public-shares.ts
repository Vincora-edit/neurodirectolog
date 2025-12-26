import { Router, Request, Response, NextFunction } from 'express';
import { clickhouseService } from '../services/clickhouse.service';
import { authenticate } from '../middleware/auth';

const router = Router();

// Все роуты требуют авторизации
router.use(authenticate);

// Создать публичную ссылку
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connectionId, name, expiresInDays } = req.body;
    const userId = (req as any).user.userId;

    if (!connectionId) {
      return res.status(400).json({ error: 'connectionId is required' });
    }

    // Проверяем что подключение существует и принадлежит пользователю
    const connection = await clickhouseService.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    if (connection.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Вычисляем дату истечения
    let expiresAt: Date | undefined;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const shareId = await clickhouseService.createPublicShare({
      connectionId,
      userId,
      name: name || `Ссылка от ${new Date().toLocaleDateString('ru-RU')}`,
      expiresAt,
    });

    res.status(201).json({
      id: shareId,
      url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/public/${shareId}`,
    });
  } catch (error) {
    next(error);
  }
});

// Получить все ссылки для подключения
router.get('/connection/:connectionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connectionId } = req.params;
    const userId = (req as any).user.userId;

    // Проверяем доступ
    const connection = await clickhouseService.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    if (connection.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const shares = await clickhouseService.getPublicSharesByConnection(connectionId);

    // Фильтруем только активные (не удалённые)
    const activeShares = shares.filter(s => {
      // Если expires_at в прошлом и is_active = 0, это удалённая запись
      if (!s.is_active && s.expires_at) {
        const expDate = new Date(s.expires_at);
        if (expDate.getFullYear() === 2000) return false;
      }
      return true;
    });

    res.json(activeShares.map(s => ({
      id: s.id,
      name: s.name,
      isActive: Boolean(s.is_active),
      expiresAt: s.expires_at,
      createdAt: s.created_at,
      url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/public/${s.id}`,
    })));
  } catch (error) {
    next(error);
  }
});

// Обновить ссылку (включить/выключить)
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isActive, name } = req.body;
    const userId = (req as any).user.userId;

    // Проверяем что ссылка существует
    const share = await clickhouseService.getPublicShareById(id);
    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }
    if (share.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await clickhouseService.updatePublicShare(id, { isActive, name });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Удалить ссылку
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Проверяем что ссылка существует
    const share = await clickhouseService.getPublicShareById(id);
    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }
    if (share.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await clickhouseService.deletePublicShare(id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
