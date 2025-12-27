import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Gauge, Settings, Target, X, Loader2, DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, AlertCircle, Info, Calendar } from 'lucide-react';
import { getCurrencySymbol } from '../../utils/formatters';

// Типы для KPI аналитики
export interface KpiAnalysis {
  cost: {
    avgDaily7d: number;
    projectedMonthly: number;
    remainingDays: number;
    remainingBudget: number;
    requiredDailyBudget: number;
    trend: 'on_track' | 'overspending' | 'underspending';
    recommendation: string | null;
  };
  leads: {
    avgDaily7d: number;
    projectedMonthly: number;
    remainingLeads: number;
    requiredDailyLeads: number;
    trend: 'on_track' | 'behind' | 'ahead';
    recommendation: string | null;
  };
  cpl: {
    current: number;
    target: number;
    avgDaily7d: number;
    trend: 'good' | 'warning' | 'bad';
    recommendation: string | null;
  };
  diagnosis: string | null;
}

interface KpiData {
  kpi?: {
    targetCost: number;
    targetCpl: number;
    targetLeads: number;
    goalIds?: string[];
  };
  stats?: {
    currentCost: number;
    currentCpl: number;
    currentLeads: number;
    currentDay: number;
    daysInMonth: number;
    dayProgress: number;
  };
  progress?: {
    costProgress: number;
    costDayProgress: number;
    leadsProgress: number;
    leadsDayProgress: number;
    cplStatus: 'good' | 'warning' | 'bad';
  };
  analysis?: KpiAnalysis | null;
  month?: string;
}

interface KpiWidgetProps {
  kpiData: KpiData | null;
  availableGoals: Array<{ goalId: string; goalName: string }>;
  connectionId: string;
  currency?: string;
  onSaveKpi: (kpi: {
    targetCost: number;
    targetCpl: number;
    targetLeads: number;
    goalIds: string[];
  }) => Promise<void>;
}

