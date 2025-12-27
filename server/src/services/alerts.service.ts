/**
 * Alerts Service
 * Система уведомлений о критических изменениях в кампаниях
 */

import { clickhouseService } from './clickhouse.service';
import { v4 as uuidv4 } from 'uuid';

export interface Alert {
  id: string;
  connectionId: string;
  userId: string;
  type: 'critical' | 'warning' | 'info';
  category: 'budget' | 'ctr' | 'conversions' | 'cpl' | 'impressions' | 'anomaly';
  title: string;
  message: string;
  campaignId?: string;
  campaignName?: string;
  metricName?: string;
  previousValue?: number;
  currentValue?: number;
  changePercent?: number;
  threshold?: number;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: Date;
}

export interface AlertRule {
  id: string;
  userId: string;
  connectionId?: string; // null = for all connections
  name: string;
  isActive: boolean;
  // Conditions
  category: 'budget' | 'ctr' | 'conversions' | 'cpl' | 'impressions';
  condition: 'above' | 'below' | 'change_percent';
  threshold: number;
  // Notifications
  notifyEmail: boolean;
  notifyTelegram: boolean;
  createdAt: Date;
}

export interface AlertSettings {
  userId: string;
  emailNotifications: boolean;
  telegramNotifications: boolean;
  telegramChatId?: string;
  dailyDigest: boolean;
  digestTime: string; // "09:00"
  // Alert categories to monitor
  monitorBudget: boolean;
  monitorCtr: boolean;
  monitorConversions: boolean;
  monitorCpl: boolean;
  monitorImpressions: boolean;
  // Thresholds for automatic alerts
  budgetThreshold: number; // Alert when X% of budget spent
  ctrDropThreshold: number; // Alert when CTR drops by X%
  conversionsDropThreshold: number; // Alert when conversions drop by X%
  cplIncreaseThreshold: number; // Alert when CPL increases by X%
  impressionsDropThreshold: number; // Alert when impressions drop by X%
}

const DEFAULT_SETTINGS: Omit<AlertSettings, 'userId'> = {
  emailNotifications: true,
  telegramNotifications: false,
  dailyDigest: true,
  digestTime: '09:00',
  monitorBudget: true,
  monitorCtr: true,
  monitorConversions: true,
  monitorCpl: true,
  monitorImpressions: true,
  budgetThreshold: 80,
  ctrDropThreshold: 30,
  conversionsDropThreshold: 50,
  cplIncreaseThreshold: 50,
  impressionsDropThreshold: 50,
};

