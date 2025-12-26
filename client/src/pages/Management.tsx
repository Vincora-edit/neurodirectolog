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
  PanelRightClose,
  PanelRight,
  Gauge,
} from 'lucide-react';
import { api } from '../services/api';
import { DATE_RANGES } from '../constants';

interface ProjectData {
  id: string;
  name: string;
  accounts: string[];
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
  projects: ProjectData[];
}

type SortColumn = 'name' | 'impressions' | 'clicks' | 'cost' | 'conversions' | 'cpl';
type SortDirection = 'asc' | 'desc';

export default function Management() {
  const [days, setDays] = useState(30);
  const [sortColumn, setSortColumn] = useState<SortColumn>('cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showKpiPanel, setShowKpiPanel] = useState(true);

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

  const getSortValue = (project: ProjectData, column: SortColumn): number | string => {
    switch (column) {
      case 'name': return project.name.toLowerCase();
      case 'impressions': return project.stats.impressions;
      case 'clicks': return project.stats.clicks;
      case 'cost': return project.stats.cost;
      case 'conversions': return project.stats.conversions;
      case 'cpl': return project.stats.cpl;
      default: return 0;
    }
  };

  const sortedProjects = data?.projects
    ? [...data.projects].sort((a, b) => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  // Итоги по всем проектам
  const totals = sortedProjects.reduce(
    (acc, p) => ({
      impressions: acc.impressions + p.stats.impressions,
      clicks: acc.clicks + p.stats.clicks,
      cost: acc.cost + p.stats.cost,
      conversions: acc.conversions + p.stats.conversions,
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
          <p className="text-gray-500 mt-1">Сводка по всем проектам</p>
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

          <button
            onClick={() => setShowKpiPanel(!showKpiPanel)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showKpiPanel
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={showKpiPanel ? 'Скрыть KPI' : 'Показать KPI'}
          >
            {showKpiPanel ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
            KPI
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
              <p className="text-sm text-gray-500">Проектов</p>
              <p className="text-xl font-bold text-gray-900">{sortedProjects.length}</p>
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

      {/* Main content: Table + KPI Panel */}
      <div className="flex gap-6">
        {/* Main table */}
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all ${
          showKpiPanel ? 'flex-1' : 'w-full'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortHeader column="name" label="Проект" align="left" />
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Аккаунт</th>
                <SortHeader column="impressions" label="Показы" />
                <SortHeader column="clicks" label="Клики" />
                <SortHeader column="cost" label="Расход" />
                <SortHeader column="conversions" label="Лиды" />
                <SortHeader column="cpl" label="CPL" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedProjects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <span className="font-medium text-gray-900">{project.name}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {project.accounts.map((acc, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                          {acc}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-900">
                    {formatNumber(project.stats.impressions)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-900">
                    {formatNumber(project.stats.clicks)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(project.stats.cost)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900">
                    {formatNumber(project.stats.conversions)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900">
                    {project.stats.cpl > 0 ? formatCurrency(project.stats.cpl) : '—'}
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              {sortedProjects.length > 0 && (
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td className="px-3 py-3 text-gray-900">ИТОГО</td>
                  <td className="px-3 py-3 text-gray-500 text-sm">{sortedProjects.length} проектов</td>
                  <td className="px-3 py-3 text-right text-gray-900">{formatNumber(totals.impressions)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{formatNumber(totals.clicks)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{formatCurrency(totals.cost)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{formatNumber(totals.conversions)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{totalCpl > 0 ? formatCurrency(totalCpl) : '—'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

          {sortedProjects.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <LayoutGrid size={48} className="mx-auto mb-3 text-gray-300" />
              <p>Нет проектов с подключениями Yandex.Direct</p>
            </div>
          )}
        </div>

        {/* KPI Panel */}
        {showKpiPanel && (
          <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-shrink-0">
            <div className="px-4 py-3 bg-purple-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Gauge size={18} className="text-purple-600" />
                <h3 className="font-semibold text-gray-900">KPI текущего месяца</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {sortedProjects.filter(p => p.kpi).map((project) => (
                <div key={project.id} className="p-3 hover:bg-gray-50">
                  <div className="font-medium text-gray-900 text-sm mb-2 truncate" title={project.name}>
                    {project.name}
                  </div>

                  {/* День месяца прогресс */}
                  <div className="text-xs text-gray-500 mb-2">
                    День: {project.kpi!.dayProgress}% месяца
                  </div>

                  {/* Расход */}
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Расход:</span>
                    <div className="text-right">
                      <span className={`font-medium ${
                        project.kpi!.costProgress > project.kpi!.dayProgress + 10
                          ? 'text-red-600'
                          : project.kpi!.costProgress >= project.kpi!.dayProgress - 5
                          ? 'text-green-600'
                          : 'text-gray-900'
                      }`}>
                        {project.kpi!.costProgress}%
                      </span>
                      <span className="text-gray-400 text-xs ml-1">
                        / {formatCurrency(project.kpi!.targetCost)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                    <div
                      className={`h-1.5 rounded-full ${
                        project.kpi!.costProgress > project.kpi!.dayProgress + 10
                          ? 'bg-red-500'
                          : project.kpi!.costProgress >= project.kpi!.dayProgress - 5
                          ? 'bg-green-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(project.kpi!.costProgress, 100)}%` }}
                    />
                  </div>

                  {/* Лиды */}
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Лиды:</span>
                    <div className="text-right">
                      <span className={`font-medium ${
                        project.kpi!.leadsProgress >= project.kpi!.dayProgress
                          ? 'text-green-600'
                          : project.kpi!.leadsProgress < project.kpi!.dayProgress - 10
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}>
                        {project.kpi!.leadsProgress}%
                      </span>
                      <span className="text-gray-400 text-xs ml-1">
                        / {project.kpi!.targetLeads}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                    <div
                      className={`h-1.5 rounded-full ${
                        project.kpi!.leadsProgress >= project.kpi!.dayProgress
                          ? 'bg-green-500'
                          : project.kpi!.leadsProgress < project.kpi!.dayProgress - 10
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(project.kpi!.leadsProgress, 100)}%` }}
                    />
                  </div>

                  {/* CPL */}
                  {project.kpi!.targetCpl > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">CPL:</span>
                      <div className="text-right">
                        <span className={`font-medium ${
                          project.stats.cpl > project.kpi!.targetCpl * 1.1
                            ? 'text-red-600'
                            : project.stats.cpl <= project.kpi!.targetCpl
                            ? 'text-green-600'
                            : 'text-amber-600'
                        }`}>
                          {formatCurrency(project.stats.cpl)}
                        </span>
                        <span className="text-gray-400 text-xs ml-1">
                          / {formatCurrency(project.kpi!.targetCpl)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {sortedProjects.filter(p => p.kpi).length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  <Gauge size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Нет проектов с KPI</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
