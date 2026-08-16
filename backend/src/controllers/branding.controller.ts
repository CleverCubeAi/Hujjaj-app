import { Request, Response } from 'express';
import db from '../services/db';
import { runAsPlatform } from '../middleware/rlsContext';
import { ApiError, sendApiError } from '../utils/httpError';

const PUBLIC_FIELDS = [
  'app_name',
  'app_name_ar',
  'app_name_fr',
  'tagline_ar',
  'tagline_fr',
  'logo_url',
  'logo_mark_url',
  'favicon_url',
  'login_background_url',
  'primary_color',
  'accent_color',
  'support_email',
  'support_phone',
  'default_locale',
  'legal_name',
  'copyright',
] as const;

function publicBaseUrl() {
  return (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
}

export function isAllowedBrandUrl(url: string | null | undefined) {
  if (!url) return true;
  const trimmed = String(url).trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  const base = publicBaseUrl();
  return (
    trimmed.startsWith(`${base}/uploads/platform/`) ||
    trimmed.startsWith('/uploads/platform/')
  );
}

function publicPayload(row: any) {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    out[key] = row?.[key] ?? null;
  }
  if (!out.app_name) out.app_name = 'Hujjaj';
  if (!out.app_name_ar) out.app_name_ar = 'حجاج';
  if (!out.app_name_fr) out.app_name_fr = 'Hujjaj';
  if (!out.primary_color) out.primary_color = '#8B7355';
  if (!out.accent_color) out.accent_color = '#6F5C45';
  if (!out.default_locale) out.default_locale = 'ar';
  return out;
}

export async function getBrandingRow() {
  let row = await db('platform_branding').where({ id: 1 }).first();
  if (!row) {
    await db('platform_branding').insert({ id: 1 }).onConflict('id').ignore();
    row = await db('platform_branding').where({ id: 1 }).first();
  }
  return row;
}

export const getPublicBranding = async (_req: Request, res: Response) => {
  try {
    const row = await runAsPlatform(() => getBrandingRow());
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(publicPayload(row));
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const getPlatformBranding = async (_req: Request, res: Response) => {
  try {
    const row = await getBrandingRow();
    res.json({
      ...publicPayload(row),
      updated_at: row?.updated_at || null,
      updated_by: row?.updated_by || null,
    });
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const patchPlatformBranding = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const urlFields = ['logo_url', 'logo_mark_url', 'favicon_url', 'login_background_url'] as const;
    for (const field of urlFields) {
      if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
        if (!isAllowedBrandUrl(body[field])) {
          throw new ApiError(400, `Invalid ${field}: URLs must be uploaded via the platform branding uploader`, 'invalid_brand_url');
        }
      }
    }

    const update: Record<string, unknown> = { updated_at: new Date(), updated_by: req.user?.id || null };
    const keys = [
      'app_name', 'app_name_ar', 'app_name_fr', 'tagline_ar', 'tagline_fr',
      'logo_url', 'logo_mark_url', 'favicon_url', 'login_background_url',
      'primary_color', 'accent_color', 'support_email', 'support_phone',
      'default_locale', 'legal_name', 'copyright',
    ];
    for (const key of keys) {
      if (body[key] === undefined) continue;
      update[key] = body[key] === '' ? null : body[key];
    }

    await db('platform_branding').insert({ id: 1 }).onConflict('id').ignore();
    const [row] = await db('platform_branding').where({ id: 1 }).update(update).returning('*');
    res.json({
      ...publicPayload(row),
      updated_at: row?.updated_at || null,
      updated_by: row?.updated_by || null,
    });
  } catch (err) {
    return sendApiError(res, err);
  }
};
