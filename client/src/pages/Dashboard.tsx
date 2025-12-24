import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsService } from '../services/api';
import { useProjectStore } from '../store/projectStore';
import {
  TrendingUp,
  FileText,
  MessageSquare,
  Lightbulb,
  Megaphone,
  Target,
  Filter,
  FolderOpen,
  Plus,
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  BarChart3,
  Zap,
  Clock,
  FlaskConical,
  ChevronDown
} from 'lucide-react';

export default function Dashboard() {
  const { activeProjectId, setActiveProjectId } = useProjectStore();
  const [showProjectSelector, setShowProjectSelector] = useState(false);

  // Загружаем проекты пользователя
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
  });

  // Находим активный проект или берём первый
  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // Устанавливаем первый проект как активный, если нет выбранного
  useEffect(() => {
    if (projects.length > 0 && !activeProjectId) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId, setActiveProjectId]);

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setShowProjectSelector(false);
  };

  // Определяем статус каждого модуля для активного проекта
  const getModuleStatus = (field: string) => {
    if (!activeProject) return 'empty';
    if (activeProject[field]) return 'completed';
    return 'empty';
  };

  const modules = [
    {
      id: 'yandexDashboard',
      name: 'Аналитика кампаний',
      description: 'Яндекс.Директ и Метрика',
      icon: BarChart3,
      href: '/yandex-dashboard',
      color: 'bg-red-500',
      status: 'empty', // Статус определяется по подключению
    },
    {
      id: 'analytics',
      name: 'Аналитика',
      description: 'Анализ ЦА, конкурентов и медиаплан',
      icon: TrendingUp,
      href: '/analytics',
      color: 'bg-indigo-500',
      status: getModuleStatus('analytics'),
      stats: activeProject?.analytics ? {
        segments: activeProject.analytics.targetAudienceAnalysis?.segments?.length || 0,
        mediaPlan: !!activeProject.analytics.mediaPlan,
      } : null,
    },
    {
      id: 'keywordAnalysis',
      name: 'Анализ запросов',
      description: 'Классификация и минус-слова',
      icon: FlaskConical,
      href: '/keyword-analysis',
      color: 'bg-purple-500',
      status: getModuleStatus('keywordAnalysis'),
      stats: activeProject?.keywordAnalysis ? {
        total: activeProject.keywordAnalysis.statistics.total,
        target: activeProject.keywordAnalysis.statistics.target,
        minusWords: activeProject.keywordAnalysis.minusWords.length,
      } : null,
    },
    {
      id: 'ads',
      name: 'Объявления',
      description: 'Генерация объявлений с AI',
      icon: MessageSquare,
      href: '/ads',
      color: 'bg-green-500',
      status: getModuleStatus('completeAds'),
      stats: activeProject?.completeAds ? {
        count: activeProject.completeAds.ads.length,
        type: activeProject.completeAds.campaignType === 'search' ? 'Поиск' : 'РСЯ',
      } : null,
    },
    {
      id: 'semantics',
      name: 'Семантика',
      description: 'Сбор поисковых запросов',
      icon: FileText,
      href: '/semantics',
      color: 'bg-blue-500',
      status: getModuleStatus('semantics'),
      stats: activeProject?.semantics ? {
        keywords: activeProject.semantics.keywords.length,
      } : null,
    },
    {
      id: 'creatives',
      name: 'Креативы',
      description: 'Идеи для рекламных материалов',
      icon: Lightbulb,
      href: '/creatives',
      color: 'bg-yellow-500',
      status: getModuleStatus('creatives'),
      stats: activeProject?.creatives ? {
        ideas: activeProject.creatives.ideas.length,
      } : null,
    },
    {
      id: 'campaign',
      name: 'Кампании',
      description: 'Структура и экспорт кампаний',
      icon: Megaphone,
      href: '/campaign',
      color: 'bg-rose-500',
      status: getModuleStatus('campaigns'),
    },
    {
      id: 'strategy',
      name: 'Стратегия',
      description: 'План запуска и оптимизации',
      icon: Target,
      href: '/strategy',
      color: 'bg-red-500',
      status: getModuleStatus('strategy'),
    },
    {
      id: 'minusWords',
      name: 'Минус-слова',
      description: 'Автоматический подбор',
      icon: Filter,
      href: '/minus-words',
      color: 'bg-cyan-500',
      status: getModuleStatus('minusWords'),
      stats: activeProject?.minusWords ? {
        count: activeProject.minusWords.words.length,
      } : null,
    },
  ];

  const completedCount = modules.filter(m => m.status === 'completed').length;
  const progressPercent = Math.round((completedCount / modules.length) * 100);

  return (
    <div className="max-w-7xl">
      {/* Шапка с приветствием */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Добро пожаловать в Нейродиректолог Комбайн
        </h1>
        <p className="mt-2 text-gray-600">
          AI-платформа для полного цикла запуска рекламы в Яндекс.Директ
        </p>
      </div>

      {/* Активный проект */}
      {activeProject ? (
        <div className="mb-8 bg-gradient-to-r from-primary-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen size={24} />
                <h2 className="text-xl font-bold">Активный проект</h2>
              </div>

              {/* Выбор проекта */}
              {projects.length > 1 ? (
                <div className="relative">
                  <button
                    onClick={() => setShowProjectSelector(!showProjectSelector)}
                    className="flex items-center gap-2 text-2xl font-bold mb-1 hover:text-primary-100 transition-colors"
                  >
                    {activeProject.name}
                    <ChevronDown size={24} className={`transition-transform ${showProjectSelector ? 'rotate-180' : ''}`} />
                  </button>

                  {showProjectSelector && (
                    <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl py-2 min-w-[250px] z-50">
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => handleSelectProject(project.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                            project.id === activeProject.id ? 'bg-primary-50' : ''
                          }`}
                        >
                          <div className={`font-medium ${project.id === activeProject.id ? 'text-primary-600' : 'text-gray-900'}`}>
                            {project.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {project.brief.niche} • {project.brief.geo}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <h3 className="text-2xl font-bold mb-1">{activeProject.name}</h3>
              )}

              <p className="text-primary-100 text-sm">
                {activeProject.brief.niche} • {activeProject.brief.geo}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-primary-100 mb-1">Прогресс</div>
              <div className="text-4xl font-bold">{progressPercent}%</div>
              <div className="text-xs text-primary-100 mt-1">
                {completedCount} из {modules.length} модулей
              </div>
            </div>
          </div>

          {/* Прогресс-бар */}
          <div className="mt-4 bg-primary-400/30 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-4 flex gap-3">
            <Link
              to={`/projects/${activeProject.id}/edit`}
              className="bg-white text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors text-sm"
            >
              Редактировать проект
            </Link>
            <Link
              to="/projects"
              className="bg-primary-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-800 transition-colors text-sm"
            >
              Все проекты
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-8 bg-gradient-to-r from-primary-500 to-blue-600 rounded-xl shadow-lg p-8 text-white">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Начните работу</h2>
              <p className="text-primary-50 mb-6">
                Создайте первый проект с брифом и автоматизируйте все модули
              </p>
            </div>
            <FolderOpen size={48} className="opacity-20" />
          </div>
          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 bg-white text-primary-600 px-6 py-3 rounded-lg font-medium hover:bg-primary-50 transition-colors"
          >
            <Plus size={20} />
            Создать первый проект
          </Link>
        </div>
      )}

      {/* Статистика по модулям */}
      {activeProject && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle2 className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Завершено</p>
                <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Clock className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Создан</p>
                <p className="text-lg font-bold text-gray-900">
                  {new Date(activeProject.createdAt).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Zap className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Последнее обновление</p>
                <p className="text-lg font-bold text-gray-900">
                  {new Date(activeProject.updatedAt).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модули (карточки) */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 size={24} />
          Модули комбайна
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((module) => {
            const Icon = module.icon;
            const isCompleted = module.status === 'completed';

            return (
              <Link
                key={module.id}
                to={module.href}
                className={`bg-white rounded-xl shadow-sm border-2 p-5 hover:shadow-md transition-all group relative overflow-hidden ${
                  isCompleted ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                }`}
              >
                {/* Индикатор статуса */}
                <div className="absolute top-3 right-3">
                  {isCompleted ? (
                    <CheckCircle2 className="text-green-500" size={20} />
                  ) : (
                    <Circle className="text-gray-300" size={20} />
                  )}
                </div>

                {/* Иконка модуля */}
                <div className={`${module.color} p-3 rounded-lg inline-flex mb-3`}>
                  <Icon className="text-white" size={22} />
                </div>

                {/* Название */}
                <h3 className="text-base font-semibold text-gray-900 mb-1 pr-6">
                  {module.name}
                </h3>
                <p className="text-xs text-gray-600 mb-3">{module.description}</p>

                {/* Статистика (если есть) */}
                {module.stats && (
                  <div className="pt-3 border-t border-gray-200">
                    {module.id === 'analytics' && module.stats.segments > 0 && (
                      <p className="text-xs text-gray-700">
                        📊 {module.stats.segments} сегментов ЦА
                      </p>
                    )}
                    {module.id === 'keywordAnalysis' && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-700">
                          ✅ {module.stats.target} целевых из {module.stats.total}
                        </p>
                        <p className="text-xs text-gray-700">
                          ❌ {module.stats.minusWords} минус-слов
                        </p>
                      </div>
                    )}
                    {module.id === 'ads' && (
                      <p className="text-xs text-gray-700">
                        📢 {module.stats.count} объявлений ({module.stats.type})
                      </p>
                    )}
                    {module.id === 'semantics' && module.stats.keywords && (
                      <p className="text-xs text-gray-700">
                        🔍 {module.stats.keywords} запросов
                      </p>
                    )}
                    {module.id === 'creatives' && module.stats.ideas && (
                      <p className="text-xs text-gray-700">
                        💡 {module.stats.ideas} идей
                      </p>
                    )}
                    {module.id === 'minusWords' && module.stats.count && (
                      <p className="text-xs text-gray-700">
                        ⛔ {module.stats.count} минус-слов
                      </p>
                    )}
                  </div>
                )}

                {/* Стрелка при наведении */}
                <ArrowRight
                  className="absolute bottom-3 right-3 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all"
                  size={16}
                />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Быстрые действия */}
      {activeProject && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap size={20} />
            Быстрые действия
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {!activeProject.analytics?.targetAudienceAnalysis && (
              <Link
                to="/analytics"
                className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <TrendingUp className="text-primary-600" size={24} />
                <div>
                  <p className="font-medium text-gray-900">Анализ ЦА</p>
                  <p className="text-xs text-gray-600">Начните с аналитики</p>
                </div>
              </Link>
            )}

            {!activeProject.completeAds && (
              <Link
                to="/ads"
                className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <MessageSquare className="text-primary-600" size={24} />
                <div>
                  <p className="font-medium text-gray-900">Создать объявления</p>
                  <p className="text-xs text-gray-600">AI генерация</p>
                </div>
              </Link>
            )}

            {!activeProject.keywordAnalysis && (
              <Link
                to="/keyword-analysis"
                className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <FlaskConical className="text-primary-600" size={24} />
                <div>
                  <p className="font-medium text-gray-900">Анализ запросов</p>
                  <p className="text-xs text-gray-600">Очистить семантику</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Подсказка если нет проектов */}
      {!isLoading && projects.length === 0 && (
        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-8 text-center">
          <AlertCircle className="text-blue-600 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Начните с создания проекта
          </h3>
          <p className="text-gray-600 mb-6">
            Проект содержит бриф и все данные для запуска рекламной кампании.<br />
            Все модули будут работать с данными из вашего проекта.
          </p>
          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus size={20} />
            Создать первый проект
          </Link>
        </div>
      )}
    </div>
  );
}
