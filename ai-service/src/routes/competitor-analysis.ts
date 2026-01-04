/**
 * Competitor Analysis Routes
 *
 * AI-powered competitor analysis based on ad data
 */

import express from 'express';
import { chatCompletionJson } from '../services/openai.service';

const router = express.Router();

interface CompetitorAd {
  headline: string;
  description?: string;
  url?: string;
  position?: number;
}

interface CompetitorData {
  domain: string;
  ads?: CompetitorAd[];
  keywords?: string[];
  estimatedBudget?: number;
}

/**
 * POST /api/ai/competitors/analyze
 * Analyze competitors based on their ads and keywords
 */
router.post('/analyze', async (req, res) => {
  try {
    const { competitors, myBusiness, myAds, myKeywords } = req.body as {
      competitors: CompetitorData[];
      myBusiness: string;
      myAds?: { headline: string; description: string }[];
      myKeywords?: string[];
    };

    if (!competitors || !Array.isArray(competitors) || competitors.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'competitors array is required',
      });
    }

    const prompt = `Ты - эксперт по конкурентному анализу в контекстной рекламе. Проанализируй конкурентов.

Мой бизнес: ${myBusiness || 'Не указано'}

${myAds ? `Мои объявления:\n${JSON.stringify(myAds, null, 2)}` : ''}
${myKeywords ? `Мои ключевые слова:\n${JSON.stringify(myKeywords, null, 2)}` : ''}

Конкуренты:
${JSON.stringify(competitors, null, 2)}

Проанализируй конкурентов и дай рекомендации как улучшить мои рекламные кампании.

Верни JSON:
{
  "competitorProfiles": [
    {
      "domain": "домен конкурента",
      "strengths": ["сильная сторона 1", "..."],
      "weaknesses": ["слабая сторона 1", "..."],
      "uniqueSellingPoints": ["УТП 1", "..."],
      "adStrategy": "описание стратегии",
      "threatLevel": "high|medium|low"
    }
  ],
  "marketInsights": {
    "commonMessages": ["частое сообщение 1", "..."],
    "pricingTrends": "описание ценовых трендов",
    "popularKeywords": ["популярное ключевое слово 1", "..."],
    "gaps": ["пробел в рынке 1", "..."]
  },
  "recommendations": {
    "differentiators": ["как выделиться 1", "..."],
    "adCopyIdeas": [
      {
        "headline": "идея заголовка",
        "description": "идея описания",
        "reasoning": "почему это сработает"
      }
    ],
    "keywordsToTarget": ["ключевое слово 1", "..."],
    "keywordsToAvoid": ["ключевое слово 1", "..."]
  }
}`;

    const aiResult = await chatCompletionJson<any>(prompt);

    res.json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    console.error('[CompetitorAnalysis] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/competitors/benchmark
 * Compare my metrics against competitors
 */
router.post('/benchmark', async (req, res) => {
  try {
    const { myMetrics, industryBenchmarks, businessDescription } = req.body as {
      myMetrics: {
        ctr: number;
        cpc: number;
        cpl: number;
        conversionRate: number;
        bounceRate?: number;
      };
      industryBenchmarks?: {
        avgCtr?: number;
        avgCpc?: number;
        avgCpl?: number;
      };
      businessDescription: string;
    };

    if (!myMetrics) {
      return res.status(400).json({
        success: false,
        error: 'myMetrics is required',
      });
    }

    const prompt = `Ты - эксперт по контекстной рекламе. Оцени показатели рекламных кампаний относительно рынка.

Бизнес: ${businessDescription || 'Не указано'}

Мои показатели:
- CTR: ${myMetrics.ctr}%
- CPC: ${myMetrics.cpc}₽
- CPL: ${myMetrics.cpl}₽
- Конверсия: ${myMetrics.conversionRate}%
${myMetrics.bounceRate ? `- Отказы: ${myMetrics.bounceRate}%` : ''}

${industryBenchmarks ? `Бенчмарки отрасли:\n${JSON.stringify(industryBenchmarks, null, 2)}` : ''}

Оцени показатели и дай рекомендации.

Верни JSON:
{
  "scores": {
    "ctr": { "score": 0-100, "status": "above_average|average|below_average", "comment": "комментарий" },
    "cpc": { "score": 0-100, "status": "above_average|average|below_average", "comment": "комментарий" },
    "cpl": { "score": 0-100, "status": "above_average|average|below_average", "comment": "комментарий" },
    "conversionRate": { "score": 0-100, "status": "above_average|average|below_average", "comment": "комментарий" }
  },
  "overallScore": 0-100,
  "summary": "общее резюме",
  "improvements": [
    {
      "metric": "название метрики",
      "currentValue": "текущее значение",
      "targetValue": "целевое значение",
      "howToImprove": "как улучшить"
    }
  ]
}`;

    const aiResult = await chatCompletionJson<any>(prompt);

    res.json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    console.error('[Benchmark] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
