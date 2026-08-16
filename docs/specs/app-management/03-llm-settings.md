# Spec 03 — LLM settings

**Owner:** Super Admin  
**Phase:** 4  
**Depends on:** [05-subscription-packages.md](./05-subscription-packages.md) (`features.llm`)

## Goal

Super Admin plugs in **one** platform LLM (provider + key + default model). Agencies never see the key. Packages decide whether an agency may *use* LLM features later.

This spec is **configuration and gating only**. It does not define chat UI, pilgrim OCR, or auto-replies.

## Why platform-owned

- One bill, one key, one audit trail
- Agencies on cheaper packages must not consume the model
- Super Admin can disable LLM globally without touching agencies

## Settings

Singleton `platform_llm_settings`:

| Field | Type | Notes |
|---|---|---|
| `enabled` | boolean | Global kill switch |
| `provider` | enum | `openai`, `anthropic`, `azure_openai`, `google`, `custom` |
| `api_key_encrypted` | text | Never returned in full |
| `base_url` | text? | Required for `azure_openai` and `custom` |
| `api_version` | text? | Azure |
| `default_model` | text | e.g. `gpt-4.1-mini`, `claude-sonnet-4-6` |
| `timeout_ms` | int | Default 30000, max 120000 |
| `max_tokens` | int | Cap per request |
| `monthly_budget_usd` | numeric? | Soft cap; when exceeded, LLM calls fail closed |
| `budget_alert_email` | text? | Uses platform SMTP (spec 04) |
| `updated_at` / `updated_by` | | |

Usage counters (separate table, append-only):

```sql
platform_llm_usage (
  id, agency_id NULL,  -- NULL = platform/internal
  feature TEXT,        -- e.g. 'message_draft'
  model TEXT,
  input_tokens INT,
  output_tokens INT,
  cost_usd NUMERIC,
  created_at
)
```

Monthly spend = sum of `cost_usd` for current UTC month. If `monthly_budget_usd` is set and spend >= budget → `403 llm_budget_exceeded`.

## Entitlement

Package flag `features.llm` (boolean).

Call path for any future LLM feature:

1. Global `enabled` must be true and a key must be configured
2. Caller must be an agency user (not Super Admin operating an agency)
3. Agency package must include `llm`
4. Agency `status` must be `active`
5. Budget not exceeded

If any check fails, return 403 with a stable code (`llm_disabled`, `llm_not_in_plan`, `llm_budget_exceeded`). Do not leak provider errors to the client.

## APIs (Super Admin only)

- `GET /api/platform/settings/llm`  
  Returns config **without** the key: `{ enabled, provider, base_url, default_model, ..., key_configured: boolean }`
- `PATCH /api/platform/settings/llm`  
  Omit `api_key` to keep the existing key. Empty string clears it and sets `enabled=false`.
- `POST /api/platform/settings/llm/test`  
  Sends a tiny completion (“Reply with pong”). Returns `{ ok, model, latency_ms }` or `{ ok: false, error }` (sanitized).
- `GET /api/platform/settings/llm/usage?from=&to=`  
  Aggregates by day / agency for the dashboard widget.

No agency endpoint in this phase.

## UI

Super Admin → Settings → **LLM**

- Enable toggle
- Provider select (shows extra fields for Azure/custom)
- API key password input (placeholder “unchanged” if configured)
- Default model, max tokens, timeout
- Monthly budget + alert email
- “Test connection”
- Read-only usage: this month spend vs budget; top agencies (empty until features exist)

## Security

- Encrypt key with existing `ENCRYPTION_KEY` helpers (`encryptSecret` / `decryptSecret`)
- Do not log prompts, keys, or raw provider payloads
- Test endpoint rate-limited (same family as login limiter)
- Super Admin test uses `agency_id = null` in usage rows

## Acceptance

- Saving without a new key does not wipe the stored key
- Test succeeds against a real key and fails cleanly against a bad key
- `GET` never includes the decrypted key
- An agency whose package has `llm: false` cannot call a future LLM route even if they guess the URL
- Global disable stops all LLM routes immediately

## Out of scope

- In-app assistant, RAG, document extraction
- Per-agency BYOK
- Image/audio models
- Storing chat history
