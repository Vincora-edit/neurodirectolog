import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { openAIService } from '../services/openai.service';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * Генерация креативных идей
 */
router.post('/generate', authenticate, async (req, res, next) => {
  try {
    const { businessInfo, targetAudience } = req.body;

    if (!businessInfo || !targetAudience) {
      throw createError('Business info and target audience are required', 400);
    }

    const creatives = await openAIService.generateCreativeIdeas(
      businessInfo,
      targetAudience
    );

    res.json({
      success: true,
      data: creatives
    });
  } catch (error) {
    next(error);
  }
});

export default router;
