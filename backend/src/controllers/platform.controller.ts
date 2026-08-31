import { Request, Response } from 'express';
import db from '../services/db';
import { hashPassword } from '../services/auth.service';
import { assignPackageToAgency, getDefaultPackage, assertLimit } from '../services/packages.service';
import { sendPlatformMail } from '../services/platformMail.service';
import { sendApiError } from '../utils/httpError';

const USER_PUBLIC = ['id', 'email', 'full_name', 'role', 'agency_id', 'branch_id', 'created_at'] as const;

function isUniqueViolation(err: any) {
  return err?.code === '23505';
}

export const getPlatformDashboard = async (_req: Request, res: Response) => {
  try {
    const [agencyStats] = await db('agencies').select(
      db.raw('COUNT(*)::int as total'),
      db.raw(`COUNT(*) FILTER (WHERE status = 'active')::int as active`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'inactive')::int as inactive`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'suspended')::int as suspended`)
    );

    const byPlanRows = await db('agencies')
      .leftJoin('subscription_packages', 'subscription_packages.id', 'agencies.package_id')
      .select(
        db.raw(`COALESCE(subscription_packages.slug, agencies.subscription_plan, 'free') as slug`),
        db.raw('COUNT(*)::int as count')
      )
      .groupByRaw(`COALESCE(subscription_packages.slug, agencies.subscription_plan, 'free')`);

    const byPlan: Record<string, number> = {};
    for (const row of byPlanRows) {
      byPlan[row.slug] = Number(row.count || 0);
    }

    const [userStats] = await db('users')
      .whereNot({ role: 'super_admin' })
      .select(db.raw('COUNT(*)::int as total'));

    const recentAgencies = await db('agencies')
      .leftJoin('subscription_packages', 'subscription_packages.id', 'agencies.package_id')
      .select(
        'agencies.id',
        'agencies.name',
        'agencies.country',
        'agencies.status',
        'agencies.subscription_plan',
        'agencies.package_id',
        'agencies.created_at',
        'subscription_packages.slug as package_slug',
        'subscription_packages.name_fr as package_name_fr',
        'subscription_packages.name_ar as package_name_ar'
      )
      .orderBy('agencies.created_at', 'desc')
      .limit(8);

    res.json({
      agencies: {
        total: Number(agencyStats?.total || 0),
        active: Number(agencyStats?.active || 0),
        inactive: Number(agencyStats?.inactive || 0),
        suspended: Number(agencyStats?.suspended || 0),
        byPlan,
      },
      users: { total: Number(userStats?.total || 0) },
      recentAgencies,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const listAgencies = async (req: Request, res: Response) => {
  try {
    const { search, status, subscription_plan, package_id } = req.query;
    const q = db('agencies')
      .leftJoin('subscription_packages', 'subscription_packages.id', 'agencies.package_id')
      .select(
        'agencies.*',
        'subscription_packages.slug as package_slug',
        'subscription_packages.name_fr as package_name_fr',
        'subscription_packages.name_ar as package_name_ar',
        db.raw(`(
          SELECT COUNT(*)::int FROM users
          WHERE users.agency_id = agencies.id AND users.role <> 'super_admin'
        ) as user_count`)
      )
      .orderBy('agencies.created_at', 'desc');

    if (typeof status === 'string' && status.trim()) {
      q.where('agencies.status', status.trim());
    }
    if (typeof package_id === 'string' && package_id.trim()) {
      q.where('agencies.package_id', package_id.trim());
    }
    if (typeof subscription_plan === 'string' && subscription_plan.trim()) {
      q.where((builder) => {
        builder
          .where('agencies.subscription_plan', subscription_plan.trim())
          .orWhere('subscription_packages.slug', subscription_plan.trim());
      });
    }
    if (typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().slice(0, 80)}%`;
      q.andWhere((builder) => {
        builder.whereILike('agencies.name', term).orWhereILike('agencies.country', term);
      });
    }

    const agencies = await q;
    res.json(agencies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAgencyById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agency = await db('agencies').where({ id }).first();
    if (!agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    const users = await db('users')
      .select(...USER_PUBLIC)
      .where({ agency_id: id })
      .orderBy('created_at', 'desc');

    const [counts] = await db('users').where({ agency_id: id }).select(
      db.raw('COUNT(*)::int as user_count'),
      db.raw(`COUNT(*) FILTER (WHERE role = 'agency_admin')::int as admin_count`)
    );

    const pkg = agency.package_id
      ? await db('subscription_packages').where({ id: agency.package_id }).first()
      : null;

    res.json({
      ...agency,
      package: pkg || null,
      user_count: Number(counts?.user_count || 0),
      admin_count: Number(counts?.admin_count || 0),
      users,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createAgency = async (req: Request, res: Response) => {
  try {
    const {
      name,
      country,
      package_id,
      status,
      admin_email,
      admin_password,
      admin_full_name,
      send_invite,
    } = req.body;

    const email = String(admin_email).toLowerCase().trim();
    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const pkg = package_id
      ? await db('subscription_packages').where({ id: package_id }).first()
      : await getDefaultPackage();
    if (package_id && !pkg) {
      return res.status(400).json({ error: 'Package not found' });
    }

    const result = await db.transaction(async (trx) => {
      const [agency] = await trx('agencies')
        .insert({
          name,
          country: country || null,
          subscription_plan: pkg?.slug || 'free',
          package_id: pkg?.id || null,
          subscription_status: 'active',
          subscription_starts_at: new Date(),
          status: status || 'active',
        })
        .returning('*');

      if (pkg?.id) {
        await assignPackageToAgency({
          agencyId: agency.id,
          packageId: pkg.id,
          subscriptionStatus: 'active',
          actorUserId: req.user?.id || null,
          source: 'admin',
          note: 'Assigned on create',
          trx,
        });
      }

      const [user] = await trx('users')
        .insert({
          email,
          password_hash: await hashPassword(admin_password),
          full_name: admin_full_name,
          role: 'agency_admin',
          agency_id: agency.id,
        })
        .returning(USER_PUBLIC as unknown as string[]);

      return { agency, user };
    });

    if (send_invite) {
      await sendPlatformMail({
        to: email,
        event: 'agency_invited',
        vars: { agency_name: name, email },
      });
    }

    res.status(201).json(result);
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updateAgency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, country, status, logo_url, email, phone } = req.body;

    const existing = await db('agencies').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (country !== undefined) updateData.country = country;
    if (status !== undefined) updateData.status = status;
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (email !== undefined) updateData.email = email || null;
    if (phone !== undefined) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) {
      return res.json(existing);
    }

    const [agency] = await db('agencies').where({ id }).update(updateData).returning('*');
    res.json(agency);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const listAgencyUsers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agency = await db('agencies').where({ id }).first();
    if (!agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    const users = await db('users')
      .select(...USER_PUBLIC)
      .where({ agency_id: id })
      .orderBy('created_at', 'desc');

    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createAgencyUser = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
    const { email, password, full_name, user_role } = req.body;

    const agency = await db('agencies').where({ id }).first();
    if (!agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await db('users').where({ email: normalizedEmail }).first();
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    try {
      await assertLimit(id, 'max_users');
    } catch (err) {
      return sendApiError(res, err);
    }

    const [user] = await db('users')
      .insert({
        email: normalizedEmail,
        password_hash: await hashPassword(password),
        full_name,
        role: user_role || 'agency_admin',
        agency_id: id,
      })
      .returning(USER_PUBLIC as unknown as string[]);

    res.status(201).json(user);
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updateAgencyUser = async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;
    const { email, password, full_name, user_role } = req.body;

    const existing = await db('users').where({ id: userId, agency_id: id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (existing.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify a super admin' });
    }

    if (user_role && existing.role === 'agency_admin' && user_role !== 'agency_admin') {
      const [{ count }] = await db('users')
        .where({ agency_id: id, role: 'agency_admin' })
        .count('id as count');
      if (Number(count) <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last agency admin' });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (user_role !== undefined) updateData.role = user_role;
    if (email !== undefined) updateData.email = String(email).toLowerCase().trim();
    if (password) updateData.password_hash = await hashPassword(password);

    if (Object.keys(updateData).length === 0) {
      const { password_hash: _, ...user } = existing;
      return res.json(user);
    }

    const [user] = await db('users')
      .where({ id: userId, agency_id: id })
      .update(updateData)
      .returning(USER_PUBLIC as unknown as string[]);

    res.json(user);
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const deleteAgencyUser = async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;

    const existing = await db('users').where({ id: userId, agency_id: id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (existing.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete a super admin' });
    }

    if (existing.role === 'agency_admin') {
      const [{ count }] = await db('users')
        .where({ agency_id: id, role: 'agency_admin' })
        .count('id as count');
      if (Number(count) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last agency admin' });
      }
    }

    await db('users').where({ id: userId, agency_id: id }).delete();
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
