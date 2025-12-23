import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { projectStore, ProjectBrief } from '../models/project.model';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * Создание нового проекта с брифом
 */
router.post('/create', authenticate, async (req, res, next) => {
  try {
    const { name, brief } = req.body;
    const userId = (req as AuthRequest).userId;

    if (!name || !brief) {
      throw createError('Name and brief are required', 400);
    }

    // Валидация обязательных полей брифа
    if (!brief.businessName || !brief.niche || !brief.businessDescription) {
      throw createError('Business name, niche and description are required in brief', 400);
    }

    const project = projectStore.create(userId, name, brief as ProjectBrief);

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Получение списка проектов пользователя
 */
router.get('/list', authenticate, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId;
    const projects = projectStore.getByUserId(userId);

    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Получение конкретного проекта
 */
router.get('/:projectId', authenticate, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = (req as AuthRequest).userId;

    const project = projectStore.getById(projectId);

    if (!project) {
      throw createError('Project not found', 404);
    }

    if (project.userId !== userId) {
      throw createError('Access denied', 403);
    }

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Обновление проекта/брифа
 */
router.put('/:projectId', authenticate, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = (req as AuthRequest).userId;
    const updates = req.body;

    const project = projectStore.getById(projectId);

    if (!project) {
      throw createError('Project not found', 404);
    }

    if (project.userId !== userId) {
      throw createError('Access denied', 403);
    }

    const updatedProject = projectStore.update(projectId, updates);

    res.json({
      success: true,
      data: updatedProject
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Удаление проекта
 */
router.delete('/:projectId', authenticate, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = (req as AuthRequest).userId;

    const project = projectStore.getById(projectId);

    if (!project) {
      throw createError('Project not found', 404);
    }

    if (project.userId !== userId) {
      throw createError('Access denied', 403);
    }

    projectStore.delete(projectId);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Получение результатов конкретного модуля
 */
router.get('/:projectId/:module', authenticate, async (req, res, next) => {
  try {
    const { projectId, module } = req.params;
    const userId = (req as AuthRequest).userId;

    const project = projectStore.getById(projectId);

    if (!project) {
      throw createError('Project not found', 404);
    }

    if (project.userId !== userId) {
      throw createError('Access denied', 403);
    }

    const validModules = ['semantics', 'creatives', 'ads', 'minusWords', 'campaigns', 'strategy'];
    if (!validModules.includes(module)) {
      throw createError('Invalid module', 400);
    }

    const moduleData = project[module as keyof typeof project];

    res.json({
      success: true,
      data: moduleData || null
    });
  } catch (error) {
    next(error);
  }
});

export default router;
