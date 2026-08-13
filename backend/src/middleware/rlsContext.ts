import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import { isSuperAdmin } from '../utils/tenant';

export type TenantCtx = {
  agencyId: string | null;
  userId: string | null;
  isSuperAdmin: boolean;
};

export const tenantAls = new AsyncLocalStorage<TenantCtx>();

/** Explicit platform scope for login, seeds, and cron — never the default. */
export const PLATFORM_CTX: TenantCtx = {
  agencyId: null,
  userId: null,
  isSuperAdmin: true,
};

export function runAsPlatform<T>(fn: () => T): T {
  return tenantAls.run(PLATFORM_CTX, fn);
}

export function rlsContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const agencyId = (req.agencyId || req.user?.agency_id || null) as string | null;
  tenantAls.run(
    {
      agencyId: agencyId && agencyId.length > 0 ? agencyId : null,
      userId: req.user?.id || null,
      isSuperAdmin: isSuperAdmin(req),
    },
    () => next()
  );
}
