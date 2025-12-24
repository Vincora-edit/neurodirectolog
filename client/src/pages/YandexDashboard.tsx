import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsService, API_BASE_URL } from '../services/api';
import { useProjectStore } from '../store/projectStore';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  MousePointer,
  Eye,
  Target,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Link as LinkIcon,
  Calendar,
  ArrowRight,
  Loader2,
  Clock,
  Folder,
  Building2,
  BarChart3,
  Settings,
  Trash2,
  X,
  Edit3,
  Save,
  Key,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  MoreVertical,
  ArrowUpDown,
  FileText,
  Users,
  Monitor,
  Smartphone,
  Tablet,
  Filter,
  Search,
  MapPin,
  Layout,
  Tag,
  Type,
  Megaphone,
  Gauge,
  TrendingUp as TrendUp,
  Wallet,
  AlertTriangle,
  CheckCircle,
  Banknote,
} from 'lucide-react';

// API Service для получения данных дашборда
const dashboardService = {
  async getConnection(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/connection/${projectId}`);
    if (!response.ok) return null;
    return response.json();
  },

  async getConnections(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/connections/${projectId}`);
    if (!response.ok) return [];
    return response.json();
  },

  async getCampaigns(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/campaigns/${projectId}`);
    return response.json();
  },

  async getDetailedStats(projectId: string, days: number = 30, goalIds?: string[], startDate?: string, endDate?: string, connectionId?: string) {
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

    const response = await fetch(url);
    return response.json();
  },

  async getAvailableGoals(projectId: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/available-goals/${projectId}`;
    if (connectionId) {
      url += `?connectionId=${connectionId}`;
    }
    const response = await fetch(url);
    return response.json();
  },

  async syncManual(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/sync/${projectId}`, {
      method: 'POST',
    });
    return response.json();
  },

  async getHierarchicalStats(projectId: string, days: number = 30, goalIds?: string[], startDate?: string, endDate?: string, connectionId?: string) {
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

    const response = await fetch(url);
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

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    if (campaignId) {
      url += `&campaignId=${campaignId}`;
    }

    if (adGroupId) {
      url += `&adGroupId=${adGroupId}`;
    }

    if (adId) {
      url += `&adId=${adId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  // KPI API
  async getKpi(connectionId: string, goalIds?: string[]) {
    let url = `${API_BASE_URL}/api/yandex/kpi/${connectionId}`;
    if (goalIds && goalIds.length > 0) {
      url += `?goalIds=${goalIds.join(',')}`;
    }
    const response = await fetch(url);
    return response.json();
  },

  async saveKpi(connectionId: string, kpi: { targetCost: number; targetCpl: number; targetLeads: number; goalIds?: string[]; month?: string }) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/kpi/${connectionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kpi),
    });
    return response.json();
  },

  async getLandingPages(projectId: string, days: number = 30, goalIds?: string[], startDate?: string, endDate?: string, connectionId?: string) {
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

    const response = await fetch(url);
    return response.json();
  },

  async getBudgetForecast(connectionId: string) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/budget-forecast/${connectionId}`);
    return response.json();
  },

  async getDeviceStats(projectId: string, days: number = 30, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/device-stats/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getGeoStats(projectId: string, days: number = 30, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/geo-stats/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getSearchQueries(projectId: string, days: number = 30, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/search-queries/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getDemographics(projectId: string, days: number = 30, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/demographics/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getGeoReport(projectId: string, days: number = 30, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/geo-report/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getPlacements(projectId: string, days: number = 30, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/placements/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getIncome(projectId: string, days: number = 30, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/income/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getTargetingCategories(projectId: string, days: number = 30, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/targeting-categories/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getCriteria(projectId: string, days: number = 30, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/criteria/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getAdTexts(projectId: string, days: number = 30, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/ad-texts/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (connectionId) {
      url += `&connectionId=${connectionId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getRecommendations(connectionId: string) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/recommendations/${connectionId}`);
    return response.json();
  },
};

// Компонент круговой прогресс-бар
const CircularProgress = ({
  value,
  dayValue,
  size = 100,
  strokeWidth = 8,
  color = '#3b82f6',
  dayColor = '#93c5fd',
  label,
  sublabel,
}: {
  value: number;
  dayValue?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  dayColor?: string;
  label: string;
  sublabel?: string;
}) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(value, 100);
  const dayProgress = dayValue !== undefined ? Math.min(dayValue, 100) : 0;
  const offset = circumference - (progress / 100) * circumference;
  const dayOffset = circumference - (dayProgress / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Day progress (outer thin ring) */}
          {dayValue !== undefined && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius + strokeWidth + 2}
              fill="none"
              stroke={dayColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${(radius + strokeWidth + 2) * 2 * Math.PI}`}
              strokeDashoffset={(radius + strokeWidth + 2) * 2 * Math.PI - (dayProgress / 100) * (radius + strokeWidth + 2) * 2 * Math.PI}
              className="transition-all duration-500"
            />
          )}
          {/* Main progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-gray-900">{label}</span>
          {sublabel && <span className="text-xs text-gray-500">{sublabel}</span>}
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className="text-sm font-medium text-gray-700">{Math.round(value)}%</div>
        {dayValue !== undefined && (
          <div className="text-xs text-gray-500">к дню: {Math.round(dayValue)}%</div>
        )}
      </div>
    </div>
  );
};

export default function YandexDashboard() {
  const navigate = useNavigate();
  const { activeProjectId: globalActiveProjectId, setActiveProjectId } = useProjectStore();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [dateRange, setDateRange] = useState<number>(30);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [showGoalsDropdown, setShowGoalsDropdown] = useState<boolean>(false);
  const [groupBy, setGroupBy] = useState<string>('day');
  const [customDateMode, setCustomDateMode] = useState<boolean>(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState<boolean>(false);
  const [editingConnection, setEditingConnection] = useState<any>(null);
  const [editForm, setEditForm] = useState<{
    accessToken: string;
    selectedGoals: number[];
  }>({ accessToken: '', selectedGoals: [] });
  const [editAvailableGoals, setEditAvailableGoals] = useState<Array<{ id: number; name: string }>>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdGroups, setExpandedAdGroups] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string>('totalCost');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Состояние для главных аккордеонов отчётов
  const [openReportSections, setOpenReportSections] = useState<Set<string>>(new Set());

  // Активный таб внутри каждой секции
  const [audienceReportTab, setAudienceReportTab] = useState<string>('search');
  const [technicalReportTab, setTechnicalReportTab] = useState<string>('categories');

  // Фильтр по кампании/группе для отчётов
  const [reportFilterCampaignId, setReportFilterCampaignId] = useState<string | null>(null);
  const [reportFilterAdGroupId, setReportFilterAdGroupId] = useState<string | null>(null);

  // Выбранные метрики для графика
  const [selectedChartMetrics, setSelectedChartMetrics] = useState<Set<string>>(new Set(['cost', 'clicks']));

  // Глобальные фильтры по кампании/группе/объявлению
  const [globalFilterCampaignId, setGlobalFilterCampaignId] = useState<string | null>(null);
  const [globalFilterAdGroupId, setGlobalFilterAdGroupId] = useState<string | null>(null);
  const [globalFilterAdId, setGlobalFilterAdId] = useState<string | null>(null);

  // Состояние для компактной шапки при скролле и полного сворачивания
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // KPI состояния
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [isKpiCollapsed, setIsKpiCollapsed] = useState(false);
  const [kpiForm, setKpiForm] = useState({
    targetCost: 0,
    targetCpl: 0,
    targetLeads: 0,
    goalIds: [] as string[],
  });
  const [isSavingKpi, setIsSavingKpi] = useState(false);
  const [showKpiGoalsDropdown, setShowKpiGoalsDropdown] = useState(false);

  // Landing pages state
  const [landingPages, setLandingPages] = useState<any[]>([]);
  const [isLoadingLandingPages, setIsLoadingLandingPages] = useState(false);
  const [isLandingPagesOpen, setIsLandingPagesOpen] = useState(false);

  // Dynamics section state
  const [isDynamicsOpen, setIsDynamicsOpen] = useState(true);

  // Budget forecast state
  const [budgetForecast, setBudgetForecast] = useState<any>(null);
  const [isLoadingBudgetForecast, setIsLoadingBudgetForecast] = useState(false);
  const [isBudgetForecastOpen, setIsBudgetForecastOpen] = useState(true);

  // Geo stats state
  const [isGeoStatsOpen, setIsGeoStatsOpen] = useState(false);

  // AI Recommendations state
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(true);

  // Отслеживаем скролл для компактного режима
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Функция переключения главного аккордеона
  const toggleReportSection = (sectionId: string) => {
    setOpenReportSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Загрузка проектов
  const { data: projects = [], isLoading: projectsLoading, isError: projectsError } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
    retry: false, // Не повторять при ошибке авторизации
  });

  // Если ошибка загрузки проектов - скорее всего токен истёк, редирект на логин
  if (projectsError) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return null;
  }

  // Используем глобальный activeProjectId из стора или первый проект
  const activeProjectId = globalActiveProjectId || projects[0]?.id || '';

  // Устанавливаем первый проект как активный, если нет выбранного
  useEffect(() => {
    if (projects.length > 0 && !globalActiveProjectId) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, globalActiveProjectId, setActiveProjectId]);

  // Загрузка всех подключений для проекта (мультиаккаунтность)
  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['yandex-connections', activeProjectId],
    queryFn: () => dashboardService.getConnections(activeProjectId),
    enabled: !!activeProjectId,
  });

  // Автоматически выбираем первое подключение
  const activeConnectionId = selectedConnectionId || connections[0]?.id || '';
  const activeProject = projects.find((p: any) => p.id === activeProjectId);
  const activeConnection = connections.find((c: any) => c.id === activeConnectionId);

  // Загрузка доступных целей
  const { data: availableGoals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['yandex-goals', activeProjectId, activeConnectionId],
    queryFn: () => dashboardService.getAvailableGoals(activeProjectId, activeConnectionId),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка статистики (для общих метрик)
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['yandex-detailed-stats', activeProjectId, activeConnectionId, dateRange, selectedGoalIds, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getDetailedStats(
      activeProjectId,
      dateRange,
      selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка иерархических данных (Кампании → Группы → Объявления)
  const { data: hierarchicalData, isLoading: hierarchicalLoading, refetch: refetchHierarchical } = useQuery({
    queryKey: ['yandex-hierarchical-stats', activeProjectId, activeConnectionId, dateRange, selectedGoalIds, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getHierarchicalStats(
      activeProjectId,
      dateRange,
      selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Статистика по дням для графиков и таблицы (с глобальными фильтрами)
  const { data: dailyStatsData } = useQuery({
    queryKey: ['yandex-daily-stats', activeProjectId, activeConnectionId, dateRange, selectedGoalIds, customDateMode, customStartDate, customEndDate, globalFilterCampaignId, globalFilterAdGroupId, globalFilterAdId],
    queryFn: () => dashboardService.getDailyStats(
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

  // Загрузка KPI для аккаунта
  // KPI использует свои собственные привязанные цели (настраиваются в KPI модале)
  const { data: kpiData, refetch: refetchKpi } = useQuery({
    queryKey: ['yandex-kpi', activeConnectionId],
    queryFn: () => dashboardService.getKpi(activeConnectionId),
    enabled: !!activeConnectionId,
  });

  // Загрузка прогноза бюджета
  const { data: budgetForecastData, refetch: refetchBudgetForecast } = useQuery({
    queryKey: ['yandex-budget-forecast', activeConnectionId],
    queryFn: () => dashboardService.getBudgetForecast(activeConnectionId),
    enabled: !!activeConnectionId,
    refetchInterval: 5 * 60 * 1000, // Обновляем каждые 5 минут
  });

  // Загрузка статистики по устройствам
  const { data: deviceStatsData, isLoading: deviceStatsLoading } = useQuery({
    queryKey: ['yandex-device-stats', activeProjectId, activeConnectionId, dateRange, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getDeviceStats(
      activeProjectId,
      dateRange,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка статистики по регионам
  const { data: geoStatsData, isLoading: geoStatsLoading } = useQuery({
    queryKey: ['yandex-geo-stats', activeProjectId, activeConnectionId, dateRange, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getGeoStats(
      activeProjectId,
      dateRange,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка статистики по поисковым запросам
  const { data: searchQueriesData, isLoading: searchQueriesLoading } = useQuery({
    queryKey: ['yandex-search-queries', activeProjectId, activeConnectionId, dateRange, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getSearchQueries(
      activeProjectId,
      dateRange,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка демографической статистики
  const { data: demographicsData, isLoading: demographicsLoading } = useQuery({
    queryKey: ['yandex-demographics', activeProjectId, activeConnectionId, dateRange, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getDemographics(
      activeProjectId,
      dateRange,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка geo-отчёта (альтернативный)
  const { data: geoReportData, isLoading: geoReportLoading } = useQuery({
    queryKey: ['yandex-geo-report', activeProjectId, activeConnectionId, dateRange, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getGeoReport(
      activeProjectId,
      dateRange,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка статистики по площадкам
  const { data: placementsData, isLoading: placementsLoading } = useQuery({
    queryKey: ['yandex-placements', activeProjectId, activeConnectionId, dateRange, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getPlacements(
      activeProjectId,
      dateRange,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка статистики по платежеспособности (IncomeGrade)
  const { data: incomeData, isLoading: incomeLoading } = useQuery({
    queryKey: ['yandex-income', activeProjectId, activeConnectionId, dateRange, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getIncome(
      activeProjectId,
      dateRange,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка статистики по категориям таргетинга
  const { data: targetingCategoriesData, isLoading: targetingCategoriesLoading } = useQuery({
    queryKey: ['yandex-targeting-categories', activeProjectId, activeConnectionId, dateRange, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getTargetingCategories(
      activeProjectId,
      dateRange,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка статистики по условиям показа (ключевым словам)
  const { data: criteriaData, isLoading: criteriaLoading } = useQuery({
    queryKey: ['yandex-criteria', activeProjectId, activeConnectionId, dateRange, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getCriteria(
      activeProjectId,
      dateRange,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка статистики по текстам объявлений
  const { data: adTextsData, isLoading: adTextsLoading } = useQuery({
    queryKey: ['yandex-ad-texts', activeProjectId, activeConnectionId, dateRange, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getAdTexts(
      activeProjectId,
      dateRange,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  // Загрузка AI-рекомендаций
  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['yandex-recommendations', activeConnectionId],
    queryFn: () => dashboardService.getRecommendations(activeConnectionId),
    enabled: !!activeConnectionId,
    refetchInterval: 10 * 60 * 1000, // Обновляем каждые 10 минут
  });

  // Загрузка посадочных страниц при открытии секции
  const loadLandingPages = async () => {
    if (!activeProjectId || !activeConnectionId) return;
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
    } catch (error) {
      console.error('Failed to load landing pages:', error);
      setLandingPages([]);
    }
    setIsLoadingLandingPages(false);
  };

  const rawDailyStats = Array.isArray(dailyStatsData) ? dailyStatsData : [];

  // Функция группировки данных по периоду
  const groupDataByPeriod = (data: any[], period: string) => {
    if (period === 'day' || data.length === 0) return data;

    const grouped = new Map<string, any>();

    data.forEach((item) => {
      const date = new Date(item.date);
      let key: string;
      let displayDate: string;

      if (period === '3days') {
        // Группировка по 3 дня
        const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        const periodIndex = Math.floor(dayOfYear / 3);
        key = `${date.getFullYear()}-${periodIndex}`;
        displayDate = item.date;
      } else if (period === 'week') {
        // Группировка по неделе (ISO week)
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        key = `${d.getFullYear()}-W${weekNumber}`;
        // Для отображения берём понедельник недели
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

    // Вычисляем средние значения
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
  };

  const dailyStats = groupDataByPeriod(rawDailyStats, groupBy);

  const stats = Array.isArray(statsData) ? statsData : [];
  const rawCampaigns = Array.isArray(hierarchicalData) ? hierarchicalData : (hierarchicalData?.campaigns || []);

  // Функция сортировки
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Получение значения для сортировки
  const getSortValue = (item: any, column: string): number => {
    switch (column) {
      case 'totalImpressions': return item.totalImpressions || 0;
      case 'totalClicks': return item.totalClicks || 0;
      case 'totalCost': return item.totalCost || 0;
      case 'avgCpc': return item.avgCpc || 0;
      case 'avgCtr': return item.avgCtr || 0;
      case 'avgBounceRate': return item.avgBounceRate || 0;
      case 'totalConversions': return item.totalConversions || 0;
      case 'cr': return item.totalClicks > 0 ? (item.totalConversions || 0) / item.totalClicks * 100 : 0;
      case 'cpl': return item.totalConversions > 0 ? (item.totalCost || 0) / item.totalConversions : 0;
      default: return 0;
    }
  };

  // Сортированные кампании
  const sortedCampaigns = [...rawCampaigns].sort((a: any, b: any) => {
    const aVal = getSortValue(a, sortColumn);
    const bVal = getSortValue(b, sortColumn);
    return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
  });

  // Применяем глобальный фильтр к кампаниям и группам (для таблицы)
  // Если есть фильтр по группе/объявлению - пересчитываем статистику кампании
  const campaigns = (() => {
    if (!globalFilterCampaignId) {
      return sortedCampaigns;
    }

    // Фильтруем по кампании
    let filtered = sortedCampaigns.filter((c: any) => c.campaignId === globalFilterCampaignId);

    // Если выбрана группа - фильтруем группы внутри кампании и пересчитываем статистику
    if (globalFilterAdGroupId) {
      filtered = filtered.map((c: any) => {
        let filteredGroups = (c.adGroups || []).filter((ag: any) => ag.adGroupId === globalFilterAdGroupId);

        // Если выбрано объявление - фильтруем объявления внутри групп
        if (globalFilterAdId) {
          filteredGroups = filteredGroups.map((ag: any) => ({
            ...ag,
            ads: (ag.ads || []).filter((ad: any) => ad.adId === globalFilterAdId),
          }));
        }

        // Пересчитываем статистику кампании на основе отфильтрованных групп
        const recalculatedStats = filteredGroups.reduce((acc: any, g: any) => {
          if (globalFilterAdId) {
            // Считаем по отфильтрованным объявлениям
            const adStats = (g.ads || []).reduce((aAcc: any, a: any) => ({
              impressions: aAcc.impressions + (a.totalImpressions || 0),
              clicks: aAcc.clicks + (a.totalClicks || 0),
              cost: aAcc.cost + (a.totalCost || 0),
              conversions: aAcc.conversions + (a.totalConversions || 0),
              bounceWeighted: aAcc.bounceWeighted + ((a.avgBounceRate || 0) * (a.totalClicks || 0)),
            }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, bounceWeighted: 0 });
            return {
              impressions: acc.impressions + adStats.impressions,
              clicks: acc.clicks + adStats.clicks,
              cost: acc.cost + adStats.cost,
              conversions: acc.conversions + adStats.conversions,
              bounceWeighted: acc.bounceWeighted + adStats.bounceWeighted,
            };
          }
          return {
            impressions: acc.impressions + (g.totalImpressions || 0),
            clicks: acc.clicks + (g.totalClicks || 0),
            cost: acc.cost + (g.totalCost || 0),
            conversions: acc.conversions + (g.totalConversions || 0),
            bounceWeighted: acc.bounceWeighted + ((g.avgBounceRate || 0) * (g.totalClicks || 0)),
          };
        }, { impressions: 0, clicks: 0, cost: 0, conversions: 0, bounceWeighted: 0 });

        const avgCtr = recalculatedStats.impressions > 0
          ? (recalculatedStats.clicks / recalculatedStats.impressions) * 100
          : 0;
        const avgCpc = recalculatedStats.clicks > 0
          ? recalculatedStats.cost / recalculatedStats.clicks
          : 0;
        const avgBounce = recalculatedStats.clicks > 0
          ? recalculatedStats.bounceWeighted / recalculatedStats.clicks
          : 0;

        return {
          ...c,
          adGroups: filteredGroups,
          // Пересчитанные значения для строки кампании
          totalImpressions: recalculatedStats.impressions,
          totalClicks: recalculatedStats.clicks,
          totalCost: recalculatedStats.cost,
          totalConversions: recalculatedStats.conversions,
          avgCtr: avgCtr,
          avgCpc: avgCpc,
          avgBounceRate: avgBounce,
        };
      });
    }

    return filtered;
  })();

  // Вычисляем отфильтрованную статистику на основе глобальных фильтров
  const getFilteredStats = () => {
    // Если нет фильтров - суммируем все кампании
    if (!globalFilterCampaignId) {
      return rawCampaigns.reduce(
        (acc: any, campaign: any) => ({
          impressions: acc.impressions + (campaign.totalImpressions || 0),
          clicks: acc.clicks + (campaign.totalClicks || 0),
          cost: acc.cost + (campaign.totalCost || 0),
          conversions: acc.conversions + (campaign.totalConversions || 0),
          revenue: acc.revenue + (campaign.totalRevenue || 0),
          bounceRate: acc.bounceRate + (campaign.avgBounceRate || 0),
        }),
        { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0, bounceRate: 0 }
      );
    }

    // Ищем выбранную кампанию
    const campaign = rawCampaigns.find((c: any) => c.campaignId === globalFilterCampaignId);
    if (!campaign) {
      return { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0, bounceRate: 0 };
    }

    // Если выбрана только кампания без группы
    if (!globalFilterAdGroupId) {
      return {
        impressions: campaign.totalImpressions || 0,
        clicks: campaign.totalClicks || 0,
        cost: campaign.totalCost || 0,
        conversions: campaign.totalConversions || 0,
        revenue: campaign.totalRevenue || 0,
        bounceRate: campaign.avgBounceRate || 0,
      };
    }

    // Ищем выбранную группу
    const adGroup = campaign.adGroups?.find((g: any) => g.adGroupId === globalFilterAdGroupId);
    if (!adGroup) {
      return { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0, bounceRate: 0 };
    }

    // Если выбрана группа без объявления
    if (!globalFilterAdId) {
      return {
        impressions: adGroup.totalImpressions || 0,
        clicks: adGroup.totalClicks || 0,
        cost: adGroup.totalCost || 0,
        conversions: adGroup.totalConversions || 0,
        revenue: adGroup.totalRevenue || 0,
        bounceRate: adGroup.avgBounceRate || 0,
      };
    }

    // Ищем выбранное объявление
    const ad = adGroup.ads?.find((a: any) => a.adId === globalFilterAdId);
    if (!ad) {
      return { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0, bounceRate: 0 };
    }

    return {
      impressions: ad.totalImpressions || 0,
      clicks: ad.totalClicks || 0,
      cost: ad.totalCost || 0,
      conversions: ad.totalConversions || 0,
      revenue: ad.totalRevenue || 0,
      bounceRate: ad.avgBounceRate || 0,
    };
  };

  // Получаем списки для селекторов фильтров
  const filterCampaignOptions = rawCampaigns.map((c: any) => ({
    id: c.campaignId,
    name: c.campaignName,
  }));

  const filterAdGroupOptions = globalFilterCampaignId
    ? (rawCampaigns.find((c: any) => c.campaignId === globalFilterCampaignId)?.adGroups || []).map((g: any) => ({
        id: g.adGroupId,
        name: g.adGroupName,
      }))
    : [];

  const filterAdOptions = globalFilterAdGroupId
    ? (rawCampaigns
        .find((c: any) => c.campaignId === globalFilterCampaignId)
        ?.adGroups?.find((g: any) => g.adGroupId === globalFilterAdGroupId)
        ?.ads || []
      ).map((a: any) => ({
        id: a.adId,
        title: a.adTitle || a.adTitle2 || `Объявление ${a.adId}`,
      }))
    : [];

  // Сброс зависимых фильтров при изменении родительского
  const handleCampaignFilterChange = (campaignId: string | null) => {
    setGlobalFilterCampaignId(campaignId);
    setGlobalFilterAdGroupId(null);
    setGlobalFilterAdId(null);
  };

  const handleAdGroupFilterChange = (adGroupId: string | null) => {
    setGlobalFilterAdGroupId(adGroupId);
    setGlobalFilterAdId(null);
  };

  // Синхронизация данных
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await dashboardService.syncManual(activeProjectId);
      await Promise.all([refetchStats(), refetchHierarchical(), refetchKpi()]);
    } finally {
      setIsSyncing(false);
    }
  };

  // Открыть модалку KPI с текущими значениями
  const openKpiModal = () => {
    if (kpiData?.kpi) {
      setKpiForm({
        targetCost: kpiData.kpi.targetCost || 0,
        targetCpl: kpiData.kpi.targetCpl || 0,
        targetLeads: kpiData.kpi.targetLeads || 0,
        goalIds: kpiData.kpi.goalIds || [],
      });
    } else {
      setKpiForm({
        targetCost: 0,
        targetCpl: 0,
        targetLeads: 0,
        goalIds: [],
      });
    }
    setShowKpiGoalsDropdown(false);
    setShowKpiModal(true);
  };

  // Сохранить KPI
  const handleSaveKpi = async () => {
    setIsSavingKpi(true);
    try {
      await dashboardService.saveKpi(activeConnectionId, kpiForm);
      await refetchKpi();
      setShowKpiModal(false);
    } catch (error) {
      console.error('Failed to save KPI:', error);
    } finally {
      setIsSavingKpi(false);
    }
  };

  // Переключение раскрытия кампании
  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  // Переключение раскрытия группы
  const toggleAdGroup = (adGroupId: string) => {
    setExpandedAdGroups(prev => {
      const next = new Set(prev);
      if (next.has(adGroupId)) {
        next.delete(adGroupId);
      } else {
        next.add(adGroupId);
      }
      return next;
    });
  };

  // Форматирование времени последней синхронизации
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

  // Если нет проектов
  if (projectsLoading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-primary-600" size={48} />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <AlertCircle className="text-yellow-600 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Нет проектов</h3>
          <p className="text-gray-600 mb-6">
            Создайте проект для подключения Яндекс.Директ и просмотра аналитики
          </p>
          <button
            onClick={() => navigate('/projects/new')}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Создать проект
          </button>
        </div>
      </div>
    );
  }

  // Если нет подключений
  if (!connectionsLoading && connections.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-primary-500 to-blue-600 rounded-xl shadow-lg p-8 text-white mb-8">
          <div className="flex items-start gap-6">
            <div className="bg-white/20 p-4 rounded-xl">
              <LinkIcon size={48} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-3">Подключите Яндекс.Директ</h2>
              <p className="text-primary-50 mb-6">
                Для просмотра аналитики необходимо подключить аккаунт Яндекс.Директ
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/connect-yandex-simple')}
                  className="bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors inline-flex items-center gap-2"
                >
                  <LinkIcon size={20} />
                  Простое подключение (рекомендуется)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Вычисляем общую статистику на основе глобальных фильтров
  const totalStats = getFilteredStats();

  const avgCtr = totalStats.clicks > 0 ? (totalStats.clicks / totalStats.impressions) * 100 : 0;
  const avgCpc = totalStats.clicks > 0 ? totalStats.cost / totalStats.clicks : 0;
  const cpl = totalStats.conversions > 0 ? totalStats.cost / totalStats.conversions : 0;
  const cr = totalStats.clicks > 0 ? (totalStats.conversions / totalStats.clicks) * 100 : 0;

  // Средний расход в день
  const avgCostPerDay = totalStats.cost / Math.max(1, dateRange);

  const isLoading = statsLoading || connectionsLoading || goalsLoading || hierarchicalLoading;

  return (
    <div className="w-full">
      {/* Улучшенная шапка (sticky при скролле) */}
      <div
        ref={headerRef}
        className={`sticky top-[41px] z-20 mb-6 -mx-8 px-8 -mt-8 pt-4 pb-2 bg-gray-50 transition-all duration-300 ${isHeaderCollapsed ? 'translate-y-[-100%] opacity-0 pointer-events-none' : ''}`}
      >
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-300 ${isScrolled ? 'p-3' : 'p-6'}`}>
          {/* Первая строка: Заголовок и кнопка обновления (скрывается при скролле) */}
          <div className={`flex items-start justify-between transition-all duration-300 overflow-hidden ${isScrolled ? 'max-h-0 mb-0 opacity-0' : 'max-h-24 mb-6 opacity-100'}`}>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {activeProject?.name || 'Аналитика Яндекс.Директ'}
              </h1>
              {activeConnection && (
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>Синхронизация: {formatLastSync(activeConnection.lastSyncAt)}</span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              {isSyncing ? 'Синхронизация...' : 'Обновить данные'}
            </button>
          </div>

          {/* Вторая строка: Селекторы (всегда видны) */}
          <div className="flex items-start gap-4 flex-wrap">
            {/* Селектор аккаунтов с меню управления */}
            {connections.length > 0 && (
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Building2 size={14} className="text-gray-500" />
                  Аккаунт
                </label>
                <div className="flex items-center gap-1">
                  {/* Селектор аккаунта */}
                  <select
                    value={activeConnectionId}
                    onChange={(e) => setSelectedConnectionId(e.target.value)}
                    className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm font-medium text-blue-900 focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[180px]"
                  >
                    {connections.map((conn: any) => (
                      <option key={conn.id} value={conn.id}>
                        {conn.login}
                      </option>
                    ))}
                  </select>
                  {/* Кнопка меню */}
                  <div className="relative">
                    <button
                      onClick={() => setShowAccountMenu(!showAccountMenu)}
                      className="p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors"
                      title="Управление аккаунтами"
                    >
                      <MoreVertical size={18} className="text-gray-600" />
                    </button>
                    {/* Выпадающее меню */}
                    {showAccountMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowAccountMenu(false)}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] py-1">
                          <button
                            onClick={() => {
                              setShowAccountMenu(false);
                              navigate('/connect-yandex-simple');
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                          >
                            <Plus size={16} className="text-green-600" />
                            Добавить аккаунт
                          </button>
                          <button
                            onClick={async () => {
                              setShowAccountMenu(false);
                              const conn = activeConnection;
                              if (conn) {
                                setEditingConnection(conn);
                                setEditForm({
                                  accessToken: '',
                                  selectedGoals: conn.conversionGoals ? JSON.parse(conn.conversionGoals).map(Number) : [],
                                });
                                setIsLoadingGoals(true);
                                try {
                                  const response = await fetch(`${API_BASE_URL}/api/yandex/connection/${conn.id}/goals`);
                                  const data = await response.json();
                                  setEditAvailableGoals(data.goals || []);
                                } catch (error) {
                                  setEditAvailableGoals([]);
                                }
                                setIsLoadingGoals(false);
                              }
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                          >
                            <Edit3 size={16} className="text-blue-600" />
                            Редактировать текущий
                          </button>
                          <button
                            onClick={() => {
                              setShowAccountMenu(false);
                              setShowConnectionsModal(true);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                          >
                            <Settings size={16} className="text-gray-500" />
                            Все подключения
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={async () => {
                              setShowAccountMenu(false);
                              if (activeConnection && confirm(`Удалить подключение ${activeConnection.login}?`)) {
                                try {
                                  await fetch(`${API_BASE_URL}/api/yandex/connection/${activeConnection.id}`, {
                                    method: 'DELETE',
                                  });
                                  window.location.reload();
                                } catch (error) {
                                  alert('Ошибка при удалении');
                                }
                              }
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                          >
                            <Trash2 size={16} />
                            Удалить текущий
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Селектор целей (мультиселект) */}
            {availableGoals.length > 0 && (
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Target size={14} className="text-gray-500" />
                  Цели
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowGoalsDropdown(!showGoalsDropdown)}
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[180px] text-left flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      {selectedGoalIds.length === 0
                        ? 'Все цели'
                        : selectedGoalIds.length === 1
                        ? availableGoals.find((g: any) => g.goalId === selectedGoalIds[0])?.goalName || `Цель ${selectedGoalIds[0]}`
                        : `${selectedGoalIds.length} целей`}
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${showGoalsDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showGoalsDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[220px] max-h-60 overflow-y-auto">
                      <div
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 border-b border-gray-200"
                        onClick={() => {
                          setSelectedGoalIds([]);
                          setShowGoalsDropdown(false);
                        }}
                      >
                        <input
                          type="radio"
                          checked={selectedGoalIds.length === 0}
                          readOnly
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">Все цели</span>
                      </div>
                      {availableGoals.map((goal: any) => (
                        <div
                          key={goal.goalId}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                          onClick={() => {
                            if (selectedGoalIds.includes(goal.goalId)) {
                              setSelectedGoalIds(selectedGoalIds.filter(id => id !== goal.goalId));
                            } else {
                              setSelectedGoalIds([...selectedGoalIds, goal.goalId]);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedGoalIds.includes(goal.goalId)}
                            readOnly
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm">{goal.goalName || `Цель ${goal.goalId}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Селектор периода */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-500" />
                Период
              </label>
              <select
                value={customDateMode ? 'custom' : dateRange}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'custom') {
                    setCustomDateMode(true);
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - 30);
                    setCustomEndDate(end.toISOString().split('T')[0]);
                    setCustomStartDate(start.toISOString().split('T')[0]);
                  } else {
                    setCustomDateMode(false);
                    setDateRange(parseInt(value));
                  }
                }}
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value={7}>7 дней</option>
                <option value={30}>30 дней</option>
                <option value={90}>90 дней</option>
                <option value="custom">Произвольный</option>
              </select>
            </div>

            {/* Кастомные даты */}
            {customDateMode && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Даты</label>
                <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="border-none focus:ring-0 bg-transparent text-sm p-0"
                  />
                  <ArrowRight size={16} className="text-gray-400" />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="border-none focus:ring-0 bg-transparent text-sm p-0"
                  />
                </div>
              </div>
            )}

            {/* Группировка */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-gray-500" />
                Группировать по
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="day">День</option>
                <option value="3days">3 дня</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="quarter">Квартал</option>
                <option value="year">Год</option>
              </select>
            </div>
          </div>

          {/* Глобальные фильтры по кампании/группе/объявлению */}
          {filterCampaignOptions.length > 0 && (
            <div className="flex items-start gap-4 flex-wrap mt-4 pt-4 border-t border-gray-200">
              {/* Фильтр по кампании */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Megaphone size={14} className="text-gray-500" />
                  Кампания
                </label>
                <select
                  value={globalFilterCampaignId || ''}
                  onChange={(e) => handleCampaignFilterChange(e.target.value || null)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[200px]"
                >
                  <option value="">Все кампании</option>
                  {filterCampaignOptions.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Фильтр по группе (только если выбрана кампания) */}
              {globalFilterCampaignId && filterAdGroupOptions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <Folder size={14} className="text-gray-500" />
                    Группа объявлений
                  </label>
                  <select
                    value={globalFilterAdGroupId || ''}
                    onChange={(e) => handleAdGroupFilterChange(e.target.value || null)}
                    className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm font-medium text-purple-900 focus:ring-2 focus:ring-purple-400 focus:border-transparent min-w-[200px]"
                  >
                    <option value="">Все группы</option>
                    {filterAdGroupOptions.map((g: any) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Фильтр по объявлению (только если выбрана группа) */}
              {globalFilterAdGroupId && filterAdOptions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <FileText size={14} className="text-gray-500" />
                    Объявление
                  </label>
                  <select
                    value={globalFilterAdId || ''}
                    onChange={(e) => setGlobalFilterAdId(e.target.value || null)}
                    className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm font-medium text-orange-900 focus:ring-2 focus:ring-orange-400 focus:border-transparent min-w-[200px]"
                  >
                    <option value="">Все объявления</option>
                    {filterAdOptions.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Кнопка сброса фильтров */}
              {(globalFilterCampaignId || globalFilterAdGroupId || globalFilterAdId) && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-transparent">Сбросить</label>
                  <button
                    onClick={() => {
                      setGlobalFilterCampaignId(null);
                      setGlobalFilterAdGroupId(null);
                      setGlobalFilterAdId(null);
                    }}
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                  >
                    <X size={14} />
                    Сбросить
                  </button>
                </div>
              )}

              {/* Кнопка сворачивания шапки */}
              <div className="flex flex-col gap-1.5 ml-auto">
                <label className="text-xs font-medium text-transparent">Скрыть</label>
                <button
                  onClick={() => setIsHeaderCollapsed(true)}
                  className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                  title="Свернуть фильтры"
                >
                  <ChevronUp size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Кнопка разворачивания шапки (показывается когда шапка свёрнута) */}
      {isHeaderCollapsed && (
        <div className="sticky top-[41px] z-20 mb-4 -mx-8 px-8 -mt-8 pt-2">
          <button
            onClick={() => setIsHeaderCollapsed(false)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm text-gray-600"
          >
            <ChevronDown size={16} />
            <span>Показать фильтры</span>
            {globalFilterCampaignId && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                Фильтр активен
              </span>
            )}
          </button>
        </div>
      )}

      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          <span className="text-sm text-blue-900 font-medium">Загрузка данных...</span>
        </div>
      )}

      {/* KPI Виджет (Аккордеон) */}
      {activeConnectionId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
          {/* Заголовок аккордеона */}
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setIsKpiCollapsed(!isKpiCollapsed)}
          >
            <div className="flex items-center gap-3">
              <ChevronDown
                size={20}
                className={`text-gray-400 transition-transform ${isKpiCollapsed ? '-rotate-90' : ''}`}
              />
              <Gauge size={20} className="text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                KPI {kpiData?.month ? new Date(kpiData.month + '-01').toLocaleString('ru-RU', { month: 'long', year: 'numeric' }) : ''}
              </h3>
              {kpiData?.stats && (
                <span className="text-sm text-gray-500">
                  (день {kpiData.stats.currentDay} из {kpiData.stats.daysInMonth})
                </span>
              )}
              {/* Отображаем выбранные цели для KPI */}
              {kpiData?.kpi?.goalIds && kpiData.kpi.goalIds.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
                  <Target size={12} />
                  {kpiData.kpi.goalIds.length <= 2 ? (
                    kpiData.kpi.goalIds.map((goalId: string) => (
                      <span key={goalId} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                        {availableGoals.find((g: any) => g.goalId === goalId)?.goalName || goalId}
                      </span>
                    ))
                  ) : (
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                      {kpiData.kpi.goalIds.length} целей
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); openKpiModal(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Settings size={14} />
              Настроить
            </button>
          </div>

          {/* Содержимое аккордеона */}
          {!isKpiCollapsed && (
            <div className="px-6 pb-6 pt-2">

          {kpiData?.kpi?.targetCost > 0 || kpiData?.kpi?.targetLeads > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Расход */}
              <div className="flex flex-col items-center">
                <CircularProgress
                  value={kpiData?.progress?.costProgress || 0}
                  dayValue={kpiData?.progress?.costDayProgress || 0}
                  size={120}
                  color="#ef4444"
                  dayColor="#fca5a5"
                  label={`${Math.round((kpiData?.stats?.currentCost || 0) / 1000)}K`}
                  sublabel="₽"
                />
                <div className="mt-3 text-center">
                  <div className="text-sm font-medium text-gray-700">Расход</div>
                  <div className="text-xs text-gray-500">
                    {((kpiData?.stats?.currentCost || 0)).toLocaleString('ru-RU')} / {((kpiData?.kpi?.targetCost || 0)).toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              </div>

              {/* CPL */}
              <div className="flex flex-col items-center">
                <div className="relative" style={{ width: 120, height: 120 }}>
                  <div className={`w-full h-full rounded-full flex flex-col items-center justify-center border-8 ${
                    kpiData?.progress?.cplStatus === 'good' ? 'border-green-500 bg-green-50' :
                    kpiData?.progress?.cplStatus === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                    'border-red-500 bg-red-50'
                  }`}>
                    <span className="text-2xl font-bold text-gray-900">
                      {Math.round(kpiData?.stats?.currentCpl || 0).toLocaleString('ru-RU')}
                    </span>
                    <span className="text-xs text-gray-500">₽</span>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <div className="text-sm font-medium text-gray-700">CPL</div>
                  <div className="text-xs text-gray-500">
                    Цель: {((kpiData?.kpi?.targetCpl || 0)).toLocaleString('ru-RU')} ₽
                  </div>
                  <div className={`text-xs font-medium ${
                    kpiData?.progress?.cplStatus === 'good' ? 'text-green-600' :
                    kpiData?.progress?.cplStatus === 'warning' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {kpiData?.progress?.cplStatus === 'good' ? 'В норме' :
                     kpiData?.progress?.cplStatus === 'warning' ? 'Внимание' : 'Превышен'}
                  </div>
                </div>
              </div>

              {/* Лиды */}
              <div className="flex flex-col items-center">
                <CircularProgress
                  value={kpiData?.progress?.leadsProgress || 0}
                  dayValue={kpiData?.progress?.leadsDayProgress || 0}
                  size={120}
                  color="#22c55e"
                  dayColor="#86efac"
                  label={`${kpiData?.stats?.currentLeads || 0}`}
                  sublabel="лидов"
                />
                <div className="mt-3 text-center">
                  <div className="text-sm font-medium text-gray-700">Лиды</div>
                  <div className="text-xs text-gray-500">
                    {kpiData?.stats?.currentLeads || 0} / {kpiData?.kpi?.targetLeads || 0}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Gauge size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">KPI не настроены</p>
              <p className="text-xs mt-1">Нажмите "Настроить" чтобы задать цели на месяц</p>
            </div>
          )}
            </div>
          )}
        </div>
      )}

      {/* Модальное окно настройки KPI */}
      {showKpiModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowKpiModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Настройка KPI на месяц</h3>
                <button
                  onClick={() => setShowKpiModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Целевой расход (₽/месяц)
                  </label>
                  <input
                    type="number"
                    value={kpiForm.targetCost}
                    onChange={(e) => setKpiForm({ ...kpiForm, targetCost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder="900000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Целевой CPL (₽)
                  </label>
                  <input
                    type="number"
                    value={kpiForm.targetCpl}
                    onChange={(e) => setKpiForm({ ...kpiForm, targetCpl: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder="4000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Целевое количество лидов
                  </label>
                  <input
                    type="number"
                    value={kpiForm.targetLeads}
                    onChange={(e) => setKpiForm({ ...kpiForm, targetLeads: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder="225"
                  />
                </div>

                {/* Селектор целей для KPI */}
                {availableGoals.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Цели для расчёта CPL
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Выберите цели, по которым будут считаться лиды и CPL для KPI
                    </p>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowKpiGoalsDropdown(!showKpiGoalsDropdown)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent text-left flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          {kpiForm.goalIds.length === 0
                            ? 'Все цели'
                            : kpiForm.goalIds.length === 1
                            ? availableGoals.find((g: any) => g.goalId === kpiForm.goalIds[0])?.goalName || `Цель ${kpiForm.goalIds[0]}`
                            : `${kpiForm.goalIds.length} целей`}
                        </span>
                        <svg className={`w-4 h-4 transition-transform ${showKpiGoalsDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showKpiGoalsDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                          <div
                            className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 border-b border-gray-200"
                            onClick={() => {
                              setKpiForm({ ...kpiForm, goalIds: [] });
                              setShowKpiGoalsDropdown(false);
                            }}
                          >
                            <input
                              type="radio"
                              checked={kpiForm.goalIds.length === 0}
                              readOnly
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm">Все цели</span>
                          </div>
                          {availableGoals.map((goal: any) => (
                            <div
                              key={goal.goalId}
                              className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                if (kpiForm.goalIds.includes(goal.goalId)) {
                                  setKpiForm({ ...kpiForm, goalIds: kpiForm.goalIds.filter(id => id !== goal.goalId) });
                                } else {
                                  setKpiForm({ ...kpiForm, goalIds: [...kpiForm.goalIds, goal.goalId] });
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={kpiForm.goalIds.includes(goal.goalId)}
                                readOnly
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                              <span className="text-sm">{goal.goalName || `Цель ${goal.goalId}`}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowKpiModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveKpi}
                  disabled={isSavingKpi}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingKpi && <Loader2 size={16} className="animate-spin" />}
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Ключевые метрики */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
        {/* Бюджет */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Wallet size={24} />
            </div>
            <div className="text-right">
              <p className="text-sm text-green-100">Бюджет</p>
              <p className="text-3xl font-bold">{budgetForecastData?.balance?.amount ? budgetForecastData.balance.amount.toLocaleString('ru-RU') : '—'} ₽</p>
            </div>
          </div>
          <div className="text-green-100 text-sm">
            {budgetForecastData?.forecast?.daysRemaining !== null && budgetForecastData?.forecast?.daysRemaining !== undefined
              ? `Хватит на ${budgetForecastData.forecast.daysRemaining} дней`
              : 'Загрузка...'}
          </div>
        </div>

        {/* Расход */}
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="bg-white/20 p-2 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div className="text-right">
              <p className="text-sm text-red-100">Расход</p>
              <p className="text-3xl font-bold">{totalStats.cost.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
        </div>

        {/* CR */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingUp size={24} />
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-100">CR</p>
              <p className="text-3xl font-bold">{cr.toFixed(2)}%</p>
            </div>
          </div>
        </div>

        {/* CPL */}
        <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingDown size={24} />
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-100">CPL</p>
              <p className="text-3xl font-bold">{cpl > 0 ? Math.round(cpl).toLocaleString('ru-RU') : '—'} ₽</p>
            </div>
          </div>
        </div>

        {/* Конверсии */}
        <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="bg-white/20 p-2 rounded-lg">
              <Target size={24} />
            </div>
            <div className="text-right">
              <p className="text-sm text-purple-100">Конверсии</p>
              <p className="text-3xl font-bold">{totalStats.conversions.toLocaleString('ru-RU')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Иерархическая таблица: Кампании → Группы → Объявления */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Кампании</h2>
          <p className="text-sm text-gray-500 mt-1">Нажмите на строку для раскрытия групп и объявлений</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Название
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('totalImpressions')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Показы
                    {sortColumn === 'totalImpressions' ? (
                      sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('totalClicks')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Клики
                    {sortColumn === 'totalClicks' ? (
                      sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('totalCost')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Расход
                    {sortColumn === 'totalCost' ? (
                      sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('avgCpc')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CPC
                    {sortColumn === 'avgCpc' ? (
                      sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('avgCtr')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CTR
                    {sortColumn === 'avgCtr' ? (
                      sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('avgBounceRate')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Отказы
                    {sortColumn === 'avgBounceRate' ? (
                      sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('totalConversions')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Конверсии
                    {sortColumn === 'totalConversions' ? (
                      sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('cr')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CR %
                    {sortColumn === 'cr' ? (
                      sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('cpl')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CPL
                    {sortColumn === 'cpl' ? (
                      sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {campaigns.map((campaign: any) => {
                const campaignId = campaign.campaignId;
                const isExpanded = expandedCampaigns.has(campaignId);
                const adGroups = campaign.adGroups || [];
                const ctr = campaign.avgCtr || 0;
                const campaignCr = campaign.totalClicks > 0 ? (campaign.totalConversions / campaign.totalClicks) * 100 : 0;
                const campaignCpl = campaign.totalConversions > 0 ? campaign.totalCost / campaign.totalConversions : 0;

                return (
                  <>
                    {/* Строка кампании */}
                    <tr
                      key={`campaign-${campaignId}`}
                      className="hover:bg-blue-50 transition-colors cursor-pointer border-b border-gray-200"
                      onClick={() => toggleCampaign(campaignId)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {adGroups.length > 0 ? (
                            isExpanded ? (
                              <ChevronDown size={18} className="text-gray-500" />
                            ) : (
                              <ChevronRight size={18} className="text-gray-500" />
                            )
                          ) : (
                            <span className="w-[18px]" />
                          )}
                          <span className="text-sm font-semibold text-gray-900">
                            {campaign.campaignName || campaignId}
                          </span>
                          {adGroups.length > 0 && (
                            <span className="text-xs text-gray-400">({adGroups.length} групп)</span>
                          )}
                          {/* Кнопка глобального фильтра */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (globalFilterCampaignId === campaignId && !globalFilterAdGroupId) {
                                // Сбросить глобальный фильтр
                                handleCampaignFilterChange(null);
                              } else {
                                // Установить глобальный фильтр по кампании
                                handleCampaignFilterChange(campaignId);
                              }
                            }}
                            className={`p-1 rounded transition-colors ${
                              globalFilterCampaignId === campaignId && !globalFilterAdGroupId
                                ? 'bg-blue-100 text-blue-600'
                                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title={globalFilterCampaignId === campaignId ? 'Убрать фильтр' : 'Фильтровать по этой кампании'}
                          >
                            <Filter size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {(campaign.totalImpressions || 0).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {(campaign.totalClicks || 0).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        {(campaign.totalCost || 0).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {(campaign.avgCpc || 0).toFixed(2)} ₽
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${
                          ctr >= 5 ? 'text-green-600' : ctr >= 3 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {ctr.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {typeof campaign.avgBounceRate === 'number' ? `${campaign.avgBounceRate.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${
                          (campaign.totalConversions || 0) > 0 ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {(campaign.totalConversions || 0).toLocaleString('ru-RU')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${
                          campaignCr >= 10 ? 'text-green-600' : campaignCr >= 5 ? 'text-yellow-600' : 'text-gray-600'
                        }`}>
                          {campaignCr > 0 ? `${campaignCr.toFixed(2)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {campaignCpl > 0 ? (
                          <span className="text-sm font-medium text-gray-900">
                            {Math.round(campaignCpl).toLocaleString('ru-RU')} ₽
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Строки групп объявлений */}
                    {isExpanded && adGroups.map((adGroup: any) => {
                      const adGroupKey = `${campaignId}-${adGroup.adGroupId}`;
                      const isAdGroupExpanded = expandedAdGroups.has(adGroupKey);
                      const ads = adGroup.ads || [];
                      const adGroupCtr = adGroup.avgCtr || 0;
                      const adGroupCr = adGroup.totalClicks > 0 ? (adGroup.totalConversions / adGroup.totalClicks) * 100 : 0;
                      const adGroupCpl = adGroup.totalConversions > 0 ? adGroup.totalCost / adGroup.totalConversions : 0;

                      return (
                        <>
                          {/* Строка группы */}
                          <tr
                            key={`adgroup-${adGroupKey}`}
                            className="hover:bg-green-50 transition-colors cursor-pointer bg-gray-50 border-b border-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAdGroup(adGroupKey);
                            }}
                          >
                            <td className="px-6 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2 pl-6">
                                {ads.length > 0 ? (
                                  isAdGroupExpanded ? (
                                    <ChevronDown size={16} className="text-gray-400" />
                                  ) : (
                                    <ChevronRight size={16} className="text-gray-400" />
                                  )
                                ) : (
                                  <span className="w-[16px]" />
                                )}
                                <span className="text-sm font-medium text-gray-700">
                                  {adGroup.adGroupName || adGroup.adGroupId}
                                </span>
                                {ads.length > 0 && (
                                  <span className="text-xs text-gray-400">({ads.length} объявл.)</span>
                                )}
                                {/* Кнопка глобального фильтра по группе */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (globalFilterAdGroupId === adGroup.adGroupId) {
                                      // Сбросить до уровня кампании
                                      handleAdGroupFilterChange(null);
                                    } else {
                                      // Установить глобальный фильтр по группе (и по кампании)
                                      setGlobalFilterCampaignId(campaignId);
                                      handleAdGroupFilterChange(adGroup.adGroupId);
                                    }
                                  }}
                                  className={`p-1 rounded transition-colors ${
                                    globalFilterAdGroupId === adGroup.adGroupId
                                      ? 'bg-purple-100 text-purple-600'
                                      : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                                  }`}
                                  title={globalFilterAdGroupId === adGroup.adGroupId ? 'Убрать фильтр' : 'Фильтровать по этой группе'}
                                >
                                  <Filter size={12} />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {(adGroup.totalImpressions || 0).toLocaleString('ru-RU')}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {(adGroup.totalClicks || 0).toLocaleString('ru-RU')}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-700">
                              {(adGroup.totalCost || 0).toLocaleString('ru-RU')} ₽
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {(adGroup.avgCpc || 0).toFixed(2)} ₽
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right">
                              <span className={`text-sm ${
                                adGroupCtr >= 5 ? 'text-green-600' : adGroupCtr >= 3 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {adGroupCtr.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {typeof adGroup.avgBounceRate === 'number' ? `${adGroup.avgBounceRate.toFixed(2)}%` : '—'}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {(adGroup.totalConversions || 0).toLocaleString('ru-RU')}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {adGroupCr > 0 ? `${adGroupCr.toFixed(2)}%` : '—'}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {adGroupCpl > 0 ? `${Math.round(adGroupCpl).toLocaleString('ru-RU')} ₽` : '—'}
                            </td>
                          </tr>

                          {/* Строки объявлений */}
                          {isAdGroupExpanded && ads.map((ad: any) => {
                            const adCtr = ad.avgCtr || 0;
                            const adCr = ad.totalClicks > 0 ? (ad.totalConversions / ad.totalClicks) * 100 : 0;
                            const adCpl = ad.totalConversions > 0 ? ad.totalCost / ad.totalConversions : 0;

                            return (
                              <tr
                                key={`ad-${campaignId}-${adGroup.adGroupId}-${ad.adId}`}
                                className="bg-gray-100 border-b border-gray-100"
                              >
                                <td className="px-6 py-2 whitespace-nowrap">
                                  <div className="flex items-center gap-2 pl-14">
                                    <div className="flex flex-col">
                                      <span className="text-xs text-gray-700 font-medium">
                                        {ad.adTitle || `Объявление ${ad.adId}`}
                                      </span>
                                      <span className="text-[10px] text-gray-400">
                                        ID: {ad.adId}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                  {(ad.totalImpressions || 0).toLocaleString('ru-RU')}
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                  {(ad.totalClicks || 0).toLocaleString('ru-RU')}
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                  {(ad.totalCost || 0).toLocaleString('ru-RU')} ₽
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                  {(ad.avgCpc || 0).toFixed(2)} ₽
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-right">
                                  <span className={`text-xs ${
                                    adCtr >= 5 ? 'text-green-600' : adCtr >= 3 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {adCtr.toFixed(2)}%
                                  </span>
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                  {typeof ad.avgBounceRate === 'number' ? `${ad.avgBounceRate.toFixed(2)}%` : '—'}
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                  {(ad.totalConversions || 0).toLocaleString('ru-RU')}
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                  {adCr > 0 ? `${adCr.toFixed(2)}%` : '—'}
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                  {adCpl > 0 ? `${Math.round(adCpl).toLocaleString('ru-RU')} ₽` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      );
                    })}
                  </>
                );
              })}

              {/* Строка ИТОГО */}
              {campaigns.length > 0 && (() => {
                // Если выбран фильтр по группе или объявлению - считаем по группам/объявлениям
                let totals;
                if (globalFilterAdGroupId) {
                  // Считаем по группам (которые уже отфильтрованы)
                  totals = campaigns.reduce((acc: any, c: any) => {
                    const groupTotals = (c.adGroups || []).reduce((gAcc: any, g: any) => {
                      if (globalFilterAdId) {
                        // Считаем по объявлениям
                        const adTotals = (g.ads || []).reduce((aAcc: any, a: any) => ({
                          impressions: aAcc.impressions + (a.totalImpressions || 0),
                          clicks: aAcc.clicks + (a.totalClicks || 0),
                          cost: aAcc.cost + (a.totalCost || 0),
                          conversions: aAcc.conversions + (a.totalConversions || 0),
                          bounceWeighted: aAcc.bounceWeighted + ((a.avgBounceRate || 0) * (a.totalClicks || 0)),
                        }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, bounceWeighted: 0 });
                        return {
                          impressions: gAcc.impressions + adTotals.impressions,
                          clicks: gAcc.clicks + adTotals.clicks,
                          cost: gAcc.cost + adTotals.cost,
                          conversions: gAcc.conversions + adTotals.conversions,
                          bounceWeighted: gAcc.bounceWeighted + adTotals.bounceWeighted,
                        };
                      }
                      return {
                        impressions: gAcc.impressions + (g.totalImpressions || 0),
                        clicks: gAcc.clicks + (g.totalClicks || 0),
                        cost: gAcc.cost + (g.totalCost || 0),
                        conversions: gAcc.conversions + (g.totalConversions || 0),
                        bounceWeighted: gAcc.bounceWeighted + ((g.avgBounceRate || 0) * (g.totalClicks || 0)),
                      };
                    }, { impressions: 0, clicks: 0, cost: 0, conversions: 0, bounceWeighted: 0 });
                    return {
                      impressions: acc.impressions + groupTotals.impressions,
                      clicks: acc.clicks + groupTotals.clicks,
                      cost: acc.cost + groupTotals.cost,
                      conversions: acc.conversions + groupTotals.conversions,
                      bounceWeighted: acc.bounceWeighted + groupTotals.bounceWeighted,
                    };
                  }, { impressions: 0, clicks: 0, cost: 0, conversions: 0, bounceWeighted: 0 });
                } else {
                  // Считаем по кампаниям
                  totals = campaigns.reduce((acc: any, c: any) => ({
                    impressions: acc.impressions + (c.totalImpressions || 0),
                    clicks: acc.clicks + (c.totalClicks || 0),
                    cost: acc.cost + (c.totalCost || 0),
                    conversions: acc.conversions + (c.totalConversions || 0),
                    bounceWeighted: acc.bounceWeighted + ((c.avgBounceRate || 0) * (c.totalClicks || 0)),
                  }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, bounceWeighted: 0 });
                }

                const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
                const avgCpc = totals.clicks > 0 ? totals.cost / totals.clicks : 0;
                const avgBounce = totals.clicks > 0 ? totals.bounceWeighted / totals.clicks : 0;
                const avgCr = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
                const avgCpl = totals.conversions > 0 ? totals.cost / totals.conversions : 0;

                return (
                  <tr className="bg-gray-200 font-semibold border-t-2 border-gray-400">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="w-[18px]" />
                        ИТОГО
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {totals.impressions.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {totals.clicks.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {totals.cost.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {avgCpc.toFixed(2)} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {avgCtr.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {avgBounce.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {totals.conversions.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {avgCr > 0 ? `${avgCr.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {avgCpl > 0 ? `${Math.round(avgCpl).toLocaleString('ru-RU')} ₽` : '—'}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>

        {campaigns.length === 0 && !isLoading && (
          <div className="p-12 text-center">
            <Eye className="text-gray-300 mx-auto mb-4" size={48} />
            <p className="text-gray-500">Нет данных за выбранный период</p>
            <p className="text-sm text-gray-400 mt-2">
              Попробуйте запустить синхронизацию или выбрать другой период
            </p>
          </div>
        )}
      </div>

      {/* Секция графиков и статистики по дням */}
      {dailyStats.length > 0 && (
        <div className="mb-8">
          {/* Заголовок - кликабельный аккордеон */}
          <button
            onClick={() => setIsDynamicsOpen(!isDynamicsOpen)}
            className="w-full flex items-center justify-between py-3 hover:bg-gray-50 rounded-lg transition-colors mb-4"
          >
            <div className="flex items-center gap-3">
              <Calendar size={22} className="text-primary-600" />
              <h2 className="text-xl font-bold text-gray-900">Динамика</h2>
            </div>
            {isDynamicsOpen ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </button>

          {isDynamicsOpen && (
          <div className="space-y-6">
          {/* Один график с чекбоксами для выбора метрик */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            {/* Чекбоксы метрик */}
            <div className="flex flex-wrap gap-4 mb-4">
              {[
                { id: 'impressions', label: 'Показы', color: '#8b5cf6' },
                { id: 'clicks', label: 'Клики', color: '#10b981' },
                { id: 'cost', label: 'Расход', color: '#3b82f6' },
                { id: 'conversions', label: 'Конверсии', color: '#ef4444' },
                { id: 'cpl', label: 'CPL', color: '#f59e0b' },
                { id: 'ctr', label: 'CTR %', color: '#06b6d4' },
                { id: 'bounceRate', label: 'Отказы %', color: '#f97316' },
              ].map((metric) => (
                <label
                  key={metric.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                    selectedChartMetrics.has(metric.id)
                      ? 'border-gray-400 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedChartMetrics.has(metric.id)}
                    onChange={() => {
                      setSelectedChartMetrics(prev => {
                        const next = new Set(prev);
                        if (next.has(metric.id)) {
                          next.delete(metric.id);
                        } else {
                          next.add(metric.id);
                        }
                        return next;
                      });
                    }}
                    className="sr-only"
                  />
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedChartMetrics.has(metric.id) ? metric.color : '#d1d5db' }}
                  />
                  <span className={`text-sm ${selectedChartMetrics.has(metric.id) ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {metric.label}
                  </span>
                </label>
              ))}
            </div>

            {/* График */}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => {
                    const d = new Date(value);
                    return `${d.getDate()}.${d.getMonth() + 1}`;
                  }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === 'Расход' || name === 'CPL') return [`${Math.round(value).toLocaleString('ru-RU')} ₽`, name];
                    if (name === 'CTR %' || name === 'Отказы %') return [`${Number(value).toFixed(2)}%`, name];
                    return [Math.round(value).toLocaleString('ru-RU'), name];
                  }}
                  labelFormatter={(label) => {
                    const d = new Date(label);
                    return d.toLocaleDateString('ru-RU');
                  }}
                />
                <Legend />
                {selectedChartMetrics.has('impressions') && (
                  <Line yAxisId="left" type="monotone" dataKey="impressions" name="Показы" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                )}
                {selectedChartMetrics.has('clicks') && (
                  <Line yAxisId="left" type="monotone" dataKey="clicks" name="Клики" stroke="#10b981" strokeWidth={2} dot={false} />
                )}
                {selectedChartMetrics.has('cost') && (
                  <Line yAxisId="left" type="monotone" dataKey="cost" name="Расход" stroke="#3b82f6" strokeWidth={2} dot={false} />
                )}
                {selectedChartMetrics.has('conversions') && (
                  <Line yAxisId="right" type="monotone" dataKey="conversions" name="Конверсии" stroke="#ef4444" strokeWidth={2} dot={false} />
                )}
                {selectedChartMetrics.has('cpl') && (
                  <Line yAxisId="right" type="monotone" dataKey="cpl" name="CPL" stroke="#f59e0b" strokeWidth={2} dot={false} />
                )}
                {selectedChartMetrics.has('ctr') && (
                  <Line yAxisId="right" type="monotone" dataKey="ctr" name="CTR %" stroke="#06b6d4" strokeWidth={2} dot={false} />
                )}
                {selectedChartMetrics.has('bounceRate') && (
                  <Line yAxisId="right" type="monotone" dataKey="bounceRate" name="Отказы %" stroke="#f97316" strokeWidth={2} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Таблица статистики по дням */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700">Статистика по дням</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Показы</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Клики</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Расход</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Цена клика</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Отказы</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Конверсии</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CR %</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">CPL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    // Вычисляем max значения для цветных баров
                    const maxCost = Math.max(...dailyStats.map((d: any) => d.cost || 0));
                    const maxCpl = Math.max(...dailyStats.map((d: any) => d.cpl || 0));

                    return dailyStats.map((day: any, idx: number) => {
                      const costPercent = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
                      const cplPercent = maxCpl > 0 ? (day.cpl / maxCpl) * 100 : 0;

                      // Цвет бара расхода: от зелёного (низкий) до красного (высокий)
                      const getCostColor = (percent: number) => {
                        if (percent < 33) return 'bg-green-400';
                        if (percent < 66) return 'bg-yellow-400';
                        return 'bg-red-400';
                      };

                      // Цвет бара CPL: от зелёного (низкий) до красного (высокий)
                      const getCplColor = (percent: number) => {
                        if (percent < 33) return 'bg-green-400';
                        if (percent < 66) return 'bg-yellow-400';
                        return 'bg-red-400';
                      };

                      // Форматирование даты в зависимости от группировки
                      const formatPeriodDate = (dateStr: string) => {
                        const d = new Date(dateStr);
                        if (groupBy === 'month') {
                          return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
                        } else if (groupBy === 'week') {
                          const endOfWeek = new Date(d);
                          endOfWeek.setDate(d.getDate() + 6);
                          return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} - ${endOfWeek.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`;
                        } else if (groupBy === '3days') {
                          return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} (3д)`;
                        }
                        return d.toLocaleDateString('ru-RU');
                      };

                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900 font-medium">
                            {formatPeriodDate(day.date)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {(day.impressions || 0).toLocaleString('ru-RU')}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {(day.clicks || 0).toLocaleString('ru-RU')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden">
                                <div
                                  className={`h-full ${getCostColor(costPercent)} transition-all`}
                                  style={{ width: `${costPercent}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-700 w-16 text-right">
                                {Math.round(day.cost || 0).toLocaleString('ru-RU')}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {(day.cpc || 0).toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {(day.ctr || 0).toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              (day.bounceRate || 0) > 50 ? 'bg-red-100 text-red-700' :
                              (day.bounceRate || 0) > 30 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {(day.bounceRate || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 font-medium">
                            {(day.conversions || 0).toLocaleString('ru-RU')}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {(day.cr || 0).toFixed(2)}%
                          </td>
                          <td className="px-4 py-3">
                            {day.cpl > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden">
                                  <div
                                    className={`h-full ${getCplColor(cplPercent)} transition-all`}
                                    style={{ width: `${cplPercent}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-700 w-16 text-right">
                                  {Math.round(day.cpl).toLocaleString('ru-RU')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          </div>
          )}
        </div>
      )}

      {/* Секция отчётов - два аккордеона с табами */}
      {campaigns.length > 0 && (
        <div className="mb-8 space-y-4">
          {/* Заголовок с индикатором глобального фильтра */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 size={22} className="text-primary-600" />
              <h2 className="text-xl font-bold text-gray-900">Отчёты</h2>
            </div>
            {(globalFilterCampaignId || globalFilterAdGroupId) && (
              <div className="flex items-center gap-2">
                {globalFilterCampaignId && !globalFilterAdGroupId && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                    <Filter size={14} className="text-blue-600" />
                    <span className="text-sm text-blue-800 max-w-[200px] truncate">
                      {rawCampaigns.find((c: any) => c.campaignId === globalFilterCampaignId)?.campaignName || 'Кампания'}
                    </span>
                    <button
                      onClick={() => handleCampaignFilterChange(null)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {globalFilterAdGroupId && (
                  <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
                    <Filter size={14} className="text-purple-600" />
                    <span className="text-sm text-purple-800 max-w-[300px] truncate">
                      {(() => {
                        const campaign = rawCampaigns.find((c: any) => c.campaignId === globalFilterCampaignId);
                        const adGroup = campaign?.adGroups?.find((ag: any) => ag.adGroupId === globalFilterAdGroupId);
                        return adGroup?.adGroupName || 'Группа';
                      })()}
                    </span>
                    <button
                      onClick={() => {
                        handleAdGroupFilterChange(null);
                        handleCampaignFilterChange(null);
                      }}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Два аккордеона с табами */}
          {(() => {
            // Используем глобальные фильтры для отчётов
            let filteredCampaigns = campaigns;
            if (globalFilterAdGroupId && globalFilterCampaignId) {
              // Фильтр по конкретной группе
              filteredCampaigns = rawCampaigns
                .filter((c: any) => c.campaignId === globalFilterCampaignId)
                .map((c: any) => ({
                  ...c,
                  adGroups: (c.adGroups || []).filter((ag: any) => ag.adGroupId === globalFilterAdGroupId),
                }));
            } else if (globalFilterCampaignId) {
              // Фильтр только по кампании
              filteredCampaigns = rawCampaigns.filter((c: any) => c.campaignId === globalFilterCampaignId);
            }

            const filteredStats = filteredCampaigns.reduce(
              (acc: any, c: any) => {
                // Если есть фильтр по группе, считаем статистику только по отфильтрованным группам
                const groups = c.adGroups || [];
                const groupStats = groups.reduce((gAcc: any, ag: any) => ({
                  impressions: gAcc.impressions + (ag.totalImpressions || 0),
                  clicks: gAcc.clicks + (ag.totalClicks || 0),
                  cost: gAcc.cost + (ag.totalCost || 0),
                  conversions: gAcc.conversions + (ag.totalConversions || 0),
                }), { impressions: 0, clicks: 0, cost: 0, conversions: 0 });

                return {
                  impressions: acc.impressions + groupStats.impressions,
                  clicks: acc.clicks + groupStats.clicks,
                  cost: acc.cost + groupStats.cost,
                  conversions: acc.conversions + groupStats.conversions,
                };
              },
              { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
            );

            // Данные для заголовков
            const titlesMap = new Map<string, { impressions: number; clicks: number; cost: number; conversions: number }>();
            filteredCampaigns.forEach((campaign: any) => {
              campaign.adGroups?.forEach((adGroup: any) => {
                adGroup.ads?.forEach((ad: any) => {
                  const title = ad.adTitle || `Объявление ${ad.adId}`;
                  const existing = titlesMap.get(title) || { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
                  titlesMap.set(title, {
                    impressions: existing.impressions + (ad.totalImpressions || 0),
                    clicks: existing.clicks + (ad.totalClicks || 0),
                    cost: existing.cost + (ad.totalCost || 0),
                    conversions: existing.conversions + (ad.totalConversions || 0),
                  });
                });
              });
            });

            // Табы для секции "Показатели аудитории"
            const audienceTabs = [
              { id: 'search', label: 'Поисковые запросы', icon: Search, isMock: false },
              { id: 'demographics', label: 'Пол / Возраст', icon: Users, isMock: false },
              { id: 'devices', label: 'Устройства', icon: Smartphone, isMock: false },
              { id: 'income', label: 'Платежеспособность', icon: DollarSign, isMock: false },
              { id: 'region', label: 'Регион', icon: MapPin, isMock: false },
            ];

            // Табы для секции "Технические показатели"
            const technicalTabs = [
              { id: 'categories', label: 'Категории таргетинга', icon: Tag, isMock: false },
              { id: 'titles', label: 'Заголовок', icon: FileText, isMock: false },
              { id: 'text', label: 'Текст', icon: Type, isMock: false },
              { id: 'criteria', label: 'Условия показа', icon: Target, isMock: false },
              { id: 'placements', label: 'Площадки', icon: Layout, isMock: false },
            ];

            // Данные для разных отчётов
            const getReportData = (reportId: string) => {
              switch (reportId) {
                case 'titles':
                  return {
                    columnName: 'Заголовок',
                    data: Array.from(titlesMap.entries())
                      .map(([name, d]) => ({ name, ...d }))
                      .sort((a, b) => b.cost - a.cost)
                      .slice(0, 10),
                  };
                case 'criteria':
                  // Используем реальные данные по условиям показа (ключевым словам)
                  if (Array.isArray(criteriaData) && criteriaData.length > 0) {
                    return {
                      columnName: 'Условие показа',
                      data: criteriaData.map((item: any) => ({
                        name: item.criterion || 'Неизвестно',
                        impressions: item.impressions || 0,
                        clicks: item.clicks || 0,
                        cost: item.cost || 0,
                        conversions: 0,
                      })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 15),
                    };
                  }
                  return {
                    columnName: 'Условие показа',
                    data: [],
                  };
                case 'devices':
                  // Используем реальные данные по устройствам
                  if (Array.isArray(deviceStatsData) && deviceStatsData.length > 0) {
                    return {
                      columnName: 'Устройство',
                      data: deviceStatsData.map((device: any) => ({
                        name: device.deviceName,
                        icon: device.device === 'DESKTOP' ? Monitor : device.device === 'MOBILE' ? Smartphone : Tablet,
                        clicks: device.clicks,
                        cost: device.cost,
                        conversions: device.conversions || 0,
                      })).sort((a: any, b: any) => b.cost - a.cost),
                    };
                  }
                  // Fallback если нет данных
                  return {
                    columnName: 'Устройство',
                    data: [],
                  };
                case 'demographics':
                  // Используем реальные данные по демографии
                  if (Array.isArray(demographicsData) && demographicsData.length > 0) {
                    return {
                      columnName: 'Сегмент',
                      data: demographicsData.map((item: any) => ({
                        name: item.segment,
                        impressions: item.impressions || 0,
                        clicks: item.clicks || 0,
                        cost: item.cost || 0,
                        conversions: item.conversions || 0,
                      })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10),
                    };
                  }
                  return {
                    columnName: 'Сегмент',
                    data: [],
                  };
                case 'search':
                  // Используем реальные данные по поисковым запросам
                  if (Array.isArray(searchQueriesData) && searchQueriesData.length > 0) {
                    return {
                      columnName: 'Поисковый запрос',
                      data: searchQueriesData.map((item: any) => ({
                        name: item.query,
                        impressions: item.impressions || 0,
                        clicks: item.clicks || 0,
                        cost: item.cost || 0,
                        conversions: item.conversions || 0,
                      })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10),
                    };
                  }
                  return {
                    columnName: 'Поисковый запрос',
                    data: [],
                  };
                case 'region':
                  // Используем реальные данные по регионам (из geoReportData или geoStatsData)
                  const geoData = Array.isArray(geoReportData) && geoReportData.length > 0
                    ? geoReportData
                    : (Array.isArray(geoStatsData) && geoStatsData.length > 0 ? geoStatsData : []);
                  if (geoData.length > 0) {
                    return {
                      columnName: 'Регион',
                      data: geoData.map((item: any) => ({
                        name: item.region,
                        impressions: item.impressions || 0,
                        clicks: item.clicks || 0,
                        cost: item.cost || 0,
                        conversions: item.conversions || 0,
                      })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10),
                    };
                  }
                  return {
                    columnName: 'Регион',
                    data: [],
                  };
                case 'text':
                  // Используем реальные данные по текстам объявлений
                  if (Array.isArray(adTextsData) && adTextsData.length > 0) {
                    return {
                      columnName: 'Текст объявления',
                      data: adTextsData.map((item: any) => ({
                        name: item.text || item.fullText || `Объявление ${item.adId}`,
                        impressions: item.impressions || 0,
                        clicks: item.clicks || 0,
                        cost: item.cost || 0,
                        conversions: 0,
                      })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10),
                    };
                  }
                  return {
                    columnName: 'Текст объявления',
                    data: [],
                  };
                case 'placements':
                  // Используем реальные данные по площадкам
                  if (Array.isArray(placementsData) && placementsData.length > 0) {
                    return {
                      columnName: 'Площадка',
                      data: placementsData.map((item: any) => ({
                        name: item.placement,
                        placementType: item.placementType || 'РСЯ',
                        impressions: item.impressions || 0,
                        clicks: item.clicks || 0,
                        cost: item.cost || 0,
                        ctr: item.ctr || 0,
                        avgCpc: item.avgCpc || 0,
                        conversions: item.conversions || 0,
                      })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 15),
                    };
                  }
                  return {
                    columnName: 'Площадка',
                    data: [],
                  };
                case 'income':
                  // Используем реальные данные по платежеспособности
                  if (Array.isArray(incomeData) && incomeData.length > 0) {
                    return {
                      columnName: 'Платежеспособность',
                      data: incomeData.map((item: any) => ({
                        name: item.incomeGrade || item.incomeGradeRaw,
                        impressions: item.impressions || 0,
                        clicks: item.clicks || 0,
                        cost: item.cost || 0,
                        conversions: 0,
                      })).sort((a: any, b: any) => b.cost - a.cost),
                    };
                  }
                  return {
                    columnName: 'Платежеспособность',
                    data: [],
                  };
                case 'categories':
                  // Используем реальные данные по категориям таргетинга
                  if (Array.isArray(targetingCategoriesData) && targetingCategoriesData.length > 0) {
                    return {
                      columnName: 'Категория таргетинга',
                      data: targetingCategoriesData.map((item: any) => ({
                        name: item.category || item.categoryRaw,
                        impressions: item.impressions || 0,
                        clicks: item.clicks || 0,
                        cost: item.cost || 0,
                        conversions: 0,
                      })).sort((a: any, b: any) => b.cost - a.cost),
                    };
                  }
                  return {
                    columnName: 'Категория таргетинга',
                    data: [],
                  };
                default:
                  return { columnName: 'Название', data: [] };
              }
            };

            // Рендер таблицы отчёта с расширенными метриками
            const renderReportTable = (reportId: string, isMock: boolean) => {
              const report = getReportData(reportId);
              const isPlacementsReport = reportId === 'placements';
              const colCount = isPlacementsReport ? 8 : 7;

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          {report.columnName}
                          {isMock && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded normal-case">демо</span>}
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
                      {report.data.length > 0 ? report.data.map((item: any, idx: number) => {
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
                                <span className="truncate block max-w-[300px]" title={item.name}>{item.name}</span>
                              )}
                            </td>
                            {isPlacementsReport && (
                              <td className="px-4 py-3 text-gray-500 text-xs">
                                <span className="px-2 py-0.5 bg-gray-100 rounded">{item.placementType || 'РСЯ'}</span>
                              </td>
                            )}
                            <td className="px-4 py-3 text-right text-gray-500">{(item.impressions || 0).toLocaleString('ru-RU')}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{Math.round(item.clicks).toLocaleString('ru-RU')}</td>
                            <td className="px-4 py-3 text-right text-gray-500">{ctr.toFixed(2)}%</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">{Math.round(item.cost).toLocaleString('ru-RU')} ₽</td>
                            <td className="px-4 py-3 text-right text-gray-500">{cpc > 0 ? `${cpc.toFixed(0)} ₽` : '—'}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{item.conversions || 0}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{cpl > 0 ? `${Math.round(cpl).toLocaleString('ru-RU')} ₽` : '—'}</td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={colCount} className="px-4 py-8 text-center text-gray-500">
                            Нет данных
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            };

            const isAudienceOpen = openReportSections.has('audience');
            const isTechnicalOpen = openReportSections.has('technical');

            return (
              <div className="space-y-3">
                {/* Аккордеон: Показатели аудитории */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleReportSection('audience')}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Users size={20} className="text-primary-600" />
                      <span className="font-semibold text-gray-900">Показатели аудитории</span>
                      <span className="text-xs text-gray-400">{audienceTabs.length} отчётов</span>
                    </div>
                    {isAudienceOpen ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </button>

                  {isAudienceOpen && (
                    <div className="border-t border-gray-200">
                      {/* Табы */}
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
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                              }`}
                            >
                              <Icon size={14} />
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {/* Таблица */}
                      {renderReportTable(audienceReportTab, audienceTabs.find(t => t.id === audienceReportTab)?.isMock || false)}
                    </div>
                  )}
                </div>

                {/* Аккордеон: Технические показатели */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleReportSection('technical')}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-primary-600" />
                      <span className="font-semibold text-gray-900">Технические показатели</span>
                      <span className="text-xs text-gray-400">{technicalTabs.length} отчётов</span>
                    </div>
                    {isTechnicalOpen ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </button>

                  {isTechnicalOpen && (
                    <div className="border-t border-gray-200">
                      {/* Табы */}
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
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                              }`}
                            >
                              <Icon size={14} />
                              <span>{tab.label}</span>
                              {!tab.isMock && <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                            </button>
                          );
                        })}
                      </div>
                      {/* Таблица */}
                      {renderReportTable(technicalReportTab, technicalTabs.find(t => t.id === technicalReportTab)?.isMock || false)}
                    </div>
                  )}
                </div>

                {/* Аккордеон: Посадочные страницы */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => {
                      const newState = !isLandingPagesOpen;
                      setIsLandingPagesOpen(newState);
                      if (newState) {
                        loadLandingPages();
                      }
                    }}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <LinkIcon size={20} className="text-primary-600" />
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
                          <Loader2 className="animate-spin text-primary-600" size={24} />
                          <span className="ml-2 text-gray-500">Загрузка...</span>
                        </div>
                      ) : landingPages.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <LinkIcon size={32} className="mx-auto mb-2 text-gray-300" />
                          <p>Нет данных по посадочным страницам</p>
                          <p className="text-sm text-gray-400 mt-1">Запустите синхронизацию для получения данных</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Посадочная страница
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Показы
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Клики
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Расход
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  CTR
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  CPC
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Отказы
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Конв.
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  CPL
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  CR
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
                                      className="text-primary-600 hover:text-primary-800 hover:underline truncate block max-w-xs"
                                      title={lp.landingPage}
                                    >
                                      {lp.landingPage.replace(/^https?:\/\//, '').substring(0, 50)}
                                      {lp.landingPage.length > 50 ? '...' : ''}
                                    </a>
                                    <span className="text-xs text-gray-400">
                                      {lp.adsCount} объявл.
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                                    {lp.impressions?.toLocaleString() || 0}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                                    {lp.clicks?.toLocaleString() || 0}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                                    {(lp.cost || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                                    {(lp.ctr || 0).toFixed(2)}%
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                                    {(lp.cpc || 0).toFixed(2)} ₽
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                                    {(lp.bounceRate || 0).toFixed(1)}%
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                                    {lp.conversions || 0}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                                    {lp.conversions > 0 ? (
                                      <span className={lp.cpl > 1000 ? 'text-red-600' : 'text-green-600'}>
                                        {(lp.cpl || 0).toFixed(0)} ₽
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                                    {(lp.cr || 0).toFixed(2)}%
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
            );
          })()}
        </div>
      )}

      {/* AI-рекомендации */}
      {activeConnectionId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
          {/* Заголовок аккордеона */}
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
              {Array.isArray(recommendationsData) && recommendationsData.length > 0 && (
                <span className="text-sm text-gray-500">
                  {recommendationsData.filter((r: any) => r.type === 'critical' || r.type === 'warning').length} проблем
                </span>
              )}
            </div>
            {Array.isArray(recommendationsData) && recommendationsData.some((r: any) => r.type === 'critical') && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                <AlertTriangle size={14} />
                Требует внимания
              </div>
            )}
          </div>

          {/* Содержимое */}
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
                        case 'critical': return 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200';
                        case 'warning': return 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200';
                        case 'success': return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200';
                        default: return 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200';
                      }
                    };
                    const getIconColor = () => {
                      switch (rec.type) {
                        case 'critical': return 'text-red-600';
                        case 'warning': return 'text-amber-600';
                        case 'success': return 'text-green-600';
                        default: return 'text-blue-600';
                      }
                    };
                    const getIcon = () => {
                      switch (rec.type) {
                        case 'critical': return <AlertTriangle size={18} className={getIconColor()} />;
                        case 'warning': return <AlertCircle size={18} className={getIconColor()} />;
                        case 'success': return <CheckCircle size={18} className={getIconColor()} />;
                        default: return <Sparkles size={18} className={getIconColor()} />;
                      }
                    };
                    const getCategoryIcon = () => {
                      switch (rec.category) {
                        case 'ctr': return <MousePointer size={14} className="text-gray-400" />;
                        case 'conversions': return <Target size={14} className="text-gray-400" />;
                        case 'budget': return <DollarSign size={14} className="text-gray-400" />;
                        default: return <BarChart3 size={14} className="text-gray-400" />;
                      }
                    };

                    return (
                      <div
                        key={index}
                        className={`rounded-xl p-4 border ${getBgColor()}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getIcon()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 text-sm">{rec.title}</h4>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                {getCategoryIcon()}
                                <span>
                                  {rec.category === 'ctr' ? 'CTR' :
                                   rec.category === 'conversions' ? 'Конверсии' :
                                   rec.category === 'budget' ? 'Бюджет' :
                                   rec.category === 'keywords' ? 'Ключевые слова' : 'Общее'}
                                </span>
                              </div>
                            </div>
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

      {/* Модальное окно редактирования подключения */}
      {editingConnection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Заголовок */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Edit3 size={24} className="text-primary-600" />
                <h2 className="text-xl font-bold text-gray-900">
                  Редактирование: {editingConnection.login}
                </h2>
              </div>
              <button
                onClick={() => {
                  setEditingConnection(null);
                  setEditForm({ accessToken: '', selectedGoals: [] });
                  setEditAvailableGoals([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Контент */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Новый API токен */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Key size={16} />
                  Новый API токен (оставьте пустым, чтобы не менять)
                </label>
                <input
                  type="password"
                  value={editForm.accessToken}
                  onChange={(e) => setEditForm({ ...editForm, accessToken: e.target.value })}
                  placeholder="Введите новый токен..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Токен можно получить на{' '}
                  <a
                    href="https://oauth.yandex.ru/authorize?response_type=token&client_id=f34eef7db7da4f4191b14766ef74fbc0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    странице OAuth Яндекса
                  </a>
                </p>
              </div>

              {/* Цели конверсий */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <CheckSquare size={16} />
                  Цели конверсий
                </label>
                {isLoadingGoals ? (
                  <div className="flex items-center gap-2 text-gray-500 py-4">
                    <Loader2 className="animate-spin" size={20} />
                    <span>Загрузка целей...</span>
                  </div>
                ) : editAvailableGoals.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {editAvailableGoals.map((goal: any) => (
                      <label
                        key={goal.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editForm.selectedGoals.includes(goal.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditForm({
                                ...editForm,
                                selectedGoals: [...editForm.selectedGoals, goal.id],
                              });
                            } else {
                              setEditForm({
                                ...editForm,
                                selectedGoals: editForm.selectedGoals.filter((id: number) => id !== goal.id),
                              });
                            }
                          }}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">
                          {goal.name} <span className="text-gray-400">(ID: {goal.id})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-300 rounded-lg">
                    Нет доступных целей. Выполните синхронизацию данных.
                  </div>
                )}
              </div>

              {/* Ввод ID цели вручную */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Добавить цель вручную (ID)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Введите ID цели..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        const goalId = parseInt(input.value);
                        if (goalId && !editForm.selectedGoals.includes(goalId)) {
                          setEditForm({
                            ...editForm,
                            selectedGoals: [...editForm.selectedGoals, goalId],
                          });
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                      const goalId = parseInt(input?.value);
                      if (goalId && !editForm.selectedGoals.includes(goalId)) {
                        setEditForm({
                          ...editForm,
                          selectedGoals: [...editForm.selectedGoals, goalId],
                        });
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Добавить
                  </button>
                </div>
              </div>

              {/* Выбранные цели */}
              {editForm.selectedGoals.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Выбранные цели ({editForm.selectedGoals.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {editForm.selectedGoals.map((goalId: number) => {
                      const goal = editAvailableGoals.find((g: any) => g.id === goalId);
                      return (
                        <span
                          key={goalId}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                        >
                          {goal?.name || `Цель ${goalId}`}
                          <button
                            onClick={() =>
                              setEditForm({
                                ...editForm,
                                selectedGoals: editForm.selectedGoals.filter((id: number) => id !== goalId),
                              })
                            }
                            className="text-primary-600 hover:text-primary-800"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Футер */}
            <div className="border-t border-gray-200 p-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingConnection(null);
                  setEditForm({ accessToken: '', selectedGoals: [] });
                  setEditAvailableGoals([]);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  setIsSavingConnection(true);
                  try {
                    const body: any = {};
                    if (editForm.accessToken) {
                      body.accessToken = editForm.accessToken;
                    }
                    body.conversionGoals = editForm.selectedGoals.map(String);

                    const response = await fetch(
                      `${API_BASE_URL}/api/yandex/connection/${editingConnection.id}`,
                      {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                      }
                    );

                    if (!response.ok) {
                      throw new Error('Failed to update connection');
                    }

                    // Закрываем модалку и обновляем страницу
                    setEditingConnection(null);
                    setEditForm({ accessToken: '', selectedGoals: [] });
                    setEditAvailableGoals([]);
                    window.location.reload();
                  } catch (error) {
                    alert('Ошибка при сохранении: ' + (error as Error).message);
                  } finally {
                    setIsSavingConnection(false);
                  }
                }}
                disabled={isSavingConnection}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {isSavingConnection ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно управления подключениями */}
      {showConnectionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Заголовок */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Settings size={24} className="text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">Управление подключениями</h2>
              </div>
              <button
                onClick={() => setShowConnectionsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Список подключений */}
            <div className="flex-1 overflow-y-auto p-6">
              {connections.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-4">Нет подключений для этого проекта</p>
                  <button
                    onClick={() => {
                      setShowConnectionsModal(false);
                      navigate('/connect-yandex-simple');
                    }}
                    className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <LinkIcon size={18} />
                    Добавить первое подключение
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {connections.map((conn: any) => (
                    <div
                      key={conn.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Building2 size={20} className="text-primary-600" />
                            <h3 className="font-semibold text-lg text-gray-900">{conn.login}</h3>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                conn.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {conn.status === 'active' ? 'Активен' : 'Неактивен'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Последняя синхронизация:</span>{' '}
                              {formatLastSync(conn.lastSyncAt)}
                            </div>
                            {conn.metrikaCounterId && (
                              <div>
                                <span className="font-medium">Метрика:</span> {conn.metrikaCounterId}
                              </div>
                            )}
                            {conn.conversionGoals && JSON.parse(conn.conversionGoals || '[]').length > 0 && (
                              <div>
                                <span className="font-medium">Целей:</span>{' '}
                                {JSON.parse(conn.conversionGoals || '[]').length}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={async () => {
                              setShowConnectionsModal(false); // Закрываем модалку подключений
                              setEditingConnection(conn);
                              setEditForm({
                                accessToken: '',
                                selectedGoals: conn.conversionGoals ? JSON.parse(conn.conversionGoals).map(Number) : [],
                              });
                              setIsLoadingGoals(true);
                              try {
                                const response = await fetch(`${API_BASE_URL}/api/yandex/connection/${conn.id}/goals`);
                                const data = await response.json();
                                setEditAvailableGoals(data.goals || []);
                              } catch (error) {
                                console.error('Failed to load goals:', error);
                                setEditAvailableGoals([]);
                              }
                              setIsLoadingGoals(false);
                            }}
                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Редактировать подключение"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Удалить подключение ${conn.login}?`)) {
                                try {
                                  await fetch(`${API_BASE_URL}/api/yandex/connection/${conn.id}`, {
                                    method: 'DELETE',
                                  });
                                  window.location.reload();
                                } catch (error) {
                                  alert('Ошибка при удалении подключения');
                                }
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить подключение"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Футер */}
            <div className="border-t border-gray-200 p-6 flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Всего подключений: {connections.length}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConnectionsModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Закрыть
                </button>
                <button
                  onClick={() => {
                    setShowConnectionsModal(false);
                    navigate('/connect-yandex-simple');
                  }}
                  className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <LinkIcon size={16} />
                  Добавить подключение
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
