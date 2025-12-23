import axios from 'axios';

const METRIKA_API_URL = 'https://api-metrika.yandex.net/stat/v1/data';

export interface MetrikaGoalData {
  goalId: string;
  goalName: string;
  visits: number;
  reaches: number;
}

export interface MetrikaCampaignData {
  date: string;
  utmCampaign: string;
  visits: number;
  goals: MetrikaGoalData[];
}

export const yandexMetrikaService = {
  /**
   * Получить конверсии по целям из Метрики
   */
  async getGoalConversions(
    metrikaToken: string,
    counterId: string,
    goalIds: string[],
    dateFrom: string, // YYYY-MM-DD
    dateTo: string, // YYYY-MM-DD
    utmCampaign?: string
  ): Promise<MetrikaCampaignData[]> {
    try {
      const dimensions = ['ym:s:date'];
      if (utmCampaign) {
        dimensions.push('ym:s:UTMCampaign');
      }

      const metrics = ['ym:s:visits'];
      goalIds.forEach(goalId => {
        metrics.push(`ym:s:goal${goalId}reaches`);
      });

      const params: any = {
        id: counterId,
        date1: dateFrom,
        date2: dateTo,
        metrics: metrics.join(','),
        dimensions: dimensions.join(','),
        accuracy: '1',
        limit: 10000,
      };

      if (utmCampaign) {
        params.filters = `ym:s:UTMCampaign=='${utmCampaign}'`;
      }

      const response = await axios.get(METRIKA_API_URL, {
        params,
        headers: {
          'Authorization': `OAuth ${metrikaToken}`,
        },
      });

      const data = response.data;
      if (!data.data || data.data.length === 0) {
        return [];
      }

      // Parse response
      const results: MetrikaCampaignData[] = [];

      // Загружаем названия целей один раз для всех данных
      const goalNamesCache = await this.getGoalNames(metrikaToken, counterId, goalIds);

      data.data.forEach((row: any) => {
        const dimensions = row.dimensions;
        const metrics = row.metrics;

        const dateStr = dimensions[0].name;
        const campaign = utmCampaign || (dimensions[1]?.name || '');
        const visits = metrics[0];

        const goals: MetrikaGoalData[] = [];
        goalIds.forEach((goalId, index) => {
          goals.push({
            goalId,
            goalName: goalNamesCache.get(goalId) || `Goal ${goalId}`,
            visits: 0,
            reaches: metrics[index + 1] || 0,
          });
        });

        results.push({
          date: dateStr,
          utmCampaign: campaign,
          visits,
          goals,
        });
      });

      return results;
    } catch (error: any) {
      console.error('Metrika API Error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch Metrika data: ${error.message}`);
    }
  },

  /**
   * Получить список целей из счетчика
   */
  async getCounterGoals(metrikaToken: string, counterId: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://api-metrika.yandex.net/management/v1/counter/${counterId}/goals`,
        {
          headers: {
            'Authorization': `OAuth ${metrikaToken}`,
          },
        }
      );

      return response.data.goals || [];
    } catch (error: any) {
      console.error('Metrika Goals API Error:', error.response?.data || error.message);
      return [];
    }
  },

  /**
   * Получить названия целей по их ID
   */
  async getGoalNames(metrikaToken: string, counterId: string, goalIds: string[]): Promise<Map<string, string>> {
    const goalNames = new Map<string, string>();

    try {
      const goals = await this.getCounterGoals(metrikaToken, counterId);

      goals.forEach((goal: any) => {
        const goalId = String(goal.id);
        if (goalIds.includes(goalId)) {
          goalNames.set(goalId, goal.name || `Goal ${goalId}`);
        }
      });

      // Для целей, которые не нашлись, добавляем дефолтные имена
      goalIds.forEach(goalId => {
        if (!goalNames.has(goalId)) {
          goalNames.set(goalId, `Goal ${goalId}`);
        }
      });

      return goalNames;
    } catch (error) {
      console.error('Failed to fetch goal names:', error);
      // Возвращаем дефолтные имена для всех целей
      goalIds.forEach(goalId => {
        goalNames.set(goalId, `Goal ${goalId}`);
      });
      return goalNames;
    }
  },

  /**
   * Проверить валидность токена Метрики
   */
  async validateToken(metrikaToken: string, counterId: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `https://api-metrika.yandex.net/management/v1/counter/${counterId}`,
        {
          headers: {
            'Authorization': `OAuth ${metrikaToken}`,
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      return false;
    }
  },

  /**
   * Агрегировать конверсии по дате (суммируем все цели)
   */
  aggregateConversionsByDate(data: MetrikaCampaignData[]): Map<string, number> {
    const conversionsByDate = new Map<string, number>();

    data.forEach(item => {
      const totalReaches = item.goals.reduce((sum, goal) => sum + goal.reaches, 0);
      const existing = conversionsByDate.get(item.date) || 0;
      conversionsByDate.set(item.date, existing + totalReaches);
    });

    return conversionsByDate;
  },

  /**
   * Получить квалифицированные лиды (из определенной цели)
   */
  getQualifiedLeads(data: MetrikaCampaignData[], qualifiedGoalId: string): Map<string, number> {
    const leadsByDate = new Map<string, number>();

    data.forEach(item => {
      const qualifiedGoal = item.goals.find(g => g.goalId === qualifiedGoalId);
      if (qualifiedGoal) {
        const existing = leadsByDate.get(item.date) || 0;
        leadsByDate.set(item.date, existing + qualifiedGoal.reaches);
      }
    });

    return leadsByDate;
  },
};
