import { useState, useRef, useEffect } from 'react';
import { Target, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/helpers';
import type { YandexGoal } from '../../types/yandex';

interface GoalsSelectorProps {
  goals: YandexGoal[];
  selectedGoalIds: string[];
  onSelectionChange: (goalIds: string[]) => void;
  loading?: boolean;
  className?: string;
}

export function GoalsSelector({
  goals,
  selectedGoalIds,
  onSelectionChange,
  loading = false,
  className,
}: GoalsSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleGoal = (goalId: string) => {
    if (selectedGoalIds.includes(goalId)) {
      onSelectionChange(selectedGoalIds.filter((id) => id !== goalId));
    } else {
      onSelectionChange([...selectedGoalIds, goalId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(goals.map((g) => String(g.id)));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const getButtonLabel = () => {
    if (selectedGoalIds.length === 0) return 'Все цели';
    if (selectedGoalIds.length === 1) {
      const goal = goals.find((g) => String(g.id) === selectedGoalIds[0]);
      return goal?.name || '1 цель';
    }
    return `${selectedGoalIds.length} целей`;
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
          isOpen
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        )}
      >
        <Target className="w-4 h-4" />
        <span>{getButtonLabel()}</span>
        <ChevronDown
          className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Цели конверсий</span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Выбрать все
              </button>
              <button
                onClick={clearAll}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Сбросить
              </button>
            </div>
          </div>

          {/* Goals list */}
          <div className="max-h-64 overflow-y-auto p-2">
            {goals.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Нет доступных целей</p>
            ) : (
              goals.map((goal) => {
                const isSelected = selectedGoalIds.includes(String(goal.id));
                return (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(String(goal.id))}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left',
                      isSelected
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center',
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="truncate">{goal.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
