import { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (error) return res.status(401).json({ error: error.message });
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, agencyName, fullName, country } = req.body;
  
  try {
    // 1. Create Agency
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from('agencies')
      .insert({ name: agencyName, country })
      .select()
      .single();

    if (agencyError) return res.status(400).json({ error: agencyError.message });

    // 2. Create Auth User
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        agency_id: agency.id,
        role: 'agency_admin',
        full_name: fullName
      }
    });

    if (authError) {
      // Rollback agency (simple manual rollback)
      await supabaseAdmin.from('agencies').delete().eq('id', agency.id);
      return res.status(400).json({ error: authError.message });
    }

    // 3. Create Public User Profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        agency_id: agency.id,
        full_name: fullName,
        role: 'agency_admin'
      });
      
    if (profileError) {
      // Ideally rollback auth user too
      return res.status(400).json({ error: profileError.message });
    }

    res.json({ message: 'Agency registered successfully', agency, user: authUser.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
