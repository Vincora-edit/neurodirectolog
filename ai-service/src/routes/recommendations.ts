/**
 * AI Recommendations Routes
 *
 * Proactive AI recommendations for campaign optimization
 */

import express from 'express';
import { chatCompletionJson } from '../services/openai.service';

const router = express.Router();

interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpl: number;
}

interface DailyMetrics {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

/**
 * POST /api/ai/recommendations/daily
 * Get daily AI recommendations based on campaign data
 */
router.post('/daily', async (req, res) => {
  try {
    const { campaigns, recentTrends, businessDescription, targetCpl, budget } = req.body as {
      campaigns: CampaignMetrics[];
      recentTrends?: DailyMetrics[];
      businessDescription: string;
      targetCpl?: number;
      budget?: number;
    };

    if (!campaigns || !Array.isArray(campaigns)) {
      return res.status(400).json({
        success: false,
        error: 'campaigns array is required',
      });
    }

    const prompt = `Ты - AI-ассистент директолога в Яндекс.Директ. Проанализируй данные и дай практические рекомендации на сегодня.

Бизнес: ${businessDescription || 'Не указано'}
${targetCpl ? `Целевой CPL: ${targetCpl}₽` : ''}
${budget ? `Дневной бюджет: ${budget}₽` : ''}

Кампании:
${JSON.stringify(campaigns.map(c => ({
  ...c,
  cost: Math.round(c.cost),
  cpc: Math.round(c.cpc),
  cpl: c.cpl > 0 ? Math.round(c.cpl) : 'нет конверсий',
  ctr: c.ctr.toFixed(2) + '%'
})), null, 2)}

${recentTrends ? `Тренды за последние дни:\n${JSON.stringify(recentTrends, null, 2)}` : ''}

Дай 3-5 конкретных рекомендаций, которые можно применить сегодня.

Верни JSON:
{
  "recommendations": [
    {
      "id": "уникальный id",
      "type": "budget|bids|targeting|creative|structure|other",
      "priority": "high|medium|low",
      "title": "короткий заголовок",
      "description": "подробное описание что делать",
      "impact": "ожидаемый результат",
      "effort": "quick|medium|significant",
      "affectedCampaigns": ["id кампании 1", "..."]
    }
  ],
  "alerts": [
    {
      "severity": "critical|warning|info",
      "message": "текст алерта",
      "campaignId": "id кампании (опционально)"
    }
  ],
  "dailySummary": "краткое резюме состояния рекламы на сегодня"
}`;

    const aiResult = await chatCompletionJson<any>(prompt);

    res.json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    console.error('[DailyRecommendations] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/recommendations/ad-copy
 * Generate ad copy recommendations
 */
router.post('/ad-copy', async (req, res) => {
  try {
    const { currentAds, keywords, businessDescription, targetAudience, usps } = req.body as {
      currentAds?: { headline: string; description: string; ctr?: number }[];
      keywords: string[];
      businessDescription: string;
      targetAudience?: string;
      usps?: string[];
    };

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'keywords array is required',
      });
    }

    const prompt = `Ты - копирайтер для контекстной рекламы Яндекс.Директ. Создай эффективные объявления.

Бизнес: ${businessDescription}
${targetAudience ? `Целевая аудитория: ${targetAudience}` : ''}
${usps ? `УТП: ${usps.join(', ')}` : ''}

Ключевые слова: ${keywords.join(', ')}

${currentAds ? `Текущие объявления:\n${JSON.stringify(currentAds, null, 2)}` : ''}

Создай 3-5 вариантов объявлений для Яндекс.Директ.

Требования к заголовку:
- Максимум 56 символов
- Включить ключевое слово или его вариацию
- Призыв к действию или выгода

Требования к описанию:
- Максимум 81 символ
- Конкретные выгоды и призыв к действию

Верни JSON:
{
  "adVariants": [
    {
      "headline": "заголовок (до 56 символов)",
      "description": "описание (до 81 символа)",
      "targetKeywords": ["ключевое слово 1", "..."],
      "expectedCtr": "low|medium|high",
      "reasoning": "почему это объявление будет эффективным"
    }
  ],
  "headlines": [
    {
      "text": "вариант заголовка",
      "charCount": 0,
      "focus": "на что делает акцент"
    }
  ],
  "descriptions": [
    {
      "text": "вариант описания",
      "charCount": 0,
      "focus": "на что делает акцент"
    }
  ],
  "improvements": ["как улучшить текущие объявления 1", "..."]
}`;

    const aiResult = await chatCompletionJson<any>(prompt);

    res.json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    console.error('[AdCopyRecommendations] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/recommendations/keywords
 * Suggest new keywords based on performance data
 */
router.post('/keywords', async (req, res) => {
  try {
    const { currentKeywords, searchQueries, businessDescription, targetCpl } = req.body as {
      currentKeywords: { keyword: string; impressions: number; clicks: number; conversions: number; cost: number }[];
      searchQueries?: { query: string; impressions: number; clicks: number; conversions: number }[];
      businessDescription: string;
      targetCpl?: number;
    };

    if (!currentKeywords || !Array.isArray(currentKeywords)) {
      return res.status(400).json({
        success: false,
        error: 'currentKeywords array is required',
      });
    }

    const prompt = `Ты - эксперт по семантике для Яндекс.Директ. Проанализируй ключевые слова и предложи улучшения.

Бизнес: ${businessDescription}
${targetCpl ? `Целевой CPL: ${targetCpl}₽` : ''}

Текущие ключевые слова:
${JSON.stringify(currentKeywords.map(k => ({
  keyword: k.keyword,
  impressions: k.impressions,
  clicks: k.clicks,
  conversions: k.conversions,
  cost: Math.round(k.cost),
  cpl: k.conversions > 0 ? Math.round(k.cost / k.conversions) : null
})), null, 2)}

${searchQueries ? `Поисковые запросы с конверсиями:\n${JSON.stringify(searchQueries.filter(q => q.conversions > 0), null, 2)}` : ''}

Дай рекомендации по ключевым словам.

Верни JSON:
{
  "analysis": {
    "totalKeywords": 0,
    "performingWell": ["ключевое слово 1", "..."],
    "underperforming": ["ключевое слово 1", "..."],
    "toRemove": ["ключевое слово 1", "..."]
  },
  "newKeywords": [
    {
      "keyword": "новое ключевое слово",
      "matchType": "broad|phrase|exact",
      "reasoning": "почему стоит добавить",
      "estimatedTraffic": "low|medium|high"
    }
  ],
  "negativeKeywords": [
    {
      "keyword": "минус-слово",
      "reason": "почему добавить"
    }
  ],
  "structureRecommendations": ["рекомендация по структуре 1", "..."]
}`;

    const aiResult = await chatCompletionJson<any>(prompt);

    res.json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    console.error('[KeywordRecommendations] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/recommendations/budget
 * Optimize budget allocation across campaigns
 */
router.post('/budget', async (req, res) => {
  try {
    const { campaigns, totalBudget, targetCpl, businessGoals } = req.body as {
      campaigns: CampaignMetrics[];
      totalBudget: number;
      targetCpl?: number;
      businessGoals?: string;
    };

    if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'campaigns array is required',
      });
    }

    if (!totalBudget) {
      return res.status(400).json({
        success: false,
        error: 'totalBudget is required',
      });
    }

    const prompt = `Ты - эксперт по управлению бюджетом в контекстной рекламе. Оптимизируй распределение бюджета.

Общий дневной бюджет: ${totalBudget}₽
${targetCpl ? `Целевой CPL: ${targetCpl}₽` : ''}
${businessGoals ? `Бизнес-цели: ${businessGoals}` : ''}

Текущие кампании:
${JSON.stringify(campaigns.map(c => ({
  id: c.campaignId,
  name: c.campaignName,
  cost: Math.round(c.cost),
  conversions: c.conversions,
  cpl: c.cpl > 0 ? Math.round(c.cpl) : 'нет конверсий',
  ctr: c.ctr.toFixed(2) + '%'
})), null, 2)}

Предложи оптимальное распределение бюджета.

Верни JSON:
{
  "currentAllocation": [
    { "campaignId": "id", "currentBudget": 0, "share": "0%" }
  ],
  "recommendedAllocation": [
    {
      "campaignId": "id",
      "recommendedBudget": 0,
      "share": "0%",
      "change": "+X% или -X%",
      "reasoning": "почему такое распределение"
    }
  ],
  "expectedImpact": {
    "currentConversions": 0,
    "projectedConversions": 0,
    "currentCpl": 0,
    "projectedCpl": 0,
    "improvement": "описание улучшения"
  },
  "warnings": ["предупреждение 1", "..."],
  "additionalRecommendations": ["рекомендация 1", "..."]
}`;

    const aiResult = await chatCompletionJson<any>(prompt);

    res.json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    console.error('[BudgetRecommendations] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
