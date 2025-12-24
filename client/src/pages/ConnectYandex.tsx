import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { projectsService, API_BASE_URL } from '../services/api';
import { useProjectStore } from '../store/projectStore';
import { Sparkles, AlertCircle, CheckCircle2, FolderOpen, Link as LinkIcon } from 'lucide-react';

// API Service для Yandex подключения
const yandexService = {
  async getAuthUrl() {
    const response = await fetch(`${API_BASE_URL}/api/yandex/auth-url`);
    return response.json();
  },

  async connect(data: {
    code: string;
    projectId: string;
    metrikaCounterId?: string;
    metrikaToken?: string;
    conversionGoals?: string[];
  }) {
    const response = await fetch(`${API_BASE_URL}/api/yandex/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to connect');
    }

    return response.json();
  },

  async getMetrikaGoals(counterId: string, token: string) {
    const response = await fetch(
      `${API_BASE_URL}/api/yandex/metrika/goals/${counterId}?token=${encodeURIComponent(token)}`
    );
    return response.json();
  },
};

export default function ConnectYandex() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const codeFromUrl = searchParams.get('code');

  const { activeProjectId, setActiveProjectId } = useProjectStore();
  const selectedProjectId = activeProjectId || '';
  const [metrikaCounterId, setMetrikaCounterId] = useState<string>('');
  const [metrikaToken, setMetrikaToken] = useState<string>('');
  const [conversionGoals, setConversionGoals] = useState<string[]>([]);
  const [availableGoals, setAvailableGoals] = useState<any[]>([]);

  // Загрузка проектов
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
  });

  // Получение URL для авторизации
  const { data: authData } = useQuery({
    queryKey: ['yandex-auth-url'],
    queryFn: () => yandexService.getAuthUrl(),
    enabled: !codeFromUrl,
  });

  // Подключение Яндекс.Директ
  const connectMutation = useMutation({
    mutationFn: (data: any) => yandexService.connect(data),
    onSuccess: () => {
      navigate('/dashboard');
    },
  });

  // Автоматическое подключение если есть code в URL
  useEffect(() => {
    if (codeFromUrl && selectedProjectId && !connectMutation.isPending) {
      connectMutation.mutate({
        code: codeFromUrl,
        projectId: selectedProjectId,
        metrikaCounterId,
        metrikaToken,
        conversionGoals,
      });
    }
  }, [codeFromUrl, selectedProjectId]);

  // Загрузка целей из Метрики
  const loadMetrikaGoals = async () => {
    if (!metrikaCounterId || !metrikaToken) return;

    try {
      const goals = await yandexService.getMetrikaGoals(metrikaCounterId, metrikaToken);
      setAvailableGoals(goals);
    } catch (error) {
      console.error('Failed to load Metrika goals:', error);
    }
  };

  const handleConnect = () => {
    if (!authData?.authUrl) return;
    window.location.href = authData.authUrl;
  };

  // Если есть code в URL, показываем экран подключения
  if (codeFromUrl) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <LinkIcon className="text-blue-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Подключение Яндекс.Директ
            </h1>
            <p className="text-gray-600">
              Выберите проект для подключения аналитики
            </p>
          </div>

          {connectMutation.isPending ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
              <p className="text-gray-600">Подключение...</p>
            </div>
          ) : connectMutation.isError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-semibold text-red-900">Ошибка подключения</p>
                  <p className="text-sm text-red-700 mt-1">
                    {(connectMutation.error as any)?.message || 'Не удалось подключить Яндекс.Директ'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите проект *
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setActiveProjectId(e.target.value || null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">Выберите проект...</option>
                  {projects.map((project: any) => (
                    <option key={project.id} value={project.id}>
                      {project.name} — {project.brief.niche}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Настройки Яндекс.Метрики (опционально)
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      ID счетчика Метрики
                    </label>
                    <input
                      type="text"
                      value={metrikaCounterId}
                      onChange={(e) => setMetrikaCounterId(e.target.value)}
                      placeholder="12345678"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      OAuth токен Метрики
                    </label>
                    <input
                      type="text"
                      value={metrikaToken}
                      onChange={(e) => setMetrikaToken(e.target.value)}
                      placeholder="y0_AgA..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm font-mono"
                    />
                  </div>

                  {metrikaCounterId && metrikaToken && (
                    <button
                      onClick={loadMetrikaGoals}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Загрузить цели из Метрики
                    </button>
                  )}

                  {availableGoals.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Выберите цели для отслеживания
                      </label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {availableGoals.map((goal: any) => (
                          <label key={goal.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={conversionGoals.includes(String(goal.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setConversionGoals([...conversionGoals, String(goal.id)]);
                                } else {
                                  setConversionGoals(conversionGoals.filter(id => id !== String(goal.id)));
                                }
                              }}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-gray-700">{goal.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!selectedProjectId && (
                <p className="text-sm text-amber-600 text-center">
                  Выберите проект для завершения подключения
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Начальный экран с кнопкой подключения
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Подключить Яндекс.Директ</h1>
        <p className="mt-2 text-gray-600">
          Подключите аккаунт Яндекс.Директ для автоматической выгрузки статистики и AI-анализа кампаний
        </p>
      </div>

      <div className="bg-gradient-to-r from-primary-500 to-blue-600 rounded-xl shadow-lg p-8 text-white mb-8">
        <div className="flex items-start gap-6">
          <div className="bg-white/20 p-4 rounded-xl">
            <Sparkles size={48} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-3">Что вы получите</h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
                <span>Автоматическая выгрузка данных из Яндекс.Директ и Метрики каждые 30 минут</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
                <span>Красивый дашборд с визуализацией всех ключевых метрик</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
                <span>AI-анализ кампаний с автоматическими рекомендациями по оптимизации</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
                <span>Подсветка проблемных зон (низкий CTR, нет конверсий, высокий CPC)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
                <span>История изменений и трекинг всех действий</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Подключение</h3>

        {projects.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-yellow-900">Сначала создайте проект</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Для подключения Яндекс.Директ необходим проект.{' '}
                  <a href="/projects/new" className="underline hover:text-yellow-900">
                    Создать проект
                  </a>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-6">
              Нажмите кнопку ниже для авторизации в Яндекс.Директ. Вам будет предложено войти в аккаунт Яндекса
              и разрешить доступ к API.
            </p>

            <button
              onClick={handleConnect}
              disabled={!authData?.authUrl}
              className="w-full bg-primary-600 text-white py-4 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-lg"
            >
              <LinkIcon size={24} />
              {authData?.authUrl ? 'Подключить Яндекс.Директ' : 'Загрузка...'}
            </button>
          </>
        )}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Важно:</strong> Для подключения вам потребуется:
        </p>
        <ul className="mt-2 text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Аккаунт Яндекс с доступом к Яндекс.Директ</li>
          <li>Активные рекламные кампании</li>
          <li>Опционально: OAuth токен для Яндекс.Метрики (для отслеживания конверсий)</li>
        </ul>
      </div>
    </div>
  );
}
