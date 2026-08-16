import { Request, Response } from 'express';
import db from '../services/db';
import { ApiError, sendApiError } from '../utils/httpError';
import { runAsPlatform } from '../middleware/rlsContext';
import {
  buildCmiForm,
  createCheckoutSession,
  handleCmiCallback,
  handleStripeEvent,
} from '../services/billing.service';

export const createCheckout = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    if (!agencyId) throw new ApiError(403, 'Agency required', 'agency_required');
    if (req.user?.role !== 'agency_admin') {
      throw new ApiError(403, 'Only agency admins can checkout', 'forbidden');
    }
    const result = await createCheckoutSession(agencyId, req.body.package_id);
    res.json(result);
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const listAgencyInvoices = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    if (!agencyId) throw new ApiError(403, 'Agency required', 'agency_required');
    const rows = await db('subscription_invoices')
      .select(
        'subscription_invoices.*',
        'subscription_packages.slug as package_slug',
        'subscription_packages.name_fr as package_name_fr',
        'subscription_packages.name_ar as package_name_ar'
      )
      .join('subscription_packages', 'subscription_packages.id', 'subscription_invoices.package_id')
      .where('subscription_invoices.agency_id', agencyId)
      .orderBy('subscription_invoices.created_at', 'desc');
    res.json(rows);
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const getAgencyInvoice = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    if (!agencyId) throw new ApiError(403, 'Agency required', 'agency_required');
    const row = await db('subscription_invoices')
      .where({ id: req.params.id, agency_id: agencyId })
      .first();
    if (!row) throw new ApiError(404, 'Invoice not found');
    res.json(row);
  } catch (err) {
    return sendApiError(res, err);
  }
};

export const stripeWebhook = async (req: Request, res: Response) => {
  try {
    const signature = String(req.headers['stripe-signature'] || '');
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const result = await runAsPlatform(() => handleStripeEvent(raw, signature));
    res.json(result);
  } catch (err: any) {
    const status = err instanceof ApiError ? err.status : 400;
    res.status(status).json({ error: err.message || 'Webhook failed' });
  }
};

export const cmiWebhook = async (req: Request, res: Response) => {
  try {
    const body = { ...(req.body || {}), ...(req.query || {}) } as Record<string, string>;
    const result = await runAsPlatform(() => handleCmiCallback(body));
    res.json(result);
  } catch (err: any) {
    const status = err instanceof ApiError ? err.status : 400;
    res.status(status).json({ error: err.message || 'Webhook failed' });
  }
};

export const cmiPayRedirect = async (req: Request, res: Response) => {
  try {
    const { action, params } = await runAsPlatform(() => buildCmiForm(String(req.params.invoiceId)));
    const inputs = Object.entries(params)
      .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(String(v))}" />`)
      .join('');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html><body>
      <p>Redirecting to payment…</p>
      <form id="cmi" method="post" action="${escapeHtml(action)}">${inputs}</form>
      <script>document.getElementById('cmi').submit()</script>
    </body></html>`);
  } catch (err) {
    return sendApiError(res, err);
  }
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
