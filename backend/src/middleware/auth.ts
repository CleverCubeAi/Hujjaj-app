import { Request, Response, NextFunction } from 'express';
import { verifyToken, AUTH_COOKIE_NAMES } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        agency_id?: string | null;
        role?: string;
        branch_id?: string | null;
        user_metadata?: any;
      };
      agencyId?: string | null;
    }
  }
}

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAMES.ACCESS_COOKIE];
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  try {
    const payload = verifyToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      agency_id: payload.agency_id || undefined,
      role: payload.role || undefined,
      branch_id: payload.branch_id || undefined,
      user_metadata: {
        agency_id: payload.agency_id,
        role: payload.role,
        branch_id: payload.branch_id,
        full_name: payload.full_name,
      },
    };
    req.agencyId = payload.agency_id || undefined;

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      agency_id: payload.agency_id || undefined,
      role: payload.role || undefined,
      branch_id: payload.branch_id || undefined,
    };
    req.agencyId = payload.agency_id || undefined;
  } catch {
    // ignore invalid optional auth
  }
  next();
};
