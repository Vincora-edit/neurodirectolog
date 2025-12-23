import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { adsService, projectsService } from '../services/api';
import type { Project } from '../services/api';
import { Sparkles, FolderOpen, AlertCircle, Search, Monitor, ImageIcon, Link2, FileText } from 'lucide-react';

interface CompleteAd {
  adNumber: number;
  targetSegment: string;
  approach: string;
  headline: string;
  text: string;
  clarifications: string[];
  quickLinks: Array<{ title: string; description: string }>;
  images?: Array<{ concept: string; text: string; style: string }>;
}

export default function Ads() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [campaignType, setCampaignType] = useState<'search' | 'display'>('search');
  const [quantity, setQuantity] = useState<number>(3);
  const [generatedAds, setGeneratedAds] = useState<CompleteAd[]>([]);

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

  // Проверка наличия анализа ЦА
  const hasTargetAudience = selectedProject?.analytics?.targetAudienceAnalysis?.segments?.length > 0;

  const generateAdsMutation = useMutation({
    mutationFn: () =>
      adsService.generateComplete(
        campaignType,
        quantity,
        selectedProjectId
      ),
    onSuccess: (data) => {
      if (data.ads) {
        setGeneratedAds(data.ads);
      }
    },
  });

  const canGenerate = selectedProjectId && quantity >= 1 && quantity <= 20;

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Генерация объявлений</h1>
        <p className="mt-2 text-gray-600">
          Создание полных объявлений для Яндекс.Директ: заголовки, тексты, уточнения, быстрые ссылки и изображения
        </p>
      </div>

      {/* Форма генерации */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6 mb-8">
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
                  {' '}с брифом для генерации объявлений
                </p>
              </div>
            </div>
          ) : (
            <>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">Выберите проект...</option>
                {projects.map((project: Project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} — {project.brief.niche}
                  </option>
                ))}
              </select>
              {selectedProjectId && selectedProject && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <FolderOpen className="text-blue-600 mt-0.5" size={16} />
                    <div className="text-xs text-blue-900">
                      <p className="font-semibold">{selectedProject.name}</p>
                      <p className="text-blue-700 mt-1">{selectedProject.brief.businessDescription}</p>
                    </div>
                  </div>
                  {hasTargetAudience ? (
                    <p className="text-xs text-green-700 flex items-center gap-1 mt-2">
                      <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                      Анализ ЦА найден — будет использован для персонализации объявлений
                    </p>
                  ) : (
                    <div className="mt-2 text-xs text-yellow-700 flex items-start gap-1">
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <div>
                        Анализ ЦА не найден. Рекомендуем{' '}
                        <a href="/analytics" className="underline hover:text-yellow-900">
                          провести анализ ЦА
                        </a>
                        {' '}для более точных объявлений
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Тип кампании */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Тип кампании *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setCampaignType('search')}
              className={`p-4 border-2 rounded-lg transition-all ${
                campaignType === 'search'
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${campaignType === 'search' ? 'bg-primary-100' : 'bg-gray-100'}`}>
                  <Search className={campaignType === 'search' ? 'text-primary-600' : 'text-gray-600'} size={24} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Поиск</p>
                  <p className="text-xs text-gray-600 mt-0.5">Текстовые объявления в поиске Яндекса</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCampaignType('display')}
              className={`p-4 border-2 rounded-lg transition-all ${
                campaignType === 'display'
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${campaignType === 'display' ? 'bg-primary-100' : 'bg-gray-100'}`}>
                  <Monitor className={campaignType === 'display' ? 'text-primary-600' : 'text-gray-600'} size={24} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">РСЯ</p>
                  <p className="text-xs text-gray-600 mt-0.5">Графические объявления в рекламной сети</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Количество объявлений */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Количество объявлений *
          </label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1"
              max="20"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="w-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-sm text-gray-600">
              От 1 до 20 объявлений (каждое будет таргетировано на разные сегменты ЦА)
            </p>
          </div>
        </div>

        {/* Кнопка генерации */}
        <button
          onClick={() => generateAdsMutation.mutate()}
          disabled={!canGenerate || generateAdsMutation.isPending}
          className="w-full bg-primary-600 text-white py-4 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-lg"
        >
          <Sparkles size={24} />
          {generateAdsMutation.isPending ? 'Генерация объявлений...' : 'Создать объявления'}
        </button>

        {!selectedProjectId && (
          <p className="text-sm text-amber-600 text-center">
            ⚠️ Выберите проект для начала генерации
          </p>
        )}
      </div>

      {/* Результаты генерации */}
      {generatedAds.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Сгенерировано объявлений: {generatedAds.length}
            </h2>
            <div className="text-sm text-gray-600">
              Тип: <span className="font-semibold">{campaignType === 'search' ? 'Поиск' : 'РСЯ'}</span>
            </div>
          </div>

          {generatedAds.map((ad, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Заголовок объявления */}
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">
                    Объявление #{ad.adNumber}
                  </h3>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium text-white">
                      {ad.targetSegment}
                    </span>
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium text-white">
                      {ad.approach}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Заголовок */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="text-blue-600" size={20} />
                    <h4 className="font-semibold text-gray-900">Заголовок</h4>
                    <span className="text-xs text-gray-500">до 56 символов</span>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <p className="text-blue-900 font-semibold text-lg">{ad.headline}</p>
                    <p className="text-xs text-blue-600 mt-2">{ad.headline.length} / 56 символов</p>
                  </div>
                </div>

                {/* Текст */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="text-green-600" size={20} />
                    <h4 className="font-semibold text-gray-900">Текст объявления</h4>
                    <span className="text-xs text-gray-500">до 81 символа</span>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <p className="text-green-900 text-base">{ad.text}</p>
                    <p className="text-xs text-green-600 mt-2">{ad.text.length} / 81 символ</p>
                  </div>
                </div>

                {/* Уточнения */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="text-purple-600" size={20} />
                    <h4 className="font-semibold text-gray-900">Уточнения ({ad.clarifications.length})</h4>
                    <span className="text-xs text-gray-500">до 25 символов</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ad.clarifications.map((clarification, i) => (
                      <div key={i} className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                        <span className="text-purple-900 font-medium text-sm">{clarification}</span>
                        <span className="text-xs text-purple-600 ml-2">({clarification.length})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Быстрые ссылки */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="text-orange-600" size={20} />
                    <h4 className="font-semibold text-gray-900">Быстрые ссылки ({ad.quickLinks.length})</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {ad.quickLinks.map((link, i) => (
                      <div key={i} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-5 h-5 bg-orange-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <p className="font-semibold text-orange-900 text-sm">{link.title}</p>
                          <span className="text-xs text-orange-600">({link.title.length})</span>
                        </div>
                        <p className="text-xs text-orange-700 ml-7">{link.description}</p>
                        <p className="text-xs text-orange-500 ml-7">({link.description.length} символов)</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Изображения (только для РСЯ) */}
                {ad.images && ad.images.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="text-pink-600" size={20} />
                      <h4 className="font-semibold text-gray-900">Концепции изображений ({ad.images.length})</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {ad.images.map((image, i) => (
                        <div key={i} className="p-4 bg-pink-50 border border-pink-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-7 h-7 bg-pink-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {i + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-semibold text-pink-900 mb-2">{image.concept}</p>
                              <div className="flex items-center gap-4 text-sm">
                                <div>
                                  <span className="text-pink-700 font-medium">Текст: </span>
                                  <span className="text-pink-900 font-bold">"{image.text}"</span>
                                </div>
                                <div>
                                  <span className="text-pink-700 font-medium">Стиль: </span>
                                  <span className="text-pink-900">{image.style}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {generateAdsMutation.isError && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-red-900">Ошибка генерации</p>
              <p className="text-sm text-red-700 mt-1">
                {(generateAdsMutation.error as any)?.message || 'Не удалось сгенерировать объявления. Попробуйте снова.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
