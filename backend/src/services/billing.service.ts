import crypto from 'crypto';
import db from './db';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { ApiError } from '../utils/httpError';
import { assignPackageToAgency, recordSubscriptionEvent } from './packages.service';
import { agencyBillingEmail, sendPlatformMail } from './platformMail.service';
import { runAsPlatform } from '../middleware/rlsContext';

function publicBaseUrl() {
  return (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
}

function frontendBaseUrl() {
  return (process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
}

export function maskSecret(encrypted?: string | null) {
  if (!encrypted) return { configured: false, last4: null as string | null };
  try {
    const raw = decryptSecret(encrypted);
    return { configured: true, last4: raw.slice(-4) };
  } catch {
    return { configured: true, last4: null as string | null };
  }
}

export function publicGateway(row: any) {
  const secret = maskSecret(row?.secret_key_encrypted);
  const webhook = maskSecret(row?.webhook_secret_encrypted);
  return {
    id: row.id,
    provider: row.provider,
    enabled: !!row.enabled,
    public_key: row.public_key || null,
    sandbox: !!row.sandbox,
    extra: row.extra || {},
    secret_configured: secret.configured,
    webhook_secret_configured: webhook.configured,
    updated_at: row.updated_at || null,
    webhook_url:
      row.provider === 'stripe'
        ? `${publicBaseUrl()}/api/billing/webhooks/stripe`
        : row.provider === 'cmi'
          ? `${publicBaseUrl()}/api/billing/webhooks/cmi`
          : null,
  };
}

export async function getGateway(provider: string) {
  return db('platform_payment_gateways').where({ provider }).first();
}

export async function activeCardGateway() {
  const rows = await db('platform_payment_gateways')
    .whereIn('provider', ['stripe', 'cmi'])
    .andWhere({ enabled: true })
    .orderBy('provider', 'asc');
  return rows[0] || null;
}

export async function nextInvoiceNumber() {
  const [row] = await db('platform_counters')
    .where({ name: 'subscription_invoice' })
    .update({ value: db.raw('value + 1') })
    .returning('value');
  const seq = Number(row?.value || 1);
  const year = new Date().getUTCFullYear();
  return `SUB-${year}-${String(seq).padStart(5, '0')}`;
}

export function periodForPackage(pkg: any, from = new Date()) {
  const start = new Date(from);
  const end = new Date(from);
  if (pkg.billing_period === 'yearly') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else if (pkg.billing_period === 'once') end.setUTCFullYear(end.getUTCFullYear() + 10);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

export async function createSubscriptionInvoice(opts: {
  agencyId: string;
  packageId: string;
  provider?: string | null;
  status?: string;
  trx?: any;
}) {
  const q = opts.trx || db;
  const pkg = await q('subscription_packages').where({ id: opts.packageId }).first();
  if (!pkg) throw new ApiError(404, 'Package not found', 'package_not_found');
  const { start, end } = periodForPackage(pkg);
  const number = await nextInvoiceNumber();
  const [invoice] = await q('subscription_invoices')
    .insert({
      agency_id: opts.agencyId,
      package_id: pkg.id,
      number,
      amount: pkg.price_amount,
      currency: pkg.currency || 'MAD',
      period_start: start,
      period_end: end,
      status: opts.status || 'open',
      provider: opts.provider || null,
    })
    .returning('*');
  return { invoice, pkg };
}

export async function applyPaidInvoice(opts: {
  invoice: any;
  providerRef?: string | null;
  hostedUrl?: string | null;
  source: 'admin' | 'checkout' | 'webhook' | 'system';
  actorUserId?: string | null;
  note?: string | null;
}) {
  const invoice = await db('subscription_invoices').where({ id: opts.invoice.id }).first();
  if (!invoice) throw new ApiError(404, 'Invoice not found', 'invoice_not_found');
  if (invoice.status === 'paid') return invoice;
  if (invoice.status === 'void') throw new ApiError(400, 'Invoice is void', 'invoice_void');

  if (opts.providerRef) {
    const dup = await db('subscription_invoices')
      .where({ provider: invoice.provider || opts.invoice.provider, provider_ref: opts.providerRef })
      .whereNot({ id: invoice.id })
      .first();
    if (dup) return invoice;
  }

  await db.transaction(async (trx) => {
    await trx('subscription_invoices').where({ id: invoice.id }).update({
      status: 'paid',
      paid_at: new Date(),
      provider_ref: opts.providerRef || invoice.provider_ref,
      hosted_url: opts.hostedUrl || invoice.hosted_url,
    });
    await assignPackageToAgency({
      agencyId: invoice.agency_id,
      packageId: invoice.package_id,
      subscriptionStatus: 'active',
      startsAt: invoice.period_start,
      renewsAt: invoice.period_end,
      actorUserId: opts.actorUserId,
      source: opts.source,
      note: opts.note,
      trx,
    });
    await recordSubscriptionEvent({
      agency_id: invoice.agency_id,
      package_id: invoice.package_id,
      actor_user_id: opts.actorUserId,
      source: opts.source,
      action: 'renewed',
      note: opts.note,
      metadata: { invoice_id: invoice.id, number: invoice.number },
      trx,
    });
  });

  const to = await agencyBillingEmail(invoice.agency_id);
  if (to) {
    await sendPlatformMail({
      to,
      event: 'payment_received',
      vars: {
        number: invoice.number,
        amount: String(invoice.amount),
        currency: invoice.currency,
      },
    });
  }
  return db('subscription_invoices').where({ id: invoice.id }).first();
}

export async function markInvoiceFailed(invoice: any) {
  await db('subscription_invoices').where({ id: invoice.id }).update({ status: 'failed' });
  await db('agencies').where({ id: invoice.agency_id }).update({ subscription_status: 'past_due' });
  await recordSubscriptionEvent({
    agency_id: invoice.agency_id,
    package_id: invoice.package_id,
    source: 'webhook',
    action: 'past_due',
    metadata: { invoice_id: invoice.id },
  });
  const to = await agencyBillingEmail(invoice.agency_id);
  const branding = await db('platform_branding').where({ id: 1 }).first();
  const recipients = [to, branding?.support_email].filter(Boolean) as string[];
  if (recipients.length) {
    await sendPlatformMail({
      to: recipients,
      event: 'payment_failed',
      vars: { number: invoice.number, amount: String(invoice.amount), currency: invoice.currency },
    });
  }
}

export async function createCheckoutSession(agencyId: string, packageId: string) {
  const agency = await db('agencies').where({ id: agencyId }).first();
  if (!agency) throw new ApiError(404, 'Agency not found', 'agency_not_found');
  if (agency.status !== 'active') throw new ApiError(400, 'Agency is not active', 'agency_inactive');

  const pkg = await db('subscription_packages').where({ id: packageId }).first();
  if (!pkg || !pkg.is_public || !pkg.is_active) {
    throw new ApiError(400, 'Package is not available', 'package_not_public');
  }

  const { invoice } = await runAsPlatform(() =>
    createSubscriptionInvoice({
      agencyId,
      packageId: pkg.id,
      provider: Number(pkg.price_amount) === 0 ? 'manual' : null,
      status: Number(pkg.price_amount) === 0 ? 'open' : 'open',
    })
  );

  if (Number(pkg.price_amount) === 0) {
    await runAsPlatform(() => applyPaidInvoice({ invoice, source: 'checkout' }));
    return { checkout_url: `${frontendBaseUrl()}/settings?tab=subscription&billing=success`, invoice_id: invoice.id };
  }

  const gateway = await runAsPlatform(() => activeCardGateway());
  if (!gateway) {
    throw new ApiError(400, 'No payment gateway is enabled', 'gateway_not_configured');
  }

  if (gateway.provider === 'stripe') {
    const url = await createStripeCheckout(gateway, invoice, pkg, agencyId);
    await db('subscription_invoices').where({ id: invoice.id }).update({
      provider: 'stripe',
      hosted_url: url,
    });
    return { checkout_url: url, invoice_id: invoice.id };
  }

  if (gateway.provider === 'cmi') {
    const url = `${publicBaseUrl()}/api/billing/cmi/pay/${invoice.id}`;
    await db('subscription_invoices').where({ id: invoice.id }).update({
      provider: 'cmi',
      hosted_url: url,
    });
    return { checkout_url: url, invoice_id: invoice.id };
  }

  throw new ApiError(400, 'Unsupported gateway', 'gateway_unsupported');
}

async function createStripeCheckout(gateway: any, invoice: any, pkg: any, agencyId: string) {
  if (!gateway.secret_key_encrypted) throw new ApiError(400, 'Stripe secret is not configured', 'gateway_not_configured');
  const secret = decryptSecret(gateway.secret_key_encrypted);
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secret);
  const recurring =
    pkg.billing_period === 'once'
      ? undefined
      : { interval: (pkg.billing_period === 'yearly' ? 'year' : 'month') as 'year' | 'month' };
  const session = await stripe.checkout.sessions.create({
    mode: pkg.billing_period === 'once' ? 'payment' : 'subscription',
    success_url: `${frontendBaseUrl()}/settings?tab=subscription&billing=success`,
    cancel_url: `${frontendBaseUrl()}/settings?tab=subscription&billing=cancel`,
    client_reference_id: invoice.id,
    metadata: { agency_id: agencyId, package_id: pkg.id, invoice_id: invoice.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: String(pkg.currency || 'MAD').toLowerCase(),
          unit_amount: Math.round(Number(pkg.price_amount) * 100),
          product_data: { name: pkg.name_fr || pkg.name_ar || pkg.slug },
          ...(recurring ? { recurring } : {}),
        },
      },
    ],
  });
  return session.url as string;
}

