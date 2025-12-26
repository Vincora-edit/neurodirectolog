import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { analyticsService, projectsService } from '../services/api';
import type { Project } from '../services/api';
import { useProjectStore } from '../store/projectStore';
import {
  Sparkles,
  FolderOpen,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Users,
  Target,
  Lightbulb,
  Globe,
  DollarSign,
  Lock
} from 'lucide-react';

export default function Analytics() {
  const { activeProjectId, setActiveProjectId } = useProjectStore();
  const selectedProjectId = activeProjectId || '';
  const [_competitorAdsAnalysis, setCompetitorAdsAnalysis] = useState<any>(null);
  const [_competitorWebsitesAnalysis, setCompetitorWebsitesAnalysis] = useState<any>(null);
  const [targetAudienceAnalysis, setTargetAudienceAnalysis] = useState<any>(null);
  const [landingPageAnalysis, setLandingPageAnalysis] = useState<any>(null);
  const [mediaPlan, setMediaPlan] = useState<any>(null);

  // Загрузка списка проектов
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
  });

  // Загрузка выбранного проекта
  const { data: selectedProject } = useQuery({
    queryKey: ['project', selectedProjectId],
    queryFn: () => projectsService.getById(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  // Автозаполнение при выборе проекта
  useEffect(() => {
    if (selectedProject?.analytics) {
      if (selectedProject.analytics.competitorAdsAnalysis) {
        setCompetitorAdsAnalysis(selectedProject.analytics.competitorAdsAnalysis);
      }
      if (selectedProject.analytics.competitorWebsitesAnalysis) {
        setCompetitorWebsitesAnalysis(selectedProject.analytics.competitorWebsitesAnalysis);
      }
      if (selectedProject.analytics.targetAudienceAnalysis) {
        setTargetAudienceAnalysis(selectedProject.analytics.targetAudienceAnalysis);
      }
      if (selectedProject.analytics.landingPageAnalysis) {
        setLandingPageAnalysis(selectedProject.analytics.landingPageAnalysis);
      }
      if (selectedProject.analytics.mediaPlan) {
        setMediaPlan(selectedProject.analytics.mediaPlan);
      }
    }
  }, [selectedProject]);

  // Полный анализ (3 реальных блока)
  const fullAnalysisMutation = useMutation({
    mutationFn: () => {
      if (!selectedProject) throw new Error('No project selected');

      return analyticsService.fullAnalysis(
        selectedProject.brief.niche,
        selectedProject.brief.businessDescription,
        selectedProject.brief.website,
        selectedProject.brief.budget.total,
        selectedProject.brief.budget.period,
        selectedProject.brief.goals,
        selectedProject.brief.geo,
        selectedProjectId
      );
    },
    onSuccess: (data) => {
      setTargetAudienceAnalysis(data.targetAudienceAnalysis);
      setLandingPageAnalysis(data.landingPageAnalysis);
      setMediaPlan(data.mediaPlan);
    },
  });

  // Отдельный анализ ЦА
  const targetAudienceMutation = useMutation({
    mutationFn: () => {
      if (!selectedProject) throw new Error('No project selected');

      return analyticsService.analyzeTargetAudience(
        selectedProject.brief.niche,
        selectedProject.brief.businessDescription,
        selectedProject.brief.geo,
        selectedProjectId
      );
    },
    onSuccess: (data) => {
      setTargetAudienceAnalysis(data);
    },
  });

  // Отдельный анализ посадочной страницы
  const landingPageMutation = useMutation({
    mutationFn: () => {
      if (!selectedProject) throw new Error('No project selected');

      return analyticsService.analyzeLandingPage(
        selectedProject.brief.website,
        selectedProject.brief.niche,
        selectedProject.brief.businessDescription,
        selectedProjectId
      );
    },
    onSuccess: (data) => {
      setLandingPageAnalysis(data);
    },
  });

  // Отдельный медиаплан
  const mediaPlanMutation = useMutation({
    mutationFn: () => {
      if (!selectedProject) throw new Error('No project selected');

      return analyticsService.generateMediaPlan(
        selectedProject.brief.niche,
        selectedProject.brief.businessDescription,
        selectedProject.brief.budget.total,
        selectedProject.brief.budget.period,
        selectedProject.brief.goals,
        selectedProject.brief.geo,
        selectedProjectId
      );
    },
    onSuccess: (data) => {
      setMediaPlan(data);
    },
  });

  const hasAnalytics =
    targetAudienceAnalysis ||
    landingPageAnalysis ||
    mediaPlan;

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Предзапусковая аналитика</h1>
        <p className="mt-2 text-gray-600">
          Комплексный анализ перед запуском рекламы: 5 блоков аналитики
        </p>
      </div>

      {/* Селектор проекта */}
      {projects.length > 0 ? (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <FolderOpen className="text-blue-600 mt-1" size={20} />
            <div className="flex-1">
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Выберите проект *
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setActiveProjectId(e.target.value || null)}
                className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Выберите проект...</option>
                {projects.map((project: Project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} — {project.brief.niche}
                  </option>
                ))}
              </select>
              {selectedProjectId && hasAnalytics && (
                <p className="mt-2 text-xs text-green-700 flex items-center gap-1">
                  <CheckCircle size={14} />
                  Аналитика уже проведена. Можно обновить или посмотреть результаты
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-600 mt-1" size={20} />
          <div>
            <p className="text-sm font-medium text-yellow-900">У вас пока нет проектов</p>
            <p className="text-xs text-yellow-700 mt-1">
              <a href="/projects/new" className="underline hover:text-yellow-900">
                Создайте проект
              </a>
              {' '}для проведения аналитики
            </p>
          </div>
        </div>
      )}

      {selectedProject && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Информация о проекте</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Бизнес:</span>{' '}
              <span className="text-gray-600">{selectedProject.brief.businessName}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Ниша:</span>{' '}
              <span className="text-gray-600">{selectedProject.brief.niche}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">География:</span>{' '}
              <span className="text-gray-600">{selectedProject.brief.geo}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Бюджет:</span>{' '}
              <span className="text-gray-600">
                {selectedProject.brief.budget.total.toLocaleString('ru-RU')} ₽/{selectedProject.brief.budget.period}
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => fullAnalysisMutation.mutate()}
              disabled={fullAnalysisMutation.isPending}
              className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles size={20} />
              {fullAnalysisMutation.isPending ? 'Анализ...' : 'Полный анализ (ЦА + Посадочная + Медиаплан)'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <button
              onClick={() => targetAudienceMutation.mutate()}
              disabled={targetAudienceMutation.isPending}
              className="bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Users size={16} />
              {targetAudienceMutation.isPending ? 'Анализ...' : 'Анализ ЦА'}
            </button>
            <button
              onClick={() => landingPageMutation.mutate()}
              disabled={landingPageMutation.isPending}
              className="bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Globe size={16} />
              {landingPageMutation.isPending ? 'Анализ...' : 'Посадочная'}
            </button>
            <button
              onClick={() => mediaPlanMutation.mutate()}
              disabled={mediaPlanMutation.isPending}
              className="bg-yellow-600 text-white py-2 rounded-lg font-medium hover:bg-yellow-700 disabled:bg-gray-300 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <DollarSign size={16} />
              {mediaPlanMutation.isPending ? 'Создание...' : 'Медиаплан'}
            </button>
          </div>
        </div>
      )}

      {/* Результаты аналитики - 5 блоков */}
      <div className="space-y-6">
        {/* Блок 1: Анализ рекламы конкурентов (заглушка) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <TrendingUp className="text-gray-400" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">1. Анализ рекламы конкурентов</h2>
            <div className="ml-auto">
              <Lock className="text-gray-400" size={20} />
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Lock className="text-gray-400 mx-auto mb-3" size={40} />
            <p className="text-gray-600 font-medium">Скоро будет доступно</p>
            <p className="text-sm text-gray-500 mt-2">
              Автоматический анализ объявлений конкурентов в Яндекс.Директ
            </p>
          </div>
        </div>

        {/* Блок 2: Анализ сайтов конкурентов (заглушка) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Target className="text-gray-400" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">2. Анализ сайтов конкурентов</h2>
            <div className="ml-auto">
              <Lock className="text-gray-400" size={20} />
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Lock className="text-gray-400 mx-auto mb-3" size={40} />
            <p className="text-gray-600 font-medium">Скоро будет доступно</p>
            <p className="text-sm text-gray-500 mt-2">
              Парсинг и анализ посадочных страниц конкурентов
            </p>
          </div>
        </div>

        {/* Блок 3: Анализ целевой аудитории (детальная таблица 18 полей) */}
        {targetAudienceAnalysis && targetAudienceAnalysis.segments && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="text-green-600" size={24} />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">3. Анализ целевой аудитории</h2>
            </div>

            <div className="space-y-6">
              {targetAudienceAnalysis.segments.map((segment: any, index: number) => (
                <div key={index} className="border border-green-200 rounded-lg p-5 bg-green-50">
                  <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                    <span className="bg-green-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm">
                      {index + 1}
                    </span>
                    {segment.segmentName}
                  </h3>

                  {/* Таблица с 18 полями */}
                  <div className="bg-white rounded-lg overflow-hidden border border-green-200">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50 w-1/4">Пол</td>
                          <td className="py-2 px-4 text-gray-600">{segment.gender}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Возраст</td>
                          <td className="py-2 px-4 text-gray-600">{segment.age}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Уровень дохода</td>
                          <td className="py-2 px-4 text-gray-600">{segment.incomeLevel}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Семейное положение</td>
                          <td className="py-2 px-4 text-gray-600">{segment.familyStatus}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Чем занимается</td>
                          <td className="py-2 px-4 text-gray-600">{segment.activities}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Мотиваторы</td>
                          <td className="py-2 px-4 text-gray-600">
                            {Array.isArray(segment.motivators)
                              ? segment.motivators.join(', ')
                              : segment.motivators}
                          </td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Покупает ДО нашего</td>
                          <td className="py-2 px-4 text-gray-600">{segment.productsBefore}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Покупает ВМЕСТЕ с нашим</td>
                          <td className="py-2 px-4 text-gray-600">{segment.productsWith}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Покупает ПОСЛЕ нашего</td>
                          <td className="py-2 px-4 text-gray-600">{segment.productsAfter}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">У меня нет / болит</td>
                          <td className="py-2 px-4 text-gray-600">{segment.painPoints}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Я хочу</td>
                          <td className="py-2 px-4 text-gray-600">{segment.desires}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Я боюсь</td>
                          <td className="py-2 px-4 text-gray-600">{segment.fears}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Обращаю внимание на</td>
                          <td className="py-2 px-4 text-gray-600">{segment.selectionCriteria}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Мне всё нравится, но...</td>
                          <td className="py-2 px-4 text-gray-600">{segment.objections}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Кто принимает решение</td>
                          <td className="py-2 px-4 text-gray-600">{segment.decisionMaker}</td>
                        </tr>
                        <tr className="border-b border-green-100">
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Стадия теплоты</td>
                          <td className="py-2 px-4 text-gray-600">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              segment.warmthStage === 'горячая'
                                ? 'bg-red-100 text-red-800'
                                : segment.warmthStage === 'теплая'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {segment.warmthStage}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-4 font-semibold text-gray-700 bg-green-50">Рекомендации</td>
                          <td className="py-2 px-4 text-gray-600">{segment.recommendations}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Блок 4: Анализ посадочной страницы */}
        {landingPageAnalysis && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Globe className="text-purple-600" size={24} />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">4. Анализ посадочной страницы</h2>
            </div>

            <div className="space-y-4">
              {landingPageAnalysis.design && (
                <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                  <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    <Lightbulb size={18} />
                    Дизайн и первое впечатление
                  </h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {typeof landingPageAnalysis.design === 'string'
                      ? landingPageAnalysis.design
                      : JSON.stringify(landingPageAnalysis.design, null, 2)}
                  </p>
                </div>
              )}

              {landingPageAnalysis.structure && (
                <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                  <h3 className="font-semibold text-purple-900 mb-2">Структура и навигация</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {typeof landingPageAnalysis.structure === 'string'
                      ? landingPageAnalysis.structure
                      : JSON.stringify(landingPageAnalysis.structure, null, 2)}
                  </p>
                </div>
              )}

              {landingPageAnalysis.offer && (
                <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                  <h3 className="font-semibold text-purple-900 mb-2">Оффер и УТП</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {typeof landingPageAnalysis.offer === 'string'
                      ? landingPageAnalysis.offer
                      : JSON.stringify(landingPageAnalysis.offer, null, 2)}
                  </p>
                </div>
              )}

              {landingPageAnalysis.conversion && (
                <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                  <h3 className="font-semibold text-purple-900 mb-2">Маркетинговая конверсия</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {typeof landingPageAnalysis.conversion === 'string'
                      ? landingPageAnalysis.conversion
                      : JSON.stringify(landingPageAnalysis.conversion, null, 2)}
                  </p>
                </div>
              )}

              {landingPageAnalysis.adCompliance && (
                <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                  <h3 className="font-semibold text-purple-900 mb-2">Соответствие рекламе</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {typeof landingPageAnalysis.adCompliance === 'string'
                      ? landingPageAnalysis.adCompliance
                      : JSON.stringify(landingPageAnalysis.adCompliance, null, 2)}
                  </p>
                </div>
              )}

              {landingPageAnalysis.recommendations && (
                <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                  <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    <Lightbulb size={18} />
                    Конкретные рекомендации (Топ-5)
                  </h3>
                  <div className="text-sm text-gray-700">
                    {Array.isArray(landingPageAnalysis.recommendations) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {landingPageAnalysis.recommendations.map((rec: string, idx: number) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {typeof landingPageAnalysis.recommendations === 'string'
                          ? landingPageAnalysis.recommendations
                          : JSON.stringify(landingPageAnalysis.recommendations, null, 2)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Блок 5: Медиаплан с прогнозом ROI */}
        {mediaPlan && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DollarSign className="text-yellow-600" size={24} />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">5. Медиаплан с прогнозом ROI</h2>
            </div>

            <div className="space-y-6">
              {/* Распределение бюджета */}
              {mediaPlan.budgetDistribution && (
                <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <h3 className="font-semibold text-yellow-900 mb-3">Распределение бюджета</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(mediaPlan.budgetDistribution).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600 mb-1">{key}</p>
                        <p className="text-lg font-bold text-yellow-900">
                          {typeof value === 'number' ? `${value.toLocaleString('ru-RU')} ₽` : value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Прогноз показателей */}
              {mediaPlan.forecast && (
                <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <h3 className="font-semibold text-yellow-900 mb-3">Прогноз показателей</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {Object.entries(mediaPlan.forecast).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">{key}</p>
                        <p className="text-base font-bold text-gray-900">
                          {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Прогноз ROI */}
              {mediaPlan.roi && (
                <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <h3 className="font-semibold text-yellow-900 mb-3">Прогноз ROI</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(mediaPlan.roi).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-white rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">{key}</p>
                        <p className="text-lg font-bold text-green-700">
                          {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* График запуска */}
              {mediaPlan.schedule && (
                <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <h3 className="font-semibold text-yellow-900 mb-3">График запуска</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {typeof mediaPlan.schedule === 'string'
                      ? mediaPlan.schedule
                      : JSON.stringify(mediaPlan.schedule, null, 2)}
                  </p>
                </div>
              )}

              {/* KPI */}
              {mediaPlan.kpi && (
                <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <h3 className="font-semibold text-yellow-900 mb-3">KPI для отслеживания</h3>
                  <div className="text-sm text-gray-700">
                    {Array.isArray(mediaPlan.kpi) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {mediaPlan.kpi.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {typeof mediaPlan.kpi === 'string'
                          ? mediaPlan.kpi
                          : JSON.stringify(mediaPlan.kpi, null, 2)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Рекомендации */}
              {mediaPlan.recommendations && (
                <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <h3 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                    <Lightbulb size={18} />
                    Рекомендации
                  </h3>
                  <div className="text-sm text-gray-700">
                    {Array.isArray(mediaPlan.recommendations) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {mediaPlan.recommendations.map((rec: string, idx: number) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {typeof mediaPlan.recommendations === 'string'
                          ? mediaPlan.recommendations
                          : JSON.stringify(mediaPlan.recommendations, null, 2)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
