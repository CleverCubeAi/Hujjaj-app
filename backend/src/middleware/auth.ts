import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../services/supabase';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        agency_id?: string;
        role?: string;
        branch_id?: string;
        user_metadata?: any;
      };
      agencyId?: string;
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
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Set user with flattened agency_id and branch_id for easy access
    req.user = {
      id: user.id,
      email: user.email,
      agency_id: user.user_metadata?.agency_id,
      role: user.user_metadata?.role,
      branch_id: user.user_metadata?.branch_id,
      user_metadata: user.user_metadata
    };
    req.agencyId = user.user_metadata?.agency_id;

    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during auth' });
  }
};
