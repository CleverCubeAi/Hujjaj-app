import { isDefaultEncryptionKey } from '../utils/crypto';

const WEAK_JWT = ['change-me-to-a-long-random-secret', 'dev-secret', 'secret'];

export function assertProductionSecrets() {
  const isProd = process.env.NODE_ENV === 'production';
  const jwt = process.env.JWT_SECRET || '';

  if (!jwt) {
    throw new Error('Missing JWT_SECRET. Set it in .env (see env.example).');
  }
  if (jwt.length < 32 || WEAK_JWT.includes(jwt)) {
    if (isProd) {
      throw new Error('JWT_SECRET is missing, too short, or using a default value.');
    }
    console.warn('[security] JWT_SECRET is weak; set a 32+ character random secret before production.');
  }

  if (isProd && isDefaultEncryptionKey()) {
    throw new Error(
      'ENCRYPTION_KEY must be set to a random 32+ character secret in production (see env.example).'
    );
  }

  if (isProd && (process.env.SEED_DEMO === 'true' || process.env.SEED_DEMO === '1')) {
    if (process.env.ALLOW_DEMO_IN_PRODUCTION === 'true') {
      console.warn('[security] SEED_DEMO=true with ALLOW_DEMO_IN_PRODUCTION — demo users will be seeded.');
    } else {
      throw new Error('SEED_DEMO must be false in production. Set SEED_DEMO=false on Railway.');
    }
  }
}

export function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost,http://127.0.0.1';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function allowPublicRegister(): boolean {
  return process.env.ALLOW_PUBLIC_REGISTER === 'true';
}
