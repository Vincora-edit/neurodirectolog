import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowUpDown,
  Filter,
} from 'lucide-react';

interface Ad {
  adId: string;
  adTitle?: string;
  totalImpressions: number;
  totalClicks: number;
  totalCost: number;
  totalConversions: number;
  avgCpc: number;
  avgCtr: number;
  avgBounceRate?: number;
}

interface AdGroup {
  adGroupId: string;
  adGroupName: string;
  totalImpressions: number;
  totalClicks: number;
  totalCost: number;
  totalConversions: number;
  avgCpc: number;
  avgCtr: number;
  avgBounceRate?: number;
  ads?: Ad[];
}

interface Campaign {
  campaignId: string;
  campaignName: string;
  totalImpressions: number;
  totalClicks: number;
  totalCost: number;
  totalConversions: number;
  avgCpc: number;
  avgCtr: number;
  avgBounceRate?: number;
  adGroups?: AdGroup[];
}

type SortColumn =
  | 'totalImpressions'
  | 'totalClicks'
  | 'totalCost'
  | 'avgCpc'
  | 'avgCtr'
  | 'avgBounceRate'
  | 'totalConversions'
  | 'cr'
  | 'cpl';

type SortDirection = 'asc' | 'desc';

interface CampaignsTableProps {
  campaigns: Campaign[];
  globalFilterCampaignId: string | null;
  globalFilterAdGroupId: string | null;
  globalFilterAdId?: string | null;
  onCampaignFilterChange: (campaignId: string | null) => void;
  onAdGroupFilterChange: (adGroupId: string | null, campaignId?: string) => void;
  onAdFilterChange?: (adId: string | null, adGroupId?: string, campaignId?: string) => void;
}

