import { Request, Response, NextFunction } from 'express';

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
  };
}

/** Block platform super_admin from agency operational routes. */
export function denyRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (role && roles.includes(role)) {
      return res.status(403).json({ error: 'Super admin cannot access agency operations' });
    }
    next();
  };
}
