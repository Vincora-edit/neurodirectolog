import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { formatNumber, formatCurrency, formatPercent } from '../../utils/formatters';

interface StatCardProps {
  title: string;
  value: number;
  format?: 'number' | 'currency' | 'percent';
  decimals?: number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  iconColor?: string;
  className?: string;
  reverseChangeColors?: boolean; // Для метрик где рост = плохо (например, CPL)
}

export function StatCard({
  title,
  value,
  format = 'number',
  decimals = 0,
  change,
  changeLabel,
  icon,
  iconColor = 'bg-blue-100 text-blue-600',
  className,
  reverseChangeColors = false,
}: StatCardProps) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return formatCurrency(val, decimals);
      case 'percent':
        return formatPercent(val, decimals);
      default:
        return formatNumber(val, decimals);
    }
  };

  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  // Определяем цвета: обычно рост = зелёный, но для некоторых метрик наоборот
  const getChangeColor = () => {
    if (change === undefined || change === 0) return 'text-gray-500';
    if (reverseChangeColors) {
      return isPositive ? 'text-red-600' : 'text-green-600';
    }
    return isPositive ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
          {change !== undefined && (
            <div className={cn('flex items-center gap-1 mt-1 text-sm', getChangeColor())}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : isNegative ? (
                <TrendingDown className="w-4 h-4" />
              ) : null}
              <span>
                {isPositive ? '+' : ''}
                {change.toFixed(1)}%
              </span>
              {changeLabel && <span className="text-gray-400 ml-1">{changeLabel}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className={cn('p-2 rounded-lg', iconColor)}>{icon}</div>
        )}
      </div>
    </div>
  );
}
