import { Request, Response } from 'express';
import db from '../services/db';
import { runAsPlatform } from '../middleware/rlsContext';
import { ApiError, sendApiError } from '../utils/httpError';
import {
  assignPackageToAgency,
  getAgencyEntitlements,
  getDefaultPackage,
  normalizeFeatures,
} from '../services/packages.service';

function publicPackageRow(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    name_ar: row.name_ar,
    name_fr: row.name_fr,
    description_ar: row.description_ar,
    description_fr: row.description_fr,
    price_amount: Number(row.price_amount || 0),
    currency: row.currency,
    billing_period: row.billing_period,
    trial_days: row.trial_days,
    features: normalizeFeatures(row.features),
    sort_order: row.sort_order,
  };
}

export const listPublicPackages = async (_req: Request, res: Response) => {
  try {
    const rows = await runAsPlatform(() =>
      db('subscription_packages')
        .where({ is_public: true, is_active: true })
        .orderBy('sort_order', 'asc')
        .orderBy('price_amount', 'asc')
    );
    res.json(rows.map(publicPackageRow));
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const listPackages = async (_req: Request, res: Response) => {
  try {
    const rows = await db('subscription_packages')
      .select(
        'subscription_packages.*',
        db.raw(`(
          SELECT COUNT(*)::int FROM agencies WHERE agencies.package_id = subscription_packages.id
        ) as agency_count`)
      )
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
    res.json(rows.map((row) => ({ ...row, features: normalizeFeatures(row.features), price_amount: Number(row.price_amount || 0) })));
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const createPackage = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const existing = await db('subscription_packages').where({ slug: body.slug }).first();
    if (existing) throw new ApiError(400, 'Slug already in use', 'package_slug_taken');

    await db.transaction(async (trx) => {
      if (body.is_default) {
        await trx('subscription_packages').update({ is_default: false });
      }
      const [row] = await trx('subscription_packages')
        .insert({
          slug: body.slug,
          name_ar: body.name_ar,
          name_fr: body.name_fr,
          description_ar: body.description_ar || null,
          description_fr: body.description_fr || null,
          price_amount: body.price_amount ?? 0,
          currency: body.currency || 'MAD',
          billing_period: body.billing_period || 'monthly',
          trial_days: body.trial_days ?? 0,
          is_public: body.is_public !== false,
          is_default: !!body.is_default,
          sort_order: body.sort_order ?? 0,
          features: normalizeFeatures(body.features),
          is_active: body.is_active !== false,
          updated_at: new Date(),
        })
        .returning('*');
      res.status(201).json({ ...row, features: normalizeFeatures(row.features), price_amount: Number(row.price_amount || 0) });
    });
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const updatePackage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db('subscription_packages').where({ id }).first();
    if (!existing) throw new ApiError(404, 'Package not found', 'package_not_found');

    const body = req.body;
    if (body.slug && body.slug !== existing.slug) {
      const clash = await db('subscription_packages').where({ slug: body.slug }).first();
      if (clash) throw new ApiError(400, 'Slug already in use', 'package_slug_taken');
    }

    if (existing.is_default && body.is_default === false) {
      throw new ApiError(400, 'Assign another default package first', 'package_default_required');
    }

    await db.transaction(async (trx) => {
      if (body.is_default) {
        await trx('subscription_packages').whereNot({ id }).update({ is_default: false });
      }
      const update: Record<string, unknown> = { updated_at: new Date() };
      const keys = [
        'slug', 'name_ar', 'name_fr', 'description_ar', 'description_fr',
        'price_amount', 'currency', 'billing_period', 'trial_days',
        'is_public', 'is_default', 'sort_order', 'is_active',
      ];
      for (const key of keys) {
        if (body[key] !== undefined) update[key] = body[key];
      }
      if (body.features !== undefined) {
        update.features = normalizeFeatures({ ...normalizeFeatures(existing.features), ...body.features });
      }
      const [row] = await trx('subscription_packages').where({ id }).update(update).returning('*');
      res.json({ ...row, features: normalizeFeatures(row.features), price_amount: Number(row.price_amount || 0) });
    });
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const deletePackage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db('subscription_packages').where({ id }).first();
    if (!existing) throw new ApiError(404, 'Package not found', 'package_not_found');
    if (existing.is_default) {
      throw new ApiError(400, 'Cannot delete the default package', 'package_default_required');
    }
    const [{ count }] = await db('agencies').where({ package_id: id }).count('id as count');
    if (Number(count) > 0) {
      throw new ApiError(400, 'Package is still assigned to agencies. Deactivate it instead.', 'package_in_use');
    }
    await db('subscription_packages').where({ id }).delete();
    res.json({ message: 'Package deleted' });
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const assignAgencySubscription = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agency = await db('agencies').where({ id }).first();
    if (!agency) throw new ApiError(404, 'Agency not found', 'agency_not_found');

    const pkg = await db('subscription_packages').where({ id: req.body.package_id }).first();
    if (!pkg) throw new ApiError(404, 'Package not found', 'package_not_found');
    if (!pkg.is_active) throw new ApiError(400, 'Package is not active', 'package_inactive');

    await assignPackageToAgency({
      agencyId: id,
      packageId: pkg.id,
      subscriptionStatus: req.body.subscription_status || 'active',
      renewsAt: req.body.renews_at || null,
      actorUserId: req.user?.id || null,
      source: 'admin',
      note: req.body.note || null,
    });

    const updated = await db('agencies').where({ id }).first();
    res.json(updated);
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const getAgencySubscription = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    if (!agencyId) throw new ApiError(403, 'Agency required', 'agency_required');
    const ent = await getAgencyEntitlements(agencyId);
    const gateways = await runAsPlatform(() =>
      db('platform_payment_gateways').select('provider', 'enabled', 'sandbox')
    );
    const cardEnabled = gateways.some((g) => g.enabled && (g.provider === 'stripe' || g.provider === 'cmi'));
    res.json({
      package: ent.package,
      features: ent.features,
      status: ent.subscription_status,
      account_status: ent.status,
      renews_at: ent.renews_at,
      starts_at: ent.starts_at,
      can_self_serve: cardEnabled,
    });
  } catch (err) {
    return sendApiError(res, err);
  }
};

export { getDefaultPackage, publicPackageRow };
