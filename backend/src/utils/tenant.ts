import { Request, Response } from 'express';

export function isSuperAdmin(req: Request): boolean {
  return req.user?.role === 'super_admin';
}

/**
 * Resolve tenant agency for the request.
 * - Normal users: must have agency_id (403 if missing)
 * - Super admin: agency_id is optional (null = platform scope, all agencies)
 * Returns `undefined` if a 403 response was already sent.
 */
export function resolveAgencyId(req: Request, res: Response): string | null | undefined {
  const agencyId = req.agencyId || req.user?.agency_id || null;
  if (agencyId) return agencyId;
  if (isSuperAdmin(req)) return null;
  res.status(403).json({ error: 'Agency ID not found' });
  return undefined;
}

/** Require a concrete agency for write operations (even super admin). */
export function requireAgencyId(req: Request, res: Response): string | undefined {
  const agencyId = resolveAgencyId(req, res);
  if (agencyId === undefined) return undefined;
  if (!agencyId) {
    res.status(400).json({
      error: 'Agency ID required for this action. Super admin is not tied to an agency.',
    });
    return undefined;
  }
  return agencyId;
}
