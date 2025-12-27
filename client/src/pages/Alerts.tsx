import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  X,
  Settings,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Target,
  DollarSign,
  Eye,
  ChevronRight,
  Send,
  Link,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Alert {
  id: string;
  connectionId: string;
  userId: string;
  type: 'critical' | 'warning' | 'info';
  category: 'budget' | 'ctr' | 'conversions' | 'cpl' | 'impressions' | 'anomaly';
  title: string;
  message: string;
  campaignId?: string;
  campaignName?: string;
  metricName?: string;
  previousValue?: number;
  currentValue?: number;
  changePercent?: number;
  threshold?: number;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

interface AlertSettings {
  emailNotifications: boolean;
  telegramNotifications: boolean;
  telegramChatId?: string;
  dailyDigest: boolean;
  digestTime: string;
  monitorBudget: boolean;
  monitorCtr: boolean;
  monitorConversions: boolean;
  monitorCpl: boolean;
  monitorImpressions: boolean;
  budgetThreshold: number;
  ctrDropThreshold: number;
  conversionsDropThreshold: number;
  cplIncreaseThreshold: number;
  impressionsDropThreshold: number;
}

const fetchAlerts = async (): Promise<Alert[]> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/alerts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  return data.data || [];
};

const fetchSettings = async (): Promise<AlertSettings> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/alerts/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  return data.data;
};

const markAsRead = async (alertId: string): Promise<void> => {
  const token = localStorage.getItem('token');
  await fetch(`${API_BASE_URL}/api/alerts/${alertId}/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
};

const dismissAlert = async (alertId: string): Promise<void> => {
  const token = localStorage.getItem('token');
  await fetch(`${API_BASE_URL}/api/alerts/${alertId}/dismiss`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
};

const markAllAsRead = async (): Promise<void> => {
  const token = localStorage.getItem('token');
  await fetch(`${API_BASE_URL}/api/alerts/read-all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
};

const updateSettings = async (settings: Partial<AlertSettings>): Promise<void> => {
  const token = localStorage.getItem('token');
  await fetch(`${API_BASE_URL}/api/alerts/settings`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });
};

interface TelegramStatus {
  isConfigured: boolean;
  isConnected: boolean;
  username?: string;
  firstName?: string;
}

const fetchTelegramStatus = async (): Promise<TelegramStatus> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/telegram/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  return data.data;
};

const fetchTelegramLink = async (): Promise<string> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/telegram/connect-link`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  return data.data.link;
};

const disconnectTelegram = async (): Promise<void> => {
  const token = localStorage.getItem('token');
  await fetch(`${API_BASE_URL}/api/telegram/disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
};

