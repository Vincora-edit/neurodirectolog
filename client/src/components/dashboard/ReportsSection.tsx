import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Users,
  FileText,
  Search,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  DollarSign,
  Tag,
  Type,
  Target,
  Layout,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { API_BASE_URL } from '../../services/api';

interface ReportsSectionProps {
  activeProjectId: string;
  activeConnectionId: string;
  dateRange: number;
  globalFilterCampaignId: string | null;
}

// Табы отчётов
const audienceTabs = [
  { id: 'search', label: 'Поисковые запросы', icon: Search },
  { id: 'demographics', label: 'Пол / Возраст', icon: Users },
  { id: 'devices', label: 'Устройства', icon: Smartphone },
  { id: 'income', label: 'Платежеспособность', icon: DollarSign },
  { id: 'region', label: 'Регион', icon: MapPin },
];

const technicalTabs = [
  { id: 'categories', label: 'Категории таргетинга', icon: Tag },
  { id: 'titles', label: 'Заголовок', icon: FileText },
  { id: 'text', label: 'Текст', icon: Type },
  { id: 'criteria', label: 'Условия показа', icon: Target },
  { id: 'placements', label: 'Площадки', icon: Layout },
];

// Компонент заголовка с сортировкой
function SortableHeader({
  column,
  label,
  align = 'right',
  sortColumn,
  sortDirection,
  onSort,
}: {
  column: string;
  label: string;
  align?: 'left' | 'right';
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
}) {
  const isActive = sortColumn === column;
  const SortIcon = sortDirection === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      className={`px-4 py-3 text-${align} text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none transition-colors`}
      onClick={() => onSort(column)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        <span>{label}</span>
        {isActive ? (
          <SortIcon size={14} className="text-blue-600" />
        ) : (
          <div className="w-3.5 h-3.5 opacity-0 group-hover:opacity-30">
            <ArrowDown size={14} className="text-gray-400" />
          </div>
        )}
      </div>
    </th>
  );
}

