import axios from 'axios';

const YANDEX_OAUTH_URL = 'https://oauth.yandex.ru';
const YANDEX_API_URL = 'https://api.direct.yandex.com/json/v5';

export interface YandexTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface YandexCampaign {
  Id: number;
  Name: string;
  Status: 'ACCEPTED' | 'DRAFT' | 'MODERATION' | 'REJECTED';
  State: 'ON' | 'OFF' | 'SUSPENDED' | 'ENDED' | 'ARCHIVED';
  Type: 'TEXT_CAMPAIGN' | 'MOBILE_APP_CAMPAIGN' | 'DYNAMIC_TEXT_CAMPAIGN';
  DailyBudget?: {
    Amount: number;
    Mode: string;
  };
}

export interface YandexCampaignStats {
  campaignId: number;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
}

export const yandexDirectService = {
  /**
   * Получить URL для OAuth авторизации
   */
  getAuthUrl(clientId: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      force_confirm: 'yes',
    });
    return `${YANDEX_OAUTH_URL}/authorize?${params.toString()}`;
  },

  /**
   * Обменять код авторизации на токены
   */
  async getTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<YandexTokenResponse> {
    const response = await axios.post(
      `${YANDEX_OAUTH_URL}/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data;
  },

  /**
   * Обновить access token используя refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<YandexTokenResponse> {
    const response = await axios.post(
      `${YANDEX_OAUTH_URL}/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data;
  },

  /**
   * Получить список кампаний
   */
  async getCampaigns(accessToken: string, login: string): Promise<YandexCampaign[]> {
    const response = await axios.post(
      `${YANDEX_API_URL}/campaigns`,
      {
        method: 'get',
        params: {
          SelectionCriteria: {},
          FieldNames: ['Id', 'Name', 'Status', 'State', 'Type', 'DailyBudget'],
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Login': login,
          'Accept-Language': 'ru',
        },
      }
    );

    if (response.data.error) {
      throw new Error(`Yandex API Error: ${response.data.error.error_string}`);
    }

    return response.data.result?.Campaigns || [];
  },

  /**
   * Получить статистику по кампаниям
   */
  async getCampaignStats(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string, // YYYY-MM-DD
    dateTo: string // YYYY-MM-DD
  ): Promise<YandexCampaignStats[]> {
    if (campaignIds.length === 0) return [];

    const response = await axios.post(
      `${YANDEX_API_URL}/reports`,
      {
        params: {
          SelectionCriteria: {
            DateFrom: dateFrom,
            DateTo: dateTo,
            Filter: [
              {
                Field: 'CampaignId',
                Operator: 'IN',
                Values: campaignIds.map(String),
              },
            ],
          },
          FieldNames: ['Date', 'CampaignId', 'Impressions', 'Clicks', 'Cost'],
          ReportName: 'Campaign Stats Report',
          ReportType: 'CAMPAIGN_PERFORMANCE_REPORT',
          DateRangeType: 'CUSTOM_DATE',
          Format: 'TSV',
          IncludeVAT: 'YES',
          IncludeDiscount: 'NO',
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Login': login,
          'Accept-Language': 'ru',
          'returnMoneyInMicros': 'false',
          'skipReportHeader': 'true',
          'skipReportSummary': 'true',
        },
      }
    );

    // Parse TSV response
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    const stats: YandexCampaignStats[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const [date, campaignId, impressions, clicks, cost] = line.split('\t');

      // Skip header row (first line contains "Date", "CampaignId", etc.)
      if (i === 0 && date === 'Date') continue;

      // Skip invalid rows
      const campaignIdNum = parseInt(campaignId);
      if (date && !isNaN(campaignIdNum) && impressions !== undefined) {
        stats.push({
          campaignId: campaignIdNum,
          date,
          impressions: parseInt(impressions) || 0,
          clicks: parseInt(clicks) || 0,
          cost: parseFloat(cost) || 0,
        });
      }
    }

    return stats;
  },

  /**
   * Получить информацию о пользователе
   */
  async getUserInfo(accessToken: string): Promise<{ login: string }> {
    const response = await axios.get('https://login.yandex.ru/info', {
      headers: {
        'Authorization': `OAuth ${accessToken}`,
      },
    });

    return {
      login: response.data.login,
    };
  },

  /**
   * Вычислить метрики на основе сырых данных
   */
  calculateMetrics(stats: YandexCampaignStats, conversions: number = 0, revenue: number = 0) {
    const ctr = stats.clicks > 0 ? (stats.clicks / stats.impressions) * 100 : 0;
    const avgCpc = stats.clicks > 0 ? stats.cost / stats.clicks : 0;
    const avgCpm = stats.impressions > 0 ? (stats.cost / stats.impressions) * 1000 : 0;
    const conversionRate = stats.clicks > 0 ? (conversions / stats.clicks) * 100 : 0;
    const costPerConversion = conversions > 0 ? stats.cost / conversions : 0;
    const roi = stats.cost > 0 ? ((revenue - stats.cost) / stats.cost) * 100 : 0;

    return {
      ...stats,
      ctr: parseFloat(ctr.toFixed(2)),
      avgCpc: parseFloat(avgCpc.toFixed(2)),
      avgCpm: parseFloat(avgCpm.toFixed(2)),
      conversions,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      costPerConversion: parseFloat(costPerConversion.toFixed(2)),
      qualifiedLeads: 0, // Will be set from Metrika
      costPerQualifiedLead: 0,
      revenue,
      roi: parseFloat(roi.toFixed(2)),
    };
  },

  /**
   * Получить детальную статистику с конверсиями (Campaign Performance Report)
   */
  async getCampaignPerformanceReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    goalIds: string[],
    dateFrom: string,
    dateTo: string
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    // Формируем список полей для CAMPAIGN_PERFORMANCE_REPORT
    // ВАЖНО: Этот отчёт поддерживает только уровень кампаний, без детализации по группам/объявлениям
    const fields = [
      'Date',
      'CampaignId',
      'CampaignName',
      'CampaignType',
      // AdGroupId, AdGroupName, AdId - НЕ поддерживаются в CAMPAIGN_PERFORMANCE_REPORT
      'Impressions',
      'Clicks',
      'Cost',
      'Ctr',
      'AvgCpc',
      'BounceRate', // Процент отказов
      // AvgCpm - не поддерживается
      // AvgClickPosition, AvgImpressionPosition - не поддерживаются

      // Измерения (оставляем только те, что поддерживаются)
      // Device, Age, Gender, IncomeGrade - могут не поддерживаться, проверим
    ];

    // ВАЖНО: CAMPAIGN_PERFORMANCE_REPORT не поддерживает поля конверсий
    // Конверсии нужно получать через отдельный Custom Report
    // Временно отключаем поля конверсий чтобы хотя бы базовая статистика загрузилась
    // TODO: Добавить отдельный запрос для конверсий
    // goalIds.forEach(goalId => {
    //   fields.push(`GOAL_${goalId}_AUTO_CONVERSIONS`);
    //   fields.push(`GOAL_${goalId}_AUTO_REVENUE`);
    // });

    let response;
    try {
      response = await axios.post(
        `${YANDEX_API_URL}/reports`,
        {
          params: {
            SelectionCriteria: {
              DateFrom: dateFrom,
              DateTo: dateTo,
              Filter: [
                {
                  Field: 'CampaignId',
                  Operator: 'IN',
                  Values: campaignIds.map(String),
                },
              ],
            },
            FieldNames: fields,
            ReportName: 'Campaign Performance Report',
            ReportType: 'CAMPAIGN_PERFORMANCE_REPORT',
            DateRangeType: 'CUSTOM_DATE',
            Format: 'TSV',
            IncludeVAT: 'YES',
            IncludeDiscount: 'NO',
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-Login': login,
            'Accept-Language': 'ru',
            'returnMoneyInMicros': 'false',
            'skipReportHeader': 'true',
            'skipReportSummary': 'true',
          },
        }
      );
    } catch (error: any) {
      console.error('[getCampaignPerformanceReport] Yandex API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }

    // Parse TSV response
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length === 0) return [];

    // Первая строка - заголовки
    const headers = lines[0].split('\t');
    const results: any[] = [];

    // Парсим данные
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });

      // Пропускаем строку если это дубликат заголовка (Date = "Date")
      if (row.Date === 'Date') {
        console.log('[getCampaignPerformanceReport] Skipping header row at line', i);
        continue;
      }

      results.push(row);
    }

    return results;
  },

  /**
   * Получить данные конверсий через CUSTOM_REPORT
   * CUSTOM_REPORT поддерживает поля конверсий в отличие от CAMPAIGN_PERFORMANCE_REPORT
   */
  async getConversionsReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    goalIds: string[],
    dateFrom: string,
    dateTo: string
  ): Promise<any[]> {
    if (campaignIds.length === 0 || goalIds.length === 0) return [];

    // Запрашиваем данные по каждой цели отдельно
    const allResults: any[] = [];

    for (const goalId of goalIds) {
      console.log(`[getConversionsReport] Fetching data for goal ${goalId}`);

      try {
        const response = await axios.post(
          `${YANDEX_API_URL}/reports`,
          {
            params: {
              SelectionCriteria: {
                DateFrom: dateFrom,
                DateTo: dateTo,
                Filter: [
                  {
                    Field: 'CampaignId',
                    Operator: 'IN',
                    Values: campaignIds.map(String),
                  },
                ],
              },
              FieldNames: ['Date', 'CampaignId', 'CampaignName', 'Conversions', 'Revenue'],
              Goals: [goalId],
              AttributionModels: ['AUTO'],
              ReportName: `Conversions Report - Goal ${goalId}`,
              ReportType: 'CUSTOM_REPORT',
              DateRangeType: 'CUSTOM_DATE',
              Format: 'TSV',
              IncludeVAT: 'YES',
              IncludeDiscount: 'NO',
            },
          },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Client-Login': login,
              'Accept-Language': 'ru',
              'returnMoneyInMicros': 'false',
              'skipReportHeader': 'true',
              'skipReportSummary': 'true',
            },
          }
        );

        // Parse TSV response
        console.log(`[getConversionsReport] Raw response for goal ${goalId} (first 500 chars):`, response.data.substring(0, 500));
        const lines = response.data.split('\n').filter((line: string) => line.trim());
        if (lines.length === 0) {
          console.log(`[getConversionsReport] No data for goal ${goalId}`);
          continue;
        }

        const headers = lines[0].split('\t');
        console.log(`[getConversionsReport] Goal ${goalId} - headers:`, headers, 'lines:', lines.length);

        // Покажем первые 3 строки данных для отладки
        for (let debugIdx = 1; debugIdx < Math.min(4, lines.length); debugIdx++) {
          console.log(`[getConversionsReport] Line ${debugIdx}:`, lines[debugIdx]);
        }

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          const row: any = {};

          headers.forEach((header, index) => {
            row[header] = values[index] || null;
          });

          if (row.Date === 'Date') continue;

          // API возвращает колонки в формате Conversions_{goalId}_AUTO и Revenue_{goalId}_AUTO
          const conversionsKey = `Conversions_${goalId}_AUTO`;
          const revenueKey = `Revenue_${goalId}_AUTO`;

          const conversions = parseInt(row[conversionsKey]) || 0;
          const revenue = parseFloat(row[revenueKey]) || 0;

          console.log(`[getConversionsReport] Row data - Date: ${row.Date}, ${conversionsKey}: ${conversions}, ${revenueKey}: ${revenue}`);

          // Добавляем строку только если есть конверсии
          if (conversions > 0 || revenue > 0) {
            allResults.push({
              Date: row.Date,
              CampaignId: row.CampaignId,
              CampaignName: row.CampaignName,
              GoalId: goalId,
              Conversions: conversions,
              Revenue: revenue,
            });
          }
        }
      } catch (error: any) {
        console.error(`[getConversionsReport] Error fetching goal ${goalId}:`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        // Продолжаем с другими целями
      }
    }

    console.log(`[getConversionsReport] Total results: ${allResults.length}`);
    return allResults;
  },
};
