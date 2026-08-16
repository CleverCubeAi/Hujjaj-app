import db from './db';
import { ApiError } from '../utils/httpError';

export type FeatureFlags = {
  max_users: number | null;
  max_branches: number | null;
  max_seasons: number | null;
  email: boolean;
  sms: boolean;
  white_label: boolean;
  llm: boolean;
  inventory: boolean;
  reports: boolean;
  discounts: boolean;
};

export type AgencyEntitlements = {
  agencyId: string;
  status: string;
  subscription_status: string;
  package: {
    id: string;
    slug: string;
    name_ar: string;
    name_fr: string;
    price_amount: number;
    currency: string;
    billing_period: string;
    is_active: boolean;
  } | null;
  features: FeatureFlags;
  renews_at: string | null;
  starts_at: string | null;
};

const BOOLEAN_FEATURES = ['email', 'sms', 'white_label', 'llm', 'inventory', 'reports', 'discounts'] as const;
const LIMIT_FEATURES = ['max_users', 'max_branches', 'max_seasons'] as const;

export const FEATURE_DEFAULTS: FeatureFlags = {
  max_users: 3,
  max_branches: 1,
  max_seasons: 2,
  email: false,
  sms: false,
  white_label: false,
  llm: false,
  inventory: true,
  reports: true,
  discounts: true,
};

export const FREE_FEATURES: FeatureFlags = {
  max_users: 2,
  max_branches: 1,
  max_seasons: 2,
  email: false,
  sms: false,
  white_label: false,
  llm: false,
  inventory: true,
  reports: true,
  discounts: true,
};

function asBool(value: unknown, fallback: boolean) {
  if (value === true || value === false) return value;
  return fallback;
}

function asLimit(value: unknown, fallback: number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export function normalizeFeatures(raw?: unknown): FeatureFlags {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    max_users: 'max_users' in src ? asLimit(src.max_users, FEATURE_DEFAULTS.max_users) : FEATURE_DEFAULTS.max_users,
    max_branches: 'max_branches' in src ? asLimit(src.max_branches, FEATURE_DEFAULTS.max_branches) : FEATURE_DEFAULTS.max_branches,
    max_seasons: 'max_seasons' in src ? asLimit(src.max_seasons, FEATURE_DEFAULTS.max_seasons) : FEATURE_DEFAULTS.max_seasons,
    email: asBool(src.email, false),
    sms: asBool(src.sms, false),
    white_label: asBool(src.white_label, false),
    llm: asBool(src.llm, false),
    inventory: asBool(src.inventory, FEATURE_DEFAULTS.inventory),
    reports: asBool(src.reports, FEATURE_DEFAULTS.reports),
    discounts: asBool(src.discounts, FEATURE_DEFAULTS.discounts),
  };
}

export async function getDefaultPackage() {
  const row = await db('subscription_packages').where({ is_default: true, is_active: true }).first();
  if (row) return row;
  return db('subscription_packages').where({ slug: 'free' }).first();
}

export async function getAgencyEntitlements(agencyId: string): Promise<AgencyEntitlements> {
  const agency = await db('agencies').where({ id: agencyId }).first();
  if (!agency) {
    throw new ApiError(404, 'Agency not found', 'agency_not_found');
  }

  let pkg: any = null;
  if (agency.package_id) {
    pkg = await db('subscription_packages').where({ id: agency.package_id }).first();
  }
  if (!pkg) {
    pkg = await db('subscription_packages').where({ slug: 'free' }).first();
  }

  const features = pkg ? normalizeFeatures(pkg.features) : { ...FREE_FEATURES };

  return {
    agencyId,
    status: agency.status || 'active',
    subscription_status: agency.subscription_status || 'active',
    package: pkg
      ? {
          id: pkg.id,
          slug: pkg.slug,
          name_ar: pkg.name_ar,
          name_fr: pkg.name_fr,
          price_amount: Number(pkg.price_amount || 0),
          currency: pkg.currency || 'MAD',
          billing_period: pkg.billing_period,
          is_active: pkg.is_active,
        }
      : null,
    features,
    renews_at: agency.subscription_renews_at || null,
    starts_at: agency.subscription_starts_at || null,
  };
}

