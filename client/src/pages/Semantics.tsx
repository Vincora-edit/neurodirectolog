import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { semanticsService, projectsService } from '../services/api';
import type { Project } from '../services/api';
import { useProjectStore } from '../store/projectStore';
import { Download, Sparkles, FolderOpen, AlertCircle } from 'lucide-react';

export default function Semantics() {
  const { activeProjectId, setActiveProjectId } = useProjectStore();
  const selectedProjectId = activeProjectId || '';
  const [businessDescription, setBusinessDescription] = useState('');
  const [niche, setNiche] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);

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
    if (selectedProject) {
      setBusinessDescription(selectedProject.brief.businessDescription);
      setNiche(selectedProject.brief.niche);

      // Если есть сохраненная семантика, показываем её
      if (selectedProject.semantics?.keywords) {
        setKeywords(selectedProject.semantics.keywords);
      }
    }
  }, [selectedProject]);

  const generateMutation = useMutation({
    mutationFn: () => semanticsService.generate(businessDescription, niche, selectedProjectId),
    onSuccess: (data) => {
      setKeywords(data.keywords);
    },
  });

  const exportMutation = useMutation({
    mutationFn: (format: 'xlsx' | 'csv') => semanticsService.export(keywords, format),
    onSuccess: (data) => {
      alert(`Файл экспортирован: ${data.filePath}`);
    },
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    generateMutation.mutate();
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Сбор семантики</h1>
        <p className="mt-2 text-gray-600">
          Генерируйте релевантное семантическое ядро с помощью AI
        </p>
      </div>

      {/* Селектор проекта */}
      {projects.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <FolderOpen className="text-blue-600 mt-1" size={20} />
            <div className="flex-1">
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Выберите проект (опционально)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setActiveProjectId(e.target.value || null)}
                className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Без проекта (ввести вручную)</option>
                {projects.map((project: Project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} — {project.brief.niche}
                  </option>
                ))}
              </select>
              {selectedProjectId && (
                <p className="mt-2 text-xs text-blue-700">
                  ✓ Данные автоматически загружены из брифа. Результат сохранится в проект.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-600 mt-1" size={20} />
          <div>
            <p className="text-sm font-medium text-yellow-900">У вас пока нет проектов</p>
            <p className="text-xs text-yellow-700 mt-1">
              <a href="/projects/new" className="underline hover:text-yellow-900">
                Создайте проект
              </a>
              {' '}для автоматического использования брифа во всех модулях
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleGenerate} className="space-y-6">
          <div>
            <label htmlFor="niche" className="block text-sm font-medium text-gray-700 mb-2">
              Ниша бизнеса
            </label>
            <input
              id="niche"
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Например: Доставка еды, Ремонт квартир"
              disabled={!!selectedProjectId}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Описание бизнеса
            </label>
            <textarea
              id="description"
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              required
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Опишите ваш бизнес, целевую аудиторию, преимущества..."
              disabled={!!selectedProjectId}
            />
          </div>

          <button
            type="submit"
            disabled={generateMutation.isPending}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={20} />
            {generateMutation.isPending ? 'Генерация...' : 'Сгенерировать семантику'}
          </button>
        </form>
      </div>

      {keywords.length > 0 && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Результат ({keywords.length} запросов)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => exportMutation.mutate('xlsx')}
                disabled={exportMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors"
              >
                <Download size={18} />
                Excel
              </button>
              <button
                onClick={() => exportMutation.mutate('csv')}
                disabled={exportMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
              >
                <Download size={18} />
                CSV
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {keywords.map((keyword, index) => (
              <div
                key={index}
                className="px-4 py-2 bg-gray-50 rounded-lg text-gray-800 hover:bg-gray-100 transition-colors"
              >
                {keyword}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
