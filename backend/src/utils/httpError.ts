import { Response } from 'express';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function sendApiError(res: Response, err: unknown) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  return sendError(res, err);
}

export function sendError(res: Response, err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err || 'Internal server error');
  if (status >= 500) {
    console.error(err);
  }
  const clientMessage =
    process.env.NODE_ENV === 'production' && status >= 500
      ? 'Internal server error'
      : message;
  return res.status(status).json({ error: clientMessage });
}

export function pickAllowed<T extends Record<string, unknown>>(
  body: T,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

export const MIN_PASSWORD_LENGTH = 8;

export function assertPasswordPolicy(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}
