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

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {/* Бюджет */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <Wallet size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-green-100 mb-0.5">Бюджет</p>
            <p className="text-xl font-bold truncate">
              {budgetForecast?.balance?.amount
                ? budgetForecast.balance.amount.toLocaleString('ru-RU')
                : '—'}{' '}
              ₽
            </p>
          </div>
        </div>
        <div className="text-green-100 text-xs mt-2">
          {budgetForecast?.forecast?.daysRemaining !== null &&
          budgetForecast?.forecast?.daysRemaining !== undefined
            ? `Хватит на ${budgetForecast.forecast.daysRemaining} дней`
            : ''}
        </div>
      </div>

      {/* Расход */}
      <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <DollarSign size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-red-100 mb-0.5">Расход</p>
            <p className="text-xl font-bold truncate">{totalStats.cost.toLocaleString('ru-RU')} ₽</p>
          </div>
        </div>
      </div>

      {/* CR */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-blue-100 mb-0.5">CR</p>
            <p className="text-xl font-bold">{cr.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* CPL */}
      <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl shadow-lg p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <TrendingDown size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-100 mb-0.5">CPL</p>
            <p className="text-xl font-bold truncate">
              {cpl > 0 ? Math.round(cpl).toLocaleString('ru-RU') : '—'} ₽
            </p>
          </div>
        </div>
      </div>

      {/* Конверсии */}
      <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <Target size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-purple-100 mb-0.5">Конверсии</p>
            <p className="text-xl font-bold">{totalStats.conversions.toLocaleString('ru-RU')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
