import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { keywordsService, projectsService } from '../services/api';
import type { Project } from '../services/api';
import { useProjectStore } from '../store/projectStore';
import { Sparkles, FolderOpen, AlertCircle, FileText, Trash2, AlertTriangle, Target, Download } from 'lucide-react';

interface ClassifiedKeyword {
  keyword: string;
  category: 'trash' | 'review' | 'target';
  reason: string;
}

interface AnalysisResult {
  classified: ClassifiedKeyword[];
  minusWords: string[];
  statistics: {
    total: number;
    trash: number;
    review: number;
    target: number;
  };
  recommendations: string;
}

export default function KeywordAnalysis() {
  const { activeProjectId, setActiveProjectId } = useProjectStore();
  const selectedProjectId = activeProjectId || '';
  const [keywordsText, setKeywordsText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Загрузка проектов
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

  const analyzeMutation = useMutation({
    mutationFn: () => {
      const keywords = keywordsText
        .split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const niche = selectedProject?.brief?.niche || '';
      const businessDescription = selectedProject?.brief?.businessDescription || '';

      return keywordsService.analyze(keywords, niche, businessDescription, selectedProjectId);
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
    },
  });

  const canAnalyze = keywordsText.trim().length > 0 && selectedProjectId;

  const downloadMinusWords = () => {
    if (!analysisResult?.minusWords) return;

    const content = analysisResult.minusWords.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'minus-words.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTargetKeywords = () => {
    if (!analysisResult?.classified) return;

    const targetKeywords = analysisResult.classified
      .filter(k => k.category === 'target')
      .map(k => k.keyword);

    const content = targetKeywords.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'target-keywords.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const trashKeywords = analysisResult?.classified.filter(k => k.category === 'trash') || [];
  const reviewKeywords = analysisResult?.classified.filter(k => k.category === 'review') || [];
  const targetKeywords = analysisResult?.classified.filter(k => k.category === 'target') || [];

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Анализ поисковых запросов</h1>
        <p className="mt-2 text-gray-600">
          Классификация запросов на мусорные, требующие проверки и целевые. Автоматическая генерация минус-слов.
        </p>
      </div>

      {/* Форма */}
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
                  {' '}для автоматического использования данных из брифа
                </p>
              </div>
            </div>
          ) : (
            <>
              <select
                value={selectedProjectId}
                onChange={(e) => setActiveProjectId(e.target.value || null)}
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
                  <div className="flex items-start gap-2">
                    <FolderOpen className="text-blue-600 mt-0.5" size={16} />
                    <div className="text-xs text-blue-900">
                      <p className="font-semibold">{selectedProject.name}</p>
                      <p className="text-blue-700 mt-1">{selectedProject.brief.businessDescription}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Textarea для запросов */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Список поисковых запросов (по одному на строку) *
          </label>
          <textarea
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            rows={12}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            placeholder={`банкротство физических лиц
списание долгов москва
как списать долги по кредитам
банкротство физлиц цена
юрист по банкротству
...`}
          />
          <p className="text-xs text-gray-500 mt-2">
            Количество запросов: {keywordsText.split('\n').filter(k => k.trim().length > 0).length} (максимум 1000)
          </p>
        </div>

        {/* Кнопка анализа */}
        <button
          onClick={() => analyzeMutation.mutate()}
          disabled={!canAnalyze || analyzeMutation.isPending}
          className="w-full bg-primary-600 text-white py-4 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-lg"
        >
          <Sparkles size={24} />
          {analyzeMutation.isPending ? 'Анализ запросов...' : 'Анализировать запросы'}
        </button>

        {!selectedProjectId && (
          <p className="text-sm text-amber-600 text-center">
            ⚠️ Выберите проект для анализа
          </p>
        )}
      </div>

      {/* Результаты */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Статистика */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Статистика анализа</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="text-gray-600" size={20} />
                  <p className="text-sm font-medium text-gray-700">Всего</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">{analysisResult.statistics.total}</p>
              </div>

              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 className="text-red-600" size={20} />
                  <p className="text-sm font-medium text-red-700">Мусорные</p>
                </div>
                <p className="text-3xl font-bold text-red-900">{analysisResult.statistics.trash}</p>
                <p className="text-xs text-red-600 mt-1">
                  {((analysisResult.statistics.trash / analysisResult.statistics.total) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="text-orange-600" size={20} />
                  <p className="text-sm font-medium text-orange-700">На проверку</p>
                </div>
                <p className="text-3xl font-bold text-orange-900">{analysisResult.statistics.review}</p>
                <p className="text-xs text-orange-600 mt-1">
                  {((analysisResult.statistics.review / analysisResult.statistics.total) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="text-green-600" size={20} />
                  <p className="text-sm font-medium text-green-700">Целевые</p>
                </div>
                <p className="text-3xl font-bold text-green-900">{analysisResult.statistics.target}</p>
                <p className="text-xs text-green-600 mt-1">
                  {((analysisResult.statistics.target / analysisResult.statistics.total) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Рекомендации */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">💡 Рекомендации:</p>
              <p className="text-sm text-blue-800">{analysisResult.recommendations}</p>
            </div>
          </div>

          {/* Минус-слова */}
          {analysisResult.minusWords.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Минус-слова ({analysisResult.minusWords.length})</h2>
                <button
                  onClick={downloadMinusWords}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                >
                  <Download size={16} />
                  Скачать .txt
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysisResult.minusWords.map((word, index) => (
                  <span key={index} className="px-3 py-1 bg-red-100 text-red-900 rounded-full text-sm font-medium">
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Мусорные запросы */}
          {trashKeywords.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trash2 className="text-red-600" size={24} />
                Мусорные запросы ({trashKeywords.length})
              </h2>
              <div className="space-y-2">
                {trashKeywords.map((item, index) => (
                  <div key={index} className="flex items-start justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                    <span className="text-red-900 font-medium">{item.keyword}</span>
                    <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Требуют проверки */}
          {reviewKeywords.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="text-orange-600" size={24} />
                Требуют проверки ({reviewKeywords.length})
              </h2>
              <div className="space-y-2">
                {reviewKeywords.map((item, index) => (
                  <div key={index} className="flex items-start justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg">
                    <span className="text-orange-900 font-medium">{item.keyword}</span>
                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Целевые запросы */}
          {targetKeywords.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Target className="text-green-600" size={24} />
                  Целевые запросы ({targetKeywords.length})
                </h2>
                <button
                  onClick={downloadTargetKeywords}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Download size={16} />
                  Скачать .txt
                </button>
              </div>
              <div className="space-y-2">
                {targetKeywords.map((item, index) => (
                  <div key={index} className="flex items-start justify-between p-3 bg-green-50 border border-green-100 rounded-lg">
                    <span className="text-green-900 font-medium">{item.keyword}</span>
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {analyzeMutation.isError && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-red-900">Ошибка анализа</p>
              <p className="text-sm text-red-700 mt-1">
                {(analyzeMutation.error as any)?.message || 'Не удалось проанализировать запросы. Попробуйте снова.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
