/**
 * Campaign Analysis Routes
 *
 * AI-powered campaign performance analysis
 */

import express from 'express';
import { chatCompletionJson } from '../services/openai.service';

const router = express.Router();

interface CampaignData {
  id: string;
  name: string;
  type: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpl: number;
  bounceRate?: number;
}

interface CampaignAnalysis {
  campaignId: string;
  overallScore: number; // 0-100
  status: 'excellent' | 'good' | 'needs_attention' | 'critical';
  summary: string;
  strengths: string[];
  weaknesses: string[];
  actionItems: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
  }[];
}

interface AIAnalysisResult {
  campaigns: CampaignAnalysis[];
  overallInsights: string[];
  budgetRecommendations: {
    campaignId: string;
    currentBudget: number;
    recommendedChange: 'increase' | 'decrease' | 'maintain';
    reason: string;
  }[];
}

/**
 * POST /api/ai/campaigns/analyze
 * Analyze campaign performance with AI
 */
router.post('/analyze', async (req, res) => {
  try {
    const { campaigns, businessDescription, targetCpl, period } = req.body as {
      campaigns: CampaignData[];
      businessDescription: string;
      targetCpl?: number;
      period?: string;
    };

    if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'campaigns array is required',
      });
    }

    const prompt = `Ты - эксперт по контекстной рекламе Яндекс.Директ. Проанализируй эффективность рекламных кампаний.

Бизнес: ${businessDescription || 'Не указано'}
${targetCpl ? `Целевой CPL: ${targetCpl}₽` : ''}
Период: ${period || 'Последние 30 дней'}

Данные по кампаниям:
${JSON.stringify(campaigns.map(c => ({
  id: c.id,
  name: c.name,
  type: c.type,
  impressions: c.impressions,
  clicks: c.clicks,
  cost: Math.round(c.cost),
  conversions: c.conversions,
  ctr: c.ctr.toFixed(2) + '%',
  cpc: Math.round(c.cpc),
  cpl: c.cpl > 0 ? Math.round(c.cpl) : 'нет конверсий',
  bounceRate: c.bounceRate ? c.bounceRate.toFixed(1) + '%' : undefined
})), null, 2)}

Проанализируй каждую кампанию и дай рекомендации.

Верни JSON:
{
  "campaigns": [
    {
      "campaignId": "id кампании",
      "overallScore": 0-100,
      "status": "excellent|good|needs_attention|critical",
      "summary": "краткое резюме",
      "strengths": ["сильная сторона 1", "..."],
      "weaknesses": ["слабая сторона 1", "..."],
      "actionItems": [
        {
          "priority": "high|medium|low",
          "action": "что нужно сделать",
          "expectedImpact": "ожидаемый результат"
        }
      ]
    }
  ],
  "overallInsights": ["общий инсайт 1", "..."],
  "budgetRecommendations": [
    {
      "campaignId": "id",
      "currentBudget": 0,
      "recommendedChange": "increase|decrease|maintain",
      "reason": "почему"
    }
  ]
}`;

    const aiResult = await chatCompletionJson<AIAnalysisResult>(prompt);

    res.json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    console.error('[CampaignAnalysis] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/campaigns/diagnose
 * Diagnose issues with underperforming campaigns
 */
router.post('/diagnose', async (req, res) => {
  try {
    const { campaign, adGroups, keywords, ads, businessDescription } = req.body;

    if (!campaign) {
      return res.status(400).json({
        success: false,
        error: 'campaign data is required',
      });
    }

    const prompt = `Ты - эксперт по контекстной рекламе Яндекс.Директ. Кампания показывает плохие результаты, проведи диагностику.

Бизнес: ${businessDescription || 'Не указано'}

Кампания:
${JSON.stringify(campaign, null, 2)}

${adGroups ? `Группы объявлений:\n${JSON.stringify(adGroups, null, 2)}` : ''}
${keywords ? `Ключевые слова:\n${JSON.stringify(keywords, null, 2)}` : ''}
${ads ? `Объявления:\n${JSON.stringify(ads, null, 2)}` : ''}

Проведи диагностику и определи причины низкой эффективности.

Верни JSON:
{
  "diagnosis": {
    "severity": "critical|high|medium|low",
    "mainIssues": ["проблема 1", "проблема 2"],
    "rootCauses": ["причина 1", "причина 2"],
    "affectedMetrics": ["CTR", "CPL", ...]
  },
  "recommendations": [
    {
      "issue": "описание проблемы",
      "solution": "как исправить",
      "priority": "high|medium|low",
      "effort": "quick|medium|significant",
      "expectedImprovement": "ожидаемое улучшение"
    }
  ],
  "quickWins": ["быстрое улучшение 1", "..."],
  "structuralChanges": ["структурное изменение 1", "..."]
}`;

    const aiResult = await chatCompletionJson<any>(prompt);

    res.json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    console.error('[CampaignDiagnose] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
