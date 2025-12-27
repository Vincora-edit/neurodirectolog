import { useState } from 'react';
import { ChevronDown, ChevronUp, Table } from 'lucide-react';
import { getCurrencySymbol } from '../../utils/formatters';

interface DailyStat {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

interface DailyStatsTableProps {
  data: DailyStat[];
  currency?: string;
  defaultOpen?: boolean;
}

export function DailyStatsTable({ data, currency = 'RUB', defaultOpen = true }: DailyStatsTableProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const formatNumber = (value: number) => value.toLocaleString('ru-RU');
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;
  const formatCurrency = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ${currencySymbol}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Table size={20} className="text-purple-600" />
          <span className="font-semibold text-gray-900">Статистика по дням</span>
          <span className="text-xs text-gray-400">{data.length} дней</span>
        </div>
        {isOpen ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Показы</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Клики</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Расход</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPC</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Конверсии</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...data].reverse().map((day) => {
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
                    <td className="px-4 py-3 text-right text-gray-900">{formatNumber(day.impressions)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatNumber(day.clicks)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${
                        (day.ctr || 0) >= 5 ? 'text-green-600' :
                        (day.ctr || 0) >= 3 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {formatPercent(day.ctr || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(day.cost)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{(day.cpc || 0).toFixed(2)} {currencySymbol}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${(day.conversions || 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
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
  );
}