export async function assertFeatureEnabled(agencyId: string, feature: keyof FeatureFlags) {
  const ent = await getAgencyEntitlements(agencyId);
  const value = ent.features[feature];
  if (typeof value === 'boolean' && !value) {
    throw new ApiError(403, `Feature '${feature}' is not included in the current package`, 'package_feature_disabled');
  }
  return ent;
}

export async function assertWritableSubscription(agencyId: string) {
  const ent = await getAgencyEntitlements(agencyId);
  if (ent.subscription_status === 'past_due') {
    throw new ApiError(403, 'Subscription is past due', 'subscription_past_due');
  }
  if (ent.subscription_status === 'cancelled') {
    throw new ApiError(403, 'Subscription is cancelled', 'subscription_cancelled');
  }
  return ent;
}

export async function assertLimit(
  agencyId: string,
  kind: 'max_users' | 'max_branches' | 'max_seasons'
) {
  const ent = await getAgencyEntitlements(agencyId);
  const max = ent.features[kind];
  if (max === null) return ent;

  let count = 0;
  if (kind === 'max_users') {
    const [row] = await db('users').where({ agency_id: agencyId }).count('id as count');
    count = Number(row?.count || 0);
  } else if (kind === 'max_branches') {
    const [row] = await db('branches').where({ agency_id: agencyId }).count('id as count');
    count = Number(row?.count || 0);
  } else {
    const [row] = await db('seasons').where({ agency_id: agencyId }).count('id as count');
    count = Number(row?.count || 0);
  }

  if (count >= max) {
    const code =
      kind === 'max_users' ? 'package_user_limit' : kind === 'max_branches' ? 'package_branch_limit' : 'package_season_limit';
    throw new ApiError(400, `Package limit reached (${kind}=${max})`, code);
  }
  return ent;
}

export async function recordSubscriptionEvent(input: {
  agency_id: string;
  package_id?: string | null;
  actor_user_id?: string | null;
  source: 'admin' | 'checkout' | 'webhook' | 'system';
  action: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
  trx?: any;
}) {
  const q = input.trx || db;
  await q('subscription_events').insert({
    agency_id: input.agency_id,
    package_id: input.package_id || null,
    actor_user_id: input.actor_user_id || null,
    source: input.source,
    action: input.action,
    note: input.note || null,
    metadata: input.metadata || {},
  });
}

export async function assignPackageToAgency(opts: {
  agencyId: string;
  packageId: string;
  subscriptionStatus?: string;
  renewsAt?: Date | string | null;
  startsAt?: Date | string | null;
  actorUserId?: string | null;
  source: 'admin' | 'checkout' | 'webhook' | 'system';
  note?: string | null;
  trx?: any;
}) {
  const q = opts.trx || db;
  const pkg = await q('subscription_packages').where({ id: opts.packageId }).first();
  if (!pkg) throw new ApiError(404, 'Package not found', 'package_not_found');

  const startsAt = opts.startsAt || new Date();
  const renewsAt = opts.renewsAt || null;
  const status = opts.subscriptionStatus || 'active';

  await q('agencies').where({ id: opts.agencyId }).update({
    package_id: pkg.id,
    subscription_plan: pkg.slug,
    subscription_status: status,
    subscription_starts_at: startsAt,
    subscription_renews_at: renewsAt,
  });

  await recordSubscriptionEvent({
    agency_id: opts.agencyId,
    package_id: pkg.id,
    actor_user_id: opts.actorUserId,
    source: opts.source,
    action: 'assigned',
    note: opts.note,
    metadata: { slug: pkg.slug, status },
    trx: opts.trx,
  });

  return pkg;
}

export { BOOLEAN_FEATURES, LIMIT_FEATURES };
