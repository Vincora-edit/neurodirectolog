import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsService } from '../services/api';
import type { ProjectBrief } from '../services/api';
import {
  Sparkles,
  Save,
  ArrowLeft,
  Building2,
  Target,
  DollarSign,
  Info
} from 'lucide-react';

export default function ProjectForm() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const isEdit = Boolean(projectId);

  const [name, setName] = useState('');
  const [brief, setBrief] = useState<ProjectBrief>({
    businessName: '',
    niche: '',
    businessDescription: '',
    website: '',
    geo: '',
    advantages: [''],
    budget: {
      total: 0,
      period: 'месяц',
    },
    goals: '',
    desires: '',
    targetCPA: undefined,
    schedule: '',
    prohibitions: '',
  });

  // Load existing project if editing
  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsService.getById(projectId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (projectData) {
      setName(projectData.name);
      setBrief(projectData.brief);
    }
  }, [projectData]);

  const createMutation = useMutation({
    mutationFn: () => projectsService.create(name, brief),
    onSuccess: () => {
      navigate('/projects');
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => projectsService.update(projectId!, { name, brief }),
    onSuccess: () => {
      navigate('/projects');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const updateAdvantage = (index: number, value: string) => {
    const newAdvantages = [...brief.advantages];
    newAdvantages[index] = value;
    setBrief({ ...brief, advantages: newAdvantages });
  };

  const addAdvantage = () => {
    setBrief({
      ...brief,
      advantages: [...brief.advantages, ''],
    });
  };

  const removeAdvantage = (index: number) => {
    setBrief({
      ...brief,
      advantages: brief.advantages.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => navigate('/projects')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEdit ? 'Редактировать проект' : 'Новый проект'}
          </h1>
          <p className="mt-2 text-gray-600">
            Заполните бриф — эта информация будет использоваться во всех модулях
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Основная информация */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Building2 className="text-primary-600" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Основная информация</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название проекта *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Например: Кампания Яндекс.Директ - Доставка еды"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название бизнеса *
              </label>
              <input
                type="text"
                value={brief.businessName}
                onChange={(e) => setBrief({ ...brief, businessName: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="FastFood Express"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ниша бизнеса *
              </label>
              <input
                type="text"
                value={brief.niche}
                onChange={(e) => setBrief({ ...brief, niche: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Доставка еды"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                География *
              </label>
              <input
                type="text"
                value={brief.geo}
                onChange={(e) => setBrief({ ...brief, geo: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Москва, Санкт-Петербург"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Описание бизнеса *
              </label>
              <textarea
                value={brief.businessDescription}
                onChange={(e) => setBrief({ ...brief, businessDescription: e.target.value })}
                required
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Сервис доставки готовых блюд из ресторанов. Работаем с 500+ заведениями в Москве..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Сайт *
              </label>
              <input
                type="url"
                value={brief.website}
                onChange={(e) => setBrief({ ...brief, website: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="https://example.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                ИИ проанализирует вашу посадочную страницу для рекомендаций
              </p>
            </div>
          </div>
        </div>

        {/* Преимущества компании */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="text-green-600" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Преимущества компании</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Преимущества вашей компании
              </label>
              {brief.advantages.map((advantage, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={advantage}
                    onChange={(e) => updateAdvantage(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Например: Широкий выбор ресторанов, Быстрая доставка"
                  />
                  {brief.advantages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAdvantage(index)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addAdvantage}
                className="mt-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                + Добавить преимущество
              </button>
            </div>
          </div>
        </div>

        {/* Бюджет, цели и желания */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <DollarSign className="text-yellow-600" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Бюджет, цели и желания</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Бюджет (₽) *
                </label>
                <input
                  type="number"
                  value={brief.budget.total}
                  onChange={(e) =>
                    setBrief({
                      ...brief,
                      budget: { ...brief.budget, total: Number(e.target.value) },
                    })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="50000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Период *
                </label>
                <select
                  value={brief.budget.period}
                  onChange={(e) =>
                    setBrief({
                      ...brief,
                      budget: { ...brief.budget, period: e.target.value as any },
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="день">День</option>
                  <option value="неделя">Неделя</option>
                  <option value="месяц">Месяц</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Цели рекламной кампании *
              </label>
              <textarea
                value={brief.goals}
                onChange={(e) => setBrief({ ...brief, goals: e.target.value })}
                required
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Увеличить количество заказов на 30%, привлечь 1000 новых клиентов"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Желания и хотелки клиента
              </label>
              <textarea
                value={brief.desires}
                onChange={(e) => setBrief({ ...brief, desires: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Хотим получить качественные лиды, работать с премиум-сегментом..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Целевая цена конверсии (₽)
              </label>
              <input
                type="number"
                value={brief.targetCPA || ''}
                onChange={(e) =>
                  setBrief({ ...brief, targetCPA: e.target.value ? Number(e.target.value) : undefined })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="500"
              />
            </div>
          </div>
        </div>

        {/* Дополнительно */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Info className="text-purple-600" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Дополнительная информация</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Расписание показов
              </label>
              <input
                type="text"
                value={brief.schedule || ''}
                onChange={(e) => setBrief({ ...brief, schedule: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Пн-Пт 9:00-21:00, Сб-Вс 10:00-22:00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Запреты и ограничения
              </label>
              <textarea
                value={brief.prohibitions || ''}
                onChange={(e) => setBrief({ ...brief, prohibitions: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Не использовать слова 'дешево', 'акция'"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            {isEdit ? <Save size={20} /> : <Sparkles size={20} />}
            {createMutation.isPending || updateMutation.isPending
              ? 'Сохранение...'
              : isEdit
              ? 'Сохранить изменения'
              : 'Создать проект'}
          </button>
        </div>
      </form>
    </div>
  );
}
