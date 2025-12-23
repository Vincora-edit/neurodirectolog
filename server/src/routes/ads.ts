import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { openAIService } from '../services/openai.service';
import { yandexDirectService } from '../services/yandex.service';
import { createError } from '../middleware/errorHandler';
import { projectStore } from '../models/project.model';

const router = Router();

/**
 * Генерация заголовков объявлений
 */
router.post('/generate/headlines', authenticate, async (req, res, next) => {
  try {
    const { keywords, businessInfo, projectId } = req.body;

    if (!keywords || !businessInfo) {
      throw createError('Keywords and business info are required', 400);
    }

    const headlines = await openAIService.generateAdHeadlines(
      keywords,
      businessInfo
    );

    // Если указан projectId, сохраняем заголовки в проект
    if (projectId) {
      const userId = (req as AuthRequest).userId;
      const project = projectStore.getById(projectId);

      if (project && project.userId === userId) {
        const existingAds = project.ads || { headlines: [], texts: [] };
        projectStore.saveAds(projectId, headlines, existingAds.texts || []);
      }
    }

    res.json({
      success: true,
      data: {
        headlines,
        count: headlines.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Генерация текстов объявлений
 */
router.post('/generate/texts', authenticate, async (req, res, next) => {
  try {
    const { keywords, businessInfo, usp, projectId } = req.body;

    if (!keywords || !businessInfo || !usp) {
      throw createError('Keywords, business info and USP are required', 400);
    }

    const texts = await openAIService.generateAdTexts(
      keywords,
      businessInfo,
      usp
    );

    // Если указан projectId, сохраняем тексты в проект
    if (projectId) {
      const userId = (req as AuthRequest).userId;
      const project = projectStore.getById(projectId);

      if (project && project.userId === userId) {
        const existingAds = project.ads || { headlines: [], texts: [] };
        projectStore.saveAds(projectId, existingAds.headlines || [], texts);
      }
    }

    res.json({
      success: true,
      data: {
        texts,
        count: texts.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Создание объявлений в Яндекс.Директ
 */
router.post('/create', authenticate, async (req, res, next) => {
  try {
    const { adsData } = req.body;

    if (!adsData || !Array.isArray(adsData)) {
      throw createError('Ads data array is required', 400);
    }

    const result = await yandexDirectService.createAds(adsData);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Комплексная генерация объявлений
 * Генерирует заголовки, тексты, изображения (для РСЯ), уточнения, быстрые ссылки
 */
router.post('/generate-complete', authenticate, async (req, res, next) => {
  try {
    const { campaignType, quantity, projectId } = req.body;
    const userId = (req as AuthRequest).userId;

    if (!campaignType || !quantity || !projectId) {
      throw createError('Campaign type, quantity and projectId are required', 400);
    }

    if (campaignType !== 'search' && campaignType !== 'display') {
      throw createError('Campaign type must be "search" or "display"', 400);
    }

    if (quantity < 1 || quantity > 20) {
      throw createError('Quantity must be between 1 and 20', 400);
    }

    // Получаем проект
    const project = projectStore.getById(projectId);

    if (!project) {
      throw createError('Project not found', 404);
    }

    if (project.userId !== userId) {
      throw createError('Access denied', 403);
    }

    // Проверяем наличие брифа
    if (!project.brief) {
      throw createError('Project brief is required. Please create a brief first.', 400);
    }

    // Получаем анализ целевой аудитории (если есть)
    const targetAudienceAnalysis = project.analytics?.targetAudienceAnalysis || null;

    // Генерируем объявления через OpenAI
    const adsData = await openAIService.generateCompleteAds(
      campaignType,
      quantity,
      project.brief,
      targetAudienceAnalysis
    );

    // Сохраняем сгенерированные объявления в проект
    if (adsData && adsData.ads) {
      projectStore.saveCompleteAds(projectId, {
        campaignType,
        generatedAt: new Date().toISOString(),
        ads: adsData.ads
      });
    }

    res.json({
      success: true,
      data: adsData
    });
  } catch (error) {
    next(error);
  }
});

export default router;
