import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Eye,
  Link as LinkIcon,
} from 'lucide-react';

import { useProjectStore } from '../store/projectStore';
import { projectsService } from '../services/api';
import {
  DashboardHeader,
  KpiWidget,
  MetricsCards,
  CampaignsTable,
  StatsChart,
  ReportsSection,
  AIRecommendations,
  LandingPagesTable,
} from '../components/dashboard';
import { dashboardService } from '../hooks/useDashboardData';

// Функция группировки данных
function groupDataByPeriod(data: any[], period: string): any[] {
  if (period === 'day' || data.length === 0) return data;

  const grouped = new Map<string, any>();

  data.forEach((item) => {
    const date = new Date(item.date);
    let key: string;
    let displayDate: string;

    if (period === '3days') {
      const dayOfYear = Math.floor(
        (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
      );
      const periodIndex = Math.floor(dayOfYear / 3);
      key = `${date.getFullYear()}-${periodIndex}`;
      displayDate = item.date;
    } else if (period === 'week') {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const yearStart = new Date(d.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      key = `${d.getFullYear()}-W${weekNumber}`;
      const monday = new Date(date);
      monday.setDate(date.getDate() - (date.getDay() === 0 ? 6 : date.getDay() - 1));
      displayDate = monday.toISOString().split('T')[0];
    } else if (period === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      displayDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      key = item.date;
      displayDate = item.date;
    }

    if (!grouped.has(key)) {
      grouped.set(key, {
        date: displayDate,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        revenue: 0,
        bounceWeighted: 0,
        daysCount: 0,
      });
    }

    const g = grouped.get(key)!;
    g.impressions += item.impressions || 0;
    g.clicks += item.clicks || 0;
    g.cost += item.cost || 0;
    g.conversions += item.conversions || 0;
    g.revenue += item.revenue || 0;
    g.bounceWeighted += (item.bounceRate || 0) * (item.clicks || 0);
    g.daysCount += 1;
  });

  return Array.from(grouped.values()).map((g) => ({
    date: g.date,
    impressions: g.impressions,
    clicks: g.clicks,
    cost: g.cost,
    conversions: g.conversions,
    revenue: g.revenue,
    ctr: g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0,
    cpc: g.clicks > 0 ? g.cost / g.clicks : 0,
    bounceRate: g.clicks > 0 ? g.bounceWeighted / g.clicks : 0,
    cpl: g.conversions > 0 ? g.cost / g.conversions : 0,
    cr: g.clicks > 0 ? (g.conversions / g.clicks) * 100 : 0,
  }));
}

export function YandexDashboard() {
  const navigate = useNavigate();
  const { activeProjectId: globalActiveProjectId, setActiveProjectId } = useProjectStore();

  // Состояние фильтров
  const [dateRange, setDateRange] = useState(30);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [groupBy, setGroupBy] = useState('day');

  // Глобальные фильтры
  const [globalFilterCampaignId, setGlobalFilterCampaignId] = useState<string | null>(null);
  const [globalFilterAdGroupId, setGlobalFilterAdGroupId] = useState<string | null>(null);
  const [globalFilterAdId, setGlobalFilterAdId] = useState<string | null>(null);

  // UI состояние
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Scroll listener с гистерезисом - разные пороги для сворачивания/разворачивания
  // чтобы избежать цикла (сворачивание меняет высоту страницы, что триггерит обратно)
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsHeaderCompact((prev) => {
        if (prev) {
          // Шапка свёрнута - разворачиваем только если поднялись выше 50px
          return scrollY > 50;
        } else {
          // Шапка развёрнута - сворачиваем только после 150px
          return scrollY > 150;
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Загрузка проектов
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
    retry: false,
  });

  // Проверяем, существует ли сохранённый проект в списке проектов
  const savedProjectExists = projects.some((p: any) => p.id === globalActiveProjectId);
  const activeProjectId = (savedProjectExists ? globalActiveProjectId : projects[0]?.id) || '';
  const activeProject = projects.find((p: any) => p.id === activeProjectId);

  useEffect(() => {
    // Устанавливаем первый проект, если сохранённый не существует или отсутствует
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
  const activeConnection = connections.find((c: any) => c.id === activeConnectionId);

  // Загрузка целей
  const { data: availableGoals = [] } = useQuery({
    queryKey: ['yandex-goals', activeProjectId, activeConnectionId],
    queryFn: () => dashboardService.getAvailableGoals(activeProjectId, activeConnectionId),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка иерархических данных (кампании)
  const { data: hierarchicalData, isLoading: hierarchicalLoading, refetch: refetchHierarchical } = useQuery({
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


  // Обработанные данные - API возвращает массив напрямую
  const rawCampaigns = Array.isArray(hierarchicalData)
    ? hierarchicalData
    : (hierarchicalData?.campaigns || []);

  const campaigns = useMemo(() => {
    let filtered = rawCampaigns;
    if (globalFilterCampaignId) {
      filtered = filtered.filter((c: any) => c.campaignId === globalFilterCampaignId);
    }
    if (globalFilterAdGroupId) {
      filtered = filtered.map((c: any) => ({
        ...c,
        adGroups: (c.adGroups || []).filter((g: any) => g.adGroupId === globalFilterAdGroupId),
      }));
    }
    return filtered;
  }, [rawCampaigns, globalFilterCampaignId, globalFilterAdGroupId]);

  const dailyStats = useMemo(() => {
    const rawStats = Array.isArray(dailyStatsData) ? dailyStatsData : [];
    return groupDataByPeriod(rawStats, groupBy);
  }, [dailyStatsData, groupBy]);

  const totalStats = useMemo(() => {
    return campaigns.reduce(
      (acc: any, c: any) => ({
        cost: acc.cost + (c.totalCost || 0),
        clicks: acc.clicks + (c.totalClicks || 0),
        impressions: acc.impressions + (c.totalImpressions || 0),
        conversions: acc.conversions + (c.totalConversions || 0),
      }),
      { cost: 0, clicks: 0, impressions: 0, conversions: 0 }
    );
  }, [campaigns]);

  const isLoading = hierarchicalLoading || connectionsLoading;

  // Handlers
  const handleSync = async () => {
    if (!activeProjectId) return;
    setIsSyncing(true);
    try {
      await dashboardService.syncManual(activeProjectId);
      refetchHierarchical();
      refetchKpi();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveKpi = async (kpi: {
    targetCost: number;
    targetCpl: number;
    targetLeads: number;
    goalIds: string[];
  }) => {
    await dashboardService.saveKpi(activeConnectionId, kpi);
    refetchKpi();
  };

  const handleCampaignFilterChange = (campaignId: string | null) => {
    setGlobalFilterCampaignId(campaignId);
    setGlobalFilterAdGroupId(null);
    setGlobalFilterAdId(null);
  };

  const handleAdGroupFilterChange = (adGroupId: string | null, campaignId?: string) => {
    if (campaignId) {
      setGlobalFilterCampaignId(campaignId);
    }
    setGlobalFilterAdGroupId(adGroupId);
    setGlobalFilterAdId(null);
  };

  const handleAdFilterChange = (adId: string | null, adGroupId?: string, campaignId?: string) => {
    if (campaignId) {
      setGlobalFilterCampaignId(campaignId);
    }
    if (adGroupId) {
      setGlobalFilterAdGroupId(adGroupId);
    }
    setGlobalFilterAdId(adId);
  };

  // Нет проектов
  if (!projectsLoading && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Eye size={64} className="text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Нет проектов</h2>
        <p className="text-gray-500 mb-6">Создайте проект, чтобы начать работу</p>
        <button
          onClick={() => navigate('/projects/new')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Создать проект
        </button>
      </div>
    );
  }

  // Нет подключений
  if (!connectionsLoading && connections.length === 0 && activeProjectId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <LinkIcon size={64} className="text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Нет подключений</h2>
        <p className="text-gray-500 mb-6">Подключите аккаунт Яндекс.Директ</p>
        <button
          onClick={() => navigate('/connect-yandex-simple')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Подключить Яндекс.Директ
        </button>
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      {/* Header с фильтрами */}
      <DashboardHeader
        projectName={activeProject?.name}
        connections={connections}
        activeConnectionId={activeConnectionId}
        onConnectionChange={setSelectedConnectionId}
        availableGoals={availableGoals}
        selectedGoalIds={selectedGoalIds}
        onGoalIdsChange={setSelectedGoalIds}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        customDateMode={customDateMode}
        onCustomDateModeChange={setCustomDateMode}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onCustomStartDateChange={setCustomStartDate}
        onCustomEndDateChange={setCustomEndDate}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        campaigns={rawCampaigns}
        globalFilterCampaignId={globalFilterCampaignId}
        globalFilterAdGroupId={globalFilterAdGroupId}
        globalFilterAdId={globalFilterAdId}
        onCampaignFilterChange={handleCampaignFilterChange}
        onAdGroupFilterChange={handleAdGroupFilterChange}
        onAdIdFilterChange={setGlobalFilterAdId}
        isSyncing={isSyncing}
        onSync={handleSync}
        lastSyncAt={activeConnection?.lastSyncAt}
        isCompact={isHeaderCompact}
        isCollapsed={isHeaderCollapsed}
        onCollapsedChange={setIsHeaderCollapsed}
      />

      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          <span className="text-sm text-blue-900 font-medium">Загрузка данных...</span>
        </div>
      )}

      {/* KPI Widget */}
      {activeConnectionId && (
        <KpiWidget
          kpiData={kpiData}
          availableGoals={availableGoals}
          connectionId={activeConnectionId}
          onSaveKpi={handleSaveKpi}
        />
      )}

      {/* Метрики */}
      <MetricsCards totalStats={totalStats} budgetForecast={budgetForecastData} />

      {/* Все сворачиваемые секции */}
      <div className="space-y-4">
        {/* Таблица кампаний */}
        <CampaignsTable
          campaigns={campaigns}
          globalFilterCampaignId={globalFilterCampaignId}
          globalFilterAdGroupId={globalFilterAdGroupId}
          globalFilterAdId={globalFilterAdId}
          onCampaignFilterChange={handleCampaignFilterChange}
          onAdGroupFilterChange={handleAdGroupFilterChange}
          onAdFilterChange={handleAdFilterChange}
        />

        {/* График динамики */}
        {dailyStats.length > 0 && (
          <StatsChart data={dailyStats} title="Динамика" />
        )}

        {/* Отчёты */}
        {campaigns.length > 0 && (
          <ReportsSection
            activeProjectId={activeProjectId}
            activeConnectionId={activeConnectionId}
            dateRange={dateRange}
            globalFilterCampaignId={globalFilterCampaignId}
          />
        )}

        {/* Посадочные страницы */}
        {campaigns.length > 0 && (
          <LandingPagesTable
            activeProjectId={activeProjectId}
            activeConnectionId={activeConnectionId}
            dateRange={dateRange}
            selectedGoalIds={selectedGoalIds}
            customDateMode={customDateMode}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
          />
        )}

        {/* AI-рекомендации */}
        {activeConnectionId && (
          <AIRecommendations connectionId={activeConnectionId} />
        )}
      </div>
    </div>
  );
}
