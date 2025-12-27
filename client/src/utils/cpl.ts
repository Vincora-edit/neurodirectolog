/**
 * CPL (Cost Per Lead) status types and utility functions
 */

export type CplStatus = 'good' | 'warning' | 'bad' | 'neutral';

/**
 * Calculate deviation from target CPL as percentage
 * @returns null if calculation is not possible, otherwise deviation in percent
 */
export function getCplDeviation(cpl: number, targetCpl: number): number | null {
  if (!targetCpl || targetCpl <= 0 || cpl <= 0) return null;
  return ((cpl - targetCpl) / targetCpl) * 100;
}

/**
 * Determine CPL status based on deviation from target
 * - good: CPL is at or below target
 * - warning: CPL is up to 10% above target
 * - bad: CPL is more than 10% above target
 * - neutral: cannot calculate (no target or no CPL)
 */
export function getCplStatus(cpl: number, targetCpl: number): CplStatus {
  const deviation = getCplDeviation(cpl, targetCpl);
  if (deviation === null) return 'neutral';
  if (deviation <= 0) return 'good';
  if (deviation <= 10) return 'warning';
  return 'bad';
}

/**
 * Get Tailwind background color class for CPL status
 */
export function getCplRowBgColor(status: CplStatus): string {
  switch (status) {
    case 'good': return 'bg-green-50 hover:bg-green-100';
    case 'warning': return 'bg-amber-50 hover:bg-amber-100';
    case 'bad': return 'bg-red-50 hover:bg-red-100';
    default: return 'hover:bg-gray-50';
  }
}

/**
 * Get Tailwind text color class for deviation value
 */
export function getDeviationColor(deviation: number | null): string {
  if (deviation === null) return 'text-gray-400';
  if (deviation <= 0) return 'text-green-600';
  if (deviation <= 10) return 'text-amber-600';
  return 'text-red-600';
}

/**
 * Format deviation as string with sign and percent
 */
export function formatDeviation(deviation: number | null): string {
  if (deviation === null) return '—';
  const sign = deviation > 0 ? '+' : '';
  return `${sign}${deviation.toFixed(0)}%`;
}
