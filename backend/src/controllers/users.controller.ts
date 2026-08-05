import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';
import { hashPassword } from '../services/auth.service';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const userBranchId = req.user?.branch_id;
    const { search, branch_id } = req.query;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    if (role !== 'agency_admin' && role !== 'super_admin' && role !== 'manager' && role !== 'agent') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let query = supabase
      .from('users')
      .select(`
        *,
        branch:branches (
          id,
          name,
          city,
          is_headquarters
        )
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (branch_id) {
      if (branch_id === 'none') {
        query = query.is('branch_id', null);
      } else {
        query = query.eq('branch_id', branch_id);
      }
    }

    if (role !== 'agency_admin' && role !== 'super_admin' && userBranchId) {
      query = query.eq('branch_id', userBranchId);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,role.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Never expose password hashes
    const users = (data || []).map(({ password_hash, ...rest }: any) => rest);
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        branch:branches (
          id,
          name,
          city,
          is_headquarters
        )
      `)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, ...user } = data as any;
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const { email, password, full_name, user_role, branch_id, avatar_url } = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!email || !password || !full_name || !user_role) {
      return res.status(400).json({ error: 'Email, password, full name, and role are required' });
    }

    const validRoles = ['agency_admin', 'manager', 'agent'];
    if (!validRoles.includes(user_role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (branch_id) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', branch_id)
        .eq('agency_id', agencyId)
        .single();

      if (branchError || !branch) {
        return res.status(400).json({ error: 'Invalid branch' });
      }
    }

    const password_hash = await hashPassword(password);

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .insert({
        email: String(email).toLowerCase().trim(),
        password_hash,
        agency_id: agencyId,
        full_name,
        role: user_role,
        branch_id: branch_id || null,
        avatar_url: avatar_url || null,
      })
      .select(`
        *,
        branch:branches (
          id,
          name,
          city,
          is_headquarters
        )
      `)
      .single();

    if (profileError) throw profileError;

    const { password_hash: _, ...user } = userProfile as any;
    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const { full_name, user_role, email, branch_id, avatar_url } = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (id === req.user?.id && user_role && user_role !== role) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user_role && existingUser.role === 'agency_admin' && user_role !== 'agency_admin') {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('role', 'agency_admin');

      if (admins && admins.length === 1) {
        return res.status(400).json({ error: 'Cannot demote the last agency admin' });
      }
    }

    if (branch_id !== undefined && branch_id !== null) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', branch_id)
        .eq('agency_id', agencyId)
        .single();

      if (branchError || !branch) {
        return res.status(400).json({ error: 'Invalid branch' });
      }
    }

    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (branch_id !== undefined) updateData.branch_id = branch_id;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (email !== undefined) updateData.email = String(email).toLowerCase().trim();
    if (user_role !== undefined) {
      const validRoles = ['agency_admin', 'manager', 'agent'];
      if (!validRoles.includes(user_role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updateData.role = user_role;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        branch:branches (
          id,
          name,
          city,
          is_headquarters
        )
      `)
      .single();

    if (error) throw error;

    const { password_hash, ...user } = data as any;
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existingUser.role === 'agency_admin') {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('role', 'agency_admin');

      if (admins && admins.length === 1) {
        return res.status(400).json({ error: 'Cannot delete the last agency admin' });
      }
    }

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;

    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const { role: newRole } = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const validRoles = ['agency_admin', 'manager', 'agent'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existingUser.role === 'agency_admin' && newRole !== 'agency_admin') {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('role', 'agency_admin');

      if (admins && admins.length === 1) {
        return res.status(400).json({ error: 'Cannot demote the last agency admin' });
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const { password_hash, ...user } = data as any;
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
