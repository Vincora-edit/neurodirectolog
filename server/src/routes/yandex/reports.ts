/**
 * Yandex Reports Routes
 * Отчёты: поисковые запросы, демография, гео, устройства, площадки, доходы, тексты
 */

import express from 'express';
import { clickhouseService } from '../../services/clickhouse.service';
import { yandexDirectService } from '../../services/yandex-direct.service';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { requireProjectAccess } from '../../middleware/projectAccess';

const router = express.Router();

// Отключаем кеширование для всех отчётов
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Хелпер для получения connection
async function getConnection(projectId: string, connectionId?: string) {
  if (connectionId) {
    return clickhouseService.getConnectionById(connectionId);
  }
  return clickhouseService.getConnectionByProjectId(projectId);
}

// Хелпер для парсинга дат
function parseDates(startDateParam?: string, endDateParam?: string, days?: string) {
  let startDate: Date;
  let endDate: Date;

  if (startDateParam && endDateParam) {
    startDate = new Date(startDateParam);
    endDate = new Date(endDateParam);
  } else {
    endDate = new Date();
    startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days || '30'));
  }

  return { startDate, endDate };
}

// Хелпер для получения goalIds из connection
function parseGoalIds(connection: any): string[] {
  let goalIds: string[] = [];
  try {
    if (connection.conversionGoals) {
      goalIds = JSON.parse(connection.conversionGoals);
    }
  } catch (e) {
    // No goals configured
  }
  return goalIds;
}

/**
 * GET /api/yandex/search-queries/:projectId
 * Получить статистику по поисковым запросам (из ClickHouse, fallback на API)
 */
