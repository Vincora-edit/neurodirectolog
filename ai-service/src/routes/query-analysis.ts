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

ЗАДАЧА: Определи минус-слова с правильными операторами Яндекс.Директ.

ОПЕРАТОРЫ ЯНДЕКС.ДИРЕКТ:
- ! перед словом - фиксирует окончание (пример: !мигрантов - только это слово, не "мигрант")
- "слово" в кавычках - только точное слово (пример: "гражданство" - блокирует ТОЛЬКО запрос из одного слова)
- Без оператора - блокирует все формы слова

МУСОРНЫЕ СЛОВА (можно минусовать):
- Слова про законы/правила: новости, изменения, закон, статья, правила, новые
- Слова про госорганы: федеральная, служба, управление, учреждение (с !)
- Слова про другие страны/регионы если бизнес локальный: европейский, европа
- Слова информационного интента: пускают, если (осторожно)

ЦЕЛЕВЫЕ СЛОВА (НИКОГДА НЕ МИНУСОВАТЬ):
- Коммерческие: оформить, сделать, получить, заказать, помощь, услуги
- Вопросительные с коммерческим интентом: где, как, куда, обратиться, можно, надо
- Контактные: номер, телефон, адрес, консультация, цена, цены, стоимость
- Документы: документы, оформлении, оформление
- Ключевые для бизнеса: ${safeWords.slice(0, 30).join(', ')}

ПРИМЕР ПРАВИЛЬНЫХ МИНУС-СЛОВ:
- !мигрантов (с фиксацией окончания - не заденет "мигрант")
- !пускают (с фиксацией)
- "гражданство" (только одиночный запрос)
- европейскому (без оператора - редкое слово)
- изменения (без оператора - явно информационное)

Слова для анализа:
${JSON.stringify(wordData, null, 2)}

Верни JSON:
{
  "minusWords": [
    {
      "word": "слово с оператором если нужен (например !мигрантов или \\"гражданство\\")",
      "reason": "краткое объяснение",
      "confidence": "high|medium|low",
      "operator": "none|exclamation|quotes"
    }
  ]
}

ВАЖНО:
- confidence: "high" - 100% мусор, можно минусовать сразу
- confidence: "medium" - нужна проверка на большем массиве данных
- operator: "exclamation" = !, "quotes" = "", "none" = без оператора
- Верни ТОЛЬКО слова которые ТОЧНО мусорные
- НЕ включай целевые слова из списка выше!`;

    interface WordAnalysisResult {
      minusWords: Array<{
        word: string;
        reason: string;
        confidence: 'high' | 'medium' | 'low';
        operator?: 'none' | 'exclamation' | 'quotes';
      }>;
    }

    const aiResult = await chatCompletionJson<WordAnalysisResult>(prompt);

    console.log(`[WordAnalysis] AI recommended ${aiResult.minusWords?.length || 0} minus words`);

    // Format words with operators
    const formattedMinusWords = (aiResult.minusWords || []).map(mw => {
      let formattedWord = mw.word;
      // If AI already included operator in word, keep it
      if (!formattedWord.startsWith('!') && !formattedWord.startsWith('"')) {
        if (mw.operator === 'exclamation') {
          formattedWord = `!${mw.word}`;
        } else if (mw.operator === 'quotes') {
          formattedWord = `"${mw.word}"`;
        }
      }
      return {
        ...mw,
        word: formattedWord,
      };
    });

    res.json({
      success: true,
      data: {
        minusWords: formattedMinusWords,
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

/**
 * POST /api/ai/queries/classify-queries
 * Classify review queries as target or trash
 *
 * This endpoint evaluates full queries (not words) to determine
 * if they are target (commercial intent) or trash (irrelevant)
 */
router.post('/classify-queries', async (req, res) => {
  try {
    const { queries, businessDescription, safeWords } = req.body as {
      queries: Array<{
        query: string;
        cost: number;
        clicks: number;
        impressions: number;
      }>;
      businessDescription: string;
      safeWords: string[];
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

    // Take top 50 by cost
    const topQueries = queries
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 50);

    const queryData = topQueries.map(q => ({
      query: q.query,
      cost: Math.round(q.cost),
      clicks: q.clicks,
    }));

    const prompt = `Ты - эксперт по контекстной рекламе Яндекс.Директ. Проанализируй поисковые запросы.

Бизнес: ${businessDescription}

ЗАДАЧА: Определи категорию каждого запроса - TARGET или TRASH.

TARGET (целевой) - запросы от людей, которые ХОТЯТ КУПИТЬ услугу:
- Коммерческий интент (оформить, получить, заказать, цена, стоимость)
- Релевантны бизнесу
- Могут привести к конверсии

TRASH (мусор) - запросы которые НЕ приведут к покупке:
- Информационный интент (что это, как, почему, новости, закон, статья)
- Запросы про другие услуги/регионы
- Непонятные/бессмысленные запросы
- Запросы про госорганы (если бизнес не госорган)
- Запросы про самостоятельное оформление

Безопасные слова (есть в конвертирующих запросах): ${safeWords.slice(0, 30).join(', ')}

Запросы для анализа:
${JSON.stringify(queryData, null, 2)}

Верни JSON:
{
  "results": [
    {
      "query": "текст запроса",
      "category": "target|trash",
      "reason": "краткое объяснение (10-15 слов)",
      "minusWord": "слово для минусации (только для trash, опционально)"
    }
  ]
}

ВАЖНО:
- Если не уверен - лучше оставить как target
- minusWord должно быть одно конкретное слово из запроса`;

    interface ClassifyResult {
      results: Array<{
        query: string;
        category: 'target' | 'trash';
        reason: string;
        minusWord?: string;
      }>;
    }

    const aiResult = await chatCompletionJson<ClassifyResult>(prompt);

    console.log(`[ClassifyQueries] Classified ${aiResult.results?.length || 0} queries`);

    // Count stats
    const trashCount = aiResult.results?.filter(r => r.category === 'trash').length || 0;
    console.log(`[ClassifyQueries] Trash: ${trashCount}, Target: ${(aiResult.results?.length || 0) - trashCount}`);

    res.json({
      success: true,
      data: {
        results: aiResult.results || [],
      },
    });
  } catch (error: any) {
    console.error('[ClassifyQueries] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
