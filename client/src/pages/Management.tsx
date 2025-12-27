import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutGrid,
  TrendingUp,
  Target,
  DollarSign,
  Users,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { DATE_RANGES } from '../constants';

interface AccountData {
  id: string;
  projectId: string;
  projectName: string;
  accountLogin: string;
  stats: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    cpl: number;
  };
  kpi: {
    targetCost: number;
    targetLeads: number;
    targetCpl: number;
    currentCost: number;
    currentLeads: number;
    costProgress: number;
    leadsProgress: number;
    dayProgress: number;
  } | null;
}

interface ManagementResponse {
  period: number;
  accounts: AccountData[];
}

type SortColumn = 'projectName' | 'accountLogin' | 'impressions' | 'clicks' | 'cost' | 'conversions' | 'cpl' | 'kpiCost' | 'kpiLeads';
type SortDirection = 'asc' | 'desc';

export default function Management() {
  const [days, setDays] = useState(30);
  const [sortColumn, setSortColumn] = useState<SortColumn>('cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { data, isLoading, refetch, isFetching } = useQuery<ManagementResponse>({
    queryKey: ['management', days],
    queryFn: () => api.get(`/admin/management?days=${days}`).then((res: { data: ManagementResponse }) => res.data),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortValue = (account: AccountData, column: SortColumn): number | string => {
    switch (column) {
      case 'projectName': return account.projectName.toLowerCase();
      case 'accountLogin': return account.accountLogin.toLowerCase();
      case 'impressions': return account.stats.impressions;
      case 'clicks': return account.stats.clicks;
      case 'cost': return account.stats.cost;
      case 'conversions': return account.stats.conversions;
      case 'cpl': return account.stats.cpl;
      case 'kpiCost': return account.kpi?.costProgress ?? -1;
      case 'kpiLeads': return account.kpi?.leadsProgress ?? -1;
      default: return 0;
    }
  };

  const sortedAccounts = data?.accounts
    ? [...data.accounts].sort((a, b) => {
        const aVal = getSortValue(a, sortColumn);
        const bVal = getSortValue(b, sortColumn);
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
        }
        return sortDirection === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
      })
    : [];

  // Компонент заголовка с сортировкой
  const SortHeader = ({ column, label, align = 'right' }: { column: SortColumn; label: string; align?: 'left' | 'right' }) => (
    <th
      className={`px-3 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none ${
        align === 'left' ? 'text-left' : 'text-right'
      }`}
      onClick={() => handleSort(column)}
    >
      <div className={`flex items-center gap-1 ${align === 'left' ? 'justify-start' : 'justify-end'}`}>
        {label}
        {sortColumn === column ? (
          sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
        ) : (
          <ArrowUpDown size={14} className="opacity-30" />
        )}
      </div>
    </th>
  );

  // Функция для определения цвета прогресса
  const getProgressColor = (progress: number, dayProgress: number, isLeads: boolean) => {
    if (isLeads) {
      // Для лидов: чем больше - тем лучше
      if (progress >= dayProgress) return 'text-green-600';
      if (progress < dayProgress - 10) return 'text-red-600';
      return 'text-amber-600';
    } else {
      // Для расхода: перерасход - плохо
      if (progress > dayProgress + 10) return 'text-red-600';
      if (progress >= dayProgress - 5) return 'text-green-600';
      return 'text-amber-600';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  // Итоги по всем аккаунтам
  const totals = sortedAccounts.reduce(
    (acc, a) => ({
      impressions: acc.impressions + a.stats.impressions,
      clicks: acc.clicks + a.stats.clicks,
      cost: acc.cost + a.stats.cost,
      conversions: acc.conversions + a.stats.conversions,
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
  );

  const totalCpl = totals.conversions > 0 ? totals.cost / totals.conversions : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <LayoutGrid className="text-blue-600" />
            Управленческая таблица
          </h1>
          <p className="text-gray-500 mt-1">Сводка по всем аккаунтам</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {DATE_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setDays(range.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  days === range.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Аккаунтов</p>
              <p className="text-xl font-bold text-gray-900">{sortedAccounts.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <DollarSign size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Общий расход</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.cost)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Всего лидов</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(totals.conversions)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Средний CPL</p>
              <p className="text-xl font-bold text-gray-900">
                {totalCpl > 0 ? formatCurrency(totalCpl) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortHeader column="projectName" label="Проект" align="left" />
                <SortHeader column="accountLogin" label="Аккаунт" align="left" />
                <SortHeader column="impressions" label="Показы" />
                <SortHeader column="clicks" label="Клики" />
                <SortHeader column="cost" label="Расход" />
                <SortHeader column="conversions" label="Лиды" />
                <SortHeader column="cpl" label="CPL" />
                <SortHeader column="kpiCost" label="KPI ₽" />
                <SortHeader column="kpiLeads" label="KPI лиды" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <span className="font-medium text-gray-900">{account.projectName}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                      {account.accountLogin}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-900">
                    {formatNumber(account.stats.impressions)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-900">
                    {formatNumber(account.stats.clicks)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(account.stats.cost)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900">
                    {formatNumber(account.stats.conversions)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900">
                    {account.stats.cpl > 0 ? formatCurrency(account.stats.cpl) : '—'}
                  </td>
                  {/* KPI Расход */}
                  <td className="px-3 py-3 text-right">
                    {account.kpi ? (
                      <span className={`font-medium ${getProgressColor(account.kpi.costProgress, account.kpi.dayProgress, false)}`}>
                        {account.kpi.costProgress}%
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {/* KPI Лиды */}
                  <td className="px-3 py-3 text-right">
                    {account.kpi ? (
                      <span className={`font-medium ${getProgressColor(account.kpi.leadsProgress, account.kpi.dayProgress, true)}`}>
                        {account.kpi.leadsProgress}%
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              {sortedAccounts.length > 0 && (
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td className="px-3 py-3 text-gray-900">ИТОГО</td>
                  <td className="px-3 py-3 text-gray-500 text-sm">{sortedAccounts.length} аккаунтов</td>
                  <td className="px-3 py-3 text-right text-gray-900">{formatNumber(totals.impressions)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{formatNumber(totals.clicks)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{formatCurrency(totals.cost)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{formatNumber(totals.conversions)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{totalCpl > 0 ? formatCurrency(totalCpl) : '—'}</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {sortedAccounts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <LayoutGrid size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Нет аккаунтов с подключениями Yandex.Direct</p>
          </div>
        )}
      </div>
    </div>
  );
}
