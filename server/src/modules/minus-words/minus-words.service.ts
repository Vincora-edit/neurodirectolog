import { openAIService } from '../../services/openai.service';

export interface SearchQuery {
  query: string;
  clicks?: number;
  cost?: number;
  bounceRate?: number;
  conversions?: number;
  conversionCost?: number;
}

export interface AnalysisResult {
  query: string;
  category: 'целевой' | 'нецелевой' | 'под_вопросом';
  reasoning: string;
  metrics?: {
    cpc?: number;
    bounceRate?: number;
    conversionCost?: number;
  };
  recommendation: 'оставить' | 'в_минус' | 'оптимизировать';
  priority: 'высокий' | 'средний' | 'низкий';
}

export class MinusWordsService {
  /**
   * Анализ поисковых запросов с классификацией и рекомендациями
   */
  async analyzeSearchQueries(
    queries: SearchQuery[],
    niche: string,
    businessInfo: string
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    // Разбиваем на батчи по 20 запросов для эффективности
    const batchSize = 20;
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchResults = await this.analyzeBatch(batch, niche, businessInfo);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Анализ батча запросов
   */
  private async analyzeBatch(
    queries: SearchQuery[],
    niche: string,
    businessInfo: string
  ): Promise<AnalysisResult[]> {
    const openai = (openAIService as any).getOpenAI?.() || openAIService;

    const queriesText = queries.map((q, idx) => {
      let text = `${idx + 1}. "${q.query}"`;
      if (q.clicks !== undefined) text += ` | Клики: ${q.clicks}`;
      if (q.cost !== undefined) text += ` | Расход: ${q.cost}₽`;
      if (q.bounceRate !== undefined) text += ` | Отказы: ${q.bounceRate}%`;
      if (q.conversions !== undefined) text += ` | Конверсии: ${q.conversions}`;
      if (q.conversionCost !== undefined) text += ` | Цена конв: ${q.conversionCost}₽`;
      return text;
    }).join('\n');

    const prompt = `Проанализируй поисковые запросы для бизнеса в нише "${niche}".

Информация о бизнесе: ${businessInfo}

Запросы для анализа:
${queriesText}

Для каждого запроса определи:

1. КАТЕГОРИЯ:
   - "целевой" - запрос от потенциального клиента, готового к покупке/заявке
   - "нецелевой" - запрос НЕ от целевой аудитории (конкуренты, вакансии, обучение, бесплатное, скачать, отзывы, форумы, работа и т.д.)
   - "под_вопросом" - неоднозначный запрос

2. РЕКОМЕНДАЦИЯ на основе категории И метрик:
   - "в_минус" - добавить в минус-слова (нецелевой или плохие метрики)
   - "оптимизировать" - целевой, но дорогой/с отказами (снизить ставку, улучшить посадочную)
   - "оставить" - целевой с хорошими метриками

3. ПРИОРИТЕТ (для минус-слов):
   - "высокий" - явно нецелевой, большой расход
   - "средний" - под вопросом, средний расход
   - "низкий" - небольшой расход, но нецелевой

Критерии оценки метрик:
- CPC > средней по нише на 50%+ = дорого
- Отказы > 70% = плохо
- Цена конверсии > целевой в 2+ раза = неэффективно
- Нет конверсий при большом расходе = в минус

Верни JSON массив объектов:
[
  {
    "query": "текст запроса",
    "category": "целевой|нецелевой|под_вопросом",
    "reasoning": "краткое объяснение (1-2 предложения)",
    "recommendation": "оставить|в_минус|оптимизировать",
    "priority": "высокий|средний|низкий"
  }
]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Ты эксперт по контекстной рекламе Яндекс.Директ. Специализируешься на оптимизации поисковых запросов и подборе минус-слов.

Твоя задача - классифицировать запросы и дать четкие рекомендации на основе:
1. Целевой/нецелевой трафик
2. Метрики эффективности
3. Потенциал конверсии`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{"results": []}';
    const parsed = JSON.parse(content);
    const analysisResults = parsed.results || parsed;

    // Добавляем метрики к результатам
    return analysisResults.map((result: any, idx: number) => ({
      ...result,
      metrics: {
        cpc: queries[idx].cost && queries[idx].clicks
          ? queries[idx].cost! / queries[idx].clicks!
          : undefined,
        bounceRate: queries[idx].bounceRate,
        conversionCost: queries[idx].conversionCost
      }
    }));
  }

  /**
   * Генерация списка минус-слов из нецелевых запросов
   */
  extractMinusWords(analysisResults: AnalysisResult[]): string[] {
    return analysisResults
      .filter(r => r.recommendation === 'в_минус')
      .map(r => r.query)
      .sort((a, b) => {
        // Сортируем по приоритету
        const priorityOrder = { 'высокий': 0, 'средний': 1, 'низкий': 2 };
        const resultA = analysisResults.find(r => r.query === a);
        const resultB = analysisResults.find(r => r.query === b);
        return priorityOrder[resultA?.priority || 'низкий'] - priorityOrder[resultB?.priority || 'низкий'];
      });
  }

  /**
   * Генерация отчета по оптимизации
   */
  generateOptimizationReport(analysisResults: AnalysisResult[]): any {
    const total = analysisResults.length;
    const toMinus = analysisResults.filter(r => r.recommendation === 'в_минус').length;
    const toOptimize = analysisResults.filter(r => r.recommendation === 'оптимизировать').length;
    const toKeep = analysisResults.filter(r => r.recommendation === 'оставить').length;

    const categories = {
      целевые: analysisResults.filter(r => r.category === 'целевой').length,
      нецелевые: analysisResults.filter(r => r.category === 'нецелевой').length,
      под_вопросом: analysisResults.filter(r => r.category === 'под_вопросом').length
    };

    const highPriority = analysisResults.filter(
      r => r.recommendation === 'в_минус' && r.priority === 'высокий'
    );

    return {
      summary: {
        total,
        toMinus,
        toOptimize,
        toKeep,
        categories
      },
      highPriorityMinusWords: highPriority.map(r => ({
        query: r.query,
        reasoning: r.reasoning,
        metrics: r.metrics
      })),
      recommendations: {
        immediate: `Добавить в минус-слова ${highPriority.length} запросов с высоким приоритетом`,
        optimize: `Оптимизировать ${toOptimize} запросов (снизить ставки, улучшить посадочные)`,
        monitor: `Отслеживать ${analysisResults.filter(r => r.category === 'под_вопросом').length} неоднозначных запросов`
      }
    };
  }
}

export const minusWordsService = new MinusWordsService();
