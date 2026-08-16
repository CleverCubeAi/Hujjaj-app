/**
 * Idempotent seed: create platform super_admin if none exists.
 * Env: SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME
 */
import dotenv from 'dotenv';
import path from 'path';
import db from '../services/db';
import { hashPassword } from '../services/auth.service';
import { runAsPlatform } from '../middleware/rlsContext';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

async function seedSuperAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@hujjaj.app').toLowerCase().trim();
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin123!';
  const fullName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  try {
    await runAsPlatform(async () => {
    const existingSuper = await db('users').where({ role: 'super_admin' }).first();
    if (existingSuper) {
      // Ensure platform super admin is never tied to an agency
      if (existingSuper.agency_id || existingSuper.branch_id) {
        await db('users').where({ id: existingSuper.id }).update({
          agency_id: null,
          branch_id: null,
        });
        console.log(`[seed] Cleared agency/branch from super admin (${existingSuper.email})`);
      } else {
        console.log(`[seed] Super admin already exists (${existingSuper.email}) — skipping`);
      }
      return;
    }

    const existingEmail = await db('users').where({ email }).first();
    if (existingEmail) {
      await db('users').where({ id: existingEmail.id }).update({
        role: 'super_admin',
        agency_id: null,
        branch_id: null,
      });
      console.log(`[seed] Promoted existing user to platform super_admin (no agency): ${email}`);
      return;
    }

    const password_hash = await hashPassword(password);
    const [user] = await db('users')
      .insert({
        email,
        password_hash,
        full_name: fullName,
        role: 'super_admin',
        agency_id: null,
        branch_id: null,
      })
      .returning(['id', 'email', 'role']);

    console.log(`[seed] Super admin created: ${user.email} (id=${user.id})`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[seed] Default login — email: ${email} / password: [REDACTED]`);
    } else {
      console.log('[seed] Super admin password is set from SUPER_ADMIN_PASSWORD (not logged in production)');
    }
    });
  } finally {
    await db.destroy();
  }
}

seedSuperAdmin().catch((err) => {
  console.error('[seed] Failed to seed super admin:', err.message || err);
  process.exit(1);
});