export function ReportsSection({
  activeProjectId,
  activeConnectionId,
  dateRange,
  globalFilterCampaignId,
}: ReportsSectionProps) {
  const [openReportSections, setOpenReportSections] = useState(new Set(['audience']));
  const [audienceReportTab, setAudienceReportTab] = useState('search');
  const [technicalReportTab, setTechnicalReportTab] = useState('categories');
  const [sortColumn, setSortColumn] = useState<string>('cost');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Отчёты - загружаем только когда выбран соответствующий таб
  const { data: searchQueriesData, isLoading: searchQueriesLoading } = useQuery({
    queryKey: ['yandex-search-queries', activeProjectId, activeConnectionId, dateRange, globalFilterCampaignId],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/yandex/search-queries/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`;
      if (globalFilterCampaignId) url += `&campaignId=${globalFilterCampaignId}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId && audienceReportTab === 'search',
    staleTime: 5 * 60 * 1000,
  });

  const { data: deviceStatsData, isLoading: deviceStatsLoading } = useQuery({
    queryKey: ['yandex-device-stats', activeProjectId, activeConnectionId, dateRange, globalFilterCampaignId],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/yandex/device-stats/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`;
      if (globalFilterCampaignId) url += `&campaignId=${globalFilterCampaignId}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId && audienceReportTab === 'devices',
    staleTime: 5 * 60 * 1000,
  });

  const { data: geoStatsData, isLoading: geoStatsLoading } = useQuery({
    queryKey: ['yandex-geo-stats', activeProjectId, activeConnectionId, dateRange, globalFilterCampaignId],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/yandex/geo-report/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`;
      if (globalFilterCampaignId) url += `&campaignId=${globalFilterCampaignId}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId && audienceReportTab === 'region',
    staleTime: 5 * 60 * 1000,
  });

  const { data: demographicsData, isLoading: demographicsLoading } = useQuery({
    queryKey: ['yandex-demographics', activeProjectId, activeConnectionId, dateRange, globalFilterCampaignId],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/yandex/demographics/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`;
      if (globalFilterCampaignId) url += `&campaignId=${globalFilterCampaignId}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId && audienceReportTab === 'demographics',
    staleTime: 5 * 60 * 1000,
  });

  const { data: incomeData, isLoading: incomeLoading } = useQuery({
    queryKey: ['yandex-income', activeProjectId, activeConnectionId, dateRange, globalFilterCampaignId],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/yandex/income/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`;
      if (globalFilterCampaignId) url += `&campaignId=${globalFilterCampaignId}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId && audienceReportTab === 'income',
    staleTime: 5 * 60 * 1000,
  });

  const { data: targetingCategoriesData, isLoading: targetingCategoriesLoading } = useQuery({
    queryKey: ['yandex-targeting-categories', activeProjectId, activeConnectionId, dateRange, globalFilterCampaignId],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/yandex/targeting-categories/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`;
      if (globalFilterCampaignId) url += `&campaignId=${globalFilterCampaignId}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId && technicalReportTab === 'categories',
    staleTime: 5 * 60 * 1000,
  });

  const { data: criteriaData, isLoading: criteriaLoading } = useQuery({
    queryKey: ['yandex-criteria', activeProjectId, activeConnectionId, dateRange, globalFilterCampaignId],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/yandex/criteria/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`;
      if (globalFilterCampaignId) url += `&campaignId=${globalFilterCampaignId}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId && technicalReportTab === 'criteria',
    staleTime: 5 * 60 * 1000,
  });

  const { data: placementsData, isLoading: placementsLoading } = useQuery({
    queryKey: ['yandex-placements', activeProjectId, activeConnectionId, dateRange, globalFilterCampaignId],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/yandex/placements/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`;
      if (globalFilterCampaignId) url += `&campaignId=${globalFilterCampaignId}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId && technicalReportTab === 'placements',
    staleTime: 5 * 60 * 1000,
  });

  const { data: adTextsData, isLoading: adTextsLoading } = useQuery({
    queryKey: ['yandex-ad-texts', activeProjectId, activeConnectionId, dateRange, globalFilterCampaignId],
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/yandex/ad-texts/${activeProjectId}?days=${dateRange}&connectionId=${activeConnectionId}`;
      if (globalFilterCampaignId) url += `&campaignId=${globalFilterCampaignId}`;
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!activeProjectId && !!activeConnectionId && (technicalReportTab === 'titles' || technicalReportTab === 'text'),
    staleTime: 5 * 60 * 1000,
  });

  const toggleReportSection = (section: string) => {
    setOpenReportSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleSortClick = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getReportData = (reportId: string) => {
    switch (reportId) {
      case 'search':
        return {
          columnName: 'Поисковый запрос',
          data: Array.isArray(searchQueriesData)
            ? searchQueriesData.map((item: any) => ({
                name: item.query,
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10)
            : [],
        };
      case 'demographics':
        return {
          columnName: 'Сегмент',
          data: Array.isArray(demographicsData)
            ? demographicsData.map((item: any) => ({
                name: item.segment,
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10)
            : [],
        };
      case 'devices':
        return {
          columnName: 'Устройство',
          data: Array.isArray(deviceStatsData)
            ? deviceStatsData.map((device: any) => ({
                name: device.deviceName,
                icon: device.device === 'DESKTOP' ? Monitor : device.device === 'MOBILE' ? Smartphone : Tablet,
                clicks: device.clicks,
                cost: device.cost,
                impressions: device.impressions || 0,
                conversions: device.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost)
            : [],
        };
      case 'region':
        return {
          columnName: 'Регион',
          data: Array.isArray(geoStatsData)
            ? geoStatsData.map((item: any) => ({
                name: item.region,
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 10)
            : [],
        };
      case 'income':
        return {
          columnName: 'Платежеспособность',
          data: Array.isArray(incomeData)
            ? incomeData.map((item: any) => ({
                name: item.incomeGrade || item.incomeGradeRaw,
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost)
            : [],
        };
      case 'categories':
        return {
          columnName: 'Категория таргетинга',
          data: Array.isArray(targetingCategoriesData)
            ? targetingCategoriesData.map((item: any) => ({
                name: item.category || item.categoryRaw,
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost)
            : [],
        };
      case 'criteria':
        return {
          columnName: 'Условие показа',
          data: Array.isArray(criteriaData)
            ? criteriaData.map((item: any) => ({
                name: item.criterion || 'Неизвестно',
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 15)
            : [],
        };
      case 'placements':
        return {
          columnName: 'Площадка',
          data: Array.isArray(placementsData)
            ? placementsData.map((item: any) => ({
                name: item.placement,
                placementType: item.placementType || 'РСЯ',
                impressions: item.impressions || 0,
                clicks: item.clicks || 0,
                cost: item.cost || 0,
                conversions: item.conversions || 0,
              })).sort((a: any, b: any) => b.cost - a.cost).slice(0, 15)
            : [],
        };
      case 'titles':
      case 'text':
        if (!Array.isArray(adTextsData)) {
          return { columnName: reportId === 'titles' ? 'Заголовок' : 'Текст объявления', data: [] };
        }
        const consolidatedMap = new Map<string, { name: string; impressions: number; clicks: number; cost: number; conversions: number }>();
        adTextsData.forEach((item: any) => {
          const key = reportId === 'titles'
            ? (item.title || `Объявление ${item.adId}`)
            : (item.text || item.fullText || `Объявление ${item.adId}`);
          const existing = consolidatedMap.get(key);
          if (existing) {
            existing.impressions += item.impressions || 0;
            existing.clicks += item.clicks || 0;
            existing.cost += item.cost || 0;
            existing.conversions += item.conversions || 0;
          } else {
            consolidatedMap.set(key, {
              name: key,
              impressions: item.impressions || 0,
              clicks: item.clicks || 0,
              cost: item.cost || 0,
              conversions: item.conversions || 0,
            });
          }
        });
        return {
          columnName: reportId === 'titles' ? 'Заголовок' : 'Текст объявления',
          data: Array.from(consolidatedMap.values()).sort((a, b) => b.cost - a.cost),
        };
      default:
        return { columnName: 'Название', data: [] };
    }
  };

  const renderReportTable = (reportId: string) => {
    const report = getReportData(reportId);
    const isPlacementsReport = reportId === 'placements';

    const isLoading =
      (reportId === 'search' && searchQueriesLoading) ||
      (reportId === 'devices' && deviceStatsLoading) ||
      (reportId === 'region' && geoStatsLoading) ||
      (reportId === 'demographics' && demographicsLoading) ||
      (reportId === 'income' && incomeLoading) ||
      (reportId === 'categories' && targetingCategoriesLoading) ||
      (reportId === 'criteria' && criteriaLoading) ||
      (reportId === 'placements' && placementsLoading) ||
      ((reportId === 'titles' || reportId === 'text') && adTextsLoading);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            <span>Загрузка отчёта...</span>
          </div>
        </div>
      );
    }

    // Сортируем данные
    const sortedData = [...report.data].sort((a: any, b: any) => {
      let aValue: number;
      let bValue: number;

      switch (sortColumn) {
        case 'name':
          const aName = (a.name || '').toString().toLowerCase();
          const bName = (b.name || '').toString().toLowerCase();
          return sortDirection === 'asc'
            ? aName.localeCompare(bName, 'ru')
            : bName.localeCompare(aName, 'ru');
        case 'impressions':
          aValue = a.impressions || 0;
          bValue = b.impressions || 0;
          break;
        case 'clicks':
          aValue = a.clicks || 0;
          bValue = b.clicks || 0;
          break;
        case 'ctr':
          aValue = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0;
          bValue = b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0;
          break;
        case 'cost':
          aValue = a.cost || 0;
          bValue = b.cost || 0;
          break;
        case 'cpc':
          aValue = a.clicks > 0 ? a.cost / a.clicks : 0;
          bValue = b.clicks > 0 ? b.cost / b.clicks : 0;
          break;
        case 'conversions':
          aValue = a.conversions || 0;
          bValue = b.conversions || 0;
          break;
        case 'cpl':
          aValue = a.conversions > 0 ? a.cost / a.conversions : Infinity;
          bValue = b.conversions > 0 ? b.cost / b.conversions : Infinity;
          break;
        default:
          aValue = a.cost || 0;
          bValue = b.cost || 0;
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader
                column="name"
                label={report.columnName}
                align="left"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSortClick}
              />
              {isPlacementsReport && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
              )}
              <SortableHeader column="impressions" label="Показы" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSortClick} />
              <SortableHeader column="clicks" label="Клики" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSortClick} />
              <SortableHeader column="ctr" label="CTR" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSortClick} />
              <SortableHeader column="cost" label="Расход" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSortClick} />
              <SortableHeader column="cpc" label="CPC" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSortClick} />
              <SortableHeader column="conversions" label="Конв." sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSortClick} />
              <SortableHeader column="cpl" label="CPL" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSortClick} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedData.length > 0 ? (
              sortedData.map((item: any, idx: number) => {
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
                        <span className="truncate block max-w-[300px]" title={item.name}>
                          {item.name}
                        </span>
                      )}
                    </td>
                    {isPlacementsReport && (
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        <span className="px-2 py-0.5 bg-gray-100 rounded">{item.placementType || 'РСЯ'}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-gray-500">
                      {(item.impressions || 0).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {Math.round(item.clicks).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {Math.round(item.cost).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{cpc > 0 ? `${cpc.toFixed(0)} ₽` : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.conversions || 0}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {cpl > 0 ? `${Math.round(cpl).toLocaleString('ru-RU')} ₽` : '—'}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={isPlacementsReport ? 9 : 8} className="px-4 py-8 text-center text-gray-500">
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center gap-3">
        <BarChart3 size={22} className="text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">Отчёты</h2>
      </div>

      {/* Показатели аудитории */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleReportSection('audience')}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users size={20} className="text-blue-600" />
            <span className="font-semibold text-gray-900">Показатели аудитории</span>
          </div>
          {openReportSections.has('audience') ? (
            <ChevronUp size={20} className="text-gray-400" />
          ) : (
            <ChevronDown size={20} className="text-gray-400" />
          )}
        </button>
        {openReportSections.has('audience') && (
          <div className="border-t border-gray-200">
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
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            {renderReportTable(audienceReportTab)}
          </div>
        )}
      </div>

      {/* Технические показатели */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleReportSection('technical')}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-blue-600" />
            <span className="font-semibold text-gray-900">Технические показатели</span>
          </div>
          {openReportSections.has('technical') ? (
            <ChevronUp size={20} className="text-gray-400" />
          ) : (
            <ChevronDown size={20} className="text-gray-400" />
          )}
        </button>
        {openReportSections.has('technical') && (
          <div className="border-t border-gray-200">
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
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            {renderReportTable(technicalReportTab)}
          </div>
        )}
      </div>
    </div>
  );
}
