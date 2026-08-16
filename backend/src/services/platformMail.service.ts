import db from './db';
import { sendEmail, EmailConfig } from './email.service';
import { runAsPlatform } from '../middleware/rlsContext';

const SEND_TIMEOUT_MS = 15000;

export type PlatformMailEvent =
  | 'agency_invited'
  | 'subscription_invoice'
  | 'payment_received'
  | 'payment_failed'
  | 'subscription_suspended'
  | 'password_reset'
  | 'llm_budget_alert';

async function withTimeout<T>(promise: Promise<T>, ms = SEND_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Email timeout')), ms)),
  ]);
}

export async function getPlatformEmailConfig(): Promise<EmailConfig | null> {
  const row = await db('platform_email_settings').where({ id: 1 }).first();
  if (!row || !row.enabled || !row.host || !row.username || !row.from_email || !row.password_encrypted) {
    return null;
  }
  return {
    provider: row.provider,
    host: row.host,
    port: Number(row.port || 587),
    secure: !!row.secure,
    auth: { user: row.username, pass: row.password_encrypted },
    from_email: row.from_email,
    from_name: row.from_name || 'Hujjaj',
  };
}

function wrapHtml(branding: any, title: string, body: string) {
  const name = branding?.app_name || 'Hujjaj';
  const logo = branding?.logo_url
    ? `<img src="${branding.logo_url}" alt="${name}" style="max-height:48px" />`
    : `<strong style="font-size:20px;color:${branding?.primary_color || '#8B7355'}">${name}</strong>`;
  const support = [branding?.support_email, branding?.support_phone].filter(Boolean).join(' · ');
  return `<!doctype html>
<html><body style="font-family:Tajawal,Arial,sans-serif;background:#F5EFE6;padding:24px;color:#2D2D2D">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8DFD0;border-radius:12px;padding:24px">
    <div style="margin-bottom:16px">${logo}</div>
    <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
    <div style="font-size:14px;line-height:1.6">${body}</div>
    ${support ? `<p style="margin-top:24px;font-size:12px;color:#6B6B6B">${support}</p>` : ''}
  </div>
</body></html>`;
}

export async function sendPlatformMail(opts: {
  to: string | string[];
  event: PlatformMailEvent;
  locale?: 'ar' | 'fr';
  vars?: Record<string, string>;
}): Promise<{ sent: boolean; skipped?: string }> {
  return runAsPlatform(async () => {
    const config = await getPlatformEmailConfig();
    if (!config) {
      console.warn('[platform-mail] skipped: platform SMTP not configured');
      return { sent: false, skipped: 'email_not_configured' };
    }
    const branding = await db('platform_branding').where({ id: 1 }).first();
    const locale = opts.locale || branding?.default_locale || 'ar';
    const vars = opts.vars || {};
    const appName = locale === 'fr' ? branding?.app_name_fr || branding?.app_name : branding?.app_name_ar || branding?.app_name;
    const copy = templates(locale, appName, vars)[opts.event];
    const html = wrapHtml(branding, copy.subject, copy.html);
    const to = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to;
    try {
      await withTimeout(sendEmail(config, to, copy.subject, html));
      return { sent: true };
    } catch (err: any) {
      console.error('[platform-mail] send failed', opts.event, err?.message);
      return { sent: false, skipped: err?.message || 'send_failed' };
    }
  });
}

function templates(locale: 'ar' | 'fr', appName: string, v: Record<string, string>) {
  const fr = locale === 'fr';
  return {
    agency_invited: {
      subject: fr ? `Bienvenue sur ${appName}` : `مرحباً بك في ${appName}`,
      html: fr
        ? `<p>Votre agence <strong>${v.agency_name || ''}</strong> a été créée.</p><p>Connexion : ${v.email || ''}</p>`
        : `<p>تم إنشاء وكالتكم <strong>${v.agency_name || ''}</strong>.</p><p>تسجيل الدخول: ${v.email || ''}</p>`,
    },
    subscription_invoice: {
      subject: fr ? `Facture ${v.number || ''}` : `فاتورة ${v.number || ''}`,
      html: fr
        ? `<p>Une facture d'abonnement ${v.number || ''} d'un montant de ${v.amount || ''} ${v.currency || 'MAD'} est ouverte.</p>`
        : `<p>فاتورة اشتراك ${v.number || ''} بمبلغ ${v.amount || ''} ${v.currency || 'MAD'}.</p>`,
    },
    payment_received: {
      subject: fr ? `Paiement reçu ${v.number || ''}` : `تم استلام الدفع ${v.number || ''}`,
      html: fr
        ? `<p>Nous avons reçu votre paiement ${v.amount || ''} ${v.currency || 'MAD'} (${v.number || ''}).</p>`
        : `<p>تم استلام دفعتكم ${v.amount || ''} ${v.currency || 'MAD'} (${v.number || ''}).</p>`,
    },
    payment_failed: {
      subject: fr ? `Échec de paiement ${v.number || ''}` : `فشل الدفع ${v.number || ''}`,
      html: fr
        ? `<p>Le paiement de la facture ${v.number || ''} a échoué. Merci de réessayer.</p>`
        : `<p>فشل دفع الفاتورة ${v.number || ''}. يرجى المحاولة مرة أخرى.</p>`,
    },
    subscription_suspended: {
      subject: fr ? `Compte suspendu` : `تم تعليق الحساب`,
      html: fr
        ? `<p>Le compte de l'agence ${v.agency_name || ''} a été suspendu.</p>`
        : `<p>تم تعليق حساب الوكالة ${v.agency_name || ''}.</p>`,
    },
    password_reset: {
      subject: fr ? `Réinitialisation du mot de passe` : `إعادة تعيين كلمة المرور`,
      html: fr
        ? `<p>Utilisez ce lien pour réinitialiser votre mot de passe : ${v.reset_url || ''}</p>`
        : `<p>استخدموا هذا الرابط لإعادة تعيين كلمة المرور: ${v.reset_url || ''}</p>`,
    },
    llm_budget_alert: {
      subject: fr ? `Budget LLM atteint` : `تم بلوغ ميزانية الذكاء الاصطناعي`,
      html: fr
        ? `<p>Le budget mensuel LLM (${v.budget || ''}) a été atteint. Dépenses : ${v.spent || ''}.</p>`
        : `<p>تم بلوغ الميزانية الشهرية للذكاء الاصطناعي (${v.budget || ''}). المصروف: ${v.spent || ''}.</p>`,
    },
  };
}

export async function agencyBillingEmail(agencyId: string): Promise<string | null> {
  const agency = await db('agencies').where({ id: agencyId }).first();
  if (agency?.billing_email) return agency.billing_email;
  if (agency?.email) return agency.email;
  const admin = await db('users').where({ agency_id: agencyId, role: 'agency_admin' }).orderBy('created_at', 'asc').first();
  return admin?.email || null;
}
