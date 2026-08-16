import { Request, Response, NextFunction } from 'express';

export function isSuperAdmin(req: Request): boolean {
  return req.user?.role === 'super_admin';
}

function headerAgency(req: Request): string | null {
  const raw = req.headers['x-agency-id'];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  const q = req.query.agency_id;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return null;
}

/**
 * Resolve tenant agency for the request.
 * - Normal users: must have agency_id (403 if missing)
 * - Super admin: JWT agency is optional; X-Agency-Id / ?agency_id selects a tenant.
 *   null = platform scope (reads only).
 * Returns `undefined` if a 403 response was already sent.
 */
export function resolveAgencyId(req: Request, res: Response): string | null | undefined {
  if (isSuperAdmin(req)) {
    const override = headerAgency(req);
    if (override) {
      req.agencyId = override;
      return override;
    }
    const own = req.user?.agency_id || req.agencyId || null;
    return own;
  }

  const agencyId = req.agencyId || req.user?.agency_id || null;
  if (agencyId) return agencyId;
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

/** Non-super-admin users must have an agency on the token. */
export function tenantGuard(req: Request, res: Response, next: NextFunction) {
  if (isSuperAdmin(req)) {
    const resolved = resolveAgencyId(req, res);
    if (resolved === undefined) return;
    req.agencyId = resolved;
    return next();
  }
  const agencyId = req.agencyId || req.user?.agency_id;
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }
  req.agencyId = agencyId;
  next();
}

/** Writes (POST/PUT/PATCH/DELETE) require a concrete agency, including for super_admin. */
export function requireAgencyOnMutate(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const agencyId = requireAgencyId(req, res);
  if (!agencyId) return;
  req.agencyId = agencyId;
  if (req.user) req.user.agency_id = agencyId;
  next();
}
