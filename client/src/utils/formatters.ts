// Утилиты для форматирования данных

/**
 * Форматирует число как денежную сумму (рубли)
 */
export function formatCurrency(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Форматирует число с разделителями тысяч
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Форматирует процент
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Форматирует дату в русском формате
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ru-RU', options || {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Форматирует дату для отображения на графике
 */
export function formatChartDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Сокращает число (1000 -> 1K, 1000000 -> 1M)
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Форматирует длинный URL для отображения
 */
export function formatUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const domain = urlObj.hostname;

    if (domain.length + path.length <= maxLength) {
      return `${domain}${path}`;
    }

    const availableForPath = maxLength - domain.length - 3;
    if (availableForPath > 10) {
      return `${domain}${path.substring(0, availableForPath)}...`;
    }

    return `${domain.substring(0, maxLength - 3)}...`;
  } catch {
    return url.substring(0, maxLength - 3) + '...';
  }
}

/**
 * Склоняет слово в зависимости от числа
 */
export function pluralize(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;

  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

/**
 * Форматирует изменение в процентах с цветом
 */
export function formatChange(current: number, previous: number): {
  value: string;
  isPositive: boolean;
  isNegative: boolean;
} {
  if (previous === 0) {
    return { value: '—', isPositive: false, isNegative: false };
  }

  const change = ((current - previous) / previous) * 100;
  const isPositive = change > 0;
  const isNegative = change < 0;

  return {
    value: `${isPositive ? '+' : ''}${change.toFixed(1)}%`,
    isPositive,
    isNegative,
  };
}
