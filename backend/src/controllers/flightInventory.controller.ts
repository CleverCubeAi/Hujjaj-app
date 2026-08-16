import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';
import { pickAllowed } from '../utils/httpError';

const FLIGHT_INV_FIELDS = [
  'season_id', 'flight_id', 'seat_class', 'seats_purchased', 'purchase_price_per_seat',
  'sell_price_per_seat', 'supplier_name', 'supplier_contact', 'notes',
] as const;

export const listFlightInventory = async (req: Request, res: Response) => {
  try {
    const agencyId = req.agencyId || req.user?.agency_id;
    const { season_id, flight_id } = req.query;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    let query = supabase
      .from('flight_seat_inventory')
      .select(`
        *,
        flights (id, code, departure_city, arrival_city, departure_date, return_date, carrier),
        seasons (id, name, type)
      `)
      .forAgency(agencyId)
      .order('created_at', { ascending: false });

    if (season_id) query = query.eq('season_id', season_id);
    if (flight_id) query = query.eq('flight_id', flight_id);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching flight inventory:', error);
      throw error;
    }
    res.json(data || []);
  } catch (error: any) {
    console.error('Flight inventory list error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch flight inventory' });
  }
};

export const getFlightInventory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.agencyId || req.user?.agency_id;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    const { data, error } = await supabase
      .from('flight_seat_inventory')
      .select(`
        *,
        flights (id, code, departure_city, arrival_city, departure_date, return_date, carrier),
        seasons (id, name, type)
      `)
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Flight inventory not found' });
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createFlightInventory = async (req: Request, res: Response) => {
  try {
    const agencyId = req.agencyId || req.user?.agency_id;
    const userId = req.user?.id;
    const role = req.user?.role;
    const {
      season_id,
      flight_id,
      seats_purchased,
      purchase_price_per_seat,
      sell_price_per_seat,
      seat_class,
      airline_reference,
      notes
    } = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can purchase inventory
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can purchase flight inventory' });
    }

    // Validate required fields
    if (!season_id || !flight_id || !seats_purchased || !purchase_price_per_seat) {
      return res.status(400).json({ 
        error: 'Missing required fields: season_id, flight_id, seats_purchased, purchase_price_per_seat' 
      });
    }

    // Verify flight exists
    const { data: flight } = await supabase
      .from('flights')
      .select('id')
      .eq('id', flight_id)
      .forAgency(agencyId)
      .single();

    if (!flight) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    const validSeatClass = ['economy', 'business', 'first_class'].includes(seat_class) ? seat_class : 'economy';
    const { data, error } = await supabase
      .from('flight_seat_inventory')
      .insert({
        agency_id: agencyId,
        season_id,
        flight_id,
        seats_purchased,
        purchase_price_per_seat,
        sell_price_per_seat: sell_price_per_seat || null,
        seat_class: validSeatClass,
        airline_reference: airline_reference || null,
        notes: notes || null,
        created_by: userId
      })
      .select(`
        *,
        flights (id, code, departure_city, arrival_city, departure_date, return_date, carrier),
        seasons (id, name, type)
      `)
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateFlightInventory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.agencyId || req.user?.agency_id;
    const role = req.user?.role;
    const updateData = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can update
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if inventory exists
    const { data: existing } = await supabase
      .from('flight_seat_inventory')
      .select('id, seats_sold, seats_purchased')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Flight inventory not found' });
    }

    if (updateData.seat_class) {
      const valid = ['economy', 'business', 'first_class'].includes(updateData.seat_class);
      if (!valid) delete updateData.seat_class;
    }
    // Prevent updating seats_purchased if seats have been sold
    if (updateData.seats_purchased && existing.seats_sold > 0) {
      if (updateData.seats_purchased < existing.seats_sold) {
        return res.status(400).json({ 
          error: `Cannot reduce seats_purchased below ${existing.seats_sold} (seats already sold)` 
        });
      }
    }

    const { data, error } = await supabase
      .from('flight_seat_inventory')
      .update({
        ...pickAllowed(updateData, FLIGHT_INV_FIELDS),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .forAgency(agencyId)
      .select(`
        *,
        flights (id, code, departure_city, arrival_city, departure_date, return_date, carrier),
        seasons (id, name, type)
      `)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteFlightInventory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.agencyId || req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can delete
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if inventory exists and has allocations
    const { data: existing } = await supabase
      .from('flight_seat_inventory')
      .select('id, seats_sold')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Flight inventory not found' });
    }

    // Prevent deleting if seats have been sold
    if (existing.seats_sold > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete flight inventory that has been allocated. Remove allocations first.' 
      });
    }

    const { error } = await supabase
      .from('flight_seat_inventory')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Flight inventory deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAvailableSeats = async (req: Request, res: Response) => {
  try {
    const agencyId = req.agencyId || req.user?.agency_id;
    const { season_id, flight_id } = req.query;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    if (!season_id) {
      return res.status(400).json({ error: 'season_id is required' });
    }

    let query = supabase
      .from('flight_seat_inventory')
      .select(`
        *,
        flights (id, code, departure_city, arrival_city, departure_date, return_date, carrier),
        seasons (id, name, type)
      `)
      .forAgency(agencyId)
      .eq('season_id', season_id)
      .gt('seats_available', 0)
      .order('created_at', { ascending: true });

    if (flight_id) {
      query = query.eq('flight_id', flight_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Format response with availability info
    const formatted = (data || []).map((item: any) => ({
      ...item,
      available_seats: item.seats_available,
      sell_price: item.sell_price_per_seat,
      purchase_price: item.purchase_price_per_seat,
      margin: item.margin_per_seat
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get seat map for a flight inventory: all seats (used + unused) with pilgrim/booking info
 * Used seats show pilgrim (photo if available), clickable to booking details
 */
export const getSeatMap = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.agencyId || req.user?.agency_id;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // 1. Get inventory
    const { data: inventory, error: invError } = await supabase
      .from('flight_seat_inventory')
      .select(`
        id,
        flight_id,
        seats_purchased,
        seats_sold,
        seat_class,
        flights (id, code, departure_city, arrival_city, departure_date, return_date, carrier),
        seasons (id, name, type)
      `)
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (invError || !inventory) {
      return res.status(404).json({ error: 'Flight inventory not found' });
    }

    const seatsPurchased = inventory.seats_purchased || 0;

    // 2. Get pilgrims for this inventory:
    //    a) pilgrims.flight_seat_inventory_id = id
    //    b) pilgrims from bookings where booking.flight_seat_inventory_id = id
    //    c) pilgrims from bookings that have booking_flight_allocations for this inventory
    const { data: pilgrimsDirect } = await supabase
      .from('pilgrims')
      .select('id, booking_id')
      .eq('flight_seat_inventory_id', id)
      .forAgency(agencyId);

    const { data: bookingsWithFlightInv } = await supabase
      .from('bookings')
      .select('id')
      .eq('flight_seat_inventory_id', id)
      .forAgency(agencyId);

    const { data: flightAllocations } = await supabase
      .from('booking_flight_allocations')
      .select('booking_id')
      .eq('flight_seat_inventory_id', id);

    const bookingIdsFromAllocations = (flightAllocations || []).map((a: any) => a.booking_id);
    const bookingIdsFromBookings = (bookingsWithFlightInv || []).map((b: any) => b.id);
    const allBookingIds = [...new Set([...bookingIdsFromAllocations, ...bookingIdsFromBookings])];

    let pilgrimsFromBookings: Array<{ id: string; booking_id: string }> = [];
    if (allBookingIds.length > 0) {
      const { data: pFromB } = await supabase
        .from('pilgrims')
        .select('id, booking_id')
        .in('booking_id', allBookingIds)
        .forAgency(agencyId);
      pilgrimsFromBookings = pFromB || [];
    }

    const seenPilgrimIds = new Set<string>();
    const orderedPilgrims: Array<{ pilgrim_id: string; booking_id: string }> = [];

    for (const p of pilgrimsDirect || []) {
      if (!seenPilgrimIds.has(p.id) && p.booking_id) {
        seenPilgrimIds.add(p.id);
        orderedPilgrims.push({ pilgrim_id: p.id, booking_id: p.booking_id });
      }
    }
    for (const p of pilgrimsFromBookings) {
      if (!seenPilgrimIds.has(p.id) && p.booking_id) {
        seenPilgrimIds.add(p.id);
        orderedPilgrims.push({ pilgrim_id: p.id, booking_id: p.booking_id });
      }
    }

    const pilgrimIds = orderedPilgrims.map((x) => x.pilgrim_id);
    const pilgrimsMap: Record<string, any> = {};
    const bookingsMap: Record<string, any> = {};

    if (pilgrimIds.length > 0) {
      const { data: pilgrims } = await supabase
        .from('pilgrims')
        .select('id, full_name, full_name_ar, gender, photo_url')
        .in('id', pilgrimIds);
      (pilgrims || []).forEach((p: any) => { pilgrimsMap[p.id] = p; });
    }

    const bookingIds = [...new Set(orderedPilgrims.map((x) => x.booking_id))];
    if (bookingIds.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, booking_number')
        .in('id', bookingIds);
      (bookings || []).forEach((b: any) => { bookingsMap[b.id] = b; });
    }

    // 3. Build seats array
    const seats: Array<{
      index: number;
      pilgrim: { id: string; full_name: string; full_name_ar?: string; gender: string; photo_url?: string } | null;
      booking_id: string | null;
      booking_number: string | null;
      used: boolean;
    }> = [];

    for (let i = 0; i < seatsPurchased; i++) {
      const slot = orderedPilgrims[i];
      const pilgrim = slot ? pilgrimsMap[slot.pilgrim_id] : null;
      const used = !!pilgrim;
      seats.push({
        index: i,
        pilgrim: pilgrim ? {
          id: pilgrim.id,
          full_name: pilgrim.full_name,
          full_name_ar: pilgrim.full_name_ar,
          gender: pilgrim.gender,
          photo_url: pilgrim.photo_url
        } : null,
        booking_id: slot?.booking_id || null,
        booking_number: slot?.booking_id ? (bookingsMap[slot.booking_id]?.booking_number || null) : null,
        used
      });
    }

    const flight = Array.isArray(inventory.flights) ? inventory.flights[0] : inventory.flights;

    res.json({
      inventory: {
        id: inventory.id,
        flight,
        seats_purchased: seatsPurchased,
        seats_sold: inventory.seats_sold,
        seat_class: inventory.seat_class
      },
      seats
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
