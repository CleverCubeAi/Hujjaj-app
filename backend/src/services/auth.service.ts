import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Response } from 'express';
import db from './db';

export interface AuthUserPayload {
  id: string;
  email: string;
  agency_id?: string | null;
  role?: string | null;
  branch_id?: string | null;
  full_name?: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  agency_id?: string | null;
  role?: string | null;
  branch_id?: string | null;
  full_name?: string | null;
  typ?: 'access' | 'refresh';
}

const ACCESS_COOKIE = 'hujjaj_access';
const REFRESH_COOKIE = 'hujjaj_refresh';
const ACCESS_TTL = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_DAYS || 7);

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET. Set it in .env (see env.example).');
  }
  return secret;
}

function cookieSecure() {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return (process.env.PUBLIC_URL || '').startsWith('https');
}

function cookieBase() {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax' as const,
    path: '/',
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUserPayload, expiresIn = ACCESS_TTL): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    agency_id: user.agency_id,
    role: user.role,
    branch_id: user.branch_id,
    full_name: user.full_name,
    typ: 'access',
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn, algorithm: 'HS256' } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as JwtPayload;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export async function createRefreshSession(userId: string, userAgent?: string) {
  const token = newRefreshToken();
  const token_hash = hashRefreshToken(token);
  const expires_at = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await db('refresh_sessions').insert({
    user_id: userId,
    token_hash,
    expires_at,
    user_agent: userAgent || null,
  });
  return { token, expires_at };
}

export async function rotateRefreshSession(oldToken: string, userAgent?: string) {
  const token_hash = hashRefreshToken(oldToken);
  const row = await db('refresh_sessions')
    .where({ token_hash })
    .whereNull('revoked_at')
    .where('expires_at', '>', db.fn.now())
    .first();
  if (!row) return null;

  await db('refresh_sessions').where({ id: row.id }).update({ revoked_at: db.fn.now() });
  const next = await createRefreshSession(row.user_id, userAgent);
  return { userId: row.user_id as string, ...next };
}

export async function revokeRefreshToken(token: string) {
  const token_hash = hashRefreshToken(token);
  await db('refresh_sessions').where({ token_hash }).update({ revoked_at: db.fn.now() });
}

export async function revokeAllUserSessions(userId: string) {
  await db('refresh_sessions').where({ user_id: userId }).whereNull('revoked_at').update({
    revoked_at: db.fn.now(),
  });
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string, refreshExpires: Date) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieBase(),
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieBase(),
    maxAge: refreshExpires.getTime() - Date.now(),
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase() });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase() });
}

export const AUTH_COOKIE_NAMES = { ACCESS_COOKIE, REFRESH_COOKIE };

export function toAuthUser(row: {
  id: string;
  email: string;
  agency_id?: string | null;
  role?: string | null;
  branch_id?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}) {
  return {
    id: row.id,
    email: row.email,
    user_metadata: {
      agency_id: row.agency_id,
      role: row.role,
      branch_id: row.branch_id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    },
  };
}
