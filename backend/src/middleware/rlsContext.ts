import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import { isSuperAdmin } from '../utils/tenant';

export type TenantCtx = {
  agencyId: string | null;
  isSuperAdmin: boolean;
};

export const tenantAls = new AsyncLocalStorage<TenantCtx>();

export function rlsContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const agencyId = (req.agencyId || req.user?.agency_id || null) as string | null;
  tenantAls.run(
    {
      agencyId: agencyId && agencyId.length > 0 ? agencyId : null,
      isSuperAdmin: isSuperAdmin(req),
    },
    () => next()
  );
}
