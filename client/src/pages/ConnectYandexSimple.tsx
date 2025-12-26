import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { projectsService, API_BASE_URL } from '../services/api';
import { useProjectStore } from '../store/projectStore';
import { Sparkles, AlertCircle, CheckCircle2, Key, User, ExternalLink } from 'lucide-react';

const yandexService = {
  async connectSimple(data: {
    accessToken: string;
    login: string;
    projectId: string;
    conversionGoals?: string[];
  }) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/yandex/connect-simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to connect');
    }

    return response.json();
  },
};

export default function ConnectYandexSimple() {
  const navigate = useNavigate();
  const { activeProjectId, setActiveProjectId } = useProjectStore();
  const selectedProjectId = activeProjectId || '';
  const [accessToken, setAccessToken] = useState<string>('');
  const [login, setLogin] = useState<string>('');
  const [goalIds, setGoalIds] = useState<string>('');

  // Загрузка проектов
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
  });

  // Подключение Яндекс.Директ
  const connectMutation = useMutation({
    mutationFn: () => {
      // Парсим ID целей из строки (разделены запятыми, пробелами или переносами)
      const goals = goalIds
        .split(/[,\s\n]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      return yandexService.connectSimple({
        accessToken,
        login,
        projectId: selectedProjectId,
        conversionGoals: goals,
      });
    },
    onSuccess: () => {
      navigate('/yandex-dashboard');
    },
  });

  const handleConnect = () => {
    connectMutation.mutate();
  };

  const canConnect = accessToken && login && selectedProjectId;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Подключить Яндекс.Директ (Упрощенный режим)</h1>
        <p className="mt-2 text-gray-600">
          Быстрое подключение через токен доступа без OAuth
        </p>
      </div>

      {/* Инструкция */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
          <Sparkles className="text-blue-600" size={20} />
          Как получить токен доступа
        </h3>
        <ol className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="font-bold min-w-[24px]">1.</span>
            <div>
              Перейдите по ссылке для получения токена:
              <div className="mt-2 p-3 bg-white rounded-lg font-mono text-xs break-all">
                <a
                  href="https://oauth.yandex.ru/authorize?response_type=token&client_id=361b531e8f114f2884f12e8897fefa9a"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-2"
                >
                  Получить токен доступа
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold min-w-[24px]">2.</span>
            <span>Авторизуйтесь в Яндексе и разрешите доступ к API</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold min-w-[24px]">3.</span>
            <span>Скопируйте токен из URL после <code className="bg-white px-1 rounded">#access_token=</code></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold min-w-[24px]">4.</span>
            <span>Вставьте токен и логин в форму ниже</span>
          </li>
        </ol>
      </div>

      {/* Форма подключения */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Настройки подключения</h2>

        {/* Выбор проекта */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Проект *
          </label>
          {projects.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-yellow-900">У вас пока нет проектов</p>
                <p className="text-xs text-yellow-700 mt-1">
                  <a href="/projects/new" className="underline hover:text-yellow-900">
                    Создайте проект
                  </a>
                  {' '}для подключения Яндекс.Директ
                </p>
              </div>
            </div>
          ) : (
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
          )}
        </div>

        {/* Токен доступа */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Key size={16} />
            Токен доступа (Access Token) *
          </label>
          <input
            type="text"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="y0_AgA..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Токен из URL после авторизации
          </p>
        </div>

        {/* Логин */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <User size={16} />
            Логин аккаунта Яндекс.Директ *
          </label>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="example-agency"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Логин клиента в Яндекс.Директ (для агентств - логин клиента, для прямых рекламодателей - ваш логин)
          </p>
        </div>

        {/* ID целей */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            📊 ID целей для отслеживания (опционально)
          </h3>
          <p className="text-xs text-gray-600 mb-3">
            Введите ID целей из Яндекс.Метрики (например: заявка, квалификация, встреча, продажа).
            Можно указать несколько через запятую или с новой строки.
          </p>
          <textarea
            value={goalIds}
            onChange={(e) => setGoalIds(e.target.value)}
            rows={3}
            placeholder="252254424, 293622736, 293622699"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            ID целей можно найти в настройках кампаний Яндекс.Директ или в Яндекс.Метрике
          </p>
        </div>

        {/* Кнопка подключения */}
        <button
          onClick={handleConnect}
          disabled={!canConnect || connectMutation.isPending}
          className="w-full bg-primary-600 text-white py-4 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-lg"
        >
          <CheckCircle2 size={24} />
          {connectMutation.isPending ? 'Подключение...' : 'Подключить Яндекс.Директ'}
        </button>

        {connectMutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
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
        )}

        {connectMutation.isSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-semibold text-green-900">Успешно подключено!</p>
                <p className="text-sm text-green-700 mt-1">
                  Данные синхронизируются... Переадресация на дашборд...
                </p>
              </div>
            </div>
          </div>
        )}

        {!selectedProjectId && projects.length > 0 && (
          <p className="text-sm text-amber-600 text-center">
            ⚠️ Выберите проект для подключения
          </p>
        )}
      </div>

      {/* Что дальше */}
      <div className="mt-8 bg-gradient-to-r from-primary-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
        <h3 className="text-xl font-bold mb-3">После подключения</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
            <span>Автоматическая синхронизация данных каждые 30 минут</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
            <span>Красивый дашборд с визуализацией всех метрик</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
            <span>AI-анализ и рекомендации по оптимизации</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
            <span>История изменений и трекинг действий</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
