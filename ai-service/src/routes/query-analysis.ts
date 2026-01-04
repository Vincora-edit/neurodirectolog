/**
 * Query Analysis Routes
 *
 * AI-powered search query analysis
 */

import express from 'express';
import { chatCompletionJson } from '../services/openai.service';

const router = express.Router();

interface SearchQuery {
  query: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  cpl: number;
}

interface AnalyzedQuery {
  query: string;
  category: 'target' | 'trash' | 'review';
  reason: string;
  minusWords: string[];
}

interface SuggestedMinusWord {
  word: string;
  reason: string;
  category: 'irrelevant' | 'low_quality' | 'competitor' | 'informational' | 'other';
}

interface AIAnalysisResult {
  queries: AnalyzedQuery[];
  suggestedMinusWords: SuggestedMinusWord[];
}

/**
 * POST /api/ai/queries/analyze
 * Analyze search queries with AI
 */
router.post('/analyze', async (req, res) => {
  try {
    const { queries, businessDescription, targetCpl } = req.body as {
      queries: SearchQuery[];
      businessDescription: string;
      targetCpl?: number;
    };

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'queries array is required',
      });
    }

    if (!businessDescription) {
      return res.status(400).json({
        success: false,
        error: 'businessDescription is required',
      });
    }

    // Sort by cost descending, take top 200
    const sortedQueries = [...queries].sort((a, b) => b.cost - a.cost);
    const topQueries = sortedQueries.slice(0, 200);

    // Prepare data for AI
    const queryData = topQueries.map(q => ({
      query: q.query,
      impressions: q.impressions,
      clicks: q.clicks,
      cost: Math.round(q.cost),
      conversions: q.conversions,
      ctr: q.ctr.toFixed(2),
      cpl: q.cpl > 0 ? Math.round(q.cpl) : null,
    }));

    const prompt = `Ты - эксперт по контекстной рекламе Яндекс.Директ. Проанализируй поисковые запросы для бизнеса.

Бизнес: ${businessDescription}
${targetCpl ? `Целевой CPL: ${targetCpl}₽` : ''}

Поисковые запросы (отсортированы по затратам):
${JSON.stringify(queryData, null, 2)}

Категоризируй каждый запрос:
1. TARGET (целевой) - запросы с коммерческим интентом, соответствующие бизнесу
2. TRASH (мусор) - нерелевантные запросы, информационные, конкуренты, ошибочные
3. REVIEW (требует проверки) - неоднозначные запросы

ВАЖНО: Обращай внимание на CTR! Запросы с высокими показами (100+), но очень низким CTR (<1%) или 0 кликов — скорее всего нерелевантные и должны быть помечены как TRASH или REVIEW.

Для TRASH запросов предложи минус-слова.

Верни JSON:
{
  "queries": [
    {
      "query": "текст запроса",
      "category": "target|trash|review",
      "reason": "краткое объяснение",
      "minusWords": ["слово1", "слово2"]
    }
  ],
  "suggestedMinusWords": [
    {
      "word": "минус-слово",
      "reason": "почему нужно добавить",
      "category": "irrelevant|low_quality|competitor|informational|other"
    }
  ]
}`;

    const aiResult = await chatCompletionJson<AIAnalysisResult>(prompt);

    // Build response
    const targetQueries: any[] = [];
    const trashQueries: any[] = [];
    const reviewQueries: any[] = [];

    const queryMap = new Map(topQueries.map(q => [q.query, q]));

    for (const analyzed of aiResult.queries || []) {
      const original = queryMap.get(analyzed.query);
      if (!original) continue;

      const analysis = {
        query: analyzed.query,
        category: analyzed.category,
        reason: analyzed.reason,
        suggestedMinusWords: analyzed.minusWords || [],
        metrics: {
          impressions: original.impressions,
          clicks: original.clicks,
          cost: original.cost,
          conversions: original.conversions,
          ctr: original.ctr,
          cpl: original.cpl,
        },
      };

      switch (analyzed.category) {
        case 'target':
          targetQueries.push(analysis);
          break;
        case 'trash':
          trashQueries.push(analysis);
          break;
        case 'review':
          reviewQueries.push(analysis);
          break;
      }
    }

    // Process minus words
    const minusWordMap = new Map<string, any>();
    for (const mw of aiResult.suggestedMinusWords || []) {
      let queriesAffected = 0;
      let potentialSavings = 0;

      for (const trash of trashQueries) {
        if (trash.query.toLowerCase().includes(mw.word.toLowerCase())) {
          queriesAffected++;
          potentialSavings += (queryMap.get(trash.query)?.cost || 0);
        }
      }

      minusWordMap.set(mw.word.toLowerCase(), {
        word: mw.word,
        reason: mw.reason,
        category: mw.category,
        queriesAffected,
        potentialSavings,
      });
    }

    // Calculate summary
    const totalCost = queries.reduce((sum, q) => sum + q.cost, 0);
    const wastedCost = trashQueries.reduce((sum, q) => sum + (queryMap.get(q.query)?.cost || 0), 0);

    res.json({
      success: true,
      data: {
        totalQueries: queries.length,
        analyzedQueries: topQueries.length,
        targetQueries,
        trashQueries,
        reviewQueries,
        suggestedMinusWords: Array.from(minusWordMap.values())
          .sort((a, b) => b.potentialSavings - a.potentialSavings),
        summary: {
          totalCost,
          wastedCost,
          potentialSavings: wastedCost,
        },
      },
    });
  } catch (error: any) {
    console.error('[QueryAnalysis] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/ai/queries/analyze-words
 * Analyze individual words for minus-word candidates
 *
 * This endpoint evaluates words (not full queries) against business description
 * to find words that should be added as minus-words
 */
router.post('/analyze-words', async (req, res) => {
  try {
    const { words, businessDescription, safeWords } = req.body as {
      words: Array<{
        word: string;
        totalCost: number;
        totalClicks: number;
        queriesCount: number;
        exampleQueries: string[];
      }>;
      businessDescription: string;
      safeWords: string[];
    };

    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'words array is required',
      });
    }

    if (!businessDescription) {
      return res.status(400).json({
        success: false,
        error: 'businessDescription is required',
      });
    }

    // Prepare data for AI - top 100 by cost
    const topWords = words
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 100);

    const wordData = topWords.map(w => ({
      word: w.word,
      cost: Math.round(w.totalCost),
      clicks: w.totalClicks,
      queries: w.queriesCount,
      examples: w.exampleQueries.slice(0, 2),
    }));

    const prompt = `Ты - эксперт по контекстной рекламе Яндекс.Директ. Проанализируй слова из поисковых запросов БЕЗ конверсий.

Бизнес: ${businessDescription}

ЗАДАЧА: Определи, какие слова являются мусорными и должны быть добавлены как минус-слова.

Мусорные слова - это:
- Слова указывающие на информационный интент (новости, изменения, закон, статья, форум)
- Слова указывающие на другой бизнес (курсы, обучение, выучить)
- Слова указывающие на госорганы если мы не госорган (федеральная, служба, управление)
- Слова указывающие на самостоятельное решение (самостоятельно, своими руками, инструкция)
- Географические слова если бизнес локальный
- Слова конкурентов

ВАЖНО: НИКОГДА не добавляй слова которые могут быть частью целевого запроса!
Например, для миграционных услуг слова "рвп", "внж", "гражданство", "оформить", "получить" - это ЦЕЛЕВЫЕ слова.

Безопасные слова (есть в конвертирующих запросах, НЕ минусовать): ${safeWords.slice(0, 50).join(', ')}

Слова для анализа (отсортированы по затратам):
${JSON.stringify(wordData, null, 2)}

Верни JSON со словами которые ТОЧНО нужно заминусовать:
{
  "minusWords": [
    {
      "word": "слово",
      "reason": "почему это мусор (коротко)",
      "confidence": "high|medium|low"
    }
  ]
}

ВАЖНО:
- confidence: "high" - 100% мусор, можно минусовать без проверки
- confidence: "medium" - скорее всего мусор, но стоит проверить
- confidence: "low" - возможно мусор, требует ручной проверки
- Верни ТОЛЬКО те слова, которые действительно мусорные
- НЕ добавляй слова если не уверен`;

    interface WordAnalysisResult {
      minusWords: Array<{
        word: string;
        reason: string;
        confidence: 'high' | 'medium' | 'low';
      }>;
    }

    const aiResult = await chatCompletionJson<WordAnalysisResult>(prompt);

    console.log(`[WordAnalysis] AI recommended ${aiResult.minusWords?.length || 0} minus words`);

    res.json({
      success: true,
      data: {
        minusWords: aiResult.minusWords || [],
      },
    });
  } catch (error: any) {
    console.error('[WordAnalysis] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
