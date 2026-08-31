import { Request, Response } from 'express';
import db from '../services/db';
import { encryptPassword, getPresetConfig, testConnection, EmailConfig } from '../services/email.service';
import { getPlatformEmailConfig } from '../services/platformMail.service';
import { ApiError, sendApiError } from '../utils/httpError';

function masked(row: any) {
  if (!row) {
    return {
      provider: 'custom',
      host: '',
      port: 587,
      secure: false,
      username: '',
      from_email: '',
      from_name: '',
      enabled: false,
      password_configured: false,
      last_tested_at: null,
      test_status: null,
    };
  }
  return {
    provider: row.provider,
    host: row.host,
    port: row.port,
    secure: !!row.secure,
    username: row.username,
    from_email: row.from_email,
    from_name: row.from_name,
    enabled: !!row.enabled,
    password_configured: !!row.password_encrypted,
    last_tested_at: row.last_tested_at,
    test_status: row.test_status,
  };
}

export const getPlatformEmail = async (_req: Request, res: Response) => {
  try {
    const row = await db('platform_email_settings').where({ id: 1 }).first();
    res.json(masked(row));
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const patchPlatformEmail = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const existing = await db('platform_email_settings').where({ id: 1 }).first();
    let passwordEncrypted = existing?.password_encrypted || null;
    if (body.password) {
      passwordEncrypted = encryptPassword(body.password);
    } else if (!existing?.password_encrypted) {
      throw new ApiError(400, 'Password is required for new email settings');
    }

    const preset = body.provider !== 'custom' ? getPresetConfig(body.provider) : {};
    const [row] = await db('platform_email_settings')
      .where({ id: 1 })
      .update({
        provider: body.provider,
        host: body.host || preset.host,
        port: body.port || preset.port || 587,
        secure: body.secure ?? preset.secure ?? false,
        username: body.username,
        password_encrypted: passwordEncrypted,
        from_email: body.from_email,
        from_name: body.from_name,
        enabled: body.enabled !== false,
        updated_at: new Date(),
        updated_by: req.user?.id || null,
      })
      .returning('*');
    res.json(masked(row));
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const testPlatformEmail = async (req: Request, res: Response) => {
  try {
    const to = req.body.to;
    const row = await db('platform_email_settings').where({ id: 1 }).first();
    if (!row?.password_encrypted || !row.host || !row.from_email) {
      throw new ApiError(400, 'Email not configured', 'email_not_configured');
    }
    const config: EmailConfig = {
      provider: row.provider,
      host: row.host,
      port: Number(row.port || 587),
      secure: !!row.secure,
      auth: { user: row.username, pass: row.password_encrypted },
      from_email: row.from_email,
      from_name: row.from_name || 'Hujjaj',
    };
    try {
      await testConnection(config, to);
      await db('platform_email_settings').where({ id: 1 }).update({
        last_tested_at: new Date(),
        test_status: 'success',
      });
      res.json({ ok: true, message: 'Test email sent' });
    } catch (err: any) {
      await db('platform_email_settings').where({ id: 1 }).update({
        last_tested_at: new Date(),
        test_status: 'failed',
      });
      throw new ApiError(400, err.message || 'Test failed', 'email_test_failed');
    }
  } catch (err) {
    return sendApiError(res, err);
  }
};

export { getPlatformEmailConfig };
