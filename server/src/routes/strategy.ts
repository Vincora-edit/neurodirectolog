import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { openAIService } from '../services/openai.service';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * Генерация стратегии запуска кампании
 */
router.post('/generate', authenticate, async (req, res, next) => {
  try {
    const { businessInfo, budget, goals } = req.body;

    if (!businessInfo || !budget || !goals) {
      throw createError('Business info, budget and goals are required', 400);
    }

    const strategy = await openAIService.generateLaunchStrategy(
      businessInfo,
      budget,
      goals
    );

    res.json({
      success: true,
      data: strategy
    });
  } catch (error) {
    next(error);
  }
});

export default router;
