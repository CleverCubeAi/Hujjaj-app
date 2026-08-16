import { Request, Response } from 'express';
import db from '../services/db';
import {
  hashPassword,
  verifyPassword,
  signToken,
  toAuthUser,
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  AUTH_COOKIE_NAMES,
} from '../services/auth.service';
import { allowPublicRegister } from '../config/security';
import { assertPasswordPolicy } from '../utils/httpError';
import { runAsPlatform } from '../middleware/rlsContext';

async function issueSession(req: Request, res: Response, user: any) {
  const authUser = toAuthUser(user);
  const access_token = signToken({
    id: user.id,
    email: user.email,
    agency_id: user.agency_id,
    role: user.role,
    branch_id: user.branch_id,
    full_name: user.full_name,
  });
  const refresh = await createRefreshSession(user.id, req.get('user-agent') || undefined);
  setAuthCookies(res, access_token, refresh.token, refresh.expires_at);
  return { authUser, access_token };
}

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    await runAsPlatform(async () => {
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const user = await db('users').where({ email: String(email).toLowerCase().trim() }).first();
      if (!user) {
        res.status(401).json({ error: 'Invalid login credentials' });
        return;
      }

      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) {
        res.status(401).json({ error: 'Invalid login credentials' });
        return;
      }

      const { authUser } = await issueSession(req, res, user);
      res.json({ user: authUser });
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  if (!allowPublicRegister()) {
    return res.status(403).json({ error: 'Public registration is disabled' });
  }

  const { email, password, agencyName, fullName, country } = req.body;

  try {
    await runAsPlatform(async () => {
      if (!email || !password || !agencyName) {
        res.status(400).json({ error: 'email, password, and agencyName are required' });
        return;
      }
      const passwordError = assertPasswordPolicy(password);
      if (passwordError) {
        res.status(400).json({ error: passwordError });
        return;
      }

      const existing = await db('users').where({ email: String(email).toLowerCase().trim() }).first();
      if (existing) {
        res.status(400).json({ error: 'Unable to register with these details' });
        return;
      }

      const result = await db.transaction(async (trx) => {
        const [agency] = await trx('agencies')
          .insert({ name: agencyName, country })
          .returning('*');

        const password_hash = await hashPassword(password);
        const [user] = await trx('users')
          .insert({
            email: String(email).toLowerCase().trim(),
            password_hash,
            agency_id: agency.id,
            full_name: fullName,
            role: 'agency_admin',
          })
          .returning('*');

        return { agency, user };
      });

      const { authUser } = await issueSession(req, res, result.user);
      res.json({
        message: 'Agency registered successfully',
        agency: result.agency,
        user: authUser,
      });
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await db('users').where({ id: userId }).first();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ user: toAuthUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    await runAsPlatform(async () => {
      const token = req.cookies?.[AUTH_COOKIE_NAMES.REFRESH_COOKIE];
      if (token) await revokeRefreshToken(token);
      clearAuthCookies(res);
      res.json({ message: 'Logged out' });
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    await runAsPlatform(async () => {
      const token = req.cookies?.[AUTH_COOKIE_NAMES.REFRESH_COOKIE];
      if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const rotated = await rotateRefreshSession(token, req.get('user-agent') || undefined);
      if (!rotated) {
        clearAuthCookies(res);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await db('users').where({ id: rotated.userId }).first();
      if (!user) {
        clearAuthCookies(res);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const access_token = signToken({
        id: user.id,
        email: user.email,
        agency_id: user.agency_id,
        role: user.role,
        branch_id: user.branch_id,
        full_name: user.full_name,
      });
      setAuthCookies(res, access_token, rotated.token, rotated.expires_at);
      res.json({ user: toAuthUser(user) });
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};
