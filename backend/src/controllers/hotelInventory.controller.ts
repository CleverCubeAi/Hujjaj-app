import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';

// Use the new bed-based table name
const TABLE_NAME = 'hotel_bed_inventory';

export const listHotelInventory = async (req: Request, res: Response) => {
  try {
    const agencyId = req.agencyId || req.user?.agency_id;
    const { season_id, accommodation_id, room_type_id } = req.query;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    let query = supabase
      .from(TABLE_NAME)
      .select(`
        *,
        accommodations (id, name, name_ar, city, country),
        room_types (id, type, total_beds),
        seasons (id, name, type)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (season_id) query = query.eq('season_id', season_id);
    if (accommodation_id) query = query.eq('accommodation_id', accommodation_id);
    if (room_type_id) query = query.eq('room_type_id', room_type_id);

    const { data, error } = await query;

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getHotelInventory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.agencyId || req.user?.agency_id;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        *,
        accommodations (id, name, name_ar, city, country),
        room_types (id, type, total_beds),
        seasons (id, name, type)
      `)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Hotel inventory not found' });
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createHotelInventory = async (req: Request, res: Response) => {
  try {
    const agencyId = req.agencyId || req.user?.agency_id;
    const userId = req.user?.id;
    const role = req.user?.role;
    const {
      season_id,
      accommodation_id,
      room_type_id,
      // Support both bed-based and room-based field names for backward compatibility
      beds_purchased,
      rooms_purchased,
      purchase_price_per_bed,
      purchase_price_per_room,
      check_in_date,
      check_out_date,
      sell_price_per_bed,
      sell_price_per_room,
      supplier_name,
      notes
    } = req.body;

    // Use bed-based fields if provided, otherwise fall back to room-based
    const actualBedsPurchased = beds_purchased || rooms_purchased;
    const actualPurchasePrice = purchase_price_per_bed || purchase_price_per_room;
    const actualSellPrice = sell_price_per_bed || sell_price_per_room;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can purchase inventory
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can purchase hotel inventory' });
    }

    // Validate required fields
    if (!season_id || !accommodation_id || !room_type_id || !actualBedsPurchased || 
        !actualPurchasePrice || !check_in_date || !check_out_date) {
      return res.status(400).json({ 
        error: 'Missing required fields: season_id, accommodation_id, room_type_id, beds_purchased, purchase_price_per_bed, check_in_date, check_out_date' 
      });
    }

    // Validate dates
    if (new Date(check_out_date) <= new Date(check_in_date)) {
      return res.status(400).json({ error: 'check_out_date must be after check_in_date' });
    }

    // Verify accommodation and room type exist
    const { data: accommodation } = await supabase
      .from('accommodations')
      .select('id')
      .eq('id', accommodation_id)
      .eq('agency_id', agencyId)
      .single();

    if (!accommodation) {
      return res.status(404).json({ error: 'Accommodation not found' });
    }

    const { data: roomType } = await supabase
      .from('room_types')
      .select('id')
      .eq('id', room_type_id)
      .eq('accommodation_id', accommodation_id)
      .single();

    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found for this accommodation' });
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        agency_id: agencyId,
        season_id,
        accommodation_id,
        room_type_id,
        beds_purchased: actualBedsPurchased,
        purchase_price_per_bed: actualPurchasePrice,
        check_in_date,
        check_out_date,
        sell_price_per_bed: actualSellPrice || null,
        supplier_name: supplier_name || null,
        notes: notes || null,
        created_by: userId
      })
      .select(`
        *,
        accommodations (id, name, name_ar, city, country),
        room_types (id, type, total_beds),
        seasons (id, name, type)
      `)
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateHotelInventory = async (req: Request, res: Response) => {
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
      .from(TABLE_NAME)
      .select('id, beds_sold, beds_purchased')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Hotel inventory not found' });
    }

    // Map room-based fields to bed-based if needed
    if (updateData.rooms_purchased && !updateData.beds_purchased) {
      updateData.beds_purchased = updateData.rooms_purchased;
      delete updateData.rooms_purchased;
    }
    if (updateData.purchase_price_per_room && !updateData.purchase_price_per_bed) {
      updateData.purchase_price_per_bed = updateData.purchase_price_per_room;
      delete updateData.purchase_price_per_room;
    }
    if (updateData.sell_price_per_room && !updateData.sell_price_per_bed) {
      updateData.sell_price_per_bed = updateData.sell_price_per_room;
      delete updateData.sell_price_per_room;
    }

    // Prevent updating beds_purchased if beds have been sold
    if (updateData.beds_purchased && existing.beds_sold > 0) {
      if (updateData.beds_purchased < existing.beds_sold) {
        return res.status(400).json({ 
          error: `Cannot reduce beds_purchased below ${existing.beds_sold} (beds already sold)` 
        });
      }
    }

    // Validate dates if updating
    if (updateData.check_in_date && updateData.check_out_date) {
      if (new Date(updateData.check_out_date) <= new Date(updateData.check_in_date)) {
        return res.status(400).json({ error: 'check_out_date must be after check_in_date' });
      }
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        accommodations (id, name, name_ar, city, country),
        room_types (id, type, total_beds),
        seasons (id, name, type)
      `)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteHotelInventory = async (req: Request, res: Response) => {
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
      .from(TABLE_NAME)
      .select('id, beds_sold')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Hotel inventory not found' });
    }

    // Prevent deleting if beds have been sold
    if (existing.beds_sold > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete hotel inventory that has been allocated. Remove allocations first.' 
      });
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Hotel inventory deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAvailableBeds = async (req: Request, res: Response) => {
  try {
    const agencyId = req.agencyId || req.user?.agency_id;
    const { season_id, accommodation_id, room_type_id, check_in_date, check_out_date } = req.query;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    if (!season_id) {
      return res.status(400).json({ error: 'season_id is required' });
    }

    let query = supabase
      .from(TABLE_NAME)
      .select(`
        *,
        accommodations (id, name, name_ar, city, country),
        room_types (id, type, total_beds),
        seasons (id, name, type)
      `)
      .eq('agency_id', agencyId)
      .eq('season_id', season_id)
      .gt('beds_available', 0)
      .order('check_in_date', { ascending: true });

    if (accommodation_id) {
      query = query.eq('accommodation_id', accommodation_id);
    }

    if (room_type_id) {
      query = query.eq('room_type_id', room_type_id);
    }

    // Filter by date range if provided
    if (check_in_date && check_out_date) {
      query = query
        .lte('check_in_date', check_out_date as string)
        .gte('check_out_date', check_in_date as string);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Format response with availability info
    const formatted = (data || []).map((item: any) => ({
      ...item,
      available_beds: item.beds_available,
      sell_price: item.sell_price_per_bed,
      purchase_price: item.purchase_price_per_bed,
      margin: item.margin_per_bed
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Alias for backward compatibility
export const getAvailableRooms = getAvailableBeds;

/**
 * Get bed map for a hotel inventory: all beds (used + unused) with pilgrim/booking info
 * Used beds show pilgrim (photo if available), clickable to booking details
 */
export const getBedMap = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.agencyId || req.user?.agency_id;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // 1. Get inventory
    const { data: inventory, error: invError } = await supabase
      .from(TABLE_NAME)
      .select(`
        id,
        accommodation_id,
        room_type_id,
        beds_purchased,
        beds_sold,
        check_in_date,
        check_out_date,
        room_labels,
        accommodations (id, name, name_ar, city),
        room_types (id, type, total_beds)
      `)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (invError || !inventory) {
      return res.status(404).json({ error: 'Hotel inventory not found' });
    }

    const accommodationId = inventory.accommodation_id;
    const roomTypeId = inventory.room_type_id;
    const bedsPurchased = inventory.beds_purchased || 0;
    const roomType = Array.isArray(inventory.room_types) ? inventory.room_types[0] : inventory.room_types;
    // Use room type (double/triple/quad/quint) for beds per room, NOT total_beds (which is total capacity)
    const bedsPerRoom = getBedsPerRoomFromType(roomType?.type) ?? 2;

    // 2. Find bookings that use this inventory (via hotel_inventory_ids or booking_bed_allocations)
    const { data: allocations } = await supabase
      .from('booking_bed_allocations')
      .select('booking_id, pilgrim_id, beds_allocated')
      .eq('hotel_bed_inventory_id', id);

    const bookingIdsFromAllocations = [...new Set((allocations || []).map((a: any) => a.booking_id))];

    const { data: bookingsWithInv } = await supabase
      .from('bookings')
      .select('id')
      .eq('agency_id', agencyId)
      .contains('hotel_inventory_ids', [id]);

    const bookingIdsFromHotelIds = (bookingsWithInv || []).map((b: any) => b.id);
    const allBookingIds = [...new Set([...bookingIdsFromAllocations, ...bookingIdsFromHotelIds])];

    // 3. Get room_assignments for those bookings (accommodation + room_type match)
    let assignments: any[] = [];
    if (allBookingIds.length > 0) {
      const { data: ra } = await supabase
        .from('room_assignments')
        .select(`
          id,
          room_number,
          pilgrim_id,
          booking_id
        `)
        .in('booking_id', allBookingIds)
        .eq('accommodation_id', accommodationId)
        .eq('room_type_id', roomTypeId);
      assignments = ra || [];
    }

    // Also get pilgrim_id from booking_bed_allocations (per-bed tracking)
    const allocationPilgrims = (allocations || []).filter((a: any) => a.pilgrim_id).map((a: any) => ({
      pilgrim_id: a.pilgrim_id,
      booking_id: a.booking_id
    }));

    // 4. Get pilgrim details (including photo_url if exists) and booking numbers
    const pilgrimIds = [...new Set([
      ...assignments.map((a: any) => a.pilgrim_id).filter(Boolean),
      ...allocationPilgrims.map((a: any) => a.pilgrim_id)
    ])];

    let pilgrimsMap: Record<string, any> = {};
    let bookingsMap: Record<string, any> = {};

    if (pilgrimIds.length > 0) {
      const { data: pilgrims } = await supabase
        .from('pilgrims')
        .select('id, full_name, full_name_ar, gender, photo_url')
        .in('id', pilgrimIds);
      (pilgrims || []).forEach((p: any) => { pilgrimsMap[p.id] = p; });
    }

    const bookingIds = [...new Set([...assignments.map((a: any) => a.booking_id), ...allocationPilgrims.map((a: any) => a.booking_id)])];
    if (bookingIds.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, booking_number')
        .in('id', bookingIds);
      (bookings || []).forEach((b: any) => { bookingsMap[b.id] = b; });
    }

    // 5. Build flat list of (pilgrim, booking_id) - from room_assignments first, then allocation pilgrims
    const usedSlots: Array<{ pilgrim: any; booking_id: string }> = [];

    const groupedByRoom = assignments.reduce((acc: Record<string, any[]>, a: any) => {
      const rn = a.room_number || 'unknown';
      if (!acc[rn]) acc[rn] = [];
      acc[rn].push(a);
      return acc;
    }, {});

    const roomNumbers = Object.keys(groupedByRoom).sort();
    for (const rn of roomNumbers) {
      for (const a of groupedByRoom[rn]) {
        if (a.pilgrim_id) {
          usedSlots.push({
            pilgrim: pilgrimsMap[a.pilgrim_id],
            booking_id: a.booking_id
          });
        }
      }
    }

    const usedFromAllocations = allocationPilgrims.filter(
      (ap: any) => !usedSlots.some((u: any) => u.pilgrim?.id === ap.pilgrim_id)
    );
    for (const ap of usedFromAllocations) {
      usedSlots.push({
        pilgrim: pilgrimsMap[ap.pilgrim_id],
        booking_id: ap.booking_id
      });
    }

    // 6. Build beds array: index 0..bedsPurchased-1
    const beds: Array<{
      index: number;
      room_index: number;
      bed_in_room: number;
      pilgrim: { id: string; full_name: string; full_name_ar?: string; gender: string; photo_url?: string } | null;
      booking_id: string | null;
      booking_number: string | null;
      used: boolean;
    }> = [];

    let slotIdx = 0;
    const totalRooms = Math.ceil(bedsPurchased / bedsPerRoom);

    for (let roomIdx = 0; roomIdx < totalRooms; roomIdx++) {
      const bedsInThisRoom = Math.min(bedsPerRoom, bedsPurchased - roomIdx * bedsPerRoom);
      for (let b = 0; b < bedsInThisRoom; b++) {
        const pilgrimData = usedSlots[slotIdx];
        const used = !!pilgrimData?.pilgrim;
        beds.push({
          index: beds.length,
          room_index: roomIdx,
          bed_in_room: b,
          pilgrim: pilgrimData?.pilgrim ? {
            id: pilgrimData.pilgrim.id,
            full_name: pilgrimData.pilgrim.full_name,
            full_name_ar: pilgrimData.pilgrim.full_name_ar,
            gender: pilgrimData.pilgrim.gender,
            photo_url: pilgrimData.pilgrim.photo_url
          } : null,
          booking_id: pilgrimData?.booking_id || null,
          booking_number: pilgrimData?.booking_id ? (bookingsMap[pilgrimData.booking_id]?.booking_number || null) : null,
          used
        });
        if (used) slotIdx++;
      }
    }

    res.json({
      inventory: {
        id: inventory.id,
        accommodation: inventory.accommodations,
        room_type: roomType,
        beds_purchased: bedsPurchased,
        beds_sold: inventory.beds_sold,
        check_in_date: inventory.check_in_date,
        check_out_date: inventory.check_out_date,
        room_labels: (inventory as any).room_labels || []
      },
      beds_per_room: bedsPerRoom,
      beds
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

function getBedsPerRoomFromType(type: string | undefined): number {
  const m: Record<string, number> = { double: 2, triple: 3, quad: 4, quint: 5 };
  return type ? (m[type] || 2) : 2;
}
