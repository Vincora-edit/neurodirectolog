/**
 * Telegram Bot Service
 * Интеграция с Telegram для уведомлений и быстрых отчётов
 */

import { clickhouseService } from '../../services/clickhouse.service';
import { alertsService } from '../alerts/alerts.service';

// Telegram Bot API base URL
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

interface TelegramUser {
  id: string;
  odId: string;
  chatId: string;
  username?: string;
  firstName?: string;
  isActive: boolean;
  createdAt: Date;
}

interface TelegramMessage {
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: any;
}

export const telegramService = {
  /**
   * Get bot token from environment
   */
  getBotToken(): string | null {
    return process.env.TELEGRAM_BOT_TOKEN || null;
  },

  /**
   * Check if Telegram is configured
   */
  isConfigured(): boolean {
    return !!this.getBotToken();
  },

  /**
   * Send message to a chat
   */
  async sendMessage(chatId: string, message: TelegramMessage): Promise<boolean> {
    const token = this.getBotToken();
    if (!token) {
      console.error('[Telegram] Bot token not configured');
      return false;
    }

    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.text,
          parse_mode: message.parse_mode || 'HTML',
          reply_markup: message.reply_markup,
        }),
      });

      const data = await response.json() as { ok: boolean };
      if (!data.ok) {
        console.error('[Telegram] Failed to send message:', data);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Telegram] Error sending message:', error);
      return false;
    }
  },

  /**
   * Send alert notification
   */
  async sendAlertNotification(chatId: string, alert: {
    type: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    campaignName?: string;
    previousValue?: number;
    currentValue?: number;
    changePercent?: number;
  }): Promise<boolean> {
    const emoji = alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';

    let text = `${emoji} <b>${alert.title}</b>\n\n`;
    text += `${alert.message}\n`;

    if (alert.campaignName) {
      text += `\n📊 Кампания: ${alert.campaignName}`;
    }

    if (alert.previousValue !== undefined && alert.currentValue !== undefined) {
      text += `\n📈 Было: ${alert.previousValue} → Стало: ${alert.currentValue}`;
      if (alert.changePercent !== undefined) {
        text += ` (${alert.changePercent > 0 ? '+' : ''}${alert.changePercent.toFixed(1)}%)`;
      }
    }

    return this.sendMessage(chatId, { text, parse_mode: 'HTML' });
  },

  /**
   * Send daily digest
   */
  async sendDailyDigest(chatId: string, digest: {
    totalCost: number;
    totalClicks: number;
    totalConversions: number;
    avgCpl: number;
    costChange: number;
    conversionsChange: number;
    alerts: Array<{ type: string; title: string }>;
  }): Promise<boolean> {
    let text = `📊 <b>Ежедневный отчёт</b>\n\n`;

    text += `💰 Расход: ${digest.totalCost.toLocaleString('ru-RU')}₽`;
    if (digest.costChange !== 0) {
      text += ` (${digest.costChange > 0 ? '+' : ''}${digest.costChange.toFixed(1)}%)`;
    }
    text += '\n';

    text += `👆 Клики: ${digest.totalClicks.toLocaleString('ru-RU')}\n`;
    text += `🎯 Конверсии: ${digest.totalConversions}`;
    if (digest.conversionsChange !== 0) {
      text += ` (${digest.conversionsChange > 0 ? '+' : ''}${digest.conversionsChange.toFixed(1)}%)`;
    }
    text += '\n';

    text += `📉 CPL: ${digest.avgCpl > 0 ? Math.round(digest.avgCpl).toLocaleString('ru-RU') + '₽' : '—'}\n`;

    if (digest.alerts.length > 0) {
      text += `\n⚡ Алерты (${digest.alerts.length}):\n`;
      digest.alerts.slice(0, 5).forEach(alert => {
        const emoji = alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
        text += `${emoji} ${alert.title}\n`;
      });
      if (digest.alerts.length > 5) {
        text += `... и ещё ${digest.alerts.length - 5}\n`;
      }
    }

    return this.sendMessage(chatId, { text, parse_mode: 'HTML' });
  },

  /**
   * Send quick stats
   */
  async sendQuickStats(chatId: string, stats: {
    period: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    cpl: number;
  }): Promise<boolean> {
    let text = `📈 <b>Статистика за ${stats.period}</b>\n\n`;

    text += `👁 Показы: ${stats.impressions.toLocaleString('ru-RU')}\n`;
    text += `👆 Клики: ${stats.clicks.toLocaleString('ru-RU')}\n`;
    text += `💰 Расход: ${Math.round(stats.cost).toLocaleString('ru-RU')} ₽\n`;
    text += `📊 CTR: ${stats.ctr.toFixed(2)}%\n`;

    // Показываем конверсии и CPL только если есть данные
    if (stats.conversions > 0) {
      text += `🎯 Конверсии: ${stats.conversions}\n`;
      text += `📉 CPL: ${stats.cpl > 0 ? Math.round(stats.cpl).toLocaleString('ru-RU') + ' ₽' : '—'}\n`;
    }

    // Добавляем средний CPC
    const avgCpc = stats.clicks > 0 ? stats.cost / stats.clicks : 0;
    text += `💵 Ср. CPC: ${avgCpc > 0 ? avgCpc.toFixed(2) + ' ₽' : '—'}\n`;

    return this.sendMessage(chatId, { text, parse_mode: 'HTML' });
  },

  /**
   * Generate connection link for user
   */
  async generateConnectionLink(userId: string): Promise<string> {
    const token = this.getBotToken();
    if (!token) {
      throw new Error('Telegram bot not configured');
    }

    // Get bot username
    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${token}/getMe`);
      const data = await response.json() as { ok: boolean; result?: { username: string } };
      if (!data.ok) {
        throw new Error('Failed to get bot info');
      }

      const botUsername = data.result?.username;
      const startParam = Buffer.from(userId).toString('base64').replace(/=/g, '');

      return `https://t.me/${botUsername}?start=${startParam}`;
    } catch (error) {
      console.error('[Telegram] Error generating connection link:', error);
      throw error;
    }
  },

  /**
   * Handle incoming webhook update
   */
  async handleUpdate(update: any): Promise<void> {
    // Handle callback queries (inline button clicks)
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    if (!update.message) return;

    const chatId = update.message.chat.id.toString();
    const text = update.message.text || '';
    const userId = update.message.from?.id?.toString();

    // Handle /start command with connection param
    if (text.startsWith('/start ')) {
      const param = text.replace('/start ', '');
      try {
        const decodedUserId = Buffer.from(param, 'base64').toString();
        await this.connectUser(decodedUserId, chatId, update.message.from);
        await this.sendMessage(chatId, {
          text: '✅ <b>Telegram подключён!</b>\n\nТеперь вы будете получать уведомления о важных событиях в ваших рекламных кампаниях.\n\nДоступные команды:\n/stats - Быстрая статистика\n/alerts - Последние алерты\n/help - Помощь',
          parse_mode: 'HTML',
        });
      } catch (error) {
        console.error('[Telegram] Failed to connect user:', error);
        await this.sendMessage(chatId, {
          text: '❌ Не удалось подключить аккаунт. Попробуйте получить новую ссылку в настройках.',
        });
      }
      return;
    }

    // Handle /start without param
    if (text === '/start') {
      await this.sendMessage(chatId, {
        text: '👋 Привет! Это бот Neurodirectolog.\n\nДля подключения уведомлений перейдите в настройки системы и нажмите "Подключить Telegram".',
      });
      return;
    }

    // Handle /stats command - quick today stats for all projects
    if (text === '/stats' || text === '/статистика') {
      await this.handleStatsCommand(chatId, 'today', 'all');
      return;
    }

    // Handle /report command - show project selection first
    if (text === '/report' || text === '/отчет' || text === '/отчёт') {
      await this.showProjectSelection(chatId);
      return;
    }

    // Handle /alerts command
    if (text === '/alerts' || text === '/алерты') {
      await this.handleAlertsCommand(chatId, userId);
      return;
    }

    // Handle /help command
    if (text === '/help' || text === '/помощь') {
      await this.sendMessage(chatId, {
        text: '📋 <b>Доступные команды:</b>\n\n/stats - Быстрая статистика за сегодня\n/report - Отчёт за выбранный период\n/alerts - Последние алерты\n/help - Эта справка\n\n💡 Бот автоматически отправляет уведомления о важных событиях: падение конверсий, рост CPL, остановка кампаний и др.',
        parse_mode: 'HTML',
      });
      return;
    }

    // Unknown command
    await this.sendMessage(chatId, {
      text: 'Неизвестная команда. Введите /help для списка команд.',
    });
  },

  /**
   * Connect Telegram user to app user
   */
  async connectUser(appUserId: string, chatId: string, telegramUser: any): Promise<void> {
    try {
      await clickhouseService.exec(`
        INSERT INTO telegram_users (
          id, user_id, chat_id, username, first_name, is_active, created_at
        ) VALUES (
          generateUUIDv4(),
          '${appUserId}',
          '${chatId}',
          ${telegramUser.username ? `'${telegramUser.username}'` : 'NULL'},
          ${telegramUser.first_name ? `'${telegramUser.first_name.replace(/'/g, "''")}'` : 'NULL'},
          1,
          now()
        )
      `);

      // Update alert settings
      await alertsService.updateSettings(appUserId, {
        telegramNotifications: true,
        telegramChatId: chatId,
      });
    } catch (error) {
      console.error('[Telegram] Failed to connect user:', error);
      throw error;
    }
  },

  /**
   * Show project selection for report
   */
  async showProjectSelection(chatId: string): Promise<void> {
    try {
      // Find app user by chat_id
      const users = await clickhouseService.query(`
        SELECT user_id
        FROM telegram_users FINAL
        WHERE chat_id = '${chatId}'
          AND is_active = 1
        LIMIT 1
      `);

      if (users.length === 0) {
        await this.sendMessage(chatId, {
          text: '❌ Ваш аккаунт не подключён. Перейдите в настройки системы для подключения.',
        });
        return;
      }

      const userId = users[0].user_id;

      // Get user's connections with project names
      const connections = await clickhouseService.query(`
        SELECT
          c.id as connection_id,
          c.login,
          p.name as project_name
        FROM yandex_direct_connections c FINAL
        LEFT JOIN projects p FINAL ON c.project_id = p.id
        WHERE c.user_id = '${userId}'
          AND c.status = 'active'
      `);

      if (connections.length === 0) {
        await this.sendMessage(chatId, {
          text: 'У вас нет активных подключений к Яндекс.Директ.',
        });
        return;
      }

      // Build keyboard with projects
      const keyboard: any[][] = [];

      // Add "All projects" button if more than 1 connection
      if (connections.length > 1) {
        keyboard.push([{ text: '📊 Все проекты', callback_data: 'proj_all' }]);
      }

      // Add individual project buttons
      for (const conn of connections) {
        const projectName = conn.project_name || conn.login;
        keyboard.push([{
          text: `📁 ${projectName}`,
          callback_data: `proj_${conn.connection_id}`
        }]);
      }

      await this.sendMessage(chatId, {
        text: '📁 <b>Выберите проект для отчёта:</b>',
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      console.error('[Telegram] Failed to show project selection:', error);
      await this.sendMessage(chatId, {
        text: '❌ Произошла ошибка при получении списка проектов.',
      });
    }
  },

  /**
   * Show period selection for report
   */
  async showReportPeriodSelection(chatId: string, connectionId: string): Promise<void> {
    await this.sendMessage(chatId, {
      text: '📊 <b>Выберите период для отчёта:</b>',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📅 Сегодня', callback_data: `period_today_${connectionId}` },
            { text: '📅 Вчера', callback_data: `period_yesterday_${connectionId}` },
          ],
          [
            { text: '📆 7 дней', callback_data: `period_week_${connectionId}` },
            { text: '📆 30 дней', callback_data: `period_month_${connectionId}` },
          ],
          [
            { text: '📆 Этот месяц', callback_data: `period_this_month_${connectionId}` },
            { text: '📆 Прошлый месяц', callback_data: `period_last_month_${connectionId}` },
          ],
        ],
      },
    });
  },

  /**
   * Handle callback query (inline button clicks)
   */
  async handleCallbackQuery(callbackQuery: any): Promise<void> {
    const chatId = callbackQuery.message?.chat?.id?.toString();
    const callbackId = callbackQuery.id;
    const data = callbackQuery.data;

    if (!chatId || !data) return;

    // Answer callback to remove loading state
    await this.answerCallbackQuery(callbackId);

    // Handle project selection
    if (data.startsWith('proj_')) {
      const connectionId = data.replace('proj_', '');
      await this.showReportPeriodSelection(chatId, connectionId);
      return;
    }

    // Handle period selection (format: period_<period>_<connectionId>)
    if (data.startsWith('period_')) {
      const parts = data.replace('period_', '').split('_');
      const period = parts[0];
      const connectionId = parts.slice(1).join('_'); // Handle UUIDs with underscores
      await this.handleStatsCommand(chatId, period, connectionId);
      return;
    }
  },

  /**
   * Answer callback query
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    const token = this.getBotToken();
    if (!token) return;

    try {
      await fetch(`${TELEGRAM_API_BASE}${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
        }),
      });
    } catch (error) {
      console.error('[Telegram] Failed to answer callback query:', error);
    }
  },

  /**
   * Handle /stats command with project selection
   */
  async handleStatsCommand(chatId: string, period: string = 'today', connectionId: string = 'all'): Promise<void> {
    try {
      // Find app user by chat_id
      const users = await clickhouseService.query(`
        SELECT user_id
        FROM telegram_users FINAL
        WHERE chat_id = '${chatId}'
          AND is_active = 1
        LIMIT 1
      `);

      if (users.length === 0) {
        await this.sendMessage(chatId, {
          text: '❌ Ваш аккаунт не подключён. Перейдите в настройки системы для подключения.',
        });
        return;
      }

      const userId = users[0].user_id;

      // Get connections based on selection
      let connections: any[];
      let projectName = 'все проекты';

      if (connectionId === 'all') {
        connections = await clickhouseService.query(`
          SELECT id, login, conversion_goals
          FROM yandex_direct_connections FINAL
          WHERE user_id = '${userId}'
            AND status = 'active'
        `);
      } else {
        connections = await clickhouseService.query(`
          SELECT c.id, c.login, c.conversion_goals, p.name as project_name
          FROM yandex_direct_connections c FINAL
          LEFT JOIN projects p FINAL ON c.project_id = p.id
          WHERE c.id = '${connectionId}'
            AND c.user_id = '${userId}'
            AND c.status = 'active'
        `);
        if (connections.length > 0) {
          projectName = connections[0].project_name || connections[0].login;
        }
      }

      if (connections.length === 0) {
        await this.sendMessage(chatId, {
          text: 'У вас нет активных подключений к Яндекс.Директ.',
        });
        return;
      }

      // Calculate date range based on period
      const { startDate, endDate, periodName } = this.getDateRange(period);
      const connectionIds = connections.map((c: any) => `'${c.id}'`).join(',');

      // Get basic stats
      const stats = await clickhouseService.query(`
        SELECT
          sum(impressions) as impressions,
          sum(clicks) as clicks,
          sum(cost) as cost
        FROM campaign_performance
        WHERE connection_id IN (${connectionIds})
          AND date >= '${startDate}'
          AND date <= '${endDate}'
      `);

      const s = stats[0] || {};
      const impressions = parseInt(s.impressions) || 0;
      const clicks = parseInt(s.clicks) || 0;
      const cost = parseFloat(s.cost) || 0;

      // Get KPI goals for the current month
      const currentMonth = new Date().toISOString().slice(0, 7);
      const kpiGoals = await clickhouseService.query(`
        SELECT goal_ids
        FROM account_kpi FINAL
        WHERE connection_id IN (${connectionIds})
          AND month = '${currentMonth}'
        LIMIT 1
      `);

      // Parse KPI goal IDs
      let kpiGoalIds: string[] = [];
      if (kpiGoals.length > 0 && kpiGoals[0].goal_ids) {
        try {
          kpiGoalIds = JSON.parse(kpiGoals[0].goal_ids);
        } catch (e) {
          // If not JSON, try to parse as array string
          const match = kpiGoals[0].goal_ids.match(/\d+/g);
          if (match) kpiGoalIds = match;
        }
      }

      // Get conversions - either from KPI goals or all goals
      let conversionsQuery: string;
      if (kpiGoalIds.length > 0) {
        const goalIdsStr = kpiGoalIds.map(g => `'${g}'`).join(',');
        conversionsQuery = `
          SELECT
            goal_id,
            sum(conversions) as conversions
          FROM campaign_conversions
          WHERE connection_id IN (${connectionIds})
            AND date >= '${startDate}'
            AND date <= '${endDate}'
            AND goal_id IN (${goalIdsStr})
          GROUP BY goal_id
        `;
      } else {
        conversionsQuery = `
          SELECT
            goal_id,
            sum(conversions) as conversions
          FROM campaign_conversions
          WHERE connection_id IN (${connectionIds})
            AND date >= '${startDate}'
            AND date <= '${endDate}'
          GROUP BY goal_id
        `;
      }

      const conversionsData = await clickhouseService.query(conversionsQuery);

      // Calculate total conversions
      let totalConversions = 0;
      const conversionsByGoal: { goalId: string; conversions: number }[] = [];

      for (const row of conversionsData) {
        const convs = parseInt(row.conversions) || 0;
        totalConversions += convs;
        conversionsByGoal.push({ goalId: row.goal_id, conversions: convs });
      }

      // Calculate CPL
      const cpl = totalConversions > 0 ? cost / totalConversions : 0;

      // Send detailed report
      await this.sendDetailedStats(chatId, {
        projectName,
        period: periodName,
        impressions,
        clicks,
        cost,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        avgCpc: clicks > 0 ? cost / clicks : 0,
        totalConversions,
        cpl,
        conversionsByGoal,
        hasKpiGoals: kpiGoalIds.length > 0,
      });
    } catch (error) {
      console.error('[Telegram] Failed to handle stats command:', error);
      await this.sendMessage(chatId, {
        text: '❌ Произошла ошибка при получении статистики.',
      });
    }
  },

  /**
   * Send detailed stats message
   */
  async sendDetailedStats(chatId: string, stats: {
    projectName: string;
    period: string;
    impressions: number;
    clicks: number;
    cost: number;
    ctr: number;
    avgCpc: number;
    totalConversions: number;
    cpl: number;
    conversionsByGoal: { goalId: string; conversions: number }[];
    hasKpiGoals: boolean;
  }): Promise<boolean> {
    let text = `📈 <b>Отчёт: ${stats.projectName}</b>\n`;
    text += `📅 Период: ${stats.period}\n\n`;

    text += `👁 Показы: ${stats.impressions.toLocaleString('ru-RU')}\n`;
    text += `👆 Клики: ${stats.clicks.toLocaleString('ru-RU')}\n`;
    text += `💰 Расход: ${Math.round(stats.cost).toLocaleString('ru-RU')} ₽\n`;
    text += `📊 CTR: ${stats.ctr.toFixed(2)}%\n`;
    text += `💵 Ср. CPC: ${stats.avgCpc > 0 ? stats.avgCpc.toFixed(2) + ' ₽' : '—'}\n`;

    text += `\n<b>🎯 Конверсии${stats.hasKpiGoals ? ' (KPI)' : ''}:</b>\n`;

    if (stats.totalConversions > 0) {
      text += `Всего: <b>${stats.totalConversions}</b>\n`;
      text += `📉 CPL: <b>${Math.round(stats.cpl).toLocaleString('ru-RU')} ₽</b>\n`;

      if (stats.conversionsByGoal.length > 1) {
        text += '\nПо целям:\n';
        for (const goal of stats.conversionsByGoal) {
          const goalCpl = goal.conversions > 0 ? stats.cost / goal.conversions : 0;
          text += `• Цель ${goal.goalId}: ${goal.conversions} (CPL: ${Math.round(goalCpl).toLocaleString('ru-RU')} ₽)\n`;
        }
      }
    } else {
      text += `Нет данных по конверсиям за этот период\n`;
    }

    return this.sendMessage(chatId, { text, parse_mode: 'HTML' });
  },

  /**
   * Get date range for period
   */
  getDateRange(period: string): { startDate: string; endDate: string; periodName: string } {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    switch (period) {
      case 'today': {
        const date = formatDate(today);
        return { startDate: date, endDate: date, periodName: 'сегодня' };
      }
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const date = formatDate(yesterday);
        return { startDate: date, endDate: date, periodName: 'вчера' };
      }
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 6);
        return { startDate: formatDate(weekAgo), endDate: formatDate(today), periodName: 'последние 7 дней' };
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 29);
        return { startDate: formatDate(monthAgo), endDate: formatDate(today), periodName: 'последние 30 дней' };
      }
      case 'this_month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: formatDate(firstDay), endDate: formatDate(today), periodName: 'этот месяц' };
      }
      case 'last_month': {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return { startDate: formatDate(firstDayLastMonth), endDate: formatDate(lastDayLastMonth), periodName: 'прошлый месяц' };
      }
      default:
        const date = formatDate(today);
        return { startDate: date, endDate: date, periodName: 'сегодня' };
    }
  },

  /**
   * Handle /alerts command
   */
  async handleAlertsCommand(chatId: string, _telegramUserId?: string): Promise<void> {
    try {
      // Find app user by chat_id
      const users = await clickhouseService.query(`
        SELECT user_id
        FROM telegram_users FINAL
        WHERE chat_id = '${chatId}'
          AND is_active = 1
        LIMIT 1
      `);

      if (users.length === 0) {
        await this.sendMessage(chatId, {
          text: '❌ Ваш аккаунт не подключён.',
        });
        return;
      }

      const userId = users[0].user_id;

      // Get recent alerts
      const alerts = await alertsService.getAlerts(userId, { limit: 5 });

      if (alerts.length === 0) {
        await this.sendMessage(chatId, {
          text: '✅ Нет новых алертов. Всё работает хорошо!',
        });
        return;
      }

      let text = `⚡ <b>Последние алерты (${alerts.length}):</b>\n\n`;

      alerts.forEach(alert => {
        const emoji = alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
        const readMark = alert.isRead ? '' : '🔵 ';
        text += `${readMark}${emoji} <b>${alert.title}</b>\n`;
        text += `${alert.message}\n\n`;
      });

      await this.sendMessage(chatId, { text, parse_mode: 'HTML' });
    } catch (error) {
      console.error('[Telegram] Failed to handle alerts command:', error);
      await this.sendMessage(chatId, {
        text: '❌ Произошла ошибка при получении алертов.',
      });
    }
  },

  /**
   * Disconnect user
   */
  async disconnectUser(userId: string): Promise<boolean> {
    try {
      await clickhouseService.exec(`
        ALTER TABLE telegram_users UPDATE is_active = 0
        WHERE user_id = '${userId}'
      `);

      await alertsService.updateSettings(userId, {
        telegramNotifications: false,
        telegramChatId: undefined,
      });

      return true;
    } catch (error) {
      console.error('[Telegram] Failed to disconnect user:', error);
      return false;
    }
  },

  /**
   * Get connected user info
   */
  async getConnectedUser(userId: string): Promise<TelegramUser | null> {
    try {
      const users = await clickhouseService.query(`
        SELECT *
        FROM telegram_users FINAL
        WHERE user_id = '${userId}'
          AND is_active = 1
        LIMIT 1
      `);

      if (users.length === 0) return null;

      const row = users[0];
      return {
        id: row.id,
        odId: row.user_id,
        chatId: row.chat_id,
        username: row.username,
        firstName: row.first_name,
        isActive: row.is_active === 1,
        createdAt: new Date(row.created_at),
      };
    } catch (error) {
      console.error('[Telegram] Failed to get connected user:', error);
      return null;
    }
  },
};
