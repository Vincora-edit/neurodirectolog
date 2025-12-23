import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsService, API_BASE_URL } from '../services/api';
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

  async getDetailedStats(projectId: string, days: number = 30, goalId?: string, startDate?: string, endDate?: string, connectionId?: string) {
    let url = `${API_BASE_URL}/api/yandex/detailed-stats/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (goalId) {
      url += `&goalId=${goalId}`;
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
};

export default function YandexDashboard() {
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [dateRange, setDateRange] = useState<number>(30);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
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

  // Загрузка проектов
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
  });

  // Автоматически выбираем первый проект
  const activeProjectId = selectedProjectId || projects[0]?.id || '';

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

  // Загрузка статистики
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['yandex-detailed-stats', activeProjectId, activeConnectionId, dateRange, selectedGoalId, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getDetailedStats(
      activeProjectId,
      dateRange,
      selectedGoalId || undefined,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined,
      activeConnectionId
    ),
    enabled: !!activeProjectId && !!activeConnectionId,
  });

  const stats = Array.isArray(statsData) ? statsData : [];

  // Синхронизация данных
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await dashboardService.syncManual(activeProjectId);
      await refetchStats();
    } finally {
      setIsSyncing(false);
    }
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

  // Вычисляем общую статистику
  const totalStats = stats.reduce(
    (acc: any, campaign: any) => ({
      impressions: acc.impressions + campaign.totalImpressions,
      clicks: acc.clicks + campaign.totalClicks,
      cost: acc.cost + campaign.totalCost,
      conversions: acc.conversions + campaign.totalConversions,
      revenue: acc.revenue + campaign.totalRevenue,
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 }
  );

  const avgCtr = totalStats.clicks > 0 ? (totalStats.clicks / totalStats.impressions) * 100 : 0;
  const avgCpc = totalStats.clicks > 0 ? totalStats.cost / totalStats.clicks : 0;
  const cpl = totalStats.conversions > 0 ? totalStats.cost / totalStats.conversions : 0;
  const cr = totalStats.clicks > 0 ? (totalStats.conversions / totalStats.clicks) * 100 : 0;

  // Средний расход в день
  const avgCostPerDay = totalStats.cost / Math.max(1, dateRange);

  const isLoading = statsLoading || connectionsLoading || goalsLoading;

  return (
    <div className="max-w-7xl">
      {/* Улучшенная шапка */}
      <div className="mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Первая строка: Заголовок и основные действия */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {activeProject?.name || 'Аналитика Яндекс.Директ'}
              </h1>
              {activeConnection && (
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>Последняя синхронизация: {formatLastSync(activeConnection.lastSyncAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="font-medium">Подключен: {activeConnection.login}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                {isSyncing ? 'Синхронизация...' : 'Обновить'}
              </button>
              <button
                onClick={() => setShowConnectionsModal(true)}
                className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
              >
                <Settings size={18} />
                Управление подключениями
              </button>
              <button
                onClick={() => navigate('/connect-yandex-simple')}
                className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <LinkIcon size={18} />
                Добавить аккаунт
              </button>
            </div>
          </div>

          {/* Вторая строка: Селекторы */}
          <div className="flex items-start gap-4 flex-wrap">
            {/* Селектор аккаунтов */}
            {connections.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Building2 size={14} className="text-gray-500" />
                  Аккаунт
                </label>
                <select
                  value={activeConnectionId}
                  onChange={(e) => setSelectedConnectionId(e.target.value)}
                  className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm font-medium text-blue-900 focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[200px]"
                >
                  {connections.map((conn: any) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.login}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Селектор целей */}
            {availableGoals.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Target size={14} className="text-gray-500" />
                  Цель
                </label>
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="">Все цели</option>
                  {availableGoals.map((goal: any) => (
                    <option key={goal.goalId} value={goal.goalId}>
                      {goal.goalName || `Цель ${goal.goalId}`}
                    </option>
                  ))}
                </select>
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
        </div>
      </div>

      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          <span className="text-sm text-blue-900 font-medium">Загрузка данных...</span>
        </div>
      )}

      {/* Ключевые метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Расход */}
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div className="text-right">
              <p className="text-sm text-red-100">Расход</p>
              <p className="text-3xl font-bold">{totalStats.cost.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
          <div className="text-red-100 text-sm">
            В день: {Math.round(avgCostPerDay).toLocaleString('ru-RU')} ₽
          </div>
        </div>

        {/* Клики */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <MousePointer size={24} />
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-100">Клики</p>
              <p className="text-3xl font-bold">{totalStats.clicks.toLocaleString('ru-RU')}</p>
            </div>
          </div>
          <div className="text-blue-100 text-sm">
            CPC: {avgCpc.toFixed(2)} ₽
          </div>
        </div>

        {/* CPL */}
        <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingDown size={24} />
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-100">CPL</p>
              <p className="text-3xl font-bold">{cpl > 0 ? Math.round(cpl).toLocaleString('ru-RU') : '—'} ₽</p>
            </div>
          </div>
          <div className="text-gray-100 text-sm">
            CR: {cr.toFixed(2)}%
          </div>
        </div>

        {/* Конверсии */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="bg-white/20 p-2 rounded-lg">
              <Target size={24} />
            </div>
            <div className="text-right">
              <p className="text-sm text-green-100">Конверсии</p>
              <p className="text-3xl font-bold">{totalStats.conversions.toLocaleString('ru-RU')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Таблица кампаний */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Кампании</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Кампания
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Показы
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Клики
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Расход
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  CPC
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  CTR
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Отказы
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Конверсии
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  CR %
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  CPL
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.map((campaign: any, index: number) => {
                const ctr = campaign.avgCtr;
                const campaignCr = campaign.totalClicks > 0 ? (campaign.totalConversions / campaign.totalClicks) * 100 : 0;
                const campaignCpl = campaign.totalConversions > 0 ? campaign.totalCost / campaign.totalConversions : 0;

                // Определяем статус: если расход > 0, то активна
                const isActive = campaign.totalCost > 0;

                // Процент отказов (bounce rate) - если есть в данных
                const bounceRate = campaign.avgBounceRate || 0;

                return (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {campaign.campaignName || campaign.campaignId}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {isActive ? 'Активна' : 'Неактивна'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {campaign.totalImpressions.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {campaign.totalClicks.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                      {campaign.totalCost.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {campaign.avgCpc.toFixed(2)} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${
                        ctr >= 5 ? 'text-green-600' : ctr >= 3 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {ctr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {typeof campaign.avgBounceRate === 'number' ? `${bounceRate.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${
                        campaign.totalConversions > 0 ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {campaign.totalConversions.toLocaleString('ru-RU')}
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
                );
              })}
              {/* Строка ИТОГО */}
              {stats.length > 0 && (() => {
                const totals = stats.reduce((acc: any, c: any) => ({
                  impressions: acc.impressions + (c.totalImpressions || 0),
                  clicks: acc.clicks + (c.totalClicks || 0),
                  cost: acc.cost + (c.totalCost || 0),
                  conversions: acc.conversions + (c.totalConversions || 0),
                  // Для средневзвешенного отказов: сумма (отказы * клики)
                  bounceWeighted: acc.bounceWeighted + ((c.avgBounceRate || 0) * (c.totalClicks || 0)),
                }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, bounceWeighted: 0 });

                const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
                const avgCpc = totals.clicks > 0 ? totals.cost / totals.clicks : 0;
                const avgBounce = totals.clicks > 0 ? totals.bounceWeighted / totals.clicks : 0;
                const avgCr = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
                const avgCpl = totals.conversions > 0 ? totals.cost / totals.conversions : 0;

                return (
                  <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ИТОГО
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      —
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

        {stats.length === 0 && !isLoading && (
          <div className="p-12 text-center">
            <Eye className="text-gray-300 mx-auto mb-4" size={48} />
            <p className="text-gray-500">Нет данных за выбранный период</p>
            <p className="text-sm text-gray-400 mt-2">
              Попробуйте запустить синхронизацию или выбрать другой период
            </p>
          </div>
        )}
      </div>

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
