import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Eye,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Users,
  FileText,
  Search,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  DollarSign,
  Tag,
  Type,
  Target,
  Layout,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  MousePointer,
  ArrowRight,
  X,
  Filter,
  Edit3,
  Key,
  CheckSquare,
  Save,
  Trash2,
  Settings,
  Building2,
} from 'lucide-react';

import { useProjectStore } from '../store/projectStore';
import { projectsService, API_BASE_URL } from '../services/api';
import {
  DashboardHeader,
  KpiWidget,
  MetricsCards,
  CampaignsTable,
  StatsChart,
} from '../components/dashboard';
import { dashboardService } from '../hooks/useDashboardData';

// Типы
interface GroupByPeriod {
  value: string;
  label: string;
}

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
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Секции аккордеонов
  const [isDynamicsOpen, setIsDynamicsOpen] = useState(true);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(true);
  const [openReportSections, setOpenReportSections] = useState(new Set(['audience']));
  const [audienceReportTab, setAudienceReportTab] = useState('search');
  const [technicalReportTab, setTechnicalReportTab] = useState('categories');
  const [isLandingPagesOpen, setIsLandingPagesOpen] = useState(false);
  const [landingPages, setLandingPages] = useState<any[]>([]);
  const [isLoadingLandingPages, setIsLoadingLandingPages] = useState(false);

  // Модалки
  const [editingConnection, setEditingConnection] = useState<any>(null);
  const [editForm, setEditForm] = useState({ accessToken: '', selectedGoals: [] as number[] });
  const [editAvailableGoals, setEditAvailableGoals] = useState<any[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);

  // Загрузка проектов
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
    retry: false,
  });

  const activeProjectId = globalActiveProjectId || projects[0]?.id || '';
  const activeProject = projects.find((p: any) => p.id === activeProjectId);

  useEffect(() => {
    if (projects.length > 0 && !globalActiveProjectId) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, globalActiveProjectId, setActiveProjectId]);

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

  // AI рекомендации
  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['yandex-recommendations', activeConnectionId],
    queryFn: () => dashboardService.getRecommendations(activeConnectionId),
    enabled: !!activeConnectionId,
    refetchInterval: 10 * 60 * 1000,
  });

  // Отчёты
  const { data: searchQueriesData } = useQuery({
    queryKey: ['yandex-search-queries', activeProjectId, activeConnectionId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/yandex/search-queries/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`
      );
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  const { data: deviceStatsData } = useQuery({
    queryKey: ['yandex-device-stats', activeProjectId, activeConnectionId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/yandex/device-stats/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`
      );
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  const { data: geoStatsData } = useQuery({
    queryKey: ['yandex-geo-stats', activeProjectId, activeConnectionId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/yandex/geo-report/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`
      );
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  const { data: demographicsData } = useQuery({
    queryKey: ['yandex-demographics', activeProjectId, activeConnectionId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/yandex/demographics/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`
      );
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  const { data: incomeData } = useQuery({
    queryKey: ['yandex-income', activeProjectId, activeConnectionId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/yandex/income/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`
      );
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  const { data: targetingCategoriesData } = useQuery({
    queryKey: ['yandex-targeting-categories', activeProjectId, activeConnectionId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/yandex/targeting-categories/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`
      );
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  const { data: criteriaData } = useQuery({
    queryKey: ['yandex-criteria', activeProjectId, activeConnectionId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/yandex/criteria/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`
      );
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  const { data: placementsData } = useQuery({
    queryKey: ['yandex-placements', activeProjectId, activeConnectionId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/yandex/placements/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`
      );
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  const { data: adTextsData } = useQuery({
    queryKey: ['yandex-ad-texts', activeProjectId, activeConnectionId, dateRange],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/yandex/ad-texts/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`
      );
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId,
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

  const loadLandingPages = async () => {
    if (!activeProjectId) return;
    setIsLoadingLandingPages(true);
    try {
      const data = await dashboardService.getLandingPages(
        activeProjectId,
        dateRange,
        selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
        customDateMode ? customStartDate : undefined,
        customDateMode ? customEndDate : undefined,
        activeConnectionId
      );
      setLandingPages(Array.isArray(data) ? data : []);
    } finally {
      setIsLoadingLandingPages(false);
    }
  };

  const toggleReportSection = (section: string) => {
    setOpenReportSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatLastSync = (date: any) => {
    if (!date) return 'Никогда';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ч назад`;
    return d.toLocaleDateString('ru-RU');
  };

  // Рендер отчётов
  const getReportData = (reportId: string) => {
    switch (reportId) {
      case 'search':
        return {
          columnName: 'Поисковый запрос',
          data: Array.isArray(searchQueriesData)
            ? searchQueriesData.map((item: any) => ({
                name: item.query,
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10)
            : [],
        };
      case 'demographics':
        return {
          columnName: 'Сегмент',
          data: Array.isArray(demographicsData)
            ? demographicsData.map((item: any) => ({
                name: item.segment,
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10)
            : [],
        };
      case 'devices':
        return {
          columnName: 'Устройство',
          data: Array.isArray(deviceStatsData)
            ? deviceStatsData.map((device: any) => ({
                name: device.deviceName,
                icon: device.device === 'DESKTOP' ? Monitor : device.device === 'MOBILE' ? Smartphone : Tablet,
                clicks: device.clicks,
                cost: device.cost,
                impressions: device.impressions || 0,
                conversions: device.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost)
            : [],
        };
      case 'region':
        return {
          columnName: 'Регион',
          data: Array.isArray(geoStatsData)
            ? geoStatsData.map((item: any) => ({
                name: item.region,
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10)
            : [],
        };
      case 'income':
        return {
          columnName: 'Платежеспособность',
          data: Array.isArray(incomeData)
            ? incomeData.map((item: any) => ({
                name: item.incomeGrade || item.incomeGradeRaw,
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: 0,
              })).sort((a: any, b: any) => b.cost - a.cost)
            : [],
        };
      case 'categories':
        return {
          columnName: 'Категория таргетинга',
          data: Array.isArray(targetingCategoriesData)
            ? targetingCategoriesData.map((item: any) => ({
                name: item.category || item.categoryRaw,
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: 0,
              })).sort((a: any, b: any) => b.cost - a.cost)
            : [],
        };
      case 'criteria':
        return {
          columnName: 'Условие показа',
          data: Array.isArray(criteriaData)
            ? criteriaData.map((item: any) => ({
                name: item.criterion || 'Неизвестно',
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 15)
            : [],
        };
      case 'placements':
        return {
          columnName: 'Площадка',
          data: Array.isArray(placementsData)
            ? placementsData.map((item: any) => ({
                name: item.placement,
                placementType: item.placementType || 'РСЯ',
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                ctr: item.ctr || 0,
                avgCpc: item.avgCpc || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 15)
            : [],
        };
      case 'titles':
      case 'text':
        return {
          columnName: reportId === 'titles' ? 'Заголовок' : 'Текст объявления',
          data: Array.isArray(adTextsData)
            ? adTextsData.map((item: any) => ({
                name: reportId === 'titles' ? (item.title || `Объявление ${item.adId}`) : (item.text || item.fullText || `Объявление ${item.adId}`),
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10)
            : [],
        };
      default:
        return { columnName: 'Название', data: [] };
    }
  };

  const renderReportTable = (reportId: string) => {
    const report = getReportData(reportId);
    const isPlacementsReport = reportId === 'placements';

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {report.columnName}
              </th>
              {isPlacementsReport && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Показы</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Клики</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Расход</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPC</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Конв.</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.data.length > 0 ? (
              report.data.map((item: any, idx: number) => {
                const cpl = item.conversions > 0 ? item.cost / item.conversions : 0;
                const cpc = item.clicks > 0 ? item.cost / item.clicks : 0;
                const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
                const ItemIcon = item.icon;
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">
                      {ItemIcon ? (
                        <div className="flex items-center gap-2">
                          <ItemIcon size={16} className="text-gray-400" />
                          <span>{item.name}</span>
                        </div>
                      ) : (
                        <span className="truncate block max-w-[300px]" title={item.name}>
                          {item.name}
                        </span>
                      )}
                    </td>
                    {isPlacementsReport && (
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        <span className="px-2 py-0.5 bg-gray-100 rounded">{item.placementType || 'РСЯ'}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-gray-500">
                      {(item.impressions || 0).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {Math.round(item.clicks).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {Math.round(item.cost).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{cpc > 0 ? `${cpc.toFixed(0)} ₽` : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.conversions || 0}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {cpl > 0 ? `${Math.round(cpl).toLocaleString('ru-RU')} ₽` : '—'}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={isPlacementsReport ? 9 : 8} className="px-4 py-8 text-center text-gray-500">
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Табы отчётов
  const audienceTabs = [
    { id: 'search', label: 'Поисковые запросы', icon: Search },
    { id: 'demographics', label: 'Пол / Возраст', icon: Users },
    { id: 'devices', label: 'Устройства', icon: Smartphone },
    { id: 'income', label: 'Платежеспособность', icon: DollarSign },
    { id: 'region', label: 'Регион', icon: MapPin },
  ];

  const technicalTabs = [
    { id: 'categories', label: 'Категории таргетинга', icon: Tag },
    { id: 'titles', label: 'Заголовок', icon: FileText },
    { id: 'text', label: 'Текст', icon: Type },
    { id: 'criteria', label: 'Условия показа', icon: Target },
    { id: 'placements', label: 'Площадки', icon: Layout },
  ];

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
        isScrolled={isScrolled}
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

      {/* Таблица кампаний */}
      <CampaignsTable
        campaigns={campaigns}
        globalFilterCampaignId={globalFilterCampaignId}
        globalFilterAdGroupId={globalFilterAdGroupId}
        onCampaignFilterChange={handleCampaignFilterChange}
        onAdGroupFilterChange={handleAdGroupFilterChange}
      />

      {/* График динамики */}
      {dailyStats.length > 0 && (
        <StatsChart data={dailyStats} title="Динамика" />
      )}

      {/* Отчёты */}
      {campaigns.length > 0 && (
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-3">
            <BarChart3 size={22} className="text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Отчёты</h2>
          </div>

          {/* Показатели аудитории */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleReportSection('audience')}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users size={20} className="text-blue-600" />
                <span className="font-semibold text-gray-900">Показатели аудитории</span>
              </div>
              {openReportSections.has('audience') ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>
            {openReportSections.has('audience') && (
              <div className="border-t border-gray-200">
                <div className="flex flex-wrap gap-1 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  {audienceTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = audienceReportTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setAudienceReportTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                {renderReportTable(audienceReportTab)}
              </div>
            )}
          </div>

          {/* Технические показатели */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleReportSection('technical')}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-blue-600" />
                <span className="font-semibold text-gray-900">Технические показатели</span>
              </div>
              {openReportSections.has('technical') ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>
            {openReportSections.has('technical') && (
              <div className="border-t border-gray-200">
                <div className="flex flex-wrap gap-1 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  {technicalTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = technicalReportTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setTechnicalReportTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                {renderReportTable(technicalReportTab)}
              </div>
            )}
          </div>

          {/* Посадочные страницы */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => {
                const newState = !isLandingPagesOpen;
                setIsLandingPagesOpen(newState);
                if (newState) loadLandingPages();
              }}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <LinkIcon size={20} className="text-blue-600" />
                <span className="font-semibold text-gray-900">Посадочные страницы</span>
                {landingPages.length > 0 && (
                  <span className="text-xs text-gray-400">{landingPages.length} страниц</span>
                )}
              </div>
              {isLandingPagesOpen ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>
            {isLandingPagesOpen && (
              <div className="border-t border-gray-200">
                {isLoadingLandingPages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-blue-600" size={24} />
                  </div>
                ) : landingPages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Нет данных</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Страница
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Клики
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Расход
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Конв.
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            CPL
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {landingPages.map((lp, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">
                              <a
                                href={lp.landingPage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate block max-w-xs"
                              >
                                {lp.landingPage?.replace(/^https?:\/\//, '').substring(0, 50)}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {lp.clicks?.toLocaleString() || 0}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                              {(lp.cost || 0).toLocaleString('ru-RU')} ₽
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {lp.conversions || 0}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {lp.conversions > 0 ? `${(lp.cpl || 0).toFixed(0)} ₽` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI-рекомендации */}
      {activeConnectionId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setIsRecommendationsOpen(!isRecommendationsOpen)}
          >
            <div className="flex items-center gap-3">
              <ChevronDown
                size={20}
                className={`text-gray-400 transition-transform ${!isRecommendationsOpen ? '-rotate-90' : ''}`}
              />
              <Sparkles size={20} className="text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">AI-рекомендации</h3>
            </div>
            {Array.isArray(recommendationsData) &&
              recommendationsData.some((r: any) => r.type === 'critical') && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  <AlertTriangle size={14} />
                  Требует внимания
                </div>
              )}
          </div>

          {isRecommendationsOpen && (
            <div className="px-6 pb-6 pt-2">
              {recommendationsLoading ? (
                <div className="text-center py-6 text-gray-500">
                  <Loader2 size={32} className="mx-auto mb-3 animate-spin text-gray-300" />
                  <p className="text-sm">Анализируем данные...</p>
                </div>
              ) : Array.isArray(recommendationsData) && recommendationsData.length > 0 ? (
                <div className="space-y-3">
                  {recommendationsData.map((rec: any, index: number) => {
                    const getBgColor = () => {
                      switch (rec.type) {
                        case 'critical':
                          return 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200';
                        case 'warning':
                          return 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200';
                        case 'success':
                          return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200';
                        default:
                          return 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200';
                      }
                    };
                    const getIcon = () => {
                      switch (rec.type) {
                        case 'critical':
                          return <AlertTriangle size={18} className="text-red-600" />;
                        case 'warning':
                          return <AlertCircle size={18} className="text-amber-600" />;
                        case 'success':
                          return <CheckCircle size={18} className="text-green-600" />;
                        default:
                          return <Sparkles size={18} className="text-blue-600" />;
                      }
                    };

                    return (
                      <div key={index} className={`rounded-xl p-4 border ${getBgColor()}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm">{rec.title}</h4>
                            <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                            <div className="flex items-center gap-2">
                              <ArrowRight size={14} className="text-gray-400" />
                              <span className="text-sm font-medium text-gray-700">{rec.actionText}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <CheckCircle size={40} className="mx-auto mb-3 text-green-300" />
                  <p className="text-sm font-medium text-green-700">Всё отлично!</p>
                  <p className="text-xs text-gray-500 mt-1">Критических проблем не обнаружено</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