export const alertsService = {
  /**
   * Create a new alert
   */
  async createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'isRead' | 'isDismissed'>): Promise<string> {
    const id = uuidv4();
    const now = new Date();

    try {
      await clickhouseService.query(`
        INSERT INTO alerts (
          id, connection_id, user_id, type, category, title, message,
          campaign_id, campaign_name, metric_name, previous_value, current_value,
          change_percent, threshold, is_read, is_dismissed, created_at
        ) VALUES (
          '${id}', '${alert.connectionId}', '${alert.userId}', '${alert.type}', '${alert.category}',
          '${alert.title.replace(/'/g, "''")}', '${alert.message.replace(/'/g, "''")}',
          ${alert.campaignId ? `'${alert.campaignId}'` : 'NULL'},
          ${alert.campaignName ? `'${alert.campaignName.replace(/'/g, "''")}'` : 'NULL'},
          ${alert.metricName ? `'${alert.metricName}'` : 'NULL'},
          ${alert.previousValue ?? 'NULL'},
          ${alert.currentValue ?? 'NULL'},
          ${alert.changePercent ?? 'NULL'},
          ${alert.threshold ?? 'NULL'},
          0, 0, '${now.toISOString().replace('T', ' ').substring(0, 19)}'
        )
      `);

      return id;
    } catch (error) {
      console.error('[Alerts] Failed to create alert:', error);
      throw error;
    }
  },

  /**
   * Get alerts for a user
   */
  async getAlerts(userId: string, options?: {
    connectionId?: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Alert[]> {
    const { connectionId, unreadOnly = false, limit = 50, offset = 0 } = options || {};

    let query = `
      SELECT *
      FROM alerts
      WHERE user_id = '${userId}'
        AND is_dismissed = 0
    `;

    if (connectionId) {
      query += ` AND connection_id = '${connectionId}'`;
    }

    if (unreadOnly) {
      query += ` AND is_read = 0`;
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    try {
      const rows = await clickhouseService.query(query);
      return rows.map(this.mapRowToAlert);
    } catch (error) {
      console.error('[Alerts] Failed to get alerts:', error);
      return [];
    }
  },

  /**
   * Get unread alerts count
   */
  async getUnreadCount(userId: string, connectionId?: string): Promise<number> {
    let query = `
      SELECT count() as count
      FROM alerts
      WHERE user_id = '${userId}'
        AND is_read = 0
        AND is_dismissed = 0
    `;

    if (connectionId) {
      query += ` AND connection_id = '${connectionId}'`;
    }

    try {
      const rows = await clickhouseService.query(query);
      return parseInt(rows[0]?.count || '0');
    } catch (error) {
      console.error('[Alerts] Failed to get unread count:', error);
      return 0;
    }
  },

  /**
   * Mark alert as read
   */
  async markAsRead(alertId: string, userId: string): Promise<boolean> {
    try {
      // ClickHouse doesn't support UPDATE, so we need to use ALTER TABLE ... UPDATE
      await clickhouseService.query(`
        ALTER TABLE alerts UPDATE is_read = 1
        WHERE id = '${alertId}' AND user_id = '${userId}'
      `);
      return true;
    } catch (error) {
      console.error('[Alerts] Failed to mark as read:', error);
      return false;
    }
  },

  /**
   * Mark all alerts as read
   */
  async markAllAsRead(userId: string, connectionId?: string): Promise<boolean> {
    try {
      let query = `
        ALTER TABLE alerts UPDATE is_read = 1
        WHERE user_id = '${userId}' AND is_read = 0
      `;

      if (connectionId) {
        query += ` AND connection_id = '${connectionId}'`;
      }

      await clickhouseService.query(query);
      return true;
    } catch (error) {
      console.error('[Alerts] Failed to mark all as read:', error);
      return false;
    }
  },

  /**
   * Dismiss an alert
   */
  async dismissAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      await clickhouseService.query(`
        ALTER TABLE alerts UPDATE is_dismissed = 1
        WHERE id = '${alertId}' AND user_id = '${userId}'
      `);
      return true;
    } catch (error) {
      console.error('[Alerts] Failed to dismiss alert:', error);
      return false;
    }
  },

  /**
   * Get user alert settings
   */
  async getSettings(userId: string): Promise<AlertSettings> {
    try {
      const rows = await clickhouseService.query(`
        SELECT *
        FROM alert_settings
        WHERE user_id = '${userId}'
        LIMIT 1
      `);

      if (rows.length === 0) {
        // Return default settings
        return { userId, ...DEFAULT_SETTINGS };
      }

      return this.mapRowToSettings(rows[0]);
    } catch (error) {
      console.error('[Alerts] Failed to get settings:', error);
      return { userId, ...DEFAULT_SETTINGS };
    }
  },

  /**
   * Update user alert settings
   */
  async updateSettings(userId: string, settings: Partial<AlertSettings>): Promise<boolean> {
    try {
      // First check if settings exist
      const existing = await this.getSettings(userId);
      const merged = { ...existing, ...settings };

      // Delete existing and insert new (ClickHouse pattern)
      await clickhouseService.query(`
        INSERT INTO alert_settings (
          user_id, email_notifications, telegram_notifications, telegram_chat_id,
          daily_digest, digest_time, monitor_budget, monitor_ctr, monitor_conversions,
          monitor_cpl, monitor_impressions, budget_threshold, ctr_drop_threshold,
          conversions_drop_threshold, cpl_increase_threshold, impressions_drop_threshold,
          created_at
        ) VALUES (
          '${userId}',
          ${merged.emailNotifications ? 1 : 0},
          ${merged.telegramNotifications ? 1 : 0},
          ${merged.telegramChatId ? `'${merged.telegramChatId}'` : 'NULL'},
          ${merged.dailyDigest ? 1 : 0},
          '${merged.digestTime}',
          ${merged.monitorBudget ? 1 : 0},
          ${merged.monitorCtr ? 1 : 0},
          ${merged.monitorConversions ? 1 : 0},
          ${merged.monitorCpl ? 1 : 0},
          ${merged.monitorImpressions ? 1 : 0},
          ${merged.budgetThreshold},
          ${merged.ctrDropThreshold},
          ${merged.conversionsDropThreshold},
          ${merged.cplIncreaseThreshold},
          ${merged.impressionsDropThreshold},
          now()
        )
      `);

      return true;
    } catch (error) {
      console.error('[Alerts] Failed to update settings:', error);
      return false;
    }
  },

  /**
   * Analyze campaign metrics and generate alerts
   */
  async analyzeAndGenerateAlerts(connectionId: string, userId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const settings = await this.getSettings(userId);

    try {
      // Get current and previous period stats
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const prevWeekStart = new Date(today);
      prevWeekStart.setDate(prevWeekStart.getDate() - 14);
      const prevWeekEnd = new Date(today);
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      // Get stats for comparison
      const currentStats = await clickhouseService.query(`
        SELECT
          campaign_id,
          campaign_name,
          sum(impressions) as impressions,
          sum(clicks) as clicks,
          sum(cost) as cost,
          sum(conversions) as conversions
        FROM campaign_performance
        WHERE connection_id = '${connectionId}'
          AND date >= '${formatDate(lastWeekStart)}'
          AND date <= '${formatDate(today)}'
        GROUP BY campaign_id, campaign_name
      `);

      const previousStats = await clickhouseService.query(`
        SELECT
          campaign_id,
          sum(impressions) as impressions,
          sum(clicks) as clicks,
          sum(cost) as cost,
          sum(conversions) as conversions
        FROM campaign_performance
        WHERE connection_id = '${connectionId}'
          AND date >= '${formatDate(prevWeekStart)}'
          AND date < '${formatDate(prevWeekEnd)}'
        GROUP BY campaign_id
      `);

      const prevStatsMap = new Map(previousStats.map((s: any) => [s.campaign_id, s]));

      for (const current of currentStats) {
        const prev = prevStatsMap.get(current.campaign_id);
        if (!prev) continue;

        const currentImpressions = parseInt(current.impressions) || 0;
        const prevImpressions = parseInt(prev.impressions) || 0;
        const currentClicks = parseInt(current.clicks) || 0;
        const prevClicks = parseInt(prev.clicks) || 0;
        const currentCost = parseFloat(current.cost) || 0;
        const prevCost = parseFloat(prev.cost) || 0;
        const currentConversions = parseInt(current.conversions) || 0;
        const prevConversions = parseInt(prev.conversions) || 0;

        const currentCtr = currentImpressions > 0 ? (currentClicks / currentImpressions) * 100 : 0;
        const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
        const currentCpl = currentConversions > 0 ? currentCost / currentConversions : 0;
        const prevCpl = prevConversions > 0 ? prevCost / prevConversions : 0;

        // Check impressions drop
        if (settings.monitorImpressions && prevImpressions > 0) {
          const changePercent = ((currentImpressions - prevImpressions) / prevImpressions) * 100;
          if (changePercent < -settings.impressionsDropThreshold) {
            const alert = await this.createAlert({
              connectionId,
              userId,
              type: 'warning',
              category: 'impressions',
              title: 'Падение показов',
              message: `Показы кампании "${current.campaign_name}" упали на ${Math.abs(changePercent).toFixed(0)}% (${prevImpressions} → ${currentImpressions})`,
              campaignId: current.campaign_id,
              campaignName: current.campaign_name,
              metricName: 'impressions',
              previousValue: prevImpressions,
              currentValue: currentImpressions,
              changePercent: changePercent,
              threshold: settings.impressionsDropThreshold,
            });
            alerts.push({ id: alert } as any);
          }
        }

        // Check CTR drop
        if (settings.monitorCtr && prevCtr > 0) {
          const changePercent = ((currentCtr - prevCtr) / prevCtr) * 100;
          if (changePercent < -settings.ctrDropThreshold) {
            const alert = await this.createAlert({
              connectionId,
              userId,
              type: 'warning',
              category: 'ctr',
              title: 'Падение CTR',
              message: `CTR кампании "${current.campaign_name}" упал на ${Math.abs(changePercent).toFixed(0)}% (${prevCtr.toFixed(2)}% → ${currentCtr.toFixed(2)}%)`,
              campaignId: current.campaign_id,
              campaignName: current.campaign_name,
              metricName: 'ctr',
              previousValue: prevCtr,
              currentValue: currentCtr,
              changePercent: changePercent,
              threshold: settings.ctrDropThreshold,
            });
            alerts.push({ id: alert } as any);
          }
        }

        // Check conversions drop
        if (settings.monitorConversions && prevConversions > 0) {
          const changePercent = ((currentConversions - prevConversions) / prevConversions) * 100;
          if (changePercent < -settings.conversionsDropThreshold) {
            const alert = await this.createAlert({
              connectionId,
              userId,
              type: 'critical',
              category: 'conversions',
              title: 'Падение конверсий',
              message: `Конверсии кампании "${current.campaign_name}" упали на ${Math.abs(changePercent).toFixed(0)}% (${prevConversions} → ${currentConversions})`,
              campaignId: current.campaign_id,
              campaignName: current.campaign_name,
              metricName: 'conversions',
              previousValue: prevConversions,
              currentValue: currentConversions,
              changePercent: changePercent,
              threshold: settings.conversionsDropThreshold,
            });
            alerts.push({ id: alert } as any);
          }
        }

        // Check CPL increase
        if (settings.monitorCpl && prevCpl > 0) {
          const changePercent = ((currentCpl - prevCpl) / prevCpl) * 100;
          if (changePercent > settings.cplIncreaseThreshold) {
            const alert = await this.createAlert({
              connectionId,
              userId,
              type: 'critical',
              category: 'cpl',
              title: 'Рост стоимости лида',
              message: `CPL кампании "${current.campaign_name}" вырос на ${changePercent.toFixed(0)}% (${prevCpl.toFixed(0)}₽ → ${currentCpl.toFixed(0)}₽)`,
              campaignId: current.campaign_id,
              campaignName: current.campaign_name,
              metricName: 'cpl',
              previousValue: prevCpl,
              currentValue: currentCpl,
              changePercent: changePercent,
              threshold: settings.cplIncreaseThreshold,
            });
            alerts.push({ id: alert } as any);
          }
        }
      }

      // Check zero impressions (campaigns stopped)
      const zeroImpressionsCampaigns = currentStats.filter(
        (c: any) => parseInt(c.impressions) === 0 && parseInt(c.clicks) === 0
      );

      for (const campaign of zeroImpressionsCampaigns) {
        const prev = prevStatsMap.get(campaign.campaign_id);
        if (prev && parseInt(prev.impressions) > 100) {
          const alert = await this.createAlert({
            connectionId,
            userId,
            type: 'critical',
            category: 'impressions',
            title: 'Кампания остановлена',
            message: `Кампания "${campaign.campaign_name}" не получает показов. Проверьте статус и бюджет.`,
            campaignId: campaign.campaign_id,
            campaignName: campaign.campaign_name,
            metricName: 'impressions',
            previousValue: parseInt(prev.impressions),
            currentValue: 0,
            changePercent: -100,
          });
          alerts.push({ id: alert } as any);
        }
      }

      return alerts;
    } catch (error) {
      console.error('[Alerts] Failed to analyze and generate alerts:', error);
      return [];
    }
  },

  /**
   * Send email notification for alert
   * TODO: Implement proper email template sending when email service supports HTML emails
   */
  async sendEmailNotification(_alert: Alert, _email: string): Promise<boolean> {
    // Email notification is not yet implemented
    // The email service currently only supports verification codes
    // This is a placeholder for future implementation
    console.log('[Alerts] Email notifications not yet implemented');
    return false;
  },

  // Helper: map database row to Alert
  mapRowToAlert(row: any): Alert {
    return {
      id: row.id,
      connectionId: row.connection_id,
      userId: row.user_id,
      type: row.type,
      category: row.category,
      title: row.title,
      message: row.message,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      metricName: row.metric_name,
      previousValue: row.previous_value ? parseFloat(row.previous_value) : undefined,
      currentValue: row.current_value ? parseFloat(row.current_value) : undefined,
      changePercent: row.change_percent ? parseFloat(row.change_percent) : undefined,
      threshold: row.threshold ? parseFloat(row.threshold) : undefined,
      isRead: row.is_read === 1 || row.is_read === true,
      isDismissed: row.is_dismissed === 1 || row.is_dismissed === true,
      createdAt: new Date(row.created_at),
    };
  },

  // Helper: map database row to AlertSettings
  mapRowToSettings(row: any): AlertSettings {
    return {
      userId: row.user_id,
      emailNotifications: row.email_notifications === 1 || row.email_notifications === true,
      telegramNotifications: row.telegram_notifications === 1 || row.telegram_notifications === true,
      telegramChatId: row.telegram_chat_id,
      dailyDigest: row.daily_digest === 1 || row.daily_digest === true,
      digestTime: row.digest_time || '09:00',
      monitorBudget: row.monitor_budget === 1 || row.monitor_budget === true,
      monitorCtr: row.monitor_ctr === 1 || row.monitor_ctr === true,
      monitorConversions: row.monitor_conversions === 1 || row.monitor_conversions === true,
      monitorCpl: row.monitor_cpl === 1 || row.monitor_cpl === true,
      monitorImpressions: row.monitor_impressions === 1 || row.monitor_impressions === true,
      budgetThreshold: parseFloat(row.budget_threshold) || DEFAULT_SETTINGS.budgetThreshold,
      ctrDropThreshold: parseFloat(row.ctr_drop_threshold) || DEFAULT_SETTINGS.ctrDropThreshold,
      conversionsDropThreshold: parseFloat(row.conversions_drop_threshold) || DEFAULT_SETTINGS.conversionsDropThreshold,
      cplIncreaseThreshold: parseFloat(row.cpl_increase_threshold) || DEFAULT_SETTINGS.cplIncreaseThreshold,
      impressionsDropThreshold: parseFloat(row.impressions_drop_threshold) || DEFAULT_SETTINGS.impressionsDropThreshold,
    };
  },
};
