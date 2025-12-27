import { useState } from 'react';
import { createPortal } from 'react-dom';
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
  Save,
} from 'lucide-react';
import { API_BASE_URL } from '../../services/api';

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

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

interface Project {
  id: string;
  name: string;
}

interface DashboardHeaderProps {
  // Project info
  projectName?: string;
  projects?: Project[];
  activeProjectId?: string;
  onProjectChange?: (projectId: string) => void;

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
  isCompact: boolean;
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function DashboardHeader({
  projects,
  activeProjectId,
  onProjectChange,
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
  isCompact,
  isCollapsed,
  onCollapsedChange,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const [showGoalsDropdown, setShowGoalsDropdown] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editGoals, setEditGoals] = useState('');
  const [editMetrikaCounterId, setEditMetrikaCounterId] = useState('');
  const [editMetrikaToken, setEditMetrikaToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const activeConnection = connections.find((c) => c.id === activeConnectionId);

  // Открытие модалки редактирования
  const openEditModal = () => {
    if (activeConnection) {
      // Парсим текущие цели из connection
      let goals: string[] = [];
      if (activeConnection.conversionGoals) {
        try {
          goals = JSON.parse(activeConnection.conversionGoals);
        } catch {
          goals = [];
        }
      }
      setEditGoals(goals.join(', '));
      setEditMetrikaCounterId((activeConnection as any).metrikaCounterId || '');
      setEditMetrikaToken((activeConnection as any).metrikaToken || '');
    }
    setShowAccountMenu(false);
    setShowEditModal(true);
  };

  // Сохранение изменений подключения
  const handleSaveConnection = async () => {
    if (!activeConnection) return;

    setIsSaving(true);
    try {
      const goals = editGoals
        .split(/[,\s\n]+/)
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      const response = await fetch(
        `${API_BASE_URL}/api/yandex/connection/${activeConnection.id}`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            conversionGoals: goals,
            metrikaCounterId: editMetrikaCounterId || undefined,
            metrikaToken: editMetrikaToken || undefined,
          }),
        }
      );

      if (response.ok) {
        setShowEditModal(false);
        window.location.reload(); // Перезагружаем для обновления данных
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.error || 'Не удалось сохранить'}`);
      }
    } catch (error) {
      alert('Ошибка при сохранении');
    } finally {
      setIsSaving(false);
    }
  };

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
        className={`sticky top-[41px] z-20 mb-6 -mx-8 px-8 -mt-8 pt-4 pb-2 bg-gray-50 ${
          isCollapsed ? 'hidden' : ''
        }`}
      >
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-300 ease-in-out ${
          isCompact ? 'p-3' : 'p-4'
        }`}>
          {/* Первая строка: Проект + Аккаунт + Синхронизация + Кнопка обновления - скрывается при скролле */}
          <div className={`flex items-center justify-between gap-4 flex-wrap overflow-hidden transition-all duration-300 ease-in-out ${
            isCompact ? 'max-h-0 opacity-0 mb-0' : 'max-h-[100px] opacity-100 mb-4'
          }`}>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Селектор проекта */}
              {projects && projects.length > 0 && onProjectChange && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <Folder size={14} className="text-gray-500" />
                    Проект
                  </label>
                  <select
                    value={activeProjectId || ''}
                    onChange={(e) => onProjectChange(e.target.value)}
                    className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm font-medium text-green-900 focus:ring-2 focus:ring-green-400 focus:border-transparent min-w-[180px]"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                              onClick={openEditModal}
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

              {/* Время синхронизации */}
              {activeConnection && (
                <div className="flex items-center gap-2 text-sm text-gray-500 self-end pb-2">
                  <Clock size={14} />
                  <span>Синхронизация: {formatLastSync(lastSyncAt)}</span>
                </div>
              )}
            </div>

            {/* Кнопка обновления */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 self-end"
            >
              {isSyncing ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              {isSyncing ? 'Синхронизация...' : 'Обновить данные'}
            </button>
          </div>

          {/* Вторая строка: Фильтры данных + Фильтры кампаний */}
          <div className={`flex items-start gap-4 flex-wrap ${isCompact ? '' : 'mt-4 pt-4 border-t border-gray-200'}`}>
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
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[150px] text-left flex items-center justify-between gap-2"
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
                Группировка
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

            {/* Разделитель */}
            {filterCampaignOptions.length > 0 && (
              <div className="h-10 w-px bg-gray-200 self-end mb-0.5" />
            )}

            {/* Фильтр по кампании */}
            {filterCampaignOptions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Megaphone size={14} className="text-gray-500" />
                  Кампания
                </label>
                <select
                  value={globalFilterCampaignId || ''}
                  onChange={(e) => onCampaignFilterChange(e.target.value || null)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[180px]"
                >
                  <option value="">Все кампании</option>
                  {filterCampaignOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Фильтр по группе */}
            {globalFilterCampaignId && filterAdGroupOptions.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <Folder size={14} className="text-gray-500" />
                  Группа
                </label>
                <select
                  value={globalFilterAdGroupId || ''}
                  onChange={(e) => onAdGroupFilterChange(e.target.value || null)}
                  className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm font-medium text-purple-900 focus:ring-2 focus:ring-purple-400 focus:border-transparent min-w-[180px]"
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
                  className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm font-medium text-orange-900 focus:ring-2 focus:ring-orange-400 focus:border-transparent min-w-[180px]"
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

            {/* Кнопка сброса фильтров кампаний */}
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
        </div>
      </div>

      {/* Кнопка разворачивания - справа, как и кнопка сворачивания */}
      {isCollapsed && (
        <div className="sticky top-[41px] z-20 mb-4 -mx-8 px-8 -mt-8 pt-2 flex justify-end">
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

      {/* Модальное окно редактирования подключения - через Portal для корректного z-index */}
      {showEditModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowEditModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Редактировать подключение
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Аккаунт */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Аккаунт
                </label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700 font-medium">
                  {activeConnection?.login}
                </div>
              </div>

              {/* ID целей */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID целей для отслеживания конверсий
                </label>
                <textarea
                  value={editGoals}
                  onChange={(e) => setEditGoals(e.target.value)}
                  rows={3}
                  placeholder="252254424, 293622736, 293622699"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Введите ID целей через запятую или с новой строки
                </p>
              </div>

              {/* ID счетчика Метрики */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID счетчика Яндекс.Метрики (опционально)
                </label>
                <input
                  type="text"
                  value={editMetrikaCounterId}
                  onChange={(e) => setEditMetrikaCounterId(e.target.value)}
                  placeholder="12345678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Токен Метрики */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OAuth токен Яндекс.Метрики (опционально)
                </label>
                <input
                  type="text"
                  value={editMetrikaToken}
                  onChange={(e) => setEditMetrikaToken(e.target.value)}
                  placeholder="y0_AgA..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                />
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveConnection}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
