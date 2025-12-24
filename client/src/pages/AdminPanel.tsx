import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { Navigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
  projectsCount: number;
  connectionsCount: number;
}

interface UserDetails {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
  projects: Array<{
    id: string;
    name: string;
    brief: { businessName: string; niche: string };
    connections: Array<{
      id: string;
      login: string;
      status: string;
      lastSyncAt: string;
    }>;
  }>;
}

interface SystemStats {
  users: { total: number; admins: number };
  projects: { total: number; withSemantics: number; withAds: number };
  connections: { total: number; active: number };
  storage: {
    clickhouse: {
      totalRows: number;
      diskUsageMB: number;
      tables: Array<{ name: string; rows: number; sizeMB: number }>;
    };
    dataFiles: { sizeMB: number };
  };
  server: {
    uptime: number;
    memoryUsageMB: number;
    nodeVersion: string;
  };
}

interface UsageData {
  period: string;
  system: {
    totalAiRequests: number;
    totalAiTokens: number;
    totalYandexSyncs: number;
    totalApiRequests: number;
    estimatedTotalCostRub: number;
    activeUsers: number;
  };
  users: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    totalAiRequests: number;
    totalAiTokens: number;
    totalYandexSyncs: number;
    totalApiRequests: number;
    estimatedCostRub: number;
    lastActivityDate: string;
  }>;
}

