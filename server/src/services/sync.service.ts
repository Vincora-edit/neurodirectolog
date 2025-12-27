import crypto from 'crypto';
import { clickhouseService } from './clickhouse.service';
import { yandexDirectService } from './yandex-direct.service';
import { aiAnalysisService } from './ai-analysis.service';
import { usageService } from './usage.service';

const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || '';
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET || '';

export const syncService = {
  /**
   * Синхронизация данных для одного подключения
   */
  async syncConnection(connectionId: string): Promise<void> {
    console.log(`[Sync] Starting sync for connection ${connectionId}`);

    try {
      // 1. Получаем данные подключения
      console.log(`[Sync] Fetching connection from ClickHouse...`);
      const connection = await clickhouseService.getConnectionById(connectionId);
      if (!connection) {
        console.error(`[Sync] Connection ${connectionId} not found in ClickHouse`);
        return;
      }

      console.log(`[Sync] Connection found: ${connection.login}, status: ${connection.status}`);

      if (connection.status !== 'active') {
        console.log(`[Sync] Connection ${connectionId} is not active, skipping`);
        return;
      }

      // 2. Обновляем access token если нужно
      let accessToken = connection.accessToken;
      try {
        // Проверяем токен, пытаясь получить информацию о пользователе
        console.log(`[Sync] Checking access token...`);
        await yandexDirectService.getUserInfo(accessToken);
        console.log(`[Sync] Access token is valid`);
      } catch (error) {
        console.log(`[Sync] Access token check failed:`, error);

        // Пытаемся обновить токен только если есть refresh token и client credentials
        if (connection.refreshToken && YANDEX_CLIENT_ID && YANDEX_CLIENT_SECRET) {
          console.log(`[Sync] Access token expired, refreshing...`);
          const tokens = await yandexDirectService.refreshAccessToken(
            connection.refreshToken,
            YANDEX_CLIENT_ID,
            YANDEX_CLIENT_SECRET
          );
          accessToken = tokens.access_token;
          await clickhouseService.updateConnectionTokens(
            connection.id,
            tokens.access_token,
            tokens.refresh_token
          );
        } else {
          console.error(`[Sync] Access token expired and cannot be refreshed (simple mode). User needs to reconnect.`);
          await clickhouseService.updateConnectionStatus(
            connection.id,
            'error',
            new Date()
          );
          throw new Error('Access token expired. Please reconnect your Yandex.Direct account.');
        }
      }

      // 3. Получаем список кампаний из Яндекс.Директ
      const campaigns = await yandexDirectService.getCampaigns(accessToken, connection.login);
      console.log(`[Sync] Found ${campaigns.length} campaigns`);

      if (campaigns.length === 0) {
        console.log(`[Sync] No campaigns found for connection ${connectionId}`);
        return;
      }

      // 4. Сохраняем кампании в ClickHouse
      const campaignData = campaigns.map(c => ({
        connectionId: connection.id,
        externalId: String(c.Id),
        name: c.Name,
        status: c.State as 'ON' | 'OFF' | 'ARCHIVED',
        type: c.Type,
        dailyBudget: c.DailyBudget?.Amount || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await clickhouseService.upsertCampaigns(campaignData);

      // 5. Получаем детальную статистику за последние 90 дней (3 месяца)
      const today = new Date();
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const dateFrom = ninetyDaysAgo.toISOString().split('T')[0];
      const dateTo = today.toISOString().split('T')[0];

      const campaignIds = campaigns.map(c => c.Id);

      // Получаем список целей из настроек подключения
      const goalIds = connection.conversionGoals
        ? JSON.parse(connection.conversionGoals)
        : [];

      console.log(`[Sync] Fetching detailed performance report for ${campaignIds.length} campaigns with ${goalIds.length} goals`);

      // Получаем детальный отчет с конверсиями
      const performanceData = await yandexDirectService.getCampaignPerformanceReport(
        accessToken,
        connection.login,
        campaignIds,
        goalIds,
        dateFrom,
        dateTo
      );

      console.log(`[Sync] Fetched ${performanceData.length} performance records`);

      if (performanceData.length > 0) {
        console.log(`[Sync] Sample performance data:`, JSON.stringify(performanceData[0], null, 2));
      }

      // 5.5. Получаем данные конверсий через отдельный CUSTOM_REPORT
      let conversionsData: any[] = [];
      if (goalIds.length > 0) {
        console.log(`[Sync] Fetching conversions report for ${goalIds.length} goals`);
        try {
          conversionsData = await yandexDirectService.getConversionsReport(
            accessToken,
            connection.login,
            campaignIds,
            goalIds,
            dateFrom,
            dateTo
          );
          console.log(`[Sync] Fetched ${conversionsData.length} conversion records`);
          if (conversionsData.length > 0) {
            console.log(`[Sync] Sample conversion data:`, JSON.stringify(conversionsData[0], null, 2));
          }
        } catch (conversionError) {
          console.error(`[Sync] Failed to fetch conversions, continuing without them:`, conversionError);
          // Продолжаем без конверсий, чтобы хотя бы базовая статистика загрузилась
        }
      }

      // 6. Получаем информацию о названии аккаунта
      const userInfo = await yandexDirectService.getUserInfo(accessToken);
      const accountName = userInfo.login || connection.login;

      // 7. Преобразуем данные для campaign_performance
      const performanceRecords = performanceData.map(row => {
        // Генерируем детерминированный ID для предотвращения дубликатов
        const idString = `${connection.id}_${row.CampaignId}_${row.Date}`;
        const id = crypto.createHash('md5').update(idString).digest('hex');

        return {
          id, // Детерминированный ID
          connectionId: connection.id,
          accountName,
          campaignId: String(row.CampaignId || ''),
          campaignName: row.CampaignName || '',
          campaignType: row.CampaignType || '',
          adGroupId: row.AdGroupId ? String(row.AdGroupId) : undefined,
          adGroupName: row.AdGroupName || undefined,
          adId: row.AdId ? String(row.AdId) : undefined,
          date: row.Date,

        // Метрики
        impressions: parseInt(row.Impressions) || 0,
        clicks: parseInt(row.Clicks) || 0,
        cost: parseFloat(row.Cost) || 0,
        ctr: parseFloat(row.Ctr) || 0,
        avgCpc: parseFloat(row.AvgCpc) || 0,
        avgCpm: parseFloat(row.AvgCpm) || 0,
        bounceRate: parseFloat(row.BounceRate) || 0,

        // Измерения
        device: row.Device || undefined,
        age: row.Age || undefined,
        gender: row.Gender || undefined,
        incomeGrade: row.IncomeGrade || undefined,
        targetingLocationId: row.TargetingLocationId ? parseInt(row.TargetingLocationId) : undefined,
        targetingLocationName: row.TargetingLocationName || undefined,
        targetingCategory: row.TargetingCategory || undefined,
        adNetworkType: row.AdNetworkType || undefined,
        placement: row.Placement || undefined,
        slot: row.Slot || undefined,
        criterion: row.Criterion || undefined,
        criterionType: row.CriterionType || undefined,
        matchType: row.MatchType || undefined,
        mobilePlatform: row.MobilePlatform || undefined,
        carrierType: row.CarrierType || undefined,
        };
      });

      // 8. Преобразуем данные конверсий из CUSTOM_REPORT
      const conversionRecords: any[] = conversionsData.map(row => {
        // Генерируем детерминированный ID для предотвращения дубликатов
        const idString = `${connection.id}_${row.CampaignId}_${row.Date}_${row.GoalId}`;
        const id = crypto.createHash('md5').update(idString).digest('hex');

        return {
          id, // Детерминированный ID
          connectionId: connection.id,
          campaignId: String(row.CampaignId || ''),
          adGroupId: undefined, // CUSTOM_REPORT на уровне кампаний
          adId: undefined,
          date: row.Date,
          goalId: String(row.GoalId || ''),
          goalName: undefined, // Можно добавить mapping goalId -> goalName если нужно
          attributionModel: 'AUTO',
          conversions: parseInt(row.Conversions) || 0,
          revenue: parseFloat(row.Revenue) || 0,
        };
      });

      console.log(`[Sync] Extracted ${conversionRecords.length} conversion records from ${goalIds.length} goals`);

      // 9. Сохраняем данные в ClickHouse
      await clickhouseService.insertCampaignPerformance(performanceRecords);

      if (conversionRecords.length > 0) {
        await clickhouseService.insertCampaignConversions(conversionRecords);
      }

      // 9.5. Получаем и сохраняем статистику по группам объявлений (с реальными конверсиями из API)
      console.log(`[Sync] Fetching ad group performance report with ${goalIds.length} goals...`);
      try {
        const adGroupData = await yandexDirectService.getAdGroupPerformanceReport(
          accessToken,
          connection.login,
          campaignIds,
          dateFrom,
          dateTo,
          goalIds.length > 0 ? goalIds : undefined
        );
        console.log(`[Sync] Fetched ${adGroupData.length} ad group records`);

        if (adGroupData.length > 0) {
          const adGroupRecords = adGroupData.map(row => {
            const idString = `${connection.id}_${row.CampaignId}_${row.AdGroupId}_${row.Date}`;
            const id = crypto.createHash('md5').update(idString).digest('hex');

            return {
              id,
              connectionId: connection.id,
              campaignId: String(row.CampaignId || ''),
              campaignName: row.CampaignName || '',
              adGroupId: String(row.AdGroupId || ''),
              adGroupName: row.AdGroupName || '',
              date: row.Date,
              impressions: parseInt(row.Impressions) || 0,
              clicks: parseInt(row.Clicks) || 0,
              cost: parseFloat(row.Cost) || 0,
              ctr: parseFloat(row.Ctr) || 0,
              avgCpc: parseFloat(row.AvgCpc) || 0,
              bounceRate: parseFloat(row.BounceRate) || 0,
              conversions: row.TotalConversions || 0,
              revenue: 0,
            };
          });
          await clickhouseService.insertAdGroupPerformance(adGroupRecords);
          console.log(`[Sync] Inserted ${adGroupRecords.length} ad group records with real conversions`);
        }

        // 9.5.1. Сохраняем конверсии по группам с разбивкой по целям
        if (goalIds.length > 0) {
          const adGroupConversionsData = await yandexDirectService.getAdGroupConversionsReport(
            accessToken,
            connection.login,
            campaignIds,
            goalIds,
            dateFrom,
            dateTo
          );

          if (adGroupConversionsData.length > 0) {
            const adGroupConvRecords = adGroupConversionsData.map(row => {
              const idString = `${connection.id}_${row.CampaignId}_${row.AdGroupId}_${row.GoalId}_${row.Date}`;
              const id = crypto.createHash('md5').update(idString).digest('hex');
              return {
                id,
                connectionId: connection.id,
                campaignId: String(row.CampaignId || ''),
                adGroupId: String(row.AdGroupId || ''),
                date: row.Date,
                goalId: String(row.GoalId || ''),
                conversions: row.Conversions || 0,
                revenue: row.Revenue || 0,
              };
            });
            await clickhouseService.insertAdGroupConversions(adGroupConvRecords);
            console.log(`[Sync] Inserted ${adGroupConvRecords.length} ad group conversion records by goal`);
          }
        }
      } catch (adGroupError) {
        console.error(`[Sync] Failed to fetch ad group data, continuing:`, adGroupError);
      }

      // 9.6. Получаем и сохраняем статистику по объявлениям (с реальными конверсиями из API)
      console.log(`[Sync] Fetching ad performance report with ${goalIds.length} goals...`);
      try {
        const adData = await yandexDirectService.getAdPerformanceReport(
          accessToken,
          connection.login,
          campaignIds,
          dateFrom,
          dateTo,
          goalIds.length > 0 ? goalIds : undefined
        );
        console.log(`[Sync] Fetched ${adData.length} ad records`);

        if (adData.length > 0) {
          const adRecords = adData.map(row => {
            const idString = `${connection.id}_${row.CampaignId}_${row.AdGroupId}_${row.AdId}_${row.Date}`;
            const id = crypto.createHash('md5').update(idString).digest('hex');

            return {
              id,
              connectionId: connection.id,
              campaignId: String(row.CampaignId || ''),
              campaignName: row.CampaignName || '',
              adGroupId: String(row.AdGroupId || ''),
              adGroupName: row.AdGroupName || '',
              adId: String(row.AdId || ''),
              date: row.Date,
              impressions: parseInt(row.Impressions) || 0,
              clicks: parseInt(row.Clicks) || 0,
              cost: parseFloat(row.Cost) || 0,
              ctr: parseFloat(row.Ctr) || 0,
              avgCpc: parseFloat(row.AvgCpc) || 0,
              bounceRate: parseFloat(row.BounceRate) || 0,
              conversions: row.TotalConversions || 0,
              revenue: 0,
            };
          });
          await clickhouseService.insertAdPerformance(adRecords);
          console.log(`[Sync] Inserted ${adRecords.length} ad records with real conversions`);

          // 9.7. Получаем заголовки объявлений через Ads API
          console.log(`[Sync] Fetching ad titles...`);
          const uniqueAdIds = [...new Set(adRecords.map(r => r.adId))];
          try {
            const adTitles = await yandexDirectService.getAdTitles(
              accessToken,
              connection.login,
              uniqueAdIds
            );

            if (adTitles.size > 0) {
              // Создаём мапу adId -> {adGroupId, campaignId} из adRecords
              const adInfoMap = new Map<string, { adGroupId: string; campaignId: string }>();
              adRecords.forEach(r => {
                if (!adInfoMap.has(r.adId)) {
                  adInfoMap.set(r.adId, { adGroupId: r.adGroupId, campaignId: r.campaignId });
                }
              });

              const adContentRecords = Array.from(adTitles.entries()).map(([adId, titles]) => {
                const adInfo = adInfoMap.get(adId) || { adGroupId: '', campaignId: '' };
                return {
                  connectionId: connection.id,
                  accountName: connection.login,
                  adId,
                  adGroupId: adInfo.adGroupId,
                  campaignId: adInfo.campaignId,
                  title: titles.title,
                  title2: titles.title2,
                  text: titles.text,
                  href: titles.href,
                };
              });
              await clickhouseService.upsertAdContents(adContentRecords);
              console.log(`[Sync] Saved ${adContentRecords.length} ad titles`);
            }
          } catch (adTitlesError) {
            console.error(`[Sync] Failed to fetch ad titles, continuing:`, adTitlesError);
          }
        }

        // 9.6.1. Сохраняем конверсии по объявлениям с разбивкой по целям
        if (goalIds.length > 0) {
          const adConversionsData = await yandexDirectService.getAdConversionsReport(
            accessToken,
            connection.login,
            campaignIds,
            goalIds,
            dateFrom,
            dateTo
          );

          if (adConversionsData.length > 0) {
            const adConvRecords = adConversionsData.map(row => {
              const idString = `${connection.id}_${row.CampaignId}_${row.AdGroupId}_${row.AdId}_${row.GoalId}_${row.Date}`;
              const id = crypto.createHash('md5').update(idString).digest('hex');
              return {
                id,
                connectionId: connection.id,
                campaignId: String(row.CampaignId || ''),
                adGroupId: String(row.AdGroupId || ''),
                adId: String(row.AdId || ''),
                date: row.Date,
                goalId: String(row.GoalId || ''),
                conversions: row.Conversions || 0,
                revenue: row.Revenue || 0,
              };
            });
            await clickhouseService.insertAdConversions(adConvRecords);
            console.log(`[Sync] Inserted ${adConvRecords.length} ad conversion records by goal`);
          }
        }
      } catch (adError) {
        console.error(`[Sync] Failed to fetch ad data, continuing:`, adError);
      }

      // 9.8. Синхронизируем поисковые запросы
      console.log(`[Sync] Fetching search queries report...`);
      try {
        const searchQueriesData = await yandexDirectService.getSearchQueryReport(
          accessToken,
          connection.login,
          campaignIds,
          dateFrom,
          dateTo
        );
        console.log(`[Sync] Fetched ${searchQueriesData.length} search query records`);

        if (searchQueriesData.length > 0) {
          const searchQueryRecords = searchQueriesData.map((row: any) => {
            const idString = `${connection.id}_${row.campaignId}_${row.query}_${dateFrom}_${dateTo}`;
            const id = crypto.createHash('md5').update(idString).digest('hex');
            return {
              id,
              connectionId: connection.id,
              accountName: connection.login,
              campaignId: String(row.campaignId || ''),
              campaignName: '', // Можно добавить маппинг
              adGroupId: row.adGroupId ? String(row.adGroupId) : null,
              adGroupName: null,
              adId: null,
              date: dateFrom, // Агрегированные данные за период
              query: row.query || '',
              matchedKeyword: null,
              matchType: null,
              impressions: row.impressions || 0,
              clicks: row.clicks || 0,
              cost: row.cost || 0,
              criterion: null,
              criterionType: null,
              targetingCategory: null,
              placement: null,
              incomeGrade: null,
            };
          });
          await clickhouseService.insertSearchQueries(searchQueryRecords);
          console.log(`[Sync] Inserted ${searchQueryRecords.length} search query records`);
        }
      } catch (searchError) {
        console.error(`[Sync] Failed to fetch search queries, continuing:`, searchError);
      }

      // 10. Создаем мапу конверсий по campaign_id + date для старой таблицы
      const conversionsMap = new Map<string, { conversions: number; revenue: number }>();
      conversionsData.forEach(row => {
        const key = `${row.CampaignId}_${row.Date}`;
        const existing = conversionsMap.get(key) || { conversions: 0, revenue: 0 };
        conversionsMap.set(key, {
          conversions: existing.conversions + (parseInt(row.Conversions) || 0),
          revenue: existing.revenue + (parseFloat(row.Revenue) || 0),
        });
      });

      // 11. Также сохраняем в старую таблицу campaign_stats для обратной совместимости с дашбордом
      const statsToInsert = performanceData.map(row => {
        const campaignExternalId = String(row.CampaignId || '');
        const campaignMatch = campaignData.find(c => c.externalId === campaignExternalId);
        const campaignId = campaignMatch?.externalId || campaignExternalId;

        // Получаем конверсии из мапы
        const key = `${row.CampaignId}_${row.Date}`;
        const conversionData = conversionsMap.get(key) || { conversions: 0, revenue: 0 };
        const totalConversions = conversionData.conversions;
        const totalRevenue = conversionData.revenue;

        const clicks = parseInt(row.Clicks) || 0;
        const cost = parseFloat(row.Cost) || 0;

        return {
          campaignId,
          campaignExternalId,
          connectionId: connection.id,
          date: row.Date,
          impressions: parseInt(row.Impressions) || 0,
          clicks,
          cost,
          ctr: parseFloat(row.Ctr) || 0,
          avgCpc: parseFloat(row.AvgCpc) || 0,
          avgCpm: parseFloat(row.AvgCpm) || 0,
          conversions: totalConversions,
          conversionRate: clicks > 0 ? (totalConversions / clicks) * 100 : 0,
          costPerConversion: totalConversions > 0 ? cost / totalConversions : 0,
          qualifiedLeads: totalConversions, // Все конверсии считаем квалифицированными
          costPerQualifiedLead: totalConversions > 0 ? cost / totalConversions : 0,
          revenue: totalRevenue,
          roi: cost > 0 ? ((totalRevenue - cost) / cost) * 100 : 0,
        };
      });

      await clickhouseService.insertCampaignStats(statsToInsert);

      // 12. Обновляем статус подключения
      await clickhouseService.updateConnectionStatus(
        connection.id,
        'active',
        new Date()
      );

      // 13. Запускаем AI анализ для генерации рекомендаций
      console.log(`[Sync] Running AI analysis for connection ${connectionId}`);
      try {
        await aiAnalysisService.analyzeAllCampaigns(connection.id);
      } catch (analysisError) {
        console.error(`[Sync] AI analysis failed, but sync completed:`, analysisError);
      }

      console.log(`[Sync] Successfully synced connection ${connectionId}`);

      // Трекинг использования: синхронизация + AI анализ
      try {
        usageService.trackYandexSync(connection.userId);
        usageService.trackAiRequest(connection.userId, 3000); // AI анализ кампаний
      } catch (trackError) {
        console.error(`[Sync] Usage tracking failed:`, trackError);
      }
    } catch (error: any) {
      console.error(`[Sync] Error syncing connection ${connectionId}:`, error);

      // Помечаем подключение как ошибочное
      try {
        const connection = await clickhouseService.getConnectionByProjectId(connectionId);
        if (connection) {
          await clickhouseService.updateConnectionStatus(
            connection.id,
            'error',
            new Date()
          );
        }
      } catch (updateError) {
        console.error(`[Sync] Failed to update connection status:`, updateError);
      }

      throw error;
    }
  },

  /**
   * Синхронизация всех активных подключений
   */
  async syncAllConnections(): Promise<void> {
    console.log('[Sync] Starting sync for all connections');

    try {
      // Получаем все активные подключения из ClickHouse
      const connections = await clickhouseService.getAllActiveConnections();

      if (!connections || connections.length === 0) {
        console.log('[Sync] No active connections found');
        return;
      }

      console.log(`[Sync] Found ${connections.length} active connection(s)`);

      // Синхронизируем каждое подключение последовательно
      for (const connection of connections) {
        try {
          console.log(`[Sync] Syncing connection ${connection.id} (${connection.login})`);
          await this.syncConnection(connection.id);
          console.log(`[Sync] Successfully synced connection ${connection.id}`);
        } catch (error) {
          console.error(`[Sync] Failed to sync connection ${connection.id}:`, error);
          // Продолжаем синхронизацию других подключений даже если одно упало
        }
      }

      console.log('[Sync] Completed sync for all connections');
    } catch (error) {
      console.error('[Sync] Failed to sync all connections:', error);
      throw error;
    }
  },
};
