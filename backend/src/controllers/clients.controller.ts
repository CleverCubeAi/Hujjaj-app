import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';

// Get all clients for the agency
export const getClients = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const agencyId = req.user?.agency_id;

    let query = supabase
      .from('clients')
      .select('*')
      .eq('agency_id', agencyId)
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
      .eq('agency_id', agencyId)
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
    const { full_name, full_name_ar, email, phone, address, id_number, notes } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Full name and phone are required' });
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
        notes
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
    const { full_name, full_name_ar, email, phone, address, id_number, notes } = req.body;

    const { data, error } = await supabase
      .from('clients')
      .update({
        full_name,
        full_name_ar,
        email,
        phone,
        address,
        id_number,
        notes
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
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
      .eq('agency_id', agencyId);

    if (error) throw error;
    res.json({ message: 'Client deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