export async function handleStripeEvent(rawBody: Buffer, signature: string) {
  const gateway = await getGateway('stripe');
  if (!gateway?.webhook_secret_encrypted) {
    throw new ApiError(400, 'Stripe webhook secret is not configured', 'gateway_not_configured');
  }
  const Stripe = (await import('stripe')).default;
  const key = gateway.secret_key_encrypted ? decryptSecret(gateway.secret_key_encrypted) : 'sk_test_unused';
  const stripe = new Stripe(key);
  const event = stripe.webhooks.constructEvent(rawBody, signature, decryptSecret(gateway.webhook_secret_encrypted));

  const created = Number(event.created || 0) * 1000;
  if (created && Date.now() - created > 24 * 60 * 60 * 1000) {
    throw new ApiError(400, 'Event too old', 'webhook_replay');
  }

  const obj: any = event.data?.object || {};
  const invoiceId = obj.client_reference_id || obj.metadata?.invoice_id;
  if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
    if (!invoiceId) return { ok: true };
    const invoice = await db('subscription_invoices').where({ id: invoiceId }).first();
    if (!invoice) return { ok: true };
    await applyPaidInvoice({
      invoice,
      providerRef: obj.id || obj.payment_intent || obj.subscription,
      hostedUrl: obj.url || null,
      source: 'webhook',
    });
  }
  if (event.type === 'invoice.payment_failed') {
    if (!invoiceId) return { ok: true };
    const invoice = await db('subscription_invoices').where({ id: invoiceId }).first();
    if (invoice) await markInvoiceFailed(invoice);
  }
  if (event.type === 'customer.subscription.deleted') {
    const agencyId = obj.metadata?.agency_id;
    if (agencyId) {
      await db('agencies').where({ id: agencyId }).update({ subscription_status: 'cancelled' });
      await recordSubscriptionEvent({
        agency_id: agencyId,
        source: 'webhook',
        action: 'cancelled',
        metadata: { stripe_subscription: obj.id },
      });
    }
  }
  return { ok: true };
}