export function CampaignsTable({
  campaigns,
  globalFilterCampaignId,
  globalFilterAdGroupId,
  globalFilterAdId,
  onCampaignFilterChange,
  onAdGroupFilterChange,
  onAdFilterChange,
}: CampaignsTableProps) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdGroups, setExpandedAdGroups] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('totalCost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  const toggleAdGroup = (adGroupId: string) => {
    setExpandedAdGroups((prev) => {
      const next = new Set(prev);
      if (next.has(adGroupId)) {
        next.delete(adGroupId);
      } else {
        next.add(adGroupId);
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
      case 'totalImpressions':
        return item.totalImpressions || 0;
      case 'totalClicks':
        return item.totalClicks || 0;
      case 'totalCost':
        return item.totalCost || 0;
      case 'avgCpc':
        return item.avgCpc || 0;
      case 'avgCtr':
        return item.avgCtr || 0;
      case 'avgBounceRate':
        return item.avgBounceRate || 0;
      case 'totalConversions':
        return item.totalConversions || 0;
      case 'cr':
        return item.totalClicks > 0
          ? ((item.totalConversions || 0) / item.totalClicks) * 100
          : 0;
      case 'cpl':
        return item.totalConversions > 0
          ? (item.totalCost || 0) / item.totalConversions
          : 0;
      default:
        return 0;
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aVal = getSortValue(a, sortColumn);
    const bVal = getSortValue(b, sortColumn);
    return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const SortHeader = ({
    column,
    label,
  }: {
    column: SortColumn;
    label: string;
  }) => (
    <th
      className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        {sortColumn === column ? (
          sortDirection === 'desc' ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronUp size={14} />
          )
        ) : (
          <ArrowUpDown size={14} className="opacity-30" />
        )}
      </div>
    </th>
  );

  // Вычисляем итоги
  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + (c.totalImpressions || 0),
      clicks: acc.clicks + (c.totalClicks || 0),
      cost: acc.cost + (c.totalCost || 0),
      conversions: acc.conversions + (c.totalConversions || 0),
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
  );

  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const totalCpc = totals.clicks > 0 ? totals.cost / totals.clicks : 0;
  const totalCr = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
  const totalCpl = totals.conversions > 0 ? totals.cost / totals.conversions : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Кампании</h2>
        <p className="text-sm text-gray-500 mt-1">
          Нажмите на строку для раскрытия групп и объявлений
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Название
              </th>
              <SortHeader column="totalImpressions" label="Показы" />
              <SortHeader column="totalClicks" label="Клики" />
              <SortHeader column="totalCost" label="Расход" />
              <SortHeader column="avgCpc" label="CPC" />
              <SortHeader column="avgCtr" label="CTR" />
              <SortHeader column="avgBounceRate" label="Отказы" />
              <SortHeader column="totalConversions" label="Конверсии" />
              <SortHeader column="cr" label="CR %" />
              <SortHeader column="cpl" label="CPL" />
            </tr>
          </thead>
          <tbody className="bg-white">
            {sortedCampaigns.map((campaign) => {
              const campaignId = campaign.campaignId;
              const isExpanded = expandedCampaigns.has(campaignId);
              const adGroups = campaign.adGroups || [];
              const ctr = campaign.avgCtr || 0;
              const campaignCr =
                campaign.totalClicks > 0
                  ? (campaign.totalConversions / campaign.totalClicks) * 100
                  : 0;
              const campaignCpl =
                campaign.totalConversions > 0
                  ? campaign.totalCost / campaign.totalConversions
                  : 0;

              return (
                <React.Fragment key={campaignId}>
                  {/* Campaign row */}
                  <tr
                    className="hover:bg-blue-50 transition-colors cursor-pointer border-b border-gray-200"
                    onClick={() => toggleCampaign(campaignId)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {adGroups.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown size={18} className="text-gray-500" />
                          ) : (
                            <ChevronRight size={18} className="text-gray-500" />
                          )
                        ) : (
                          <span className="w-[18px]" />
                        )}
                        <span className="text-sm font-semibold text-gray-900">
                          {campaign.campaignName || campaignId}
                        </span>
                        {adGroups.length > 0 && (
                          <span className="text-xs text-gray-400">
                            ({adGroups.length} групп)
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              globalFilterCampaignId === campaignId &&
                              !globalFilterAdGroupId
                            ) {
                              onCampaignFilterChange(null);
                            } else {
                              onCampaignFilterChange(campaignId);
                            }
                          }}
                          className={`p-1 rounded transition-colors ${
                            globalFilterCampaignId === campaignId && !globalFilterAdGroupId
                              ? 'bg-blue-100 text-blue-600'
                              : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title={
                            globalFilterCampaignId === campaignId
                              ? 'Убрать фильтр'
                              : 'Фильтровать по этой кампании'
                          }
                        >
                          <Filter size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {(campaign.totalImpressions || 0).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {(campaign.totalClicks || 0).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                      {(campaign.totalCost || 0).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {(campaign.avgCpc || 0).toFixed(2)} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span
                        className={`text-sm font-medium ${
                          ctr >= 5
                            ? 'text-green-600'
                            : ctr >= 3
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {ctr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {typeof campaign.avgBounceRate === 'number'
                        ? `${campaign.avgBounceRate.toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span
                        className={`text-sm font-medium ${
                          (campaign.totalConversions || 0) > 0
                            ? 'text-green-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {(campaign.totalConversions || 0).toLocaleString('ru-RU')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span
                        className={`text-sm font-medium ${
                          campaignCr >= 10
                            ? 'text-green-600'
                            : campaignCr >= 5
                            ? 'text-yellow-600'
                            : 'text-gray-600'
                        }`}
                      >
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

                  {/* Ad Groups */}
                  {isExpanded &&
                    adGroups.map((adGroup) => {
                      const adGroupKey = `${campaignId}-${adGroup.adGroupId}`;
                      const isAdGroupExpanded = expandedAdGroups.has(adGroupKey);
                      const ads = adGroup.ads || [];
                      const adGroupCtr = adGroup.avgCtr || 0;
                      const adGroupCr =
                        adGroup.totalClicks > 0
                          ? (adGroup.totalConversions / adGroup.totalClicks) * 100
                          : 0;
                      const adGroupCpl =
                        adGroup.totalConversions > 0
                          ? adGroup.totalCost / adGroup.totalConversions
                          : 0;

                      return (
                        <React.Fragment key={adGroupKey}>
                          <tr
                            className="hover:bg-green-50 transition-colors cursor-pointer bg-gray-50 border-b border-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAdGroup(adGroupKey);
                            }}
                          >
                            <td className="px-6 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2 pl-6">
                                {ads.length > 0 ? (
                                  isAdGroupExpanded ? (
                                    <ChevronDown size={16} className="text-gray-400" />
                                  ) : (
                                    <ChevronRight size={16} className="text-gray-400" />
                                  )
                                ) : (
                                  <span className="w-[16px]" />
                                )}
                                <span className="text-sm font-medium text-gray-700">
                                  {adGroup.adGroupName || adGroup.adGroupId}
                                </span>
                                {ads.length > 0 && (
                                  <span className="text-xs text-gray-400">
                                    ({ads.length} объявл.)
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (globalFilterAdGroupId === adGroup.adGroupId) {
                                      onAdGroupFilterChange(null);
                                    } else {
                                      onAdGroupFilterChange(adGroup.adGroupId, campaignId);
                                    }
                                  }}
                                  className={`p-1 rounded transition-colors ${
                                    globalFilterAdGroupId === adGroup.adGroupId
                                      ? 'bg-purple-100 text-purple-600'
                                      : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                                  }`}
                                  title={
                                    globalFilterAdGroupId === adGroup.adGroupId
                                      ? 'Убрать фильтр'
                                      : 'Фильтровать по этой группе'
                                  }
                                >
                                  <Filter size={12} />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {(adGroup.totalImpressions || 0).toLocaleString('ru-RU')}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {(adGroup.totalClicks || 0).toLocaleString('ru-RU')}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-700">
                              {(adGroup.totalCost || 0).toLocaleString('ru-RU')} ₽
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {(adGroup.avgCpc || 0).toFixed(2)} ₽
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right">
                              <span
                                className={`text-sm ${
                                  adGroupCtr >= 5
                                    ? 'text-green-600'
                                    : adGroupCtr >= 3
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {adGroupCtr.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {typeof adGroup.avgBounceRate === 'number'
                                ? `${adGroup.avgBounceRate.toFixed(2)}%`
                                : '—'}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {(adGroup.totalConversions || 0).toLocaleString('ru-RU')}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {adGroupCr > 0 ? `${adGroupCr.toFixed(2)}%` : '—'}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-700">
                              {adGroupCpl > 0
                                ? `${Math.round(adGroupCpl).toLocaleString('ru-RU')} ₽`
                                : '—'}
                            </td>
                          </tr>

                          {/* Ads */}
                          {isAdGroupExpanded &&
                            ads.map((ad) => {
                              const adCtr = ad.avgCtr || 0;
                              const adCr =
                                ad.totalClicks > 0
                                  ? (ad.totalConversions / ad.totalClicks) * 100
                                  : 0;
                              const adCpl =
                                ad.totalConversions > 0
                                  ? ad.totalCost / ad.totalConversions
                                  : 0;

                              return (
                                <tr
                                  key={`${adGroupKey}-${ad.adId}`}
                                  className="bg-gray-100 border-b border-gray-100"
                                >
                                  <td className="px-6 py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-2 pl-14">
                                      <div className="flex flex-col flex-1">
                                        <span className="text-xs text-gray-700 font-medium">
                                          {ad.adTitle || `Объявление ${ad.adId}`}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                          ID: {ad.adId}
                                        </span>
                                      </div>
                                      {onAdFilterChange && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (globalFilterAdId === ad.adId) {
                                              onAdFilterChange(null);
                                            } else {
                                              onAdFilterChange(ad.adId, adGroup.adGroupId, campaignId);
                                            }
                                          }}
                                          className={`p-1 rounded transition-colors ${
                                            globalFilterAdId === ad.adId
                                              ? 'bg-green-100 text-green-600'
                                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                          }`}
                                          title={
                                            globalFilterAdId === ad.adId
                                              ? 'Убрать фильтр'
                                              : 'Фильтровать по этому объявлению'
                                          }
                                        >
                                          <Filter size={12} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                    {(ad.totalImpressions || 0).toLocaleString('ru-RU')}
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                    {(ad.totalClicks || 0).toLocaleString('ru-RU')}
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                    {(ad.totalCost || 0).toLocaleString('ru-RU')} ₽
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                    {(ad.avgCpc || 0).toFixed(2)} ₽
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-right">
                                    <span
                                      className={`text-xs ${
                                        adCtr >= 5
                                          ? 'text-green-600'
                                          : adCtr >= 3
                                          ? 'text-yellow-600'
                                          : 'text-red-600'
                                      }`}
                                    >
                                      {adCtr.toFixed(2)}%
                                    </span>
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                    {typeof ad.avgBounceRate === 'number'
                                      ? `${ad.avgBounceRate.toFixed(2)}%`
                                      : '—'}
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                    {(ad.totalConversions || 0).toLocaleString('ru-RU')}
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                    {adCr > 0 ? `${adCr.toFixed(2)}%` : '—'}
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-right text-xs text-gray-600">
                                    {adCpl > 0
                                      ? `${Math.round(adCpl).toLocaleString('ru-RU')} ₽`
                                      : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            })}

            {/* Totals row */}
            {campaigns.length > 0 && (
              <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ИТОГО ({campaigns.length} кампаний)
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
                  {totalCpc.toFixed(2)} ₽
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {totalCtr.toFixed(2)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  —
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {totals.conversions.toLocaleString('ru-RU')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {totalCr > 0 ? `${totalCr.toFixed(2)}%` : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {totalCpl > 0 ? `${Math.round(totalCpl).toLocaleString('ru-RU')} ₽` : '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
