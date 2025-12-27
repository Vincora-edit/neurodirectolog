/**
 * Middleware для проверки доступа к проекту/подключению
 * Защищает от утечки данных между пользователями
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { projectStore } from '../models/project.model';
import { clickhouseService } from '../services/clickhouse.service';
import { createError } from './errorHandler';

/**
 * Проверяет, что пользователь имеет доступ к проекту
 * Использует projectId из params или query
 */
export const requireProjectAccess = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const projectId = req.params.projectId || req.query.projectId as string;

    if (!projectId) {
      return next(createError('Project ID is required', 400));
    }

    const project = await projectStore.getById(projectId);

    if (!project) {
      return next(createError('Project not found', 404));
    }

    // Админ имеет доступ ко всем проектам
    if (req.isAdmin) {
      req.project = project;
      return next();
    }

    // Обычный пользователь - только к своим проектам
    if (project.userId !== req.userId) {
      return next(createError('Access denied', 403));
    }

    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Проверяет, что пользователь имеет доступ к подключению
 * Использует connectionId из params или query
 */
export const requireConnectionAccess = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const connectionId = req.params.connectionId || req.query.connectionId as string;

    if (!connectionId) {
      return next(createError('Connection ID is required', 400));
    }

    const yandexConnection = await clickhouseService.getConnectionById(connectionId);

    if (!yandexConnection) {
      return next(createError('Connection not found', 404));
    }

    // Админ имеет доступ ко всем подключениям
    if (req.isAdmin) {
      req.yandexConnection = yandexConnection;
      return next();
    }

    // Обычный пользователь - только к своим подключениям
    if (yandexConnection.userId !== req.userId) {
      return next(createError('Access denied', 403));
    }

    req.yandexConnection = yandexConnection;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Проверяет доступ к проекту через projectId или connectionId
 * Гибкий middleware для роутов, которые могут принимать оба параметра
 */
export const requireResourceAccess = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const projectId = req.params.projectId || req.query.projectId as string;
    const connectionId = req.params.connectionId || req.query.connectionId as string;

    // Если есть connectionId - проверяем через него
    if (connectionId) {
      const yandexConnection = await clickhouseService.getConnectionById(connectionId);

      if (!yandexConnection) {
        return next(createError('Connection not found', 404));
      }

      if (!req.isAdmin && yandexConnection.userId !== req.userId) {
        return next(createError('Access denied', 403));
      }

      req.yandexConnection = yandexConnection;
      return next();
    }

    // Иначе проверяем через projectId
    if (projectId) {
      const project = await projectStore.getById(projectId);

      if (!project) {
        return next(createError('Project not found', 404));
      }

      if (!req.isAdmin && project.userId !== req.userId) {
        return next(createError('Access denied', 403));
      }

      req.project = project;
      return next();
    }

    return next(createError('Project ID or Connection ID is required', 400));
  } catch (error) {
    next(error);
  }
};

// Расширяем AuthRequest для хранения проекта/подключения
declare module './auth' {
  interface AuthRequest {
    project?: any;
    yandexConnection?: any;
  }
}
