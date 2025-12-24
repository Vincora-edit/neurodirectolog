import { createClient } from '@clickhouse/client';
import { v4 as uuidv4 } from 'uuid';

const client = createClient({
  url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'neurodirectolog',
});

// Helper to format dates for ClickHouse
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

export interface YandexDirectConnection {
  id: string;
  userId: string;
  projectId: string;
  login: string;
  accessToken: string;
  refreshToken: string;
  metrikaCounterId: string;
  metrikaToken: string;
  conversionGoals: string; // JSON string
  status: 'active' | 'error' | 'disconnected';
  lastSyncAt: Date;
  createdAt: Date;
}

export interface Campaign {
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  status: 'ON' | 'OFF' | 'ARCHIVED';
  type: string;
  dailyBudget: number;
  responsible?: string;
  executor?: string;
  kpi?: string; // JSON: { target_cpa: 500, target_roi: 300 }
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignStats {
  id: string;
  campaignId: string;
  campaignExternalId: string;
  connectionId: string;
  date: Date;
  impressions: number;
  clicks: number;
  cost: number;
  ctr: number;
  avgCpc: number;
  avgCpm: number;
  conversions: number;
  conversionRate: number;
  costPerConversion: number;
  qualifiedLeads: number;
  costPerQualifiedLead: number;
  revenue: number;
  roi: number;
}

export interface AIRecommendation {
  id: string;
  campaignId: string;
  type: 'warning' | 'suggestion' | 'critical';
  category: 'budget' | 'ctr' | 'conversions' | 'keywords';
  title: string;
  description: string;
  actionText: string;
  isApplied: boolean;
  isDismissed: boolean;
  createdAt: Date;
}

export interface CampaignPerformance {
  id?: string;
  connectionId: string;
  accountName: string;
  campaignId: string;
  campaignName: string;
  campaignType: string;
  adGroupId?: string;
  adGroupName?: string;
  adId?: string;
  date: string; // YYYY-MM-DD format

  // Метрики
  impressions: number;
  clicks: number;
  cost: number;
  ctr: number;
  avgCpc: number;
  avgCpm: number;
  bounceRate?: number;
  avgClickPosition?: number;
  avgImpressionPosition?: number;

