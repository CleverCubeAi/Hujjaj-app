import { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase';

// ============================================
// Discount Settings CRUD
// ============================================

/**
 * List all discount settings for agency
 */
export const listDiscountSettings = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { active_only } = req.query;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  try {
    let query = supabaseAdmin
      .from('discount_settings')
      .select('*, created_by_user:users!discount_settings_created_by_fkey(full_name)')
      .forAgency(agencyId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error listing discount settings:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get a single discount setting
 */
export const getDiscountSetting = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('discount_settings')
      .select('*')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Discount setting not found' });

    res.json(data);
  } catch (error: any) {
    console.error('Error getting discount setting:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create a new discount setting
 */
export const createDiscountSetting = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (role !== 'agency_admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Only admins can create discount settings' });
  }

  const { 
    name, 
    name_ar, 
    discount_type, 
    discount_value, 
    max_discount_amount,
    min_booking_amount,
    is_default,
    is_active,
    sort_order 
  } = req.body;

  if (!name || !discount_type || !discount_value) {
    return res.status(400).json({ error: 'Name, discount_type, and discount_value are required' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('discount_settings')
      .insert({
        agency_id: agencyId,
        name,
        name_ar,
        discount_type,
        discount_value,
        max_discount_amount,
        min_booking_amount,
        is_default: is_default || false,
        is_active: is_active !== false,
        sort_order: sort_order || 0,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    console.error('Error creating discount setting:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update a discount setting
 */
export const updateDiscountSetting = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const role = req.user?.role;
  const { id } = req.params;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (role !== 'agency_admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Only admins can update discount settings' });
  }

  const updates = req.body;
  delete updates.id;
  delete updates.agency_id;
  delete updates.created_by;
  delete updates.created_at;
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabaseAdmin
      .from('discount_settings')
      .update(updates)
      .eq('id', id)
      .forAgency(agencyId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error updating discount setting:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete a discount setting
 */
export const deleteDiscountSetting = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const role = req.user?.role;
  const { id } = req.params;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (role !== 'agency_admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Only admins can delete discount settings' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('discount_settings')
      .delete()
      .eq('id', id)
      .forAgency(agencyId);

    if (error) throw error;
    res.json({ message: 'Discount setting deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting discount setting:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// Available Discounts for Current User
// ============================================

/**
 * Get discounts available to current user (for booking wizard)
 */
export const getAvailableDiscounts = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const userId = req.user?.id;

  if (!agencyId || !userId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  try {
    // First, trigger usage count reset
    await supabaseAdmin.rpc('reset_discount_usage_counts');

    // Get default discounts
    const { data: defaultDiscounts, error: defaultError } = await supabaseAdmin
      .from('discount_settings')
      .select('*')
      .forAgency(agencyId)
      .eq('is_active', true)
      .eq('is_default', true)
      .order('sort_order', { ascending: true });

    if (defaultError) throw defaultError;

    // Get user-specific discounts with permissions
    const { data: userPermissions, error: permError } = await supabaseAdmin
      .from('user_discount_permissions')
      .select(`
        *,
        discount_setting:discount_settings(*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (permError) throw permError;

    // Combine and format results
    const discounts: any[] = [];

    // Add default discounts (unlimited usage)
    for (const d of defaultDiscounts || []) {
      discounts.push({
        id: d.id,
        name: d.name,
        name_ar: d.name_ar,
        discount_type: d.discount_type,
        discount_value: d.discount_value,
        max_discount_amount: d.max_discount_amount,
        min_booking_amount: d.min_booking_amount,
        is_default: true,
        usage_limit: null,
        usage_count: 0,
        remaining: null, // Unlimited
        can_use: true
      });
    }

    // Add user-specific discounts
    for (const perm of userPermissions || []) {
      const d = perm.discount_setting;
      if (!d || !d.is_active || d.is_default) continue; // Skip if already in defaults

      const remaining = perm.usage_limit ? perm.usage_limit - perm.usage_count : null;
      const canUse = perm.usage_limit === null || perm.usage_count < perm.usage_limit;

      discounts.push({
        id: d.id,
        name: d.name,
        name_ar: d.name_ar,
        discount_type: d.discount_type,
        discount_value: d.discount_value,
        max_discount_amount: d.max_discount_amount,
        min_booking_amount: d.min_booking_amount,
        is_default: false,
        usage_limit: perm.usage_limit,
        usage_count: perm.usage_count,
        remaining: remaining,
        reset_period: perm.reset_period,
        can_use: canUse
      });
    }

    // Sort by sort_order
    discounts.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    res.json(discounts);
  } catch (error: any) {
    console.error('Error getting available discounts:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Calculate discount amount for a booking
 */
export const calculateDiscount = async (req: Request, res: Response) => {
  const { discount_id, booking_total } = req.body;

  if (!discount_id || booking_total === undefined) {
    return res.status(400).json({ error: 'discount_id and booking_total are required' });
  }

  try {
    const { data: discount, error } = await supabaseAdmin
      .from('discount_settings')
      .select('*')
      .eq('id', discount_id)
      .single();

    if (error) throw error;
    if (!discount) return res.status(404).json({ error: 'Discount not found' });

    // Check minimum booking amount
    if (discount.min_booking_amount && booking_total < discount.min_booking_amount) {
      return res.json({
        discount_amount: 0,
        error: `Minimum booking amount is ${discount.min_booking_amount} MAD`
      });
    }

    let discountAmount = 0;
    if (discount.discount_type === 'fixed') {
      discountAmount = discount.discount_value;
    } else {
      discountAmount = booking_total * (discount.discount_value / 100);
      if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
        discountAmount = discount.max_discount_amount;
      }
    }

    // Don't exceed booking total
    if (discountAmount > booking_total) {
      discountAmount = booking_total;
    }

    res.json({
      discount_amount: Math.round(discountAmount * 100) / 100,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value
    });
  } catch (error: any) {
    console.error('Error calculating discount:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// User Discount Permissions
// ============================================

/**
 * List all user discount permissions (admin)
 */
export const listUserPermissions = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const role = req.user?.role;
  const { user_id, discount_id } = req.query;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can view all permissions' });
    }

    try {
      // Use a direct SQL query to bypass any RLS issues
      const { data, error } = await supabaseAdmin.rpc('get_user_discount_permissions', {
        p_agency_id: agencyId,
        p_user_id: user_id || null,
        p_discount_id: discount_id || null
      });

      if (error) {
        console.error('RPC call failed, using fallback method:', error);
        
        // Get discount IDs for this agency
        const { data: agencyDiscounts } = await supabaseAdmin
          .from('discount_settings')
          .select('id')
          .forAgency(agencyId);

        const discountIds = (agencyDiscounts || []).map(d => d.id);
        
        if (discountIds.length === 0) {
          return res.json([]);
        }

        // Query permissions with a SQL-based join approach using raw SQL
        const query = `
          SELECT 
            udp.*,
            row_to_json(u.*) as user,
            row_to_json(ds.*) as discount_setting
          FROM user_discount_permissions udp
          LEFT JOIN users u ON u.id = udp.user_id
          LEFT JOIN discount_settings ds ON ds.id = udp.discount_setting_id
          WHERE udp.discount_setting_id = ANY($1::uuid[])
          ${user_id ? 'AND udp.user_id = $2::uuid' : ''}
          ORDER BY udp.granted_at DESC
        `;

        const params = user_id ? [discountIds, user_id] : [discountIds];
        
        const { data: rawData, error: rawError } = await supabaseAdmin.rpc('exec_sql', {
          query,
          params
        });

        if (rawError) {
          // Last fallback - simple query
          const { data: permissions } = await supabaseAdmin
            .from('user_discount_permissions')
            .select('*')
            .in('discount_setting_id', discountIds)
            .order('granted_at', { ascending: false });

          // Manually fetch related data
          const enriched = await Promise.all((permissions || []).map(async (perm) => {
            const [userResult, discountResult] = await Promise.all([
              supabaseAdmin.from('users').select('id, full_name, email').eq('id', perm.user_id).maybeSingle(),
              supabaseAdmin.from('discount_settings').select('id, name, name_ar, discount_type, discount_value').eq('id', perm.discount_setting_id).maybeSingle()
            ]);

            return {
              ...perm,
              user: userResult.data || { id: perm.user_id, full_name: 'Unknown User', email: '' },
              discount_setting: discountResult.data || { id: perm.discount_setting_id, name: 'Unknown Discount' }
            };
          }));

          return res.json(enriched);
        }

        return res.json(rawData);
      }

      // Rename user_data to user for frontend compatibility
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        user: item.user_data,
        user_data: undefined
      }));

      res.json(formattedData);
    } catch (error: any) {
      console.error('Error listing user permissions:', error);
      res.status(500).json({ error: error.message });
    }
};

/**
 * Get permissions for a specific user
 */
export const getUserPermissions = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const role = req.user?.role;
  const { user_id } = req.params;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  // Allow users to view their own permissions, or admins to view any
  if (req.user?.id !== user_id && role !== 'agency_admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_discount_permissions')
      .select(`
        *,
        discount_setting:discount_settings(*)
      `)
      .eq('user_id', user_id);

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Assign discount to user (create permission)
 */
export const createUserPermission = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const grantedBy = req.user?.id;
  const role = req.user?.role;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (role !== 'agency_admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Only admins can assign discounts' });
  }

  const { user_id, discount_setting_id, usage_limit, reset_period } = req.body;

  if (!user_id || !discount_setting_id) {
    return res.status(400).json({ error: 'user_id and discount_setting_id are required' });
  }

  try {
    // Verify discount belongs to this agency
    const { data: discount } = await supabaseAdmin
      .from('discount_settings')
      .select('id')
      .eq('id', discount_setting_id)
      .forAgency(agencyId)
      .single();

    if (!discount) {
      return res.status(404).json({ error: 'Discount not found in this agency' });
    }

    const { data, error } = await supabaseAdmin
      .from('user_discount_permissions')
      .insert({
        user_id,
        discount_setting_id,
        usage_limit: usage_limit || null,
        reset_period: reset_period || 'monthly',
        granted_by: grantedBy
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'User already has this discount permission' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (error: any) {
    console.error('Error creating user permission:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update user permission
 */
export const updateUserPermission = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const role = req.user?.role;
  const { id } = req.params;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (role !== 'agency_admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Only admins can update permissions' });
  }

  const { usage_limit, reset_period, is_active, usage_count } = req.body;

  try {
    const updates: any = { updated_at: new Date().toISOString() };
    if (usage_limit !== undefined) updates.usage_limit = usage_limit;
    if (reset_period !== undefined) updates.reset_period = reset_period;
    if (is_active !== undefined) updates.is_active = is_active;
    if (usage_count !== undefined) updates.usage_count = usage_count; // Allow reset

    const { data, error } = await supabaseAdmin
      .from('user_discount_permissions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error updating user permission:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete user permission
 */
export const deleteUserPermission = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const role = req.user?.role;
  const { id } = req.params;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (role !== 'agency_admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Only admins can delete permissions' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('user_discount_permissions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Permission deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user permission:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Bulk update user permissions (for team management)
 */
export const bulkUpdateUserPermissions = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const grantedBy = req.user?.id;
  const role = req.user?.role;
  const { user_id } = req.params;
  const { permissions } = req.body; // Array of { discount_setting_id, usage_limit, reset_period, is_active }

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (role !== 'agency_admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Only admins can manage permissions' });
  }

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'permissions must be an array' });
  }

  try {
    // Get existing permissions for this user
    const { data: existing } = await supabaseAdmin
      .from('user_discount_permissions')
      .select('id, discount_setting_id')
      .eq('user_id', user_id);

    const existingMap = new Map((existing || []).map(e => [e.discount_setting_id, e.id]));
    const newDiscountIds = new Set(permissions.map(p => p.discount_setting_id));

    // Delete permissions not in the new list
    const toDelete = (existing || []).filter(e => !newDiscountIds.has(e.discount_setting_id));
    for (const perm of toDelete) {
      await supabaseAdmin
        .from('user_discount_permissions')
        .delete()
        .eq('id', perm.id);
    }

    // Upsert new/updated permissions
    for (const perm of permissions) {
      const existingId = existingMap.get(perm.discount_setting_id);
      
      if (existingId) {
        // Update existing
        await supabaseAdmin
          .from('user_discount_permissions')
          .update({
            usage_limit: perm.usage_limit || null,
            reset_period: perm.reset_period || 'monthly',
            is_active: perm.is_active !== false,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingId);
      } else {
        // Create new
        await supabaseAdmin
          .from('user_discount_permissions')
          .insert({
            user_id,
            discount_setting_id: perm.discount_setting_id,
            usage_limit: perm.usage_limit || null,
            reset_period: perm.reset_period || 'monthly',
            is_active: perm.is_active !== false,
            granted_by: grantedBy
          });
      }
    }

    // Get updated permissions
    const { data: updated, error } = await supabaseAdmin
      .from('user_discount_permissions')
      .select(`*, discount_setting:discount_settings(*)`)
      .eq('user_id', user_id);

    if (error) throw error;
    res.json(updated);
  } catch (error: any) {
    console.error('Error bulk updating permissions:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// Discount Usage Log
// ============================================

/**
 * Log discount usage (called when booking is created)
 */
export const logDiscountUsage = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const userId = req.user?.id;

  if (!agencyId || !userId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  const { 
    booking_id, 
    discount_setting_id, 
    discount_amount, 
    booking_total_before 
  } = req.body;

  if (!discount_setting_id || discount_amount === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get discount details
    const { data: discount } = await supabaseAdmin
      .from('discount_settings')
      .select('*')
      .eq('id', discount_setting_id)
      .forAgency(agencyId)
      .single();

    if (!discount) {
      return res.status(404).json({ error: 'Discount not found' });
    }

    // Log the usage
    const { data: log, error: logError } = await supabaseAdmin
      .from('discount_usage_log')
      .insert({
        agency_id: agencyId,
        booking_id,
        user_id: userId,
        discount_setting_id,
        discount_name: discount.name,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        discount_amount,
        booking_total_before,
        booking_total_after: booking_total_before - discount_amount
      })
      .select()
      .single();

    if (logError) throw logError;

    // Increment usage count for non-default discounts
    if (!discount.is_default) {
      // Use the database function to increment usage
      try {
        await supabaseAdmin.rpc('increment_discount_usage', {
          p_user_id: userId,
          p_discount_setting_id: discount_setting_id
        });
      } catch (incrementError) {
        console.error('Error incrementing discount usage:', incrementError);
        // Continue even if increment fails - the log was already created
      }
    }

    res.json(log);
  } catch (error: any) {
    console.error('Error logging discount usage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get discount usage log (admin)
 */
export const getUsageLog = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const role = req.user?.role;
  const { user_id, discount_id, date_from, date_to, limit } = req.query;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (role !== 'agency_admin' && role !== 'super_admin' && role !== 'manager') {
    return res.status(403).json({ error: 'Not authorized to view usage log' });
  }

  try {
    // Use database function to bypass RLS
    const { data, error } = await supabaseAdmin.rpc('get_discount_usage_log', {
      p_agency_id: agencyId,
      p_user_id: user_id || null,
      p_discount_id: discount_id || null,
      p_date_from: date_from || null,
      p_date_to: date_to || null,
      p_limit: limit ? parseInt(limit as string) : 100
    });

    if (error) {
      console.error('RPC call failed for usage log:', error);
      throw error;
    }

    // Rename user_data to user for frontend compatibility
    const formattedData = (data || []).map((item: any) => ({
      ...item,
      user: item.user_data,
      user_data: undefined
    }));

    res.json(formattedData);
  } catch (error: any) {
    console.error('Error getting usage log:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get usage statistics (admin dashboard)
 */
export const getUsageStats = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const role = req.user?.role;
  const { date_from, date_to } = req.query;

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (role !== 'agency_admin' && role !== 'super_admin' && role !== 'manager') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  try {
    let query = supabaseAdmin
      .from('discount_usage_log')
      .select('discount_amount, discount_setting_id, user_id')
      .forAgency(agencyId);

    if (date_from) {
      query = query.gte('created_at', date_from);
    }

    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate stats
    const totalDiscountAmount = (data || []).reduce((sum, log) => sum + (log.discount_amount || 0), 0);
    const totalUsageCount = (data || []).length;
    const uniqueUsers = new Set((data || []).map(log => log.user_id)).size;
    const discountBreakdown: Record<string, { count: number; amount: number }> = {};

    for (const log of data || []) {
      if (!discountBreakdown[log.discount_setting_id]) {
        discountBreakdown[log.discount_setting_id] = { count: 0, amount: 0 };
      }
      discountBreakdown[log.discount_setting_id].count++;
      discountBreakdown[log.discount_setting_id].amount += log.discount_amount || 0;
    }

    res.json({
      total_discount_amount: totalDiscountAmount,
      total_usage_count: totalUsageCount,
      unique_users: uniqueUsers,
      discount_breakdown: discountBreakdown
    });
  } catch (error: any) {
    console.error('Error getting usage stats:', error);
    res.status(500).json({ error: error.message });
  }
};
