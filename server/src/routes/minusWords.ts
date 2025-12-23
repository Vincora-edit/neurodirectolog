import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { openAIService } from '../services/openai.service';
import { minusWordsService } from '../services/minusWords.service';
import { excelService } from '../services/excel.service';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * Генерация минус-слов (простой метод)
 */
router.post('/generate', authenticate, async (req, res, next) => {
  try {
    const { keywords, niche } = req.body;

    if (!keywords || !niche) {
      throw createError('Keywords and niche are required', 400);
    }

    const minusWords = await openAIService.generateMinusWords(
      keywords,
      niche
    );

    res.json({
      success: true,
      data: {
        minusWords,
        count: minusWords.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * НОВОЕ: Анализ поисковых запросов с метриками
 */
router.post('/analyze', authenticate, async (req, res, next) => {
  try {
    const { queries, niche, businessInfo } = req.body;

    if (!queries || !Array.isArray(queries) || !niche || !businessInfo) {
      throw createError('Queries array, niche and businessInfo are required', 400);
    }

    const analysis = await minusWordsService.analyzeSearchQueries(
      queries,
      niche,
      businessInfo
    );

    const report = minusWordsService.generateOptimizationReport(analysis);
    const minusWords = minusWordsService.extractMinusWords(analysis);

    res.json({
      success: true,
      data: {
        analysis,
        report,
        minusWords,
        count: minusWords.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Экспорт минус-слов
 */
router.post('/export', authenticate, async (req, res, next) => {
  try {
    const { minusWords } = req.body;

    if (!minusWords || !Array.isArray(minusWords)) {
      throw createError('Minus words array is required', 400);
    }

    const filePath = await excelService.exportMinusWords(minusWords);

    res.json({
      success: true,
      data: {
        filePath,
        message: 'Minus words exported successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
