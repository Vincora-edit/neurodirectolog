import { API_BASE_URL } from './api';
import type {
  YandexConnection,
  YandexGoal,
  Campaign,
  DailyStats,
  KpiData,
  BudgetForecast,
  LandingPage,
  DeviceStats,
  GeoStats,
  SearchQuery,
  Demographics,
  Placement,
  IncomeStats,
  TargetingCategory,
  Criteria,
  AdText,
  Recommendation,
} from '../types/yandex';

// Yandex Dashboard API Service
export const yandexService = {
  // Connections
  async getConnection(projectId: string): Promise<YandexConnection | null> {
    const response = await fetch(`${API_BASE_URL}/api/yandex/connection/${projectId}`);
    if (!response.ok) return null;
    return response.json();
  },

  async getConnections(projectId: string): Promise<YandexConnection[]> {
    const response = await fetch(`${API_BASE_URL}/api/yandex/connections/${projectId}`);
    if (!response.ok) return [];
    return response.json();
  },

  async updateConnection(
    connectionId: string,
    data: { accessToken?: string; selectedGoals?: number[] }
  ): Promise<YandexConnection> {
    const response = await fetch(`${API_BASE_URL}/api/yandex/connection/${connectionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async deleteConnection(connectionId: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/yandex/connection/${connectionId}`, {
      method: 'DELETE',
    });
  },

  // Campaigns
  async getCampaigns(projectId: string): Promise<Campaign[]> {
    const response = await fetch(`${API_BASE_URL}/api/yandex/campaigns/${projectId}`);
    return response.json();
  },

  // Stats
  async getDetailedStats(
    projectId: string,
    options: {
      days?: number;
      goalIds?: string[];
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<any> {
    const { days = 30, goalIds, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (goalIds && goalIds.length > 0) {
      params.append('goalIds', goalIds.join(','));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/detailed-stats/${projectId}?${params}`
    );
    return response.json();
  },

  async getHierarchicalStats(
    projectId: string,
    options: {
      days?: number;
      goalIds?: string[];
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<{ campaigns: Campaign[] }> {
    const { days = 30, goalIds, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (goalIds && goalIds.length > 0) {
      params.append('goalIds', goalIds.join(','));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/hierarchical-stats/${projectId}?${params}`
    );
    return response.json();
  },

  async getDailyStats(
    projectId: string,
    options: {
      days?: number;
      goalIds?: string[];
      startDate?: string;
      endDate?: string;
      connectionId?: string;
      campaignId?: string | null;
      adGroupId?: string | null;
      adId?: string | null;
    } = {}
  ): Promise<DailyStats[]> {
    const {
      days = 30,
      goalIds,
      startDate,
      endDate,
      connectionId,
      campaignId,
      adGroupId,
      adId,
    } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (goalIds && goalIds.length > 0) {
      params.append('goalIds', goalIds.join(','));
    }

    if (connectionId) params.append('connectionId', connectionId);
    if (campaignId) params.append('campaignId', campaignId);
    if (adGroupId) params.append('adGroupId', adGroupId);
    if (adId) params.append('adId', adId);

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/daily-stats/${projectId}?${params}`
    );
    return response.json();
  },

  // Goals
  async getAvailableGoals(projectId: string, connectionId?: string): Promise<YandexGoal[]> {
    let url = `${API_BASE_URL}/api/yandex/available-goals/${projectId}`;
    if (connectionId) {
      url += `?connectionId=${connectionId}`;
    }
    const response = await fetch(url);
    return response.json();
  },

  // Sync
  async syncManual(projectId: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/yandex/sync/${projectId}`, {
      method: 'POST',
    });
    return response.json();
  },

  // KPI
  async getKpi(connectionId: string, goalIds?: string[]): Promise<KpiData | null> {
    let url = `${API_BASE_URL}/api/yandex/kpi/${connectionId}`;
    if (goalIds && goalIds.length > 0) {
      url += `?goalIds=${goalIds.join(',')}`;
    }
    const response = await fetch(url);
    return response.json();
  },

  async saveKpi(
    connectionId: string,
    kpi: {
      targetCost: number;
      targetCpl: number;
      targetLeads: number;
      goalIds?: string[];
      month?: string;
    }
  ): Promise<KpiData> {
    const response = await fetch(`${API_BASE_URL}/api/yandex/kpi/${connectionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kpi),
    });
    return response.json();
  },

  // Budget Forecast
  async getBudgetForecast(connectionId: string): Promise<BudgetForecast> {
    const response = await fetch(
      `${API_BASE_URL}/api/yandex/budget-forecast/${connectionId}`
    );
    return response.json();
  },

  // Landing Pages
  async getLandingPages(
    projectId: string,
    options: {
      days?: number;
      goalIds?: string[];
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<LandingPage[]> {
    const { days = 30, goalIds, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (goalIds && goalIds.length > 0) {
      params.append('goalIds', goalIds.join(','));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/landing-pages/${projectId}?${params}`
    );
    return response.json();
  },

  // Device Stats
  async getDeviceStats(
    projectId: string,
    options: {
      days?: number;
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<DeviceStats[]> {
    const { days = 30, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/device-stats/${projectId}?${params}`
    );
    return response.json();
  },

  // Geo Stats
  async getGeoStats(
    projectId: string,
    options: {
      days?: number;
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<GeoStats[]> {
    const { days = 30, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/geo-stats/${projectId}?${params}`
    );
    return response.json();
  },

  // Geo Report
  async getGeoReport(
    projectId: string,
    options: {
      days?: number;
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<GeoStats[]> {
    const { days = 30, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/geo-report/${projectId}?${params}`
    );
    return response.json();
  },

  // Search Queries
  async getSearchQueries(
    projectId: string,
    options: {
      days?: number;
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<SearchQuery[]> {
    const { days = 30, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/search-queries/${projectId}?${params}`
    );
    return response.json();
  },

  // Demographics
  async getDemographics(
    projectId: string,
    options: {
      days?: number;
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<Demographics[]> {
    const { days = 30, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/demographics/${projectId}?${params}`
    );
    return response.json();
  },

  // Placements
  async getPlacements(
    projectId: string,
    options: {
      days?: number;
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<Placement[]> {
    const { days = 30, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/placements/${projectId}?${params}`
    );
    return response.json();
  },

  // Income Stats
  async getIncome(
    projectId: string,
    options: {
      days?: number;
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<IncomeStats[]> {
    const { days = 30, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/income/${projectId}?${params}`
    );
    return response.json();
  },

  // Targeting Categories
  async getTargetingCategories(
    projectId: string,
    options: {
      days?: number;
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<TargetingCategory[]> {
    const { days = 30, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/targeting-categories/${projectId}?${params}`
    );
    return response.json();
  },

  // Criteria (Keywords)
  async getCriteria(
    projectId: string,
    options: {
      days?: number;
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<Criteria[]> {
    const { days = 30, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/criteria/${projectId}?${params}`
    );
    return response.json();
  },

  // Ad Texts
  async getAdTexts(
    projectId: string,
    options: {
      days?: number;
      startDate?: string;
      endDate?: string;
      connectionId?: string;
    } = {}
  ): Promise<AdText[]> {
    const { days = 30, startDate, endDate, connectionId } = options;
    const params = new URLSearchParams();

    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else {
      params.append('days', String(days));
    }

    if (connectionId) {
      params.append('connectionId', connectionId);
    }

    const response = await fetch(
      `${API_BASE_URL}/api/yandex/ad-texts/${projectId}?${params}`
    );
    return response.json();
  },

  // AI Recommendations
  async getRecommendations(connectionId: string): Promise<Recommendation[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/yandex/recommendations/${connectionId}`
    );
    return response.json();
  },
};
