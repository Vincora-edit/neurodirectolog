import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProjectStore } from '../store/projectStore';
import { projectsService, API_BASE_URL } from '../services/api';

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Dashboard API Service
const dashboardService = {
  async getConnections(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/connections/${projectId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return [];
    return response.json();
  },

  async getAvailableGoals(projectId: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/available-goals/${projectId}`;
    if (connectionId) {
      url += `?connectionId=${connectionId}`;
    }
    const response = await fetch(url, { headers: getAuthHeaders() });
    return response.json();
  },

  async getDetailedStats(
    projectId: string,
    days: number = 30,
    goalIds?: string[],
    startDate?: string,
    endDate?: string,
    connectionId?: string
  ) {
    let url = `${API_BASE_URL}/api/yandex/detailed-stats/${projectId}?`;
    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }
    if (goalIds && goalIds.length > 0) {
      url += `&goalIds=${goalIds.join(',')}`;
    }
    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }
    const response = await fetch(url, { headers: getAuthHeaders() });
    return response.json();
  },

  async getHierarchicalStats(
    projectId: string,
    days: number = 30,
    goalIds?: string[],
    startDate?: string,
    endDate?: string,
    connectionId?: string
  ) {
    let url = `${API_BASE_URL}/api/yandex/hierarchical-stats/${projectId}?`;
    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }
    if (goalIds && goalIds.length > 0) {
      url += `&goalIds=${goalIds.join(',')}`;
    }
    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }
    const response = await fetch(url, { headers: getAuthHeaders() });
    return response.json();
  },

  async getDailyStats(
    projectId: string,
    days: number = 30,
    goalIds?: string[],
    startDate?: string,
    endDate?: string,
    connectionId?: string,
    campaignId?: string | null,
    adGroupId?: string | null,
    adId?: string | null
  ) {
    let url = `${API_BASE_URL}/api/yandex/daily-stats/${projectId}?`;
    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }
    if (goalIds && goalIds.length > 0) {
      url += `&goalIds=${goalIds.join(',')}`;
    }
    if (connectionId) url += `&connectionId=${connectionId}`;
    if (campaignId) url += `&campaignId=${campaignId}`;
    if (adGroupId) url += `&adGroupId=${adGroupId}`;
    if (adId) url += `&adId=${adId}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return response.json();
  },

  async getKpi(connectionId: string) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/kpi/${connectionId}`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  async saveKpi(
    connectionId: string,
    kpi: { targetCost: number; targetCpl: number; targetLeads: number; goalIds?: string[] }
  ) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/kpi/${connectionId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(kpi),
    });
    return response.json();
  },

  async getBudgetForecast(connectionId: string) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/budget-forecast/${connectionId}`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  async syncManual(projectId: string): Promise<{ success: boolean; message?: string; jobId?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/yandex/sync/${projectId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  async getSyncJobStatus(jobId: string): Promise<{
    id: string;
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
    progress: number;
    stage?: string;
    error?: string;
  } | null> {
    const response = await fetch(`${API_BASE_URL}/api/yandex/queue/job/${jobId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return null;
    return response.json();
  },

  async getRecommendations(connectionId: string) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/recommendations/${connectionId}`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  async getLandingPages(
    projectId: string,
    days: number = 30,
    goalIds?: string[],
    startDate?: string,
    endDate?: string,
    connectionId?: string
  ) {
    let url = `${API_BASE_URL}/api/yandex/landing-pages/${projectId}?`;
    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }
    if (goalIds && goalIds.length > 0) {
      url += `&goalIds=${goalIds.join(',')}`;
    }
    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }
    const response = await fetch(url, { headers: getAuthHeaders() });
    return response.json();
  },
};

export { dashboardService };

interface UseDashboardDataOptions {
  dateRange: number;
  customDateMode: boolean;
  customStartDate: string;
  customEndDate: string;
  selectedGoalIds: string[];
  selectedConnectionId: string;
  globalFilterCampaignId: string | null;
  globalFilterAdGroupId: string | null;
  globalFilterAdId: string | null;
}

export function useDashboardData(options: UseDashboardDataOptions) {
  const { activeProjectId: globalActiveProjectId, setActiveProjectId } = useProjectStore();

  const {
    dateRange,
    customDateMode,
    customStartDate,
    customEndDate,
    selectedGoalIds,
    selectedConnectionId,
    globalFilterCampaignId,
    globalFilterAdGroupId,
    globalFilterAdId,
  } = options;

  // Загрузка проектов
  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
    retry: false,
  });

  // Проверяем, существует ли сохранённый проект в списке проектов
  const savedProjectExists = projects.some((p: any) => p.id === globalActiveProjectId);
  const activeProjectId = (savedProjectExists ? globalActiveProjectId : projects[0]?.id) || '';

  // Устанавливаем первый проект как активный, если сохранённый не существует
  useEffect(() => {
    if (projects.length > 0 && (!globalActiveProjectId || !savedProjectExists)) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, globalActiveProjectId, savedProjectExists, setActiveProjectId]);

  // Загрузка подключений
  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['yandex-connections', activeProjectId],
    queryFn: () => dashboardService.getConnections(activeProjectId),
    enabled: !!activeProjectId,
  });

  const activeConnectionId = selectedConnectionId || connections[0]?.id || '';
  const activeProject = projects.find((p: any) => p.id === activeProjectId);
  const activeConnection = connections.find((c: any) => c.id === activeConnectionId);

  // Загрузка целей
  const { data: availableGoals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['yandex-goals', activeProjectId, activeConnectionId],
    queryFn: () => dashboardService.getAvailableGoals(activeProjectId, activeConnectionId),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка статистики
  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: [
      'yandex-detailed-stats',
      activeProjectId,
      activeConnectionId,
      dateRange,
      selectedGoalIds,
      customDateMode,
      customStartDate,
      customEndDate,
    ],
    queryFn: () =>
      dashboardService.getDetailedStats(
        activeProjectId,
        dateRange,
        selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
        customDateMode ? customStartDate : undefined,
        customDateMode ? customEndDate : undefined,
        activeConnectionId
      ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка иерархических данных
  const {
    data: hierarchicalData,
    isLoading: hierarchicalLoading,
    refetch: refetchHierarchical,
  } = useQuery({
    queryKey: [
      'yandex-hierarchical-stats',
      activeProjectId,
      activeConnectionId,
      dateRange,
      selectedGoalIds,
      customDateMode,
      customStartDate,
      customEndDate,
    ],
    queryFn: () =>
      dashboardService.getHierarchicalStats(
        activeProjectId,
        dateRange,
        selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
        customDateMode ? customStartDate : undefined,
        customDateMode ? customEndDate : undefined,
        activeConnectionId
      ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Статистика по дням
  const { data: dailyStatsData } = useQuery({
    queryKey: [
      'yandex-daily-stats',
      activeProjectId,
      activeConnectionId,
      dateRange,
      selectedGoalIds,
      customDateMode,
      customStartDate,
      customEndDate,
      globalFilterCampaignId,
      globalFilterAdGroupId,
      globalFilterAdId,
    ],
    queryFn: () =>
      dashboardService.getDailyStats(
        activeProjectId,
        dateRange,
        selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
        customDateMode ? customStartDate : undefined,
        customDateMode ? customEndDate : undefined,
        activeConnectionId,
        globalFilterCampaignId,
        globalFilterAdGroupId,
        globalFilterAdId
      ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // KPI
  const { data: kpiData, refetch: refetchKpi } = useQuery({
    queryKey: ['yandex-kpi', activeConnectionId],
    queryFn: () => dashboardService.getKpi(activeConnectionId),
    enabled: !!activeConnectionId,
  });

  // Прогноз бюджета
  const { data: budgetForecastData } = useQuery({
    queryKey: ['yandex-budget-forecast', activeConnectionId],
    queryFn: () => dashboardService.getBudgetForecast(activeConnectionId),
    enabled: !!activeConnectionId,
    refetchInterval: 5 * 60 * 1000,
  });

  // AI рекомендации
  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['yandex-recommendations', activeConnectionId],
    queryFn: () => dashboardService.getRecommendations(activeConnectionId),
    enabled: !!activeConnectionId,
    refetchInterval: 10 * 60 * 1000,
  });

  const isLoading = statsLoading || connectionsLoading || goalsLoading || hierarchicalLoading;

  return {
    // Projects
    projects,
    projectsLoading,
    projectsError,
    activeProject,
    activeProjectId,

    // Connections
    connections,
    connectionsLoading,
    activeConnection,
    activeConnectionId,

    // Goals
    availableGoals,
    goalsLoading,

    // Stats
    statsData,
    statsLoading,
    hierarchicalData,
    hierarchicalLoading,
    dailyStatsData,

    // KPI
    kpiData,
    refetchKpi,

    // Budget
    budgetForecastData,

    // Recommendations
    recommendationsData,
    recommendationsLoading,

    // Refetch functions
    refetchStats,
    refetchHierarchical,

    // Loading state
    isLoading,

    // Service
    dashboardService,
  };
}
