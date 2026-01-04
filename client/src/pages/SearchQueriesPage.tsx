import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Search,
  Trash2,
  HelpCircle,
  Download,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Upload,
  Zap,
  Bug,
  DollarSign,
  TrendingDown,
  TrendingUp,
  XCircle,
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
  confidence?: 'high' | 'medium' | 'low';
  exampleQueries?: Array<{ query: string; cost: number; clicks: number }>;
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
  projectId: string;
  projectName: string;
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

const fetchBrief = async (connectionId: string): Promise<{ description: string; targetCpl: number | null } | null> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/yandex/connection/${connectionId}/brief`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  return data.data || null;
};

export default function SearchQueriesPage() {
  // Source mode
  const [sourceMode, setSourceMode] = useState<SourceMode>('auto');

  // Auto mode state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(7);

  // Manual mode state
  const [manualQueries, setManualQueries] = useState('');

  // Common state
  const [businessDescription, setBusinessDescription] = useState('');
  const [briefDescription, setBriefDescription] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'trash' | 'review' | 'debug'>('trash');
  const [selectedMinusWords, setSelectedMinusWords] = useState<Set<string>>(new Set());
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);
  const [filteredInfo, setFilteredInfo] = useState<{ raw: number; filtered: number } | null>(null);

  const [connectionsLoading, setConnectionsLoading] = useState(true);

  // Load connections on mount
  useEffect(() => {
    setConnectionsLoading(true);
    fetchConnections()
      .then((conns) => {
        setConnections(conns);
        if (conns.length > 0) {
          setActiveConnectionId(conns[0].id);
        }
      })
      .finally(() => setConnectionsLoading(false));
  }, []);

  // Load brief and KPI when connection changes
  useEffect(() => {
    if (activeConnectionId) {
      fetchBrief(activeConnectionId).then((brief) => {
        if (brief) {
          setBriefDescription(brief.description);
          if (brief.description) {
            setBusinessDescription(brief.description);
          }
        } else {
          setBriefDescription(null);
          setBusinessDescription('');
        }
      });
    }
  }, [activeConnectionId]);

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
            businessDescription: businessDescription || undefined,
          }),
        }
      );

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return {
        result: data.data as AnalysisResult,
        warning: data.warning as string | undefined,
        rawQueriesCount: data.rawQueriesCount as number | undefined,
        filteredCount: data.filteredCount as number | undefined,
      };
    },
    onSuccess: ({ result, warning, rawQueriesCount, filteredCount }) => {
      setAnalysisResult(result);
      setAnalysisWarning(warning || null);
      if (rawQueriesCount !== undefined && filteredCount !== undefined) {
        setFilteredInfo({ raw: rawQueriesCount, filtered: filteredCount });
      } else {
        setFilteredInfo(null);
      }
      const words = new Set(result.suggestedMinusWords.map((mw) => mw.word));
      setSelectedMinusWords(words);
    },
  });

  // Manual mode mutation
  const manualAnalyzeMutation = useMutation({
    mutationFn: async () => {
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
          businessDescription: businessDescription || undefined,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return { result: data.data as AnalysisResult, warning: data.warning as string | undefined };
    },
    onSuccess: ({ result, warning }) => {
      setAnalysisResult(result);
      setAnalysisWarning(warning || null);
      const words = new Set(result.suggestedMinusWords.map((mw) => mw.word));
      setSelectedMinusWords(words);
    },
  });

  const handleAnalyze = () => {
    setAnalysisResult(null);
    setAnalysisWarning(null);
    setFilteredInfo(null);
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

  const toggleWordExpand = (word: string) => {
    const newSet = new Set(expandedWords);
    if (newSet.has(word)) {
      newSet.delete(word);
    } else {
      newSet.add(word);
    }
    setExpandedWords(newSet);
  };

  // Get minus words for display based on tab
  const getMinusWordsForTab = () => {
    if (!analysisResult) return [];
    const allWords = analysisResult.suggestedMinusWords;

    if (activeTab === 'trash') {
      // High confidence - confirmed trash
      return allWords.filter(mw => mw.confidence === 'high' || !mw.confidence);
    } else if (activeTab === 'review') {
      // Medium/low confidence - need review
      return allWords.filter(mw => mw.confidence === 'medium' || mw.confidence === 'low');
    }
    return [];
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
          connectionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-purple-600" size={24} />
              <span className="ml-2 text-gray-600">Загрузка аккаунтов...</span>
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto text-amber-500 mb-3" size={32} />
              <p className="text-gray-700 font-medium">Нет подключённых аккаунтов</p>
              <p className="text-gray-500 text-sm mt-1">
                Подключите Яндекс.Директ в разделе проектов для автоматической загрузки запросов
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Аккаунт</label>
              <select
                value={activeConnectionId || ''}
                onChange={(e) => setActiveConnectionId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.login} ({conn.projectName})
                  </option>
                ))}
              </select>
            </div>

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
          </div>
          )
        ) : (
          <div className="space-y-4 mb-6">
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
        {!(sourceMode === 'auto' && (connectionsLoading || connections.length === 0)) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Описание бизнеса <span className="text-gray-400 font-normal">(для AI-анализа)</span>
              </label>
              {sourceMode === 'auto' && briefDescription && (
                <button
                  type="button"
                  onClick={() => setBusinessDescription(briefDescription)}
                  className="text-xs text-purple-600 hover:text-purple-700"
                >
                  Заполнить из брифа
                </button>
              )}
            </div>
            {sourceMode === 'auto' && briefDescription && businessDescription === briefDescription && (
              <p className="text-xs text-green-600 mb-1">✓ Загружено из брифа проекта</p>
            )}
            <textarea
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder={briefDescription || "Опишите ваш бизнес для более точного AI-анализа (опционально)..."}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            {!businessDescription && (
              <p className="text-xs text-gray-500 mt-1">
                Без описания будет использован только базовый анализ
              </p>
            )}
          </div>
        )}

        {/* Analyze button */}
        {!(sourceMode === 'auto' && (connectionsLoading || connections.length === 0)) && (
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
        )}
      </div>

      {/* Results */}
      {analysisResult && (
        <>
          {/* Warning if AI was unavailable */}
          {analysisWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-amber-800 font-medium">Ограничение</p>
                <p className="text-amber-700 text-sm">{analysisWarning}</p>
              </div>
            </div>
          )}

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
              {filteredInfo && filteredInfo.filtered > 0 && (
                <div className="text-xs text-gray-400 mt-1">
                  Отфильтровано {filteredInfo.filtered.toLocaleString('ru-RU')} шумовых
                </div>
              )}
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

          {/* Main Content - Minus Words as Primary View */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
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
                Мусор ({analysisResult.suggestedMinusWords.filter(mw => mw.confidence === 'high' || !mw.confidence).length})
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
                Проверить ({analysisResult.suggestedMinusWords.filter(mw => mw.confidence === 'medium' || mw.confidence === 'low').length})
              </button>
              <button
                onClick={() => setActiveTab('debug')}
                className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'debug'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Bug size={16} />
                Все запросы ({analysisResult.reviewQueries.length})
              </button>
            </div>

            {/* Content */}
            {activeTab === 'debug' ? (
              /* Debug view - all review queries for manual inspection */
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                <div className="p-4 bg-blue-50 text-sm text-blue-800">
                  <strong>Режим отладки:</strong> Все запросы из категории "Проверить".
                  Используйте для поиска пропущенных минус-слов.
                </div>
                {analysisResult.reviewQueries
                  .sort((a, b) => b.metrics.cost - a.metrics.cost)
                  .map((query, index) => (
                  <div key={index} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{query.query}</p>
                        <p className="text-sm text-gray-500 mt-1">{query.reason}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>{query.metrics.clicks} кликов</span>
                          <span>{query.metrics.cost.toLocaleString('ru-RU')}₽</span>
                          <span>{query.metrics.conversions} конв.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Minus words view */
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {getMinusWordsForTab().length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {activeTab === 'trash'
                      ? 'Нет подтверждённых минус-слов'
                      : 'Нет слов для проверки'}
                  </div>
                ) : (
                  getMinusWordsForTab().map((mw, index) => {
                    const exampleQueries = mw.exampleQueries || [];
                    const isExpanded = expandedWords.has(mw.word);

                    return (
                      <div key={index} className="border-b border-gray-100 last:border-b-0">
                        <div
                          className={`p-4 cursor-pointer transition-colors ${
                            selectedMinusWords.has(mw.word)
                              ? 'bg-red-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedMinusWords.has(mw.word)}
                              onChange={() => toggleMinusWord(mw.word)}
                              className="mt-1 h-4 w-4 text-red-600 rounded border-gray-300"
                            />
                            <div
                              className="flex-1 min-w-0"
                              onClick={() => toggleWordExpand(mw.word)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <XCircle className="text-red-500" size={18} />
                                  <span className="font-semibold text-gray-900">-{mw.word}</span>
                                  {mw.confidence === 'medium' && (
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
                                      проверить
                                    </span>
                                  )}
                                  {mw.confidence === 'low' && (
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                                      возможно
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-red-600 font-medium">
                                    -{mw.potentialSavings.toLocaleString('ru-RU')}₽
                                  </span>
                                  {exampleQueries.length > 0 ? (
                                    isExpanded ? (
                                      <ChevronUp size={16} className="text-gray-400" />
                                    ) : (
                                      <ChevronDown size={16} className="text-gray-400" />
                                    )
                                  ) : null}
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{mw.reason}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                Затронет {mw.queriesAffected} запросов
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Expanded: show example queries */}
                        {isExpanded && exampleQueries.length > 0 && (
                          <div className="bg-gray-50 border-t border-gray-200 p-4">
                            <p className="text-sm font-medium text-gray-700 mb-3">
                              Примеры запросов с этим словом:
                            </p>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                              {exampleQueries.map((q, qi) => (
                                <div key={qi} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                                  <span className="text-sm text-gray-800 truncate flex-1">{q.query}</span>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 ml-2">
                                    <span>{q.clicks} кл.</span>
                                    <span>{q.cost.toFixed(0)}₽</span>
                                  </div>
                                </div>
                              ))}
                              {mw.queriesAffected > exampleQueries.length && (
                                <p className="text-xs text-gray-400 text-center">
                                  ...и ещё {mw.queriesAffected - exampleQueries.length} запросов
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Export Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Выбрано минус-слов: <strong>{selectedMinusWords.size}</strong>
                </span>
                <button
                  onClick={handleExport}
                  disabled={selectedMinusWords.size === 0}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
