import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET. Set it in .env (see env.example).');
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUserPayload): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    agency_id: user.agency_id,
    role: user.role,
    branch_id: user.branch_id,
    full_name: user.full_name,
  };
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

/** Shape compatible with previous Supabase user + metadata usage on frontend/backend */
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
