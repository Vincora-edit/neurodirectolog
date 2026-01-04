/**
 * Authentication middleware for AI service
 *
 * Uses shared secret between main server and AI service
 * to authenticate internal API calls
 */

import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  serviceId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const serviceSecret = process.env.AI_SERVICE_SECRET;

  if (!serviceSecret) {
    console.error('[Auth] AI_SERVICE_SECRET not configured');
    return res.status(500).json({
      success: false,
      error: 'Service not properly configured',
    });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.slice(7);

  if (token !== serviceSecret) {
    return res.status(403).json({
      success: false,
      error: 'Invalid service token',
    });
  }

  req.serviceId = 'main-server';
  next();
}
