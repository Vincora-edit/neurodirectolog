import OpenAI from 'openai';
import { clickhouseService } from './clickhouse.service';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface CampaignAnalysisData {
  campaignId: string;
  campaignName: string;
  stats: {
    totalImpressions: number;
    totalClicks: number;
    totalCost: number;
    avgCtr: number;
    avgCpc: number;
    totalConversions: number;
    avgConversionRate: number;
    roi: number;
  };
}

export const aiAnalysisService = {
  /**
   * Анализировать кампанию и сгенерировать рекомендации
   */
  async analyzeCampaign(campaignId: string, connectionId: string): Promise<void> {
    console.log(`[AI Analysis] Analyzing campaign ${campaignId}`);

    try {
      // 1. Получаем статистику за последние 30 дней
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const aggregatedStats = await clickhouseService.getAggregatedStats(
        connectionId,
        startDate,
        endDate
      );

      const campaignStats = aggregatedStats.find(s => s.campaignId === campaignId);
      if (!campaignStats) {
        console.log(`[AI Analysis] No stats found for campaign ${campaignId}`);
        return;
      }

      // 2. Получаем информацию о кампании
      const campaigns = await clickhouseService.getCampaignsByConnectionId(connectionId);
      const campaign = campaigns.find(c => c.externalId === campaignId);
      if (!campaign) {
        console.log(`[AI Analysis] Campaign ${campaignId} not found`);
        return;
      }

      const analysisData: CampaignAnalysisData = {
        campaignId,
        campaignName: campaign.name,
        stats: {
          totalImpressions: campaignStats.totalImpressions,
          totalClicks: campaignStats.totalClicks,
          totalCost: campaignStats.totalCost,
          avgCtr: campaignStats.avgCtr,
          avgCpc: campaignStats.avgCpc,
          totalConversions: campaignStats.totalConversions,
          avgConversionRate: campaignStats.avgConversionRate,
          roi: campaignStats.roi,
        },
      };

      // 3. Определяем проблемы и генерируем рекомендации
      const recommendations = await this.generateRecommendations(analysisData);

      // 4. Сохраняем рекомендации в ClickHouse
      for (const rec of recommendations) {
        await clickhouseService.createRecommendation({
          campaignId,
          type: rec.type,
          category: rec.category,
          title: rec.title,
          description: rec.description,
          actionText: rec.actionText,
          isApplied: false,
          isDismissed: false,
        });
      }

      console.log(`[AI Analysis] Generated ${recommendations.length} recommendations for campaign ${campaignId}`);
    } catch (error) {
      console.error(`[AI Analysis] Error analyzing campaign ${campaignId}:`, error);
      throw error;
    }
  },

  /**
   * Сгенерировать рекомендации на основе статистики
   */
  async generateRecommendations(data: CampaignAnalysisData): Promise<Array<{
    type: 'warning' | 'suggestion' | 'critical';
    category: 'budget' | 'ctr' | 'conversions' | 'keywords';
    title: string;
    description: string;
    actionText: string;
  }>> {
    const recommendations: any[] = [];

    // Правило 1: Низкий CTR (< 2%)
    if (data.stats.avgCtr < 2.0) {
      recommendations.push({
        type: 'warning',
        category: 'ctr',
        title: 'Низкий CTR кампании',
        description: `CTR кампании "${data.campaignName}" составляет ${data.stats.avgCtr.toFixed(2)}%, что ниже среднего по рынку (3-5%). Это может указывать на нерелевантные объявления или слабые УТП.`,
        actionText: 'Пересмотреть тексты объявлений и добавить более яркие УТП',
      });
    }

    // Правило 2: Высокий CPC (> 100 руб)
    if (data.stats.avgCpc > 100) {
      recommendations.push({
        type: 'warning',
        category: 'budget',
        title: 'Высокая стоимость клика',
        description: `Средняя стоимость клика ${data.stats.avgCpc.toFixed(2)} руб может быть завышена из-за высокой конкуренции или неоптимальных ставок.`,
        actionText: 'Снизить ставки или добавить минус-слова для фильтрации нецелевого трафика',
      });
    }

    // Правило 3: Нет конверсий
    if (data.stats.totalConversions === 0 && data.stats.totalClicks > 50) {
      recommendations.push({
        type: 'critical',
        category: 'conversions',
        title: 'Отсутствуют конверсии',
        description: `При ${data.stats.totalClicks} кликах конверсий не зафиксировано. Возможны проблемы с посадочной страницей или настройкой целей.`,
        actionText: 'Проверить настройки целей в Метрике и оптимизировать посадочную страницу',
      });
    }

    // Правило 4: Низкая конверсия (< 2% при наличии кликов)
    if (data.stats.avgConversionRate < 2.0 && data.stats.totalConversions > 0) {
      recommendations.push({
        type: 'warning',
        category: 'conversions',
        title: 'Низкий процент конверсии',
        description: `Conversion rate ${data.stats.avgConversionRate.toFixed(2)}% ниже среднего. Это может говорить о проблемах с посадочной или нецелевом трафике.`,
        actionText: 'Улучшить посадочную страницу и добавить минус-слова',
      });
    }

    // Правило 5: Отрицательный ROI
    if (data.stats.roi < 0) {
      recommendations.push({
        type: 'critical',
        category: 'budget',
        title: 'Убыточная кампания',
        description: `ROI кампании отрицательный (${data.stats.roi.toFixed(2)}%). Расходы превышают доходы.`,
        actionText: 'Приостановить кампанию и пересмотреть стратегию',
      });
    }

    // Если нет простых правил, используем AI для более глубокого анализа
    if (recommendations.length === 0) {
      const aiRecommendations = await this.getAIRecommendations(data);
      recommendations.push(...aiRecommendations);
    }

    return recommendations;
  },

  /**
   * Получить рекомендации от AI (GPT-4)
   */
  async getAIRecommendations(data: CampaignAnalysisData): Promise<any[]> {
    try {
      // If OpenAI is not configured, return basic recommendation
      if (!openai) {
        console.log('[AI Analysis] OpenAI not configured, returning basic recommendation');
        return [{
          type: 'suggestion',
          category: 'budget',
          title: 'Продолжайте мониторинг',
          description: 'Настройте OPENAI_API_KEY для получения AI-рекомендаций',
          actionText: 'Добавьте OPENAI_API_KEY в .env файл',
        }];
      }

      const prompt = `Ты - эксперт по контекстной рекламе в Яндекс.Директ. Проанализируй статистику кампании и дай рекомендации по оптимизации.

Кампания: ${data.campaignName}

Статистика за последние 30 дней:
- Показы: ${data.stats.totalImpressions}
- Клики: ${data.stats.totalClicks}
- CTR: ${data.stats.avgCtr.toFixed(2)}%
- Средний CPC: ${data.stats.avgCpc.toFixed(2)} руб
- Расход: ${data.stats.totalCost.toFixed(2)} руб
- Конверсии: ${data.stats.totalConversions}
- CR: ${data.stats.avgConversionRate.toFixed(2)}%
- ROI: ${data.stats.roi.toFixed(2)}%

Дай 1-3 конкретные рекомендации в формате JSON:
[
  {
    "type": "warning" | "suggestion" | "critical",
    "category": "budget" | "ctr" | "conversions" | "keywords",
    "title": "Краткий заголовок",
    "description": "Детальное описание проблемы и её последствий",
    "actionText": "Конкретное действие для исправления"
  }
]`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по контекстной рекламе. Отвечай только в формате JSON без дополнительного текста.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '[]';
      const recommendations = JSON.parse(content);

      return recommendations;
    } catch (error) {
      console.error('[AI Analysis] Failed to get AI recommendations:', error);
      return [{
        type: 'suggestion',
        category: 'budget',
        title: 'Продолжайте мониторинг',
        description: 'Статистика кампании в норме. Продолжайте отслеживать ключевые метрики.',
        actionText: 'Проверять показатели еженедельно',
      }];
    }
  },

  /**
   * Анализировать все кампании подключения
   * ОПТИМИЗАЦИЯ: Анализируем только активные кампании с данными за последние 7 дней
   */
  async analyzeAllCampaigns(connectionId: string): Promise<void> {
    console.log(`[AI Analysis] Starting analysis for connection ${connectionId}`);

    // 1. Получаем статистику один раз для всех кампаний
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Только последние 7 дней

    const aggregatedStats = await clickhouseService.getAggregatedStats(
      connectionId,
      startDate,
      endDate
    );

    // 2. Фильтруем: только кампании с активностью (показы > 100 или клики > 10)
    const activeCampaigns = aggregatedStats.filter(
      s => s.totalImpressions > 100 || s.totalClicks > 10
    );

    console.log(`[AI Analysis] Found ${activeCampaigns.length} active campaigns out of ${aggregatedStats.length} total`);

    if (activeCampaigns.length === 0) {
      console.log(`[AI Analysis] No active campaigns to analyze`);
      return;
    }

    // 3. Ограничиваем количество анализируемых кампаний (максимум 20)
    const campaignsToAnalyze = activeCampaigns.slice(0, 20);

    // 4. Получаем информацию о кампаниях один раз
    const campaigns = await clickhouseService.getCampaignsByConnectionId(connectionId);
    const campaignMap = new Map(campaigns.map(c => [c.externalId, c]));

    // 5. Анализируем выбранные кампании
    let analyzedCount = 0;
    for (const stats of campaignsToAnalyze) {
      try {
        const campaign = campaignMap.get(stats.campaignId);
        if (!campaign) continue;

        const recommendations = await this.generateRecommendations({
          campaignId: stats.campaignId,
          campaignName: campaign.name,
          stats: {
            totalImpressions: stats.totalImpressions,
            totalClicks: stats.totalClicks,
            totalCost: stats.totalCost,
            avgCtr: stats.avgCtr,
            avgCpc: stats.avgCpc,
            totalConversions: stats.totalConversions,
            avgConversionRate: stats.avgConversionRate,
            roi: stats.roi,
          },
        });

        // Сохраняем только если есть рекомендации и они не дублируются
        for (const rec of recommendations) {
          await clickhouseService.createRecommendation({
            campaignId: stats.campaignId,
            type: rec.type,
            category: rec.category,
            title: rec.title,
            description: rec.description,
            actionText: rec.actionText,
            isApplied: false,
            isDismissed: false,
          });
        }

        if (recommendations.length > 0) {
          analyzedCount++;
        }
      } catch (error) {
        console.error(`[AI Analysis] Failed to analyze campaign ${stats.campaignId}:`, error);
      }
    }

    console.log(`[AI Analysis] Completed: analyzed ${analyzedCount} campaigns with recommendations`);
  },
};
