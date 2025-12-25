import { useState } from 'react';
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
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CHART_METRICS } from '../../constants';

interface DailyStats {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpl: number;
  cr: number;
  bounceRate?: number;
}

interface StatsChartProps {
  data: DailyStats[];
  title?: string;
  defaultOpen?: boolean;
}

export function StatsChart({ data, title = 'Динамика', defaultOpen = true }: StatsChartProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set(['cost', 'clicks'])
  );

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
    });
  };

  const formatValue = (value: number, metric: string) => {
    if (metric === 'cost' || metric === 'cpc' || metric === 'cpl') {
      return `${value.toLocaleString('ru-RU')} ₽`;
    }
    if (metric === 'ctr' || metric === 'cr' || metric === 'bounceRate') {
      return `${value.toFixed(2)}%`;
    }
    return value.toLocaleString('ru-RU');
  };

  const chartData = data.map((item) => ({
    ...item,
    dateFormatted: formatDate(item.date),
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {isOpen ? (
          <ChevronUp size={20} className="text-gray-400" />
        ) : (
          <ChevronDown size={20} className="text-gray-400" />
        )}
      </div>

      {isOpen && (
        <div className="px-6 pb-6">
          {/* Metric toggles */}
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

          {/* Chart */}
          {chartData.length > 0 ? (
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
                    formatter={(value: number, name: string) => {
                      const metric = CHART_METRICS.find((m) => m.value === name);
                      return [formatValue(value, name), metric?.label || name];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const metric = CHART_METRICS.find((m) => m.value === value);
                      return metric?.label || value;
                    }}
                  />
                  {CHART_METRICS.filter((m) => selectedMetrics.has(m.value)).map((metric) => (
                    <Line
                      key={metric.value}
                      yAxisId={
                        metric.value === 'ctr' || metric.value === 'cr'
                          ? 'right'
                          : 'left'
                      }
                      type="monotone"
                      dataKey={metric.value}
                      stroke={metric.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              Нет данных для отображения
            </div>
          )}
        </div>
      )}
    </div>
  );
}
