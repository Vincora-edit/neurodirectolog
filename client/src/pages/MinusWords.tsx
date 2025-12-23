import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { minusWordsService } from '../services/api';
import { Sparkles, Download, FileText, TrendingUp, AlertTriangle, Check, X } from 'lucide-react';

type Mode = 'simple' | 'advanced';

interface AnalysisResult {
  query: string;
  category: 'целевой' | 'нецелевой' | 'под_вопросом';
  reasoning: string;
  recommendation: 'оставить' | 'в_минус' | 'оптимизировать';
  priority: 'высокий' | 'средний' | 'низкий';
  metrics?: {
    cpc?: number;
    bounceRate?: number;
    conversionCost?: number;
  };
}

interface AnalysisData {
  analysis: AnalysisResult[];
  report: {
    summary: {
      total: number;
      toMinus: number;
      toOptimize: number;
      toKeep: number;
      categories: {
        целевые: number;
        нецелевые: number;
        под_вопросом: number;
      };
    };
    recommendations: {
      immediate: string;
      optimize: string;
      monitor: string;
    };
  };
  minusWords: string[];
}

export default function MinusWords() {
  const [mode, setMode] = useState<Mode>('simple');

  // Simple mode state
  const [keywords, setKeywords] = useState('');
  const [niche, setNiche] = useState('');
  const [minusWords, setMinusWords] = useState<string[]>([]);

  // Advanced mode state
  const [queriesText, setQueriesText] = useState('');
  const [businessInfo, setBusinessInfo] = useState('');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  const generateMutation = useMutation({
    mutationFn: () =>
      minusWordsService.generate(keywords.split('\n').filter(k => k.trim()), niche),
    onSuccess: (data) => {
      setMinusWords(data.minusWords);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: ({ queries, niche, businessInfo }: any) =>
      minusWordsService.analyze(queries, niche, businessInfo),
    onSuccess: (data: AnalysisData) => {
      setAnalysisData(data);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => minusWordsService.export(mode === 'simple' ? minusWords : (analysisData?.minusWords || [])),
    onSuccess: (data) => {
      alert(`Файл экспортирован: ${data.filePath}`);
    },
  });

  const handleSimpleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    generateMutation.mutate();
  };

  const handleAdvancedAnalyze = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse queries from text input
    const queries = queriesText.split('\n').filter(line => line.trim()).map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        query: parts[0] || '',
        clicks: parts[1] ? parseInt(parts[1]) : undefined,
        cost: parts[2] ? parseFloat(parts[2]) : undefined,
        bounceRate: parts[3] ? parseFloat(parts[3]) : undefined,
        conversions: parts[4] ? parseInt(parts[4]) : undefined,
        conversionCost: parts[5] ? parseFloat(parts[5]) : undefined,
      };
    });

    analyzeMutation.mutate({ queries, niche, businessInfo });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'целевой': return 'bg-green-100 text-green-800 border-green-300';
      case 'нецелевой': return 'bg-red-100 text-red-800 border-red-300';
      case 'под_вопросом': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'оставить': return <Check size={16} className="text-green-600" />;
      case 'в_минус': return <X size={16} className="text-red-600" />;
      case 'оптимизировать': return <AlertTriangle size={16} className="text-orange-600" />;
      default: return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'высокий': return 'bg-red-500';
      case 'средний': return 'bg-yellow-500';
      case 'низкий': return 'bg-gray-400';
      default: return 'bg-gray-300';
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Минус-слова</h1>
        <p className="mt-2 text-gray-600">
          Автоматический подбор и анализ минус-слов для фильтрации нецелевого трафика
        </p>
      </div>

      {/* Mode Selector */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setMode('simple')}
          className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
            mode === 'simple'
              ? 'bg-primary-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Sparkles size={20} />
            <span>Простой режим</span>
          </div>
          <p className="text-xs mt-1 opacity-80">Генерация по ключевым словам</p>
        </button>

        <button
          onClick={() => setMode('advanced')}
          className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
            mode === 'advanced'
              ? 'bg-primary-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <TrendingUp size={20} />
            <span>Расширенный анализ</span>
          </div>
          <p className="text-xs mt-1 opacity-80">Анализ с метриками и рекомендациями</p>
        </button>
      </div>

      {/* Simple Mode */}
      {mode === 'simple' && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleSimpleGenerate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ниша бизнеса
                </label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Например: Доставка еды, Ремонт квартир"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ключевые слова (по одному на строку)
                </label>
                <textarea
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  required
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Введите ключевые слова..."
                />
              </div>

              <button
                type="submit"
                disabled={generateMutation.isPending}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles size={20} />
                {generateMutation.isPending ? 'Генерация...' : 'Сгенерировать минус-слова'}
              </button>
            </form>
          </div>

          {minusWords.length > 0 && (
            <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Результат ({minusWords.length} минус-слов)
                </h2>
                <button
                  onClick={() => exportMutation.mutate()}
                  disabled={exportMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors"
                >
                  <Download size={18} />
                  Экспорт
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {minusWords.map((word, index) => (
                  <div
                    key={index}
                    className="px-4 py-2 bg-red-50 rounded-lg text-red-800 hover:bg-red-100 transition-colors"
                  >
                    {word}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Advanced Mode */}
      {mode === 'advanced' && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleAdvancedAnalyze} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ниша бизнеса
                </label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Например: Контекстная реклама"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Информация о бизнесе
                </label>
                <input
                  type="text"
                  value={businessInfo}
                  onChange={(e) => setBusinessInfo(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Например: Агентство контекстной рекламы"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Поисковые запросы с метриками
                </label>
                <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800 font-mono">
                    Формат: запрос, клики, расход, отказы%, конверсии, цена_конверсии
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Пример: яндекс директ цена, 45, 2250, 65, 3, 750
                  </p>
                </div>
                <textarea
                  value={queriesText}
                  onChange={(e) => setQueriesText(e.target.value)}
                  required
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  placeholder="яндекс директ цена, 45, 2250, 65, 3, 750&#10;настройка рекламы бесплатно, 120, 1800, 85, 0, 0&#10;работа специалист директ, 30, 900, 90, 0, 0"
                />
              </div>

              <button
                type="submit"
                disabled={analyzeMutation.isPending}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <TrendingUp size={20} />
                {analyzeMutation.isPending ? 'Анализ...' : 'Проанализировать запросы'}
              </button>
            </form>
          </div>

          {analysisData && (
            <>
              {/* Summary Report */}
              <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <FileText size={24} />
                    Отчет по анализу
                  </h2>
                  <button
                    onClick={() => exportMutation.mutate()}
                    disabled={exportMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors"
                  >
                    <Download size={18} />
                    Экспорт минус-слов
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium">Всего запросов</p>
                    <p className="text-2xl font-bold text-blue-900">{analysisData.report.summary.total}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-600 font-medium">В минус-слова</p>
                    <p className="text-2xl font-bold text-red-900">{analysisData.report.summary.toMinus}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-600 font-medium">Оптимизировать</p>
                    <p className="text-2xl font-bold text-orange-900">{analysisData.report.summary.toOptimize}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-600 font-medium">Оставить</p>
                    <p className="text-2xl font-bold text-green-900">{analysisData.report.summary.toKeep}</p>
                  </div>
                </div>

                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900">Рекомендации:</h3>
                  <p className="text-sm text-gray-700">• {analysisData.report.recommendations.immediate}</p>
                  <p className="text-sm text-gray-700">• {analysisData.report.recommendations.optimize}</p>
                  <p className="text-sm text-gray-700">• {analysisData.report.recommendations.monitor}</p>
                </div>
              </div>

              {/* Detailed Analysis */}
              <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Детальный анализ запросов
                </h2>

                <div className="space-y-3">
                  {analysisData.analysis.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-gray-900">{item.query}</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(item.category)}`}>
                              {item.category}
                            </span>
                            {item.recommendation === 'в_минус' && (
                              <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getPriorityColor(item.priority)}`}>
                                {item.priority}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{item.reasoning}</p>

                          {item.metrics && (
                            <div className="flex gap-4 text-xs text-gray-500">
                              {item.metrics.cpc !== undefined && (
                                <span>CPC: {item.metrics.cpc.toFixed(2)}₽</span>
                              )}
                              {item.metrics.bounceRate !== undefined && (
                                <span>Отказы: {item.metrics.bounceRate}%</span>
                              )}
                              {item.metrics.conversionCost !== undefined && (
                                <span>Цена конв: {item.metrics.conversionCost}₽</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          {getRecommendationIcon(item.recommendation)}
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {item.recommendation.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
