/**
 * Search Queries Analysis Service
 * Анализ поисковых запросов и автоматическое формирование минус-слов
 */

import { clickhouseService } from './clickhouse.service';
import { yandexDirectService } from './yandex-direct.service';
import { aiClientService } from './ai-client.service';
import { v4 as uuidv4 } from 'uuid';

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

export interface QueryCluster {
  keyword: string;
  queries: number;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpl: number;
  avgCpc: number;
  // Distribution across categories
  targetCount: number;
  trashCount: number;
  reviewCount: number;
  isBigram?: boolean; // Is this a bigram (two words)?
}

// Permanently target words - always good, don't cluster them separately
// These words appear in 90%+ target queries, so clustering them wastes resources
const PERMANENTLY_TARGET_WORDS = new Set([
  'гражданство', 'гражданства', 'гражданству',
  'рвп',
  'внж',
  'получить', 'получение', 'получения', 'получению',
  'сделать', 'сделаю',
  'оформить', 'оформление', 'оформления',
]);

// Russian word endings to strip for stemming
// This is a simplified stemmer for Russian - handles common noun/adjective endings
const RUSSIAN_ENDINGS = [
  // Adjective endings (long forms)
  'ого', 'его', 'ому', 'ему', 'ым', 'им', 'ой', 'ей', 'ую', 'юю', 'ая', 'яя', 'ое', 'ее',
  'ые', 'ие', 'ых', 'их', 'ами', 'ями',
  // Noun endings
  'ов', 'ев', 'ей', 'ий', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем', 'ой', 'ей',
  // Verb endings
  'ть', 'ти', 'ешь', 'ет', 'ем', 'ете', 'ут', 'ют', 'ишь', 'ит', 'им', 'ите', 'ат', 'ят',
  // Common suffixes
  'ение', 'ании', 'ство', 'ства',
];

/**
 * Simple Russian stemmer - removes common endings to normalize words
 * "миграционный" и "миграционного" → "миграционн"
 * "юрист" и "юриста" → "юрист"
 */
function stemRussian(word: string): string {
  if (word.length < 4) return word;

  let stem = word.toLowerCase();

  // Sort endings by length (longest first) to avoid partial matches
  const sortedEndings = [...RUSSIAN_ENDINGS].sort((a, b) => b.length - a.length);

  for (const ending of sortedEndings) {
    if (stem.endsWith(ending) && stem.length - ending.length >= 3) {
      stem = stem.slice(0, -ending.length);
      break; // Only remove one ending
    }
  }

  return stem;
}

/**
 * Extract bigrams from a query
 * "миграционная помощь в москве" → ["миграционная помощь", "помощь в", "в москве"]
 * But we only want meaningful bigrams (both words >= 4 chars)
 */
function extractBigrams(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  const bigrams: string[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    // Only create bigram if both words are significant (>= 4 chars)
    if (words[i].length >= 4 && words[i + 1].length >= 4) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
  }

  return bigrams;
}

/**
 * Check if a word is permanently target (should not be clustered)
 */
function isPermanentlyTargetWord(word: string): boolean {
  const lower = word.toLowerCase();
  // Check exact match
  if (PERMANENTLY_TARGET_WORDS.has(lower)) return true;
  // Check stem match
  const stem = stemRussian(lower);
  for (const targetWord of PERMANENTLY_TARGET_WORDS) {
    if (stemRussian(targetWord) === stem) return true;
  }
  return false;
}

/**
 * Extract significant words from a query for clustering
 * Handles compound phrases by extracting key nouns
 * "миграционный юрист" → extracts "юрист" as key word
 * "помощь в получении" → extracts "помощь" as key word
 */
function extractClusterWords(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
  const result: string[] = [];

  for (const word of words) {
    // Skip permanently target words
    if (isPermanentlyTargetWord(word)) continue;
    // Skip prepositions and common particles
    if (['через', 'после', 'перед', 'между', 'около'].includes(word)) continue;
    result.push(word);
  }

  return result;
}

export interface AnalysisResult {
  totalQueries: number;
  targetQueries: QueryAnalysis[];
  trashQueries: QueryAnalysis[];
  reviewQueries: QueryAnalysis[];
  suggestedMinusWords: MinusWordSuggestion[];
  clusters?: QueryCluster[]; // Keyword clusters for analysis
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

