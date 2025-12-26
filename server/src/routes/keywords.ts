import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { openAIService } from '../services/openai.service';
import { createError } from '../middleware/errorHandler';
import { projectStore } from '../models/project.model';

const router = Router();

/**
 * Анализ и классификация поисковых запросов
 */
router.post('/analyze', authenticate, async (req, res, next) => {
  try {
    const { keywords, niche, businessDescription, projectId } = req.body;
    const userId = (req as AuthRequest).userId;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      throw createError('Keywords array is required and must not be empty', 400);
    }

    if (keywords.length > 1000) {
      throw createError('Maximum 1000 keywords allowed per analysis', 400);
    }

    if (!niche || !businessDescription) {
      throw createError('Niche and business description are required', 400);
    }

    // Фильтруем пустые строки и дубли
    const cleanedKeywords = Array.from(new Set(
      keywords
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0)
    ));

    // Анализируем через OpenAI
    const analysis = await openAIService.analyzeKeywords(
      cleanedKeywords,
      niche,
      businessDescription
    );

    // Если указан projectId, сохраняем результат
    if (projectId) {
      const project = await projectStore.getById(projectId);

      if (project && project.userId === userId) {
        await projectStore.saveKeywordAnalysis(projectId, analysis);
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

export default router;
