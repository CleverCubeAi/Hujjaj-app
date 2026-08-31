import { z } from 'zod';

export const HEX_COLOR = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color');

export const brandingPatchSchema = z.object({
  app_name: z.string().min(1).max(80).optional(),
  app_name_ar: z.string().min(1).max(80).optional(),
  app_name_fr: z.string().min(1).max(80).optional(),
  tagline_ar: z.string().max(200).optional().nullable(),
  tagline_fr: z.string().max(200).optional().nullable(),
  logo_url: z.string().max(2000).optional().nullable(),
  logo_mark_url: z.string().max(2000).optional().nullable(),
  favicon_url: z.string().max(2000).optional().nullable(),
  login_background_url: z.string().max(2000).optional().nullable(),
  primary_color: HEX_COLOR.optional(),
  accent_color: HEX_COLOR.optional(),
  support_email: z.string().email().max(255).optional().nullable().or(z.literal('')),
  support_phone: z.string().max(40).optional().nullable(),
  default_locale: z.enum(['ar', 'fr']).optional(),
  legal_name: z.string().max(200).optional().nullable(),
  copyright: z.string().max(200).optional().nullable(),
});

export const packageFeaturesSchema = z.object({
  max_users: z.number().int().min(0).nullable().optional(),
  max_branches: z.number().int().min(0).nullable().optional(),
  max_seasons: z.number().int().min(0).nullable().optional(),
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
  white_label: z.boolean().optional(),
  llm: z.boolean().optional(),
  inventory: z.boolean().optional(),
  reports: z.boolean().optional(),
  discounts: z.boolean().optional(),
});

export const createPackageSchema = z.object({
  slug: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/, 'Slug must be lowercase alphanumeric'),
  name_ar: z.string().min(1).max(120),
  name_fr: z.string().min(1).max(120),
  description_ar: z.string().max(500).optional().nullable(),
  description_fr: z.string().max(500).optional().nullable(),
  price_amount: z.number().min(0).default(0),
  currency: z.string().min(3).max(8).default('MAD'),
  billing_period: z.enum(['monthly', 'yearly', 'once']).default('monthly'),
  trial_days: z.number().int().min(0).max(365).default(0),
  is_public: z.boolean().default(true),
  is_default: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  features: packageFeaturesSchema.optional(),
  is_active: z.boolean().default(true),
});

export const updatePackageSchema = createPackageSchema.partial().omit({ slug: true }).extend({
  slug: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/).optional(),
});

export const assignSubscriptionSchema = z.object({
  package_id: z.string().uuid(),
  subscription_status: z.enum(['trialing', 'active', 'past_due', 'cancelled']).optional(),
  renews_at: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export const platformEmailSchema = z.object({
  provider: z.enum(['gmail', 'outlook', 'yahoo', 'custom']),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().optional(),
  username: z.string().min(1).max(255),
  password: z.string().max(500).optional(),
  from_email: z.string().email().max(255),
  from_name: z.string().min(1).max(120),
  enabled: z.boolean().optional(),
});

export const platformEmailTestSchema = z.object({
  to: z.string().email(),
});

export const llmPatchSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(['openai', 'anthropic', 'azure_openai', 'google', 'custom']).optional(),
  api_key: z.string().max(2000).optional(),
  base_url: z.string().max(500).optional().nullable(),
  api_version: z.string().max(40).optional().nullable(),
  default_model: z.string().min(1).max(120).optional(),
  timeout_ms: z.number().int().min(1000).max(120000).optional(),
  max_tokens: z.number().int().min(16).max(128000).optional(),
  monthly_budget_usd: z.number().min(0).optional().nullable(),
  budget_alert_email: z.string().email().max(255).optional().nullable().or(z.literal('')),
});

export const paymentGatewayPatchSchema = z.object({
  enabled: z.boolean().optional(),
  public_key: z.string().max(500).optional().nullable(),
  secret_key: z.string().max(500).optional(),
  webhook_secret: z.string().max(500).optional(),
  sandbox: z.boolean().optional(),
  extra: z.any().optional(),
});

export const checkoutSchema = z.object({
  package_id: z.string().uuid(),
});

export const createPlatformInvoiceSchema = z.object({
  agency_id: z.string().uuid(),
  package_id: z.string().uuid(),
  note: z.string().max(500).optional().nullable(),
});

export const markPaidSchema = z.object({
  note: z.string().max(500).optional().nullable(),
});

export const agencyBrandSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  name_ar: z.string().max(200).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  legal_name: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal('')),
  address: z.string().max(400).optional().nullable(),
  website: z.string().max(400).optional().nullable(),
  logo_url: z.string().max(2000).optional().nullable(),
  invoice_logo_url: z.string().max(2000).optional().nullable(),
  primary_color: HEX_COLOR.optional().nullable(),
  invoice_footer: z.string().max(400).optional().nullable(),
  hide_platform_mark: z.boolean().optional(),
  billing_email: z.string().email().max(255).optional().nullable().or(z.literal('')),
});
