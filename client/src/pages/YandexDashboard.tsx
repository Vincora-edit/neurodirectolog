import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsService } from '../services/api';
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
} from 'lucide-react';

// API Service для получения данных дашборда
const dashboardService = {
  async getConnection(projectId: string) {
    const response = await fetch(`http://localhost:3001/api/yandex/connection/${projectId}`);
    if (!response.ok) return null;
    return response.json();
  },

  async getCampaigns(projectId: string) {
    const response = await fetch(`http://localhost:3001/api/yandex/campaigns/${projectId}`);
    return response.json();
  },

  async getStats(projectId: string, days: number = 30) {
    const response = await fetch(`http://localhost:3001/api/yandex/stats/${projectId}?days=${days}`);
    return response.json();
  },

  async getDetailedStats(projectId: string, days: number = 30, goalId?: string, startDate?: string, endDate?: string) {
    let url = `http://localhost:3001/api/yandex/detailed-stats/${projectId}?`;

    if (startDate && endDate) {
      url += `startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `days=${days}`;
    }

    if (goalId) {
      url += `&goalId=${goalId}`;
    }

    const response = await fetch(url);
    return response.json();
  },

  async getAvailableGoals(projectId: string) {
    const response = await fetch(`http://localhost:3001/api/yandex/available-goals/${projectId}`);
    return response.json();
  },

  async getCampaignStats(campaignId: string, days: number = 30) {
    const response = await fetch(`http://localhost:3001/api/yandex/campaign-stats/${campaignId}?days=${days}`);
    return response.json();
  },

  async syncManual(projectId: string) {
    const response = await fetch(`http://localhost:3001/api/yandex/sync/${projectId}`, {
      method: 'POST',
    });
    return response.json();
  },
};

export default function YandexDashboard() {
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [dateRange, setDateRange] = useState<number>(30);
  const [selectedGoalId, setSelectedGoalId] = useState<string>(''); // '' = все цели
  const [groupBy, setGroupBy] = useState<string>('day'); // day, week, month
  const [customDateMode, setCustomDateMode] = useState<boolean>(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Загрузка проектов
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
  });

  // Автоматически выбираем первый проект
  const activeProjectId = selectedProjectId || projects[0]?.id || '';

  // Загрузка подключения
  const { data: connection } = useQuery({
    queryKey: ['yandex-connection', activeProjectId],
    queryFn: () => dashboardService.getConnection(activeProjectId),
    enabled: !!activeProjectId,
  });

  // Загрузка кампаний
  const { data: campaigns = [] } = useQuery({
    queryKey: ['yandex-campaigns', activeProjectId],
    queryFn: () => dashboardService.getCampaigns(activeProjectId),
    enabled: !!activeProjectId && !!connection,
  });

  // Загрузка доступных целей
  const { data: availableGoals = [] } = useQuery({
    queryKey: ['yandex-goals', activeProjectId],
    queryFn: () => dashboardService.getAvailableGoals(activeProjectId),
    enabled: !!activeProjectId && !!connection,
  });

  // Загрузка статистики (новый метод с фильтром по цели)
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ['yandex-detailed-stats', activeProjectId, dateRange, selectedGoalId, customDateMode, customStartDate, customEndDate],
    queryFn: () => dashboardService.getDetailedStats(
      activeProjectId,
      dateRange,
      selectedGoalId || undefined,
      customDateMode ? customStartDate : undefined,
      customDateMode ? customEndDate : undefined
    ),
    enabled: !!activeProjectId && !!connection,
  });

  // Убеждаемся что stats - это массив
  const stats = Array.isArray(statsData) ? statsData : [];

  // Логируем данные для отладки
  console.log('[YandexDashboard] availableGoals:', availableGoals, 'length:', availableGoals?.length);
  console.log('[YandexDashboard] connection:', connection);
  console.log('[YandexDashboard] activeProjectId:', activeProjectId);

  if (statsData && !Array.isArray(statsData)) {
    console.error('Stats is not an array:', statsData);
  }

  // Синхронизация данных
  const handleSync = async () => {
    await dashboardService.syncManual(activeProjectId);
    refetchStats();
  };

  // Если нет подключения - показываем экран подключения
  if (activeProjectId && !connection) {
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
                <button
                  onClick={() => navigate('/connect-yandex')}
                  className="bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-800 transition-colors inline-flex items-center gap-2"
                >
                  OAuth подключение
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Если нет проектов
  if (projects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <AlertCircle className="text-yellow-600 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Нет проектов
          </h3>
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
  const roi = totalStats.cost > 0 ? ((totalStats.revenue - totalStats.cost) / totalStats.cost) * 100 : 0;

  return (
    <div className="max-w-7xl">
      {/* Шапка */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Аналитика Яндекс.Директ</h1>
          <p className="mt-2 text-gray-600">
            Подключен: {connection?.login}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Селектор целей конверсий */}
          {availableGoals.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
              <Target size={18} className="text-gray-500" />
              <select
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                className="border-none focus:ring-0 bg-transparent text-sm font-medium"
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
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
            <Calendar size={18} className="text-gray-500" />
            <select
              value={customDateMode ? 'custom' : dateRange}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'custom') {
                  setCustomDateMode(true);
                  // Устанавливаем даты по умолчанию (последние 30 дней)
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
              className="border-none focus:ring-0 bg-transparent text-sm font-medium"
            >
              <option value={7}>Последние 7 дней</option>
              <option value={30}>Последние 30 дней</option>
              <option value={90}>Последние 90 дней</option>
              <option value="custom">Произвольный период</option>
            </select>
          </div>

          {/* Выбор произвольных дат */}
          {customDateMode && (
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border-none focus:ring-0 bg-transparent text-sm"
              />
              <ArrowRight size={16} className="text-gray-400" />
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="border-none focus:ring-0 bg-transparent text-sm"
              />
            </div>
          )}

          {/* Селектор группировки */}
          <div className="flex items-center gap-0 bg-white border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setGroupBy('day')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                groupBy === 'day' ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              День
            </button>
            <button
              onClick={() => setGroupBy('week')}
              className={`px-3 py-2 text-sm font-medium transition-colors border-x border-gray-300 ${
                groupBy === 'week' ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Неделя
            </button>
            <button
              onClick={() => setGroupBy('month')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                groupBy === 'month' ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Месяц
            </button>
          </div>

          <button
            onClick={handleSync}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw size={18} />
            Обновить
          </button>
          <button
            onClick={() => navigate('/connect-yandex-simple')}
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <LinkIcon size={18} />
            Переподключить
          </button>
        </div>
      </div>

      {/* Баннер если нет данных */}
      {stats.length === 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="bg-yellow-500 p-3 rounded-xl">
              <AlertCircle className="text-white" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Нет данных для отображения</h3>
              <p className="text-sm text-gray-700 mb-3">
                Для работы с новым селектором целей необходимо пересоздать подключение и указать ID целей конверсий.
              </p>
              <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">Что делать:</p>
                <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                  <li>Нажми кнопку "Переподключить" в правом верхнем углу</li>
                  <li>Заполни форму с токеном и логином</li>
                  <li><strong>ОБЯЗАТЕЛЬНО укажи ID целей</strong> через запятую (например: 252254424, 293622736)</li>
                  <li>Дождись завершения синхронизации (1-2 минуты)</li>
                  <li>Обнови страницу - появится селектор целей!</li>
                </ol>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/connect-yandex-simple')}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors font-semibold inline-flex items-center gap-2"
                >
                  <LinkIcon size={18} />
                  Переподключить с целями
                </button>
                <button
                  onClick={handleSync}
                  className="bg-white border border-yellow-300 text-yellow-800 px-4 py-2 rounded-lg hover:bg-yellow-50 transition-colors inline-flex items-center gap-2"
                >
                  <RefreshCw size={18} />
                  Попробовать синхронизацию
                </button>
              </div>
            </div>
          </div>
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
          <div className="flex items-center gap-1 text-red-100 text-sm">
            <TrendingUp size={16} />
            За {dateRange} дней
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
            CTR: {avgCtr.toFixed(2)}% • CPC: {avgCpc.toFixed(2)} ₽
          </div>
        </div>

        {/* Конверсии */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Target size={24} />
            </div>
            <div className="text-right">
              <p className="text-sm text-green-100">Конверсии</p>
              <p className="text-3xl font-bold">{totalStats.conversions.toLocaleString('ru-RU')}</p>
            </div>
          </div>
          <div className="text-green-100 text-sm">
            CR: {totalStats.clicks > 0 ? ((totalStats.conversions / totalStats.clicks) * 100).toFixed(2) : 0}%
          </div>
        </div>

        {/* ROI */}
        <div className={`bg-gradient-to-br ${roi >= 0 ? 'from-purple-500 to-violet-600' : 'from-gray-500 to-gray-600'} rounded-xl shadow-lg p-6 text-white`}>
          <div className="flex items-center justify-between mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              {roi >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
            <div className="text-right">
              <p className="text-sm text-purple-100">ROI</p>
              <p className="text-3xl font-bold">{roi.toFixed(1)}%</p>
            </div>
          </div>
          <div className="text-purple-100 text-sm">
            Доход: {totalStats.revenue.toLocaleString('ru-RU')} ₽
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Показы
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Клики
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  CTR
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  CPC
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Расход
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Конверсии
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  ROI
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.map((campaign: any, index: number) => {
                const campaignInfo = campaigns.find((c: any) => c.externalId === campaign.campaignId);
                const ctr = campaign.avgCtr;
                const roi = campaign.roi;

                return (
                  <tr key={index} className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          campaignInfo?.status === 'ON' ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                        <span className="text-sm font-medium text-gray-900">
                          {campaignInfo?.name || campaign.campaignId}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {campaign.totalImpressions.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {campaign.totalClicks.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${
                        ctr >= 3 ? 'text-green-600' : ctr >= 2 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {ctr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {campaign.avgCpc.toFixed(2)} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                      {campaign.totalCost.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${
                        campaign.totalConversions > 0 ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {campaign.totalConversions}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {roi >= 0 ? (
                          <TrendingUp className="text-green-500" size={16} />
                        ) : (
                          <TrendingDown className="text-red-500" size={16} />
                        )}
                        <span className={`text-sm font-bold ${
                          roi >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {roi.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {stats.length === 0 && (
          <div className="p-12 text-center">
            <Eye className="text-gray-300 mx-auto mb-4" size={48} />
            <p className="text-gray-500">Нет данных за выбранный период</p>
            <p className="text-sm text-gray-400 mt-2">
              Попробуйте запустить синхронизацию или выбрать другой период
            </p>
          </div>
        )}
      </div>

      {/* AI Рекомендации (заглушка) */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="bg-amber-500 p-3 rounded-xl">
            <Sparkles className="text-white" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2">AI рекомендации</h3>
            <p className="text-sm text-gray-700 mb-4">
              Система автоматически анализирует кампании и генерирует рекомендации по оптимизации
            </p>
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <AlertCircle size={16} />
              <span>Рекомендации появятся после синхронизации данных</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
