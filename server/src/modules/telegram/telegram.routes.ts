/**
 * Telegram Bot Routes
 * API для Telegram интеграции
 */

import express from 'express';
import { telegramService } from './telegram.service';
import { authenticate } from '../../middleware/auth';

const router = express.Router();

/**
 * POST /api/telegram/webhook
 * Telegram webhook endpoint (no auth required)
 */
router.post('/webhook', async (req, res) => {
  try {
    await telegramService.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    // Always return 200 to Telegram to prevent retries
    res.status(200).send('OK');
  }
});

/**
 * GET /api/telegram/check
 * Public endpoint to check if Telegram is configured (no auth)
 */
router.get('/check', (_req, res) => {
  const isConfigured = telegramService.isConfigured();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  res.json({
    isConfigured,
    hasToken: !!token,
    tokenLength: token?.length || 0,
  });
});

/**
 * GET /api/telegram/status
 * Check Telegram bot status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const isConfigured = telegramService.isConfigured();
    const connectedUser = await telegramService.getConnectedUser(userId);

    res.json({
      success: true,
      data: {
        isConfigured,
        isConnected: !!connectedUser,
        username: connectedUser?.username,
        firstName: connectedUser?.firstName,
      },
    });
  } catch (error: any) {
    console.error('Failed to get Telegram status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/telegram/connect-link
 * Generate Telegram connection link for current user
 */
router.get('/connect-link', authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId;

    if (!telegramService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'Telegram bot not configured',
      });
    }

    const link = await telegramService.generateConnectionLink(userId);

    res.json({ success: true, data: { link } });
  } catch (error: any) {
    console.error('Failed to generate Telegram link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/telegram/disconnect
 * Disconnect Telegram from current user
 */
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const success = await telegramService.disconnectUser(userId);

    res.json({ success });
  } catch (error: any) {
    console.error('Failed to disconnect Telegram:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/telegram/test
 * Send test message to connected Telegram
 */
router.post('/test', authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const connectedUser = await telegramService.getConnectedUser(userId);
    if (!connectedUser) {
      return res.status(400).json({
        success: false,
        error: 'Telegram not connected',
      });
    }

    const success = await telegramService.sendMessage(connectedUser.chatId, {
      text: '✅ Тестовое сообщение от Neurodirectolog\n\nВаш Telegram успешно подключён!',
      parse_mode: 'HTML',
    });

    res.json({ success });
  } catch (error: any) {
    console.error('Failed to send test message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
