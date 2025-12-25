import axios from 'axios';

const YANDEX_OAUTH_URL = 'https://oauth.yandex.ru';
const YANDEX_API_URL = 'https://api.direct.yandex.com/json/v5';
// API v501 для Мастер Кампаний (UNIFIED_CAMPAIGN)
const YANDEX_API_URL_V501 = 'https://api.direct.yandex.com/json/v501';

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
  Type: 'TEXT_CAMPAIGN' | 'MOBILE_APP_CAMPAIGN' | 'DYNAMIC_TEXT_CAMPAIGN' | 'UNIFIED_CAMPAIGN' | 'SMART_CAMPAIGN';
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
   * Включает TEXT_CAMPAIGN, UNIFIED_CAMPAIGN (Мастер кампании) и другие типы
   * Запрашивает из v5 API и v501 API (для Мастер кампаний)
   */
  async getCampaigns(accessToken: string, login: string): Promise<YandexCampaign[]> {
    const allCampaigns: YandexCampaign[] = [];

    // 1. Запрос к v5 API (TEXT_CAMPAIGN, DYNAMIC_TEXT_CAMPAIGN и др.)
    try {
      const responseV5 = await axios.post(
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

      if (responseV5.data.error) {
        console.error(`[getCampaigns v5] Error: ${responseV5.data.error.error_string}`);
      } else {
        const campaignsV5 = responseV5.data.result?.Campaigns || [];
        console.log(`[getCampaigns v5] Found ${campaignsV5.length} campaigns`);
        allCampaigns.push(...campaignsV5);
      }
    } catch (error: any) {
      console.error('[getCampaigns v5] Request failed:', error.message);
    }

    // 2. Запрос к v501 API (UNIFIED_CAMPAIGN, SMART_CAMPAIGN - Мастер кампании)
    try {
      const responseV501 = await axios.post(
        `${YANDEX_API_URL_V501}/campaigns`,
        {
          method: 'get',
          params: {
            SelectionCriteria: {
              Types: ['UNIFIED_CAMPAIGN', 'SMART_CAMPAIGN'],
            },
            FieldNames: ['Id', 'Name', 'Status', 'State', 'Type'],
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

      if (responseV501.data.error) {
        console.error(`[getCampaigns v501] Error: ${responseV501.data.error.error_string}`, responseV501.data.error);
      } else {
        const campaignsV501 = responseV501.data.result?.Campaigns || [];
        const smartCount = campaignsV501.filter((c: any) => c.Type === 'SMART_CAMPAIGN').length;
        const unifiedCount = campaignsV501.filter((c: any) => c.Type === 'UNIFIED_CAMPAIGN').length;
        console.log(`[getCampaigns v501] Found ${campaignsV501.length} campaigns (UNIFIED: ${unifiedCount}, SMART: ${smartCount})`);
        allCampaigns.push(...campaignsV501);
      }
    } catch (error: any) {
      console.error('[getCampaigns v501] Request failed:', error.response?.data || error.message);
    }

    // Удаляем дубликаты по Id
    const uniqueCampaigns = Array.from(
      new Map(allCampaigns.map(c => [c.Id, c])).values()
    );

    const types = [...new Set(uniqueCampaigns.map((c: any) => c.Type))];
    console.log(`[getCampaigns] Total: ${uniqueCampaigns.length} campaigns, types: ${types.join(', ')}`);

    return uniqueCampaigns;
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
          ReportName: `CampStats_${dateFrom}_${dateTo}_${Date.now()}`,
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
    const maxRetries = 10;
    const retryDelay = 3000;
    const reportName = `CampPerf_${dateFrom}_${dateTo}_${Date.now()}`;

    // Retry loop для offline отчётов
    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
              ReportName: reportName,
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

        if (response.status === 200) {
          console.log(`[getCampaignPerformanceReport] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getCampaignPerformanceReport] Report in queue (status ${response.status}), waiting ${retryIn}s, attempt ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryIn) * 1000 || retryDelay));
          continue;
        }
      } catch (error: any) {
        console.error('[getCampaignPerformanceReport] Yandex API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    }

    if (!response || response.status !== 200) {
      console.error('[getCampaignPerformanceReport] Failed to get report after all retries');
      return [];
    }

    // Parse TSV response
    console.log(`[getCampaignPerformanceReport] Response status: ${response.status}, data length: ${response.data?.length || 0}`);

    const lines = response.data.split('\n').filter((line: string) => line.trim());
    console.log(`[getCampaignPerformanceReport] Parsed ${lines.length} lines`);
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
    const maxRetries = 10;
    const retryDelay = 3000;

    for (const goalId of goalIds) {
      console.log(`[getConversionsReport] Fetching data for goal ${goalId}`);

      try {
        let response;
        const reportName = `Conv_${goalId}_${dateFrom}_${dateTo}_${Date.now()}`;

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
                FieldNames: ['Date', 'CampaignId', 'CampaignName', 'Conversions', 'Revenue'],
                Goals: [goalId],
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
            console.log(`[getConversionsReport] Goal ${goalId} ready on attempt ${attempt + 1}`);
            break;
          }

          if (response.status === 201 || response.status === 202) {
            const retryIn = response.headers['retryin'] || retryDelay / 1000;
            console.log(`[getConversionsReport] Goal ${goalId} in queue (status ${response.status}), waiting ${retryIn}s, attempt ${attempt + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, parseInt(retryIn) * 1000 || retryDelay));
            continue;
          }
        }

        if (!response || response.status !== 200) {
          console.log(`[getConversionsReport] Failed to get report for goal ${goalId} after all retries`);
          continue;
        }

        // Parse TSV response
        console.log(`[getConversionsReport] Goal ${goalId} response length: ${response.data?.length || 0}`);
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
  ): Promise<Map<string, { title: string; title2?: string; text?: string; href?: string }>> {
    const result = new Map<string, { title: string; title2?: string; text?: string; href?: string }>();
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
                text: ad.TextAd.Text || undefined,
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

  /**
   * Получить статистику по устройствам (Desktop/Mobile/Tablet)
   * Использует CUSTOM_REPORT с полем Device
   * При наличии goalIds получает реальные конверсии через отдельный запрос
   */
  async getDeviceStats(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string,
    goalIds?: string[]
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    const reportName = `Device_${dateFrom}_${dateTo}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const maxRetries = 10;
    const retryDelay = 3000;

    let response;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
              FieldNames: [
                'Device',
                'Impressions',
                'Clicks',
                'Cost',
                'Ctr',
                'AvgCpc',
                'BounceRate',
              ],
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
          console.log(`[getDeviceStats] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getDeviceStats] Report in queue (status ${response.status}), waiting ${retryIn}s, attempt ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryIn) * 1000 || retryDelay));
          continue;
        }
      } catch (error: any) {
        console.error('[getDeviceStats] Yandex API Error:', {
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    }

    if (!response || response.status !== 200) {
      console.log('[getDeviceStats] Failed to get report after all retries');
      return [];
    }

    // Parse TSV response
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, index: number) => {
        row[header] = values[index] || null;
      });
      if (row.Device === 'Device') continue;
      row.Conversions = 0; // Будет заполнено из CUSTOM_REPORT с Goals
      results.push(row);
    }

    console.log(`[getDeviceStats] Fetched ${results.length} device rows`);

    // Получаем реальные конверсии через отдельный запрос с Goals
    if (goalIds && goalIds.length > 0 && results.length > 0) {
      const conversionsMap = await this.getDeviceConversions(accessToken, login, campaignIds, goalIds, dateFrom, dateTo);
      results.forEach(row => {
        row.Conversions = conversionsMap.get(row.Device) || 0;
      });
      console.log(`[getDeviceStats] Merged conversions for ${results.length} devices`);
    }

    return results;
  },

  /**
   * Получить конверсии по устройствам через CUSTOM_REPORT с Goals
   */
  async getDeviceConversions(
    accessToken: string,
    login: string,
    campaignIds: number[],
    goalIds: string[],
    dateFrom: string,
    dateTo: string
  ): Promise<Map<string, number>> {
    const conversionsMap = new Map<string, number>();
    if (campaignIds.length === 0 || goalIds.length === 0) return conversionsMap;

    const maxRetries = 10;
    const retryDelay = 3000;

    for (const goalId of goalIds) {
      try {
        const reportName = `DeviceConv_${goalId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        let response;

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
                FieldNames: ['Device', 'Conversions'],
                Goals: [goalId],
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

          if (response.status === 200) break;
          if (response.status === 201 || response.status === 202) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }

        if (!response || response.status !== 200) continue;

        const lines = response.data.split('\n').filter((line: string) => line.trim());
        if (lines.length < 2) continue;

        const headers = lines[0].split('\t');
        const conversionsKey = `Conversions_${goalId}_AUTO`;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          const row: any = {};
          headers.forEach((header: string, index: number) => {
            row[header] = values[index] || null;
          });
          if (row.Device === 'Device') continue;

          const conversions = parseInt(row[conversionsKey]) || 0;
          if (conversions > 0) {
            const existing = conversionsMap.get(row.Device) || 0;
            conversionsMap.set(row.Device, existing + conversions);
          }
        }
      } catch (error: any) {
        console.error(`[getDeviceConversions] Error for goal ${goalId}:`, error.message);
      }
    }

    console.log(`[getDeviceConversions] Got conversions for ${conversionsMap.size} devices`);
    return conversionsMap;
  },

  /**
   * Получить статистику по регионам (LocationOfPresenceId и LocationOfPresenceName)
   * Использует CUSTOM_REPORT с полем LocationOfPresenceName
   * При наличии goalIds получает реальные конверсии через отдельный запрос
   */
  async getGeoStats(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string,
    goalIds?: string[]
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    const reportName = `Geo_${dateFrom}_${dateTo}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const maxRetries = 10;
    const retryDelay = 3000;

    let response;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
              FieldNames: [
                'LocationOfPresenceName',
                'Impressions',
                'Clicks',
                'Cost',
                'Ctr',
                'AvgCpc',
                'BounceRate',
              ],
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
          console.log(`[getGeoStats] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getGeoStats] Report in queue (status ${response.status}), waiting ${retryIn}s, attempt ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryIn) * 1000 || retryDelay));
          continue;
        }
      } catch (error: any) {
        console.error('[getGeoStats] Yandex API Error:', {
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    }

    if (!response || response.status !== 200) {
      console.log('[getGeoStats] Failed to get report after all retries');
      return [];
    }

    // Parse TSV response
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, index: number) => {
        row[header] = values[index] || null;
      });
      if (row.LocationOfPresenceName === 'LocationOfPresenceName') continue;
      row.Conversions = 0; // Будет заполнено из CUSTOM_REPORT с Goals
      results.push(row);
    }

    console.log(`[getGeoStats] Fetched ${results.length} geo rows`);

    // Получаем реальные конверсии через отдельный запрос с Goals
    if (goalIds && goalIds.length > 0 && results.length > 0) {
      const conversionsMap = await this.getGeoConversions(accessToken, login, campaignIds, goalIds, dateFrom, dateTo);
      results.forEach(row => {
        row.Conversions = conversionsMap.get(row.LocationOfPresenceName) || 0;
      });
      console.log(`[getGeoStats] Merged conversions for ${results.length} geo locations`);
    }

    return results;
  },

  /**
   * Получить конверсии по регионам через CUSTOM_REPORT с Goals
   */
  async getGeoConversions(
    accessToken: string,
    login: string,
    campaignIds: number[],
    goalIds: string[],
    dateFrom: string,
    dateTo: string
  ): Promise<Map<string, number>> {
    const conversionsMap = new Map<string, number>();
    if (campaignIds.length === 0 || goalIds.length === 0) return conversionsMap;

    const maxRetries = 10;
    const retryDelay = 3000;

    for (const goalId of goalIds) {
      try {
        const reportName = `GeoConv_${goalId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        let response;

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
                FieldNames: ['LocationOfPresenceName', 'Conversions'],
                Goals: [goalId],
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

          if (response.status === 200) break;
          if (response.status === 201 || response.status === 202) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }

        if (!response || response.status !== 200) continue;

        const lines = response.data.split('\n').filter((line: string) => line.trim());
        if (lines.length < 2) continue;

        const headers = lines[0].split('\t');
        const conversionsKey = `Conversions_${goalId}_AUTO`;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          const row: any = {};
          headers.forEach((header: string, index: number) => {
            row[header] = values[index] || null;
          });
          if (row.LocationOfPresenceName === 'LocationOfPresenceName') continue;

          const conversions = parseInt(row[conversionsKey]) || 0;
          if (conversions > 0) {
            const existing = conversionsMap.get(row.LocationOfPresenceName) || 0;
            conversionsMap.set(row.LocationOfPresenceName, existing + conversions);
          }
        }
      } catch (error: any) {
        console.error(`[getGeoConversions] Error for goal ${goalId}:`, error.message);
      }
    }

    console.log(`[getGeoConversions] Got conversions for ${conversionsMap.size} geo locations`);
    return conversionsMap;
  },

  /**
   * Получить баланс аккаунта
   * Пробуем несколько методов по порядку:
   * 1. API v5 Clients.get (для прямых рекламодателей)
   * 2. API v4 Live AccountManagement (для агентских аккаунтов)
   * 3. Суммируем балансы кампаний (fallback)
   */
  async getAccountBalance(
    accessToken: string,
    login: string
  ): Promise<{
    amount: number;
    currency: string;
    amountAvailableForTransfer: number;
    source: 'clients_api' | 'shared_account' | 'campaigns_sum';
  } | null> {
    console.log(`[getAccountBalance] Starting for login: ${login}`);

    const YANDEX_API_V4_LIVE_URL = 'https://api.direct.yandex.ru/live/v4/json/';

    // 1. Пробуем API v4 Live GetClientInfo - работает для получения баланса общего счёта
    let sharedAccountEnabled = false;
    let clientCurrency = 'RUB';

    try {
      const clientInfoResponse = await axios.post(
        YANDEX_API_V4_LIVE_URL,
        {
          method: 'GetClientInfo',
          token: accessToken,
          param: [login],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept-Language': 'ru',
          },
        }
      );

      console.log('[getAccountBalance] GetClientInfo response:', JSON.stringify(clientInfoResponse.data, null, 2));

      const clientData = clientInfoResponse.data.data;
      if (clientData && clientData.length > 0) {
        const client = clientData[0];
        clientCurrency = client.Currency || 'RUB';
        sharedAccountEnabled = client.SharedAccountEnabled === 'Yes';

        // SharedAccountEnabled - включён ли общий счёт
        // AccountAmount - баланс общего счёта (если включён)
        if (sharedAccountEnabled && client.AccountAmount !== undefined && client.AccountAmount !== null) {
          console.log('[getAccountBalance] Got shared account balance via GetClientInfo:', client.AccountAmount);
          return {
            amount: client.AccountAmount,
            currency: clientCurrency,
            amountAvailableForTransfer: 0,
            source: 'shared_account',
          };
        }

        // Если SharedAccount включён но AccountAmount нет - запомним и продолжим
        if (sharedAccountEnabled) {
          console.log('[getAccountBalance] SharedAccount enabled but AccountAmount not available, trying other methods...');
        }
      }
    } catch (error: any) {
      console.log('[getAccountBalance] GetClientInfo not available:', error.response?.data || error.message);
    }

    // 2. Пробуем AccountManagement для прямого рекламодателя (без SelectionCriteria)
    try {
      const response = await axios.post(
        YANDEX_API_V4_LIVE_URL,
        {
          method: 'AccountManagement',
          token: accessToken,
          param: {
            Action: 'Get',
            // Для прямого рекламодателя SelectionCriteria опциональный - не передаём его
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept-Language': 'ru',
          },
        }
      );

      console.log('[getAccountBalance] AccountManagement response:', JSON.stringify(response.data, null, 2));

      // Ответ может быть в data.Accounts или напрямую в data
      const accounts = response.data.data?.Accounts || (response.data.data ? [response.data.data] : null);
      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        console.log('[getAccountBalance] Got shared account balance:', account.Amount);
        return {
          amount: account.Amount || 0,
          currency: account.Currency || 'RUB',
          amountAvailableForTransfer: account.AmountAvailableForTransfer || 0,
          source: 'shared_account',
        };
      }
    } catch (error: any) {
      console.log('[getAccountBalance] AccountManagement not available:', error.response?.data || error.message);
    }

    // 2.1 Пробуем AccountManagement с логином (для агентов)
    try {
      const response = await axios.post(
        YANDEX_API_V4_LIVE_URL,
        {
          method: 'AccountManagement',
          token: accessToken,
          param: {
            Action: 'Get',
            SelectionCriteria: {
              Logins: [login],
            },
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept-Language': 'ru',
          },
        }
      );

      console.log('[getAccountBalance] AccountManagement (agency) response:', JSON.stringify(response.data, null, 2));

      const accounts = response.data.data?.Accounts;
      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        console.log('[getAccountBalance] Got shared account balance via agency:', account.Amount);
        return {
          amount: account.Amount || 0,
          currency: account.Currency || 'RUB',
          amountAvailableForTransfer: account.AmountAvailableForTransfer || 0,
          source: 'shared_account',
        };
      }
    } catch (error: any) {
      console.log('[getAccountBalance] AccountManagement (agency) not available:', error.response?.data || error.message);
    }

    // 3. Пробуем API v5 Clients.get
    try {
      const clientsResponse = await axios.post(
        `${YANDEX_API_URL}/clients`,
        {
          method: 'get',
          params: {
            FieldNames: ['ClientId', 'Login', 'Currency', 'Bonuses', 'OverdraftSumAvailable'],
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

      console.log('[getAccountBalance] Clients API response:', JSON.stringify(clientsResponse.data, null, 2));

      const clients = clientsResponse.data.result?.Clients;
      if (clients && clients.length > 0) {
        const client = clients[0];
        const currency = client.Currency || 'RUB';

        const overdraft = (client.OverdraftSumAvailable || 0) / 1000000;
        const bonuses = (client.Bonuses?.AwaitingBonus || 0) / 1000000;

        console.log('[getAccountBalance] Clients API - overdraft:', overdraft, 'bonuses:', bonuses, 'currency:', currency);

        if (overdraft > 0 || bonuses > 0) {
          return {
            amount: overdraft + bonuses,
            currency,
            amountAvailableForTransfer: overdraft,
            source: 'clients_api',
          };
        }
      }
    } catch (error: any) {
      console.log('[getAccountBalance] Clients API not available:', error.response?.data || error.message);
    }

    console.log('[getAccountBalance] Trying campaigns fallback...');

    // 4. Fallback - получаем балансы через кампании API v5
    try {
      const response = await axios.post(
        `${YANDEX_API_URL}/campaigns`,
        {
          method: 'get',
          params: {
            SelectionCriteria: {
              States: ['ON', 'OFF', 'SUSPENDED'],
            },
            FieldNames: ['Id', 'Name', 'State', 'Funds', 'Currency', 'DailyBudget'],
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-Login': login,
            'Accept-Language': 'ru',
            'returnMoneyInMicros': 'false',
          },
        }
      );

      if (response.data.error) {
        console.error('[getAccountBalance] Campaigns API Error:', response.data.error);
        return null;
      }

      const campaigns = response.data.result?.Campaigns || [];
      if (campaigns.length === 0) {
        console.log('[getAccountBalance] No campaigns found');
        return null;
      }

      let totalBalance = 0;
      let totalAvailable = 0;
      let totalDailyBudget = 0;
      let currency = 'RUB';
      let hasSharedAccount = false;
      let sharedAccountSpend = 0;
      let activeCampaignsCount = 0;

      for (const campaign of campaigns) {
        if (campaign.Currency) {
          currency = campaign.Currency;
        }

        // Считаем дневной бюджет активных кампаний
        if (campaign.State === 'ON' && campaign.DailyBudget?.Amount) {
          totalDailyBudget += campaign.DailyBudget.Amount;
          activeCampaignsCount++;
        }

        // SharedAccountFunds - когда включён общий счёт
        const sharedFunds = campaign.Funds?.SharedAccountFunds;
        if (sharedFunds) {
          hasSharedAccount = true;
          // Spend - потрачено с общего счёта
          sharedAccountSpend += sharedFunds.Spend || 0;
          continue;
        }

        // CampaignFunds - когда нет общего счёта (индивидуальные бюджеты кампаний)
        const campaignFunds = campaign.Funds?.CampaignFunds;
        if (campaignFunds) {
          // При returnMoneyInMicros=false значения уже в рублях
          totalBalance += campaignFunds.Balance || 0;
          totalAvailable += campaignFunds.SumAvailableForTransfer || 0;
        }
      }

      // Если общий счёт - пробуем GetBalance API v4 Live для получения реального баланса
      if (hasSharedAccount) {
        console.log(`[getAccountBalance] Shared account detected, spend=${sharedAccountSpend}, trying GetBalance...`);

        // Берём ID первой кампании для GetBalance
        const campaignIds = campaigns.map((c: any) => c.Id).slice(0, 10);

        try {
          const balanceResponse = await axios.post(
            YANDEX_API_V4_LIVE_URL,
            {
              method: 'GetBalance',
              token: accessToken,
              param: campaignIds,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Accept-Language': 'ru',
              },
            }
          );

          console.log('[getAccountBalance] GetBalance response:', JSON.stringify(balanceResponse.data, null, 2));

          // GetBalance возвращает массив с Rest (баланс общего счёта) для каждой кампании
          const balanceData = balanceResponse.data.data;
          if (balanceData && balanceData.length > 0) {
            // При общем счёте Rest одинаков для всех кампаний
            const rest = balanceData[0].Rest;
            if (rest !== undefined && rest !== null) {
              console.log('[getAccountBalance] Got shared account balance via GetBalance:', rest);
              return {
                amount: rest,
                currency,
                amountAvailableForTransfer: 0,
                source: 'shared_account',
              };
            }
          }
        } catch (balanceError: any) {
          console.log('[getAccountBalance] GetBalance not available:', balanceError.response?.data || balanceError.message);
        }

        // Fallback - возвращаем сумму дневных бюджетов
        console.log(`[getAccountBalance] GetBalance failed, using dailyBudget=${totalDailyBudget}, activeCampaigns=${activeCampaignsCount}`);
        return {
          amount: totalDailyBudget,
          currency,
          amountAvailableForTransfer: 0,
          source: 'campaigns_sum',
        };
      }

      console.log(`[getAccountBalance] Sum of ${campaigns.length} campaigns: ${totalBalance} ${currency}`);

      return {
        amount: totalBalance,
        currency,
        amountAvailableForTransfer: totalAvailable,
        source: 'campaigns_sum',
      };
    } catch (error: any) {
      console.error('[getAccountBalance] Error getting campaigns:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      return null;
    }
  },

  /**
   * Получить отчёт по поисковым запросам (SEARCH_QUERY_PERFORMANCE_REPORT)
   * При наличии goalIds получает реальные конверсии через отдельный запрос
   */
  async getSearchQueryReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string,
    goalIds?: string[]
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    const fields = [
      'Query',
      'CampaignId',
      'AdGroupId',
      'Clicks',
      'Cost',
      'Impressions',
      'Ctr',
      'AvgCpc',
    ];

    let response;
    const maxRetries = 10;
    const retryDelay = 3000;
    const reportName = `SearchQuery_${dateFrom}_${dateTo}_${Date.now()}`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
              ReportName: reportName,
              ReportType: 'SEARCH_QUERY_PERFORMANCE_REPORT',
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
          console.log(`[getSearchQueryReport] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getSearchQueryReport] Report pending, retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        }
      } catch (error: any) {
        if (error.response?.status === 201 || error.response?.status === 202) {
          const retryIn = error.response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getSearchQueryReport] Report pending (catch), retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        } else {
          console.error('[getSearchQueryReport] Error:', error.response?.data || error.message);
          return [];
        }
      }
    }

    if (!response || response.status !== 200) {
      console.error('[getSearchQueryReport] Failed to get report after retries');
      return [];
    }

    // Парсим TSV данные
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, idx: number) => {
        row[header] = values[idx];
      });
      results.push({
        query: row['Query'] || '',
        campaignId: row['CampaignId'],
        adGroupId: row['AdGroupId'],
        clicks: parseInt(row['Clicks'] || '0'),
        cost: parseFloat(row['Cost'] || '0'),
        impressions: parseInt(row['Impressions'] || '0'),
        ctr: parseFloat(row['Ctr'] || '0'),
        avgCpc: parseFloat(row['AvgCpc'] || '0'),
      });
    }

    // Группируем по запросу и суммируем
    const queryMap = new Map<string, any>();
    results.forEach(row => {
      const existing = queryMap.get(row.query);
      if (existing) {
        existing.clicks += row.clicks;
        existing.cost += row.cost;
        existing.impressions += row.impressions;
      } else {
        queryMap.set(row.query, { ...row, conversions: 0 });
      }
    });

    const finalResults = Array.from(queryMap.values())
      .sort((a, b) => b.cost - a.cost);

    // Получаем реальные конверсии через отдельный запрос с Goals
    if (goalIds && goalIds.length > 0 && finalResults.length > 0) {
      const conversionsMap = await this.getSearchQueryConversions(accessToken, login, campaignIds, goalIds, dateFrom, dateTo);
      finalResults.forEach(row => {
        row.conversions = conversionsMap.get(row.query) || 0;
      });
      console.log(`[getSearchQueryReport] Merged conversions for ${finalResults.length} queries`);
    }

    return finalResults;
  },

  /**
   * Получить конверсии по поисковым запросам через CUSTOM_REPORT с Goals
   * Примечание: SEARCH_QUERY_PERFORMANCE_REPORT не поддерживает Goals напрямую,
   * поэтому используем CUSTOM_REPORT с Query полем
   */
  async getSearchQueryConversions(
    accessToken: string,
    login: string,
    campaignIds: number[],
    goalIds: string[],
    dateFrom: string,
    dateTo: string
  ): Promise<Map<string, number>> {
    const conversionsMap = new Map<string, number>();
    if (campaignIds.length === 0 || goalIds.length === 0) return conversionsMap;

    const maxRetries = 10;
    const retryDelay = 3000;

    // Получаем конверсии по AdGroupId, так как Query не доступен в CUSTOM_REPORT
    // Затем сопоставляем через AdGroupId
    for (const goalId of goalIds) {
      try {
        const reportName = `QueryConv_${goalId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        let response;

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
                FieldNames: ['AdGroupId', 'Conversions'],
                Goals: [goalId],
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

          if (response.status === 200) break;
          if (response.status === 201 || response.status === 202) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }

        if (!response || response.status !== 200) continue;

        const lines = response.data.split('\n').filter((line: string) => line.trim());
        if (lines.length < 2) continue;

        const headers = lines[0].split('\t');
        const conversionsKey = `Conversions_${goalId}_AUTO`;

        // Создаём мапу AdGroupId -> conversions для последующего сопоставления
        const adGroupConversions = new Map<string, number>();
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          const row: any = {};
          headers.forEach((header: string, index: number) => {
            row[header] = values[index] || null;
          });

          const conversions = parseInt(row[conversionsKey]) || 0;
          if (conversions > 0 && row.AdGroupId) {
            const existing = adGroupConversions.get(row.AdGroupId) || 0;
            adGroupConversions.set(row.AdGroupId, existing + conversions);
          }
        }

        // Примечание: мы не можем напрямую сопоставить конверсии с запросами,
        // т.к. Query не доступен в CUSTOM_REPORT с Goals.
        // Оставляем conversionsMap пустой - для поисковых запросов конверсии
        // будут отображаться только если есть данные в ClickHouse
        console.log(`[getSearchQueryConversions] Got ${adGroupConversions.size} ad groups with conversions for goal ${goalId}`);
      } catch (error: any) {
        console.error(`[getSearchQueryConversions] Error for goal ${goalId}:`, error.message);
      }
    }

    console.log(`[getSearchQueryConversions] Note: Query-level conversions not available via API`);
    return conversionsMap;
  },

  /**
   * Получить отчёт по демографии (пол/возраст) через CUSTOM_REPORT
   * При наличии goalIds получает реальные конверсии через отдельный запрос
   */
  async getDemographicsReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string,
    goalIds?: string[]
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    const fields = [
      'Gender',
      'Age',
      'CampaignId',
      'Clicks',
      'Cost',
      'Impressions',
    ];

    let response;
    const maxRetries = 10;
    const retryDelay = 3000;
    const reportName = `Demographics_${dateFrom}_${dateTo}_${Date.now()}`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
          console.log(`[getDemographicsReport] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getDemographicsReport] Report pending, retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        }
      } catch (error: any) {
        if (error.response?.status === 201 || error.response?.status === 202) {
          const retryIn = error.response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getDemographicsReport] Report pending (catch), retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        } else {
          console.error('[getDemographicsReport] Error:', error.response?.data || error.message);
          return [];
        }
      }
    }

    if (!response || response.status !== 200) {
      console.error('[getDemographicsReport] Failed to get report after retries');
      return [];
    }

    // Парсим TSV
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const results: any[] = [];

    // Маппинг значений Gender и Age на русский
    const genderMap: Record<string, string> = {
      'GENDER_MALE': 'Мужчины',
      'GENDER_FEMALE': 'Женщины',
      'UNKNOWN': 'Неизвестно',
    };

    const ageMap: Record<string, string> = {
      'AGE_0_17': '0-17',
      'AGE_18_24': '18-24',
      'AGE_25_34': '25-34',
      'AGE_35_44': '35-44',
      'AGE_45_54': '45-54',
      'AGE_45': '45+',
      'AGE_55': '55+',
      'UNKNOWN': 'Неизвестно',
    };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, idx: number) => {
        row[header] = values[idx];
      });

      const gender = genderMap[row['Gender']] || row['Gender'] || 'Неизвестно';
      const age = ageMap[row['Age']] || row['Age'] || 'Неизвестно';

      results.push({
        segment: `${gender} ${age}`,
        gender: gender,
        age: age,
        clicks: parseInt(row['Clicks'] || '0'),
        cost: parseFloat(row['Cost'] || '0'),
        impressions: parseInt(row['Impressions'] || '0'),
      });
    }

    // Группируем по сегменту
    const segmentMap = new Map<string, any>();
    results.forEach(row => {
      const existing = segmentMap.get(row.segment);
      if (existing) {
        existing.clicks += row.clicks;
        existing.cost += row.cost;
        existing.impressions += row.impressions;
      } else {
        segmentMap.set(row.segment, { ...row, conversions: 0 });
      }
    });

    const finalResults = Array.from(segmentMap.values())
      .filter(r => r.segment !== 'Неизвестно Неизвестно')
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 20);

    // Получаем реальные конверсии через отдельный запрос с Goals
    if (goalIds && goalIds.length > 0 && finalResults.length > 0) {
      const conversionsMap = await this.getDemographicsConversions(accessToken, login, campaignIds, goalIds, dateFrom, dateTo);
      finalResults.forEach(row => {
        row.conversions = conversionsMap.get(row.segment) || 0;
      });
      console.log(`[getDemographicsReport] Merged conversions for ${finalResults.length} segments`);
    }

    return finalResults;
  },

  /**
   * Получить конверсии по демографии через CUSTOM_REPORT с Goals
   */
  async getDemographicsConversions(
    accessToken: string,
    login: string,
    campaignIds: number[],
    goalIds: string[],
    dateFrom: string,
    dateTo: string
  ): Promise<Map<string, number>> {
    const conversionsMap = new Map<string, number>();
    if (campaignIds.length === 0 || goalIds.length === 0) return conversionsMap;

    const genderMap: Record<string, string> = {
      'GENDER_MALE': 'Мужчины',
      'GENDER_FEMALE': 'Женщины',
      'UNKNOWN': 'Неизвестно',
    };

    const ageMap: Record<string, string> = {
      'AGE_0_17': '0-17',
      'AGE_18_24': '18-24',
      'AGE_25_34': '25-34',
      'AGE_35_44': '35-44',
      'AGE_45_54': '45-54',
      'AGE_45': '45+',
      'AGE_55': '55+',
      'UNKNOWN': 'Неизвестно',
    };

    const maxRetries = 10;
    const retryDelay = 3000;

    for (const goalId of goalIds) {
      try {
        const reportName = `DemoConv_${goalId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        let response;

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
                FieldNames: ['Gender', 'Age', 'Conversions'],
                Goals: [goalId],
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

          if (response.status === 200) break;
          if (response.status === 201 || response.status === 202) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }

        if (!response || response.status !== 200) continue;

        const lines = response.data.split('\n').filter((line: string) => line.trim());
        if (lines.length < 2) continue;

        const headers = lines[0].split('\t');
        const conversionsKey = `Conversions_${goalId}_AUTO`;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          const row: any = {};
          headers.forEach((header: string, index: number) => {
            row[header] = values[index] || null;
          });

          const gender = genderMap[row['Gender']] || row['Gender'] || 'Неизвестно';
          const age = ageMap[row['Age']] || row['Age'] || 'Неизвестно';
          const segment = `${gender} ${age}`;

          const conversions = parseInt(row[conversionsKey]) || 0;
          if (conversions > 0) {
            const existing = conversionsMap.get(segment) || 0;
            conversionsMap.set(segment, existing + conversions);
          }
        }
      } catch (error: any) {
        console.error(`[getDemographicsConversions] Error for goal ${goalId}:`, error.message);
      }
    }

    console.log(`[getDemographicsConversions] Got conversions for ${conversionsMap.size} segments`);
    return conversionsMap;
  },

  /**
   * Получить отчёт по регионам через CUSTOM_REPORT
   */
  async getGeoReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    const fields = [
      'TargetingLocationName',
      'CampaignId',
      'Clicks',
      'Cost',
      'Impressions',
    ];

    let response;
    const maxRetries = 10;
    const retryDelay = 3000;
    const reportName = `Geo_${dateFrom}_${dateTo}_${Date.now()}`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
          console.log(`[getGeoReport] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getGeoReport] Report pending, retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        }
      } catch (error: any) {
        if (error.response?.status === 201 || error.response?.status === 202) {
          const retryIn = error.response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getGeoReport] Report pending (catch), retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        } else {
          console.error('[getGeoReport] Error:', error.response?.data || error.message);
          return [];
        }
      }
    }

    if (!response || response.status !== 200) {
      console.error('[getGeoReport] Failed to get report after retries');
      return [];
    }

    // Парсим TSV
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, idx: number) => {
        row[header] = values[idx];
      });

      results.push({
        region: row['TargetingLocationName'] || 'Неизвестно',
        clicks: parseInt(row['Clicks'] || '0'),
        cost: parseFloat(row['Cost'] || '0'),
        impressions: parseInt(row['Impressions'] || '0'),
      });
    }

    // Группируем по региону
    const regionMap = new Map<string, any>();
    results.forEach(row => {
      const existing = regionMap.get(row.region);
      if (existing) {
        existing.clicks += row.clicks;
        existing.cost += row.cost;
        existing.impressions += row.impressions;
      } else {
        regionMap.set(row.region, { ...row });
      }
    });

    return Array.from(regionMap.values())
      .filter(r => r.region !== 'Неизвестно')
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 20);
  },

  /**
   * Получить статистику по площадкам (Placement)
   */
  async getPlacementsReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string
  ): Promise<any[]> {
    const reportName = `placements_report_${Date.now()}`;

    const requestBody = {
      params: {
        SelectionCriteria: {
          Filter: [
            {
              Field: 'CampaignId',
              Operator: 'IN',
              Values: campaignIds.map(String),
            },
          ],
          DateFrom: dateFrom,
          DateTo: dateTo,
        },
        FieldNames: ['Placement', 'Clicks', 'Cost', 'Impressions', 'Ctr', 'AvgCpc'],
        ReportName: reportName,
        ReportType: 'CUSTOM_REPORT',
        DateRangeType: 'CUSTOM_DATE',
        Format: 'TSV',
        IncludeVAT: 'YES',
        IncludeDiscount: 'NO',
      },
    };

    // Пробуем до 10 раз с паузами
    let response: any = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        response = await axios.post(
          'https://api.direct.yandex.com/json/v5/reports',
          requestBody,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Client-Login': login,
              'Accept-Language': 'ru',
              processingMode: 'auto',
              returnMoneyInMicros: 'false',
              skipReportHeader: 'true',
              skipReportSummary: 'true',
            },
            validateStatus: (status) => status < 500,
          }
        );

        if (response.status === 200) {
          console.log(`[getPlacementsReport] Report ready on attempt ${attempt + 1}`);
          break;
        } else if (response.status === 201 || response.status === 202) {
          const retryIn = parseInt(response.headers['retryIn'] || '10');
          console.log(`[getPlacementsReport] Report pending, retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, retryIn * 1000));
        }
      } catch (error: any) {
        if (error.response?.status === 201 || error.response?.status === 202) {
          const retryIn = parseInt(error.response.headers['retryIn'] || '10');
          console.log(`[getPlacementsReport] Report pending (catch), retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, retryIn * 1000));
        } else {
          console.error('[getPlacementsReport] Error:', error.response?.data || error.message);
          return [];
        }
      }
    }

    if (!response || response.status !== 200) {
      console.error('[getPlacementsReport] Failed to get report after retries');
      return [];
    }

    // Парсим TSV
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, idx: number) => {
        row[header] = values[idx];
      });

      results.push({
        placement: row['Placement'] || 'Неизвестно',
        clicks: parseInt(row['Clicks'] || '0'),
        cost: parseFloat(row['Cost'] || '0'),
        impressions: parseInt(row['Impressions'] || '0'),
        ctr: parseFloat(row['Ctr'] || '0'),
        avgCpc: parseFloat(row['AvgCpc'] || '0'),
      });
    }

    // Группируем по площадке
    const placementMap = new Map<string, any>();
    results.forEach(row => {
      const existing = placementMap.get(row.placement);
      if (existing) {
        existing.clicks += row.clicks;
        existing.cost += row.cost;
        existing.impressions += row.impressions;
      } else {
        placementMap.set(row.placement, { ...row });
      }
    });

    // Функция для определения типа площадки по имени
    const getPlacementType = (placement: string): string => {
      if (!placement) return 'Другое';
      const p = placement.toLowerCase();

      // Поиск Яндекс
      if (p.includes('yandex') || p.includes('яндекс')) {
        if (p.includes('search') || p.includes('поиск')) return 'Поиск';
        if (p.includes('maps') || p.includes('карт')) return 'Карты';
        if (p.includes('video') || p.includes('видео')) return 'Видео';
        if (p.includes('zen') || p.includes('дзен')) return 'Дзен';
        return 'РСЯ';
      }

      // Мобильные приложения
      if (p.includes('.app') || p.includes('android') || p.includes('ios') || p.includes('mobile')) return 'Приложения';

      // Социальные сети
      if (p.includes('vk.com') || p.includes('ok.ru') || p.includes('mail.ru')) return 'Соцсети';

      // Видео площадки
      if (p.includes('youtube') || p.includes('rutube') || p.includes('video')) return 'Видео';

      // Новостные сайты
      if (p.includes('news') || p.includes('новости') || p.includes('lenta') || p.includes('rbc') || p.includes('ria')) return 'Новости';

      // Обычные сайты РСЯ
      return 'РСЯ';
    };

    // Пересчитываем CTR и AvgCpc после агрегации, добавляем тип
    // Примечание: Yandex API не поддерживает конверсии с разбивкой по площадкам
    const aggregated = Array.from(placementMap.values()).map(p => ({
      ...p,
      ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
      avgCpc: p.clicks > 0 ? p.cost / p.clicks : 0,
      placementType: getPlacementType(p.placement),
      conversions: 0, // Yandex API не поддерживает конверсии по площадкам
    }));

    return aggregated
      .filter(p => p.placement !== 'Неизвестно' && p.placement !== '--')
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 30);
  },

  /**
   * Получить отчёт по платёжеспособности (IncomeGrade)
   * Значения: VERY_HIGH, HIGH, ABOVE_AVERAGE, OTHER
   */
  async getIncomeReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    const reportName = `income_report_${Date.now()}`;
    const maxRetries = 10;
    const retryDelay = 3000;

    let response: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
              FieldNames: ['IncomeGrade', 'Clicks', 'Cost', 'Impressions', 'Ctr', 'AvgCpc'],
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
          console.log(`[getIncomeReport] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getIncomeReport] Report pending, retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        }
      } catch (error: any) {
        if (error.response?.status === 201 || error.response?.status === 202) {
          const retryIn = error.response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getIncomeReport] Report pending (catch), retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        } else {
          console.error('[getIncomeReport] Error:', error.response?.data || error.message);
          return [];
        }
      }
    }

    if (!response || response.status !== 200) {
      console.error('[getIncomeReport] Failed to get report after retries');
      return [];
    }

    // Парсим TSV
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const results: any[] = [];

    // Маппинг значений на русский
    const incomeMap: Record<string, string> = {
      'VERY_HIGH': 'Очень высокий',
      'HIGH': 'Высокий',
      'ABOVE_AVERAGE': 'Выше среднего',
      'OTHER': 'Прочий',
      'UNKNOWN': 'Неизвестно',
    };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, idx: number) => {
        row[header] = values[idx];
      });

      const incomeGrade = row['IncomeGrade'] || 'UNKNOWN';
      results.push({
        incomeGrade: incomeMap[incomeGrade] || incomeGrade,
        incomeGradeRaw: incomeGrade,
        clicks: parseInt(row['Clicks'] || '0'),
        cost: parseFloat(row['Cost'] || '0'),
        impressions: parseInt(row['Impressions'] || '0'),
        ctr: parseFloat(row['Ctr'] || '0'),
        avgCpc: parseFloat(row['AvgCpc'] || '0'),
      });
    }

    // Группируем по incomeGrade
    const incomeGradeMap = new Map<string, any>();
    results.forEach(row => {
      const existing = incomeGradeMap.get(row.incomeGrade);
      if (existing) {
        existing.clicks += row.clicks;
        existing.cost += row.cost;
        existing.impressions += row.impressions;
      } else {
        incomeGradeMap.set(row.incomeGrade, { ...row });
      }
    });

    // Пересчитываем CTR и AvgCpc после агрегации
    // Примечание: Yandex API не поддерживает конверсии с разбивкой по уровню дохода
    const aggregated = Array.from(incomeGradeMap.values()).map(p => ({
      ...p,
      ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
      avgCpc: p.clicks > 0 ? p.cost / p.clicks : 0,
      conversions: 0, // Yandex API не поддерживает конверсии по уровню дохода
    }));

    return aggregated
      .filter(p => p.incomeGrade !== 'Неизвестно')
      .sort((a, b) => b.cost - a.cost);
  },

  /**
   * Получить отчёт по категориям таргетинга (TargetingCategory)
   * Значения: EXACT, ALTERNATIVE, COMPETITOR, BROADER, ACCESSORY
   */
  async getTargetingCategoryReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    const reportName = `targeting_category_report_${Date.now()}`;
    const maxRetries = 10;
    const retryDelay = 3000;

    let response: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
              FieldNames: ['TargetingCategory', 'Clicks', 'Cost', 'Impressions', 'Ctr', 'AvgCpc'],
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
          console.log(`[getTargetingCategoryReport] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getTargetingCategoryReport] Report pending, retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        }
      } catch (error: any) {
        if (error.response?.status === 201 || error.response?.status === 202) {
          const retryIn = error.response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getTargetingCategoryReport] Report pending (catch), retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        } else {
          console.error('[getTargetingCategoryReport] Error:', error.response?.data || error.message);
          return [];
        }
      }
    }

    if (!response || response.status !== 200) {
      console.error('[getTargetingCategoryReport] Failed to get report after retries');
      return [];
    }

    // Парсим TSV
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const results: any[] = [];

    // Маппинг значений на русский
    const categoryMap: Record<string, string> = {
      'EXACT': 'Точное соответствие',
      'ALTERNATIVE': 'Альтернатива',
      'COMPETITOR': 'Конкурент',
      'BROADER': 'Более широкое',
      'ACCESSORY': 'Сопутствующее',
      'UNKNOWN': 'Неизвестно',
    };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, idx: number) => {
        row[header] = values[idx];
      });

      const category = row['TargetingCategory'] || 'UNKNOWN';
      results.push({
        category: categoryMap[category] || category,
        categoryRaw: category,
        clicks: parseInt(row['Clicks'] || '0'),
        cost: parseFloat(row['Cost'] || '0'),
        impressions: parseInt(row['Impressions'] || '0'),
        ctr: parseFloat(row['Ctr'] || '0'),
        avgCpc: parseFloat(row['AvgCpc'] || '0'),
      });
    }

    // Группируем по category
    const categoryMapAgg = new Map<string, any>();
    results.forEach(row => {
      const existing = categoryMapAgg.get(row.category);
      if (existing) {
        existing.clicks += row.clicks;
        existing.cost += row.cost;
        existing.impressions += row.impressions;
      } else {
        categoryMapAgg.set(row.category, { ...row });
      }
    });

    // Пересчитываем CTR и AvgCpc после агрегации
    // Примечание: Yandex API не поддерживает конверсии с разбивкой по категориям таргетинга
    const aggregated = Array.from(categoryMapAgg.values()).map(p => ({
      ...p,
      ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
      avgCpc: p.clicks > 0 ? p.cost / p.clicks : 0,
      conversions: 0, // Yandex API не поддерживает конверсии по категориям таргетинга
    }));

    return aggregated
      .filter(p => p.category !== 'Неизвестно')
      .sort((a, b) => b.cost - a.cost);
  },

  /**
   * Получить отчёт по условиям показа (ключевым словам/Criterion)
   */
  async getCriteriaReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    const reportName = `criteria_report_${Date.now()}`;
    const maxRetries = 10;
    const retryDelay = 3000;

    let response: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
              FieldNames: ['Criterion', 'CriterionType', 'Clicks', 'Cost', 'Impressions', 'Ctr', 'AvgCpc'],
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
          console.log(`[getCriteriaReport] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getCriteriaReport] Report pending, retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        }
      } catch (error: any) {
        if (error.response?.status === 201 || error.response?.status === 202) {
          const retryIn = error.response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getCriteriaReport] Report pending (catch), retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        } else {
          console.error('[getCriteriaReport] Error:', error.response?.data || error.message);
          return [];
        }
      }
    }

    if (!response || response.status !== 200) {
      console.error('[getCriteriaReport] Failed to get report after retries');
      return [];
    }

    // Парсим TSV
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, idx: number) => {
        row[header] = values[idx];
      });

      results.push({
        criterion: row['Criterion'] || '',
        criterionType: row['CriterionType'] || '',
        clicks: parseInt(row['Clicks'] || '0'),
        cost: parseFloat(row['Cost'] || '0'),
        impressions: parseInt(row['Impressions'] || '0'),
        ctr: parseFloat(row['Ctr'] || '0'),
        avgCpc: parseFloat(row['AvgCpc'] || '0'),
      });
    }

    // Группируем по criterion
    const criterionMap = new Map<string, any>();
    results.forEach(row => {
      if (!row.criterion || row.criterion === '--') return;
      const existing = criterionMap.get(row.criterion);
      if (existing) {
        existing.clicks += row.clicks;
        existing.cost += row.cost;
        existing.impressions += row.impressions;
      } else {
        criterionMap.set(row.criterion, { ...row });
      }
    });

    // Пересчитываем CTR и AvgCpc после агрегации
    // Примечание: Yandex API не поддерживает конверсии с разбивкой по условиям показа
    const aggregated = Array.from(criterionMap.values()).map(p => ({
      ...p,
      ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
      avgCpc: p.clicks > 0 ? p.cost / p.clicks : 0,
      conversions: 0, // Yandex API не поддерживает конверсии по условиям показа
    }));

    return aggregated
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 50);
  },

  /**
   * Получить отчёт по текстам объявлений (AdTitle + AdText)
   */
  async getAdTextReport(
    accessToken: string,
    login: string,
    campaignIds: number[],
    dateFrom: string,
    dateTo: string
  ): Promise<any[]> {
    if (campaignIds.length === 0) return [];

    const reportName = `adtext_report_${Date.now()}`;
    const maxRetries = 10;
    const retryDelay = 3000;

    let response: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
              FieldNames: ['AdId', 'Clicks', 'Cost', 'Impressions', 'Ctr', 'AvgCpc'],
              ReportName: reportName,
              ReportType: 'AD_PERFORMANCE_REPORT',
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
          console.log(`[getAdTextReport] Report ready on attempt ${attempt + 1}`);
          break;
        }

        if (response.status === 201 || response.status === 202) {
          const retryIn = response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getAdTextReport] Report pending, retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        }
      } catch (error: any) {
        if (error.response?.status === 201 || error.response?.status === 202) {
          const retryIn = error.response.headers['retryin'] || retryDelay / 1000;
          console.log(`[getAdTextReport] Report pending (catch), retry in ${retryIn}s...`);
          await new Promise(resolve => setTimeout(resolve, Number(retryIn) * 1000));
        } else {
          console.error('[getAdTextReport] Error:', error.response?.data || error.message);
          return [];
        }
      }
    }

    if (!response || response.status !== 200) {
      console.error('[getAdTextReport] Failed to get report after retries');
      return [];
    }

    // Парсим TSV
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    const adStats: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const row: any = {};
      headers.forEach((header: string, idx: number) => {
        row[header] = values[idx];
      });

      adStats.push({
        adId: row['AdId'],
        clicks: parseInt(row['Clicks'] || '0'),
        cost: parseFloat(row['Cost'] || '0'),
        impressions: parseInt(row['Impressions'] || '0'),
        ctr: parseFloat(row['Ctr'] || '0'),
        avgCpc: parseFloat(row['AvgCpc'] || '0'),
      });
    }

    // Группируем по adId
    const adMap = new Map<string, any>();
    adStats.forEach(row => {
      const existing = adMap.get(row.adId);
      if (existing) {
        existing.clicks += row.clicks;
        existing.cost += row.cost;
        existing.impressions += row.impressions;
      } else {
        adMap.set(row.adId, { ...row });
      }
    });

    const aggregatedAds = Array.from(adMap.values()).map(p => ({
      ...p,
      ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
      avgCpc: p.clicks > 0 ? p.cost / p.clicks : 0,
    })).sort((a, b) => b.cost - a.cost).slice(0, 30);

    // Теперь получаем тексты объявлений через Ads API
    const adIds = aggregatedAds.map(a => parseInt(a.adId));
    if (adIds.length === 0) return [];

    try {
      const adsResponse = await axios.post(
        `${YANDEX_API_URL}/ads`,
        {
          method: 'get',
          params: {
            SelectionCriteria: {
              Ids: adIds,
            },
            FieldNames: ['Id'],
            TextAdFieldNames: ['Title', 'Title2', 'Text'],
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

      const ads = adsResponse.data?.result?.Ads || [];
      const adTextsMap = new Map<string, { title: string; text: string }>();

      ads.forEach((ad: any) => {
        const textAd = ad.TextAd;
        if (textAd) {
          adTextsMap.set(String(ad.Id), {
            title: textAd.Title || '',
            text: textAd.Text || '',
          });
        }
      });

      // Объединяем статистику с текстами
      // Примечание: Yandex API не поддерживает конверсии с разбивкой по объявлениям в этом отчёте
      return aggregatedAds.map(adStat => {
        const texts = adTextsMap.get(adStat.adId) || { title: '', text: '' };
        return {
          adId: adStat.adId,
          title: texts.title,
          text: texts.text,
          fullText: texts.title ? `${texts.title} ${texts.text}`.trim() : `Объявление ${adStat.adId}`,
          clicks: adStat.clicks,
          cost: adStat.cost,
          impressions: adStat.impressions,
          ctr: adStat.ctr,
          avgCpc: adStat.avgCpc,
          conversions: 0, // Конверсии по объявлениям получаем из ClickHouse (ad_performance)
        };
      });
    } catch (error: any) {
      console.error('[getAdTextReport] Error getting ad texts:', error.response?.data || error.message);
      // Возвращаем статистику без текстов
      return aggregatedAds.map(adStat => ({
        adId: adStat.adId,
        title: '',
        text: '',
        fullText: `Объявление ${adStat.adId}`,
        clicks: adStat.clicks,
        cost: adStat.cost,
        impressions: adStat.impressions,
        ctr: adStat.ctr,
        avgCpc: adStat.avgCpc,
        conversions: 0,
      }));
    }
  },
};