      // getSearchQueryReport returns data with lowercase keys
      return queries.map((q: any) => ({
        query: q.query || q.Query || '',
        impressions: q.impressions || parseInt(q.Impressions) || 0,
        clicks: q.clicks || parseInt(q.Clicks) || 0,
        cost: q.cost || parseFloat(q.Cost) || 0,
        conversions: q.conversions || parseInt(q.Conversions) || 0,
        ctr: q.ctr || parseFloat(q.Ctr) || 0,
        avgCpc: q.avgCpc || parseFloat(q.AvgCpc) || 0,
        cpl: 0, // Will be calculated
        bounceRate: q.bounceRate || parseFloat(q.BounceRate) || undefined,
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
   * Analyze search queries using AI (via AI microservice)
   */
  async analyzeQueries(
    queries: SearchQuery[],
    businessDescription: string,
    targetCpl?: number
  ): Promise<AnalysisResult> {
    // Check if AI service is configured
    if (!aiClientService.isConfigured()) {
      throw new Error('AI service is not configured. Set AI_SERVICE_URL and AI_SERVICE_SECRET.');
    }

    try {
      // Call AI microservice
      const aiResult = await aiClientService.analyzeQueries(
        queries,
        businessDescription,
        targetCpl
      );

      // Calculate avg CPL for target and trash
      const targetWithConversions = aiResult.targetQueries.filter((q: any) => q.metrics?.conversions > 0);
      const avgCplTarget = targetWithConversions.length > 0
        ? targetWithConversions.reduce((sum: number, q: any) => sum + (q.metrics?.cpl || 0), 0) / targetWithConversions.length
        : 0;

      const trashWithConversions = aiResult.trashQueries.filter((q: any) => q.metrics?.conversions > 0);
      const avgCplTrash = trashWithConversions.length > 0
        ? trashWithConversions.reduce((sum: number, q: any) => sum + (q.metrics?.cpl || 0), 0) / trashWithConversions.length
        : 0;

      return {
        totalQueries: queries.length,
        targetQueries: aiResult.targetQueries,
        trashQueries: aiResult.trashQueries,
        reviewQueries: aiResult.reviewQueries,
        suggestedMinusWords: aiResult.suggestedMinusWords,
        summary: {
          totalCost: aiResult.summary.totalCost,
          wastedCost: aiResult.summary.wastedCost,
          potentialSavings: aiResult.summary.potentialSavings,
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
      minImpressionsForLowCtr?: number;
      lowCtrThreshold?: number;
      minImpressions?: number; // Minimum impressions to consider query
      minCost?: number; // Minimum cost to consider query
    } = {}
  ): AnalysisResult {
    const {
      minClicks = 5,
      maxCpl = 5000,
      // minConversionRate is reserved for future use
      // Note: removed "как" - it's too common and appears in many converting queries
      stopWords = ['бесплатно', 'скачать', 'торрент', 'своими руками', 'что это'],
      minImpressionsForLowCtr = 100, // Минимум показов для проверки CTR
      lowCtrThreshold = 1.0, // CTR ниже 1% считается низким
      minImpressions = 5, // Запросы с менее чем 5 показами - статистически незначимы
      minCost = 0, // Минимальный расход для учёта запроса
    } = config;

    // Filter out statistically insignificant queries (noise)
    // Queries with few impressions and no clicks don't provide useful data
    const significantQueries = queries.filter(q => {
      // Always include queries with clicks or conversions - they have real data
      if (q.clicks > 0 || q.conversions > 0) return true;
      // Always include queries with significant cost
      if (q.cost >= minCost && minCost > 0) return true;
      // Exclude queries with very few impressions and no engagement
      if (q.impressions < minImpressions) return false;
      return true;
    });

    console.log(`[QuickAnalysis] Filtered ${queries.length} -> ${significantQueries.length} queries (removed ${queries.length - significantQueries.length} noise queries)`);

    const targetQueries: QueryAnalysis[] = [];
    const trashQueries: QueryAnalysis[] = [];
    const reviewQueries: QueryAnalysis[] = [];

    for (const query of significantQueries) {
      const lowerQuery = query.query.toLowerCase();

      // Check for stop words - but NEVER mark as trash if query has conversions!
      const matchedStopWords = stopWords.filter(sw => lowerQuery.includes(sw.toLowerCase()));

      if (matchedStopWords.length > 0 && query.conversions === 0) {
        // Only trash if no conversions - queries with conversions are valuable regardless of stop words
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

      // Check for high impressions but low/no clicks (low CTR = likely irrelevant)
      if (query.impressions >= minImpressionsForLowCtr && query.ctr < lowCtrThreshold) {
        if (query.clicks === 0) {
          // No clicks at all - likely trash
          trashQueries.push({
            query: query.query,
            category: 'trash',
            reason: `${query.impressions} показов, 0 кликов — нерелевантный запрос`,
            suggestedMinusWords: [], // Will be filled after we know target words
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
        } else {
          // Very low CTR - needs review
          reviewQueries.push({
            query: query.query,
            category: 'review',
            reason: `Низкий CTR (${query.ctr.toFixed(2)}%) при ${query.impressions} показах`,
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
          continue;
        }
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

    // Extract words from target queries - these should NEVER be minus words
    const targetWords = new Set<string>();
    for (const target of targetQueries) {
      const words = target.query.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length >= 3) {
          targetWords.add(word);
        }
      }
    }

    // Also extract from review queries with conversions - these are likely good words too
    for (const review of reviewQueries) {
      if (review.metrics.conversions > 0) {
        const words = review.query.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length >= 3) {
            targetWords.add(word);
          }
        }
      }
    }

    // Extract minus words from trash queries
    const minusWordCounts = new Map<string, { count: number; cost: number }>();

    for (const trash of trashQueries) {
      const words = trash.query.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length < 3) continue;
        // Skip if word appears in target queries - this is critical!
        if (targetWords.has(word)) continue;
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

    const totalCost = significantQueries.reduce((sum, q) => sum + q.cost, 0);
    const wastedCost = trashQueries.reduce((sum, q) => sum + q.metrics.cost, 0);

    // Build keyword clusters for analysis
    // Uses stemming to group "миграционный" and "миграционного" together
    // Uses bigrams for compound phrases like "миграционная помощь"
    // Excludes permanently target words that don't need analysis

    interface ClusterData {
      queries: Set<string>;
      impressions: number;
      clicks: number;
      cost: number;
      conversions: number;
      targetCount: number;
      trashCount: number;
      reviewCount: number;
      displayWord: string; // Most common form of the word for display
      isBigram: boolean;
    }

    const clusterMap = new Map<string, ClusterData>();
    const stemToDisplayCount = new Map<string, Map<string, number>>(); // stem -> {display -> count}

    // Helper to add query to cluster by stem
    const addToClusterByStem = (
      stem: string,
      displayWord: string,
      query: string,
      metrics: { impressions: number; clicks: number; cost: number; conversions: number },
      category: 'target' | 'trash' | 'review',
      isBigram: boolean = false
    ) => {
      if (!clusterMap.has(stem)) {
        clusterMap.set(stem, {
          queries: new Set(),
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          targetCount: 0,
          trashCount: 0,
          reviewCount: 0,
          displayWord,
          isBigram,
        });
        stemToDisplayCount.set(stem, new Map());
      }

      const cluster = clusterMap.get(stem)!;

      // Track display word frequency to pick the most common one
      const displayCounts = stemToDisplayCount.get(stem)!;
      displayCounts.set(displayWord, (displayCounts.get(displayWord) || 0) + 1);

      if (!cluster.queries.has(query)) {
        cluster.queries.add(query);
        cluster.impressions += metrics.impressions;
        cluster.clicks += metrics.clicks;
        cluster.cost += metrics.cost;
        cluster.conversions += metrics.conversions;
        if (category === 'target') cluster.targetCount++;
        else if (category === 'trash') cluster.trashCount++;
        else cluster.reviewCount++;
      }
    };

    // Helper to add query to clusters (both single words and bigrams)
    const addToCluster = (query: string, metrics: { impressions: number; clicks: number; cost: number; conversions: number }, category: 'target' | 'trash' | 'review') => {
      // Extract single words (filtered for permanently target words)
      const words = extractClusterWords(query);
      for (const word of words) {
        const stem = stemRussian(word);
        addToClusterByStem(stem, word, query, metrics, category, false);
      }

      // Extract bigrams
      const bigrams = extractBigrams(query);
      for (const bigram of bigrams) {
        const bigramWords = bigram.split(' ');
        // Skip bigrams where both words are permanently target
        if (bigramWords.every(w => isPermanentlyTargetWord(w))) continue;
        // Create stem for bigram (stem both words)
        const bigramStem = bigramWords.map(w => stemRussian(w)).join(' ');
        addToClusterByStem(bigramStem, bigram, query, metrics, category, true);
      }
    };

    // Add all queries to clusters
    for (const q of targetQueries) {
      addToCluster(q.query, q.metrics, 'target');
    }
    for (const q of trashQueries) {
      addToCluster(q.query, q.metrics, 'trash');
    }
    for (const q of reviewQueries) {
      addToCluster(q.query, q.metrics, 'review');
    }

    // Update display words to most common form
    for (const [stem, cluster] of clusterMap.entries()) {
      const displayCounts = stemToDisplayCount.get(stem)!;
      let maxCount = 0;
      let bestDisplay = cluster.displayWord;
      for (const [display, count] of displayCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          bestDisplay = display;
        }
      }
      cluster.displayWord = bestDisplay;
    }

    // Convert to array and sort by total queries
    // Separate bigrams and single words, prioritize bigrams slightly
    const allClusters = Array.from(clusterMap.entries())
      .filter(([_, data]) => data.queries.size >= 3) // At least 3 queries in cluster
      .map(([_stem, data]) => ({
        keyword: data.displayWord,
        queries: data.queries.size,
        impressions: data.impressions,
        clicks: data.clicks,
        cost: data.cost,
        conversions: data.conversions,
        ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
        cpl: data.conversions > 0 ? data.cost / data.conversions : 0,
        avgCpc: data.clicks > 0 ? data.cost / data.clicks : 0,
        targetCount: data.targetCount,
        trashCount: data.trashCount,
        reviewCount: data.reviewCount,
        isBigram: data.isBigram,
      }));

    // Filter out clusters with good CPL - they don't need analysis
    // A cluster is "good" if:
    // 1. Has conversions AND CPL is below target (or target not set and CPL < 5000)
    // 2. OR 100% target queries (no trash/review)
    const targetCplThreshold = maxCpl || 5000;
    const clustersNeedingReview = allClusters.filter(cluster => {
      // If cluster is 100% target queries - skip it, everything is fine
      if (cluster.targetCount > 0 && cluster.trashCount === 0 && cluster.reviewCount === 0) {
        return false;
      }
      // If cluster has good CPL (below target) and mostly target queries - skip it
      if (cluster.conversions > 0 && cluster.cpl <= targetCplThreshold && cluster.cpl > 0) {
        // But still show if there's significant trash
        const trashRatio = cluster.trashCount / cluster.queries;
        if (trashRatio < 0.2) { // Less than 20% trash
          return false;
        }
      }
      return true;
    });

    // Sort: bigrams first (if significant), then by query count
    const clusters: QueryCluster[] = clustersNeedingReview
      .sort((a, b) => {
        // Bigrams with decent data get priority
        if (a.isBigram && !b.isBigram && a.queries >= 5) return -1;
        if (!a.isBigram && b.isBigram && b.queries >= 5) return 1;
        // Then sort by queries count
        return b.queries - a.queries;
      })
      .slice(0, 100); // Top 100 clusters

    return {
      totalQueries: significantQueries.length,
      targetQueries,
      trashQueries,
      reviewQueries,
      suggestedMinusWords,
      clusters,
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
   * Hybrid analysis: Quick analysis + AI for complex cases
   * Best of both worlds: fast + smart
   */
  async hybridAnalysis(
    queries: SearchQuery[],
    businessDescription: string,
    targetCpl?: number
  ): Promise<AnalysisResult> {
    // Step 1: Run quick analysis on all queries
    const quickResult = this.quickAnalysis(queries, {
      maxCpl: targetCpl || 5000,
      minImpressions: 5,
    });

    // Step 2: Select "complex cases" for AI review
    // These are queries where rule-based analysis is uncertain
    const complexCases: SearchQuery[] = [];

    // 2a. High cost without conversions (AI can determine if it's truly trash or just needs time)
    const highCostNoConversion = quickResult.trashQueries
      .filter(q => q.metrics.cost > 500 && q.metrics.clicks >= 3)
      .slice(0, 50);

    // 2b. Review queries with significant spend (AI can help categorize)
    const uncertainReview = quickResult.reviewQueries
      .filter(q => q.metrics.cost > 200)
      .slice(0, 50);

    // 2c. Top clusters by cost that have mixed categories (target + trash)
    const mixedClusters = (quickResult.clusters || [])
      .filter(c => c.targetCount > 0 && c.trashCount > 0 && c.cost > 500)
      .slice(0, 20);

    // Collect unique queries from complex cases
    const complexQueryTexts = new Set<string>();

    for (const q of highCostNoConversion) {
      complexQueryTexts.add(q.query);
    }
    for (const q of uncertainReview) {
      complexQueryTexts.add(q.query);
    }

    // For mixed clusters, find the actual queries
    const queryByText = new Map(queries.map(q => [q.query, q]));
    for (const cluster of mixedClusters) {
      // Find queries containing this cluster keyword
      const keyword = cluster.keyword.toLowerCase();
      for (const q of queries) {
        if (q.query.toLowerCase().includes(keyword) && q.cost > 100) {
          complexQueryTexts.add(q.query);
          if (complexQueryTexts.size >= 150) break;
        }
      }
      if (complexQueryTexts.size >= 150) break;
    }

    // Build list of queries for AI
    for (const text of complexQueryTexts) {
      const q = queryByText.get(text);
      if (q) complexCases.push(q);
    }

    console.log(`[HybridAnalysis] Selected ${complexCases.length} complex cases for AI review`);

    // Step 3: If no complex cases or AI not configured, return quick result
    if (complexCases.length === 0 || !aiClientService.isConfigured()) {
      return quickResult;
    }

    // Step 4: Send complex cases to AI
    try {
      const aiResult = await aiClientService.analyzeQueries(
        complexCases,
        businessDescription,
        targetCpl
      );

      console.log(`[HybridAnalysis] AI analyzed ${aiResult.analyzedQueries} queries`);

      // Step 5: Merge AI results back into quick analysis
      // Create maps for fast lookup
      const aiTargetSet = new Set(aiResult.targetQueries.map((q: any) => q.query));
      const aiTrashMap = new Map(aiResult.trashQueries.map((q: any) => [q.query, q]));
      const aiReviewSet = new Set(aiResult.reviewQueries.map((q: any) => q.query));

      // Update categories based on AI feedback
      const finalTarget = [...quickResult.targetQueries];
      const finalTrash = [...quickResult.trashQueries];
      const finalReview: QueryAnalysis[] = [];

      // Re-categorize review queries
      for (const q of quickResult.reviewQueries) {
        if (aiTargetSet.has(q.query)) {
          // AI says it's target - promote it
          finalTarget.push({
            ...q,
            category: 'target',
            reason: 'AI: ' + (aiResult.targetQueries.find((t: any) => t.query === q.query)?.reason || q.reason),
          });
        } else if (aiTrashMap.has(q.query)) {
          // AI says it's trash - demote it
          const aiTrash = aiTrashMap.get(q.query)!;
          finalTrash.push({
            ...q,
            category: 'trash',
            reason: 'AI: ' + (aiTrash.reason || q.reason),
            suggestedMinusWords: aiTrash.suggestedMinusWords || [],
          });
        } else {
          // Keep as review
          finalReview.push(q);
        }
      }

      // Re-check some trash queries - AI might disagree
      const updatedTrash: QueryAnalysis[] = [];
      for (const q of finalTrash) {
        if (aiTargetSet.has(q.query)) {
          // AI says it's actually target!
          finalTarget.push({
            ...q,
            category: 'target',
            reason: 'AI: ' + (aiResult.targetQueries.find((t: any) => t.query === q.query)?.reason || 'Целевой запрос'),
          });
        } else if (aiReviewSet.has(q.query)) {
          // AI is uncertain - move to review
          finalReview.push({
            ...q,
            category: 'review',
            reason: 'AI: требует проверки',
          });
        } else {
          updatedTrash.push(q);
        }
      }

      // Merge minus words suggestions
      const allMinusWords = [...quickResult.suggestedMinusWords];
      const existingWords = new Set(allMinusWords.map(m => m.word.toLowerCase()));

      for (const aiMinus of aiResult.suggestedMinusWords || []) {
        if (!existingWords.has(aiMinus.word.toLowerCase())) {
          allMinusWords.push({
            word: aiMinus.word,
            reason: 'AI: ' + aiMinus.reason,
            queriesAffected: aiMinus.queriesAffected || 0,
            potentialSavings: aiMinus.potentialSavings || 0,
            category: aiMinus.category || 'other',
          });
        }
      }

      // Recalculate summary
      const totalCost = queries.reduce((sum, q) => sum + q.cost, 0);
      const wastedCost = updatedTrash.reduce((sum, q) => sum + q.metrics.cost, 0);

      return {
        totalQueries: quickResult.totalQueries,
        targetQueries: finalTarget,
        trashQueries: updatedTrash,
        reviewQueries: finalReview,
        suggestedMinusWords: allMinusWords.sort((a, b) => b.potentialSavings - a.potentialSavings).slice(0, 50),
        clusters: quickResult.clusters,
        summary: {
          totalCost,
          wastedCost,
          potentialSavings: wastedCost,
          avgCplTarget: quickResult.summary.avgCplTarget,
          avgCplTrash: quickResult.summary.avgCplTrash,
        },
      };
    } catch (aiError: any) {
      console.error('[HybridAnalysis] AI failed, using quick result:', aiError.message);
      return quickResult;
    }
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
      // Use exec() for INSERT - query() adds FORMAT which breaks INSERT
      await clickhouseService.exec(`
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
