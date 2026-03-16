import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';

// Get all users in the agency
export const getUsers = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const userBranchId = req.user?.branch_id;
    const { search, branch_id } = req.query;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    // Only agency_admin and super_admin can view all users
    // manager and agent can only view (read-only)
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

    // Filter by branch_id if provided
    if (branch_id) {
      if (branch_id === 'none') {
        query = query.is('branch_id', null);
      } else {
        query = query.eq('branch_id', branch_id);
      }
    }

    // Non-admin users can only see users in their own branch (if they have a branch)
    if (role !== 'agency_admin' && role !== 'super_admin' && userBranchId) {
      query = query.eq('branch_id', userBranchId);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,role.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get email from auth.users for each user
    const usersWithEmail = await Promise.all(
      (data || []).map(async (user) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
        return {
          ...user,
          email: authUser?.user?.email || null
        };
      })
    );

    res.json(usersWithEmail);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get single user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Only agency_admin and super_admin can view user details
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

    // Get email from auth.users
    const { data: authUser } = await supabase.auth.admin.getUserById(id);

    res.json({
      ...data,
      email: authUser?.user?.email || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create new user
export const createUser = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const { email, password, full_name, user_role, branch_id, avatar_url } = req.body;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    // Only agency_admin and super_admin can create users
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!email || !password || !full_name || !user_role) {
      return res.status(400).json({ error: 'Email, password, full name, and role are required' });
    }

    // Validate role
    const validRoles = ['agency_admin', 'manager', 'agent'];
    if (!validRoles.includes(user_role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Validate branch_id if provided
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

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        agency_id: agencyId,
        role: user_role,
        full_name,
        branch_id: branch_id || null
      }
    });

    if (authError) throw authError;

    // Create user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        agency_id: agencyId,
        full_name,
        role: user_role,
        branch_id: branch_id || null,
        avatar_url: avatar_url || null
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

    if (profileError) {
      // Rollback: delete auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    res.status(201).json({
      ...userProfile,
      email: authUser.user.email
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const { full_name, user_role, email, branch_id, avatar_url } = req.body;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Only agency_admin and super_admin can update users
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Prevent updating own account role
    if (id === req.user?.id && user_role && user_role !== role) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Check if user exists and belongs to agency
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent demoting last agency_admin
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

    // Validate branch_id if provided
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

    // Update auth user if email provided
    if (email) {
      const { error: emailError } = await supabase.auth.admin.updateUserById(id, {
        email,
        user_metadata: {
          ...existingUser,
          full_name: full_name || existingUser.full_name,
          branch_id: branch_id !== undefined ? branch_id : existingUser.branch_id
        }
      });
      if (emailError) throw emailError;
    }

    // Update user profile
    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (branch_id !== undefined) updateData.branch_id = branch_id;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (user_role !== undefined) {
      // Validate role
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

    // Get updated email
    const { data: authUser } = await supabase.auth.admin.getUserById(id);

    // Also update auth user metadata with branch_id
    if (branch_id !== undefined) {
      await supabase.auth.admin.updateUserById(id, {
        user_metadata: {
          ...existingUser,
          ...updateData,
          branch_id: branch_id
        }
      });
    }

    res.json({
      ...data,
      email: authUser?.user?.email || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Only agency_admin and super_admin can delete users
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Prevent deleting own account
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists and belongs to agency
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting last agency_admin
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

    // Delete auth user (this will cascade delete user profile due to ON DELETE CASCADE)
    const { error } = await supabase.auth.admin.deleteUser(id);

    if (error) throw error;
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update user role
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const { role: newRole } = req.body;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Only agency_admin and super_admin can update roles
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Prevent updating own role
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Validate role
    const validRoles = ['agency_admin', 'manager', 'agent'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user exists and belongs to agency
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent demoting last agency_admin
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

    // Update role
    const { data, error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update auth user metadata
    await supabase.auth.admin.updateUserById(id, {
      user_metadata: {
        ...existingUser,
        role: newRole
      }
    });

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
