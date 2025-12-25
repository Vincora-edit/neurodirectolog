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
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
      {/* Бюджет */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Wallet size={24} />
          </div>
          <div className="text-right">
            <p className="text-sm text-green-100">Бюджет</p>
            <p className="text-3xl font-bold">
              {budgetForecast?.balance?.amount
                ? budgetForecast.balance.amount.toLocaleString('ru-RU')
                : '—'}{' '}
              ₽
            </p>
          </div>
        </div>
        <div className="text-green-100 text-sm">
          {budgetForecast?.forecast?.daysRemaining !== null &&
          budgetForecast?.forecast?.daysRemaining !== undefined
            ? `Хватит на ${budgetForecast.forecast.daysRemaining} дней`
            : 'Загрузка...'}
        </div>
      </div>

      {/* Расход */}
      <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="bg-white/20 p-2 rounded-lg">
            <DollarSign size={24} />
          </div>
          <div className="text-right">
            <p className="text-sm text-red-100">Расход</p>
            <p className="text-3xl font-bold">{totalStats.cost.toLocaleString('ru-RU')} ₽</p>
          </div>
        </div>
      </div>

      {/* CR */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="bg-white/20 p-2 rounded-lg">
            <TrendingUp size={24} />
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-100">CR</p>
            <p className="text-3xl font-bold">{cr.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* CPL */}
      <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="bg-white/20 p-2 rounded-lg">
            <TrendingDown size={24} />
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-100">CPL</p>
            <p className="text-3xl font-bold">
              {cpl > 0 ? Math.round(cpl).toLocaleString('ru-RU') : '—'} ₽
            </p>
          </div>
        </div>
      </div>

      {/* Конверсии */}
      <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="bg-white/20 p-2 rounded-lg">
            <Target size={24} />
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-100">Конверсии</p>
            <p className="text-3xl font-bold">{totalStats.conversions.toLocaleString('ru-RU')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
