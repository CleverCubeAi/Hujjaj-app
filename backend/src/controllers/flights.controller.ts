import { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase';

export const listFlights = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { season_id } = req.query;
  
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  let query = supabaseAdmin.from('flights').select(`
    *,
    seasons (id, name, type),
    flight_transits (id, stop_order, city, airport_code, arrival_time, departure_time, layover_minutes, carrier, flight_number, notes)
  `).eq('agency_id', agencyId).order('departure_date', { ascending: true });
  
  if (season_id) query = query.eq('season_id', season_id);
  
  const { data, error } = await query;
  
  if (error) return res.status(400).json({ error: error.message });
  
  // Sort transits by stop_order
  if (data) {
    data.forEach((flight: any) => {
      if (flight.flight_transits) {
        flight.flight_transits.sort((a: any, b: any) => a.stop_order - b.stop_order);
      }
    });
  }
  
  res.json(data);
};

export const getFlight = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const { data, error } = await supabaseAdmin
    .from('flights')
    .select(`
      *,
      seasons (id, name, type)
    `)
    .eq('id', id)
    .eq('agency_id', agencyId)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Flight not found' });
  res.json(data);
};

export const createFlight = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { season_id, code, departure_city, arrival_city, departure_date, return_date, carrier, is_direct, total_duration_minutes, airline_logo_url, transits } = req.body;
  
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  // Create the flight
  const { data: flight, error } = await supabaseAdmin
    .from('flights')
    .insert({
      agency_id: agencyId,
      season_id,
      code,
      departure_city,
      arrival_city,
      departure_date,
      return_date,
      carrier,
      is_direct: is_direct ?? true,
      total_duration_minutes,
      airline_logo_url
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // If indirect flight, create transit stops
  if (!is_direct && transits && transits.length > 0) {
    const transitsToInsert = transits.map((t: any, index: number) => ({
      flight_id: flight.id,
      stop_order: index + 1,
      city: t.city,
      airport_code: t.airport_code,
      arrival_time: t.arrival_time || null,
      departure_time: t.departure_time || null,
      layover_minutes: t.layover_minutes || 0,
      carrier: t.carrier,
      flight_number: t.flight_number,
      notes: t.notes
    }));

    const { error: transitError } = await supabaseAdmin
      .from('flight_transits')
      .insert(transitsToInsert);

    if (transitError) {
      console.error('Error creating transits:', transitError);
    }
  }

  // Fetch the complete flight with transits
  const { data: completeFlight } = await supabaseAdmin
    .from('flights')
    .select(`
      *,
      seasons (id, name, type),
      flight_transits (id, stop_order, city, airport_code, arrival_time, departure_time, layover_minutes, carrier, flight_number, notes)
    `)
    .eq('id', flight.id)
    .single();

  res.json(completeFlight || flight);
};

export const updateFlight = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { season_id, code, departure_city, arrival_city, departure_date, return_date, carrier, is_direct, total_duration_minutes, airline_logo_url, transits } = req.body;
  
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  // Update the flight
  const { data: flight, error } = await supabaseAdmin
    .from('flights')
    .update({
      season_id,
      code,
      departure_city,
      arrival_city,
      departure_date,
      return_date,
      carrier,
      is_direct: is_direct ?? true,
      total_duration_minutes,
      airline_logo_url
    })
    .eq('id', id)
    .eq('agency_id', agencyId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  if (!flight) return res.status(404).json({ error: 'Flight not found' });

  // Delete existing transits and recreate
  await supabaseAdmin
    .from('flight_transits')
    .delete()
    .eq('flight_id', id);

  // If indirect flight, create new transit stops
  if (!is_direct && transits && transits.length > 0) {
    const transitsToInsert = transits.map((t: any, index: number) => ({
      flight_id: id,
      stop_order: index + 1,
      city: t.city,
      airport_code: t.airport_code,
      arrival_time: t.arrival_time || null,
      departure_time: t.departure_time || null,
      layover_minutes: t.layover_minutes || 0,
      carrier: t.carrier,
      flight_number: t.flight_number,
      notes: t.notes
    }));

    const { error: transitError } = await supabaseAdmin
      .from('flight_transits')
      .insert(transitsToInsert);

    if (transitError) {
      console.error('Error creating transits:', transitError);
    }
  }

  // Fetch the complete flight with transits
  const { data: completeFlight } = await supabaseAdmin
    .from('flights')
    .select(`
      *,
      seasons (id, name, type),
      flight_transits (id, stop_order, city, airport_code, arrival_time, departure_time, layover_minutes, carrier, flight_number, notes)
    `)
    .eq('id', id)
    .single();

  res.json(completeFlight || flight);
};

export const deleteFlight = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  // Check if flight is used by any pilgrims or bookings
  const { data: pilgrims } = await supabaseAdmin
    .from('pilgrims')
    .select('id')
    .eq('flight_id', id)
    .limit(1);

  if (pilgrims && pilgrims.length > 0) {
    return res.status(400).json({ error: 'Cannot delete flight with associated pilgrims' });
  }

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('flight_id', id)
    .limit(1);

  if (bookings && bookings.length > 0) {
    return res.status(400).json({ error: 'Cannot delete flight with associated bookings' });
  }

  const { error } = await supabaseAdmin
    .from('flights')
    .delete()
    .eq('id', id)
    .eq('agency_id', agencyId);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Flight deleted successfully' });
};
