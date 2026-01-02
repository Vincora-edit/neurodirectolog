/**
 * Search Queries Analysis Routes
 * API для анализа поисковых запросов
 */

import express from 'express';
import { searchQueriesService } from '../services/search-queries.service';
import { clickhouseService } from '../services/clickhouse.service';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/search-queries/:connectionId
 * Get raw search queries for a connection
 */
router.get('/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { dateFrom, dateTo, campaignId, days } = req.query;

    // Calculate dates
    let startDate: string;
    let endDate: string;

    if (dateFrom && dateTo) {
      startDate = dateFrom as string;
      endDate = dateTo as string;
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - parseInt((days as string) || '30'));
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
    }

    const queries = await searchQueriesService.getSearchQueries(
      connectionId,
      startDate,
      endDate,
      campaignId as string
    );

    res.json({ success: true, data: queries });
  } catch (error: any) {
    console.error('Failed to get search queries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/search-queries/:connectionId/analyze
 * Analyze search queries with AI
 */
router.post('/:connectionId/analyze', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { connectionId } = req.params;
    const { dateFrom, dateTo, campaignId, businessDescription, targetCpl, useAi = true } = req.body;

    // Get queries
    const queries = await searchQueriesService.getSearchQueries(
      connectionId,
      dateFrom,
      dateTo,
      campaignId
    );

    if (queries.length === 0) {
      return res.json({
        success: true,
        data: {
          totalQueries: 0,
          targetQueries: [],
          trashQueries: [],
          reviewQueries: [],
          suggestedMinusWords: [],
          summary: {
            totalCost: 0,
            wastedCost: 0,
            potentialSavings: 0,
            avgCplTarget: 0,
            avgCplTrash: 0,
          },
        },
      });
    }

    let analysis;

    if (useAi && businessDescription) {
      // AI-powered analysis
      analysis = await searchQueriesService.analyzeQueries(
        queries,
        businessDescription,
        targetCpl
      );
    } else {
      // Quick rule-based analysis
      analysis = searchQueriesService.quickAnalysis(queries, {
        maxCpl: targetCpl || 5000,
      });
    }

    // Save analysis result
    await searchQueriesService.saveAnalysis(
      connectionId,
      userId,
      analysis,
      dateFrom,
      dateTo
    );

    res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error('Failed to analyze search queries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/search-queries/:connectionId/quick-analyze
 * Quick analysis without AI (rule-based)
 */
router.post('/:connectionId/quick-analyze', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { dateFrom, dateTo, campaignId, maxCpl, minClicks, stopWords } = req.body;

    // Get queries
    const queries = await searchQueriesService.getSearchQueries(
      connectionId,
      dateFrom,
      dateTo,
      campaignId
    );

    if (queries.length === 0) {
      return res.json({
        success: true,
        data: {
          totalQueries: 0,
          targetQueries: [],
          trashQueries: [],
          reviewQueries: [],
          suggestedMinusWords: [],
          summary: {
            totalCost: 0,
            wastedCost: 0,
            potentialSavings: 0,
            avgCplTarget: 0,
            avgCplTrash: 0,
          },
        },
      });
    }

    const analysis = searchQueriesService.quickAnalysis(queries, {
      maxCpl,
      minClicks,
      stopWords,
    });

    res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error('Failed to quick analyze search queries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/search-queries/:connectionId/history
 * Get analysis history
 */
router.get('/:connectionId/history', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { connectionId } = req.params;
    const { limit = '10' } = req.query;

    const history = await clickhouseService.query(`
      SELECT *
      FROM search_query_analyses
      WHERE connection_id = '${connectionId}'
        AND user_id = '${userId}'
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit as string)}
    `);

    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Failed to get analysis history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/search-queries/manual/analyze
 * Analyze manually pasted search queries
 */
router.post('/manual/analyze', async (req, res) => {
  try {
    const { queries, businessDescription, targetCpl, useAi = false } = req.body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ success: false, error: 'queries array is required' });
    }

    // Convert manual queries to SearchQuery format
    const searchQueries = queries.map((q: any) => ({
      query: q.query || '',
      impressions: q.impressions || 0,
      clicks: q.clicks || 0,
      cost: q.cost || 0,
      conversions: q.conversions || 0,
      ctr: q.clicks > 0 && q.impressions > 0 ? (q.clicks / q.impressions) * 100 : 0,
      avgCpc: q.clicks > 0 ? q.cost / q.clicks : 0,
      cpl: q.conversions > 0 ? q.cost / q.conversions : 0,
    }));

    let analysis;

    if (useAi && businessDescription) {
      // AI-powered analysis
      analysis = await searchQueriesService.analyzeQueries(
        searchQueries,
        businessDescription,
        targetCpl
      );
    } else {
      // Quick rule-based analysis
      analysis = searchQueriesService.quickAnalysis(searchQueries, {
        maxCpl: targetCpl || 5000,
      });
    }

    res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error('Failed to analyze manual queries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/search-queries/:connectionId/export-minus-words
 * Export minus words to text file
 */
router.post('/:connectionId/export-minus-words', async (req, res) => {
  try {
    const { minusWords } = req.body;

    if (!minusWords || !Array.isArray(minusWords)) {
      return res.status(400).json({ success: false, error: 'minusWords array required' });
    }

    // Format as Yandex.Direct compatible minus words
    const formatted = minusWords.map((mw: any) => {
      const word = typeof mw === 'string' ? mw : mw.word;
      return word.startsWith('-') ? word : `-${word}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=minus-words.txt');
    res.send(formatted);
  } catch (error: any) {
    console.error('Failed to export minus words:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
