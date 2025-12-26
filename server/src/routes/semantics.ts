import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { openAIService } from '../services/openai.service';
import { excelService } from '../services/excel.service';
import { createError } from '../middleware/errorHandler';
import { projectStore } from '../models/project.model';
import { trackAiRequest } from '../middleware/aiTracking';

const router = Router();

/**
 * Генерация семантического ядра
 */
router.post('/generate', authenticate, trackAiRequest(2000), async (req, res, next) => {
  try {
    const { businessDescription, niche, projectId } = req.body;

    if (!businessDescription || !niche) {
      throw createError('Business description and niche are required', 400);
    }

    const keywords = await openAIService.generateSemantics(
      businessDescription,
      niche
    );

    // Если указан projectId, сохраняем результат в проект
    if (projectId) {
      const userId = (req as any).user?.userId || (req as any).userId;
      const project = await projectStore.getById(projectId);

      if (project && project.userId === userId) {
        await projectStore.saveSemantics(projectId, keywords);
      }
    }

    res.json({
      success: true,
      data: {
        keywords,
        count: keywords.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Экспорт семантики в Excel
 */
router.post('/export', authenticate, async (req, res, next) => {
  try {
    const { keywords, format: _format = 'xlsx' } = req.body;

    if (!keywords || !Array.isArray(keywords)) {
      throw createError('Keywords array is required', 400);
    }

    const filePath = await excelService.exportSemantics(keywords);

    res.json({
      success: true,
      data: {
        filePath,
        message: 'Semantics exported successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