router.get('/search-queries/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId, campaignId } = req.query;

    const connection = await getConnection(projectId, connectionId as string);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { startDate, endDate } = parseDates(startDateParam as string, endDateParam as string, days as string);
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    console.log(`[SearchQueries] connectionId: ${connection.id}, dateFrom: ${dateFrom}, dateTo: ${dateTo}, campaignId: ${campaignId}`);

    // Сначала пробуем из ClickHouse
    let searchQueries = await clickhouseService.getSearchQueries(
      connection.id,
      dateFrom,
      dateTo,
      campaignId as string | undefined
    );

    console.log(`[SearchQueries] Found ${searchQueries.length} results from ClickHouse`);

    // Если данных нет - fallback на API
    if (searchQueries.length === 0) {
      console.log(`[SearchQueries] No data in ClickHouse, falling back to API...`);

      // Получаем campaign IDs для API запроса
      let campaignIds: number[];
      if (campaignId) {
        campaignIds = [parseInt(campaignId as string)];
      } else {
        const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
        campaignIds = campaigns.map(c => parseInt(c.externalId));
      }

      if (campaignIds.length > 0) {
        const apiData = await yandexDirectService.getSearchQueryReport(
          connection.accessToken,
          connection.login,
          campaignIds,
          dateFrom,
          dateTo
        );

        console.log(`[SearchQueries] Fetched ${apiData.length} results from API`);

        searchQueries = apiData.map((row: any) => ({
          query: row.query || '',
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          cost: row.cost || 0,
          conversions: 0,
          revenue: 0,
          ctr: row.impressions > 0 ? (row.clicks / row.impressions * 100) : 0,
          avgCpc: row.clicks > 0 ? (row.cost / row.clicks) : 0,
        }));
      }
    }

    res.json(searchQueries);
  } catch (error: any) {
    console.error('Failed to get search queries:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/demographics/:projectId
 * Получить статистику по полу и возрасту
 */
router.get('/demographics/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId, campaignId } = req.query;

    const connection = await getConnection(projectId, connectionId as string);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { startDate, endDate } = parseDates(startDateParam as string, endDateParam as string, days as string);
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    let campaignIds: number[];
    if (campaignId) {
      campaignIds = [parseInt(campaignId as string)];
    } else {
      const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
      campaignIds = campaigns.map(c => parseInt(c.externalId));
    }

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const goalIds = parseGoalIds(connection);

    const demographics = await yandexDirectService.getDemographicsReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    res.json(demographics);
  } catch (error: any) {
    console.error('Failed to get demographics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/geo-stats/:projectId
 * Получить статистику по регионам (устаревший эндпоинт)
 */
router.get('/geo-stats/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId } = req.query;

    const connection = await getConnection(projectId, connectionId as string);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { startDate, endDate } = parseDates(startDateParam as string, endDateParam as string, days as string);
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
    const campaignIds = campaigns.map(c => parseInt(c.externalId));

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const geoStats = await yandexDirectService.getGeoStats(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo
    );

    // Агрегируем данные по регионам
    const geoMap = new Map<string, {
      region: string;
      impressions: number;
      clicks: number;
      cost: number;
      bounces: number;
    }>();

    geoStats.forEach((row: any) => {
      const region = row.LocationOfPresenceName || 'Неизвестный регион';
      const existing = geoMap.get(region) || {
        region,
        impressions: 0,
        clicks: 0,
        cost: 0,
        bounces: 0,
      };

      existing.impressions += parseInt(row.Impressions) || 0;
      existing.clicks += parseInt(row.Clicks) || 0;
      existing.cost += parseFloat(row.Cost) || 0;
      const bounceRate = parseFloat(row.BounceRate) || 0;
      const clicks = parseInt(row.Clicks) || 0;
      existing.bounces += Math.round(clicks * bounceRate / 100);

      geoMap.set(region, existing);
    });

    const result = Array.from(geoMap.values()).map(g => ({
      region: g.region,
      impressions: g.impressions,
      clicks: g.clicks,
      cost: Math.round(g.cost * 100) / 100,
      ctr: g.impressions > 0 ? Math.round((g.clicks / g.impressions) * 10000) / 100 : 0,
      avgCpc: g.clicks > 0 ? Math.round((g.cost / g.clicks) * 100) / 100 : 0,
      bounceRate: g.clicks > 0 ? Math.round((g.bounces / g.clicks) * 10000) / 100 : 0,
    }));

    result.sort((a, b) => b.cost - a.cost);

    res.json(result.slice(0, 20));
  } catch (error: any) {
    console.error('Failed to get geo stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/geo-report/:projectId
 * Получить статистику по регионам (новый эндпоинт)
 */
router.get('/geo-report/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId, campaignId } = req.query;

    const connection = await getConnection(projectId, connectionId as string);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { startDate, endDate } = parseDates(startDateParam as string, endDateParam as string, days as string);
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    let campaignIds: number[];
    if (campaignId) {
      campaignIds = [parseInt(campaignId as string)];
    } else {
      const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
      campaignIds = campaigns.map(c => parseInt(c.externalId));
    }

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const goalIds = parseGoalIds(connection);

    const geoReport = await yandexDirectService.getGeoStats(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    const result = geoReport.map((row: any) => ({
      region: row.LocationOfPresenceName || 'Неизвестно',
      impressions: parseInt(row.Impressions) || 0,
      clicks: parseInt(row.Clicks) || 0,
      cost: parseFloat(row.Cost) || 0,
      conversions: parseInt(row.Conversions) || 0,
      ctr: row.Impressions > 0 ? (parseInt(row.Clicks) / parseInt(row.Impressions)) * 100 : 0,
      avgCpc: row.Clicks > 0 ? parseFloat(row.Cost) / parseInt(row.Clicks) : 0,
    }));

    res.json(result);
  } catch (error: any) {
    console.error('Failed to get geo report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/device-stats/:projectId
 * Получить статистику по устройствам
 */
router.get('/device-stats/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId, campaignId } = req.query;

    const connection = await getConnection(projectId, connectionId as string);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { startDate, endDate } = parseDates(startDateParam as string, endDateParam as string, days as string);
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    let campaignIds: number[];
    if (campaignId) {
      campaignIds = [parseInt(campaignId as string)];
    } else {
      const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
      campaignIds = campaigns.map(c => parseInt(c.externalId));
    }

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const goalIds = parseGoalIds(connection);

    const deviceStats = await yandexDirectService.getDeviceStats(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    // Агрегируем данные по устройствам
    const deviceMap = new Map<string, {
      device: string;
      impressions: number;
      clicks: number;
      cost: number;
      bounces: number;
      conversions: number;
    }>();

    deviceStats.forEach((row: any) => {
      const device = row.Device || 'UNKNOWN';
      const existing = deviceMap.get(device) || {
        device,
        impressions: 0,
        clicks: 0,
        cost: 0,
        bounces: 0,
        conversions: 0,
      };

      existing.impressions += parseInt(row.Impressions) || 0;
      existing.clicks += parseInt(row.Clicks) || 0;
      existing.cost += parseFloat(row.Cost) || 0;
      existing.conversions += parseInt(row.Conversions) || 0;
      const bounceRate = parseFloat(row.BounceRate) || 0;
      const clicks = parseInt(row.Clicks) || 0;
      existing.bounces += Math.round(clicks * bounceRate / 100);

      deviceMap.set(device, existing);
    });

    const result = Array.from(deviceMap.values()).map(d => ({
      device: d.device,
      deviceName: d.device === 'DESKTOP' ? 'Десктоп' :
                  d.device === 'MOBILE' ? 'Мобильный' :
                  d.device === 'TABLET' ? 'Планшет' : d.device,
      impressions: d.impressions,
      clicks: d.clicks,
      cost: Math.round(d.cost * 100) / 100,
      ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
      avgCpc: d.clicks > 0 ? Math.round((d.cost / d.clicks) * 100) / 100 : 0,
      bounceRate: d.clicks > 0 ? Math.round((d.bounces / d.clicks) * 10000) / 100 : 0,
      conversions: d.conversions,
    }));

    result.sort((a, b) => b.clicks - a.clicks);

    res.json(result);
  } catch (error: any) {
    console.error('Failed to get device stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/placements/:projectId
 * Получить статистику по площадкам
 */
router.get('/placements/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId, campaignId } = req.query;

    const connection = await getConnection(projectId, connectionId as string);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { startDate, endDate } = parseDates(startDateParam as string, endDateParam as string, days as string);
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    let campaignIds: number[];
    if (campaignId) {
      campaignIds = [parseInt(campaignId as string)];
    } else {
      const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
      campaignIds = campaigns.map(c => parseInt(c.externalId));
    }

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const goalIds = parseGoalIds(connection);

    const placements = await yandexDirectService.getPlacementsReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    res.json(placements);
  } catch (error: any) {
    console.error('Failed to get placements:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/income/:projectId
 * Получить статистику по платёжеспособности
 */
router.get('/income/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId, campaignId } = req.query;

    const connection = await getConnection(projectId, connectionId as string);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { startDate, endDate } = parseDates(startDateParam as string, endDateParam as string, days as string);
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    let campaignIds: number[];
    if (campaignId) {
      campaignIds = [parseInt(campaignId as string)];
    } else {
      const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
      campaignIds = campaigns.map(c => parseInt(c.externalId));
    }

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const goalIds = parseGoalIds(connection);

    const incomeData = await yandexDirectService.getIncomeReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    res.json(incomeData);
  } catch (error: any) {
    console.error('Failed to get income data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/targeting-categories/:projectId
 * Получить статистику по категориям таргетинга
 */
router.get('/targeting-categories/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId, campaignId } = req.query;

    const connection = await getConnection(projectId, connectionId as string);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { startDate, endDate } = parseDates(startDateParam as string, endDateParam as string, days as string);
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    let campaignIds: number[];
    if (campaignId) {
      campaignIds = [parseInt(campaignId as string)];
    } else {
      const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
      campaignIds = campaigns.map(c => parseInt(c.externalId));
    }

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const goalIds = parseGoalIds(connection);

    const categoriesData = await yandexDirectService.getTargetingCategoryReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    res.json(categoriesData);
  } catch (error: any) {
    console.error('Failed to get targeting categories:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/criteria/:projectId
 * Получить статистику по условиям показа (ключевым словам)
 */
router.get('/criteria/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId, campaignId } = req.query;

    const connection = await getConnection(projectId, connectionId as string);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { startDate, endDate } = parseDates(startDateParam as string, endDateParam as string, days as string);
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    let campaignIds: number[];
    if (campaignId) {
      campaignIds = [parseInt(campaignId as string)];
    } else {
      const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
      campaignIds = campaigns.map(c => parseInt(c.externalId));
    }

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const goalIds = parseGoalIds(connection);

    const criteriaData = await yandexDirectService.getCriteriaReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo,
      goalIds.length > 0 ? goalIds : undefined
    );

    res.json(criteriaData);
  } catch (error: any) {
    console.error('Failed to get criteria:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/yandex/ad-texts/:projectId
 * Получить статистику по текстам объявлений
 */
router.get('/ad-texts/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { days, startDate: startDateParam, endDate: endDateParam, connectionId, campaignId } = req.query;

    const connection = await getConnection(projectId, connectionId as string);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const { startDate, endDate } = parseDates(startDateParam as string, endDateParam as string, days as string);
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Читаем из ClickHouse с учётом фильтра по кампании
    try {
      const cachedData = await clickhouseService.getAdTexts(connection.id, dateFrom, dateTo, campaignId as string | undefined);
      if (cachedData && cachedData.length > 0) {
        console.log(`[ad-texts] Returning ${cachedData.length} cached records from ClickHouse`);
        return res.json(cachedData);
      }
    } catch (cacheError) {
      console.log(`[ad-texts] ClickHouse cache miss, falling back to API`);
    }

    // Fallback на Яндекс API
    let campaignIds: number[];
    if (campaignId) {
      campaignIds = [parseInt(campaignId as string)];
    } else {
      const campaigns = await clickhouseService.getCampaignsByConnectionId(connection.id);
      campaignIds = campaigns.map(c => parseInt(c.externalId));
    }

    if (campaignIds.length === 0) {
      return res.json([]);
    }

    const adTextsData = await yandexDirectService.getAdTextReport(
      connection.accessToken,
      connection.login,
      campaignIds,
      dateFrom,
      dateTo
    );

    res.json(adTextsData);
  } catch (error: any) {
    console.error('Failed to get ad texts:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