const sendTestMessage = async (): Promise<void> => {
  const token = localStorage.getItem('token');
  await fetch(`${API_BASE_URL}/api/telegram/test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
};

export default function Alerts() {
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const [telegramLink, setTelegramLink] = useState<string | null>(null);

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
  });

  const { data: settings } = useQuery({
    queryKey: ['alertSettings'],
    queryFn: fetchSettings,
  });

  const { data: telegramStatus, refetch: refetchTelegram } = useQuery({
    queryKey: ['telegramStatus'],
    queryFn: fetchTelegramStatus,
  });

  const markAsReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: dismissAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alertSettings'] }),
  });

  const disconnectTelegramMutation = useMutation({
    mutationFn: disconnectTelegram,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegramStatus'] });
      setTelegramLink(null);
    },
  });

  const testMessageMutation = useMutation({
    mutationFn: sendTestMessage,
  });

  const handleGetTelegramLink = async () => {
    try {
      const link = await fetchTelegramLink();
      setTelegramLink(link);
      window.open(link, '_blank');
    } catch (error) {
      console.error('Failed to get Telegram link:', error);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'unread') return !alert.isRead;
    if (filter === 'critical') return alert.type === 'critical';
    return true;
  });

  const unreadCount = alerts.filter(a => !a.isRead).length;

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="text-red-500" size={20} />;
      case 'warning':
        return <AlertTriangle className="text-amber-500" size={20} />;
      case 'info':
        return <Info className="text-blue-500" size={20} />;
    }
  };

  const getCategoryIcon = (category: Alert['category']) => {
    switch (category) {
      case 'budget':
        return <DollarSign size={16} />;
      case 'ctr':
        return <TrendingUp size={16} />;
      case 'conversions':
        return <Target size={16} />;
      case 'cpl':
        return <TrendingDown size={16} />;
      case 'impressions':
        return <Eye size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const getAlertBgColor = (type: Alert['type'], isRead: boolean) => {
    if (isRead) return 'bg-gray-50';
    switch (type) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Bell className="text-primary-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Уведомления</h1>
            <p className="text-gray-600">
              {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Нет новых уведомлений'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Обновить"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings
                ? 'bg-primary-100 text-primary-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Настройки"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && settings && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Настройки уведомлений</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Notification channels */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Каналы уведомлений</h3>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) =>
                    updateSettingsMutation.mutate({ emailNotifications: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-primary-600"
                />
                <span>Email уведомления</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.telegramNotifications}
                  onChange={(e) =>
                    updateSettingsMutation.mutate({ telegramNotifications: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-primary-600"
                />
                <span>Telegram уведомления</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.dailyDigest}
                  onChange={(e) =>
                    updateSettingsMutation.mutate({ dailyDigest: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-primary-600"
                />
                <span>Ежедневный дайджест</span>
              </label>
            </div>

            {/* Thresholds */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Пороги срабатывания</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Падение CTR</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.ctrDropThreshold}
                      onChange={(e) =>
                        updateSettingsMutation.mutate({
                          ctrDropThreshold: parseInt(e.target.value),
                        })
                      }
                      className="w-16 px-2 py-1 border rounded text-right"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Падение конверсий</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.conversionsDropThreshold}
                      onChange={(e) =>
                        updateSettingsMutation.mutate({
                          conversionsDropThreshold: parseInt(e.target.value),
                        })
                      }
                      className="w-16 px-2 py-1 border rounded text-right"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Рост CPL</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.cplIncreaseThreshold}
                      onChange={(e) =>
                        updateSettingsMutation.mutate({
                          cplIncreaseThreshold: parseInt(e.target.value),
                        })
                      }
                      className="w-16 px-2 py-1 border rounded text-right"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Section */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <Send size={16} />
              Telegram
            </h3>

            {telegramStatus?.isConfigured ? (
              telegramStatus.isConnected ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-800 font-medium flex items-center gap-2">
                        <Check size={16} />
                        Telegram подключён
                      </p>
                      <p className="text-green-600 text-sm mt-1">
                        {telegramStatus.firstName && `${telegramStatus.firstName} `}
                        {telegramStatus.username && `@${telegramStatus.username}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => testMessageMutation.mutate()}
                        disabled={testMessageMutation.isPending}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 flex items-center gap-1"
                      >
                        {testMessageMutation.isPending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                        Тест
                      </button>
                      <button
                        onClick={() => disconnectTelegramMutation.mutate()}
                        disabled={disconnectTelegramMutation.isPending}
                        className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                      >
                        Отключить
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 mb-3">
                    Подключите Telegram для получения уведомлений о важных событиях в реальном времени.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleGetTelegramLink}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Link size={16} />
                      Подключить Telegram
                    </button>
                    {telegramLink && (
                      <a
                        href={telegramLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        Открыть ссылку
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  <p className="text-blue-600 text-sm mt-3">
                    После перехода по ссылке нажмите Start в боте и обновите эту страницу.
                  </p>
                  <button
                    onClick={() => refetchTelegram()}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <RefreshCw size={14} />
                    Проверить подключение
                  </button>
                </div>
              )
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-600">
                  Telegram-бот не настроен. Обратитесь к администратору.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === 'unread'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Непрочитанные {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === 'critical'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Критические
          </button>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Отметить все как прочитанные
          </button>
        )}
      </div>

      {/* Alerts list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-gray-400" size={32} />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Bell className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">Нет уведомлений</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map(alert => (
            <div
              key={alert.id}
              className={`bg-white rounded-xl shadow-sm border p-4 transition-all ${getAlertBgColor(
                alert.type,
                alert.isRead
              )}`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">{getAlertIcon(alert.type)}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-medium ${alert.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                      {alert.title}
                    </h3>
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {getCategoryIcon(alert.category)}
                      {alert.category}
                    </span>
                    {!alert.isRead && (
                      <span className="w-2 h-2 bg-primary-500 rounded-full" />
                    )}
                  </div>
                  <p className={`text-sm ${alert.isRead ? 'text-gray-500' : 'text-gray-600'}`}>
                    {alert.message}
                  </p>

                  {/* Metrics */}
                  {alert.previousValue !== undefined && alert.currentValue !== undefined && (
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-gray-500">
                        {Math.round(alert.previousValue)} → {Math.round(alert.currentValue)}
                      </span>
                      {alert.changePercent !== undefined && (
                        <span
                          className={
                            alert.changePercent > 0 ? 'text-green-600' : 'text-red-600'
                          }
                        >
                          {alert.changePercent > 0 ? '+' : ''}
                          {alert.changePercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Campaign link */}
                  {alert.campaignName && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-primary-600">
                      <ChevronRight size={14} />
                      {alert.campaignName}
                    </div>
                  )}

                  {/* Time */}
                  <p className="text-xs text-gray-400 mt-2">
                    {format(new Date(alert.createdAt), 'd MMMM, HH:mm', { locale: ru })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!alert.isRead && (
                    <button
                      onClick={() => markAsReadMutation.mutate(alert.id)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Отметить как прочитанное"
                    >
                      <Check size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => dismissMutation.mutate(alert.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Скрыть"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
