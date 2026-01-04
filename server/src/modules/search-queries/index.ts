/**
 * Search Queries Module
 * Анализ поисковых запросов и автоматическое формирование минус-слов
 */

export { default as searchQueriesRouter } from './search-queries.routes';
export { searchQueriesService } from './search-queries.service';
export type {
  SearchQuery,
  QueryAnalysis,
  MinusWordSuggestion,
  QueryCluster,
  AnalysisResult,
} from './search-queries.service';
