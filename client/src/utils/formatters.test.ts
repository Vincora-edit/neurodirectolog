import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatCompactNumber,
  formatUrl,
  pluralize,
  formatChange,
} from './formatters';

describe('formatCurrency', () => {
  it('formats number as Russian rubles', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('1');
    expect(result).toContain('000');
    expect(result).toMatch(/₽|руб/);
  });

  it('handles decimals', () => {
    const result = formatCurrency(1234.56, 2);
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('handles zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });
});

describe('formatNumber', () => {
  it('formats number with thousand separators', () => {
    const result = formatNumber(1000000);
    // Intl uses non-breaking space, normalize for comparison
    expect(result.replace(/\s/g, ' ')).toBe('1 000 000');
  });

  it('handles decimals', () => {
    const result = formatNumber(1234.567, 2);
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('57');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('formats percentage with default decimals', () => {
    expect(formatPercent(12.345)).toBe('12.35%');
  });

  it('handles custom decimals', () => {
    expect(formatPercent(12.345, 1)).toBe('12.3%');
    expect(formatPercent(12.345, 0)).toBe('12%');
  });

  it('handles zero', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });
});

describe('formatCompactNumber', () => {
  it('formats millions', () => {
    expect(formatCompactNumber(1000000)).toBe('1.0M');
    expect(formatCompactNumber(2500000)).toBe('2.5M');
  });

  it('formats thousands', () => {
    expect(formatCompactNumber(1000)).toBe('1.0K');
    expect(formatCompactNumber(1500)).toBe('1.5K');
  });

  it('returns original for small numbers', () => {
    expect(formatCompactNumber(999)).toBe('999');
    expect(formatCompactNumber(0)).toBe('0');
  });
});

describe('formatUrl', () => {
  it('returns short URLs unchanged', () => {
    const url = 'https://example.com/page';
    expect(formatUrl(url, 50)).toBe(url);
  });

  it('truncates long URLs', () => {
    const url = 'https://example.com/very/long/path/to/some/page/that/exceeds/limit';
    const result = formatUrl(url, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result).toContain('...');
  });

  it('handles invalid URLs gracefully', () => {
    const invalid = 'not-a-valid-url-but-very-long-string-that-needs-truncation';
    const result = formatUrl(invalid, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toContain('...');
  });
});

describe('pluralize', () => {
  it('returns correct form for 1', () => {
    expect(pluralize(1, 'день', 'дня', 'дней')).toBe('день');
    expect(pluralize(21, 'день', 'дня', 'дней')).toBe('день');
    expect(pluralize(101, 'день', 'дня', 'дней')).toBe('день');
  });

  it('returns correct form for 2-4', () => {
    expect(pluralize(2, 'день', 'дня', 'дней')).toBe('дня');
    expect(pluralize(3, 'день', 'дня', 'дней')).toBe('дня');
    expect(pluralize(4, 'день', 'дня', 'дней')).toBe('дня');
    expect(pluralize(22, 'день', 'дня', 'дней')).toBe('дня');
  });

  it('returns correct form for 5-20 and 0', () => {
    expect(pluralize(0, 'день', 'дня', 'дней')).toBe('дней');
    expect(pluralize(5, 'день', 'дня', 'дней')).toBe('дней');
    expect(pluralize(11, 'день', 'дня', 'дней')).toBe('дней');
    expect(pluralize(12, 'день', 'дня', 'дней')).toBe('дней');
    expect(pluralize(19, 'день', 'дня', 'дней')).toBe('дней');
  });

  it('handles negative numbers', () => {
    expect(pluralize(-1, 'день', 'дня', 'дней')).toBe('день');
    expect(pluralize(-5, 'день', 'дня', 'дней')).toBe('дней');
  });
});

describe('formatChange', () => {
  it('calculates positive change', () => {
    const result = formatChange(150, 100);
    expect(result.value).toBe('+50.0%');
    expect(result.isPositive).toBe(true);
    expect(result.isNegative).toBe(false);
  });

  it('calculates negative change', () => {
    const result = formatChange(50, 100);
    expect(result.value).toBe('-50.0%');
    expect(result.isPositive).toBe(false);
    expect(result.isNegative).toBe(true);
  });

  it('handles no change', () => {
    const result = formatChange(100, 100);
    // 0 change doesn't have + prefix since it's not positive
    expect(result.value).toBe('0.0%');
    expect(result.isPositive).toBe(false);
    expect(result.isNegative).toBe(false);
  });

  it('handles zero previous value', () => {
    const result = formatChange(100, 0);
    expect(result.value).toBe('—');
    expect(result.isPositive).toBe(false);
    expect(result.isNegative).toBe(false);
  });
});
