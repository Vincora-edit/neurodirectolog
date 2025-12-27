/**
 * Search Queries Analysis Service
 * Анализ поисковых запросов и автоматическое формирование минус-слов
 */

import { clickhouseService } from './clickhouse.service';
import { yandexDirectService } from './yandex-direct.service';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// Lazy initialization of OpenAI client to avoid crash when API key is not set
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set. AI analysis features are disabled.');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface SearchQuery {
  query: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  cpl: number;
  bounceRate?: number;
}

export interface QueryAnalysis {
  query: string;
  category: 'target' | 'trash' | 'review';
  reason: string;
  suggestedMinusWords: string[];
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    cpl: number;
  };
}

export interface MinusWordSuggestion {
  word: string;
  reason: string;
  queriesAffected: number;
  potentialSavings: number;
  category: 'irrelevant' | 'low_quality' | 'competitor' | 'informational' | 'other';
}

export interface AnalysisResult {
  totalQueries: number;
  targetQueries: QueryAnalysis[];
  trashQueries: QueryAnalysis[];
  reviewQueries: QueryAnalysis[];
  suggestedMinusWords: MinusWordSuggestion[];
  summary: {
    totalCost: number;
    wastedCost: number;
    potentialSavings: number;
    avgCplTarget: number;
    avgCplTrash: number;
  };
}

