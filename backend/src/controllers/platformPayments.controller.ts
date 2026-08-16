import { Request, Response } from 'express';
import db from '../services/db';
import { ApiError, sendApiError } from '../utils/httpError';
import {
  applyPaidInvoice,
  createSubscriptionInvoice,
  decryptSecret,
  encryptSecret,
  getGateway,
  publicGateway,
  testGateway,
} from '../services/billing.service';
import { recordSubscriptionEvent } from '../services/packages.service';

const PROVIDERS = ['stripe', 'cmi', 'manual'] as const;

export const getPaymentGateway = async (req: Request, res: Response) => {
  try {
    const provider = String(req.params.provider);
    if (!PROVIDERS.includes(provider as any)) throw new ApiError(404, 'Unknown provider');
    const row = await getGateway(provider);
    if (!row) throw new ApiError(404, 'Gateway not found');
    res.json(publicGateway(row));
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const listPaymentGateways = async (_req: Request, res: Response) => {
  try {
    const rows = await db('platform_payment_gateways').orderBy('provider');
    res.json(rows.map(publicGateway));
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const patchPaymentGateway = async (req: Request, res: Response) => {
  try {
    const provider = String(req.params.provider);
    if (!PROVIDERS.includes(provider as any)) throw new ApiError(404, 'Unknown provider');
    const existing = await getGateway(provider);
    if (!existing) throw new ApiError(404, 'Gateway not found');
    const body = req.body || {};
    const update: Record<string, unknown> = {
      updated_at: new Date(),
      updated_by: req.user?.id || null,
    };
    if (body.enabled !== undefined) update.enabled = provider === 'manual' ? true : body.enabled;
    if (body.public_key !== undefined) update.public_key = body.public_key || null;
    if (body.sandbox !== undefined) update.sandbox = body.sandbox;
    if (body.extra !== undefined) update.extra = body.extra || {};
    if (body.secret_key) update.secret_key_encrypted = encryptSecret(body.secret_key);
    if (body.secret_key === '') update.secret_key_encrypted = null;
    if (body.webhook_secret) update.webhook_secret_encrypted = encryptSecret(body.webhook_secret);
    if (body.webhook_secret === '') update.webhook_secret_encrypted = null;

    if (body.enabled && (provider === 'stripe' || provider === 'cmi')) {
      await db('platform_payment_gateways')
        .whereIn('provider', ['stripe', 'cmi'])
        .whereNot({ provider })
        .update({ enabled: false });
    }

    const [row] = await db('platform_payment_gateways').where({ provider }).update(update).returning('*');
    res.json(publicGateway(row));
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const testPaymentGateway = async (req: Request, res: Response) => {
  try {
    const result = await testGateway(String(req.params.provider));
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const listPlatformInvoices = async (req: Request, res: Response) => {
  try {
    const q = db('subscription_invoices')
      .select(
        'subscription_invoices.*',
        'agencies.name as agency_name',
        'subscription_packages.slug as package_slug',
        'subscription_packages.name_fr as package_name_fr',
        'subscription_packages.name_ar as package_name_ar'
      )
      .join('agencies', 'agencies.id', 'subscription_invoices.agency_id')
      .join('subscription_packages', 'subscription_packages.id', 'subscription_invoices.package_id')
      .orderBy('subscription_invoices.created_at', 'desc');
    if (typeof req.query.agency_id === 'string' && req.query.agency_id) {
      q.where('subscription_invoices.agency_id', req.query.agency_id);
    }
    if (typeof req.query.status === 'string' && req.query.status) {
      q.where('subscription_invoices.status', req.query.status);
    }
    res.json(await q);
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const createPlatformInvoice = async (req: Request, res: Response) => {
  try {
    const { invoice, pkg } = await createSubscriptionInvoice({
      agencyId: req.body.agency_id,
      packageId: req.body.package_id,
      provider: 'manual',
    });
    await recordSubscriptionEvent({
      agency_id: req.body.agency_id,
      package_id: pkg.id,
      actor_user_id: req.user?.id || null,
      source: 'admin',
      action: 'assigned',
      note: req.body.note || 'Bank invoice created',
      metadata: { invoice_id: invoice.id },
    });
    res.status(201).json(invoice);
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const markInvoicePaid = async (req: Request, res: Response) => {
  try {
    const invoice = await db('subscription_invoices').where({ id: req.params.id }).first();
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    const updated = await applyPaidInvoice({
      invoice,
      source: 'admin',
      actorUserId: req.user?.id || null,
      note: req.body?.note || 'Marked paid',
    });
    res.json(updated);
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const voidInvoice = async (req: Request, res: Response) => {
  try {
    const invoice = await db('subscription_invoices').where({ id: req.params.id }).first();
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status === 'paid') throw new ApiError(400, 'Cannot void a paid invoice');
    const [updated] = await db('subscription_invoices').where({ id: invoice.id }).update({ status: 'void' }).returning('*');
    res.json(updated);
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const refundInvoice = async (req: Request, res: Response) => {
  try {
    const invoice = await db('subscription_invoices').where({ id: req.params.id }).first();
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status !== 'paid') throw new ApiError(400, 'Only paid invoices can be refunded');
    if (invoice.provider === 'stripe' && invoice.provider_ref) {
      const gateway = await getGateway('stripe');
      if (gateway?.secret_key_encrypted) {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(decryptSecret(gateway.secret_key_encrypted));
        try {
          await stripe.refunds.create({ payment_intent: invoice.provider_ref });
        } catch {
          // Checkout sessions store session id; refund may need to be marked manually
        }
      }
    }
    const [updated] = await db('subscription_invoices').where({ id: invoice.id }).update({ status: 'refunded' }).returning('*');
    res.json(updated);
  } catch (err) {
    return sendApiError(res, err);
  }
};
