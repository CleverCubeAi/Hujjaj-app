import { Request, Response, NextFunction } from 'express';
import {
  assertFeatureEnabled,
  assertLimit,
  assertWritableSubscription,
  FeatureFlags,
} from '../services/packages.service';
import { ApiError, sendApiError } from '../utils/httpError';

function agencyIdFrom(req: Request) {
  return (req.user?.agency_id || req.agencyId || null) as string | null;
}

export function requireFeature(feature: keyof FeatureFlags) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const agencyId = agencyIdFrom(req);
    if (!agencyId) {
      return res.status(403).json({ error: 'Agency required', code: 'agency_required' });
    }
    try {
      await assertFeatureEnabled(agencyId, feature);
      const method = req.method.toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        await assertWritableSubscription(agencyId);
      }
      next();
    } catch (err) {
      return sendApiError(res, err);
    }
  };
}

export function requireLimit(kind: 'max_users' | 'max_branches' | 'max_seasons') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const agencyId = agencyIdFrom(req);
    if (!agencyId) {
      return res.status(403).json({ error: 'Agency required', code: 'agency_required' });
    }
    try {
      await assertWritableSubscription(agencyId);
      await assertLimit(agencyId, kind);
      next();
    } catch (err) {
      return sendApiError(res, err);
    }
  };
}

export async function enforceFeature(req: Request, feature: keyof FeatureFlags) {
  const agencyId = agencyIdFrom(req);
  if (!agencyId) throw new ApiError(403, 'Agency required', 'agency_required');
  await assertFeatureEnabled(agencyId, feature);
}

export async function enforceLimit(req: Request, kind: 'max_users' | 'max_branches' | 'max_seasons') {
  const agencyId = agencyIdFrom(req);
  if (!agencyId) throw new ApiError(403, 'Agency required', 'agency_required');
  await assertLimit(agencyId, kind);
}
