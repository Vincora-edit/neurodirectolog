import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
import { TrendingUp, DollarSign, MousePointer, Target, AlertCircle, Gauge, Calendar, ChevronDown, ChevronUp, ArrowUpDown, LayoutGrid, Table, CheckCircle, TrendingDown } from 'lucide-react';
import { DATE_RANGES } from '../constants';
import { KpiContent } from '../components/dashboard';

interface DashboardData {
  shareName: string;
  accountLogin: string;
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  totals: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpl: number;
  };
  kpi?: {
    targetCost: number;
    targetCpl: number;
    targetLeads: number;
  } | null;
  kpiStats?: {
    currentCost: number;
    currentLeads: number;
    currentCpl: number;
    dayProgress: number;
    daysInMonth: number;
    currentDay: number;
  };
  kpiProgress?: {
    costProgress: number;
    costDayProgress: number;
    leadsProgress: number;
    leadsDayProgress: number;
    cplStatus: 'good' | 'warning' | 'bad';
  };
  kpiAnalysis?: {
    cost: {
      avgDaily7d: number;
      projectedMonthly: number;
      remainingDays: number;
      remainingBudget: number;
      requiredDailyBudget: number;
      trend: 'on_track' | 'overspending' | 'underspending';
      recommendation: string | null;
    };
    leads: {
      avgDaily7d: number;
      projectedMonthly: number;
      remainingLeads: number;
      requiredDailyLeads: number;
      trend: 'on_track' | 'behind' | 'ahead';
      recommendation: string | null;
    };
    cpl: {
      current: number;
      target: number;
      avgDaily7d: number;
      trend: 'good' | 'warning' | 'bad';
      recommendation: string | null;
    };
    diagnosis: string | null;
  } | null;
  month?: string;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpl: number;
  }>;
  dailyStats: Array<{
    date: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    cpc: number;
  }>;
  lastUpdated: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Тип сортировки для таблицы кампаний
type SortColumn = 'impressions' | 'clicks' | 'cost' | 'cpc' | 'ctr' | 'bounceRate' | 'conversions' | 'cr' | 'cpl';
type SortDirection = 'asc' | 'desc';