  // Измерения
  device?: string;
  age?: string;
  gender?: string;
  incomeGrade?: string;
  targetingLocationId?: number;
  targetingLocationName?: string;
  targetingCategory?: string;
  adNetworkType?: string;
  placement?: string;
  slot?: string;
  criterion?: string;
  criterionType?: string;
  matchType?: string;
  mobilePlatform?: string;
  carrierType?: string;
}

export interface CampaignConversion {
  id?: string;
  connectionId: string;
  campaignId: string;
  adGroupId?: string;
  adId?: string;
  date: string; // YYYY-MM-DD format
  goalId: string;
  goalName?: string;
  attributionModel: string;
  conversions: number;
  revenue: number;
}

export const clickhouseService = {
  async ping() {
    const result = await client.ping();
    return result.success;
  },

  // Yandex.Direct Connections
  async createConnection(connection: Omit<YandexDirectConnection, 'id' | 'createdAt'>): Promise<string> {
    const id = uuidv4();
    const now = formatDate(new Date());

    await client.insert({
      table: 'yandex_direct_connections',
      values: [{
        id,
        user_id: connection.userId,
        project_id: connection.projectId,
        login: connection.login,
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
        metrika_counter_id: connection.metrikaCounterId,
        metrika_token: connection.metrikaToken,
        conversion_goals: connection.conversionGoals,
        status: connection.status,
        last_sync_at: formatDate(connection.lastSyncAt),
        created_at: now,
      }],
      format: 'JSONEachRow',
    });

    return id;
  },

  async getConnectionById(connectionId: string): Promise<YandexDirectConnection | null> {
    const result = await client.query({
      query: `
        SELECT *
        FROM yandex_direct_connections FINAL
        WHERE id = {connectionId:String}
        ORDER BY created_at DESC
        LIMIT 1
      `,
      query_params: { connectionId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      login: row.login,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      metrikaCounterId: row.metrika_counter_id,
      metrikaToken: row.metrika_token,
      conversionGoals: row.conversion_goals,
      status: row.status,
      lastSyncAt: new Date(row.last_sync_at),
      createdAt: new Date(row.created_at),
    };
  },

  async getAllActiveConnections(): Promise<YandexDirectConnection[]> {
    const result = await client.query({
      query: `
        SELECT *
        FROM yandex_direct_connections FINAL
        WHERE status = 'active'
        ORDER BY created_at DESC
      `,
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      login: row.login,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      metrikaCounterId: row.metrika_counter_id,
      metrikaToken: row.metrika_token,
      conversionGoals: row.conversion_goals,
      status: row.status,
      lastSyncAt: new Date(row.last_sync_at),
      createdAt: new Date(row.created_at),
    }));
  },

  async getConnectionByProjectId(projectId: string): Promise<YandexDirectConnection | null> {
    console.log('[getConnectionByProjectId] Looking for projectId:', projectId);
    const result = await client.query({
      query: `
        SELECT *
        FROM yandex_direct_connections FINAL
        WHERE project_id = {projectId:String}
        ORDER BY created_at DESC
        LIMIT 1
      `,
      query_params: { projectId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    console.log('[getConnectionByProjectId] Found rows:', rows.length);
    if (rows.length > 0) {
      console.log('[getConnectionByProjectId] First row:', JSON.stringify(rows[0]));
    }

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      login: row.login,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      metrikaCounterId: row.metrika_counter_id,
      metrikaToken: row.metrika_token,
      conversionGoals: row.conversion_goals,
      status: row.status,
      lastSyncAt: new Date(row.last_sync_at),
      createdAt: new Date(row.created_at),
    };
  },

  /**
   * Получить все подключения для проекта (поддержка мультиаккаунтности)
   */
  async getConnectionsByProjectId(projectId: string): Promise<YandexDirectConnection[]> {
    console.log('[getConnectionsByProjectId] Looking for projectId:', projectId);
    const result = await client.query({
      query: `
        SELECT *
        FROM yandex_direct_connections FINAL
        WHERE project_id = {projectId:String}
        AND status = 'active'
        ORDER BY created_at DESC
      `,
      query_params: { projectId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    console.log('[getConnectionsByProjectId] Found rows:', rows.length);

    return rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      login: row.login,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      metrikaCounterId: row.metrika_counter_id,
      metrikaToken: row.metrika_token,
      conversionGoals: row.conversion_goals,
      status: row.status,
      lastSyncAt: new Date(row.last_sync_at),
      createdAt: new Date(row.created_at),
    }));
  },

  async updateConnectionTokens(connectionId: string, accessToken: string, refreshToken: string): Promise<void> {
    // Получаем существующую запись
    const existing = await this.getConnectionById(connectionId);
    if (!existing) {
      console.error(`[updateConnectionTokens] Connection ${connectionId} not found`);
      return;
    }

    // Вставляем новую версию со ВСЕМИ полями
    await client.insert({
      table: 'yandex_direct_connections',
      values: [{
        id: connectionId,
        user_id: existing.userId,
        project_id: existing.projectId,
        login: existing.login,
        access_token: accessToken,
        refresh_token: refreshToken,
        metrika_counter_id: existing.metrikaCounterId,
        metrika_token: existing.metrikaToken,
        conversion_goals: existing.conversionGoals,
        status: existing.status,
        last_sync_at: formatDate(existing.lastSyncAt),
        created_at: formatDate(new Date()),
      }],
      format: 'JSONEachRow',
    });
  },

  async updateConnectionStatus(connectionId: string, status: string, lastSyncAt: Date): Promise<void> {
    // Получаем существующую запись
    const existing = await this.getConnectionById(connectionId);
    if (!existing) {
      console.error(`[updateConnectionStatus] Connection ${connectionId} not found`);
      return;
    }

    // Вставляем новую версию со ВСЕМИ полями
    await client.insert({
      table: 'yandex_direct_connections',
      values: [{
        id: connectionId,
        user_id: existing.userId,
        project_id: existing.projectId,
        login: existing.login,
        access_token: existing.accessToken,
        refresh_token: existing.refreshToken,
        metrika_counter_id: existing.metrikaCounterId,
        metrika_token: existing.metrikaToken,
        conversion_goals: existing.conversionGoals,
        status,
        last_sync_at: formatDate(lastSyncAt),
        created_at: formatDate(new Date()),
      }],
      format: 'JSONEachRow',
    });
  },

  // Campaigns
  async upsertCampaigns(campaigns: Omit<Campaign, 'id'>[]): Promise<void> {
    if (campaigns.length === 0) return;

    console.log(`[ClickHouse] Upserting ${campaigns.length} campaigns`);

    const values = campaigns.map(c => ({
      id: uuidv4(),
      connection_id: c.connectionId,
      external_id: c.externalId,
      name: c.name,
      status: c.status,
      type: c.type,
      daily_budget: c.dailyBudget,
      responsible: c.responsible || '',
      executor: c.executor || '',
      kpi: c.kpi || '',
      created_at: formatDate(c.createdAt),
      updated_at: formatDate(new Date()),
    }));

    console.log(`[ClickHouse] Sample campaign to insert:`, JSON.stringify(values[0], null, 2));

    await client.insert({
      table: 'campaigns',
      values,
      format: 'JSONEachRow',
    });

    console.log(`[ClickHouse] Successfully inserted ${campaigns.length} campaigns`);
  },

  async getCampaignsByConnectionId(connectionId: string): Promise<Campaign[]> {
    const result = await client.query({
      query: `
        SELECT * FROM campaigns
        WHERE connection_id = {connectionId:String}
        ORDER BY updated_at DESC
      `,
      query_params: { connectionId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map((row: any) => ({
      id: row.id,
      connectionId: row.connection_id,
      externalId: row.external_id,
      name: row.name,
      status: row.status,
      type: row.type,
      dailyBudget: parseFloat(row.daily_budget),
      responsible: row.responsible,
      executor: row.executor,
      kpi: row.kpi,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  },

  // Campaign Stats
  async insertCampaignStats(stats: Omit<CampaignStats, 'id'>[]): Promise<void> {
    if (stats.length === 0) return;

    // 1. Определяем диапазон дат и connection_id для удаления дубликатов
    const connectionId = stats[0].connectionId;
    const dates = stats.map(s => s.date);
    const minDate = dates.sort()[0];
    const maxDate = dates.sort().reverse()[0];

    console.log(`[ClickHouse] Deleting existing campaign stats for ${connectionId} from ${minDate} to ${maxDate}`);

    // 2. УДАЛЯЕМ старые данные перед вставкой новых (предотвращение дубликатов)
    try {
      await client.command({
        query: `
          ALTER TABLE campaign_stats
          DELETE WHERE connection_id = {connectionId:String}
            AND date >= {minDate:Date}
            AND date <= {maxDate:Date}
        `,
        query_params: { connectionId, minDate, maxDate },
      });
      console.log(`[ClickHouse] Deleted old campaign stats`);
    } catch (error) {
      console.error(`[ClickHouse] Failed to delete old stats, continuing with insert:`, error);
    }

    // 3. Вставляем свежие данные
    console.log(`[ClickHouse] Inserting ${stats.length} campaign stats records`);

    const values = stats.map(s => ({
      id: uuidv4(),
      campaign_id: s.campaignId,
      campaign_external_id: s.campaignExternalId,
      connection_id: s.connectionId,
      date: s.date, // Already a string in YYYY-MM-DD format
      impressions: s.impressions,
      clicks: s.clicks,
      cost: s.cost,
      ctr: s.ctr,
      avg_cpc: s.avgCpc,
      avg_cpm: s.avgCpm,
      conversions: s.conversions,
      conversion_rate: s.conversionRate,
      cost_per_conversion: s.costPerConversion,
      qualified_leads: s.qualifiedLeads,
      cost_per_qualified_lead: s.costPerQualifiedLead,
      revenue: s.revenue,
      roi: s.roi,
      created_at: formatDate(new Date()),
    }));

    await client.insert({
      table: 'campaign_stats',
      values,
      format: 'JSONEachRow',
    });
  },

  async getCampaignStats(campaignId: string, startDate: Date, endDate: Date): Promise<CampaignStats[]> {
    const result = await client.query({
      query: `
        SELECT * FROM campaign_stats
        WHERE campaign_id = {campaignId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
        ORDER BY date DESC
      `,
      query_params: {
        campaignId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map((row: any) => ({
      id: row.id,
      campaignId: row.campaign_id,
      campaignExternalId: row.campaign_external_id,
      connectionId: row.connection_id,
      date: new Date(row.date),
      impressions: parseInt(row.impressions),
      clicks: parseInt(row.clicks),
      cost: parseFloat(row.cost),
      ctr: parseFloat(row.ctr),
      avgCpc: parseFloat(row.avg_cpc),
      avgCpm: parseFloat(row.avg_cpm),
      conversions: parseInt(row.conversions),
      conversionRate: parseFloat(row.conversion_rate),
      costPerConversion: parseFloat(row.cost_per_conversion),
      qualifiedLeads: parseInt(row.qualified_leads),
      costPerQualifiedLead: parseFloat(row.cost_per_qualified_lead),
      revenue: parseFloat(row.revenue),
      roi: parseFloat(row.roi),
    }));
  },

  async getAggregatedStats(connectionId: string, startDate: Date, endDate: Date) {
    const result = await client.query({
      query: `
        SELECT
          campaign_id,
          sum(impressions) as total_impressions,
          sum(clicks) as total_clicks,
          sum(cost) as total_cost,
          sum(conversions) as total_conversions,
          sum(qualified_leads) as total_qualified_leads,
          sum(revenue) as total_revenue,
          avg(ctr) as avg_ctr,
          avg(avg_cpc) as avg_cpc,
          avg(conversion_rate) as avg_conversion_rate,
          (sum(revenue) - sum(cost)) / sum(cost) * 100 as roi
        FROM campaign_stats
        WHERE connection_id = {connectionId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
        GROUP BY campaign_id
      `,
      query_params: {
        connectionId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map((row: any) => ({
      campaignId: row.campaign_id,
      totalImpressions: parseInt(row.total_impressions),
      totalClicks: parseInt(row.total_clicks),
      totalCost: parseFloat(row.total_cost),
      totalConversions: parseInt(row.total_conversions),
      totalQualifiedLeads: parseInt(row.total_qualified_leads),
      totalRevenue: parseFloat(row.total_revenue),
      avgCtr: parseFloat(row.avg_ctr),
      avgCpc: parseFloat(row.avg_cpc),
      avgConversionRate: parseFloat(row.avg_conversion_rate),
      roi: parseFloat(row.roi),
    }));
  },

  // AI Recommendations
  async createRecommendation(rec: Omit<AIRecommendation, 'id' | 'createdAt'>): Promise<string> {
    const id = uuidv4();
    const now = formatDate(new Date());

    await client.insert({
      table: 'ai_recommendations',
      values: [{
        id,
        campaign_id: rec.campaignId,
        type: rec.type,
        category: rec.category,
        title: rec.title,
        description: rec.description,
        action_text: rec.actionText,
        is_applied: rec.isApplied ? 1 : 0,
        is_dismissed: rec.isDismissed ? 1 : 0,
        created_at: now,
      }],
      format: 'JSONEachRow',
    });

    return id;
  },

  async getRecommendationsByCampaignId(campaignId: string): Promise<AIRecommendation[]> {
    const result = await client.query({
      query: `
        SELECT * FROM ai_recommendations
        WHERE campaign_id = {campaignId:String}
          AND is_dismissed = 0
        ORDER BY created_at DESC
        LIMIT 10
      `,
      query_params: { campaignId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map((row: any) => ({
      id: row.id,
      campaignId: row.campaign_id,
      type: row.type,
      category: row.category,
      title: row.title,
      description: row.description,
      actionText: row.action_text,
      isApplied: row.is_applied === 1,
      isDismissed: row.is_dismissed === 1,
      createdAt: new Date(row.created_at),
    }));
  },

  async dismissRecommendation(recommendationId: string): Promise<void> {
    await client.insert({
      table: 'ai_recommendations',
      values: [{
        id: recommendationId,
        is_dismissed: 1,
        created_at: formatDate(new Date()),
      }],
      format: 'JSONEachRow',
    });
  },

  // Campaign Performance (новая детальная статистика)
  async insertCampaignPerformance(records: CampaignPerformance[]): Promise<void> {
    if (records.length === 0) return;

    // 1. Определяем диапазон дат и connection_id для удаления дубликатов
    const connectionId = records[0].connectionId;
    const dates = records.map(r => r.date);
    const minDate = dates.sort()[0];
    const maxDate = dates.sort().reverse()[0];

    console.log(`[ClickHouse] Deleting existing performance data for ${connectionId} from ${minDate} to ${maxDate}`);

    // 2. УДАЛЯЕМ старые данные перед вставкой новых (предотвращение дубликатов)
    try {
      await client.command({
        query: `
          ALTER TABLE campaign_performance
          DELETE WHERE connection_id = {connectionId:String}
            AND date >= {minDate:Date}
            AND date <= {maxDate:Date}
        `,
        query_params: {
          connectionId,
          minDate,
          maxDate,
        },
      });
      console.log(`[ClickHouse] Deleted old performance data`);
    } catch (error) {
      console.error(`[ClickHouse] Failed to delete old data, continuing with insert:`, error);
    }

    console.log(`[ClickHouse] Inserting ${records.length} campaign performance records`);

    const values = records.map(r => ({
      id: r.id || uuidv4(),
      connection_id: r.connectionId,
      account_name: r.accountName,
      campaign_id: r.campaignId,
      campaign_name: r.campaignName,
      campaign_type: r.campaignType,
      ad_group_id: r.adGroupId || null,
      ad_group_name: r.adGroupName || null,
      ad_id: r.adId || null,
      date: r.date,

      // Метрики
      impressions: r.impressions,
      clicks: r.clicks,
      cost: r.cost,
      ctr: r.ctr,
      avg_cpc: r.avgCpc,
      avg_cpm: r.avgCpm,
      bounce_rate: r.bounceRate || 0,
      avg_click_position: r.avgClickPosition || null,
      avg_impression_position: r.avgImpressionPosition || null,

      // Измерения
      device: r.device || null,
      age: r.age || null,
      gender: r.gender || null,
      income_grade: r.incomeGrade || null,
      targeting_location_id: r.targetingLocationId || null,
      targeting_location_name: r.targetingLocationName || null,
      targeting_category: r.targetingCategory || null,
      ad_network_type: r.adNetworkType || null,
      placement: r.placement || null,
      slot: r.slot || null,
      criterion: r.criterion || null,
      criterion_type: r.criterionType || null,
      match_type: r.matchType || null,
      mobile_platform: r.mobilePlatform || null,
      carrier_type: r.carrierType || null,

      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    }));

    console.log(`[ClickHouse] Sample performance record:`, JSON.stringify(values[0], null, 2));

    await client.insert({
      table: 'campaign_performance',
      values,
      format: 'JSONEachRow',
    });

    console.log(`[ClickHouse] Successfully inserted ${records.length} performance records`);
  },

  // Campaign Conversions (новая таблица конверсий)
  async insertCampaignConversions(conversions: CampaignConversion[]): Promise<void> {
    if (conversions.length === 0) return;

    // 1. Определяем диапазон дат и connection_id для удаления дубликатов
    const connectionId = conversions[0].connectionId;
    const dates = conversions.map(c => c.date);
    const minDate = dates.sort()[0];
    const maxDate = dates.sort().reverse()[0];

    console.log(`[ClickHouse] Deleting existing conversion data for ${connectionId} from ${minDate} to ${maxDate}`);

    // 2. УДАЛЯЕМ старые данные перед вставкой новых (предотвращение дубликатов)
    try {
      await client.command({
        query: `
          ALTER TABLE campaign_conversions
          DELETE WHERE connection_id = {connectionId:String}
            AND date >= {minDate:Date}
            AND date <= {maxDate:Date}
        `,
        query_params: {
          connectionId,
          minDate,
          maxDate,
        },
      });
      console.log(`[ClickHouse] Deleted old conversion data`);
    } catch (error) {
      console.error(`[ClickHouse] Failed to delete old conversions, continuing with insert:`, error);
    }

    console.log(`[ClickHouse] Inserting ${conversions.length} conversion records`);

    const values = conversions.map(c => ({
      id: c.id || uuidv4(),
      connection_id: c.connectionId,
      campaign_id: c.campaignId,
      ad_group_id: c.adGroupId || null,
      ad_id: c.adId || null,
      date: c.date,
      goal_id: c.goalId,
      goal_name: c.goalName || null,
      attribution_model: c.attributionModel,
      conversions: c.conversions,
      revenue: c.revenue,
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    }));

    console.log(`[ClickHouse] Sample conversion record:`, JSON.stringify(values[0], null, 2));

    await client.insert({
      table: 'campaign_conversions',
      values,
      format: 'JSONEachRow',
    });

    console.log(`[ClickHouse] Successfully inserted ${conversions.length} conversion records`);
  },

  // Получить агрегированную статистику по кампаниям с конверсиями
  async getDetailedCampaignStats(connectionId: string, startDate: Date, endDate: Date, goalIds?: string[]) {
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Базовая статистика из campaign_performance
    const performanceQuery = `
      SELECT
        campaign_id,
        campaign_name,
        sum(impressions) as total_impressions,
        sum(clicks) as total_clicks,
        sum(cost) as total_cost,
        avg(ctr) as avg_ctr,
        avg(avg_cpc) as avg_cpc,
        avg(bounce_rate) as avg_bounce_rate
      FROM campaign_performance
      WHERE connection_id = {connectionId:String}
        AND date >= {startDate:Date}
        AND date <= {endDate:Date}
      GROUP BY campaign_id, campaign_name
    `;

    // Конверсии с опциональным фильтром по целям (поддержка массива)
    let conversionQuery: string;
    let conversionParams: Record<string, any>;

    if (goalIds && goalIds.length > 0) {
      // Фильтр по выбранным целям (IN clause)
      const goalIdsString = goalIds.map(id => `'${id}'`).join(',');
      conversionQuery = `
        SELECT
          campaign_id,
          sum(conversions) as total_conversions,
          sum(revenue) as total_revenue
        FROM campaign_conversions
        WHERE connection_id = {connectionId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
          AND goal_id IN (${goalIdsString})
        GROUP BY campaign_id
      `;
      conversionParams = { connectionId, startDate: dateFrom, endDate: dateTo };
    } else {
      // Без фильтра - все цели
      conversionQuery = `
        SELECT
          campaign_id,
          sum(conversions) as total_conversions,
          sum(revenue) as total_revenue
        FROM campaign_conversions
        WHERE connection_id = {connectionId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
        GROUP BY campaign_id
      `;
      conversionParams = { connectionId, startDate: dateFrom, endDate: dateTo };
    }

    const [performanceResult, conversionResult] = await Promise.all([
      client.query({
        query: performanceQuery,
        query_params: { connectionId, startDate: dateFrom, endDate: dateTo },
        format: 'JSONEachRow',
      }),
      client.query({
        query: conversionQuery,
        query_params: conversionParams,
        format: 'JSONEachRow',
      }),
    ]);

    const performanceRows = await performanceResult.json<any>();
    const conversionRows = await conversionResult.json<any>();

    // Создаем карту конверсий по campaign_id
    const conversionsMap = new Map(
      conversionRows.map((row: any) => [
        row.campaign_id,
        {
          totalConversions: parseInt(row.total_conversions) || 0,
          totalRevenue: parseFloat(row.total_revenue) || 0,
        },
      ])
    );

    // Объединяем данные
    return performanceRows.map((row: any) => {
      const conversions = conversionsMap.get(row.campaign_id) || {
        totalConversions: 0,
        totalRevenue: 0,
      };
      const totalCost = parseFloat(row.total_cost);
      const totalConversions = conversions.totalConversions;
      const totalRevenue = conversions.totalRevenue;

      return {
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        totalImpressions: parseInt(row.total_impressions),
        totalClicks: parseInt(row.total_clicks),
        totalCost,
        avgCtr: parseFloat(row.avg_ctr),
        avgCpc: parseFloat(row.avg_cpc),
        avgBounceRate: parseFloat(row.avg_bounce_rate) || 0,
        totalConversions,
        totalRevenue,
        conversionRate: totalConversions > 0 && parseInt(row.total_clicks) > 0
          ? (totalConversions / parseInt(row.total_clicks)) * 100
          : 0,
        costPerConversion: totalConversions > 0 ? totalCost / totalConversions : 0,
        roi: totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0,
      };
    });
  },

  // Получить список целей для селектора
  async getAvailableGoals(connectionId: string): Promise<{ goalId: string; goalName?: string }[]> {
    // Сначала получаем цели из настроек подключения
    console.log('[getAvailableGoals] Getting connection:', connectionId);
    const connection = await this.getConnectionById(connectionId);
    console.log('[getAvailableGoals] Connection:', connection?.id, 'conversionGoals:', connection?.conversionGoals);

    if (!connection || !connection.conversionGoals) {
      console.log('[getAvailableGoals] No connection or no goals');
      return [];
    }

    let goalIds: string[] = [];
    try {
      console.log('[getAvailableGoals] Parsing:', connection.conversionGoals, 'type:', typeof connection.conversionGoals);
      goalIds = JSON.parse(connection.conversionGoals);
      console.log('[getAvailableGoals] Parsed goalIds:', goalIds);
    } catch (e) {
      console.error('[getAvailableGoals] Failed to parse conversion goals:', e);
      return [];
    }

    // Возвращаем список целей (в будущем можно добавить названия из Метрики)
    const result = goalIds.map(goalId => ({
      goalId,
      goalName: undefined, // TODO: можно добавить названия целей из Яндекс.Метрики
    }));
    console.log('[getAvailableGoals] Returning:', result);
    return result;
  },

  // Удалить подключение
  async deleteConnection(connectionId: string): Promise<void> {
    console.log('[deleteConnection] Deleting connection:', connectionId);

    // Удаляем связанные данные
    await client.command({
      query: 'DELETE FROM campaign_performance WHERE connection_id = {connectionId:String}',
      query_params: { connectionId },
    });

    await client.command({
      query: 'DELETE FROM campaign_conversions WHERE connection_id = {connectionId:String}',
      query_params: { connectionId },
    });

    await client.command({
      query: 'DELETE FROM search_queries WHERE connection_id = {connectionId:String}',
      query_params: { connectionId },
    });

    await client.command({
      query: 'DELETE FROM ad_contents WHERE connection_id = {connectionId:String}',
      query_params: { connectionId },
    });

    // Удаляем само подключение
    await client.command({
      query: 'DELETE FROM yandex_direct_connections WHERE id = {connectionId:String}',
      query_params: { connectionId },
    });

    console.log('[deleteConnection] Connection deleted successfully');
  },

  // Обновить подключение
  async updateConnection(connectionId: string, updates: {
    accessToken?: string;
    refreshToken?: string;
    conversionGoals?: string;
    metrikaCounterId?: string;
    metrikaToken?: string;
  }): Promise<void> {
    console.log('[updateConnection] Updating connection:', connectionId);

    // Получаем текущие данные
    const existing = await this.getConnectionById(connectionId);
    if (!existing) {
      throw new Error('Connection not found');
    }

    // В ReplacingMergeTree вставляем новую версию записи
    await client.insert({
      table: 'yandex_direct_connections',
      values: [{
        id: connectionId,
        user_id: existing.userId,
        project_id: existing.projectId,
        login: existing.login,
        access_token: updates.accessToken || existing.accessToken,
        refresh_token: updates.refreshToken || existing.refreshToken,
        metrika_counter_id: updates.metrikaCounterId !== undefined ? updates.metrikaCounterId : existing.metrikaCounterId,
        metrika_token: updates.metrikaToken !== undefined ? updates.metrikaToken : existing.metrikaToken,
        conversion_goals: updates.conversionGoals !== undefined ? updates.conversionGoals : existing.conversionGoals,
        status: existing.status,
        last_sync_at: formatDate(existing.lastSyncAt),
        created_at: formatDate(new Date()),
      }],
      format: 'JSONEachRow',
    });

    console.log('[updateConnection] Connection updated successfully');
  },

  // Получить доступные цели для подключения
  async getAvailableGoalsForConnection(connectionId: string): Promise<Array<{ id: number; name: string }>> {
    const result = await client.query({
      query: `
        SELECT DISTINCT
          goal_id as id,
          goal_name as name
        FROM campaign_conversions FINAL
        WHERE connection_id = {connectionId:String}
        AND goal_id > 0
        ORDER BY name
      `,
      query_params: { connectionId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map((row: any) => ({
      id: parseInt(row.id),
      name: row.name || `Цель ${row.id}`,
    }));
  },

  // Вставка статистики по группам объявлений
  async insertAdGroupPerformance(records: any[]): Promise<void> {
    if (records.length === 0) return;

    const values = records.map((r) => ({
      id: r.id,
      connection_id: r.connectionId,
      campaign_id: r.campaignId,
      campaign_name: r.campaignName,
      ad_group_id: r.adGroupId,
      ad_group_name: r.adGroupName,
      date: r.date,
      impressions: r.impressions,
      clicks: r.clicks,
      cost: r.cost,
      ctr: r.ctr,
      avg_cpc: r.avgCpc,
      bounce_rate: r.bounceRate,
      conversions: r.conversions || 0,
      revenue: r.revenue || 0,
    }));

    await client.insert({
      table: 'ad_group_performance',
      values,
      format: 'JSONEachRow',
    });

    console.log(`[ClickHouse] Inserted ${records.length} ad group performance records`);
  },

  // Вставка статистики по объявлениям
  async insertAdPerformance(records: any[]): Promise<void> {
    if (records.length === 0) return;

    const values = records.map((r) => ({
      id: r.id,
      connection_id: r.connectionId,
      campaign_id: r.campaignId,
      campaign_name: r.campaignName,
      ad_group_id: r.adGroupId,
      ad_group_name: r.adGroupName,
      ad_id: r.adId,
      date: r.date,
      impressions: r.impressions,
      clicks: r.clicks,
      cost: r.cost,
      ctr: r.ctr,
      avg_cpc: r.avgCpc,
      bounce_rate: r.bounceRate,
      conversions: r.conversions || 0,
      revenue: r.revenue || 0,
    }));

    await client.insert({
      table: 'ad_performance',
      values,
      format: 'JSONEachRow',
    });

    console.log(`[ClickHouse] Inserted ${records.length} ad performance records`);
  },

  // Вставка/обновление содержимого объявлений (заголовки)
  async upsertAdContents(records: Array<{
    connectionId: string;
    accountName: string;
    adId: string;
    adGroupId?: string;
    campaignId?: string;
    title?: string;
    title2?: string;
    text?: string;
  }>): Promise<void> {
    if (records.length === 0) return;

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const values = records.map((r) => ({
      id: `${r.connectionId}_${r.adId}`,
      connection_id: r.connectionId,
      account_name: r.accountName,
      ad_id: r.adId,
      ad_group_id: r.adGroupId || '',
      campaign_id: r.campaignId || '',
      title: r.title || null,
      title2: r.title2 || null,
      text: r.text || null,
      updated_at: now,
    }));

    await client.insert({
      table: 'ad_contents',
      values,
      format: 'JSONEachRow',
    });

    console.log(`[ClickHouse] Upserted ${records.length} ad content records`);
  },

  // Вставка конверсий по группам с разбивкой по целям
  async insertAdGroupConversions(records: any[]): Promise<void> {
    if (records.length === 0) return;

    const values = records.map((r) => ({
      id: r.id,
      connection_id: r.connectionId,
      campaign_id: r.campaignId,
      ad_group_id: r.adGroupId,
      date: r.date,
      goal_id: r.goalId,
      conversions: r.conversions || 0,
      revenue: r.revenue || 0,
    }));

    await client.insert({
      table: 'ad_group_conversions',
      values,
      format: 'JSONEachRow',
    });

    console.log(`[ClickHouse] Inserted ${records.length} ad group conversion records`);
  },

  // Вставка конверсий по объявлениям с разбивкой по целям
  async insertAdConversions(records: any[]): Promise<void> {
    if (records.length === 0) return;

    const values = records.map((r) => ({
      id: r.id,
      connection_id: r.connectionId,
      campaign_id: r.campaignId,
      ad_group_id: r.adGroupId,
      ad_id: r.adId,
      date: r.date,
      goal_id: r.goalId,
      conversions: r.conversions || 0,
      revenue: r.revenue || 0,
    }));

    await client.insert({
      table: 'ad_conversions',
      values,
      format: 'JSONEachRow',
    });

    console.log(`[ClickHouse] Inserted ${records.length} ad conversion records`);
  },

  // Получить заголовки объявлений
  async getAdTitlesFromDb(connectionId: string, adIds: string[]): Promise<Map<string, { title: string; title2?: string }>> {
    if (adIds.length === 0) return new Map();

    const adIdsStr = adIds.map(id => `'${id}'`).join(',');
    const query = `
      SELECT ad_id, title, title2
      FROM ad_contents
      WHERE connection_id = {connectionId:String}
        AND ad_id IN (${adIdsStr})
    `;

    const result = await client.query({
      query,
      query_params: { connectionId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    const map = new Map<string, { title: string; title2?: string }>();
    rows.forEach((row: any) => {
      map.set(row.ad_id, {
        title: row.title || '',
        title2: row.title2 || undefined,
      });
    });

    return map;
  },

  // Получить иерархическую статистику: кампании -> группы -> объявления
  async getHierarchicalStats(connectionId: string, startDate: Date, endDate: Date, goalIds?: string[]) {
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Определяем фильтр по целям
    const hasGoalFilter = goalIds && goalIds.length > 0;
    const goalIdsString = hasGoalFilter ? goalIds!.map(id => `'${id}'`).join(',') : '';

    // Статистика по кампаниям
    const campaignQuery = `
      SELECT
        campaign_id,
        campaign_name,
        sum(impressions) as total_impressions,
        sum(clicks) as total_clicks,
        sum(cost) as total_cost,
        avg(ctr) as avg_ctr,
        avg(avg_cpc) as avg_cpc,
        avg(bounce_rate) as avg_bounce_rate
      FROM campaign_performance
      WHERE connection_id = {connectionId:String}
        AND date >= {startDate:Date}
        AND date <= {endDate:Date}
      GROUP BY campaign_id, campaign_name
      ORDER BY total_cost DESC
    `;

    // Статистика по группам (без конверсий - они берутся отдельно)
    const adGroupQuery = `
      SELECT
        campaign_id,
        ad_group_id,
        ad_group_name,
        sum(impressions) as total_impressions,
        sum(clicks) as total_clicks,
        sum(cost) as total_cost,
        avg(ctr) as avg_ctr,
        avg(avg_cpc) as avg_cpc,
        avg(bounce_rate) as avg_bounce_rate
      FROM ad_group_performance
      WHERE connection_id = {connectionId:String}
        AND date >= {startDate:Date}
        AND date <= {endDate:Date}
      GROUP BY campaign_id, ad_group_id, ad_group_name
      ORDER BY total_cost DESC
    `;

    // Статистика по объявлениям (без конверсий - они берутся отдельно)
    const adQuery = `
      SELECT
        campaign_id,
        ad_group_id,
        ad_id,
        sum(impressions) as total_impressions,
        sum(clicks) as total_clicks,
        sum(cost) as total_cost,
        avg(ctr) as avg_ctr,
        avg(avg_cpc) as avg_cpc,
        avg(bounce_rate) as avg_bounce_rate
      FROM ad_performance
      WHERE connection_id = {connectionId:String}
        AND date >= {startDate:Date}
        AND date <= {endDate:Date}
      GROUP BY campaign_id, ad_group_id, ad_id
      ORDER BY total_cost DESC
    `;

    // Конверсии по группам объявлений (с фильтрацией по целям если указаны)
    const adGroupConvQuery = hasGoalFilter ? `
      SELECT
        campaign_id,
        ad_group_id,
        sum(conversions) as total_conversions,
        sum(revenue) as total_revenue
      FROM ad_group_conversions
      WHERE connection_id = {connectionId:String}
        AND date >= {startDate:Date}
        AND date <= {endDate:Date}
        AND goal_id IN (${goalIdsString})
      GROUP BY campaign_id, ad_group_id
    ` : `
      SELECT
        campaign_id,
        ad_group_id,
        sum(conversions) as total_conversions,
        sum(revenue) as total_revenue
      FROM ad_group_performance
      WHERE connection_id = {connectionId:String}
        AND date >= {startDate:Date}
        AND date <= {endDate:Date}
      GROUP BY campaign_id, ad_group_id
    `;

    // Конверсии по объявлениям (с фильтрацией по целям если указаны)
    const adConvQuery = hasGoalFilter ? `
      SELECT
        campaign_id,
        ad_group_id,
        ad_id,
        sum(conversions) as total_conversions,
        sum(revenue) as total_revenue
      FROM ad_conversions
      WHERE connection_id = {connectionId:String}
        AND date >= {startDate:Date}
        AND date <= {endDate:Date}
        AND goal_id IN (${goalIdsString})
      GROUP BY campaign_id, ad_group_id, ad_id
    ` : `
      SELECT
        campaign_id,
        ad_group_id,
        ad_id,
        sum(conversions) as total_conversions,
        sum(revenue) as total_revenue
      FROM ad_performance
      WHERE connection_id = {connectionId:String}
        AND date >= {startDate:Date}
        AND date <= {endDate:Date}
      GROUP BY campaign_id, ad_group_id, ad_id
    `;

    const [campaignResult, adGroupResult, adResult, adGroupConvResult, adConvResult] = await Promise.all([
      client.query({ query: campaignQuery, query_params: { connectionId, startDate: dateFrom, endDate: dateTo }, format: 'JSONEachRow' }),
      client.query({ query: adGroupQuery, query_params: { connectionId, startDate: dateFrom, endDate: dateTo }, format: 'JSONEachRow' }),
      client.query({ query: adQuery, query_params: { connectionId, startDate: dateFrom, endDate: dateTo }, format: 'JSONEachRow' }),
      client.query({ query: adGroupConvQuery, query_params: { connectionId, startDate: dateFrom, endDate: dateTo }, format: 'JSONEachRow' }),
      client.query({ query: adConvQuery, query_params: { connectionId, startDate: dateFrom, endDate: dateTo }, format: 'JSONEachRow' }),
    ]);

    const campaigns = await campaignResult.json<any>();
    const adGroups = await adGroupResult.json<any>();
    const ads = await adResult.json<any>();
    const adGroupConversions = await adGroupConvResult.json<any>();
    const adConversions = await adConvResult.json<any>();

    // Создаём карту конверсий по группам: campaign_id_ad_group_id -> { conversions, revenue }
    const adGroupConvMap = new Map<string, { conversions: number; revenue: number }>();
    adGroupConversions.forEach((c: any) => {
      const key = `${c.campaign_id}_${c.ad_group_id}`;
      adGroupConvMap.set(key, {
        conversions: parseInt(c.total_conversions) || 0,
        revenue: parseFloat(c.total_revenue) || 0,
      });
    });

    // Создаём карту конверсий по объявлениям: campaign_id_ad_group_id_ad_id -> { conversions, revenue }
    const adConvMap = new Map<string, { conversions: number; revenue: number }>();
    adConversions.forEach((c: any) => {
      const key = `${c.campaign_id}_${c.ad_group_id}_${c.ad_id}`;
      adConvMap.set(key, {
        conversions: parseInt(c.total_conversions) || 0,
        revenue: parseFloat(c.total_revenue) || 0,
      });
    });

    // Получаем заголовки объявлений из таблицы ad_contents
    const adIds = ads.map((ad: any) => ad.ad_id);
    const adTitlesMap = await this.getAdTitlesFromDb(connectionId, adIds);

    // Группируем объявления по группам - используем данные с учётом фильтра по целям
    const adsMap = new Map<string, any[]>();
    ads.forEach((ad: any) => {
      const groupKey = `${ad.campaign_id}_${ad.ad_group_id}`;
      const adKey = `${ad.campaign_id}_${ad.ad_group_id}_${ad.ad_id}`;
      if (!adsMap.has(groupKey)) adsMap.set(groupKey, []);
      const adTitles = adTitlesMap.get(ad.ad_id);

      // Берём конверсии из карты конверсий (отфильтрованы по целям если указаны)
      const adConv = adConvMap.get(adKey) || { conversions: 0, revenue: 0 };

      adsMap.get(groupKey)!.push({
        adId: ad.ad_id,
        adTitle: adTitles?.title || null,
        adTitle2: adTitles?.title2 || null,
        totalImpressions: parseInt(ad.total_impressions) || 0,
        totalClicks: parseInt(ad.total_clicks) || 0,
        totalCost: parseFloat(ad.total_cost) || 0,
        avgCtr: parseFloat(ad.avg_ctr) || 0,
        avgCpc: parseFloat(ad.avg_cpc) || 0,
        avgBounceRate: parseFloat(ad.avg_bounce_rate) || 0,
        totalConversions: adConv.conversions,
        totalRevenue: adConv.revenue,
      });
    });

    // Группируем группы по кампаниям - используем данные с учётом фильтра по целям
    const adGroupsMap = new Map<string, any[]>();
    adGroups.forEach((ag: any) => {
      const campaignId = ag.campaign_id;
      if (!adGroupsMap.has(campaignId)) adGroupsMap.set(campaignId, []);

      const adGroupKey = `${ag.campaign_id}_${ag.ad_group_id}`;
      const groupAds = adsMap.get(adGroupKey) || [];

      // Берём конверсии из карты конверсий по группам (отфильтрованы по целям если указаны)
      const groupConv = adGroupConvMap.get(adGroupKey) || { conversions: 0, revenue: 0 };

      adGroupsMap.get(campaignId)!.push({
        adGroupId: ag.ad_group_id,
        adGroupName: ag.ad_group_name,
        totalImpressions: parseInt(ag.total_impressions) || 0,
        totalClicks: parseInt(ag.total_clicks) || 0,
        totalCost: parseFloat(ag.total_cost) || 0,
        avgCtr: parseFloat(ag.avg_ctr) || 0,
        avgCpc: parseFloat(ag.avg_cpc) || 0,
        avgBounceRate: parseFloat(ag.avg_bounce_rate) || 0,
        totalConversions: groupConv.conversions,
        totalRevenue: groupConv.revenue,
        ads: groupAds,
      });
    });

    // Формируем итоговую структуру
    // Конверсии кампании = сумма конверсий её групп (для точного совпадения данных)
    return campaigns.map((c: any) => {
      const campaignAdGroups = adGroupsMap.get(c.campaign_id) || [];

      // Суммируем конверсии из групп для точного соответствия
      const campaignConversions = campaignAdGroups.reduce((sum: number, ag: any) => sum + (ag.totalConversions || 0), 0);
      const campaignRevenue = campaignAdGroups.reduce((sum: number, ag: any) => sum + (ag.totalRevenue || 0), 0);

      return {
        campaignId: c.campaign_id,
        campaignName: c.campaign_name,
        totalImpressions: parseInt(c.total_impressions) || 0,
        totalClicks: parseInt(c.total_clicks) || 0,
        totalCost: parseFloat(c.total_cost) || 0,
        avgCtr: parseFloat(c.avg_ctr) || 0,
        avgCpc: parseFloat(c.avg_cpc) || 0,
        avgBounceRate: parseFloat(c.avg_bounce_rate) || 0,
        totalConversions: campaignConversions,
        totalRevenue: campaignRevenue,
        adGroups: campaignAdGroups,
      };
    });
  },
};
