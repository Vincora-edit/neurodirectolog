// Типы для Yandex Dashboard

export interface YandexConnection {
  id: string;
  projectId: string;
  login: string;
  accessToken: string;
  clientId?: string;
  metrikaCounterId?: string;
  selectedGoals?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface YandexGoal {
  id: number;
  name: string;
  type?: string;
}

export interface Campaign {
  campaignId: string;
  campaignName: string;
  status?: string;
  totalImpressions: number;
  totalClicks: number;
  totalCost: number;
  avgCpc: number;
  avgCtr: number;
  avgBounceRate: number;
  totalConversions: number;
  adGroups?: AdGroup[];
}

export interface AdGroup {
  adGroupId: string;
  adGroupName: string;
  totalImpressions: number;
  totalClicks: number;
  totalCost: number;
  avgCpc: number;
  avgCtr: number;
  avgBounceRate: number;
  totalConversions: number;
  ads?: Ad[];
}

export interface Ad {
  adId: string;
  title?: string;
  text?: string;
  totalImpressions: number;
  totalClicks: number;
  totalCost: number;
  avgCpc: number;
  avgCtr: number;
  avgBounceRate: number;
  totalConversions: number;
}

export interface DailyStats {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  bounceRate: number;
  cpl: number;
  cr: number;
}

export interface KpiData {
  targetCost: number;
  targetCpl: number;
  targetLeads: number;
  goalIds?: string[];
  month?: string;
  currentCost?: number;
  currentLeads?: number;
  currentCpl?: number;
  progress?: {
    cost: number;
    leads: number;
    cpl: number;
  };
}

export interface KpiForm {
  targetCost: number;
  targetCpl: number;
  targetLeads: number;
  goalIds: string[];
}

export interface BudgetForecast {
  currentSpend: number;
  dailyAverage: number;
  projectedMonthly: number;
  daysRemaining: number;
  recommendedDaily?: number;
}

export interface LandingPage {
  url: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  bounceRate: number;
  ctr: number;
  cpc: number;
  cpl: number;
}

export interface DeviceStats {
  device: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface GeoStats {
  region: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface SearchQuery {
  query: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface Demographics {
  ageGroup?: string;
  gender?: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

export interface Placement {
  placement: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface IncomeStats {
  incomeGrade: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

export interface TargetingCategory {
  category: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

export interface Criteria {
  criterion: string;
  criterionType: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface AdText {
  title: string;
  text: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface Recommendation {
  id: string;
  type: 'warning' | 'suggestion' | 'success';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  campaignId?: string;
  adGroupId?: string;
}

// Типы для состояния фильтров
export interface DashboardFilters {
  dateRange: number;
  customDateMode: boolean;
  customStartDate: string;
  customEndDate: string;
  selectedGoalIds: string[];
  connectionId: string;
  campaignId: string | null;
  adGroupId: string | null;
  adId: string | null;
}

// Типы для сортировки
export type SortColumn =
  | 'totalImpressions'
  | 'totalClicks'
  | 'totalCost'
  | 'avgCpc'
  | 'avgCtr'
  | 'avgBounceRate'
  | 'totalConversions'
  | 'cr'
  | 'cpl';

export type SortDirection = 'asc' | 'desc';

// Типы для группировки данных
export type GroupByPeriod = 'day' | '3days' | 'week' | 'month';

// Типы для метрик графика
export type ChartMetric = 'cost' | 'clicks' | 'impressions' | 'conversions' | 'ctr' | 'cpc' | 'cpl' | 'cr';