export default function PublicDashboard() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set(['cost', 'clicks'])
  );

  // Состояние для выбора дат
  const [dateRange, setDateRange] = useState(30);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Состояние для таблицы кампаний
  const [campaignsOpen, setCampaignsOpen] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Состояние для таблицы по дням
  const [dailyTableOpen, setDailyTableOpen] = useState(true);

  const fetchData = async (days: number, startDate?: string, endDate?: string) => {
    setIsLoading(true);
    try {
      let url = `${API_URL}/public/dashboard/${token}?days=${days}`;
      if (startDate && endDate) {
        url = `${API_URL}/public/dashboard/${token}?startDate=${startDate}&endDate=${endDate}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Ссылка не найдена или срок действия истёк');
        }
        throw new Error('Не удалось загрузить данные');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      if (customDateMode && customStartDate && customEndDate) {
        fetchData(dateRange, customStartDate, customEndDate);
      } else {
        fetchData(dateRange);
      }
    }
  }, [token, dateRange, customDateMode, customStartDate, customEndDate]);

  const formatCurrency = (value: number | undefined | null) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatNumber = (value: number | undefined | null) => {
    return new Intl.NumberFormat('ru-RU').format(value || 0);
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0.00%';
    return `${value.toFixed(2)}%`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
  };

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metric)) {
        next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortValue = (item: any, column: SortColumn): number => {
    switch (column) {
      case 'impressions': return item.impressions || 0;
      case 'clicks': return item.clicks || 0;
      case 'cost': return item.cost || 0;
      case 'cpc': return item.cpc || 0;
      case 'ctr': return item.ctr || 0;
      case 'bounceRate': return item.bounceRate || 0;
      case 'conversions': return item.conversions || 0;
      case 'cr': return item.clicks > 0 ? ((item.conversions || 0) / item.clicks) * 100 : 0;
      case 'cpl': return item.conversions > 0 ? (item.cost || 0) / item.conversions : 0;
      default: return 0;
    }
  };

  const sortedCampaigns = data?.campaigns ? [...data.campaigns].sort((a, b) => {
    const aVal = getSortValue(a, sortColumn);
    const bVal = getSortValue(b, sortColumn);
    return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
  }) : [];

  // Итоги таблицы кампаний
  const campaignTotals = data?.campaigns ? data.campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + (c.impressions || 0),
      clicks: acc.clicks + (c.clicks || 0),
      cost: acc.cost + (c.cost || 0),
      conversions: acc.conversions + (c.conversions || 0),
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
  ) : { impressions: 0, clicks: 0, cost: 0, conversions: 0 };

  const totalCtr = campaignTotals.impressions > 0 ? (campaignTotals.clicks / campaignTotals.impressions) * 100 : 0;
  const totalCpc = campaignTotals.clicks > 0 ? campaignTotals.cost / campaignTotals.clicks : 0;
  const totalCr = campaignTotals.clicks > 0 ? (campaignTotals.conversions / campaignTotals.clicks) * 100 : 0;
  const totalCpl = campaignTotals.conversions > 0 ? campaignTotals.cost / campaignTotals.conversions : 0;

  // Функции для CPL подсветки
  const targetCpl = data?.kpi?.targetCpl || 0;

  const getCplDeviation = (cpl: number): number | null => {
    if (!targetCpl || targetCpl <= 0 || cpl <= 0) return null;
    return ((cpl - targetCpl) / targetCpl) * 100;
  };

  const getCplStatus = (cpl: number): 'good' | 'warning' | 'bad' | 'neutral' => {
    const deviation = getCplDeviation(cpl);
    if (deviation === null) return 'neutral';
    if (deviation <= 0) return 'good';        // CPL равен или ниже целевого
    if (deviation <= 10) return 'warning';    // CPL выше до 10%
    return 'bad';                              // CPL выше 10%
  };

  const getRowBgColor = (status: 'good' | 'warning' | 'bad' | 'neutral'): string => {
    switch (status) {
      case 'good': return 'bg-green-50 hover:bg-green-100';
      case 'warning': return 'bg-amber-50 hover:bg-amber-100';
      case 'bad': return 'bg-red-50 hover:bg-red-100';
      default: return 'hover:bg-gray-50';
    }
  };

  const getDeviationColor = (deviation: number | null): string => {
    if (deviation === null) return 'text-gray-400';
    if (deviation <= 0) return 'text-green-600';
    if (deviation <= 10) return 'text-amber-600';
    return 'text-red-600';
  };

  const formatDeviation = (deviation: number | null): string => {
    if (deviation === null) return '—';
    const sign = deviation > 0 ? '+' : '';
    return `${sign}${deviation.toFixed(0)}%`;
  };

  // Подсчет статусов кампаний
  const campaignStatusCounts = sortedCampaigns.reduce(
    (acc, c) => {
      const status = getCplStatus(c.cpl || 0);
      acc[status]++;
      return acc;
    },
    { good: 0, warning: 0, bad: 0, neutral: 0 }
  );

  // Компонент заголовка для сортировки
  const SortHeader = ({ column, label }: { column: SortColumn; label: string }) => (
    <th
      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        {sortColumn === column ? (
          sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
        ) : (
          <ArrowUpDown size={14} className="opacity-30" />
        )}
      </div>
    </th>
  );

  const CHART_METRICS = [
    { value: 'cost', label: 'Расход', color: '#ef4444' },
    { value: 'clicks', label: 'Клики', color: '#3b82f6' },
    { value: 'conversions', label: 'Конверсии', color: '#22c55e' },
    { value: 'impressions', label: 'Показы', color: '#8b5cf6' },
    { value: 'ctr', label: 'CTR', color: '#f59e0b' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Ошибка</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const chartData = data.dailyStats.map((item) => ({
    ...item,
    dateFormatted: formatDate(item.date),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Статистика Yandex.Direct
              </h1>
              <p className="text-sm text-gray-500">
                Аккаунт: {data.accountLogin}
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              Обновлено: {new Date(data.lastUpdated).toLocaleString('ru-RU')}
            </div>
          </div>
          {/* Date Range Selector */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {DATE_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => {
                    setDateRange(range.value);
                    setCustomDateMode(false);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    !customDateMode && dateRange === range.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCustomDateMode(!customDateMode)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                customDateMode
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Произвольный
            </button>
            {customDateMode && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            <span className="text-sm text-gray-500 ml-2">
              {formatDate(data.period.startDate)} — {formatDate(data.period.endDate)}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Расход</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(data.totals.cost)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MousePointer size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Клики</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatNumber(data.totals.clicks)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Конверсии</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatNumber(data.totals.conversions)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">CPL</p>
                <p className="text-xl font-bold text-gray-900">
                  {(data.totals.cpl || 0) > 0 ? formatCurrency(data.totals.cpl) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Widget - Using shared KpiContent component */}
        {data.kpi && (data.kpi.targetCost > 0 || data.kpi.targetLeads > 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Gauge size={20} className="text-blue-600" />
                  <span className="font-semibold text-gray-900">
                    KPI {data.month ? new Date(data.month + '-01').toLocaleString('ru-RU', { month: 'long', year: 'numeric' }) : ''}
                  </span>
                </div>
                {data.kpiStats && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar size={14} />
                    <span>День {data.kpiStats.currentDay} из {data.kpiStats.daysInMonth}</span>
                    {data.kpiAnalysis?.cost.remainingDays !== undefined && (
                      <span className="text-gray-400">• осталось {data.kpiAnalysis.cost.remainingDays} дн.</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5">
              <KpiContent
                kpiData={{
                  kpi: data.kpi,
                  stats: data.kpiStats,
                  progress: data.kpiProgress,
                  analysis: data.kpiAnalysis,
                  month: data.month,
                }}
                formatCurrency={formatCurrency}
              />
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <TrendingUp size={20} className="text-green-600" />
              <span className="font-semibold text-gray-900">Динамика</span>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {CHART_METRICS.map((metric) => (
                <button
                  key={metric.value}
                  onClick={() => toggleMetric(metric.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    selectedMetrics.has(metric.value)
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={{
                    backgroundColor: selectedMetrics.has(metric.value)
                      ? metric.color
                      : undefined,
                  }}
                >
                  {metric.label}
                </button>
              ))}
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="dateFormatted"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                      return value;
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend />
                  {CHART_METRICS.filter((m) => selectedMetrics.has(m.value)).map((metric) => (
                    <Line
                      key={metric.value}
                      yAxisId={metric.value === 'ctr' ? 'right' : 'left'}
                      type="monotone"
                      dataKey={metric.value}
                      name={metric.label}
                      stroke={metric.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => setCampaignsOpen(!campaignsOpen)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LayoutGrid size={20} className="text-blue-600" />
              <span className="font-semibold text-gray-900">Кампании</span>
              <span className="text-xs text-gray-400">{data.campaigns.length} кампаний</span>
              {/* CPL Status Summary */}
              {targetCpl > 0 && (
                <div className="flex items-center gap-2 ml-4">
                  <div className="flex items-center gap-1" title="CPL ниже плана (хорошо)">
                    <CheckCircle size={14} className="text-green-600" />
                    <span className="text-xs font-medium text-green-600">{campaignStatusCounts.good}</span>
                  </div>
                  <div className="flex items-center gap-1" title="CPL в пределах нормы">
                    <AlertCircle size={14} className="text-amber-600" />
                    <span className="text-xs font-medium text-amber-600">{campaignStatusCounts.warning}</span>
                  </div>
                  <div className="flex items-center gap-1" title="CPL выше плана (плохо)">
                    <TrendingDown size={14} className="text-red-600" />
                    <span className="text-xs font-medium text-red-600">{campaignStatusCounts.bad}</span>
                  </div>
                </div>
              )}
            </div>
            {campaignsOpen ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </button>
          {campaignsOpen && (
            <div className="border-t border-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Название
                    </th>
                    <SortHeader column="impressions" label="Показы" />
                    <SortHeader column="clicks" label="Клики" />
                    <SortHeader column="cost" label="Расход" />
                    <SortHeader column="cpc" label="CPC" />
                    <SortHeader column="ctr" label="CTR" />
                    <SortHeader column="bounceRate" label="Отказы" />
                    <SortHeader column="conversions" label="Конверсии" />
                    <SortHeader column="cr" label="CR %" />
                    <SortHeader column="cpl" label="CPL" />
                    {targetCpl > 0 && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        vs план
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedCampaigns.map((campaign) => {
                    const campaignCr = campaign.clicks > 0 ? (campaign.conversions / campaign.clicks) * 100 : 0;
                    const cplStatus = getCplStatus(campaign.cpl || 0);
                    const deviation = getCplDeviation(campaign.cpl || 0);
                    return (
                      <tr key={campaign.id} className={getRowBgColor(cplStatus)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                campaign.status === 'ON'
                                  ? 'bg-green-500'
                                  : campaign.status === 'OFF'
                                  ? 'bg-gray-400'
                                  : 'bg-yellow-500'
                              }`}
                            />
                            <span className="font-medium text-gray-900 truncate max-w-[300px]">
                              {campaign.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatNumber(campaign.impressions)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatNumber(campaign.clicks)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCurrency(campaign.cost)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {(campaign.cpc || 0).toFixed(2)} ₽
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${
                            (campaign.ctr || 0) >= 5 ? 'text-green-600' :
                            (campaign.ctr || 0) >= 3 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {formatPercent(campaign.ctr)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {typeof (campaign as any).bounceRate === 'number'
                            ? `${(campaign as any).bounceRate.toFixed(2)}%`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${
                            (campaign.conversions || 0) > 0 ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {formatNumber(campaign.conversions)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${
                            campaignCr >= 10 ? 'text-green-600' :
                            campaignCr >= 5 ? 'text-yellow-600' : 'text-gray-600'
                          }`}>
                            {campaignCr > 0 ? `${campaignCr.toFixed(2)}%` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {(campaign.cpl || 0) > 0 ? formatCurrency(campaign.cpl) : '—'}
                        </td>
                        {targetCpl > 0 && (
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${getDeviationColor(deviation)}`}>
                              {formatDeviation(deviation)}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  {data.campaigns.length > 0 && (
                    <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                      <td className="px-4 py-3 text-gray-900">
                        ИТОГО ({data.campaigns.length} кампаний)
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatNumber(campaignTotals.impressions)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatNumber(campaignTotals.clicks)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrency(campaignTotals.cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {totalCpc.toFixed(2)} ₽
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {totalCtr.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">—</td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatNumber(campaignTotals.conversions)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {totalCr > 0 ? `${totalCr.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {totalCpl > 0 ? formatCurrency(totalCpl) : '—'}
                      </td>
                      {targetCpl > 0 && (
                        <td className="px-4 py-3 text-right text-gray-500 text-xs">
                          план: {formatCurrency(targetCpl)}
                        </td>
                      )}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend for CPL highlighting */}
        {targetCpl > 0 && data.campaigns.length > 0 && (
          <div className="flex items-center gap-6 text-sm text-gray-600 px-1">
            <span className="font-medium">Подсветка по CPL:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded border border-green-200"></div>
              <span>В плане или ниже</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-100 rounded border border-amber-200"></div>
              <span>Выше до 10%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 rounded border border-red-200"></div>
              <span>Выше 10%</span>
            </div>
          </div>
        )}

        {/* Daily Stats Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => setDailyTableOpen(!dailyTableOpen)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Table size={20} className="text-purple-600" />
              <span className="font-semibold text-gray-900">Статистика по дням</span>
              <span className="text-xs text-gray-400">{data.dailyStats.length} дней</span>
            </div>
            {dailyTableOpen ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </button>
          {dailyTableOpen && (
            <div className="border-t border-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Дата
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Показы
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Клики
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      CTR
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Расход
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      CPC
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Конверсии
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      CPL
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[...data.dailyStats].reverse().map((day) => {
                    const dayCpl = day.conversions > 0 ? day.cost / day.conversions : 0;
                    return (
                      <tr key={day.date} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {new Date(day.date).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            weekday: 'short',
                          })}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatNumber(day.impressions)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatNumber(day.clicks)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${
                            (day.ctr || 0) >= 5 ? 'text-green-600' :
                            (day.ctr || 0) >= 3 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {formatPercent(day.ctr)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCurrency(day.cost)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {(day.cpc || 0).toFixed(2)} ₽
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${
                            (day.conversions || 0) > 0 ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {formatNumber(day.conversions)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {dayCpl > 0 ? formatCurrency(dayCpl) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-sm text-gray-500">
          Powered by Neurodirectolog
        </div>
      </footer>
    </div>
  );
}
