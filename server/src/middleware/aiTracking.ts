import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { usageService } from '../services/usage.service';

/**
 * Middleware для трекинга AI запросов
 * Вызывается ПОСЛЕ успешного ответа через res.on('finish')
 */
export const trackAiRequest = (estimatedTokens: number = 2000) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Сохраняем оригинальный json метод
    const originalJson = res.json.bind(res);

    // Переопределяем json чтобы трекать после успешного ответа
    res.json = (data: any) => {
      // Трекаем только успешные ответы
      if (res.statusCode >= 200 && res.statusCode < 300 && req.userId) {
        try {
          usageService.trackAiRequest(req.userId, estimatedTokens);
        } catch (e) {
          console.error('AI usage tracking error:', e);
        }
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Middleware для трекинга синхронизаций Яндекс
 */
export const trackYandexSync = () => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (data: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.userId) {
        try {
          usageService.trackYandexSync(req.userId);
        } catch (e) {
          console.error('Yandex sync tracking error:', e);
        }
      }
      return originalJson(data);
    };

    next();
  };
};
