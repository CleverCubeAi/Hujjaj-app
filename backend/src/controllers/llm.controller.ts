import { Request, Response } from 'express';
import db from '../services/db';
import { encryptSecret } from '../utils/crypto';
import { ApiError, sendApiError } from '../utils/httpError';
import {
  getLlmSettingsRow,
  monthSpendUsd,
  publicLlmConfig,
  testLlmConnection,
} from '../services/llm.service';

export const getPlatformLlm = async (_req: Request, res: Response) => {
  try {
    const row = await getLlmSettingsRow();
    res.json(publicLlmConfig(row));
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const patchPlatformLlm = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const existing = await getLlmSettingsRow();
    const update: Record<string, unknown> = {
      updated_at: new Date(),
      updated_by: req.user?.id || null,
    };

    if (body.enabled !== undefined) update.enabled = body.enabled;
    if (body.provider !== undefined) update.provider = body.provider;
    if (body.base_url !== undefined) update.base_url = body.base_url || null;
    if (body.api_version !== undefined) update.api_version = body.api_version || null;
    if (body.default_model !== undefined) update.default_model = body.default_model;
    if (body.timeout_ms !== undefined) update.timeout_ms = body.timeout_ms;
    if (body.max_tokens !== undefined) update.max_tokens = body.max_tokens;
    if (body.monthly_budget_usd !== undefined) update.monthly_budget_usd = body.monthly_budget_usd;
    if (body.budget_alert_email !== undefined) {
      update.budget_alert_email = body.budget_alert_email || null;
    }

    if (body.api_key !== undefined) {
      if (body.api_key === '') {
        update.api_key_encrypted = null;
        update.enabled = false;
      } else {
        update.api_key_encrypted = encryptSecret(body.api_key);
      }
    }

    if ((body.provider === 'azure_openai' || body.provider === 'custom') && !(body.base_url || existing?.base_url)) {
      throw new ApiError(400, 'base_url is required for this provider');
    }

    const [row] = await db('platform_llm_settings').where({ id: 1 }).update(update).returning('*');
    res.json(publicLlmConfig(row));
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const testPlatformLlm = async (_req: Request, res: Response) => {
  try {
    const result = await testLlmConnection();
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const getPlatformLlmUsage = async (req: Request, res: Response) => {
  try {
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date();
    const rows = await db('platform_llm_usage')
      .select(
        db.raw(`date_trunc('day', created_at)::date as day`),
        'agency_id',
        db.raw('SUM(input_tokens)::int as input_tokens'),
        db.raw('SUM(output_tokens)::int as output_tokens'),
        db.raw('SUM(cost_usd)::numeric as cost_usd')
      )
      .where('created_at', '>=', from.toISOString())
      .andWhere('created_at', '<=', to.toISOString())
      .groupByRaw(`date_trunc('day', created_at)::date, agency_id`)
      .orderBy('day', 'desc');

    const spent = await monthSpendUsd();
    const settings = await getLlmSettingsRow();
    const agencies = await db('platform_llm_usage')
      .leftJoin('agencies', 'agencies.id', 'platform_llm_usage.agency_id')
      .select('agencies.id', 'agencies.name')
      .sum({ cost_usd: 'platform_llm_usage.cost_usd' })
      .where('platform_llm_usage.created_at', '>=', from.toISOString())
      .groupBy('agencies.id', 'agencies.name')
      .orderBy('cost_usd', 'desc')
      .limit(10);

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      month_spend_usd: spent,
      monthly_budget_usd: settings?.monthly_budget_usd != null ? Number(settings.monthly_budget_usd) : null,
      by_day: rows,
      top_agencies: agencies,
    });
  } catch (err) {
    return sendApiError(res, err);
  }
};
