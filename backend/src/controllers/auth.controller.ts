import { Request, Response } from 'express';
import db from '../services/db';
import {
  hashPassword,
  verifyPassword,
  signToken,
  toAuthUser,
} from '../services/auth.service';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db('users').where({ email: String(email).toLowerCase().trim() }).first();
    if (!user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const authUser = toAuthUser(user);
    const access_token = signToken({
      id: user.id,
      email: user.email,
      agency_id: user.agency_id,
      role: user.role,
      branch_id: user.branch_id,
      full_name: user.full_name,
    });

    res.json({
      access_token,
      token: access_token,
      user: authUser,
      session: {
        access_token,
        user: authUser,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, agencyName, fullName, country } = req.body;

  try {
    if (!email || !password || !agencyName) {
      return res.status(400).json({ error: 'email, password, and agencyName are required' });
    }

    const existing = await db('users').where({ email: String(email).toLowerCase().trim() }).first();
    if (existing) {
      return res.status(400).json({ error: 'User already registered' });
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

    const authUser = toAuthUser(result.user);
    const access_token = signToken({
      id: result.user.id,
      email: result.user.email,
      agency_id: result.user.agency_id,
      role: result.user.role,
      branch_id: result.user.branch_id,
      full_name: result.user.full_name,
    });

    res.json({
      message: 'Agency registered successfully',
      agency: result.agency,
      user: authUser,
      access_token,
      session: { access_token, user: authUser },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
