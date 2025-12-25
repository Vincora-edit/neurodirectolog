import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Loader2,
  Clock,
  Building2,
  Target,
  Calendar,
  BarChart3,
  Megaphone,
  Folder,
  FileText,
  X,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Plus,
  Edit3,
  Settings,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { API_BASE_URL } from '../../services/api';

interface Connection {
  id: string;
  login: string;
  lastSyncAt?: string;
  conversionGoals?: string;
}

interface Goal {
  goalId: string;
  goalName: string;
}

interface Campaign {
  campaignId: string;
  campaignName: string;
  adGroups?: AdGroup[];
}

interface AdGroup {
  adGroupId: string;
  adGroupName: string;
  ads?: Ad[];
}

interface Ad {
  adId: string;
  adTitle?: string;
  adTitle2?: string;
}

interface DashboardHeaderProps {
  // Project info
  projectName?: string;

  // Connections
  connections: Connection[];
  activeConnectionId: string;
  onConnectionChange: (connectionId: string) => void;

  // Goals
  availableGoals: Goal[];
  selectedGoalIds: string[];
  onGoalIdsChange: (goalIds: string[]) => void;

  // Date range
  dateRange: number;
  onDateRangeChange: (range: number) => void;
  customDateMode: boolean;
  onCustomDateModeChange: (mode: boolean) => void;
  customStartDate: string;
  customEndDate: string;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;

  // Grouping
  groupBy: string;
  onGroupByChange: (groupBy: string) => void;

  // Global filters
  campaigns: Campaign[];
  globalFilterCampaignId: string | null;
  globalFilterAdGroupId: string | null;
  globalFilterAdId: string | null;
  onCampaignFilterChange: (campaignId: string | null) => void;
  onAdGroupFilterChange: (adGroupId: string | null) => void;
  onAdIdFilterChange: (adId: string | null) => void;

  // Sync
  isSyncing: boolean;
  onSync: () => void;
  lastSyncAt?: string;

