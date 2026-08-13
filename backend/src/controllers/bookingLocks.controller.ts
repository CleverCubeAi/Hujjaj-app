import { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase';
import db from '../services/db';
import { sendError } from '../utils/httpError';

// Lock duration in minutes (configurable)
const LOCK_DURATION_MINUTES = 15;

/**
 * Create a booking lock for beds or flight seats
 */
export const createLock = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const { 
    resource_type, 
    accommodation_id, 
    room_type_id, 
    flight_id, 
    season_id, 
    quantity, 
    session_id 
  } = req.body;

  if (!agencyId || !userId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  if (!resource_type || !season_id || !quantity || !session_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (resource_type === 'bed' && (!accommodation_id || !room_type_id)) {
    return res.status(400).json({ error: 'accommodation_id and room_type_id required for bed locks' });
  }

  if (resource_type === 'flight_seat' && !flight_id) {
    return res.status(400).json({ error: 'flight_id required for flight seat locks' });
  }

  try {
    // Get user info for display
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + LOCK_DURATION_MINUTES);

    const lock = await db.transaction(async (trx) => {
      await trx('booking_locks')
        .where({ session_id, resource_type, agency_id: agencyId })
        .delete();

      if (resource_type === 'bed') {
        await trx('hotel_bed_inventory')
          .where({
            agency_id: agencyId,
            accommodation_id,
            room_type_id,
            season_id,
          })
          .forUpdate();

        const { data: availability } = await supabaseAdmin.rpc('check_bed_availability_with_locks', {
          p_accommodation_id: accommodation_id,
          p_room_type_id: room_type_id,
          p_season_id: season_id,
          p_agency_id: agencyId,
          p_quantity_needed: quantity,
          p_exclude_session_id: session_id,
        });

        if (availability && !availability[0]?.is_available) {
          const err: any = new Error('Not enough beds available');
          err.status = 409;
          err.payload = {
            error: 'لا تتوفر أسرة كافية',
            error_en: 'Not enough beds available',
            beds_available: availability[0]?.beds_available || 0,
            beds_locked: availability[0]?.beds_locked || 0,
            beds_truly_available: availability[0]?.beds_truly_available || 0,
          };
          throw err;
        }
      }

      if (resource_type === 'flight_seat') {
        const inv = await trx('flight_seat_inventory')
          .where({ agency_id: agencyId, flight_id, season_id })
          .forUpdate();
        const available = inv.reduce((sum: number, row: any) => sum + Number(row.seats_available || 0), 0);
        const lockedRow = await trx('booking_locks')
          .where({
            agency_id: agencyId,
            resource_type: 'flight_seat',
            flight_id,
            season_id,
          })
          .andWhere('expires_at', '>', trx.fn.now())
          .andWhereNot({ session_id })
          .sum('quantity as qty')
          .first();
        const locked = Number((lockedRow as any)?.qty || 0);
        if (available - locked < Number(quantity)) {
          const err: any = new Error('Not enough seats available');
          err.status = 409;
          err.payload = {
            error: 'لا تتوفر مقاعد كافية',
            error_en: 'Not enough seats available',
            seats_available: available,
            seats_locked: locked,
          };
          throw err;
        }
      }

      const [created] = await trx('booking_locks')
        .insert({
          agency_id: agencyId,
          user_id: userId,
          resource_type,
          accommodation_id: resource_type === 'bed' ? accommodation_id : null,
          room_type_id: resource_type === 'bed' ? room_type_id : null,
          flight_id: resource_type === 'flight_seat' ? flight_id : null,
          season_id,
          quantity,
          session_id,
          expires_at: expiresAt.toISOString(),
          user_name: user?.full_name || 'Unknown',
          user_email: user?.email || '',
        })
        .returning('*');
      return created;
    });

    res.json({
      ...lock,
      lock_duration_minutes: LOCK_DURATION_MINUTES,
    });
  } catch (error: any) {
    if (error?.status === 409) {
      return res.status(409).json(error.payload || { error: error.message });
    }
    return sendError(res, error);
  }
};

/**
 * Release a booking lock
 */
export const releaseLock = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const { session_id, resource_type } = req.params;

  if (!agencyId || !userId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  try {
    let query = supabaseAdmin
      .from('booking_locks')
      .delete()
      .eq('session_id', session_id)
      .forAgency(agencyId);

    if (resource_type) {
      query = query.eq('resource_type', resource_type);
    }

    const { error } = await query;

    if (error) throw error;

    res.json({ message: 'Lock released successfully' });
  } catch (error: any) {
    console.error('Error releasing booking lock:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Release all locks for a session
 */
export const releaseAllLocks = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const { session_id } = req.params;

  if (!agencyId || !userId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('booking_locks')
      .delete()
      .eq('session_id', session_id)
      .forAgency(agencyId);

    if (error) throw error;

    res.json({ message: 'All locks released successfully' });
  } catch (error: any) {
    console.error('Error releasing all locks:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get active locks for a resource (to show warnings to other agents)
 */
export const getActiveLocks = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { 
    resource_type, 
    accommodation_id, 
    room_type_id, 
    flight_id, 
    season_id,
    exclude_session_id 
  } = req.query;

  if (!agencyId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  try {
    // Clean up expired locks first
    await supabaseAdmin.rpc('cleanup_expired_booking_locks');

    let query = supabaseAdmin
      .from('booking_locks')
      .select('*')
      .forAgency(agencyId)
      .gt('expires_at', new Date().toISOString());

    if (resource_type) {
      query = query.eq('resource_type', resource_type as string);
    }

    if (accommodation_id) {
      query = query.eq('accommodation_id', accommodation_id as string);
    }

    if (room_type_id) {
      query = query.eq('room_type_id', room_type_id as string);
    }

    if (flight_id) {
      query = query.eq('flight_id', flight_id as string);
    }

    if (season_id) {
      query = query.eq('season_id', season_id as string);
    }

    if (exclude_session_id) {
      query = query.neq('session_id', exclude_session_id as string);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error: any) {
    console.error('Error getting active locks:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Extend a lock's expiration time
 */
export const extendLock = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const { session_id } = req.params;

  if (!agencyId || !userId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  try {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + LOCK_DURATION_MINUTES);

    const { data, error } = await supabaseAdmin
      .from('booking_locks')
      .update({ expires_at: expiresAt.toISOString() })
      .eq('session_id', session_id)
      .eq('user_id', userId)
      .forAgency(agencyId)
      .select();

    if (error) throw error;

    res.json({ 
      message: 'Locks extended successfully',
      expires_at: expiresAt.toISOString(),
      locks_extended: data?.length || 0
    });
  } catch (error: any) {
    console.error('Error extending lock:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Clean up all expired locks (admin function)
 */
export const cleanupExpiredLocks = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;

  if (!agencyId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  try {
    // Delete all expired locks
    const { data, error } = await supabaseAdmin
      .from('booking_locks')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) throw error;

    res.json({ 
      message: 'Expired locks cleaned up',
      deleted_count: data?.length || 0
    });
  } catch (error: any) {
    console.error('Error cleaning up locks:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete all locks (for testing/admin)
 */
export const deleteAllLocks = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;

  if (!agencyId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('booking_locks')
      .delete()
      .forAgency(agencyId)
      .select();

    if (error) throw error;

    res.json({ 
      message: 'All locks deleted',
      deleted_count: data?.length || 0
    });
  } catch (error: any) {
    console.error('Error deleting all locks:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get availability with lock consideration
 */
export const getAvailabilityWithLocks = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { 
    accommodation_id, 
    room_type_id, 
    season_id,
    quantity_needed,
    exclude_session_id 
  } = req.query;

  if (!agencyId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  if (!accommodation_id || !room_type_id || !season_id) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .rpc('check_bed_availability_with_locks', {
        p_accommodation_id: accommodation_id,
        p_room_type_id: room_type_id,
        p_season_id: season_id,
        p_agency_id: agencyId,
        p_quantity_needed: parseInt(quantity_needed as string) || 1,
        p_exclude_session_id: exclude_session_id as string || null
      });

    if (error) throw error;

    const result = data?.[0] || {
      beds_available: 0,
      beds_locked: 0,
      beds_truly_available: 0,
      is_available: false
    };

    res.json(result);
  } catch (error: any) {
    console.error('Error checking availability with locks:', error);
    res.status(500).json({ error: error.message });
  }
};
