import { Wallet, DollarSign, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { getCurrencySymbol } from '../../utils/formatters';

interface MetricsCardsProps {
  totalStats: {
    cost: number;
    conversions: number;
    clicks: number;
    impressions: number;
  };
  budgetForecast?: {
    balance?: { amount: number; currency?: string };
    forecast?: { daysRemaining: number };
  };
  currency?: string;
}

export function MetricsCards({ totalStats, budgetForecast, currency }: MetricsCardsProps) {
  // Определяем валюту из прогноза бюджета или из переданного параметра
  const currencyCode = budgetForecast?.balance?.currency || currency || 'RUB';
  const currencySymbol = getCurrencySymbol(currencyCode);
  const cr = totalStats.clicks > 0 ? (totalStats.conversions / totalStats.clicks) * 100 : 0;
  const cpl = totalStats.conversions > 0 ? totalStats.cost / totalStats.conversions : 0;

  // Определяем цвет карточки бюджета по количеству дней
  const daysRemaining = budgetForecast?.forecast?.daysRemaining;
  const getBudgetColors = () => {
    if (daysRemaining === null || daysRemaining === undefined) {
      return { bg: 'from-gray-500 to-gray-600', text: 'text-gray-100' };
    }
    if (daysRemaining < 3) {
      return { bg: 'from-red-500 to-rose-600', text: 'text-red-100' };
    }
    if (daysRemaining < 7) {
      return { bg: 'from-yellow-500 to-amber-600', text: 'text-yellow-100' };
    }
    return { bg: 'from-green-500 to-emerald-600', text: 'text-green-100' };
  };
  const budgetColors = getBudgetColors();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {/* Бюджет */}
      <div className={`bg-gradient-to-br ${budgetColors.bg} rounded-xl shadow-lg p-4 text-white flex items-center`}>
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <Wallet size={20} />
          </div>
          <div className="min-w-0">
            <p className={`text-xs ${budgetColors.text}`}>Бюджет</p>
            <p className="text-xl font-bold truncate leading-tight">
              {budgetForecast?.balance?.amount
                ? budgetForecast.balance.amount.toLocaleString('ru-RU')
                : '—'}{' '}
              {currencySymbol}
            </p>
            {daysRemaining !== null && daysRemaining !== undefined && (
              <p className={`${budgetColors.text} text-xs`}>
                Хватит на {daysRemaining} дней
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Расход */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-4 text-white flex items-center">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <DollarSign size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-orange-100">Расход</p>
            <p className="text-xl font-bold truncate leading-tight">{totalStats.cost.toLocaleString('ru-RU')} {currencySymbol}</p>
          </div>
        </div>
      </div>

      {/* CR */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-4 text-white flex items-center">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-blue-100">CR</p>
            <p className="text-xl font-bold leading-tight">{cr.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* CPL */}
      <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl shadow-lg p-4 text-white flex items-center">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <TrendingDown size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-100">CPL</p>
            <p className="text-xl font-bold truncate leading-tight">
              {cpl > 0 ? Math.round(cpl).toLocaleString('ru-RU') : '—'} {currencySymbol}
            </p>
          </div>
        </div>
      </div>

      {/* Конверсии */}
      <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg p-4 text-white flex items-center">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <Target size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-purple-100">Конверсии</p>
            <p className="text-xl font-bold leading-tight">{totalStats.conversions.toLocaleString('ru-RU')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
