import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';
import { hashPassword, verifyPassword } from '../services/auth.service';
import bcrypt from 'bcryptjs';

// Get agency settings
export const getAgency = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    // Platform super admin is not tied to an agency
    if (!agencyId && role === 'super_admin') {
      return res.json({
        id: null,
        name: 'Hujjaj',
        country: null,
        status: 'active',
        subscription_plan: 'platform',
        logo_url: null,
        is_platform: true,
      });
    }

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    const { data, error } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Agency not found' });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update agency settings
export const updateAgency = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const { name, country, status, subscription_plan, logo_url } = req.body;

    if (!agencyId) {
      if (role === 'super_admin') {
        return res.status(400).json({
          error: 'Super admin is not tied to an agency. Agency settings are per-agency.',
        });
      }
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    // Only agency_admin and super_admin can update agency settings
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (country !== undefined) updateData.country = country;
    if (status !== undefined) updateData.status = status;
    if (subscription_plan !== undefined) updateData.subscription_plan = subscription_plan;
    if (logo_url !== undefined) updateData.logo_url = logo_url;

    const { data, error } = await supabase
      .from('agencies')
      .update(updateData)
      .eq('id', agencyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Agency not found' });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get user profile
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(403).json({ error: 'User ID not found' });
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError;
    if (!userProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: userProfile.id,
      email: userProfile.email,
      full_name: userProfile.full_name,
      role: userProfile.role,
      agency_id: userProfile.agency_id,
      branch_id: userProfile.branch_id,
      avatar_url: userProfile.avatar_url,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { full_name, email } = req.body;

    if (!userId) {
      return res.status(403).json({ error: 'User ID not found' });
    }

    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = String(email).toLowerCase().trim();

    const { data: updatedProfile, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    if (!updatedProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: updatedProfile.id,
      email: updatedProfile.email,
      full_name: updatedProfile.full_name,
      role: updatedProfile.role,
      agency_id: updatedProfile.agency_id,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { current_password, new_password } = req.body;

    if (!userId) {
      return res.status(403).json({ error: 'User ID not found' });
    }

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ok = await verifyPassword(current_password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const password_hash = await hashPassword(new_password);
    const { error } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', userId);

    if (error) throw error;
    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get preferences
export const getPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(403).json({ error: 'User ID not found' });
    }

    // Try to get from database first
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Return defaults if not found
    if (!data) {
      return res.json({
        language: 'ar',
        theme: 'light',
        notifications_email: true,
        notifications_sms: false
      });
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update preferences
export const updatePreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { language, theme, notifications_email, notifications_sms } = req.body;

    if (!userId) {
      return res.status(403).json({ error: 'User ID not found' });
    }

    const preferences = {
      user_id: userId,
      language: language || 'ar',
      theme: theme || 'light',
      notifications_email: notifications_email !== undefined ? notifications_email : true,
      notifications_sms: notifications_sms !== undefined ? notifications_sms : false,
      updated_at: new Date().toISOString()
    };

    // Upsert preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(preferences, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// =============================================
// Deletion Password Functions
// =============================================

// Check if user has set a deletion password
export const getDeletionPasswordStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(403).json({ error: 'User ID not found' });
    }

    // Only admins can have deletion password
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can set deletion password' });
    }

    const { data, error } = await supabase
      .from('user_security_settings')
      .select('deletion_password_hash, updated_at')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({
      has_deletion_password: !!(data?.deletion_password_hash),
      updated_at: data?.updated_at || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Set or update deletion password
export const setDeletionPassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { password, current_password } = req.body;

    if (!userId) {
      return res.status(403).json({ error: 'User ID not found' });
    }

    // Only admins can set deletion password
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can set deletion password' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Deletion password must be at least 4 characters' });
    }

    // Check if user already has a deletion password
    const { data: existing } = await supabase
      .from('user_security_settings')
      .select('deletion_password_hash')
      .eq('user_id', userId)
      .single();

    // If user has existing password, verify current password
    if (existing?.deletion_password_hash) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current deletion password is required to change it' });
      }
      
      const isValid = await bcrypt.compare(current_password, existing.deletion_password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Current deletion password is incorrect' });
      }
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Upsert the security settings
    const { data, error } = await supabase
      .from('user_security_settings')
      .upsert({
        user_id: userId,
        deletion_password_hash: passwordHash,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      message: 'Deletion password set successfully',
      updated_at: data.updated_at
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Verify deletion password (used internally and can be called by other controllers)
export const verifyDeletionPassword = async (userId: string, password: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_security_settings')
      .select('deletion_password_hash')
      .eq('user_id', userId)
      .single();

    if (error || !data?.deletion_password_hash) {
      return false;
    }

    return await bcrypt.compare(password, data.deletion_password_hash);
  } catch {
    return false;
  }
};
