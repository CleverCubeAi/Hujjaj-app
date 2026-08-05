import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';

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

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

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
