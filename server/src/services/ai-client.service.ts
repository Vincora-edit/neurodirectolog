/**
 * AI Service Client
 *
 * Client for communicating with the AI microservice
 * running on Amsterdam server
 */

interface AIServiceConfig {
  baseUrl: string;
  secret: string;
  timeout: number;
}

let config: AIServiceConfig | null = null;

function getConfig(): AIServiceConfig {
  if (!config) {
    const baseUrl = process.env.AI_SERVICE_URL;
    const secret = process.env.AI_SERVICE_SECRET;

    if (!baseUrl || !secret) {
      throw new Error('AI_SERVICE_URL and AI_SERVICE_SECRET must be configured');
    }

    config = {
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      secret,
      timeout: parseInt(process.env.AI_SERVICE_TIMEOUT || '60000'),
    };
  }
  return config;
}

async function fetchAI<T>(
  endpoint: string,
  data: any,
  options: { timeout?: number } = {}
): Promise<T> {
  const cfg = getConfig();
  const timeout = options.timeout || cfg.timeout;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${cfg.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.secret}`,
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      throw new Error(errorData.error || `AI service error: ${response.status}`);
    }

    const result = await response.json() as { success: boolean; data: T; error?: string };
    if (!result.success) {
      throw new Error(result.error || 'AI analysis failed');
    }

    return result.data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('AI service timeout');
    }
    throw error;
  }
}

// Types for API requests/responses
export interface SearchQuery {
  query: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  cpl: number;
}

export interface QueryAnalysisResult {
  totalQueries: number;
  analyzedQueries: number;
  targetQueries: any[];
  trashQueries: any[];
  reviewQueries: any[];
  suggestedMinusWords: any[];
  summary: {
    totalCost: number;
    wastedCost: number;
    potentialSavings: number;
  };
}

export interface CampaignData {
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

export interface CampaignAnalysisResult {
  campaigns: any[];
  overallInsights: string[];
  budgetRecommendations: any[];
}

export interface DailyRecommendationsResult {
  recommendations: any[];
  alerts: any[];
  dailySummary: string;
}

export const aiClientService = {
  /**
   * Check if AI service is configured
   */
  isConfigured(): boolean {
    return !!(process.env.AI_SERVICE_URL && process.env.AI_SERVICE_SECRET);
  },

  /**
   * Check AI service health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const cfg = getConfig();
      const response = await fetch(`${cfg.baseUrl}/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cfg.secret}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // === Query Analysis ===

  /**
   * Analyze search queries with AI
   */
  async analyzeQueries(
    queries: SearchQuery[],
    businessDescription: string,
    targetCpl?: number
  ): Promise<QueryAnalysisResult> {
    return fetchAI('/api/ai/queries/analyze', {
      queries,
      businessDescription,
      targetCpl,
    });
  },

  // === Campaign Analysis ===

  /**
   * Analyze campaign performance
   */
  async analyzeCampaigns(
    campaigns: CampaignData[],
    options: {
      businessDescription?: string;
      targetCpl?: number;
      period?: string;
    } = {}
  ): Promise<CampaignAnalysisResult> {
    return fetchAI('/api/ai/campaigns/analyze', {
      campaigns,
      ...options,
    });
  },

  /**
   * Diagnose underperforming campaign
   */
  async diagnoseCampaign(
    campaign: CampaignData,
    options: {
      adGroups?: any[];
      keywords?: any[];
      ads?: any[];
      businessDescription?: string;
    } = {}
  ): Promise<any> {
    return fetchAI('/api/ai/campaigns/diagnose', {
      campaign,
      ...options,
    });
  },

  // === Competitor Analysis ===

  /**
   * Analyze competitors
   */
  async analyzeCompetitors(
    competitors: { domain: string; ads?: any[]; keywords?: string[] }[],
    options: {
      myBusiness: string;
      myAds?: any[];
      myKeywords?: string[];
    }
  ): Promise<any> {
    return fetchAI('/api/ai/competitors/analyze', {
      competitors,
      ...options,
    });
  },

  /**
   * Benchmark against industry
   */
  async benchmarkMetrics(
    myMetrics: {
      ctr: number;
      cpc: number;
      cpl: number;
      conversionRate: number;
      bounceRate?: number;
    },
    options: {
      industryBenchmarks?: any;
      businessDescription: string;
    }
  ): Promise<any> {
    return fetchAI('/api/ai/competitors/benchmark', {
      myMetrics,
      ...options,
    });
  },

  // === Recommendations ===

  /**
   * Get daily AI recommendations
   */
  async getDailyRecommendations(
    campaigns: CampaignData[],
    options: {
      recentTrends?: any[];
      businessDescription: string;
      targetCpl?: number;
      budget?: number;
    }
  ): Promise<DailyRecommendationsResult> {
    return fetchAI('/api/ai/recommendations/daily', {
      campaigns,
      ...options,
    });
  },

  /**
   * Get ad copy recommendations
   */
  async getAdCopyRecommendations(
    keywords: string[],
    options: {
      currentAds?: any[];
      businessDescription: string;
      targetAudience?: string;
      usps?: string[];
    }
  ): Promise<any> {
    return fetchAI('/api/ai/recommendations/ad-copy', {
      keywords,
      ...options,
    });
  },

  /**
   * Get keyword recommendations
   */
  async getKeywordRecommendations(
    currentKeywords: any[],
    options: {
      searchQueries?: any[];
      businessDescription: string;
      targetCpl?: number;
    }
  ): Promise<any> {
    return fetchAI('/api/ai/recommendations/keywords', {
      currentKeywords,
      ...options,
    });
  },

  /**
   * Get budget optimization recommendations
   */
  async getBudgetRecommendations(
    campaigns: CampaignData[],
    totalBudget: number,
    options: {
      targetCpl?: number;
      businessGoals?: string;
    } = {}
  ): Promise<any> {
    return fetchAI('/api/ai/recommendations/budget', {
      campaigns,
      totalBudget,
      ...options,
    });
  },
};
