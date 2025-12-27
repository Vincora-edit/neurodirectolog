import { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown, LayoutGrid, CheckCircle, AlertCircle, TrendingDown } from 'lucide-react';
import { getCplStatus, getCplRowBgColor, getCplDeviation, getDeviationColor, formatDeviation } from '../../utils/cpl';
import { getCurrencySymbol } from '../../utils/formatters';

interface Campaign {
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
}

interface PublicCampaignsTableProps {
  campaigns: Campaign[];
  targetCpl?: number;
  currency?: string;
}

type SortColumn = 'impressions' | 'clicks' | 'cost' | 'cpc' | 'ctr' | 'bounceRate' | 'conversions' | 'cr' | 'cpl';
type SortDirection = 'asc' | 'desc';

export function PublicCampaignsTable({ campaigns, targetCpl = 0, currency = 'RUB' }: PublicCampaignsTableProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const [isOpen, setIsOpen] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortValue = (item: Campaign, column: SortColumn): number => {
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

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aVal = getSortValue(a, sortColumn);
    const bVal = getSortValue(b, sortColumn);
    return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
  });

  // Итоги
  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + (c.impressions || 0),
      clicks: acc.clicks + (c.clicks || 0),
      cost: acc.cost + (c.cost || 0),
      conversions: acc.conversions + (c.conversions || 0),
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 }
  );

  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const totalCpc = totals.clicks > 0 ? totals.cost / totals.clicks : 0;
  const totalCr = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
  const totalCpl = totals.conversions > 0 ? totals.cost / totals.conversions : 0;

  // Подсчет статусов кампаний
  const campaignStatusCounts = sortedCampaigns.reduce(
    (acc, c) => {
      const status = getCplStatus(c.cpl || 0, targetCpl);
      acc[status]++;
      return acc;
    },
    { good: 0, warning: 0, bad: 0, neutral: 0 }
  );

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
          <LayoutGrid size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-900">Кампании</span>
          <span className="text-xs text-gray-400">{campaigns.length} кампаний</span>
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
        {isOpen ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
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
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">vs план</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedCampaigns.map((campaign) => {
                const campaignCr = campaign.clicks > 0 ? (campaign.conversions / campaign.clicks) * 100 : 0;
                const cplStatus = getCplStatus(campaign.cpl || 0, targetCpl);
                const deviation = getCplDeviation(campaign.cpl || 0, targetCpl);
                return (
                  <tr key={campaign.id} className={getCplRowBgColor(cplStatus)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          campaign.status === 'ON' ? 'bg-green-500' :
                          campaign.status === 'OFF' ? 'bg-gray-400' : 'bg-yellow-500'
                        }`} />
                        <span className="font-medium text-gray-900 truncate max-w-[300px]">{campaign.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatNumber(campaign.impressions)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatNumber(campaign.clicks)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(campaign.cost)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{(campaign.cpc || 0).toFixed(2)} {currencySymbol}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${
                        (campaign.ctr || 0) >= 5 ? 'text-green-600' :
                        (campaign.ctr || 0) >= 3 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {formatPercent(campaign.ctr || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {typeof campaign.bounceRate === 'number' ? `${campaign.bounceRate.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${(campaign.conversions || 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatNumber(campaign.conversions)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${
                        campaignCr >= 10 ? 'text-green-600' :
                        campaignCr >= 5 ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        {campaignCr > 0 ? formatPercent(campaignCr) : '—'}
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
              {campaigns.length > 0 && (
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td className="px-4 py-3 text-gray-900">ИТОГО ({campaigns.length} кампаний)</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(totals.impressions)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(totals.clicks)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(totals.cost)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{totalCpc.toFixed(2)} {currencySymbol}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{totalCtr.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right text-gray-900">—</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatNumber(totals.conversions)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{totalCr > 0 ? formatPercent(totalCr) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{totalCpl > 0 ? formatCurrency(totalCpl) : '—'}</td>
                  {targetCpl > 0 && (
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">план: {formatCurrency(targetCpl)}</td>
                  )}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
