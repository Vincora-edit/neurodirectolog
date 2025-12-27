/**
 * Telegram Bot Service
 * Интеграция с Telegram для уведомлений и быстрых отчётов
 */

import { clickhouseService } from './clickhouse.service';
import { alertsService } from './alerts.service';

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
    text += `💰 Расход: ${stats.cost.toLocaleString('ru-RU')}₽\n`;
    text += `🎯 Конверсии: ${stats.conversions}\n`;
    text += `📊 CTR: ${stats.ctr.toFixed(2)}%\n`;
    text += `📉 CPL: ${stats.cpl > 0 ? Math.round(stats.cpl).toLocaleString('ru-RU') + '₽' : '—'}\n`;

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

    // Handle /stats command - quick today stats
    if (text === '/stats' || text === '/статистика') {
      await this.handleStatsCommand(chatId, 'today');
      return;
    }

    // Handle /report command - show period selection
    if (text === '/report' || text === '/отчет' || text === '/отчёт') {
      await this.showReportPeriodSelection(chatId);
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
   * Show period selection for report
   */
  async showReportPeriodSelection(chatId: string): Promise<void> {
    await this.sendMessage(chatId, {
      text: '📊 <b>Выберите период для отчёта:</b>',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📅 Сегодня', callback_data: 'report_today' },
            { text: '📅 Вчера', callback_data: 'report_yesterday' },
          ],
          [
            { text: '📆 Последние 7 дней', callback_data: 'report_week' },
            { text: '📆 Последние 30 дней', callback_data: 'report_month' },
          ],
          [
            { text: '📆 Этот месяц', callback_data: 'report_this_month' },
            { text: '📆 Прошлый месяц', callback_data: 'report_last_month' },
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

    // Handle report period selection
    if (data.startsWith('report_')) {
      const period = data.replace('report_', '');
      await this.handleStatsCommand(chatId, period);
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
   * Handle /stats command
   */
  async handleStatsCommand(chatId: string, period: string = 'today'): Promise<void> {
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

      // Get user's connections
      const connections = await clickhouseService.query(`
        SELECT id, login
        FROM yandex_direct_connections FINAL
        WHERE user_id = '${userId}'
          AND status = 'active'
      `);

      if (connections.length === 0) {
        await this.sendMessage(chatId, {
          text: 'У вас нет активных подключений к Яндекс.Директ.',
        });
        return;
      }

      // Calculate date range based on period
      const { startDate, endDate, periodName } = this.getDateRange(period);
      const connectionIds = connections.map((c: any) => `'${c.id}'`).join(',');

      const stats = await clickhouseService.query(`
        SELECT
          sum(impressions) as impressions,
          sum(clicks) as clicks,
          sum(cost) as cost,
          sum(conversions) as conversions
        FROM campaign_performance
        WHERE connection_id IN (${connectionIds})
          AND date >= '${startDate}'
          AND date <= '${endDate}'
      `);

      const s = stats[0] || {};
      const impressions = parseInt(s.impressions) || 0;
      const clicks = parseInt(s.clicks) || 0;
      const cost = parseFloat(s.cost) || 0;
      const conversions = parseInt(s.conversions) || 0;

      await this.sendQuickStats(chatId, {
        period: periodName,
        impressions,
        clicks,
        cost,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpl: conversions > 0 ? cost / conversions : 0,
      });
    } catch (error) {
      console.error('[Telegram] Failed to handle stats command:', error);
      await this.sendMessage(chatId, {
        text: '❌ Произошла ошибка при получении статистики.',
      });
    }
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
