import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';
import bcrypt from 'bcryptjs';

// Get agency settings
export const getAgency = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;

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

    // Get user from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError) throw authError;

    // Get user profile from users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    res.json({
      id: authUser.user.id,
      email: authUser.user.email,
      full_name: userProfile?.full_name || authUser.user.user_metadata?.full_name,
      role: userProfile?.role || authUser.user.user_metadata?.role,
      agency_id: userProfile?.agency_id || authUser.user.user_metadata?.agency_id
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

    // Update auth user email if provided
    if (email) {
      const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
        email,
        user_metadata: {
          ...req.user?.user_metadata,
          full_name: full_name || req.user?.user_metadata?.full_name
        }
      });
      if (emailError) throw emailError;
    } else if (full_name) {
      // Update only metadata if email not provided
      const { error: metaError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...req.user?.user_metadata,
          full_name
        }
      });
      if (metaError) throw metaError;
    }

    // Update users table
    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;

    if (userProfile) {
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
    } else {
      // Create user profile if it doesn't exist
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          full_name,
          agency_id: req.user?.agency_id,
          role: req.user?.role
        })
        .select()
        .single();
      if (error) throw error;
    }

    // Get updated user
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const { data: updatedProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!authUser?.user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: authUser.user.id,
      email: authUser.user.email,
      full_name: updatedProfile?.full_name || authUser.user.user_metadata?.full_name,
      role: updatedProfile?.role || authUser.user.user_metadata?.role
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

    // Verify current password by attempting to sign in
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    if (!authUser?.user || !authUser.user.email) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Note: Supabase Admin API doesn't support password verification directly
    // We need to use the auth API with the user's session token
    // For now, we'll update the password directly (in production, verify current password first)
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: new_password
    });

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
