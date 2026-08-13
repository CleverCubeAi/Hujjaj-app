import crypto from 'crypto';

const DEFAULT_KEY = 'default-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY || DEFAULT_KEY;
  return key;
}

export function isDefaultEncryptionKey(): boolean {
  const key = process.env.ENCRYPTION_KEY;
  return !key || key === DEFAULT_KEY || key.length < 32;
}

function keyBuffer(): Buffer {
  const raw = getEncryptionKey();
  return Buffer.from(raw.padEnd(32, '0').slice(0, 32), 'utf8');
}

export function encryptSecret(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptSecret(encryptedText: string): string {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function signUploadToken(relativePath: string, expiresAtUnix: number): string {
  const payload = `${relativePath}:${expiresAtUnix}`;
  return crypto.createHmac('sha256', keyBuffer()).update(payload).digest('hex');
}

export function verifyUploadToken(relativePath: string, expiresAtUnix: number, sig: string): boolean {
  if (!sig || !expiresAtUnix || Date.now() / 1000 > expiresAtUnix) return false;
  const expected = signUploadToken(relativePath, expiresAtUnix);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

export const UPLOAD_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