export const searchQueriesService = {
  /**
   * Get search queries for a connection
   */
  async getSearchQueries(
    connectionId: string,
    dateFrom: string,
    dateTo: string,
    campaignId?: string
  ): Promise<SearchQuery[]> {
    try {
      const connection = await clickhouseService.getConnectionById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      const campaigns = await clickhouseService.getCampaignsByConnectionId(connectionId);
      let campaignIds = campaigns.map(c => parseInt(c.externalId));

      if (campaignId) {
        campaignIds = [parseInt(campaignId)];
      }

      if (campaignIds.length === 0) {
        return [];
      }

      // Parse goals from connection
      let goalIds: string[] = [];
      try {
        if (connection.conversionGoals) {
          goalIds = JSON.parse(connection.conversionGoals);
        }
      } catch (e) {
        // No goals
      }

      const queries = await yandexDirectService.getSearchQueryReport(
        connection.accessToken,
        connection.login,
        campaignIds,
        dateFrom,
        dateTo,
        goalIds.length > 0 ? goalIds : undefined
      );

      return queries.map((q: any) => ({
        query: q.Query || q.query || '',
        impressions: parseInt(q.Impressions) || 0,
        clicks: parseInt(q.Clicks) || 0,
        cost: parseFloat(q.Cost) || 0,
        conversions: parseInt(q.Conversions) || 0,
        ctr: parseFloat(q.Ctr) || 0,
        avgCpc: parseFloat(q.AvgCpc) || 0,
        cpl: 0, // Will be calculated
        bounceRate: parseFloat(q.BounceRate) || undefined,
      })).map((q: SearchQuery) => ({
        ...q,
        cpl: q.conversions > 0 ? q.cost / q.conversions : 0,
      }));
    } catch (error) {
      console.error('[SearchQueries] Failed to get search queries:', error);
      throw error;
    }
  },

  /**
   * Analyze search queries using AI
   */
  async analyzeQueries(
    queries: SearchQuery[],
    businessDescription: string,
    targetCpl?: number
  ): Promise<AnalysisResult> {
    // Sort by cost descending to prioritize high-spend queries
    const sortedQueries = [...queries].sort((a, b) => b.cost - a.cost);

    // Take top 200 queries for AI analysis (to manage token limits)
    const topQueries = sortedQueries.slice(0, 200);

    // Prepare query data for AI
    const queryData = topQueries.map(q => ({
      query: q.query,
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

    try {
      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty AI response');
      }

      const aiResult = JSON.parse(content);

      // Build result
      const targetQueries: QueryAnalysis[] = [];
      const trashQueries: QueryAnalysis[] = [];
      const reviewQueries: QueryAnalysis[] = [];

      const queryMap = new Map(topQueries.map(q => [q.query, q]));

      for (const analyzed of aiResult.queries || []) {
        const original = queryMap.get(analyzed.query);
        if (!original) continue;

        const analysis: QueryAnalysis = {
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

      // Process suggested minus words
      const minusWordMap = new Map<string, MinusWordSuggestion>();

      for (const mw of aiResult.suggestedMinusWords || []) {
        // Count affected queries and potential savings
        let queriesAffected = 0;
        let potentialSavings = 0;

        for (const trash of trashQueries) {
          if (trash.query.toLowerCase().includes(mw.word.toLowerCase())) {
            queriesAffected++;
            potentialSavings += trash.metrics.cost;
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
      const wastedCost = trashQueries.reduce((sum, q) => sum + q.metrics.cost, 0);
      const potentialSavings = Array.from(minusWordMap.values()).reduce((sum, mw) => sum + mw.potentialSavings, 0);

      const targetWithConversions = targetQueries.filter(q => q.metrics.conversions > 0);
      const avgCplTarget = targetWithConversions.length > 0
        ? targetWithConversions.reduce((sum, q) => sum + q.metrics.cpl, 0) / targetWithConversions.length
        : 0;

      const trashWithConversions = trashQueries.filter(q => q.metrics.conversions > 0);
      const avgCplTrash = trashWithConversions.length > 0
        ? trashWithConversions.reduce((sum, q) => sum + q.metrics.cpl, 0) / trashWithConversions.length
        : 0;

      return {
        totalQueries: queries.length,
        targetQueries,
        trashQueries,
        reviewQueries,
        suggestedMinusWords: Array.from(minusWordMap.values())
          .sort((a, b) => b.potentialSavings - a.potentialSavings),
        summary: {
          totalCost,
          wastedCost,
          potentialSavings,
          avgCplTarget,
          avgCplTrash,
        },
      };
    } catch (error) {
      console.error('[SearchQueries] AI analysis failed:', error);
      throw error;
    }
  },

  /**
   * Quick analysis without AI (rule-based)
   */
  quickAnalysis(
    queries: SearchQuery[],
    config: {
      minClicks?: number;
      maxCpl?: number;
      minConversionRate?: number;
      stopWords?: string[];
    } = {}
  ): AnalysisResult {
    const {
      minClicks = 5,
      maxCpl = 5000,
      // minConversionRate is reserved for future use
      stopWords = ['бесплатно', 'скачать', 'торрент', 'своими руками', 'отзывы', 'что это', 'как'],
    } = config;

    const targetQueries: QueryAnalysis[] = [];
    const trashQueries: QueryAnalysis[] = [];
    const reviewQueries: QueryAnalysis[] = [];

    for (const query of queries) {
      const lowerQuery = query.query.toLowerCase();

      // Check for stop words
      const matchedStopWords = stopWords.filter(sw => lowerQuery.includes(sw.toLowerCase()));

      if (matchedStopWords.length > 0) {
        trashQueries.push({
          query: query.query,
          category: 'trash',
          reason: `Содержит стоп-слова: ${matchedStopWords.join(', ')}`,
          suggestedMinusWords: matchedStopWords,
          metrics: {
            impressions: query.impressions,
            clicks: query.clicks,
            cost: query.cost,
            conversions: query.conversions,
            ctr: query.ctr,
            cpl: query.cpl,
          },
        });
        continue;
      }

      // Check conversion metrics
      if (query.clicks >= minClicks) {
        if (query.conversions > 0) {
          if (query.cpl <= maxCpl) {
            targetQueries.push({
              query: query.query,
              category: 'target',
              reason: `Есть конверсии, CPL в норме (${Math.round(query.cpl)}₽)`,
              suggestedMinusWords: [],
              metrics: {
                impressions: query.impressions,
                clicks: query.clicks,
                cost: query.cost,
                conversions: query.conversions,
                ctr: query.ctr,
                cpl: query.cpl,
              },
            });
          } else {
            reviewQueries.push({
              query: query.query,
              category: 'review',
              reason: `Высокий CPL (${Math.round(query.cpl)}₽), но есть конверсии`,
              suggestedMinusWords: [],
              metrics: {
                impressions: query.impressions,
                clicks: query.clicks,
                cost: query.cost,
                conversions: query.conversions,
                ctr: query.ctr,
                cpl: query.cpl,
              },
            });
          }
        } else if (query.cost > maxCpl) {
          trashQueries.push({
            query: query.query,
            category: 'trash',
            reason: `Потрачено ${Math.round(query.cost)}₽ без конверсий`,
            suggestedMinusWords: [],
            metrics: {
              impressions: query.impressions,
              clicks: query.clicks,
              cost: query.cost,
              conversions: query.conversions,
              ctr: query.ctr,
              cpl: query.cpl,
            },
          });
        } else {
          reviewQueries.push({
            query: query.query,
            category: 'review',
            reason: 'Нет конверсий, но расход небольшой',
            suggestedMinusWords: [],
            metrics: {
              impressions: query.impressions,
              clicks: query.clicks,
              cost: query.cost,
              conversions: query.conversions,
              ctr: query.ctr,
              cpl: query.cpl,
            },
          });
        }
      } else {
        // Not enough data
        reviewQueries.push({
          query: query.query,
          category: 'review',
          reason: 'Недостаточно данных для анализа',
          suggestedMinusWords: [],
          metrics: {
            impressions: query.impressions,
            clicks: query.clicks,
            cost: query.cost,
            conversions: query.conversions,
            ctr: query.ctr,
            cpl: query.cpl,
          },
        });
      }
    }

    // Extract minus words from trash queries
    const minusWordCounts = new Map<string, { count: number; cost: number }>();

    for (const trash of trashQueries) {
      const words = trash.query.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length < 3) continue;
        const existing = minusWordCounts.get(word) || { count: 0, cost: 0 };
        existing.count++;
        existing.cost += trash.metrics.cost;
        minusWordCounts.set(word, existing);
      }
    }

    const suggestedMinusWords: MinusWordSuggestion[] = Array.from(minusWordCounts.entries())
      .filter(([_, data]) => data.count >= 2) // Word appears in at least 2 trash queries
      .map(([word, data]) => ({
        word,
        reason: `Встречается в ${data.count} нецелевых запросах`,
        queriesAffected: data.count,
        potentialSavings: data.cost,
        category: 'other' as const,
      }))
      .sort((a, b) => b.potentialSavings - a.potentialSavings)
      .slice(0, 50);

    const totalCost = queries.reduce((sum, q) => sum + q.cost, 0);
    const wastedCost = trashQueries.reduce((sum, q) => sum + q.metrics.cost, 0);

    return {
      totalQueries: queries.length,
      targetQueries,
      trashQueries,
      reviewQueries,
      suggestedMinusWords,
      summary: {
        totalCost,
        wastedCost,
        potentialSavings: wastedCost,
        avgCplTarget: 0,
        avgCplTrash: 0,
      },
    };
  },

  /**
   * Save analysis result to ClickHouse
   */
  async saveAnalysis(
    connectionId: string,
    userId: string,
    analysis: AnalysisResult,
    dateFrom: string,
    dateTo: string
  ): Promise<string> {
    const id = uuidv4();

    try {
      await clickhouseService.query(`
        INSERT INTO search_query_analyses (
          id, connection_id, user_id, date_from, date_to,
          total_queries, target_count, trash_count, review_count,
          total_cost, wasted_cost, potential_savings,
          suggested_minus_words, created_at
        ) VALUES (
          '${id}', '${connectionId}', '${userId}',
          '${dateFrom}', '${dateTo}',
          ${analysis.totalQueries},
          ${analysis.targetQueries.length},
          ${analysis.trashQueries.length},
          ${analysis.reviewQueries.length},
          ${analysis.summary.totalCost},
          ${analysis.summary.wastedCost},
          ${analysis.summary.potentialSavings},
          '${JSON.stringify(analysis.suggestedMinusWords).replace(/'/g, "''")}',
          now()
        )
      `);

      return id;
    } catch (error) {
      console.error('[SearchQueries] Failed to save analysis:', error);
      throw error;
    }
  },
};
