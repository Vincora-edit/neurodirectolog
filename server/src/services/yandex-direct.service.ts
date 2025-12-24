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

  /**
   * Получить статистику по группам объявлений
   * Базовые метрики получаем из ADGROUP_PERFORMANCE_REPORT (без Conversions)
   * Конверсии получаем из отдельного CUSTOM_REPORT и объединяем
   */
  async getAdGroupPerformanceReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string,
    goalIds?: string[]
  ): Promise<any[]> {
    console.log(`[getAdGroupPerformanceReport] Called with ${campaignIds.length} campaigns, goalIds: ${JSON.stringify(goalIds)}`);
    if (campaignIds.length === 0) {
      console.log(`[getAdGroupPerformanceReport] No campaigns, returning empty`);
      return [];
    }

    // Базовые поля БЕЗ Conversions - они вызывают проблемы при использовании с Goals
    const fields = [
      'Date',
      'CampaignId',
      'CampaignName',
      'AdGroupId',
      'AdGroupName',
      'Impressions',
      'Clicks',
      'Cost',
      'Ctr',
      'AvgCpc',
      'BounceRate',
    ];

    // 1. Получаем базовую статистику без конверсий
    const reportParams: any = {
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
      ReportName: `AG_Perf_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      ReportType: 'ADGROUP_PERFORMANCE_REPORT',
      DateRangeType: 'CUSTOM_DATE',
      Format: 'TSV',
      IncludeVAT: 'YES',
      IncludeDiscount: 'NO',
    };

    // Retry logic для offline отчётов (статус 201/202)
    let response;
    const maxRetries = 10;
    const retryDelay = 3000; // 3 секунды

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await axios.post(
          `${YANDEX_API_URL}/reports`,
          {
            params: reportParams,
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

        // 200 - отчёт готов, выходим из цикла
        if (response.status === 200) {
          console.log(`[getAdGroupPerformanceReport] Report ready on attempt ${attempt + 1}`);
          break;
        }

        // 201 - отчёт в очереди, 202 - отчёт формируется
        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryIn'] || response.headers['retryin'] || retryDelay;
          console.log(`[getAdGroupPerformanceReport] Report in queue (status ${response.status}), waiting ${retryIn}ms, attempt ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryIn) * 1000 || retryDelay));
          continue;
        }

      } catch (error: any) {
        console.error('[getAdGroupPerformanceReport] Yandex API Error:', {
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    }

    console.log(`[getAdGroupPerformanceReport] Got response, status: ${response?.status}, length: ${response?.data?.length || 0}`);
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    console.log(`[getAdGroupPerformanceReport] Parsed ${lines.length} lines`);
    if (lines.length < 2) {
      console.log(`[getAdGroupPerformanceReport] Too few lines, returning empty. First 500 chars:`, response.data?.substring?.(0, 500));
      return [];
    }

    const headers = lines[0].split('\t');
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });
      if (row.Date === 'Date') continue;
      row.TotalConversions = 0; // Будет заполнено из CUSTOM_REPORT
      results.push(row);
    }

    console.log(`[getAdGroupPerformanceReport] Fetched ${results.length} base rows`);

    // 2. Получаем конверсии через CUSTOM_REPORT и мерджим
    if (goalIds && goalIds.length > 0 && results.length > 0) {
      const conversionsData = await this.getAdGroupConversionsReport(
        accessToken,
        login,
        campaignIds,
        goalIds,
        dateFrom,
        dateTo
      );

      // Создаём мапу: campaignId_adGroupId_date -> total conversions
      const conversionsMap = new Map<string, number>();
      conversionsData.forEach(conv => {
        const key = `${conv.CampaignId}_${conv.AdGroupId}_${conv.Date}`;
        const existing = conversionsMap.get(key) || 0;
        conversionsMap.set(key, existing + (conv.Conversions || 0));
      });

      // Мерджим конверсии в результаты
      results.forEach(row => {
        const key = `${row.CampaignId}_${row.AdGroupId}_${row.Date}`;
        row.TotalConversions = conversionsMap.get(key) || 0;
      });

      console.log(`[getAdGroupPerformanceReport] Merged ${conversionsData.length} conversion records`);
    }

    return results;
  },

  /**
   * Получить конверсии по группам объявлений через CUSTOM_REPORT
   * Используем тот же подход что для кампаний:
   * - Goals: [goalId]
   * - AttributionModels: ['AUTO']
   * - Получаем колонки Conversions_<goalId>_AUTO и Revenue_<goalId>_AUTO
   */
  async getAdGroupConversionsReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    goalIds: string[],
    dateFrom: string,
    dateTo: string
  ): Promise<any[]> {
    if (campaignIds.length === 0 || goalIds.length === 0) return [];

    const allResults: any[] = [];

    console.log(`[getAdGroupConversionsReport] Fetching for ${campaignIds.length} campaigns, ${goalIds.length} goals`);

    // Запрашиваем данные для каждой цели отдельно (как делаем для кампаний)
    const maxRetries = 10;
    const retryDelay = 3000;

    for (const goalId of goalIds) {
      try {
        console.log(`[getAdGroupConversionsReport] Fetching data for goal ${goalId}...`);

        let response;
        const reportName = `AG_Conv_${goalId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Retry loop для offline отчётов
        for (let attempt = 0; attempt < maxRetries; attempt++) {
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
                FieldNames: ['Date', 'CampaignId', 'AdGroupId', 'Conversions', 'Revenue'],
                Goals: [parseInt(goalId)],
                AttributionModels: ['AUTO'],
                ReportName: reportName,
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

          if (response.status === 200) {
            console.log(`[getAdGroupConversionsReport] Goal ${goalId} ready on attempt ${attempt + 1}`);
            break;
          }

          if (response.status === 201 || response.status === 202) {
            const retryIn = response.headers['retryin'] || retryDelay / 1000;
            console.log(`[getAdGroupConversionsReport] Goal ${goalId} in queue (status ${response.status}), waiting, attempt ${attempt + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, parseInt(retryIn) * 1000 || retryDelay));
            continue;
          }
        }

        console.log(`[getAdGroupConversionsReport] Goal ${goalId} response status: ${response?.status}, length: ${response?.data?.length || 0}`);

        const lines = response.data.split('\n').filter((line: string) => line.trim());
        if (lines.length === 0) {
          console.log(`[getAdGroupConversionsReport] No data for goal ${goalId}`);
          continue;
        }

        const headers = lines[0].split('\t');
        console.log(`[getAdGroupConversionsReport] Goal ${goalId} headers:`, headers);

        // Колонки будут в формате Conversions_<goalId>_AUTO и Revenue_<goalId>_AUTO
        const conversionsKey = `Conversions_${goalId}_AUTO`;
        const revenueKey = `Revenue_${goalId}_AUTO`;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          const row: any = {};
          headers.forEach((header: string, index: number) => {
            row[header] = values[index] || null;
          });

          if (row.Date === 'Date') continue;

          const conversions = parseInt(row[conversionsKey]) || 0;
          const revenue = parseFloat(row[revenueKey]) || 0;

          if (i <= 3) {
            console.log(`[getAdGroupConversionsReport] Goal ${goalId} row ${i}: AdGroupId=${row.AdGroupId}, ${conversionsKey}=${conversions}, ${revenueKey}=${revenue}`);
          }

          if (conversions > 0 || revenue > 0) {
            allResults.push({
              Date: row.Date,
              CampaignId: row.CampaignId,
              AdGroupId: row.AdGroupId,
              GoalId: goalId,
              Conversions: conversions,
              Revenue: revenue,
            });
          }
        }

        console.log(`[getAdGroupConversionsReport] Goal ${goalId}: found ${allResults.length} total rows with conversions so far`);

      } catch (error: any) {
        console.error(`[getAdGroupConversionsReport] Error for goal ${goalId}:`, {
          status: error.response?.status,
          data: error.response?.data?.substring?.(0, 500) || error.response?.data,
        });
      }
    }

    console.log(`[getAdGroupConversionsReport] Total results: ${allResults.length}`);
    return allResults;
  },

  /**
   * Получить конверсии по объявлениям через CUSTOM_REPORT
   * Используем тот же подход что для кампаний и групп
   */
  async getAdConversionsReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    goalIds: string[],
    dateFrom: string,
    dateTo: string
  ): Promise<any[]> {
    if (campaignIds.length === 0 || goalIds.length === 0) return [];

    const allResults: any[] = [];
    console.log(`[getAdConversionsReport] Fetching for ${campaignIds.length} campaigns, ${goalIds.length} goals`);

    // Для каждой цели делаем отдельный запрос
    const maxRetries = 10;
    const retryDelay = 3000;

    for (const goalId of goalIds) {
      try {
        console.log(`[getAdConversionsReport] Fetching data for goal ${goalId}...`);

        let response;
        const reportName = `Ad_Conv_${goalId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Retry loop для offline отчётов
        for (let attempt = 0; attempt < maxRetries; attempt++) {
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
                FieldNames: ['Date', 'CampaignId', 'AdGroupId', 'AdId', 'Conversions', 'Revenue'],
                Goals: [parseInt(goalId)],
                AttributionModels: ['AUTO'],
                ReportName: reportName,
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

          if (response.status === 200) {
            console.log(`[getAdConversionsReport] Goal ${goalId} ready on attempt ${attempt + 1}`);
            break;
          }

          if (response.status === 201 || response.status === 202) {
            const retryIn = response.headers['retryin'] || retryDelay / 1000;
            console.log(`[getAdConversionsReport] Goal ${goalId} in queue (status ${response.status}), waiting, attempt ${attempt + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, parseInt(retryIn) * 1000 || retryDelay));
            continue;
          }
        }

        console.log(`[getAdConversionsReport] Goal ${goalId} response status: ${response?.status}, length: ${response?.data?.length || 0}`);

        const lines = response.data.split('\n').filter((line: string) => line.trim());
        if (lines.length === 0) {
          console.log(`[getAdConversionsReport] No data for goal ${goalId}`);
          continue;
        }

        const headers = lines[0].split('\t');
        console.log(`[getAdConversionsReport] Goal ${goalId} headers:`, headers);

        const conversionsKey = `Conversions_${goalId}_AUTO`;
        const revenueKey = `Revenue_${goalId}_AUTO`;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          const row: any = {};
          headers.forEach((header: string, index: number) => {
            row[header] = values[index] || null;
          });
          if (row.Date === 'Date') continue;

          const conversions = parseInt(row[conversionsKey]) || 0;
          const revenue = parseFloat(row[revenueKey]) || 0;

          if (i <= 3) {
            console.log(`[getAdConversionsReport] Goal ${goalId} row ${i}: AdId=${row.AdId}, ${conversionsKey}=${conversions}`);
          }

          if (conversions > 0 || revenue > 0) {
            allResults.push({
              Date: row.Date,
              CampaignId: row.CampaignId,
              AdGroupId: row.AdGroupId,
              AdId: row.AdId,
              GoalId: goalId,
              Conversions: conversions,
              Revenue: revenue,
            });
          }
        }

        console.log(`[getAdConversionsReport] Goal ${goalId}: found ${allResults.length} total rows with conversions so far`);

      } catch (error: any) {
        console.error(`[getAdConversionsReport] Error fetching goal ${goalId}:`, {
          status: error.response?.status,
          data: error.response?.data?.substring?.(0, 500) || error.response?.data,
        });
      }
    }

    console.log(`[getAdConversionsReport] Total results: ${allResults.length}`);
    return allResults;
  },

  /**
   * Получить заголовки объявлений через Ads.get API
   * Returns Map<adId, { title: string, title2?: string }>
   */
  async getAdTitles(
    accessToken: string,
    login: string,
    adIds: string[]
  ): Promise<Map<string, { title: string; title2?: string; href?: string }>> {
    const result = new Map<string, { title: string; title2?: string; href?: string }>();
    if (adIds.length === 0) return result;

    // API поддерживает максимум 10000 ID за раз, разбиваем на чанки
    const chunkSize = 10000;
    for (let i = 0; i < adIds.length; i += chunkSize) {
      const chunk = adIds.slice(i, i + chunkSize);

      try {
        const response = await axios.post(
          `${YANDEX_API_URL}/ads`,
          {
            method: 'get',
            params: {
              SelectionCriteria: {
                Ids: chunk.map(id => parseInt(id)),
              },
              FieldNames: ['Id', 'State', 'Type'],
              TextAdFieldNames: ['Title', 'Title2', 'Text', 'Href'],
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

        if (response.data.result?.Ads) {
          for (const ad of response.data.result.Ads) {
            const adId = String(ad.Id);
            if (ad.TextAd) {
              result.set(adId, {
                title: ad.TextAd.Title || '',
                title2: ad.TextAd.Title2 || undefined,
                href: ad.TextAd.Href || undefined,
              });
            }
          }
        }
      } catch (error: any) {
        console.error('[getAdTitles] Error fetching ad titles:', {
          status: error.response?.status,
          data: error.response?.data,
        });
      }
    }

    console.log(`[getAdTitles] Fetched titles for ${result.size} ads`);
    return result;
  },

  /**
   * Получить статистику по объявлениям
   * Базовые метрики получаем из AD_PERFORMANCE_REPORT (без Conversions)
   * Конверсии получаем из отдельного CUSTOM_REPORT и объединяем
   */
  async getAdPerformanceReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string,
    goalIds?: string[]
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    // Базовые поля БЕЗ Conversions
    const fields = [
      'Date',
      'CampaignId',
      'CampaignName',
      'AdGroupId',
      'AdGroupName',
      'AdId',
      'Impressions',
      'Clicks',
      'Cost',
      'Ctr',
      'AvgCpc',
      'BounceRate',
    ];

    // 1. Получаем базовую статистику без конверсий
    const reportParams: any = {
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
      ReportName: `Ad_Perf_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      ReportType: 'AD_PERFORMANCE_REPORT',
      DateRangeType: 'CUSTOM_DATE',
      Format: 'TSV',
      IncludeVAT: 'YES',
      IncludeDiscount: 'NO',
    };

    // Retry logic для offline отчётов (статус 201/202)
    let response;
    const maxRetries = 10;
    const retryDelay = 3000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await axios.post(
          `${YANDEX_API_URL}/reports`,
          {
            params: reportParams,
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

        if (response.status === 200) {
          console.log(`[getAdPerformanceReport] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getAdPerformanceReport] Report in queue (status ${response.status}), waiting, attempt ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryIn) * 1000 || retryDelay));
          continue;
        }
      } catch (error: any) {
        console.error('[getAdPerformanceReport] Yandex API Error:', {
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    }

    console.log(`[getAdPerformanceReport] Got response, status: ${response?.status}, length: ${response?.data?.length || 0}`);
    const lines = response?.data?.split('\n').filter((line: string) => line.trim()) || [];
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, index: number) => {
        row[header] = values[index] || null;
      });
      if (row.Date === 'Date') continue;
      row.TotalConversions = 0; // Будет заполнено из CUSTOM_REPORT
      results.push(row);
    }

    console.log(`[getAdPerformanceReport] Fetched ${results.length} base rows`);

    // 2. Получаем конверсии через CUSTOM_REPORT и мерджим
    if (goalIds && goalIds.length > 0 && results.length > 0) {
      const conversionsData = await this.getAdConversionsReport(
        accessToken,
        login,
        campaignIds,
        goalIds,
        dateFrom,
        dateTo
      );

      // Создаём мапу: campaignId_adGroupId_adId_date -> total conversions
      const conversionsMap = new Map<string, number>();
      conversionsData.forEach((conv: any) => {
        const key = `${conv.CampaignId}_${conv.AdGroupId}_${conv.AdId}_${conv.Date}`;
        const existing = conversionsMap.get(key) || 0;
        conversionsMap.set(key, existing + (conv.Conversions || 0));
      });

      // Мерджим конверсии в результаты
      results.forEach(row => {
        const key = `${row.CampaignId}_${row.AdGroupId}_${row.AdId}_${row.Date}`;
        row.TotalConversions = conversionsMap.get(key) || 0;
      });

      console.log(`[getAdPerformanceReport] Merged ${conversionsData.length} conversion records`);
    }

    return results;
  },
};
