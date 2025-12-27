import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Target, AlertCircle, Gauge, Calendar, ChevronDown } from 'lucide-react';
import { DATE_RANGES } from '../constants';
import {
  KpiContent,
  StatsChart,
  PublicCampaignsTable,
  DailyStatsTable
} from '../components/dashboard';

interface Goal {
  id: string;
  name: string;
}

interface DashboardData {
  shareName: string;
  accountLogin: string;
  currency?: string;
  availableGoals?: Goal[];
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
    bounceRate?: number | null;
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

export default function PublicDashboard() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range
  const [dateRange, setDateRange] = useState(30);
  const [customDateMode, setCustomDateMode] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Goals
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [goalsDropdownOpen, setGoalsDropdownOpen] = useState(false);

  const fetchData = async (days: number, startDate?: string, endDate?: string, goalIds?: string[]) => {
    setIsLoading(true);
    try {
      let url = `${API_URL}/public/dashboard/${token}?days=${days}`;
      if (startDate && endDate) {
        url = `${API_URL}/public/dashboard/${token}?startDate=${startDate}&endDate=${endDate}`;
      }
      if (goalIds && goalIds.length > 0) {
        url += `&goalIds=${goalIds.join(',')}`;
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
        fetchData(dateRange, customStartDate, customEndDate, selectedGoalIds);
      } else {
        fetchData(dateRange, undefined, undefined, selectedGoalIds);
      }
    }
  }, [token, dateRange, customDateMode, customStartDate, customEndDate, selectedGoalIds]);

  const currencyCode = data?.currency || 'RUB';

  const formatCurrency = (value: number | undefined | null) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatNumber = (value: number | undefined | null) => {
    return new Intl.NumberFormat('ru-RU').format(value || 0);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
  };

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

  // Prepare data for StatsChart
  const chartData = data.dailyStats.map((item) => ({
    ...item,
    cpl: item.conversions > 0 ? item.cost / item.conversions : 0,
    cr: item.clicks > 0 ? (item.conversions / item.clicks) * 100 : 0,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Статистика Yandex.Direct</h1>
              <p className="text-sm text-gray-500">Аккаунт: {data.accountLogin}</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              Обновлено: {new Date(data.lastUpdated).toLocaleString('ru-RU')}
            </div>
          </div>

          {/* Controls: Date Range + Goals */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {/* Date Range Selector */}
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

            {/* Goal Selector */}
            {data.availableGoals && data.availableGoals.length > 0 && (
              <div className="relative ml-4">
                <button
                  onClick={() => setGoalsDropdownOpen(!goalsDropdownOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    selectedGoalIds.length > 0
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  {selectedGoalIds.length > 0 ? `Цели (${selectedGoalIds.length})` : 'Все цели'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${goalsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {goalsDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 min-w-[250px]">
                    <button
                      onClick={() => {
                        setSelectedGoalIds([]);
                        setGoalsDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                        selectedGoalIds.length === 0 ? 'text-green-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      Все цели
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                    {data.availableGoals.map((goal) => (
                      <button
                        key={goal.id}
                        onClick={() => {
                          setSelectedGoalIds(prev =>
                            prev.includes(goal.id)
                              ? prev.filter(id => id !== goal.id)
                              : [...prev, goal.id]
                          );
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                          selectedGoalIds.includes(goal.id) ? 'text-green-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                          selectedGoalIds.includes(goal.id)
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300'
                        }`}>
                          {selectedGoalIds.includes(goal.id) && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="truncate">{goal.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary Cards - simplified version */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Расход</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(data.totals.cost)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Клики</p>
            <p className="text-xl font-bold text-gray-900">{formatNumber(data.totals.clicks)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Конверсии</p>
            <p className="text-xl font-bold text-gray-900">{formatNumber(data.totals.conversions)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500">CPL</p>
            <p className="text-xl font-bold text-gray-900">
              {(data.totals.cpl || 0) > 0 ? formatCurrency(data.totals.cpl) : '—'}
            </p>
          </div>
        </div>

        {/* KPI Widget */}
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

        {/* Chart - reusing StatsChart component */}
        <StatsChart data={chartData} />

        {/* Campaigns Table - using new simplified component */}
        <PublicCampaignsTable
          campaigns={data.campaigns}
          targetCpl={data.kpi?.targetCpl}
          currency={currencyCode}
        />

        {/* CPL Legend */}
        {data.kpi?.targetCpl && data.kpi.targetCpl > 0 && data.campaigns.length > 0 && (
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

        {/* Daily Stats Table - using new component */}
        <DailyStatsTable data={data.dailyStats} currency={currencyCode} />
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
