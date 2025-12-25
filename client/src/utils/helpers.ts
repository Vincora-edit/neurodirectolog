// Вспомогательные функции

import type { DailyStats, GroupByPeriod } from '../types/yandex';

/**
 * Группирует данные по периоду (день, 3 дня, неделя, месяц)
 */
export function groupDataByPeriod(data: DailyStats[], period: GroupByPeriod): DailyStats[] {
  if (period === 'day' || data.length === 0) return data;

  const grouped = new Map<string, {
    date: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    revenue: number;
    bounceWeighted: number;
    daysCount: number;
  }>();

  data.forEach((item) => {
    const date = new Date(item.date);
    let key: string;
    let displayDate: string;

    if (period === '3days') {
      const dayOfYear = Math.floor(
        (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
      );
      const periodIndex = Math.floor(dayOfYear / 3);
      key = `${date.getFullYear()}-${periodIndex}`;
      displayDate = item.date;
    } else if (period === 'week') {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const yearStart = new Date(d.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(
        ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
      );
      key = `${d.getFullYear()}-W${weekNumber}`;
      const monday = new Date(date);
      monday.setDate(date.getDate() - (date.getDay() === 0 ? 6 : date.getDay() - 1));
      displayDate = monday.toISOString().split('T')[0];
    } else if (period === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      displayDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      key = item.date;
      displayDate = item.date;
    }

    if (!grouped.has(key)) {
      grouped.set(key, {
        date: displayDate,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        revenue: 0,
        bounceWeighted: 0,
        daysCount: 0,
      });
    }

    const g = grouped.get(key)!;
    g.impressions += item.impressions || 0;
    g.clicks += item.clicks || 0;
    g.cost += item.cost || 0;
    g.conversions += item.conversions || 0;
    g.revenue += item.revenue || 0;
    g.bounceWeighted += (item.bounceRate || 0) * (item.clicks || 0);
    g.daysCount += 1;
  });

  return Array.from(grouped.values()).map((g) => ({
    date: g.date,
    impressions: g.impressions,
    clicks: g.clicks,
    cost: g.cost,
    conversions: g.conversions,
    revenue: g.revenue,
    ctr: g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0,
    cpc: g.clicks > 0 ? g.cost / g.clicks : 0,
    bounceRate: g.clicks > 0 ? g.bounceWeighted / g.clicks : 0,
    cpl: g.conversions > 0 ? g.cost / g.conversions : 0,
    cr: g.clicks > 0 ? (g.conversions / g.clicks) * 100 : 0,
  }));
}

/**
 * Генерирует цвет для метрики графика
 */
export function getMetricColor(metric: string): string {
  const colors: Record<string, string> = {
    cost: '#ef4444',
    clicks: '#3b82f6',
    impressions: '#8b5cf6',
    conversions: '#10b981',
    ctr: '#f59e0b',
    cpc: '#ec4899',
    cpl: '#6366f1',
    cr: '#14b8a6',
    bounceRate: '#f97316',
  };
  return colors[metric] || '#6b7280';
}

/**
 * Получает название метрики на русском
 */
export function getMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    cost: 'Расход',
    clicks: 'Клики',
    impressions: 'Показы',
    conversions: 'Конверсии',
    ctr: 'CTR',
    cpc: 'CPC',
    cpl: 'CPL',
    cr: 'CR',
    bounceRate: 'Отказы',
  };
  return labels[metric] || metric;
}

/**
 * Вычисляет значение для сортировки
 */
export function getSortValue(item: any, column: string): number {
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
}

/**
 * Debounce функция
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle функция
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Классы условно
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Генерирует уникальный ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Безопасный JSON.parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Копирует текст в буфер обмена
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Скачивает файл
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
