import cron from 'node-cron';
import db from '../services/db';
import { runAsPlatform } from '../middleware/rlsContext';
import { recordSubscriptionEvent } from '../services/packages.service';
import { agencyBillingEmail, sendPlatformMail } from '../services/platformMail.service';

const GRACE_DAYS = 7;

export async function suspendPastDueAgencies() {
  return runAsPlatform(async () => {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
    const agencies = await db('agencies')
      .where({ subscription_status: 'past_due' })
      .andWhere((q) => {
        q.where('subscription_renews_at', '<', cutoff).orWhere((inner) => {
          inner.whereNull('subscription_renews_at').andWhere('created_at', '<', cutoff);
        });
      })
      .andWhereNot({ status: 'suspended' });

    const cancelled = await db('agencies')
      .where({ subscription_status: 'cancelled' })
      .andWhere('subscription_renews_at', '<', cutoff)
      .andWhereNot({ status: 'suspended' });

    const targets = [...agencies, ...cancelled];
    for (const agency of targets) {
      await db('agencies').where({ id: agency.id }).update({ status: 'suspended' });
      await recordSubscriptionEvent({
        agency_id: agency.id,
        package_id: agency.package_id,
        source: 'system',
        action: 'cancelled',
        note: 'Suspended after 7-day grace',
      });
      const admins = await db('users').where({ agency_id: agency.id, role: 'agency_admin' }).select('email');
      const billing = await agencyBillingEmail(agency.id);
      const to = [...new Set([billing, ...admins.map((u) => u.email)].filter(Boolean))] as string[];
      if (to.length) {
        await sendPlatformMail({
          to,
          event: 'subscription_suspended',
          vars: { agency_name: agency.name },
        });
      }
    }
  });
}

export function scheduleSubscriptionGraceJob() {
  cron.schedule('15 * * * *', () => {
    suspendPastDueAgencies().catch((err) => console.error('[subscription-grace]', err));
  });
}