  // Header state
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function DashboardHeader({
  projectName,
  connections,
  activeConnectionId,
  onConnectionChange,
  availableGoals,
  selectedGoalIds,
  onGoalIdsChange,
  dateRange,
  onDateRangeChange,
  customDateMode,
  onCustomDateModeChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  groupBy,
  onGroupByChange,
  campaigns,
  globalFilterCampaignId,
  globalFilterAdGroupId,
  globalFilterAdId,
  onCampaignFilterChange,
  onAdGroupFilterChange,
  onAdIdFilterChange,
  isSyncing,
  onSync,
  lastSyncAt,
  isCollapsed,
  onCollapsedChange,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const [showGoalsDropdown, setShowGoalsDropdown] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const activeConnection = connections.find((c) => c.id === activeConnectionId);

  // Форматирование времени синхронизации
  const formatLastSync = (date: any) => {
    if (!date) return 'Никогда';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ч назад`;
    return d.toLocaleDateString('ru-RU');
  };

  // Опции для фильтров
  const filterCampaignOptions = campaigns.map((c) => ({
    id: c.campaignId,
    name: c.campaignName,
  }));

  const filterAdGroupOptions = globalFilterCampaignId
    ? (campaigns.find((c) => c.campaignId === globalFilterCampaignId)?.adGroups || []).map(
        (g) => ({
          id: g.adGroupId,
          name: g.adGroupName,
        })
      )
    : [];

  const filterAdOptions = globalFilterAdGroupId
    ? (
        campaigns
          .find((c) => c.campaignId === globalFilterCampaignId)
          ?.adGroups?.find((g) => g.adGroupId === globalFilterAdGroupId)?.ads || []
      ).map((a) => ({
        id: a.adId,
        title: a.adTitle || a.adTitle2 || `Объявление ${a.adId}`,
      }))
    : [];

  return (
    <>
      <div
        className={`mb-6 ${isCollapsed ? 'hidden' : ''}`}
      >
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          {/* Первая строка: Заголовок и кнопка обновления */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {projectName || 'Аналитика Яндекс.Директ'}
              </h1>
              {activeConnection && (
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>Синхронизация: {formatLastSync(lastSyncAt)}</span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              {isSyncing ? 'Синхронизация...' : 'Обновить данные'}
            </button>
          </div>

          {/* Вторая строка: Селекторы */}
          <div className="flex items-start gap-4 flex-wrap">
            {/* Селектор аккаунтов */}
            {connections.length > 0 && (
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Building2 size={14} className="text-gray-500" />
                  Аккаунт
                </label>
                <div className="flex items-center gap-1">
                  <select
                    value={activeConnectionId}
                    onChange={(e) => onConnectionChange(e.target.value)}
                    className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm font-medium text-blue-900 focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[180px]"
                  >
                    {connections.map((conn) => (
                      <option key={conn.id} value={conn.id}>
                        {conn.login}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <button
                      onClick={() => setShowAccountMenu(!showAccountMenu)}
                      className="p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors"
                      title="Управление аккаунтами"
                    >
                      <MoreVertical size={18} className="text-gray-600" />
                    </button>
                    {showAccountMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowAccountMenu(false)}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] py-1">
                          <button
                            onClick={() => {
                              setShowAccountMenu(false);
                              navigate('/connect-yandex-simple');
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                          >
                            <Plus size={16} className="text-green-600" />
                            Добавить аккаунт
                          </button>
                          <button
                            onClick={() => setShowAccountMenu(false)}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                          >
                            <Edit3 size={16} className="text-blue-600" />
                            Редактировать текущий
                          </button>
                          <button
                            onClick={() => setShowAccountMenu(false)}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                          >
                            <Settings size={16} className="text-gray-500" />
                            Все подключения
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={async () => {
                              setShowAccountMenu(false);
                              if (
                                activeConnection &&
                                confirm(`Удалить подключение ${activeConnection.login}?`)
                              ) {
                                try {
                                  await fetch(
                                    `${API_BASE_URL}/api/yandex/connection/${activeConnection.id}`,
                                    { method: 'DELETE' }
                                  );
                                  window.location.reload();
                                } catch {
                                  alert('Ошибка при удалении');
                                }
                              }
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                          >
                            <Trash2 size={16} />
                            Удалить текущий
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Селектор целей */}
            {availableGoals.length > 0 && (
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Target size={14} className="text-gray-500" />
                  Цели
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowGoalsDropdown(!showGoalsDropdown)}
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[180px] text-left flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      {selectedGoalIds.length === 0
                        ? 'Все цели'
                        : selectedGoalIds.length === 1
                        ? availableGoals.find((g) => g.goalId === selectedGoalIds[0])?.goalName ||
                          `Цель ${selectedGoalIds[0]}`
                        : `${selectedGoalIds.length} целей`}
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
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[220px] max-h-60 overflow-y-auto">
                      <div
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 border-b border-gray-200"
                        onClick={() => {
                          onGoalIdsChange([]);
                          setShowGoalsDropdown(false);
                        }}
                      >
                        <input
                          type="radio"
                          checked={selectedGoalIds.length === 0}
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
                            if (selectedGoalIds.includes(goal.goalId)) {
                              onGoalIdsChange(
                                selectedGoalIds.filter((id) => id !== goal.goalId)
                              );
                            } else {
                              onGoalIdsChange([...selectedGoalIds, goal.goalId]);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedGoalIds.includes(goal.goalId)}
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

            {/* Селектор периода */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-500" />
                Период
              </label>
              <select
                value={customDateMode ? 'custom' : dateRange}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'custom') {
                    onCustomDateModeChange(true);
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - 30);
                    onCustomEndDateChange(end.toISOString().split('T')[0]);
                    onCustomStartDateChange(start.toISOString().split('T')[0]);
                  } else {
                    onCustomDateModeChange(false);
                    onDateRangeChange(parseInt(value));
                  }
                }}
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value={7}>7 дней</option>
                <option value={30}>30 дней</option>
                <option value={90}>90 дней</option>
                <option value="custom">Произвольный</option>
              </select>
            </div>

            {/* Кастомные даты */}
            {customDateMode && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Даты</label>
                <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => onCustomStartDateChange(e.target.value)}
                    className="border-none focus:ring-0 bg-transparent text-sm p-0"
                  />
                  <ArrowRight size={16} className="text-gray-400" />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => onCustomEndDateChange(e.target.value)}
                    className="border-none focus:ring-0 bg-transparent text-sm p-0"
                  />
                </div>
              </div>
            )}

            {/* Группировка */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-gray-500" />
                Группировать по
              </label>
              <select
                value={groupBy}
                onChange={(e) => onGroupByChange(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="day">День</option>
                <option value="3days">3 дня</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
              </select>
            </div>
          </div>

          {/* Глобальные фильтры */}
          {filterCampaignOptions.length > 0 && (
            <div className="flex items-start gap-4 flex-wrap mt-4 pt-4 border-t border-gray-200">
              {/* Фильтр по кампании */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Megaphone size={14} className="text-gray-500" />
                  Кампания
                </label>
                <select
                  value={globalFilterCampaignId || ''}
                  onChange={(e) => onCampaignFilterChange(e.target.value || null)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[200px]"
                >
                  <option value="">Все кампании</option>
                  {filterCampaignOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Фильтр по группе */}
              {globalFilterCampaignId && filterAdGroupOptions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <Folder size={14} className="text-gray-500" />
                    Группа объявлений
                  </label>
                  <select
                    value={globalFilterAdGroupId || ''}
                    onChange={(e) => onAdGroupFilterChange(e.target.value || null)}
                    className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm font-medium text-purple-900 focus:ring-2 focus:ring-purple-400 focus:border-transparent min-w-[200px]"
                  >
                    <option value="">Все группы</option>
                    {filterAdGroupOptions.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Фильтр по объявлению */}
              {globalFilterAdGroupId && filterAdOptions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <FileText size={14} className="text-gray-500" />
                    Объявление
                  </label>
                  <select
                    value={globalFilterAdId || ''}
                    onChange={(e) => onAdIdFilterChange(e.target.value || null)}
                    className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm font-medium text-orange-900 focus:ring-2 focus:ring-orange-400 focus:border-transparent min-w-[200px]"
                  >
                    <option value="">Все объявления</option>
                    {filterAdOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Кнопка сброса */}
              {(globalFilterCampaignId || globalFilterAdGroupId || globalFilterAdId) && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-transparent">Сбросить</label>
                  <button
                    onClick={() => {
                      onCampaignFilterChange(null);
                      onAdGroupFilterChange(null);
                      onAdIdFilterChange(null);
                    }}
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                  >
                    <X size={14} />
                    Сбросить
                  </button>
                </div>
              )}

              {/* Кнопка сворачивания */}
              <div className="flex flex-col gap-1.5 ml-auto">
                <label className="text-xs font-medium text-transparent">Скрыть</label>
                <button
                  onClick={() => onCollapsedChange(true)}
                  className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                  title="Свернуть фильтры"
                >
                  <ChevronUp size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Кнопка разворачивания */}
      {isCollapsed && (
        <div className="sticky top-[41px] z-20 mb-4 -mx-8 px-8 -mt-8 pt-2">
          <button
            onClick={() => onCollapsedChange(false)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm text-gray-600"
          >
            <ChevronDown size={16} />
            <span>Показать фильтры</span>
            {globalFilterCampaignId && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                Фильтр активен
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
}
