import { useState } from 'react';
import { ChevronDown, Gauge, Settings, Target, X, Loader2 } from 'lucide-react';
import { CircularProgress } from './CircularProgress';

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
  };
  progress?: {
    costProgress: number;
    costDayProgress: number;
    leadsProgress: number;
    leadsDayProgress: number;
    cplStatus: 'good' | 'warning' | 'bad';
  };
  month?: string;
}

interface KpiWidgetProps {
  kpiData: KpiData | null;
  availableGoals: Array<{ goalId: string; goalName: string }>;
  connectionId: string;
  onSaveKpi: (kpi: {
    targetCost: number;
    targetCpl: number;
    targetLeads: number;
    goalIds: string[];
  }) => Promise<void>;
}

export function KpiWidget({ kpiData, availableGoals, connectionId, onSaveKpi }: KpiWidgetProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showGoalsDropdown, setShowGoalsDropdown] = useState(false);
  const [form, setForm] = useState({
    targetCost: 0,
    targetCpl: 0,
    targetLeads: 0,
    goalIds: [] as string[],
  });

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
            <ChevronDown
              size={20}
              className={`text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
            />
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
              <span className="text-sm text-gray-500">
                (день {kpiData.stats.currentDay} из {kpiData.stats.daysInMonth})
              </span>
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
            {kpiData?.kpi?.targetCost > 0 || kpiData?.kpi?.targetLeads > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Расход */}
                <div className="flex flex-col items-center">
                  <CircularProgress
                    value={kpiData?.progress?.costProgress || 0}
                    dayValue={kpiData?.progress?.costDayProgress || 0}
                    size={120}
                    color="#ef4444"
                    dayColor="#fca5a5"
                    label={`${Math.round((kpiData?.stats?.currentCost || 0) / 1000)}K`}
                    sublabel="₽"
                  />
                  <div className="mt-3 text-center">
                    <div className="text-sm font-medium text-gray-700">Расход</div>
                    <div className="text-xs text-gray-500">
                      {(kpiData?.stats?.currentCost || 0).toLocaleString('ru-RU')} /{' '}
                      {(kpiData?.kpi?.targetCost || 0).toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                </div>

                {/* CPL */}
                <div className="flex flex-col items-center">
                  <div className="relative" style={{ width: 120, height: 120 }}>
                    <div
                      className={`w-full h-full rounded-full flex flex-col items-center justify-center border-8 ${
                        kpiData?.progress?.cplStatus === 'good'
                          ? 'border-green-500 bg-green-50'
                          : kpiData?.progress?.cplStatus === 'warning'
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-red-500 bg-red-50'
                      }`}
                    >
                      <span className="text-2xl font-bold text-gray-900">
                        {Math.round(kpiData?.stats?.currentCpl || 0).toLocaleString('ru-RU')}
                      </span>
                      <span className="text-xs text-gray-500">₽</span>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    {(() => {
                      const currentCpl = kpiData?.stats?.currentCpl || 0;
                      const targetCpl = kpiData?.kpi?.targetCpl || 0;
                      if (targetCpl > 0 && currentCpl > 0) {
                        const diff = ((currentCpl - targetCpl) / targetCpl) * 100;
                        return (
                          <div
                            className={`text-xs font-medium ${
                              diff > 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {diff > 0 ? '+' : ''}
                            {Math.round(diff)}%
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div className="text-sm font-medium text-gray-700 mt-1">CPL</div>
                    <div className="text-xs text-gray-500">
                      {Math.round(kpiData?.stats?.currentCpl || 0).toLocaleString('ru-RU')} /{' '}
                      {(kpiData?.kpi?.targetCpl || 0).toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                </div>

                {/* Лиды */}
                <div className="flex flex-col items-center">
                  <CircularProgress
                    value={kpiData?.progress?.leadsProgress || 0}
                    dayValue={kpiData?.progress?.leadsDayProgress || 0}
                    size={120}
                    color="#22c55e"
                    dayColor="#86efac"
                    label={`${kpiData?.stats?.currentLeads || 0}`}
                    sublabel="лидов"
                  />
                  <div className="mt-3 text-center">
                    <div className="text-sm font-medium text-gray-700">Лиды</div>
                    <div className="text-xs text-gray-500">
                      {kpiData?.stats?.currentLeads || 0} / {kpiData?.kpi?.targetLeads || 0}
                    </div>
                  </div>
                </div>
              </div>
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
                    Целевой расход (₽/месяц)
                  </label>
                  <input
                    type="number"
                    value={form.targetCost}
                    onChange={(e) =>
                      setForm({ ...form, targetCost: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder="900000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Целевой CPL (₽)
                  </label>
                  <input
                    type="number"
                    value={form.targetCpl}
                    onChange={(e) =>
                      setForm({ ...form, targetCpl: parseFloat(e.target.value) || 0 })
                    }
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
                    value={form.targetLeads}
                    onChange={(e) =>
                      setForm({ ...form, targetLeads: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder="225"
                  />
                </div>

                {availableGoals.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Цели для расчёта CPL
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Выберите цели, по которым будут считаться лиды и CPL для KPI
                    </p>
                    <div className="relative">
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
