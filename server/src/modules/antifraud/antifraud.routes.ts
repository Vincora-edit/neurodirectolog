/**
 * Antifraud Routes
 * API для управления антифрод-защитой
 */

import express from 'express';
import { antifraudService } from './antifraud.service';
import { authenticate } from '../../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/antifraud/settings/:connectionId
 * Get antifraud settings for a connection
 */
router.get('/settings/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;

    const settings = await antifraudService.getSettings(connectionId);
    if (!settings) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }

    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('[Antifraud] Failed to get settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/antifraud/settings/:connectionId
 * Update antifraud settings
 */
router.put('/settings/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { metrikaId, threshold, enableHoneypot, enabled } = req.body;

    const success = await antifraudService.saveSettings({
      connectionId,
      metrikaId,
      threshold,
      enableHoneypot,
      enabled,
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save settings',
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Antifraud] Failed to update settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/antifraud/enable/:connectionId
 * Enable antifraud for a connection
 */
router.post('/enable/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { metrikaId } = req.body;

    if (!metrikaId) {
      return res.status(400).json({
        success: false,
        error: 'metrikaId is required',
      });
    }

    const success = await antifraudService.enable(connectionId, metrikaId);

    res.json({ success });
  } catch (error: any) {
    console.error('[Antifraud] Failed to enable:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/antifraud/disable/:connectionId
 * Disable antifraud for a connection
 */
router.post('/disable/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;

    const success = await antifraudService.disable(connectionId);

    res.json({ success });
  } catch (error: any) {
    console.error('[Antifraud] Failed to disable:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/antifraud/script/:connectionId
 * Generate antifraud script for a connection
 */
router.get('/script/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { minified, debug } = req.query;

    const result = await antifraudService.generateScript(connectionId, {
      minified: minified === 'true',
      debug: debug === 'true',
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }

    res.json({
      success: true,
      data: {
        script: result.script,
        settings: result.settings,
        instructions: antifraudService.getInstallationInstructions(result.settings.metrikaId),
      },
    });
  } catch (error: any) {
    console.error('[Antifraud] Failed to generate script:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/antifraud/script/:connectionId/download
 * Download antifraud script as a file
 */
router.get('/script/:connectionId/download', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { minified } = req.query;

    const result = await antifraudService.generateScript(connectionId, {
      minified: minified === 'true',
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }

    const filename = minified === 'true'
      ? 'antifraud.min.js'
      : 'antifraud.js';

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(result.script);
  } catch (error: any) {
    console.error('[Antifraud] Failed to download script:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/antifraud/generate
 * Generate standalone script without saving settings
 * Useful for quick testing
 */
router.post('/generate', async (req, res) => {
  try {
    const { metrikaId, threshold, enableHoneypot, minified, debug } = req.body;

    if (!metrikaId) {
      return res.status(400).json({
        success: false,
        error: 'metrikaId is required',
      });
    }

    const script = antifraudService.generateStandaloneScript(metrikaId, {
      threshold,
      enableHoneypot,
      minified,
      debug,
    });

    res.json({
      success: true,
      data: {
        script,
        instructions: antifraudService.getInstallationInstructions(metrikaId),
      },
    });
  } catch (error: any) {
    console.error('[Antifraud] Failed to generate standalone script:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/antifraud/instructions
 * Get installation instructions
 */
router.get('/instructions', async (req, res) => {
  try {
    const { metrikaId } = req.query;

    const instructions = antifraudService.getInstallationInstructions(
      (metrikaId as string) || 'YOUR_METRIKA_ID'
    );

    res.json({ success: true, data: { instructions } });
  } catch (error: any) {
    console.error('[Antifraud] Failed to get instructions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
