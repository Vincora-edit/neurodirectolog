/**
 * Alerts Routes
 * API для системы уведомлений
 */

import express from 'express';
import { alertsService } from '../services/alerts.service';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/alerts
 * Get all alerts for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { connectionId, unreadOnly, limit, offset } = req.query;

    const alerts = await alertsService.getAlerts(userId, {
      connectionId: connectionId as string,
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({ success: true, data: alerts });
  } catch (error: any) {
    console.error('Failed to get alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/alerts/unread-count
 * Get unread alerts count
 */
router.get('/unread-count', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { connectionId } = req.query;

    const count = await alertsService.getUnreadCount(userId, connectionId as string);

    res.json({ success: true, data: { count } });
  } catch (error: any) {
    console.error('Failed to get unread count:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/alerts/:id/read
 * Mark an alert as read
 */
router.post('/:id/read', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const success = await alertsService.markAsRead(id, userId);

    res.json({ success });
  } catch (error: any) {
    console.error('Failed to mark alert as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/alerts/read-all
 * Mark all alerts as read
 */
router.post('/read-all', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { connectionId } = req.body;

    const success = await alertsService.markAllAsRead(userId, connectionId);

    res.json({ success });
  } catch (error: any) {
    console.error('Failed to mark all as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/alerts/:id/dismiss
 * Dismiss an alert
 */
router.post('/:id/dismiss', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const success = await alertsService.dismissAlert(id, userId);

    res.json({ success });
  } catch (error: any) {
    console.error('Failed to dismiss alert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/alerts/settings
 * Get user alert settings
 */
router.get('/settings', async (req, res) => {
  try {
    const userId = (req as any).userId;

    const settings = await alertsService.getSettings(userId);

    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Failed to get alert settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/alerts/settings
 * Update user alert settings
 */
router.put('/settings', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const settings = req.body;

    const success = await alertsService.updateSettings(userId, settings);

    res.json({ success });
  } catch (error: any) {
    console.error('Failed to update alert settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/alerts/analyze/:connectionId
 * Manually trigger alert analysis for a connection
 */
router.post('/analyze/:connectionId', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { connectionId } = req.params;

    const alerts = await alertsService.analyzeAndGenerateAlerts(connectionId, userId);

    res.json({ success: true, data: { alertsGenerated: alerts.length } });
  } catch (error: any) {
    console.error('Failed to analyze and generate alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
