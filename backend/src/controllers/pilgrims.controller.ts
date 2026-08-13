import { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase';
import { pickAllowed } from '../utils/httpError';

const PILGRIM_FIELDS = [
  'full_name', 'full_name_ar', 'passport_number', 'phone', 'gender', 'date_of_birth',
  'relationship_type', 'is_mahram', 'photo_url', 'passport_scan_url', 'season_id',
  'flight_id', 'accommodation_id', 'room_type_id', 'package_id', 'booking_id',
  'client_id', 'mahram_group_id', 'spouse_id', 'parent_id', 'flight_seat_inventory_id',
  'hotel_inventory_ids', 'agreed_price', 'advance_payment', 'visa_included',
  'transport_included', 'status', 'notes',
] as const;

export const listPilgrims = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { season_id, flight_id, booking_id, client_id } = req.query;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  let query = supabaseAdmin.from('pilgrims').select(`
    *,
    flights (code, departure_date),
    accommodations (name, name_ar),
    room_types (type),
    seasons (name, type),
    clients (id, full_name, full_name_ar, phone),
    bookings (id, booking_number)
  `).forAgency(agencyId)
    .order('created_at', { ascending: false });
  
  if (season_id) query = query.eq('season_id', season_id);
  if (flight_id) query = query.eq('flight_id', flight_id);
  if (booking_id) query = query.eq('booking_id', booking_id);
  if (client_id) query = query.eq('client_id', client_id);
  
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const getPilgrim = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const { data, error } = await supabaseAdmin
    .from('pilgrims')
    .select(`
      *,
      flights (code, departure_date, departure_city, arrival_city),
      accommodations (name, name_ar, city),
      room_types (type, price_per_bed),
      seasons (name, type),
      clients (id, full_name, full_name_ar, phone, email),
      bookings (id, booking_number, status)
    `)
    .eq('id', id)
    .forAgency(agencyId)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Pilgrim not found' });
  res.json(data);
};

export const createPilgrim = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const body = req.body;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const passportNumber = (body.passport_number || '').toString().trim();
  if (!passportNumber) {
    return res.status(400).json({ error: 'رقم الجواز إلزامي', error_en: 'Passport number is required' });
  }

  const { data, error } = await supabaseAdmin
    .from('pilgrims')
    .insert({
      ...pickAllowed(body, PILGRIM_FIELDS),
      passport_number: passportNumber,
      agency_id: agencyId
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const updatePilgrim = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const updates = req.body;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (updates.passport_number !== undefined) {
    const passportNumber = (updates.passport_number || '').toString().trim();
    if (!passportNumber) {
      return res.status(400).json({ error: 'رقم الجواز إلزامي', error_en: 'Passport number is required' });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('pilgrims')
    .update(pickAllowed(updates, PILGRIM_FIELDS))
    .eq('id', id)
    .forAgency(agencyId) // Ensure user can only update their agency's pilgrims
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const deletePilgrim = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  // Check if pilgrim has room assignments
  const { data: assignments } = await supabaseAdmin
    .from('room_assignments')
    .select('id')
    .eq('pilgrim_id', id)
    .limit(1);

  if (assignments && assignments.length > 0) {
    return res.status(400).json({ error: 'Cannot delete pilgrim with room assignments. Remove assignments first.' });
  }

  const { error } = await supabaseAdmin
    .from('pilgrims')
    .delete()
    .eq('id', id)
    .forAgency(agencyId);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Pilgrim deleted successfully' });
};

export const importPilgrims = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { pilgrims } = req.body; // Array of pilgrim objects
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  if (!Array.isArray(pilgrims)) {
    return res.status(400).json({ error: 'Expected array of pilgrims' });
  }

  const missingPassport = pilgrims.find((p: any) => !(p.passport_number || '').toString().trim());
  if (missingPassport) {
    return res.status(400).json({ error: 'رقم الجواز إلزامي لكل معتمر', error_en: 'Passport number is required for each pilgrim' });
  }
  
  // Add agency_id to all
  const toInsert = pilgrims.map((p: any) => ({
    ...pickAllowed(p, PILGRIM_FIELDS),
    passport_number: (p.passport_number || '').toString().trim(),
    agency_id: agencyId
  }));
  
  const { data, error } = await supabaseAdmin
    .from('pilgrims')
    .insert(toInsert)
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: `Imported ${data.length} pilgrims`, data });
};
