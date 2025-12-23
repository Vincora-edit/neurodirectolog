import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { openAIService } from '../services/openai.service';
import { createError } from '../middleware/errorHandler';
import { projectStore } from '../models/project.model';

const router = Router();

/**
 * Анализ целевой аудитории (детальная таблица с 18 полями)
 */
router.post('/target-audience', authenticate, async (req, res, next) => {
  try {
    const { niche, businessDescription, geo, projectId } = req.body;

    if (!niche || !businessDescription || !geo) {
      throw createError('Niche, business description and geo are required', 400);
    }

    const analysis = await openAIService.analyzeTargetAudience(
      niche,
      businessDescription,
      geo
    );

    // Если указан projectId, сохраняем анализ в проект
    if (projectId) {
      const userId = (req as AuthRequest).userId;
      const project = projectStore.getById(projectId);

      if (project && project.userId === userId) {
        const existingAnalytics = project.analytics || {};
        projectStore.saveAnalytics(projectId, {
          ...existingAnalytics,
          targetAudienceAnalysis: analysis,
        });
      }
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Анализ посадочной страницы
 */
router.post('/landing-page', authenticate, async (req, res, next) => {
  try {
    const { website, niche, businessDescription, projectId } = req.body;

    if (!website || !niche || !businessDescription) {
      throw createError('Website, niche and business description are required', 400);
    }

    const analysis = await openAIService.analyzeLandingPage(
      website,
      niche,
      businessDescription
    );

    // Если указан projectId, сохраняем анализ в проект
    if (projectId) {
      const userId = (req as AuthRequest).userId;
      const project = projectStore.getById(projectId);

      if (project && project.userId === userId) {
        const existingAnalytics = project.analytics || {};
        projectStore.saveAnalytics(projectId, {
          ...existingAnalytics,
          landingPageAnalysis: analysis,
        });
      }
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Генерация медиаплана
 */
router.post('/media-plan', authenticate, async (req, res, next) => {
  try {
    const { niche, businessDescription, budget, budgetPeriod, goals, geo, projectId } = req.body;

    if (!niche || !businessDescription || !budget || !goals || !geo) {
      throw createError('All parameters are required', 400);
    }

    const mediaPlan = await openAIService.generateMediaPlan(
      niche,
      businessDescription,
      budget,
      budgetPeriod || 'месяц',
      goals,
      geo
    );

    // Если указан projectId, сохраняем медиаплан в проект
    if (projectId) {
      const userId = (req as AuthRequest).userId;
      const project = projectStore.getById(projectId);

      if (project && project.userId === userId) {
        const existingAnalytics = project.analytics || {};
        projectStore.saveAnalytics(projectId, {
          ...existingAnalytics,
          mediaPlan: mediaPlan,
        });
      }
    }

    res.json({
      success: true,
      data: mediaPlan
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Полный предзапусковой анализ (ЦА + Посадочная + Медиаплан)
 */
router.post('/full-analysis', authenticate, async (req, res, next) => {
  try {
    const { niche, businessDescription, website, budget, budgetPeriod, goals, geo, projectId } = req.body;

    if (!niche || !businessDescription || !website || !budget || !goals || !geo) {
      throw createError('All parameters are required', 400);
    }

    // Запускаем все анализы параллельно
    const [audienceAnalysis, landingPageAnalysis, mediaPlan] = await Promise.all([
      openAIService.analyzeTargetAudience(niche, businessDescription, geo),
      openAIService.analyzeLandingPage(website, niche, businessDescription),
      openAIService.generateMediaPlan(niche, businessDescription, budget, budgetPeriod || 'месяц', goals, geo)
    ]);

    const fullAnalysis = {
      targetAudienceAnalysis: audienceAnalysis,
      landingPageAnalysis: landingPageAnalysis,
      mediaPlan: mediaPlan,
    };

    // Если указан projectId, сохраняем полный анализ в проект
    if (projectId) {
      const userId = (req as AuthRequest).userId;
      const project = projectStore.getById(projectId);

      if (project && project.userId === userId) {
        const existingAnalytics = project.analytics || {};
        projectStore.saveAnalytics(projectId, {
          ...existingAnalytics,
          ...fullAnalysis,
        });
      }
    }

    res.json({
      success: true,
      data: fullAnalysis
    });
  } catch (error) {
    next(error);
  }
});

export default router;
