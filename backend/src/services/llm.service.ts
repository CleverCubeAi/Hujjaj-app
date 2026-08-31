import db from './db';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { ApiError } from '../utils/httpError';
import { getAgencyEntitlements } from './packages.service';
import { sendPlatformMail } from './platformMail.service';
import { runAsPlatform } from '../middleware/rlsContext';

export type LlmProvider = 'openai' | 'anthropic' | 'azure_openai' | 'google' | 'custom';

function maskKey(encrypted?: string | null) {
  if (!encrypted) return { key_configured: false, key_last4: null as string | null };
  try {
    const raw = decryptSecret(encrypted);
    return { key_configured: true, key_last4: raw.slice(-4) };
  } catch {
    return { key_configured: true, key_last4: null as string | null };
  }
}

export function publicLlmConfig(row: any) {
  const mask = maskKey(row?.api_key_encrypted);
  return {
    enabled: !!row?.enabled,
    provider: row?.provider || 'openai',
    base_url: row?.base_url || null,
    api_version: row?.api_version || null,
    default_model: row?.default_model || 'gpt-4.1-mini',
    timeout_ms: Number(row?.timeout_ms || 30000),
    max_tokens: Number(row?.max_tokens || 1024),
    monthly_budget_usd: row?.monthly_budget_usd != null ? Number(row.monthly_budget_usd) : null,
    budget_alert_email: row?.budget_alert_email || null,
    key_configured: mask.key_configured,
    key_last4: mask.key_last4,
    updated_at: row?.updated_at || null,
  };
}

export async function getLlmSettingsRow() {
  let row = await db('platform_llm_settings').where({ id: 1 }).first();
  if (!row) {
    await db('platform_llm_settings').insert({ id: 1 }).onConflict('id').ignore();
    row = await db('platform_llm_settings').where({ id: 1 }).first();
  }
  return row;
}

export async function monthSpendUsd() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await db('platform_llm_usage')
    .where('created_at', '>=', start.toISOString())
    .sum({ total: 'cost_usd' });
  return Number(row?.total || 0);
}

export async function assertLlmAllowed(agencyId: string | null, opts?: { isSuperAdminTest?: boolean }) {
  const settings = await runAsPlatform(() => getLlmSettingsRow());
  if (!settings?.enabled || !settings.api_key_encrypted) {
    throw new ApiError(403, 'LLM is disabled', 'llm_disabled');
  }
  if (!opts?.isSuperAdminTest) {
    if (!agencyId) throw new ApiError(403, 'LLM is not available', 'llm_not_in_plan');
    const agency = await db('agencies').where({ id: agencyId }).first();
    if (!agency || agency.status !== 'active') {
      throw new ApiError(403, 'Agency is not active', 'llm_disabled');
    }
    const ent = await getAgencyEntitlements(agencyId);
    if (!ent.features.llm) {
      throw new ApiError(403, 'LLM is not included in the current package', 'llm_not_in_plan');
    }
  }
  if (settings.monthly_budget_usd != null) {
    const spent = await runAsPlatform(() => monthSpendUsd());
    if (spent >= Number(settings.monthly_budget_usd)) {
      throw new ApiError(403, 'LLM monthly budget exceeded', 'llm_budget_exceeded');
    }
  }
  return settings;
}

function estimateCost(inputTokens: number, outputTokens: number) {
  return (inputTokens * 0.0000004 + outputTokens * 0.0000016);
}

export async function recordLlmUsage(opts: {
  agencyId?: string | null;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const cost = estimateCost(opts.inputTokens, opts.outputTokens);
  await runAsPlatform(async () => {
    await db('platform_llm_usage').insert({
      agency_id: opts.agencyId || null,
      feature: opts.feature,
      model: opts.model,
      input_tokens: opts.inputTokens,
      output_tokens: opts.outputTokens,
      cost_usd: cost,
    });
    const settings = await getLlmSettingsRow();
    if (settings?.monthly_budget_usd != null) {
      const spent = await monthSpendUsd();
      const budget = Number(settings.monthly_budget_usd);
      if (spent >= budget && settings.budget_alert_email) {
        await sendPlatformMail({
          to: settings.budget_alert_email,
          event: 'llm_budget_alert',
          vars: { budget: String(budget), spent: spent.toFixed(4) },
        });
      }
    }
  });
}

function sanitizeProviderError(message: string) {
  return message.replace(/sk-[a-zA-Z0-9]+/g, 'sk-***').replace(/Bearer\s+\S+/gi, 'Bearer ***').slice(0, 180);
}

export async function testLlmConnection(): Promise<{ ok: boolean; model?: string; latency_ms?: number; error?: string }> {
  const settings = await getLlmSettingsRow();
  if (!settings?.api_key_encrypted) {
    return { ok: false, error: 'API key is not configured' };
  }
  let apiKey: string;
  try {
    apiKey = decryptSecret(settings.api_key_encrypted);
  } catch {
    return { ok: false, error: 'Stored API key could not be decrypted' };
  }

  const model = settings.default_model || 'gpt-4.1-mini';
  const timeoutMs = Math.min(Number(settings.timeout_ms || 30000), 120000);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await callProvider({
      provider: settings.provider,
      apiKey,
      baseUrl: settings.base_url,
      apiVersion: settings.api_version,
      model,
      maxTokens: Math.min(Number(settings.max_tokens || 32), 64),
      signal: controller.signal,
    });
    const latency_ms = Date.now() - started;
    await recordLlmUsage({
      agencyId: null,
      feature: 'connection_test',
      model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    return { ok: true, model, latency_ms };
  } catch (err: any) {
    return { ok: false, error: sanitizeProviderError(err?.message || 'Provider error') };
  } finally {
    clearTimeout(timer);
  }
}

async function callProvider(opts: {
  provider: LlmProvider | string;
  apiKey: string;
  baseUrl?: string | null;
  apiVersion?: string | null;
  model: string;
  maxTokens: number;
  signal: AbortSignal;
}): Promise<{ inputTokens: number; outputTokens: number; text: string }> {
  const provider = opts.provider;
  if (provider === 'anthropic') {
    const res = await fetch(opts.baseUrl || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        messages: [{ role: 'user', content: 'Reply with pong' }],
      }),
      signal: opts.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
    return {
      inputTokens: json.usage?.input_tokens || 0,
      outputTokens: json.usage?.output_tokens || 0,
      text: json.content?.[0]?.text || '',
    };
  }

  if (provider === 'google') {
    const url = `${opts.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'}/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with pong' }] }] }),
      signal: opts.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
    return {
      inputTokens: json.usageMetadata?.promptTokenCount || 0,
      outputTokens: json.usageMetadata?.candidatesTokenCount || 0,
      text: json.candidates?.[0]?.content?.parts?.[0]?.text || '',
    };
  }

  const url =
    provider === 'azure_openai'
      ? `${String(opts.baseUrl || '').replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(opts.model)}/chat/completions?api-version=${encodeURIComponent(opts.apiVersion || '2024-10-21')}`
      : `${String(opts.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (provider === 'azure_openai') headers['api-key'] = opts.apiKey;
  else headers.authorization = `Bearer ${opts.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      messages: [{ role: 'user', content: 'Reply with pong' }],
    }),
    signal: opts.signal,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  return {
    inputTokens: json.usage?.prompt_tokens || 0,
    outputTokens: json.usage?.completion_tokens || 0,
    text: json.choices?.[0]?.message?.content || '',
  };
}

export { encryptSecret, decryptSecret };
