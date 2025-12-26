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
import { TrendingUp, DollarSign, MousePointer, Target, AlertCircle } from 'lucide-react';

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

export default function PublicDashboard() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set(['cost', 'clicks'])
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_URL}/public/dashboard/${token}`);
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

    if (token) {
      fetchData();
    }
  }, [token]);

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Статистика Yandex.Direct
              </h1>
              <p className="text-sm text-gray-500">
                Аккаунт: {data.accountLogin} | Период: {formatDate(data.period.startDate)} — {formatDate(data.period.endDate)}
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              Обновлено: {new Date(data.lastUpdated).toLocaleString('ru-RU')}
            </div>
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
          <div className="px-5 py-4 border-b border-gray-200">
            <span className="font-semibold text-gray-900">Кампании</span>
            <span className="ml-2 text-sm text-gray-500">
              {data.campaigns.length} кампаний
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Название
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Расход
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Клики
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    CTR
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Конв.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    CPL
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
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
                      {formatCurrency(campaign.cost)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatNumber(campaign.clicks)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatPercent(campaign.ctr)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatNumber(campaign.conversions)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {(campaign.cpl || 0) > 0 ? formatCurrency(campaign.cpl) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
