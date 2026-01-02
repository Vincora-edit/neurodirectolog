import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Search,
  Target,
  Trash2,
  HelpCircle,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Upload,
  Zap,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface QueryAnalysis {
  query: string;
  category: 'target' | 'trash' | 'review';
  reason: string;
  suggestedMinusWords: string[];
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    cpl: number;
  };
}

interface MinusWordSuggestion {
  word: string;
  reason: string;
  queriesAffected: number;
  potentialSavings: number;
  category: string;
}

interface AnalysisResult {
  totalQueries: number;
  targetQueries: QueryAnalysis[];
  trashQueries: QueryAnalysis[];
  reviewQueries: QueryAnalysis[];
  suggestedMinusWords: MinusWordSuggestion[];
  summary: {
    totalCost: number;
    wastedCost: number;
    potentialSavings: number;
    avgCplTarget: number;
    avgCplTrash: number;
  };
}

interface Connection {
  id: string;
  login: string;
}

type SourceMode = 'auto' | 'manual';

const fetchConnections = async (): Promise<Connection[]> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/yandex/connections`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  return data.data || [];
};

export default function SearchQueriesPage() {
  // Source mode
  const [sourceMode, setSourceMode] = useState<SourceMode>('auto');

  // Auto mode state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(30);

  // Manual mode state
  const [manualQueries, setManualQueries] = useState('');

  // Common state
  const [useAi, setUseAi] = useState(false);
  const [businessDescription, setBusinessDescription] = useState('');
  const [targetCpl, setTargetCpl] = useState<number | undefined>();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'target' | 'trash' | 'review'>('trash');
  const [selectedMinusWords, setSelectedMinusWords] = useState<Set<string>>(new Set());
  const [expandedQueries, setExpandedQueries] = useState<Set<string>>(new Set());

  // Load connections on mount
  useEffect(() => {
    fetchConnections().then((conns) => {
      setConnections(conns);
      if (conns.length > 0) {
        setActiveConnectionId(conns[0].id);
      }
    });
  }, []);

  // Auto mode mutation
  const autoAnalyzeMutation = useMutation({
    mutationFn: async () => {
      if (!activeConnectionId) throw new Error('No connection selected');

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/search-queries/${activeConnectionId}/analyze`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dateFrom: startDate.toISOString().split('T')[0],
            dateTo: endDate.toISOString().split('T')[0],
            useAi,
            businessDescription,
            targetCpl,
          }),
        }
      );

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data as AnalysisResult;
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      const words = new Set(data.suggestedMinusWords.map((mw) => mw.word));
      setSelectedMinusWords(words);
    },
  });

  // Manual mode mutation
  const manualAnalyzeMutation = useMutation({
    mutationFn: async () => {
      // Parse queries from text
      const lines = manualQueries.split('\n').filter((line) => line.trim());
      const queries = lines.map((line) => {
        const parts = line.split(/[,\t]/).map((p) => p.trim());
        return {
          query: parts[0] || '',
          clicks: parts[1] ? parseInt(parts[1]) : 0,
          cost: parts[2] ? parseFloat(parts[2]) : 0,
          conversions: parts[3] ? parseInt(parts[3]) : 0,
        };
      });

      if (queries.length === 0) throw new Error('No queries to analyze');

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/search-queries/manual/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queries,
          useAi,
          businessDescription,
          targetCpl,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data as AnalysisResult;
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      const words = new Set(data.suggestedMinusWords.map((mw) => mw.word));
      setSelectedMinusWords(words);
    },
  });

  const handleAnalyze = () => {
    setAnalysisResult(null);
    if (sourceMode === 'auto') {
      autoAnalyzeMutation.mutate();
    } else {
      manualAnalyzeMutation.mutate();
    }
  };

  const isAnalyzing = autoAnalyzeMutation.isPending || manualAnalyzeMutation.isPending;

  const handleExport = () => {
    if (selectedMinusWords.size === 0) return;

    const words = Array.from(selectedMinusWords)
      .map((w) => (w.startsWith('-') ? w : `-${w}`))
      .join('\n');

    const blob = new Blob([words], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'minus-words.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleMinusWord = (word: string) => {
    const newSet = new Set(selectedMinusWords);
    if (newSet.has(word)) {
      newSet.delete(word);
    } else {
      newSet.add(word);
    }
    setSelectedMinusWords(newSet);
  };

  const toggleQueryExpand = (query: string) => {
    const newSet = new Set(expandedQueries);
    if (newSet.has(query)) {
      newSet.delete(query);
    } else {
      newSet.add(query);
    }
    setExpandedQueries(newSet);
  };

  const getCategoryIcon = (category: 'target' | 'trash' | 'review') => {
    switch (category) {
      case 'target':
        return <CheckCircle className="text-green-500" size={18} />;
      case 'trash':
        return <XCircle className="text-red-500" size={18} />;
      case 'review':
        return <AlertCircle className="text-amber-500" size={18} />;
    }
  };

  const getActiveQueries = () => {
    if (!analysisResult) return [];
    switch (activeTab) {
      case 'target':
        return analysisResult.targetQueries;
      case 'trash':
        return analysisResult.trashQueries;
      case 'review':
        return analysisResult.reviewQueries;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Search className="text-purple-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Анализ запросов</h1>
            <p className="text-gray-600">Найдите нецелевые запросы и сформируйте минус-слова</p>
          </div>
        </div>
      </div>

      {/* Source Mode Selector */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setSourceMode('auto');
            setAnalysisResult(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
            sourceMode === 'auto'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Zap size={20} />
          <div>
            <span className="block">Из Яндекс.Директ</span>
            <span className="text-xs opacity-80">Автоматическая загрузка</span>
          </div>
        </button>
        <button
          onClick={() => {
            setSourceMode('manual');
            setAnalysisResult(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
            sourceMode === 'manual'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Upload size={20} />
          <div>
            <span className="block">Ручной ввод</span>
            <span className="text-xs opacity-80">Вставить из файла</span>
          </div>
        </button>
      </div>

      {/* Analysis Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {sourceMode === 'auto' ? (
          /* Auto mode form */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Connection selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Аккаунт</label>
              <select
                value={activeConnectionId || ''}
                onChange={(e) => setActiveConnectionId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.login}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Период</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value={7}>7 дней</option>
                <option value={14}>14 дней</option>
                <option value={30}>30 дней</option>
                <option value={60}>60 дней</option>
                <option value={90}>90 дней</option>
              </select>
            </div>

            {/* Target CPL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Целевой CPL</label>
              <input
                type="number"
                value={targetCpl || ''}
                onChange={(e) => setTargetCpl(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="5000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            {/* AI Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Метод</label>
              <button
                onClick={() => setUseAi(!useAi)}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  useAi
                    ? 'bg-purple-50 border-purple-300 text-purple-700'
                    : 'bg-gray-50 border-gray-300 text-gray-700'
                }`}
              >
                {useAi ? <Sparkles size={18} /> : <Filter size={18} />}
                {useAi ? 'AI анализ' : 'Быстрый'}
              </button>
            </div>
          </div>
        ) : (
          /* Manual mode form */
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target CPL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Целевой CPL</label>
                <input
                  type="number"
                  value={targetCpl || ''}
                  onChange={(e) => setTargetCpl(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="5000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {/* AI Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Метод</label>
                <button
                  onClick={() => setUseAi(!useAi)}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    useAi
                      ? 'bg-purple-50 border-purple-300 text-purple-700'
                      : 'bg-gray-50 border-gray-300 text-gray-700'
                  }`}
                >
                  {useAi ? <Sparkles size={18} /> : <Filter size={18} />}
                  {useAi ? 'AI анализ' : 'Быстрый'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Поисковые запросы
              </label>
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  Формат: <code className="bg-blue-100 px-1 rounded">запрос, клики, расход, конверсии</code>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Пример: автошкола уфа, 45, 2250, 3
                </p>
              </div>
              <textarea
                value={manualQueries}
                onChange={(e) => setManualQueries(e.target.value)}
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                placeholder="автошкола уфа, 45, 2250, 3&#10;права категории b, 120, 1800, 0&#10;обучение вождению бесплатно, 30, 900, 0"
              />
            </div>
          </div>
        )}

        {/* Business description for AI */}
        {useAi && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание бизнеса (для AI)
            </label>
            <textarea
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder="Опишите ваш бизнес, чтобы AI мог точнее определить целевые запросы..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        )}

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (sourceMode === 'auto' && !activeConnectionId) || (sourceMode === 'manual' && !manualQueries.trim())}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isAnalyzing ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Search size={20} />
          )}
          {isAnalyzing ? 'Анализируем...' : 'Анализировать'}
        </button>
      </div>

      {/* Results */}
      {analysisResult && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Search size={16} />
                <span className="text-sm">Всего запросов</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {analysisResult.totalQueries.toLocaleString('ru-RU')}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <DollarSign size={16} />
                <span className="text-sm">Общий расход</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {analysisResult.summary.totalCost.toLocaleString('ru-RU')}₽
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <TrendingDown size={16} />
                <span className="text-sm">Потрачено впустую</span>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {analysisResult.summary.wastedCost.toLocaleString('ru-RU')}₽
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-green-200 p-4">
              <div className="flex items-center gap-2 text-green-500 mb-1">
                <TrendingUp size={16} />
                <span className="text-sm">Потенциальная экономия</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {analysisResult.summary.potentialSavings.toLocaleString('ru-RU')}₽
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Queries List */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('trash')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'trash'
                      ? 'text-red-600 border-b-2 border-red-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Trash2 size={16} />
                  Мусор ({analysisResult.trashQueries.length})
                </button>
                <button
                  onClick={() => setActiveTab('review')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'review'
                      ? 'text-amber-600 border-b-2 border-amber-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <HelpCircle size={16} />
                  Проверить ({analysisResult.reviewQueries.length})
                </button>
                <button
                  onClick={() => setActiveTab('target')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'target'
                      ? 'text-green-600 border-b-2 border-green-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Target size={16} />
                  Целевые ({analysisResult.targetQueries.length})
                </button>
              </div>

              {/* Query list */}
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {getActiveQueries().map((query, index) => (
                  <div key={index} className="p-4 hover:bg-gray-50">
                    <div
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => toggleQueryExpand(query.query)}
                    >
                      {getCategoryIcon(query.category)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-gray-900 truncate">{query.query}</p>
                          {expandedQueries.has(query.query) ? (
                            <ChevronUp size={16} className="text-gray-400" />
                          ) : (
                            <ChevronDown size={16} className="text-gray-400" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{query.reason}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>{query.metrics.clicks} кликов</span>
                          <span>{query.metrics.cost.toLocaleString('ru-RU')}₽</span>
                          <span>{query.metrics.conversions} конв.</span>
                          {query.metrics.cpl > 0 && (
                            <span>CPL: {Math.round(query.metrics.cpl)}₽</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {expandedQueries.has(query.query) && query.suggestedMinusWords.length > 0 && (
                      <div className="mt-3 ml-8 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Предложенные минус-слова:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {query.suggestedMinusWords.map((word, i) => (
                            <button
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMinusWord(word);
                              }}
                              className={`px-2 py-1 text-sm rounded transition-colors ${
                                selectedMinusWords.has(word)
                                  ? 'bg-red-100 text-red-700 border border-red-300'
                                  : 'bg-white text-gray-600 border border-gray-200 hover:border-red-300'
                              }`}
                            >
                              -{word}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {getActiveQueries().length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    Нет запросов в этой категории
                  </div>
                )}
              </div>
            </div>

            {/* Minus Words Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Минус-слова</h3>
                  <span className="text-sm text-gray-500">{selectedMinusWords.size} выбрано</span>
                </div>
              </div>

              <div className="p-4 max-h-[500px] overflow-y-auto">
                <div className="space-y-2">
                  {analysisResult.suggestedMinusWords.map((mw, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMinusWords.has(mw.word)
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200 hover:border-red-200'
                      }`}
                      onClick={() => toggleMinusWord(mw.word)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">-{mw.word}</span>
                        <span className="text-sm text-red-600">
                          -{mw.potentialSavings.toLocaleString('ru-RU')}₽
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{mw.reason}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Затронет {mw.queriesAffected} запросов
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={handleExport}
                  disabled={selectedMinusWords.size === 0}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Download size={18} />
                  Экспорт ({selectedMinusWords.size})
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!analysisResult && !isAnalyzing && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Search className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Анализ поисковых запросов
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {sourceMode === 'auto'
              ? 'Выберите аккаунт и период, затем запустите анализ для поиска нецелевых запросов.'
              : 'Вставьте поисковые запросы с метриками и запустите анализ.'}
          </p>
        </div>
      )}
    </div>
  );
}
