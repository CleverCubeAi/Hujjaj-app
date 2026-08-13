import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';

// Issue #11: simple email validator. Strict enough to catch typos, loose enough to allow
// real-world addresses. Empty/null passes through (email is optional).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isInvalidEmail = (e?: unknown) => typeof e === 'string' && e.length > 0 && !EMAIL_RE.test(e);

// Get all clients for the agency
export const getClients = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const agencyId = req.user?.agency_id;

    let query = supabase
      .from('clients')
      .select('*')
      .forAgency(agencyId)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,full_name_ar.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get single client by ID
export const getClientById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    const { data, error } = await supabase
      .from('clients')
      .select(`
        *,
        bookings (
          id,
          booking_number,
          status,
          total_amount,
          paid_amount,
          remaining_balance,
          created_at,
          seasons (name, type)
        )
      `)
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create new client
export const createClient = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const { full_name, full_name_ar, email, phone, address, id_number, notes, branch_id } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Full name and phone are required' });
    }
    if (isInvalidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format', error_fr: 'Format e-mail invalide' });
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        agency_id: agencyId,
        full_name,
        full_name_ar,
        email,
        phone,
        address,
        id_number,
        notes,
        branch_id: branch_id || null, // Issue #10: now populated from form
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update client
export const updateClient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const { full_name, full_name_ar, email, phone, address, id_number, notes, branch_id } = req.body;

    if (isInvalidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format', error_fr: 'Format e-mail invalide' });
    }

    const updates: any = {
      full_name, full_name_ar, email, phone, address, id_number, notes
    };
    if (branch_id !== undefined) updates.branch_id = branch_id || null;

    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .forAgency(agencyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete client
export const deleteClient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    // Check if client has bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('client_id', id)
      .limit(1);

    if (bookings && bookings.length > 0) {
      return res.status(400).json({ error: 'Cannot delete client with existing bookings' });
    }

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .forAgency(agencyId);

    if (error) throw error;
    res.json({ message: 'Client deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