// Компонент контента KPI (переиспользуемый)
export function KpiContent({
  kpiData,
  formatCurrency
}: {
  kpiData: KpiData;
  formatCurrency: (value: number) => string;
}) {
  const { kpi, stats, progress, analysis } = kpiData;

  if (!kpi || (kpi.targetCost <= 0 && kpi.targetLeads <= 0)) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Gauge size={48} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm">KPI не настроены</p>
        <p className="text-xs mt-1">Нажмите "Настроить" чтобы задать цели на месяц</p>
      </div>
    );
  }

  return (
    <div>
      {/* Diagnosis Banner */}
      {analysis?.diagnosis && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800">Диагностика</div>
            <div className="text-sm text-amber-700 mt-1">{analysis.diagnosis}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Расход */}
        <div className={`p-4 rounded-xl border-2 ${
          analysis?.cost.trend === 'on_track'
            ? 'border-gray-200 bg-gray-50'
            : analysis?.cost.trend === 'overspending'
            ? 'border-red-200 bg-red-50'
            : 'border-amber-200 bg-amber-50'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign size={18} className="text-red-600" />
              <span className="font-medium text-gray-900">Расход</span>
            </div>
            {analysis?.cost.trend === 'on_track' && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                <CheckCircle size={12} /> В плане
              </span>
            )}
            {analysis?.cost.trend === 'overspending' && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">
                <TrendingUp size={12} /> Перерасход
              </span>
            )}
            {analysis?.cost.trend === 'underspending' && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                <TrendingDown size={12} /> Недорасход
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold text-gray-900">
                {formatCurrency(stats?.currentCost || 0)}
              </span>
              <span className="text-gray-500">
                из {formatCurrency(kpi.targetCost)}
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  analysis?.cost.trend === 'overspending' ? 'bg-red-500' : 'bg-red-400'
                }`}
                style={{ width: `${Math.min(progress?.costProgress || 0, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{Math.round(progress?.costProgress || 0)}%</span>
              <span>ожидалось {Math.round((stats?.dayProgress || 0) * 100)}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white/60 rounded-lg p-2">
              <div className="text-xs text-gray-500">Ср. за 7 дней</div>
              <div className="font-semibold text-gray-900">
                {formatCurrency(analysis?.cost.avgDaily7d || 0)}/день
              </div>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <div className="text-xs text-gray-500">Нужно тратить</div>
              <div className="font-semibold text-gray-900">
                {formatCurrency(analysis?.cost.requiredDailyBudget || 0)}/день
              </div>
            </div>
          </div>

          {/* Recommendation */}
          {analysis?.cost.recommendation && (
            <div className="mt-3 p-2 bg-white/80 rounded-lg text-xs text-gray-700 flex items-start gap-2">
              <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              {analysis.cost.recommendation}
            </div>
          )}
        </div>

        {/* Лиды */}
        <div className={`p-4 rounded-xl border-2 ${
          analysis?.leads.trend === 'on_track'
            ? 'border-gray-200 bg-gray-50'
            : analysis?.leads.trend === 'behind'
            ? 'border-amber-200 bg-amber-50'
            : 'border-green-200 bg-green-50'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-green-600" />
              <span className="font-medium text-gray-900">Лиды</span>
            </div>
            {analysis?.leads.trend === 'on_track' && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                <CheckCircle size={12} /> В плане
              </span>
            )}
            {analysis?.leads.trend === 'behind' && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                <TrendingDown size={12} /> Отстаём
              </span>
            )}
            {analysis?.leads.trend === 'ahead' && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                <TrendingUp size={12} /> Опережаем
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold text-gray-900">
                {stats?.currentLeads || 0} лидов
              </span>
              <span className="text-gray-500">
                из {kpi.targetLeads}
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  analysis?.leads.trend === 'ahead' ? 'bg-green-500' : 'bg-green-400'
                }`}
                style={{ width: `${Math.min(progress?.leadsProgress || 0, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{Math.round(progress?.leadsProgress || 0)}%</span>
              <span>ожидалось {Math.round((stats?.dayProgress || 0) * 100)}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white/60 rounded-lg p-2">
              <div className="text-xs text-gray-500">Ср. за 7 дней</div>
              <div className="font-semibold text-gray-900">
                {(analysis?.leads.avgDaily7d || 0).toFixed(1)}/день
              </div>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <div className="text-xs text-gray-500">Нужно получать</div>
              <div className="font-semibold text-gray-900">
                {(analysis?.leads.requiredDailyLeads || 0).toFixed(1)}/день
              </div>
            </div>
          </div>

          {/* Recommendation */}
          {analysis?.leads.recommendation && (
            <div className="mt-3 p-2 bg-white/80 rounded-lg text-xs text-gray-700 flex items-start gap-2">
              <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              {analysis.leads.recommendation}
            </div>
          )}
        </div>

        {/* CPL */}
        <div className={`p-4 rounded-xl border-2 ${
          analysis?.cpl.trend === 'good'
            ? 'border-green-200 bg-green-50'
            : analysis?.cpl.trend === 'warning'
            ? 'border-amber-200 bg-amber-50'
            : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gauge size={18} className="text-purple-600" />
              <span className="font-medium text-gray-900">CPL</span>
            </div>
            {analysis?.cpl.trend === 'good' && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                <CheckCircle size={12} /> В норме
              </span>
            )}
            {analysis?.cpl.trend === 'warning' && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                <AlertTriangle size={12} /> Внимание
              </span>
            )}
            {analysis?.cpl.trend === 'bad' && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">
                <AlertCircle size={12} /> Выше нормы
              </span>
            )}
          </div>

          {/* Current vs Target */}
          <div className="mb-3 text-center">
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(stats?.currentCpl || 0)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              цель: {formatCurrency(kpi.targetCpl)}
            </div>
            {(() => {
              const currentCpl = stats?.currentCpl || 0;
              const targetCpl = kpi?.targetCpl || 0;
              if (targetCpl > 0 && currentCpl > 0) {
                const diff = ((currentCpl - targetCpl) / targetCpl) * 100;
                return (
                  <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-sm font-medium ${
                    diff > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {diff > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {diff > 0 ? '+' : ''}{Math.round(diff)}%
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Stats */}
          <div className="bg-white/60 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">Ср. CPL за 7 дней</div>
            <div className="font-semibold text-gray-900">
              {formatCurrency(analysis?.cpl.avgDaily7d || 0)}
            </div>
          </div>

          {/* Recommendation */}
          {analysis?.cpl.recommendation && (
            <div className="mt-3 p-2 bg-white/80 rounded-lg text-xs text-gray-700 flex items-start gap-2">
              <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              {analysis.cpl.recommendation}
            </div>
          )}
        </div>
      </div>

      {/* Projections - compact single line */}
      {analysis && (
        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-6 text-xs text-gray-500">
          <span>Прогноз на конец месяца (при текущем темпе)</span>
          <span className="text-gray-400">|</span>
          <span>
            Расход:{' '}
            <span className={`font-medium ${
              (analysis.cost.projectedMonthly > kpi.targetCost * 1.1)
                ? 'text-red-600'
                : 'text-gray-700'
            }`}>
              {formatCurrency(analysis.cost.projectedMonthly)}
              {analysis.cost.projectedMonthly > kpi.targetCost * 1.1 && (
                <span className="ml-1">(+{Math.round(((analysis.cost.projectedMonthly / kpi.targetCost) - 1) * 100)}%)</span>
              )}
            </span>
          </span>
          <span className="text-gray-400">|</span>
          <span>
            Лиды:{' '}
            <span className={`font-medium ${
              analysis.leads.projectedMonthly < kpi.targetLeads * 0.9
                ? 'text-amber-600'
                : 'text-gray-700'
            }`}>
              ~{Math.round(analysis.leads.projectedMonthly)} шт.
              {analysis.leads.projectedMonthly < kpi.targetLeads * 0.9 && (
                <span className="ml-1">({Math.round(((analysis.leads.projectedMonthly / kpi.targetLeads) - 1) * 100)}%)</span>
              )}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

export function KpiWidget({ kpiData, availableGoals, connectionId, currency = 'RUB', onSaveKpi }: KpiWidgetProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showGoalsDropdown, setShowGoalsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    targetCost: 0,
    targetCpl: 0,
    targetLeads: 0,
    goalIds: [] as string[],
  });

  // Закрываем dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowGoalsDropdown(false);
      }
    };

    if (showGoalsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGoalsDropdown]);

  const openModal = () => {
    if (kpiData?.kpi) {
      setForm({
        targetCost: kpiData.kpi.targetCost || 0,
        targetCpl: kpiData.kpi.targetCpl || 0,
        targetLeads: kpiData.kpi.targetLeads || 0,
        goalIds: kpiData.kpi.goalIds || [],
      });
    } else {
      setForm({ targetCost: 0, targetCpl: 0, targetLeads: 0, goalIds: [] });
    }
    setShowGoalsDropdown(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveKpi(form);
      setShowModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const currencySymbol = getCurrencySymbol(currency);
  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
    return `${formatted} ${currencySymbol}`;
  };

  if (!connectionId) return null;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-3">
            {isCollapsed ? (
              <ChevronDown size={20} className="text-gray-400" />
            ) : (
              <ChevronUp size={20} className="text-gray-400" />
            )}
            <Gauge size={20} className="text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              KPI{' '}
              {kpiData?.month
                ? new Date(kpiData.month + '-01').toLocaleString('ru-RU', {
                    month: 'long',
                    year: 'numeric',
                  })
                : ''}
            </h3>
            {kpiData?.stats && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar size={14} />
                <span>День {kpiData.stats.currentDay} из {kpiData.stats.daysInMonth}</span>
                {kpiData.analysis?.cost.remainingDays !== undefined && (
                  <span className="text-gray-400">• осталось {kpiData.analysis.cost.remainingDays} дн.</span>
                )}
              </div>
            )}
            {kpiData?.kpi?.goalIds && kpiData.kpi.goalIds.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
                <Target size={12} />
                {kpiData.kpi.goalIds.length <= 2 ? (
                  kpiData.kpi.goalIds.map((goalId: string) => (
                    <span
                      key={goalId}
                      className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded"
                    >
                      {availableGoals.find((g) => g.goalId === goalId)?.goalName || goalId}
                    </span>
                  ))
                ) : (
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                    {kpiData.kpi.goalIds.length} целей
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openModal();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Settings size={14} />
            Настроить
          </button>
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="px-6 pb-6 pt-2">
            {kpiData ? (
              <KpiContent kpiData={kpiData} formatCurrency={formatCurrency} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Gauge size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm">KPI не настроены</p>
                <p className="text-xs mt-1">Нажмите "Настроить" чтобы задать цели на месяц</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Настройка KPI на месяц</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Целевой расход ({currencySymbol}/месяц)
                  </label>
                  <input
                    type="number"
                    value={form.targetCost || ''}
                    onChange={(e) => {
                      const newCost = parseFloat(e.target.value) || 0;
                      const newForm = { ...form, targetCost: newCost };
                      // Если есть CPL, рассчитываем лиды
                      if (newCost > 0 && form.targetCpl > 0) {
                        newForm.targetLeads = Math.round(newCost / form.targetCpl);
                      }
                      // Если есть лиды, рассчитываем CPL
                      else if (newCost > 0 && form.targetLeads > 0) {
                        newForm.targetCpl = Math.round(newCost / form.targetLeads);
                      }
                      setForm(newForm);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder="900000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Целевой CPL ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={form.targetCpl || ''}
                    onChange={(e) => {
                      const newCpl = parseFloat(e.target.value) || 0;
                      const newForm = { ...form, targetCpl: newCpl };
                      // Если есть расход, рассчитываем лиды
                      if (newCpl > 0 && form.targetCost > 0) {
                        newForm.targetLeads = Math.round(form.targetCost / newCpl);
                      }
                      // Если есть лиды, рассчитываем расход
                      else if (newCpl > 0 && form.targetLeads > 0) {
                        newForm.targetCost = Math.round(newCpl * form.targetLeads);
                      }
                      setForm(newForm);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder="4000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Целевое количество лидов
                  </label>
                  <input
                    type="number"
                    value={form.targetLeads || ''}
                    onChange={(e) => {
                      const newLeads = parseInt(e.target.value) || 0;
                      const newForm = { ...form, targetLeads: newLeads };
                      // Если есть расход, рассчитываем CPL
                      if (newLeads > 0 && form.targetCost > 0) {
                        newForm.targetCpl = Math.round(form.targetCost / newLeads);
                      }
                      // Если есть CPL, рассчитываем расход
                      else if (newLeads > 0 && form.targetCpl > 0) {
                        newForm.targetCost = Math.round(form.targetCpl * newLeads);
                      }
                      setForm(newForm);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder="225"
                  />
                </div>

                <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                  Поля связаны: заполните любые два — третье рассчитается автоматически
                </p>

                {availableGoals.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Цели для расчёта CPL
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Выберите цели, по которым будут считаться лиды и CPL для KPI
                    </p>
                    <div className="relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowGoalsDropdown(!showGoalsDropdown)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent text-left flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          {form.goalIds.length === 0
                            ? 'Все цели'
                            : form.goalIds.length === 1
                            ? availableGoals.find((g) => g.goalId === form.goalIds[0])?.goalName ||
                              `Цель ${form.goalIds[0]}`
                            : `${form.goalIds.length} целей`}
                        </span>
                        <svg
                          className={`w-4 h-4 transition-transform ${
                            showGoalsDropdown ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {showGoalsDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                          <div
                            className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 border-b border-gray-200"
                            onClick={() => {
                              setForm({ ...form, goalIds: [] });
                              setShowGoalsDropdown(false);
                            }}
                          >
                            <input
                              type="radio"
                              checked={form.goalIds.length === 0}
                              readOnly
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm">Все цели</span>
                          </div>
                          {availableGoals.map((goal) => (
                            <div
                              key={goal.goalId}
                              className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                if (form.goalIds.includes(goal.goalId)) {
                                  setForm({
                                    ...form,
                                    goalIds: form.goalIds.filter((id) => id !== goal.goalId),
                                  });
                                } else {
                                  setForm({ ...form, goalIds: [...form.goalIds, goal.goalId] });
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={form.goalIds.includes(goal.goalId)}
                                readOnly
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                              <span className="text-sm">{goal.goalName || `Цель ${goal.goalId}`}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
