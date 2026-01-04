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

    const prompt = `Ты - эксперт по контекстной рекламе Яндекс.Директ.

=== БИЗНЕС ===
${businessDescription}

=== СЛОВА ИЗ КОНВЕРТИРУЮЩИХ ЗАПРОСОВ (НИКОГДА НЕ МИНУСОВАТЬ!) ===
${safeWords.slice(0, 50).join(', ')}

=== ГЛАВНОЕ ПРАВИЛО ===
Для КАЖДОГО слова задай вопрос: "Может ли клиент этого бизнеса использовать это слово в целевом запросе?"
Если ДА или ВОЗМОЖНО - НЕ минусовать!

ПОСМОТРИ НА ПРИМЕРЫ ЗАПРОСОВ в данных! Если примеры запросов ЦЕЛЕВЫЕ - слово целевое!

=== 🚫 АБСОЛЮТНО ЗАПРЕЩЕНО МИНУСОВАТЬ ===
КОММЕРЧЕСКИЕ ГЛАГОЛЫ (указывают на намерение купить/заказать):
- сделать, сделаю, делать
- оформить, оформление, оформления
- получить, получение, получения
- купить, покупка
- заказать, заказ
- помочь, помощь, помощи
- стоить, стоимость, цена, цены
- консультация

ВОПРОСИТЕЛЬНЫЕ СЛОВА (указывают на поиск информации для покупки):
- как, что, где, сколько, какие, какой, какая

ФОРМЫ КЛЮЧЕВЫХ СЛОВ БИЗНЕСА:
- Все падежные формы (гражданину = гражданство, документы = документ)
- Все временные формы глаголов

ОРГАНИЗАЦИИ/УЧРЕЖДЕНИЯ - клиенты ищут услуги рядом с ними

ГЕОГРАФИЯ - города, районы, страны

=== МОЖНО МИНУСОВАТЬ (только с 100% уверенностью) ===
1. ЯВНО ДРУГАЯ НИША: слова которые 100% НЕ относятся к услугам бизнеса
   Пример: "автомобиль", "ремонт", "игры" для миграционных услуг
2. ИНОСТРАННЫЕ: английские слова для русскоязычного бизнеса
3. ЧИСТО ИНФОРМАЦИОННЫЕ (только с !): !осталось, !изменения, !статистика

=== ОПЕРАТОРЫ ===
- ! - ОБЯЗАТЕЛЬНО для информационных слов
- Без оператора - ТОЛЬКО для 100% мусора из другой ниши

=== СЛОВА ДЛЯ АНАЛИЗА ===
${JSON.stringify(wordData, null, 2)}

ВАЖНО: Посмотри на примеры запросов (examples) для каждого слова!
Если примеры выглядят ЦЕЛЕВЫМИ - слово НЕЛЬЗЯ минусовать!

Верни JSON:
{
  "minusWords": [
    {
      "word": "слово",
      "reason": "причина",
      "confidence": "high|medium",
      "operator": "none|exclamation"
    }
  ]
}

🚫 ФИНАЛЬНАЯ ПРОВЕРКА перед добавлением слова:
1. Это коммерческий глагол (сделать, получить, оформить)? → НЕ ВКЛЮЧАТЬ
2. Это вопросительное слово (как, сколько, где)? → НЕ ВКЛЮЧАТЬ
3. Примеры запросов выглядят целевыми? → НЕ ВКЛЮЧАТЬ
4. Слово может появиться в целевом запросе? → НЕ ВКЛЮЧАТЬ
5. Сомневаешься? → НЕ ВКЛЮЧАТЬ

Лучше вернуть ПУСТОЙ массив чем ошибиться!`;

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

    const prompt = `Ты - эксперт по контекстной рекламе Яндекс.Директ.

=== БИЗНЕС ===
${businessDescription}

=== СЛОВА ИЗ КОНВЕРТИРУЮЩИХ ЗАПРОСОВ ===
${safeWords.slice(0, 30).join(', ')}

=== TARGET (целевой) ===
- Запрос на русском языке с коммерческим интентом
- "как оформить...", "где получить...", "сколько стоит..." - человек ищет услугу
- Содержит слова из конвертирующих запросов

=== TRASH (мусор) ===
- Запрос на ДРУГОМ ЯЗЫКЕ (английский и т.д.) - если бизнес русскоязычный
- ДРУГАЯ НИША: "выучить русский", "курсы языка" для миграционных услуг
- ГОСОРГАНЫ напрямую: "сайт ммц", "телефон уфмс"
- ИНФОРМАЦИОННОЕ: "сколько осталось квот", "статистика", "новости"
- СОЦИАЛЬНОЕ: "помощь беженцам", "бесплатная поддержка"

=== ЗАПРОСЫ ===
${JSON.stringify(queryData, null, 2)}

Верни JSON:
{
  "results": [
    {
      "query": "текст",
      "category": "target|trash",
      "reason": "краткая причина",
      "minusWord": "ключевое слово для минусации (только для trash)"
    }
  ]
}

При сомнениях → TARGET`;

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