const adminService = {
  async getUsers(): Promise<User[]> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  async getUserDetails(userId: string): Promise<UserDetails> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch user details');
    return response.json();
  },

  async deleteUser(userId: string): Promise<void> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to delete user');
  },

  async toggleAdmin(userId: string, isAdmin: boolean): Promise<void> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/admin`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isAdmin }),
    });
    if (!response.ok) throw new Error('Failed to update admin status');
  },

  async getStats(): Promise<SystemStats> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },

  async getUsage(days: number = 30): Promise<UsageData> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/admin/usage?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch usage');
    return response.json();
  },
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}д ${hours}ч ${mins}м`;
  if (hours > 0) return `${hours}ч ${mins}м`;
  return `${mins}м`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminPanel() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'usage'>('users');
  const [usageDays, setUsageDays] = useState(30);

  // Если не админ - редирект
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminService.getUsers,
  });

  const { data: userDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['admin-user-details', selectedUserId],
    queryFn: () => adminService.getUserDetails(selectedUserId!),
    enabled: !!selectedUserId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminService.getStats,
    refetchInterval: 30000, // Обновлять каждые 30 сек
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['admin-usage', usageDays],
    queryFn: () => adminService.getUsage(usageDays),
    refetchInterval: 60000, // Обновлять каждую минуту
  });

  const deleteMutation = useMutation({
    mutationFn: adminService.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedUserId(null);
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      adminService.toggleAdmin(userId, isAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-details'] });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Админ-панель</h1>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Пользователи
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'stats'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Статистика системы
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'usage'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Использование
          </button>
        </div>

        {activeTab === 'stats' && (
          <div className="space-y-6">
            {statsLoading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : stats ? (
              <>
                {/* Общая статистика */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm text-gray-500">Пользователей</div>
                    <div className="text-3xl font-bold text-gray-900">{stats.users.total}</div>
                    <div className="text-sm text-gray-500">{stats.users.admins} админов</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm text-gray-500">Проектов</div>
                    <div className="text-3xl font-bold text-gray-900">{stats.projects.total}</div>
                    <div className="text-sm text-gray-500">{stats.projects.withAds} с рекламой</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm text-gray-500">Подключений Яндекса</div>
                    <div className="text-3xl font-bold text-gray-900">{stats.connections.total}</div>
                    <div className="text-sm text-green-600">{stats.connections.active} активных</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm text-gray-500">Uptime сервера</div>
                    <div className="text-3xl font-bold text-gray-900">
                      {formatUptime(stats.server.uptime)}
                    </div>
                    <div className="text-sm text-gray-500">
                      RAM: {stats.server.memoryUsageMB} MB
                    </div>
                  </div>
                </div>

                {/* Хранилище */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Использование хранилища</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">ClickHouse</h4>
                      <div className="text-2xl font-bold text-blue-600">
                        {stats.storage.clickhouse.diskUsageMB.toFixed(2)} MB
                      </div>
                      <div className="text-sm text-gray-500 mb-4">
                        {stats.storage.clickhouse.totalRows.toLocaleString()} записей
                      </div>
                      <div className="space-y-2">
                        {stats.storage.clickhouse.tables.slice(0, 5).map((table) => (
                          <div key={table.name} className="flex justify-between text-sm">
                            <span className="text-gray-600">{table.name}</span>
                            <span className="text-gray-900">
                              {table.sizeMB.toFixed(2)} MB ({table.rows.toLocaleString()} rows)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Файлы данных</h4>
                      <div className="text-2xl font-bold text-green-600">
                        {stats.storage.dataFiles.sizeMB.toFixed(2)} MB
                      </div>
                      <div className="text-sm text-gray-500">projects.json, users.json</div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-6">
            {/* Период */}
            <div className="flex items-center gap-4">
              <span className="text-gray-600">Период:</span>
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setUsageDays(d)}
                  className={`px-3 py-1 rounded ${
                    usageDays === d
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {d} дней
                </button>
              ))}
            </div>

            {usageLoading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : usage ? (
              <>
                {/* Общая статистика использования */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm text-gray-500">AI запросов</div>
                    <div className="text-3xl font-bold text-purple-600">
                      {usage.system.totalAiRequests.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      ~{Math.round(usage.system.totalAiTokens / 1000)}K токенов
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm text-gray-500">Синхр. Яндекса</div>
                    <div className="text-3xl font-bold text-orange-600">
                      {usage.system.totalYandexSyncs.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm text-gray-500">API запросов</div>
                    <div className="text-3xl font-bold text-blue-600">
                      {usage.system.totalApiRequests.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm text-gray-500">Активных юзеров</div>
                    <div className="text-3xl font-bold text-green-600">
                      {usage.system.activeUsers}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-sm text-gray-500">Оценка расходов</div>
                    <div className="text-3xl font-bold text-red-600">
                      {usage.system.estimatedTotalCostRub.toLocaleString()} ₽
                    </div>
                    <div className="text-sm text-gray-500">за {usageDays} дней</div>
                  </div>
                </div>

                {/* Таблица использования по пользователям */}
                <div className="bg-white rounded-lg shadow">
                  <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold">Использование по пользователям</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Пользователь</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">AI запросы</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Токены</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Синхр.</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">API</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Расход ₽</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Активность</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {usage.users.map((u) => (
                          <tr key={u.userId} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{u.userName}</div>
                              <div className="text-gray-500 text-xs">{u.userEmail}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {u.totalAiRequests.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-500">
                              {Math.round(u.totalAiTokens / 1000)}K
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {u.totalYandexSyncs.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-500">
                              {u.totalApiRequests.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-medium ${
                                u.estimatedCostRub > 100 ? 'text-red-600' :
                                u.estimatedCostRub > 50 ? 'text-orange-600' : 'text-green-600'
                              }`}>
                                {u.estimatedCostRub.toFixed(2)} ₽
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">
                              {u.lastActivityDate}
                            </td>
                          </tr>
                        ))}
                        {usage.users.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                              Нет данных за выбранный период
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Список пользователей */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Пользователи ({users?.length || 0})</h2>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {usersLoading ? (
                  <div className="p-4 text-center text-gray-500">Загрузка...</div>
                ) : (
                  users?.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 ${
                        selectedUserId === u.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {u.name}
                            {u.isAdmin && (
                              <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <div>{u.projectsCount} проектов</div>
                          <div>{u.connectionsCount} подкл.</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Детали пользователя */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow">
              {selectedUserId ? (
                detailsLoading ? (
                  <div className="p-8 text-center text-gray-500">Загрузка...</div>
                ) : userDetails ? (
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{userDetails.name}</h2>
                        <div className="text-gray-500">{userDetails.email}</div>
                        <div className="text-sm text-gray-400 mt-1">
                          Зарегистрирован: {formatDate(userDetails.createdAt)}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() =>
                            toggleAdminMutation.mutate({
                              userId: userDetails.id,
                              isAdmin: !userDetails.isAdmin,
                            })
                          }
                          className={`px-3 py-1.5 rounded text-sm font-medium ${
                            userDetails.isAdmin
                              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {userDetails.isAdmin ? 'Снять админа' : 'Сделать админом'}
                        </button>
                        {userDetails.id !== user?.id && (
                          <button
                            onClick={() => {
                              if (confirm('Удалить пользователя?')) {
                                deleteMutation.mutate(userDetails.id);
                              }
                            }}
                            className="px-3 py-1.5 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold mb-4">
                      Проекты ({userDetails.projects.length})
                    </h3>
                    <div className="space-y-4">
                      {userDetails.projects.map((project) => (
                        <div key={project.id} className="border rounded-lg p-4">
                          <div className="font-medium text-gray-900">{project.name}</div>
                          <div className="text-sm text-gray-500">
                            {project.brief.businessName} • {project.brief.niche}
                          </div>
                          {project.connections.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <div className="text-sm font-medium text-gray-700">Подключения:</div>
                              {project.connections.map((conn) => (
                                <div
                                  key={conn.id}
                                  className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2"
                                >
                                  <span className="font-mono">{conn.login}</span>
                                  <div className="flex items-center space-x-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs ${
                                        conn.status === 'active'
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {conn.status}
                                    </span>
                                    <span className="text-gray-500">
                                      {conn.lastSyncAt
                                        ? formatDate(conn.lastSyncAt)
                                        : 'Не синхр.'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {userDetails.projects.length === 0 && (
                        <div className="text-gray-500 text-center py-4">Нет проектов</div>
                      )}
                    </div>
                  </div>
                ) : null
              ) : (
                <div className="p-8 text-center text-gray-500">
                  Выберите пользователя для просмотра деталей
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
