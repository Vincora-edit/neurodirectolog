import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/helpers';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder,
  label,
  error,
  className,
  disabled,
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 bg-white border rounded-lg text-sm',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'disabled:bg-gray-100 disabled:cursor-not-allowed',
          error ? 'border-red-500' : 'border-gray-300',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
