import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';

// Get all branches for the agency
export const getBranches = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const { search, active_only } = req.query;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    let query = supabase
      .from('branches')
      .select('*')
      .eq('agency_id', agencyId)
      .order('is_headquarters', { ascending: false })
      .order('name', { ascending: true });

    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,contact_person.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get single branch by ID
export const getBranchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get branch statistics
export const getBranchStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    // Verify branch belongs to agency
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (branchError || !branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Get user count
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', id);

    // Get booking count (if bookings table has branch_id)
    const { count: bookingCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', id);

    // Get client count (if clients table has branch_id)
    const { count: clientCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', id);

    res.json({
      total_users: userCount || 0,
      total_bookings: bookingCount || 0,
      total_clients: clientCount || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create new branch
export const createBranch = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    // Only agency_admin and super_admin can create branches
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized - Only admins can create branches' });
    }

    const {
      name,
      city,
      address,
      phone,
      email,
      contact_person,
      logo_url,
      bank_name,
      bank_account,
      bank_iban,
      is_headquarters,
      settings
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    const { data, error } = await supabase
      .from('branches')
      .insert({
        agency_id: agencyId,
        name,
        city,
        address,
        phone,
        email,
        contact_person,
        logo_url,
        bank_name,
        bank_account,
        bank_iban,
        is_headquarters: is_headquarters || false,
        settings: settings || {}
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update branch
export const updateBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    // Only agency_admin and super_admin can update branches
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized - Only admins can update branches' });
    }

    const {
      name,
      city,
      address,
      phone,
      email,
      contact_person,
      logo_url,
      bank_name,
      bank_account,
      bank_iban,
      is_headquarters,
      is_active,
      settings
    } = req.body;

    // Build update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (city !== undefined) updateData.city = city;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (contact_person !== undefined) updateData.contact_person = contact_person;
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (bank_name !== undefined) updateData.bank_name = bank_name;
    if (bank_account !== undefined) updateData.bank_account = bank_account;
    if (bank_iban !== undefined) updateData.bank_iban = bank_iban;
    if (is_headquarters !== undefined) updateData.is_headquarters = is_headquarters;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (settings !== undefined) updateData.settings = settings;

    const { data, error } = await supabase
      .from('branches')
      .update(updateData)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete (deactivate) branch
export const deleteBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    // Only agency_admin and super_admin can delete branches
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized - Only admins can delete branches' });
    }

    // Check if branch exists and belongs to agency
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('*, users:users(count)')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (branchError || !branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Prevent deleting headquarters
    if (branch.is_headquarters) {
      return res.status(400).json({ error: 'Cannot delete the headquarters branch. Set another branch as headquarters first.' });
    }

    // Check if branch has users
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', id);

    if (userCount && userCount > 0) {
      // Soft delete - deactivate the branch instead
      const { data, error } = await supabase
        .from('branches')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ 
        message: 'Branch deactivated (has assigned users)', 
        branch: data,
        deactivated: true
      });
    }

    // Hard delete if no users
    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) throw error;
    res.json({ message: 'Branch deleted successfully', deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get users in a branch
export const getBranchUsers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    // Verify branch belongs to agency
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (branchError || !branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('branch_id', id)
      .order('full_name', { ascending: true });

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
