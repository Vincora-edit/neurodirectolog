import { describe, it, expect, vi } from 'vitest';
import {
  getMetricColor,
  getMetricLabel,
  cn,
  generateId,
  safeJsonParse,
  debounce,
} from './helpers';

describe('getMetricColor', () => {
  it('returns correct color for known metrics', () => {
    expect(getMetricColor('cost')).toBe('#ef4444');
    expect(getMetricColor('clicks')).toBe('#3b82f6');
    expect(getMetricColor('impressions')).toBe('#8b5cf6');
    expect(getMetricColor('conversions')).toBe('#10b981');
  });

  it('returns gray for unknown metrics', () => {
    expect(getMetricColor('unknown')).toBe('#6b7280');
  });
});

describe('getMetricLabel', () => {
  it('returns correct Russian labels', () => {
    expect(getMetricLabel('cost')).toBe('Расход');
    expect(getMetricLabel('clicks')).toBe('Клики');
    expect(getMetricLabel('impressions')).toBe('Показы');
    expect(getMetricLabel('conversions')).toBe('Конверсии');
    expect(getMetricLabel('ctr')).toBe('CTR');
  });

  it('returns metric name for unknown metrics', () => {
    expect(getMetricLabel('unknown')).toBe('unknown');
  });
});

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('filters falsy values', () => {
    expect(cn('class1', false, undefined, null, 'class2')).toBe('class1 class2');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });
});

describe('generateId', () => {
  it('generates string ID', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('generates IDs of expected length', () => {
    const id = generateId();
    expect(id.length).toBe(7);
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    const result = safeJsonParse('{"key": "value"}', {});
    expect(result).toEqual({ key: 'value' });
  });

  it('returns fallback for invalid JSON', () => {
    const fallback = { default: true };
    const result = safeJsonParse('invalid json', fallback);
    expect(result).toEqual(fallback);
  });

  it('parses arrays', () => {
    const result = safeJsonParse('[1, 2, 3]', []);
    expect(result).toEqual([1, 2, 3]);
  });
});

describe('debounce', () => {
  it('debounces function calls', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('passes arguments correctly', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    vi.useRealTimers();
  });
});