export function cmiHash(params: Record<string, string>, storeKey: string) {
  const keys = Object.keys(params)
    .filter((k) => k.toLowerCase() !== 'hash' && k.toLowerCase() !== 'encoding')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  let hashval = '';
  for (const key of keys) {
    const escaped = String(params[key] ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
    hashval += `${escaped}|`;
  }
  hashval += String(storeKey).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  return crypto.createHash('sha512').update(hashval).digest('base64');
}

export async function buildCmiForm(invoiceId: string) {
  const invoice = await db('subscription_invoices').where({ id: invoiceId }).first();
  if (!invoice || invoice.status !== 'open') throw new ApiError(404, 'Invoice not found', 'invoice_not_found');
  const gateway = await getGateway('cmi');
  if (!gateway?.enabled) throw new ApiError(400, 'CMI is not enabled', 'gateway_not_configured');
  const extra = gateway.extra || {};
  const storeKey = extra.storeKey || extra.store_key;
  if (!gateway.public_key || !storeKey) throw new ApiError(400, 'CMI is not fully configured', 'gateway_not_configured');
  const action = gateway.sandbox
    ? 'https://testpayment.cmi.co.ma/fim/est3Dgate'
    : 'https://payment.cmi.co.ma/fim/est3Dgate';
  const params: Record<string, string> = {
    clientid: gateway.public_key,
    amount: Number(invoice.amount).toFixed(2),
    oid: invoice.number,
    okUrl: `${publicBaseUrl()}/api/billing/webhooks/cmi`,
    failUrl: `${publicBaseUrl()}/api/billing/webhooks/cmi`,
    shopurl: `${frontendBaseUrl()}/settings?tab=subscription`,
    rnd: String(Date.now()),
    currency: '504',
    storetype: '3d_pay_hosting',
    hashAlgorithm: 'ver3',
    lang: 'fr',
    BillToName: 'Agency',
    email: (await agencyBillingEmail(invoice.agency_id)) || 'billing@localhost',
    encoding: 'UTF-8',
    refreshtime: '5',
  };
  params.HASH = cmiHash(params, String(storeKey));
  return { action, params, invoice };
}

export async function handleCmiCallback(body: Record<string, string>) {
  const gateway = await getGateway('cmi');
  const extra = gateway?.extra || {};
  const storeKey = extra.storeKey || extra.store_key;
  if (!storeKey) throw new ApiError(400, 'CMI is not configured', 'gateway_not_configured');
  const hash = body.HASH || body.hash;
  const expected = cmiHash(body, String(storeKey));
  if (!hash || hash !== expected) throw new ApiError(400, 'Invalid CMI signature', 'webhook_invalid');
  const invoice = await db('subscription_invoices').where({ number: body.oid || body.OID }).first();
  if (!invoice) return { ok: true };
  const proc = String(body.ProcReturnCode || body.procreturncode || '');
  if (proc === '00') {
    await applyPaidInvoice({ invoice, providerRef: body.TransId || body.transid || body.oid, source: 'webhook' });
  } else {
    await markInvoiceFailed(invoice);
  }
  return { ok: true };
}

export async function testGateway(provider: string) {
  const gateway = await getGateway(provider);
  if (!gateway) throw new ApiError(404, 'Gateway not found', 'gateway_not_found');
  if (provider === 'manual') return { ok: true, message: 'Manual / bank is always available' };
  if (provider === 'cmi') {
    const extra = gateway.extra || {};
    if (!gateway.public_key || !(extra.storeKey || extra.store_key)) {
      return { ok: false, error: 'Merchant id and store key are required' };
    }
    return { ok: true, message: 'CMI configuration looks complete' };
  }
  if (provider === 'stripe') {
    if (!gateway.secret_key_encrypted) return { ok: false, error: 'Secret key is not configured' };
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(decryptSecret(gateway.secret_key_encrypted));
    const balance = await stripe.balance.retrieve();
    return { ok: true, message: 'Stripe connected', livemode: !gateway.sandbox, available: balance.available?.[0] || null };
  }
  return { ok: false, error: 'Unknown provider' };
}

export { encryptSecret, decryptSecret };
