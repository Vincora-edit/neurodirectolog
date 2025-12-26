/**
 * Yandex Routes Index
 * Объединяет все подмодули Yandex API
 */

import express from 'express';

import authRouter from './auth';
import connectionsRouter from './connections';
import statsRouter from './stats';
import reportsRouter from './reports';
import kpiRouter from './kpi';
import goalsRouter from './goals';
import syncRouter from './sync';

const router = express.Router();

// Auth routes: /auth-url, /connect, /connect-simple, /exchange-code, /agency-clients, /connect-agency-client
router.use('/', authRouter);

// Connection routes: /connections/:projectId, /connection/:projectId, /connection/:connectionId (CRUD), /campaigns/:projectId
router.use('/', connectionsRouter);

// Stats routes: /stats/:projectId, /campaign-stats/:campaignId, /detailed-stats/:projectId, /hierarchical-stats/:projectId, /daily-stats/:projectId
router.use('/', statsRouter);

// Reports routes: /search-queries, /demographics, /geo-stats, /geo-report, /device-stats, /placements, /income, /targeting-categories, /criteria, /ad-texts
router.use('/', reportsRouter);

// KPI routes: /kpi/:connectionId, /landing-pages/:projectId, /budget-forecast/:connectionId, /recommendations/:connectionId
router.use('/', kpiRouter);

// Goals routes: /available-goals/:projectId, /load-goals, /metrika/goals/:counterId, /connection/:connectionId/goals
router.use('/', goalsRouter);

// Sync routes: /sync/:projectId, /sync-all
router.use('/', syncRouter);

export default router;
