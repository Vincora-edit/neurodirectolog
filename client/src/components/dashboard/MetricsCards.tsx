import { Wallet, DollarSign, TrendingUp, TrendingDown, Target } from 'lucide-react';

interface MetricsCardsProps {
  totalStats: {
    cost: number;
    conversions: number;
    clicks: number;
    impressions: number;
  };
  budgetForecast?: {
    balance?: { amount: number };
    forecast?: { daysRemaining: number };
  };
}

export function MetricsCards({ totalStats, budgetForecast }: MetricsCardsProps) {
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
      <div className={`bg-gradient-to-br ${budgetColors.bg} rounded-xl shadow-lg p-4 text-white flex flex-col items-center justify-center text-center`}>
        <div className="bg-white/20 p-2 rounded-lg mb-2">
          <Wallet size={20} />
        </div>
        <p className={`text-xs ${budgetColors.text} mb-0.5`}>Бюджет</p>
        <p className="text-xl font-bold">
          {budgetForecast?.balance?.amount
            ? budgetForecast.balance.amount.toLocaleString('ru-RU')
            : '—'}{' '}
          ₽
        </p>
        <p className={`${budgetColors.text} text-xs mt-1`}>
          {daysRemaining !== null && daysRemaining !== undefined
            ? `Хватит на ${daysRemaining} дней`
            : '\u00A0'}
        </p>
      </div>

      {/* Расход */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-4 text-white flex flex-col items-center justify-center text-center">
        <div className="bg-white/20 p-2 rounded-lg mb-2">
          <DollarSign size={20} />
        </div>
        <p className="text-xs text-orange-100 mb-0.5">Расход</p>
        <p className="text-xl font-bold">{totalStats.cost.toLocaleString('ru-RU')} ₽</p>
      </div>

      {/* CR */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-4 text-white flex flex-col items-center justify-center text-center">
        <div className="bg-white/20 p-2 rounded-lg mb-2">
          <TrendingUp size={20} />
        </div>
        <p className="text-xs text-blue-100 mb-0.5">CR</p>
        <p className="text-xl font-bold">{cr.toFixed(2)}%</p>
      </div>

      {/* CPL */}
      <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl shadow-lg p-4 text-white flex flex-col items-center justify-center text-center">
        <div className="bg-white/20 p-2 rounded-lg mb-2">
          <TrendingDown size={20} />
        </div>
        <p className="text-xs text-gray-100 mb-0.5">CPL</p>
        <p className="text-xl font-bold">
          {cpl > 0 ? Math.round(cpl).toLocaleString('ru-RU') : '—'} ₽
        </p>
      </div>

      {/* Конверсии */}
      <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg p-4 text-white flex flex-col items-center justify-center text-center">
        <div className="bg-white/20 p-2 rounded-lg mb-2">
          <Target size={20} />
        </div>
        <p className="text-xs text-purple-100 mb-0.5">Конверсии</p>
        <p className="text-xl font-bold">{totalStats.conversions.toLocaleString('ru-RU')}</p>
      </div>
    </div>
  );
}
