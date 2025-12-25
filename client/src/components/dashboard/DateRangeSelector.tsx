import { Calendar } from 'lucide-react';
import { DATE_RANGES } from '../../constants';
import { cn } from '../../utils/helpers';

interface DateRangeSelectorProps {
  dateRange: number;
  onDateRangeChange: (range: number) => void;
  customDateMode: boolean;
  onCustomDateModeChange: (mode: boolean) => void;
  customStartDate: string;
  customEndDate: string;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
  className?: string;
}

export function DateRangeSelector({
  dateRange,
  onDateRangeChange,
  customDateMode,
  onCustomDateModeChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  className,
}: DateRangeSelectorProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {/* Preset buttons */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {DATE_RANGES.map((range) => (
          <button
            key={range.value}
            onClick={() => {
              onDateRangeChange(range.value);
              onCustomDateModeChange(false);
            }}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              !customDateMode && dateRange === range.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Custom date toggle */}
      <button
        onClick={() => onCustomDateModeChange(!customDateMode)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
          customDateMode
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600 hover:text-gray-900'
        )}
      >
        <Calendar className="w-4 h-4" />
        Произвольный
      </button>

      {/* Custom date inputs */}
      {customDateMode && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => onCustomStartDateChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-gray-400">—</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => onCustomEndDateChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}
    </div>
  );
}
