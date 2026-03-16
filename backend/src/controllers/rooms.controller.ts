import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';
import { autoAllocateRooms } from '../services/roomAllocation';

// Auto-allocate rooms for a booking
export const allocateRooms = async (req: Request, res: Response) => {
  try {
    const bookingId = req.params.bookingId as string;
    const agencyId = req.user?.agency_id;
    const { rules } = req.body;

    console.log('=== ALLOCATE ROOMS REQUEST ===');
    console.log('Booking ID:', bookingId);
    console.log('Agency ID:', agencyId);
    console.log('Rules:', rules);

    // Verify booking belongs to agency
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, accommodation_id, room_type_id, hotel_inventory_ids, same_selection_for_all')
      .eq('id', bookingId)
      .eq('agency_id', agencyId)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const hasHotelInventory = (booking as any).hotel_inventory_ids && Array.isArray((booking as any).hotel_inventory_ids) && (booking as any).hotel_inventory_ids.length > 0;
    const hasAccommodation = !!booking.accommodation_id && !!booking.room_type_id;
    if (!hasHotelInventory && !hasAccommodation) {
      return res.status(400).json({ 
        error: 'Booking must have accommodation and room type, or hotel inventory selected',
        success: false,
        warnings: ['الحجز يجب أن يحتوي على سكن ونوع غرفة أو مخزون فنادق محدد'],
        assignments: [],
        unassigned: []
      });
    }

    const result = await autoAllocateRooms(bookingId, rules);

    console.log('Allocation result:', result);
    res.json(result);
  } catch (error: any) {
    console.error('Allocate rooms error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get room assignments for a booking
export const getBookingRoomAssignments = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const agencyId = req.user?.agency_id;

    // Verify booking belongs to agency
    const { data: booking } = await supabase
      .from('bookings')
      .select('id')
      .eq('id', bookingId)
      .eq('agency_id', agencyId)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { data, error } = await supabase
      .from('room_assignments')
      .select(`
        *,
        pilgrims (id, full_name, full_name_ar, gender, mahram_group_id, spouse_id, is_mahram),
        accommodations (id, name, name_ar, city),
        room_types (id, type, total_beds)
      `)
      .eq('booking_id', bookingId)
      .order('room_number', { ascending: true });

    if (error) throw error;

    // Group by room number
    const roomsMap = new Map<string, any>();
    for (const assignment of data || []) {
      const roomKey = assignment.room_number || 'unassigned';
      if (!roomsMap.has(roomKey)) {
        roomsMap.set(roomKey, {
          room_number: roomKey,
          accommodation: assignment.accommodations,
          room_type: assignment.room_types,
          pilgrims: []
        });
      }
      roomsMap.get(roomKey).pilgrims.push({
        id: assignment.id,
        pilgrim_id: assignment.pilgrim_id,
        pilgrim: assignment.pilgrims
      });
    }

    res.json({
      assignments: data,
      rooms: Array.from(roomsMap.values())
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create manual room assignment
export const createRoomAssignment = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const userId = req.user?.id;
    const { booking_id, pilgrim_id, room_number, accommodation_id, room_type_id } = req.body;

    console.log('=== CREATE ROOM ASSIGNMENT ===');
    console.log('Request body:', req.body);
    console.log('Agency ID:', agencyId);
    console.log('User ID:', userId);

    if (!booking_id || !pilgrim_id || !room_number) {
      return res.status(400).json({ error: 'booking_id, pilgrim_id, and room_number are required' });
    }

    // Verify booking belongs to agency
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, accommodation_id, room_type_id')
      .eq('id', booking_id)
      .eq('agency_id', agencyId)
      .single();

    console.log('Booking check:', { booking, error: bookingError });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Use provided IDs or fall back to booking's IDs
    const finalAccommodationId = accommodation_id || booking.accommodation_id;
    const finalRoomTypeId = room_type_id || booking.room_type_id;

    if (!finalAccommodationId || !finalRoomTypeId) {
      return res.status(400).json({ error: 'accommodation_id and room_type_id are required' });
    }

    // Remove only assignments for this pilgrim in THIS hotel (accommodation + room_type)
    // so that multi-hotel bookings can keep separate assignments per hotel
    const deleteQuery = supabase
      .from('room_assignments')
      .delete()
      .eq('booking_id', booking_id)
      .eq('pilgrim_id', pilgrim_id)
      .eq('accommodation_id', finalAccommodationId)
      .eq('room_type_id', finalRoomTypeId);
    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.log('Delete existing assignment error:', deleteError);
    }

    // Create new assignment
    const assignmentData = {
      booking_id,
      pilgrim_id,
      room_number,
      accommodation_id: finalAccommodationId,
      room_type_id: finalRoomTypeId,
      assigned_by: userId
    };

    console.log('Creating assignment:', assignmentData);

    const { data, error } = await supabase
      .from('room_assignments')
      .insert(assignmentData)
      .select()
      .single();

    console.log('Assignment result:', { data, error });

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    console.error('Create room assignment error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update room assignment
export const updateRoomAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const { room_number } = req.body;

    // Verify assignment belongs to agency's booking
    const { data: assignment } = await supabase
      .from('room_assignments')
      .select(`
        id,
        booking_id,
        bookings!inner (agency_id)
      `)
      .eq('id', id)
      .single();

    if (!assignment || (assignment as any).bookings.agency_id !== agencyId) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const { data, error } = await supabase
      .from('room_assignments')
      .update({ room_number })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete room assignment
export const deleteRoomAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    // Verify assignment belongs to agency's booking
    const { data: assignment } = await supabase
      .from('room_assignments')
      .select(`
        id,
        bookings!inner (agency_id)
      `)
      .eq('id', id)
      .single();

    if (!assignment || (assignment as any).bookings.agency_id !== agencyId) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const { error } = await supabase
      .from('room_assignments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get available rooms for an accommodation
export const getAvailableRooms = async (req: Request, res: Response) => {
  try {
    const { accommodationId } = req.params;
    const { season_id, room_type_id } = req.query;
    const agencyId = req.user?.agency_id;

    // Get room types for this accommodation
    const { data: roomTypes, error: rtError } = await supabase
      .from('room_types')
      .select('*')
      .eq('accommodation_id', accommodationId);

    if (rtError) throw rtError;

    // Get current assignments
    const { data: assignments, error: aError } = await supabase
      .from('room_assignments')
      .select(`
        room_number,
        room_type_id,
        bookings!inner (season_id, agency_id)
      `)
      .eq('accommodation_id', accommodationId);

    if (aError) throw aError;

    // Filter by agency and optionally season
    const filteredAssignments = (assignments || []).filter((a: any) => {
      if (a.bookings.agency_id !== agencyId) return false;
      if (season_id && a.bookings.season_id !== season_id) return false;
      return true;
    });

    // Calculate availability per room type
    const availability = roomTypes?.map(rt => {
      const assignedCount = filteredAssignments.filter(
        (a: any) => a.room_type_id === rt.id
      ).length;

      const usedRooms = new Set(
        filteredAssignments
          .filter((a: any) => a.room_type_id === rt.id)
          .map((a: any) => a.room_number)
      ).size;

      return {
        room_type: rt,
        total_beds: rt.total_beds,
        assigned_beds: assignedCount,
        available_beds: rt.total_beds - assignedCount,
        total_rooms: rt.total_rooms,
        used_rooms: usedRooms,
        available_rooms: rt.total_rooms - usedRooms
      };
    });

    res.json(availability);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
