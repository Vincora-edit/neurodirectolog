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

  // Generic query method for custom queries with optional parameterized queries
  async query(sql: string, params?: Record<string, string | number>): Promise<any[]> {
    const result = await client.query({
      query: sql,
      format: 'JSONEachRow',
      query_params: params,
    });
    return await result.json();
  },

  // Execute DDL/DML statements (INSERT, ALTER, etc.) that don't return data
  async exec(sql: string): Promise<void> {
    await client.command({ query: sql });
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

  // Batch method to get connection counts grouped by project
  async getConnectionCountsByProjectIds(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();

    const result = await client.query({
      query: `
        SELECT project_id, count() as cnt
        FROM yandex_direct_connections FINAL
        WHERE project_id IN ({projectIds:Array(String)})
        AND status = 'active'
        GROUP BY project_id
      `,
      query_params: { projectIds },
      format: 'JSONEachRow',
    });
    const rows = await result.json() as { project_id: string; cnt: string }[];
    const map = new Map<string, number>();
    rows.forEach(row => map.set(row.project_id, parseInt(row.cnt) || 0));
    return map;
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

  // Получить статистику по дням для графиков и таблицы
  // Поддерживает фильтрацию по кампании, группе, объявлению
  async getDailyStats(
    connectionId: string,
    startDate: Date,
    endDate: Date,
    goalIds?: string[],
    campaignId?: string,
    adGroupId?: string,
    adId?: string
  ) {
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Определяем какую таблицу использовать в зависимости от уровня фильтрации
    // ВАЖНО: Для конверсий всегда используем campaign_conversions, т.к. таблицы
    // ad_group_conversions и ad_conversions не существуют. campaign_conversions
    // содержит колонки ad_group_id и ad_id для фильтрации.
    let performanceTable: string;
    const conversionsTable = 'campaign_conversions'; // Всегда используем эту таблицу
    let additionalFilters = '';
    let conversionsFilters = '';
    const queryParams: Record<string, any> = {
      connectionId,
      startDate: dateFrom,
      endDate: dateTo,
    };

    if (adId && adGroupId && campaignId) {
      // Фильтр по объявлению
      performanceTable = 'ad_performance';
      additionalFilters = `
        AND campaign_id = {campaignId:String}
        AND ad_group_id = {adGroupId:String}
        AND ad_id = {adId:String}
      `;
      conversionsFilters = `
        AND campaign_id = {campaignId:String}
        AND ad_group_id = {adGroupId:String}
        AND ad_id = {adId:String}
      `;
      queryParams.campaignId = campaignId;
      queryParams.adGroupId = adGroupId;
      queryParams.adId = adId;
    } else if (adGroupId && campaignId) {
      // Фильтр по группе
      performanceTable = 'ad_group_performance';
      additionalFilters = `
        AND campaign_id = {campaignId:String}
        AND ad_group_id = {adGroupId:String}
      `;
      conversionsFilters = `
        AND campaign_id = {campaignId:String}
        AND ad_group_id = {adGroupId:String}
      `;
      queryParams.campaignId = campaignId;
      queryParams.adGroupId = adGroupId;
    } else if (campaignId) {
      // Фильтр по кампании
      performanceTable = 'campaign_performance';
      additionalFilters = `
        AND campaign_id = {campaignId:String}
      `;
      conversionsFilters = `
        AND campaign_id = {campaignId:String}
      `;
      queryParams.campaignId = campaignId;
    } else {
      // Без фильтра - агрегация по всем кампаниям
      performanceTable = 'campaign_performance';
    }

    // Базовая статистика по дням
    const performanceQuery = `
      SELECT
        date,
        sum(impressions) as total_impressions,
        sum(clicks) as total_clicks,
        sum(cost) as total_cost,
        avg(ctr) as avg_ctr,
        avg(avg_cpc) as avg_cpc,
        avg(bounce_rate) as avg_bounce_rate
      FROM ${performanceTable}
      WHERE connection_id = {connectionId:String}
        AND date >= {startDate:Date}
        AND date <= {endDate:Date}
        ${additionalFilters}
      GROUP BY date
      ORDER BY date ASC
    `;

    const performanceResult = await client.query({
      query: performanceQuery,
      query_params: queryParams,
      format: 'JSONEachRow',
    });
    const performanceRows = await performanceResult.json<any>();

    // Конверсии по дням с опциональным фильтром по целям
    let conversionQuery: string;
    const conversionParams = { ...queryParams };

    if (goalIds && goalIds.length > 0) {
      conversionParams.goalIds = goalIds;
      conversionQuery = `
        SELECT
          date,
          sum(conversions) as total_conversions,
          sum(revenue) as total_revenue
        FROM ${conversionsTable}
        WHERE connection_id = {connectionId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
          AND goal_id IN ({goalIds:Array(String)})
          ${conversionsFilters}
        GROUP BY date
        ORDER BY date ASC
      `;
    } else {
      conversionQuery = `
        SELECT
          date,
          sum(conversions) as total_conversions,
          sum(revenue) as total_revenue
        FROM ${conversionsTable}
        WHERE connection_id = {connectionId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
          ${conversionsFilters}
        GROUP BY date
        ORDER BY date ASC
      `;
    }

    const conversionResult = await client.query({
      query: conversionQuery,
      query_params: conversionParams,
      format: 'JSONEachRow',
    });
    const conversionRows = await conversionResult.json<any>();

    // Создаём карту конверсий по датам
    const conversionMap = new Map<string, { conversions: number; revenue: number }>();
    conversionRows.forEach((row: any) => {
      conversionMap.set(row.date, {
        conversions: parseInt(row.total_conversions) || 0,
        revenue: parseFloat(row.total_revenue) || 0,
      });
    });

    // Объединяем данные
    return performanceRows.map((row: any) => {
      const conv = conversionMap.get(row.date) || { conversions: 0, revenue: 0 };
      const cost = parseFloat(row.total_cost) || 0;
      const conversions = conv.conversions;
      const cpl = conversions > 0 ? cost / conversions : 0;
      const cr = parseInt(row.total_clicks) > 0 ? (conversions / parseInt(row.total_clicks)) * 100 : 0;

      return {
        date: row.date,
        impressions: parseInt(row.total_impressions) || 0,
        clicks: parseInt(row.total_clicks) || 0,
        cost: cost,
        ctr: parseFloat(row.avg_ctr) || 0,
        cpc: parseFloat(row.avg_cpc) || 0,
        bounceRate: parseFloat(row.avg_bounce_rate) || 0,
        conversions: conversions,
        revenue: conv.revenue,
        cpl: cpl,
        cr: cr,
      };
    });
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
      // Фильтр по выбранным целям (параметризованный IN clause)
      conversionQuery = `
        SELECT
          campaign_id,
          sum(conversions) as total_conversions,
          sum(revenue) as total_revenue
        FROM campaign_conversions
        WHERE connection_id = {connectionId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
          AND goal_id IN {goalIds:Array(String)}
        GROUP BY campaign_id
      `;
      conversionParams = { connectionId, startDate: dateFrom, endDate: dateTo, goalIds };
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

    // Удаляем связанные данные статистики
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

    // Удаляем алерты и настройки алертов
    await client.command({
      query: 'DELETE FROM alerts WHERE connection_id = {connectionId:String}',
      query_params: { connectionId },
    });

    await client.command({
      query: 'DELETE FROM alert_settings WHERE connection_id = {connectionId:String}',
      query_params: { connectionId },
    });

    // Удаляем анализы поисковых запросов
    await client.command({
      query: 'DELETE FROM search_query_analyses WHERE connection_id = {connectionId:String}',
      query_params: { connectionId },
    });

    // Удаляем публичные ссылки
    await client.command({
      query: 'DELETE FROM public_shares WHERE connection_id = {connectionId:String}',
      query_params: { connectionId },
    });

    // Удаляем KPI
    await client.command({
      query: 'DELETE FROM kpi WHERE connection_id = {connectionId:String}',
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

    // Определяем диапазон дат и connection_id для удаления дубликатов
    const connectionId = records[0].connectionId;
    const dates = records.map(r => r.date);
    const minDate = dates.sort()[0];
    const maxDate = [...dates].sort().reverse()[0];

    // Удаляем старые данные перед вставкой
    try {
      await client.command({
        query: `
          ALTER TABLE ad_group_performance
          DELETE WHERE connection_id = {connectionId:String}
            AND date >= {minDate:Date}
            AND date <= {maxDate:Date}
        `,
        query_params: { connectionId, minDate, maxDate },
      });
      console.log(`[ClickHouse] Deleted old ad_group_performance for ${connectionId} from ${minDate} to ${maxDate}`);
    } catch (error) {
      console.error(`[ClickHouse] Failed to delete old ad_group_performance:`, error);
    }

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

    // Определяем диапазон дат и connection_id для удаления дубликатов
    const connectionId = records[0].connectionId;
    const dates = records.map(r => r.date);
    const minDate = dates.sort()[0];
    const maxDate = [...dates].sort().reverse()[0];

    // Удаляем старые данные перед вставкой
    try {
      await client.command({
        query: `
          ALTER TABLE ad_performance
          DELETE WHERE connection_id = {connectionId:String}
            AND date >= {minDate:Date}
            AND date <= {maxDate:Date}
        `,
        query_params: { connectionId, minDate, maxDate },
      });
      console.log(`[ClickHouse] Deleted old ad_performance for ${connectionId} from ${minDate} to ${maxDate}`);
    } catch (error) {
      console.error(`[ClickHouse] Failed to delete old ad_performance:`, error);
    }

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

  // Вставка/обновление содержимого объявлений (заголовки и ссылки)
  async upsertAdContents(records: Array<{
    connectionId: string;
    accountName: string;
    adId: string;
    adGroupId?: string;
    campaignId?: string;
    title?: string;
    title2?: string;
    text?: string;
    href?: string;
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
      href: r.href || null,
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

    // Определяем диапазон дат и connection_id для удаления дубликатов
    const connectionId = records[0].connectionId;
    const dates = records.map(r => r.date);
    const minDate = dates.sort()[0];
    const maxDate = dates.sort().reverse()[0];

    // Удаляем старые данные перед вставкой
    try {
      await client.command({
        query: `
          ALTER TABLE ad_group_conversions
          DELETE WHERE connection_id = {connectionId:String}
            AND date >= {minDate:Date}
            AND date <= {maxDate:Date}
        `,
        query_params: { connectionId, minDate, maxDate },
      });
      console.log(`[ClickHouse] Deleted old ad_group_conversions for ${connectionId} from ${minDate} to ${maxDate}`);
    } catch (error) {
      console.error(`[ClickHouse] Failed to delete old ad_group_conversions:`, error);
    }

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

    // Определяем диапазон дат и connection_id для удаления дубликатов
    const connectionId = records[0].connectionId;
    const dates = records.map(r => r.date);
    const minDate = dates.sort()[0];
    const maxDate = dates.sort().reverse()[0];

    // Удаляем старые данные перед вставкой
    try {
      await client.command({
        query: `
          ALTER TABLE ad_conversions
          DELETE WHERE connection_id = {connectionId:String}
            AND date >= {minDate:Date}
            AND date <= {maxDate:Date}
        `,
        query_params: { connectionId, minDate, maxDate },
      });
      console.log(`[ClickHouse] Deleted old ad_conversions for ${connectionId} from ${minDate} to ${maxDate}`);
    } catch (error) {
      console.error(`[ClickHouse] Failed to delete old ad_conversions:`, error);
    }

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

    const query = `
      SELECT ad_id, title, title2
      FROM ad_contents FINAL
      WHERE connection_id = {connectionId:String}
        AND ad_id IN {adIds:Array(String)}
    `;

    const result = await client.query({
      query,
      query_params: { connectionId, adIds },
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
    const safeGoalIds = hasGoalFilter ? goalIds! : [];

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

    // Конверсии по кампаниям (с фильтрацией по целям если указаны)
    // Всегда используем campaign_conversions, т.к. campaign_performance не имеет колонки conversions
    const campaignConvQuery = hasGoalFilter ? `
      SELECT
        campaign_id,
        sum(conversions) as total_conversions,
        sum(revenue) as total_revenue
      FROM campaign_conversions
      WHERE connection_id = {connectionId:String}
        AND date >= {startDate:Date}
        AND date <= {endDate:Date}
        AND goal_id IN {goalIds:Array(String)}
      GROUP BY campaign_id
    ` : `
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

    // Конверсии по группам объявлений
    // Таблица campaign_conversions не содержит ad_group_id, поэтому всегда используем ad_group_performance
    // Фильтрация по целям на уровне групп недоступна - показываем общие конверсии
    const adGroupConvQuery = `
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

    // Конверсии по объявлениям
    // Таблица campaign_conversions не содержит ad_id, поэтому всегда используем ad_performance
    // Фильтрация по целям на уровне объявлений недоступна - показываем общие конверсии
    const adConvQuery = `
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

    // Базовые параметры для всех запросов
    const baseParams = { connectionId, startDate: dateFrom, endDate: dateTo };
    // Параметры с goalIds для запросов конверсий (если есть фильтр)
    const convParams = hasGoalFilter ? { ...baseParams, goalIds: safeGoalIds } : baseParams;

    const [campaignResult, adGroupResult, adResult, campaignConvResult, adGroupConvResult, adConvResult] = await Promise.all([
      client.query({ query: campaignQuery, query_params: baseParams, format: 'JSONEachRow' }),
      client.query({ query: adGroupQuery, query_params: baseParams, format: 'JSONEachRow' }),
      client.query({ query: adQuery, query_params: baseParams, format: 'JSONEachRow' }),
      client.query({ query: campaignConvQuery, query_params: convParams, format: 'JSONEachRow' }),
      // adGroupConvQuery и adConvQuery используют baseParams, т.к. они не поддерживают фильтрацию по целям
      client.query({ query: adGroupConvQuery, query_params: baseParams, format: 'JSONEachRow' }),
      client.query({ query: adConvQuery, query_params: baseParams, format: 'JSONEachRow' }),
    ]);

    const campaigns = await campaignResult.json<any>();
    const adGroups = await adGroupResult.json<any>();
    const ads = await adResult.json<any>();
    const campaignConversions = await campaignConvResult.json<any>();
    const adGroupConversions = await adGroupConvResult.json<any>();
    const adConversions = await adConvResult.json<any>();

    // Создаём карту конверсий по кампаниям: campaign_id -> { conversions, revenue }
    const campaignConvMap = new Map<string, { conversions: number; revenue: number }>();
    campaignConversions.forEach((c: any) => {
      campaignConvMap.set(c.campaign_id, {
        conversions: parseInt(c.total_conversions) || 0,
        revenue: parseFloat(c.total_revenue) || 0,
      });
    });

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
    // Конверсии кампании берём напрямую из campaignConvMap (более точно при фильтре по целям)
    return campaigns.map((c: any) => {
      const campaignAdGroups = adGroupsMap.get(c.campaign_id) || [];

      // Берём конверсии из карты конверсий по кампаниям
      const campaignConv = campaignConvMap.get(c.campaign_id) || { conversions: 0, revenue: 0 };

      return {
        campaignId: c.campaign_id,
        campaignName: c.campaign_name,
        totalImpressions: parseInt(c.total_impressions) || 0,
        totalClicks: parseInt(c.total_clicks) || 0,
        totalCost: parseFloat(c.total_cost) || 0,
        avgCtr: parseFloat(c.avg_ctr) || 0,
        avgCpc: parseFloat(c.avg_cpc) || 0,
        avgBounceRate: parseFloat(c.avg_bounce_rate) || 0,
        totalConversions: campaignConv.conversions,
        totalRevenue: campaignConv.revenue,
        adGroups: campaignAdGroups,
      };
    });
  },

  // ==================== KPI Functions ====================

  // Получить KPI для аккаунта на указанный месяц
  async getAccountKpi(connectionId: string, month: string) {
    const query = `
      SELECT
        id,
        connection_id,
        month,
        target_cost,
        target_cpl,
        target_leads,
        goal_ids,
        created_at,
        updated_at
      FROM account_kpi FINAL
      WHERE connection_id = {connectionId:String}
        AND month = {month:String}
      LIMIT 1
    `;

    const result = await client.query({
      query,
      query_params: { connectionId, month },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    if (rows.length === 0) {
      return null;
    }

    // Парсим goal_ids из JSON строки
    let goalIds: string[] = [];
    try {
      if (rows[0].goal_ids) {
        goalIds = JSON.parse(rows[0].goal_ids);
      }
    } catch (e) {
      console.error('[getAccountKpi] Failed to parse goal_ids:', e);
    }

    return {
      id: rows[0].id,
      connectionId: rows[0].connection_id,
      month: rows[0].month,
      targetCost: parseFloat(rows[0].target_cost) || 0,
      targetCpl: parseFloat(rows[0].target_cpl) || 0,
      targetLeads: parseInt(rows[0].target_leads) || 0,
      goalIds: goalIds,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at,
    };
  },

  // Сохранить/обновить KPI для аккаунта
  async saveAccountKpi(connectionId: string, month: string, kpi: {
    targetCost: number;
    targetCpl: number;
    targetLeads: number;
    goalIds?: string[];
  }) {
    // Преобразуем goalIds в строки (могут прийти как числа)
    const goalIdsAsStrings = (kpi.goalIds || []).map(id => String(id));

    const values = [{
      connection_id: connectionId,
      month: month,
      target_cost: kpi.targetCost,
      target_cpl: kpi.targetCpl,
      target_leads: kpi.targetLeads,
      goal_ids: JSON.stringify(goalIdsAsStrings),
      updated_at: formatDate(new Date()),
    }];

    await client.insert({
      table: 'account_kpi',
      values,
      format: 'JSONEachRow',
    });

    console.log(`[ClickHouse] Saved KPI for connection ${connectionId} month ${month} with goals: ${kpi.goalIds?.join(',')}`);
    return this.getAccountKpi(connectionId, month);
  },

  // Получить статистику за текущий месяц для расчёта прогресса KPI
  async getMonthStats(connectionId: string, goalIds?: string[]) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0); // последний день месяца
    const today = new Date(year, month, now.getDate());

    const dateFrom = startOfMonth.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    // Получаем статистику расходов за месяц
    const performanceQuery = `
      SELECT
        sum(cost) as total_cost,
        sum(clicks) as total_clicks
      FROM campaign_performance
      WHERE connection_id = {connectionId:String}
        AND date >= {dateFrom:Date}
        AND date <= {dateTo:Date}
    `;

    const performanceResult = await client.query({
      query: performanceQuery,
      query_params: { connectionId, dateFrom, dateTo },
      format: 'JSONEachRow',
    });
    const perfRows = await performanceResult.json<any>();

    // Получаем конверсии за месяц
    let conversionQuery: string;
    const convParams: Record<string, any> = { connectionId, dateFrom, dateTo };

    if (goalIds && goalIds.length > 0) {
      convParams.goalIds = goalIds;
      conversionQuery = `
        SELECT sum(conversions) as total_conversions
        FROM campaign_conversions
        WHERE connection_id = {connectionId:String}
          AND date >= {dateFrom:Date}
          AND date <= {dateTo:Date}
          AND goal_id IN ({goalIds:Array(String)})
      `;
    } else {
      conversionQuery = `
        SELECT sum(conversions) as total_conversions
        FROM campaign_conversions
        WHERE connection_id = {connectionId:String}
          AND date >= {dateFrom:Date}
          AND date <= {dateTo:Date}
      `;
    }

    const convResult = await client.query({
      query: conversionQuery,
      query_params: convParams,
      format: 'JSONEachRow',
    });
    const convRows = await convResult.json<any>();

    const totalCost = parseFloat(perfRows[0]?.total_cost) || 0;
    const totalClicks = parseInt(perfRows[0]?.total_clicks) || 0;
    const totalConversions = parseInt(convRows[0]?.total_conversions) || 0;
    const currentCpl = totalConversions > 0 ? totalCost / totalConversions : 0;

    // Рассчитываем прогресс по дням
    const daysInMonth = endOfMonth.getDate();
    const currentDay = now.getDate();
    const dayProgress = currentDay / daysInMonth; // процент прошедших дней

    return {
      currentCost: totalCost,
      currentLeads: totalConversions,
      currentCpl: currentCpl,
      currentClicks: totalClicks,
      daysInMonth,
      currentDay,
      dayProgress, // 0-1
      monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
    };
  },

  // Получить статистику по посадочным страницам
  // Нормализуем URL - убираем query параметры (UTM метки и т.д.)
  async getLandingPageStats(connectionId: string, startDate: Date, endDate: Date, goalIds?: string[]) {
    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Получаем статистику по объявлениям с группировкой по нормализованному href
    const hasGoalFilter = goalIds && goalIds.length > 0;
    const safeGoalIds = hasGoalFilter ? goalIds! : [];

    // Функция нормализации URL - убираем query string (?...)
    // cutQueryString убирает всё после ? включительно
    const normalizeUrl = `cutQueryString(ac.href)`;

    // Базовая статистика - группируем по нормализованному URL
    const performanceQuery = `
      SELECT
        ${normalizeUrl} as landing_page,
        sum(ap.impressions) as total_impressions,
        sum(ap.clicks) as total_clicks,
        sum(ap.cost) as total_cost,
        avg(ap.ctr) as avg_ctr,
        avg(ap.avg_cpc) as avg_cpc,
        avg(ap.bounce_rate) as avg_bounce_rate,
        count(DISTINCT ap.ad_id) as ads_count
      FROM ad_performance ap
      JOIN (SELECT * FROM ad_contents FINAL) ac ON ap.connection_id = ac.connection_id AND ap.ad_id = ac.ad_id
      WHERE ap.connection_id = {connectionId:String}
        AND ap.date >= {dateFrom:Date}
        AND ap.date <= {dateTo:Date}
        AND ac.href IS NOT NULL
        AND ac.href != ''
      GROUP BY landing_page
      ORDER BY total_cost DESC
    `;

    // Конверсии с группировкой по нормализованной посадочной
    // Используем campaign_conversions вместо ad_conversions (таблица не существует)
    const conversionsQuery = hasGoalFilter ? `
      SELECT
        ${normalizeUrl} as landing_page,
        sum(aconv.conversions) as total_conversions,
        sum(aconv.revenue) as total_revenue
      FROM campaign_conversions aconv
      JOIN (SELECT * FROM ad_contents FINAL) ac ON aconv.connection_id = ac.connection_id AND aconv.ad_id = ac.ad_id
      WHERE aconv.connection_id = {connectionId:String}
        AND aconv.date >= {dateFrom:Date}
        AND aconv.date <= {dateTo:Date}
        AND aconv.goal_id IN {goalIds:Array(String)}
        AND aconv.ad_id IS NOT NULL
        AND ac.href IS NOT NULL
        AND ac.href != ''
      GROUP BY landing_page
    ` : `
      SELECT
        ${normalizeUrl} as landing_page,
        sum(ap.conversions) as total_conversions,
        sum(ap.revenue) as total_revenue
      FROM ad_performance ap
      JOIN (SELECT * FROM ad_contents FINAL) ac ON ap.connection_id = ac.connection_id AND ap.ad_id = ac.ad_id
      WHERE ap.connection_id = {connectionId:String}
        AND ap.date >= {dateFrom:Date}
        AND ap.date <= {dateTo:Date}
        AND ac.href IS NOT NULL
        AND ac.href != ''
      GROUP BY landing_page
    `;

    // Базовые параметры
    const baseParams = { connectionId, dateFrom, dateTo };
    // Параметры с goalIds для запроса конверсий (если есть фильтр)
    const convParams = hasGoalFilter ? { ...baseParams, goalIds: safeGoalIds } : baseParams;

    const [perfResult, convResult] = await Promise.all([
      client.query({
        query: performanceQuery,
        query_params: baseParams,
        format: 'JSONEachRow',
      }),
      client.query({
        query: conversionsQuery,
        query_params: convParams,
        format: 'JSONEachRow',
      }),
    ]);

    const perfRows = await perfResult.json<any>();
    const convRows = await convResult.json<any>();

    // Создаём карту конверсий
    const convMap = new Map<string, { conversions: number; revenue: number }>();
    convRows.forEach((row: any) => {
      convMap.set(row.landing_page, {
        conversions: parseInt(row.total_conversions) || 0,
        revenue: parseFloat(row.total_revenue) || 0,
      });
    });

    // Объединяем данные
    return perfRows.map((row: any) => {
      const conv = convMap.get(row.landing_page) || { conversions: 0, revenue: 0 };
      const cost = parseFloat(row.total_cost) || 0;
      const clicks = parseInt(row.total_clicks) || 0;
      const conversions = conv.conversions;

      return {
        landingPage: row.landing_page,
        impressions: parseInt(row.total_impressions) || 0,
        clicks,
        cost,
        ctr: parseFloat(row.avg_ctr) || 0,
        cpc: parseFloat(row.avg_cpc) || 0,
        bounceRate: parseFloat(row.avg_bounce_rate) || 0,
        conversions,
        revenue: conv.revenue,
        cpl: conversions > 0 ? cost / conversions : 0,
        cr: clicks > 0 ? (conversions / clicks) * 100 : 0,
        adsCount: parseInt(row.ads_count) || 0,
      };
    });
  },

  // Search Queries
  async insertSearchQueries(records: any[]): Promise<void> {
    if (records.length === 0) return;

    const connectionId = records[0].connectionId;

    console.log(`[ClickHouse] Deleting existing search queries for ${connectionId}`);

    // Удаляем старые данные
    try {
      await client.command({
        query: `ALTER TABLE search_queries DELETE WHERE connection_id = {connectionId:String}`,
        query_params: { connectionId },
      });
      console.log(`[ClickHouse] Deleted old search queries`);
    } catch (error) {
      console.error(`[ClickHouse] Failed to delete old search queries:`, error);
    }

    console.log(`[ClickHouse] Inserting ${records.length} search query records`);

    const values = records.map(r => ({
      id: r.id || uuidv4(),
      connection_id: r.connectionId,
      account_name: r.accountName || '',
      campaign_id: r.campaignId || '',
      campaign_name: r.campaignName || '',
      ad_group_id: r.adGroupId || null,
      ad_group_name: r.adGroupName || null,
      ad_id: r.adId || null,
      date: r.date,
      query: r.query || '',
      matched_keyword: r.matchedKeyword || null,
      match_type: r.matchType || null,
      impressions: r.impressions || 0,
      clicks: r.clicks || 0,
      cost: r.cost || 0,
      criterion: r.criterion || null,
      criterion_type: r.criterionType || null,
      targeting_category: r.targetingCategory || null,
      placement: r.placement || null,
      income_grade: r.incomeGrade || null,
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    }));

    await client.insert({
      table: 'search_queries',
      values,
      format: 'JSONEachRow',
    });
  },

  async getSearchQueries(connectionId: string, _startDate?: string, _endDate?: string): Promise<any[]> {
    // Примечание: Yandex API не поддерживает конверсии с разбивкой по поисковым запросам
    // Возвращаем данные без конверсий
    const result = await client.query({
      query: `
        SELECT
          query,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(cost) as cost
        FROM search_queries
        WHERE connection_id = {connectionId:String}
        GROUP BY query
        ORDER BY cost DESC
      `,
      query_params: { connectionId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();

    return rows.map((row: any) => {
      return {
        query: row.query,
        impressions: parseInt(row.impressions) || 0,
        clicks: parseInt(row.clicks) || 0,
        cost: parseFloat(row.cost) || 0,
        conversions: 0, // Реальные конверсии недоступны через API для поисковых запросов
      };
    });
  },

  // Demographics - читаем из campaign_performance
  // Примечание: Данные конверсий по демографии не кешируются в ClickHouse,
  // они запрашиваются напрямую из Yandex API при каждом запросе
  async getDemographics(connectionId: string, startDate: string, endDate: string): Promise<any[]> {
    const result = await client.query({
      query: `
        SELECT
          gender,
          age,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(cost) as cost
        FROM campaign_performance
        WHERE connection_id = {connectionId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
          AND gender IS NOT NULL
          AND gender != ''
        GROUP BY gender, age
        ORDER BY cost DESC
      `,
      query_params: { connectionId, startDate, endDate },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();

    return rows.map((row: any) => {
      const genderLabel = row.gender === 'MALE' ? 'Мужчины' : row.gender === 'FEMALE' ? 'Женщины' : row.gender;
      const ageLabel = row.age?.replace('AGE_', '').replace('_', '-') || 'Не определён';
      return {
        segment: `${genderLabel}, ${ageLabel}`,
        gender: row.gender,
        age: row.age,
        impressions: parseInt(row.impressions) || 0,
        clicks: parseInt(row.clicks) || 0,
        cost: parseFloat(row.cost) || 0,
        conversions: 0, // Конверсии запрашиваются напрямую из API
      };
    });
  },

  // Geo - читаем из campaign_performance
  // Примечание: Данные конверсий по географии не кешируются в ClickHouse,
  // они запрашиваются напрямую из Yandex API при каждом запросе
  async getGeoStats(connectionId: string, startDate: string, endDate: string): Promise<any[]> {
    const result = await client.query({
      query: `
        SELECT
          targeting_location_name as region,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(cost) as cost
        FROM campaign_performance
        WHERE connection_id = {connectionId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
          AND targeting_location_name IS NOT NULL
          AND targeting_location_name != ''
        GROUP BY targeting_location_name
        ORDER BY cost DESC
        LIMIT 20
      `,
      query_params: { connectionId, startDate, endDate },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();

    return rows.map((row: any) => {
      return {
        region: row.region || 'Не определён',
        impressions: parseInt(row.impressions) || 0,
        clicks: parseInt(row.clicks) || 0,
        cost: parseFloat(row.cost) || 0,
        conversions: 0, // Конверсии запрашиваются напрямую из API
      };
    });
  },

  // Devices - читаем из campaign_performance
  // Примечание: Данные конверсий по устройствам не кешируются в ClickHouse,
  // они запрашиваются напрямую из Yandex API при каждом запросе
  async getCachedDeviceStats(connectionId: string, startDate: string, endDate: string): Promise<any[]> {
    const result = await client.query({
      query: `
        SELECT
          device,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(cost) as cost
        FROM campaign_performance
        WHERE connection_id = {connectionId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
          AND device IS NOT NULL
          AND device != ''
        GROUP BY device
        ORDER BY cost DESC
      `,
      query_params: { connectionId, startDate, endDate },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();

    const deviceNames: Record<string, string> = {
      DESKTOP: 'Компьютеры',
      MOBILE: 'Смартфоны',
      TABLET: 'Планшеты',
    };
    return rows.map((row: any) => {
      return {
        device: row.device,
        deviceName: deviceNames[row.device] || row.device,
        impressions: parseInt(row.impressions) || 0,
        clicks: parseInt(row.clicks) || 0,
        cost: parseFloat(row.cost) || 0,
        conversions: 0, // Конверсии запрашиваются напрямую из API
      };
    });
  },

  // Income Grade - читаем из campaign_performance
  // Примечание: Yandex API не поддерживает конверсии с разбивкой по уровню дохода
  async getIncomeStats(connectionId: string, startDate: string, endDate: string): Promise<any[]> {
    const result = await client.query({
      query: `
        SELECT
          income_grade,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(cost) as cost
        FROM campaign_performance
        WHERE connection_id = {connectionId:String}
          AND date >= {startDate:Date}
          AND date <= {endDate:Date}
          AND income_grade IS NOT NULL
          AND income_grade != ''
        GROUP BY income_grade
        ORDER BY cost DESC
      `,
      query_params: { connectionId, startDate, endDate },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();

    const incomeNames: Record<string, string> = {
      LOW: 'Низкий',
      MEDIUM: 'Средний',
      HIGH: 'Высокий',
      PREMIUM: 'Премиум',
    };
    return rows.map((row: any) => {
      return {
        incomeGrade: row.income_grade,
        incomeGradeRaw: row.income_grade,
        incomeGradeName: incomeNames[row.income_grade] || row.income_grade,
        impressions: parseInt(row.impressions) || 0,
        clicks: parseInt(row.clicks) || 0,
        cost: parseFloat(row.cost) || 0,
        conversions: 0, // Yandex API не поддерживает конверсии по уровню дохода
      };
    });
  },

  // Ad Texts - объединяем ad_contents (заголовки и тексты) с ad_performance (статистика)
  // Группируем по ТЕКСТУ (title + text), а не по ad_id, чтобы консолидировать дубликаты
  async getAdTexts(connectionId: string, startDate: string, endDate: string, campaignId?: string): Promise<any[]> {
    // Строим запрос с опциональным фильтром по кампании
    let whereClause = `ap.connection_id = {connectionId:String}
          AND ap.date >= {startDate:Date}
          AND ap.date <= {endDate:Date}`;

    const queryParams: Record<string, string> = { connectionId, startDate, endDate };

    if (campaignId) {
      whereClause += `
          AND ap.campaign_id = {campaignId:String}`;
      queryParams.campaignId = campaignId;
    }

    const result = await client.query({
      query: `
        SELECT
          any(ap.ad_id) as ad_id,
          ac.title,
          ac.title2,
          ac.text,
          SUM(ap.impressions) as impressions,
          SUM(ap.clicks) as clicks,
          SUM(ap.cost) as cost,
          SUM(ap.conversions) as conversions,
          COUNT(DISTINCT ap.ad_id) as ad_count
        FROM ad_performance ap
        LEFT JOIN (SELECT * FROM ad_contents FINAL) ac ON ap.ad_id = ac.ad_id AND ap.connection_id = ac.connection_id
        WHERE ${whereClause}
        GROUP BY ac.title, ac.title2, ac.text
        ORDER BY cost DESC
        LIMIT 100
      `,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map((row: any) => ({
      adId: row.ad_id,
      title: row.title || 'Без заголовка',
      title2: row.title2 || '',
      text: row.text || '',
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      cost: parseFloat(row.cost) || 0,
      conversions: parseInt(row.conversions) || 0,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
      avgCpc: row.clicks > 0 ? row.cost / row.clicks : 0,
      adCount: parseInt(row.ad_count) || 1, // Количество объявлений с таким текстом
    }));
  },

  // ===========================================
  // Users CRUD
  // ===========================================

  async createUser(user: {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    isAdmin?: boolean;
  }): Promise<void> {
    await client.insert({
      table: 'users',
      values: [{
        id: user.id,
        email: user.email,
        password_hash: user.passwordHash,
        name: user.name,
        is_admin: user.isAdmin ? 1 : 0,
        created_at: formatDate(new Date()),
        updated_at: formatDate(new Date()),
      }],
      format: 'JSONEachRow',
    });
  },

  async getUserById(id: string): Promise<{
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    isAdmin: boolean;
    isVerified: boolean;
    createdAt: Date;
  } | null> {
    const result = await client.query({
      query: `
        SELECT id, email, password_hash, name, is_admin, is_verified, created_at
        FROM users FINAL
        WHERE id = {id:String}
        LIMIT 1
      `,
      query_params: { id },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      isAdmin: row.is_admin === 1,
      isVerified: row.is_verified === 1,
      createdAt: new Date(row.created_at),
    };
  },

  async getUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    isAdmin: boolean;
    isVerified: boolean;
    createdAt: Date;
  } | null> {
    const result = await client.query({
      query: `
        SELECT id, email, password_hash, name, is_admin, is_verified, created_at
        FROM users FINAL
        WHERE email = {email:String}
        LIMIT 1
      `,
      query_params: { email },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      isAdmin: row.is_admin === 1,
      isVerified: row.is_verified === 1,
      createdAt: new Date(row.created_at),
    };
  },

  async getAllUsers(): Promise<Array<{
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
    createdAt: Date;
  }>> {
    const result = await client.query({
      query: `
        SELECT id, email, name, is_admin, created_at
        FROM users FINAL
        ORDER BY created_at DESC
      `,
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      isAdmin: row.is_admin === 1,
      createdAt: new Date(row.created_at),
    }));
  },

  async updateUser(id: string, updates: {
    email?: string;
    passwordHash?: string;
    name?: string;
    isAdmin?: boolean;
  }): Promise<void> {
    // ClickHouse ReplacingMergeTree - вставляем новую версию записи
    const current = await this.getUserById(id);
    if (!current) return;

    await client.insert({
      table: 'users',
      values: [{
        id,
        email: updates.email ?? current.email,
        password_hash: updates.passwordHash ?? current.passwordHash,
        name: updates.name ?? current.name,
        is_admin: updates.isAdmin !== undefined ? (updates.isAdmin ? 1 : 0) : (current.isAdmin ? 1 : 0),
        created_at: formatDate(current.createdAt),
        updated_at: formatDate(new Date()),
      }],
      format: 'JSONEachRow',
    });
  },

  async deleteUser(id: string): Promise<void> {
    // В ClickHouse используем ALTER TABLE DELETE для удаления
    await client.command({
      query: `ALTER TABLE users DELETE WHERE id = {id:String}`,
      query_params: { id },
    });
  },

  async countUsers(): Promise<number> {
    const result = await client.query({
      query: `SELECT count() as cnt FROM users FINAL`,
      format: 'JSONEachRow',
    });
    const rows = await result.json<any>();
    return parseInt(rows[0]?.cnt) || 0;
  },

  // ===========================================
  // Projects CRUD
  // ===========================================

  async createProject(project: {
    id: string;
    userId: string;
    name: string;
    brief: any;
  }): Promise<void> {
    await client.insert({
      table: 'projects',
      values: [{
        id: project.id,
        user_id: project.userId,
        name: project.name,
        brief: JSON.stringify(project.brief),
        semantics: '',
        creatives: '',
        ads: '',
        complete_ads: '',
        minus_words: '',
        keyword_analysis: '',
        campaigns: '',
        strategy: '',
        analytics: '',
        created_at: formatDate(new Date()),
        updated_at: formatDate(new Date()),
      }],
      format: 'JSONEachRow',
    });
  },

  async getProjectById(id: string): Promise<any | null> {
    const result = await client.query({
      query: `
        SELECT *
        FROM projects FINAL
        WHERE id = {id:String}
        LIMIT 1
      `,
      query_params: { id },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    if (rows.length === 0) return null;

    return this.parseProjectRow(rows[0]);
  },

  async getProjectsByUserId(userId: string, isAdmin: boolean = false): Promise<any[]> {
    // Админы видят все проекты, обычные пользователи - только свои
    const query = isAdmin
      ? `SELECT * FROM projects FINAL ORDER BY created_at DESC`
      : `SELECT * FROM projects FINAL WHERE user_id = {userId:String} ORDER BY created_at DESC`;

    const result = await client.query({
      query,
      query_params: isAdmin ? {} : { userId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map((row: any) => this.parseProjectRow(row));
  },

  async getProjectsLightweight(userId: string, isAdmin: boolean = false): Promise<Array<{
    id: string;
    userId: string;
    name: string;
    brief: any;
    hasSemantics: boolean;
    hasCreatives: boolean;
    hasAds: boolean;
    hasCompleteAds: boolean;
    hasMinusWords: boolean;
    hasKeywordAnalysis: boolean;
    hasCampaigns: boolean;
    hasStrategy: boolean;
    hasAnalytics: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const query = isAdmin
      ? `SELECT id, user_id, name, brief,
           length(semantics) > 2 as has_semantics,
           length(creatives) > 2 as has_creatives,
           length(ads) > 2 as has_ads,
           length(complete_ads) > 2 as has_complete_ads,
           length(minus_words) > 2 as has_minus_words,
           length(keyword_analysis) > 2 as has_keyword_analysis,
           length(campaigns) > 2 as has_campaigns,
           length(strategy) > 2 as has_strategy,
           length(analytics) > 2 as has_analytics,
           created_at, updated_at
         FROM projects FINAL
         ORDER BY created_at DESC`
      : `SELECT id, user_id, name, brief,
           length(semantics) > 2 as has_semantics,
           length(creatives) > 2 as has_creatives,
           length(ads) > 2 as has_ads,
           length(complete_ads) > 2 as has_complete_ads,
           length(minus_words) > 2 as has_minus_words,
           length(keyword_analysis) > 2 as has_keyword_analysis,
           length(campaigns) > 2 as has_campaigns,
           length(strategy) > 2 as has_strategy,
           length(analytics) > 2 as has_analytics,
           created_at, updated_at
         FROM projects FINAL
         WHERE user_id = {userId:String}
         ORDER BY created_at DESC`;

    const result = await client.query({
      query,
      query_params: isAdmin ? {} : { userId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      brief: row.brief ? JSON.parse(row.brief) : {},
      hasSemantics: row.has_semantics === 1,
      hasCreatives: row.has_creatives === 1,
      hasAds: row.has_ads === 1,
      hasCompleteAds: row.has_complete_ads === 1,
      hasMinusWords: row.has_minus_words === 1,
      hasKeywordAnalysis: row.has_keyword_analysis === 1,
      hasCampaigns: row.has_campaigns === 1,
      hasStrategy: row.has_strategy === 1,
      hasAnalytics: row.has_analytics === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  },

  async updateProject(id: string, updates: Partial<{
    name: string;
    brief: any;
    semantics: any;
    creatives: any;
    ads: any;
    completeAds: any;
    minusWords: any;
    keywordAnalysis: any;
    campaigns: any;
    strategy: any;
    analytics: any;
  }>): Promise<void> {
    const current = await this.getProjectById(id);
    if (!current) return;

    const row: Record<string, any> = {
      id,
      user_id: current.userId,
      name: updates.name ?? current.name,
      brief: JSON.stringify(updates.brief ?? current.brief ?? {}),
      semantics: JSON.stringify(updates.semantics ?? current.semantics ?? ''),
      creatives: JSON.stringify(updates.creatives ?? current.creatives ?? ''),
      ads: JSON.stringify(updates.ads ?? current.ads ?? ''),
      complete_ads: JSON.stringify(updates.completeAds ?? current.completeAds ?? ''),
      minus_words: JSON.stringify(updates.minusWords ?? current.minusWords ?? ''),
      keyword_analysis: JSON.stringify(updates.keywordAnalysis ?? current.keywordAnalysis ?? ''),
      campaigns: JSON.stringify(updates.campaigns ?? current.campaigns ?? ''),
      strategy: JSON.stringify(updates.strategy ?? current.strategy ?? ''),
      analytics: JSON.stringify(updates.analytics ?? current.analytics ?? ''),
      created_at: formatDate(current.createdAt),
      updated_at: formatDate(new Date()),
    };

    await client.insert({
      table: 'projects',
      values: [row],
      format: 'JSONEachRow',
    });
  },

  async deleteProject(id: string): Promise<void> {
    await client.command({
      query: `ALTER TABLE projects DELETE WHERE id = {id:String}`,
      query_params: { id },
    });
  },

  // Helper для парсинга строки проекта из ClickHouse
  parseProjectRow(row: any): any {
    const parseJson = (str: string) => {
      if (!str || str === '' || str === '""') return undefined;
      try {
        return JSON.parse(str);
      } catch {
        return undefined;
      }
    };

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      brief: parseJson(row.brief) || {},
      semantics: parseJson(row.semantics),
      creatives: parseJson(row.creatives),
      ads: parseJson(row.ads),
      completeAds: parseJson(row.complete_ads),
      minusWords: parseJson(row.minus_words),
      keywordAnalysis: parseJson(row.keyword_analysis),
      campaigns: parseJson(row.campaigns),
      strategy: parseJson(row.strategy),
      analytics: parseJson(row.analytics),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  },

  // Методы для сохранения отдельных модулей проекта
  async saveProjectSemantics(projectId: string, keywords: string[]): Promise<void> {
    await this.updateProject(projectId, {
      semantics: { keywords, generatedAt: new Date() },
    });
  },

  async saveProjectCreatives(projectId: string, ideas: any[]): Promise<void> {
    await this.updateProject(projectId, {
      creatives: { ideas, generatedAt: new Date() },
    });
  },

  async saveProjectAds(projectId: string, headlines: string[], texts: string[]): Promise<void> {
    await this.updateProject(projectId, {
      ads: { headlines, texts, generatedAt: new Date() },
    });
  },

  async saveProjectMinusWords(projectId: string, words: string[], analysis?: any): Promise<void> {
    await this.updateProject(projectId, {
      minusWords: { words, analysis, generatedAt: new Date() },
    });
  },

  async saveProjectCompleteAds(projectId: string, completeAds: any): Promise<void> {
    await this.updateProject(projectId, { completeAds });
  },

  async saveProjectKeywordAnalysis(projectId: string, analysis: any): Promise<void> {
    await this.updateProject(projectId, {
      keywordAnalysis: { ...analysis, generatedAt: new Date() },
    });
  },

  async saveProjectCampaigns(projectId: string, structure: any): Promise<void> {
    await this.updateProject(projectId, {
      campaigns: { structure, generatedAt: new Date() },
    });
  },

  async saveProjectStrategy(projectId: string, plan: any): Promise<void> {
    await this.updateProject(projectId, {
      strategy: { plan, generatedAt: new Date() },
    });
  },

  async saveProjectAnalytics(projectId: string, analytics: any): Promise<void> {
    await this.updateProject(projectId, {
      analytics: { ...analytics, generatedAt: new Date() },
    });
  },

  // Инициализация таблиц users/projects (выполняется при старте)
  async initializeUserProjectsTables(): Promise<void> {
    // Создаем таблицу users
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS users (
          id String,
          email String,
          password_hash String,
          name String,
          is_admin UInt8 DEFAULT 0,
          is_verified UInt8 DEFAULT 0,
          created_at DateTime DEFAULT now(),
          updated_at DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updated_at)
        ORDER BY (id)
        SETTINGS index_granularity = 8192
      `,
    });

    // Добавляем колонку is_verified если не существует (для миграции)
    try {
      await client.command({
        query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified UInt8 DEFAULT 0`,
      });
    } catch (e) {
      // Игнорируем если колонка уже есть
    }

    // Создаем таблицу verification_codes
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS verification_codes (
          id String,
          email String,
          code String,
          type String DEFAULT 'registration',
          attempts UInt8 DEFAULT 0,
          is_used UInt8 DEFAULT 0,
          expires_at DateTime,
          created_at DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(created_at)
        ORDER BY (id)
        TTL expires_at + INTERVAL 1 DAY
        SETTINGS index_granularity = 8192
      `,
    });

    // Создаем таблицу projects
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS projects (
          id String,
          user_id String,
          name String,
          brief String,
          semantics String,
          creatives String,
          ads String,
          complete_ads String,
          minus_words String,
          keyword_analysis String,
          campaigns String,
          strategy String,
          analytics String,
          created_at DateTime DEFAULT now(),
          updated_at DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updated_at)
        ORDER BY (id)
        SETTINGS index_granularity = 8192
      `,
    });

    console.log('✅ ClickHouse tables users/projects/verification_codes initialized');
  },

  // ===========================================
  // Verification Codes
  // ===========================================

  async createVerificationCode(email: string, code: string, type: 'registration' | 'password_reset' = 'registration'): Promise<string> {
    const id = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    await client.insert({
      table: 'verification_codes',
      values: [{
        id,
        email,
        code,
        type,
        attempts: 0,
        is_used: 0,
        expires_at: formatDate(expiresAt),
        created_at: formatDate(now),
      }],
      format: 'JSONEachRow',
    });

    return id;
  },

  async getValidVerificationCode(email: string, code: string): Promise<any | null> {
    const result = await client.query({
      query: `
        SELECT *
        FROM verification_codes FINAL
        WHERE email = {email:String}
          AND code = {code:String}
          AND is_used = 0
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
      `,
      query_params: { email, code },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.length > 0 ? rows[0] : null;
  },

  async markVerificationCodeUsed(id: string): Promise<void> {
    // Get existing code
    const result = await client.query({
      query: `SELECT * FROM verification_codes FINAL WHERE id = {id:String} LIMIT 1`,
      query_params: { id },
      format: 'JSONEachRow',
    });
    const rows = await result.json<any>();
    if (rows.length === 0) return;

    const existing = rows[0];

    // Insert updated version
    await client.insert({
      table: 'verification_codes',
      values: [{
        ...existing,
        is_used: 1,
      }],
      format: 'JSONEachRow',
    });
  },

  async incrementVerificationAttempts(id: string): Promise<number> {
    const result = await client.query({
      query: `SELECT * FROM verification_codes FINAL WHERE id = {id:String} LIMIT 1`,
      query_params: { id },
      format: 'JSONEachRow',
    });
    const rows = await result.json<any>();
    if (rows.length === 0) return 0;

    const existing = rows[0];
    const newAttempts = (existing.attempts || 0) + 1;

    await client.insert({
      table: 'verification_codes',
      values: [{
        ...existing,
        attempts: newAttempts,
      }],
      format: 'JSONEachRow',
    });

    return newAttempts;
  },

  async getLatestVerificationCode(email: string): Promise<any | null> {
    const result = await client.query({
      query: `
        SELECT *
        FROM verification_codes FINAL
        WHERE email = {email:String}
        ORDER BY created_at DESC
        LIMIT 1
      `,
      query_params: { email },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.length > 0 ? rows[0] : null;
  },

  async verifyUser(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) return;

    await client.insert({
      table: 'users',
      values: [{
        id: user.id,
        email: user.email,
        password_hash: user.passwordHash,
        name: user.name,
        is_admin: user.isAdmin ? 1 : 0,
        is_verified: 1,
        created_at: formatDate(user.createdAt),
        updated_at: formatDate(new Date()),
      }],
      format: 'JSONEachRow',
    });
  },

  // ===========================================
  // Public Shares (публичные ссылки на дашборд)
  // ===========================================

  async initializePublicSharesTable(): Promise<void> {
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS public_shares (
          id String,
          connection_id String,
          user_id String,
          name String,
          is_active UInt8 DEFAULT 1,
          expires_at Nullable(DateTime),
          created_at DateTime DEFAULT now(),
          updated_at DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updated_at)
        ORDER BY (id)
        SETTINGS index_granularity = 8192
      `,
    });
    console.log('✅ ClickHouse table public_shares initialized');
  },

  async createPublicShare(data: {
    connectionId: string;
    userId: string;
    name: string;
    expiresAt?: Date;
  }): Promise<string> {
    const id = uuidv4();
    const now = formatDate(new Date());

    await client.insert({
      table: 'public_shares',
      values: [{
        id,
        connection_id: data.connectionId,
        user_id: data.userId,
        name: data.name,
        is_active: 1,
        expires_at: data.expiresAt ? formatDate(data.expiresAt) : null,
        created_at: now,
        updated_at: now,
      }],
      format: 'JSONEachRow',
    });

    return id;
  },

  async getPublicSharesByConnection(connectionId: string): Promise<any[]> {
    const result = await client.query({
      query: `
        SELECT *
        FROM public_shares FINAL
        WHERE connection_id = {connectionId:String}
        ORDER BY created_at DESC
      `,
      query_params: { connectionId },
      format: 'JSONEachRow',
    });

    return await result.json();
  },

  async getPublicShareById(id: string): Promise<any | null> {
    const result = await client.query({
      query: `
        SELECT ps.*, ydc.login as account_login, ydc.project_id
        FROM public_shares ps FINAL
        LEFT JOIN yandex_direct_connections ydc FINAL ON ps.connection_id = ydc.id
        WHERE ps.id = {id:String}
        LIMIT 1
      `,
      query_params: { id },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.length > 0 ? rows[0] : null;
  },

  async updatePublicShare(id: string, data: { isActive?: boolean; name?: string }): Promise<boolean> {
    const share = await this.getPublicShareById(id);
    if (!share) return false;

    const now = formatDate(new Date());

    await client.insert({
      table: 'public_shares',
      values: [{
        id: share.id,
        connection_id: share.connection_id,
        user_id: share.user_id,
        name: data.name !== undefined ? data.name : share.name,
        is_active: data.isActive !== undefined ? (data.isActive ? 1 : 0) : share.is_active,
        expires_at: share.expires_at,
        created_at: share.created_at,
        updated_at: now,
      }],
      format: 'JSONEachRow',
    });

    return true;
  },

  async deletePublicShare(id: string): Promise<boolean> {
    // В ClickHouse ReplacingMergeTree - помечаем как неактивную и с истёкшим сроком
    const share = await this.getPublicShareById(id);
    if (!share) return false;

    const now = formatDate(new Date());
    const pastDate = formatDate(new Date('2000-01-01'));

    await client.insert({
      table: 'public_shares',
      values: [{
        id: share.id,
        connection_id: share.connection_id,
        user_id: share.user_id,
        name: share.name,
        is_active: 0,
        expires_at: pastDate,
        created_at: share.created_at,
        updated_at: now,
      }],
      format: 'JSONEachRow',
    });

    return true;
  },

  async isPublicShareValid(id: string): Promise<{ valid: boolean; share?: any }> {
    const share = await this.getPublicShareById(id);
    if (!share) return { valid: false };

    // Проверяем активность
    if (!share.is_active) return { valid: false };

    // Проверяем срок действия
    if (share.expires_at) {
      const expiresAt = new Date(share.expires_at);
      if (expiresAt < new Date()) return { valid: false };
    }

    return { valid: true, share };
  },
};
