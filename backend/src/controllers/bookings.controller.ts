import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';
import { verifyDeletionPassword } from './settings.controller';
import { autoAllocateRooms } from '../services/roomAllocation';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { getAgencyEntitlements } from '../services/packages.service';
import db from '../services/db';

// Arabic text reshaper for proper rendering
const arabicReshaper = require('arabic-reshaper');

// Path to Arabic fonts
const AMIRI_REGULAR = path.join(__dirname, '../assets/fonts/Amiri-Regular.ttf');
const AMIRI_BOLD = path.join(__dirname, '../assets/fonts/Amiri-Bold.ttf');

function localUploadPath(url?: string | null) {
  if (!url) return null;
  const match = String(url).match(/\/uploads\/(.+?)(?:\?|$)/);
  if (!match) return null;
  const full = path.resolve(process.cwd(), 'uploads', match[1]);
  if (!full.startsWith(path.resolve(process.cwd(), 'uploads'))) return null;
  return fs.existsSync(full) ? full : null;
}

// Helper to check if text contains Arabic characters
function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

// Helper to reshape and reverse Arabic text for proper PDF rendering
function processArabicText(text: string): string {
  if (!text || !containsArabic(text)) return text;
  try {
    // Reshape Arabic characters (handle letter connections)
    const reshaped = arabicReshaper.convertArabic(text);
    // Reverse for RTL display in PDF
    return reshaped.split('').reverse().join('');
  } catch (e) {
    return text;
  }
}

// Recalculate and persist total_amount for a booking (remaining_balance is a generated column)
async function recalcBookingTotals(bookingId: string): Promise<void> {
  const { data: items } = await supabase
    .from('invoice_items')
    .select('total_price, quantity, unit_price')
    .eq('booking_id', bookingId);

  const total = (items || []).reduce((sum: number, i: any) =>
    sum + (i.total_price != null ? i.total_price : i.quantity * i.unit_price), 0);

  await supabase
    .from('bookings')
    .update({ total_amount: total })
    .eq('id', bookingId);
}

// Helper function to get user IDs in a branch
async function getBranchUserIds(branchId: string): Promise<string[]> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('branch_id', branchId);
  return data?.map((u: any) => u.id) || [];
}

// Get all bookings for the agency with role-based filtering
export const getBookings = async (req: Request, res: Response) => {
  try {
    const { status, season_id, search, show_deleted } = req.query;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const userId = req.user?.id;
    const userBranchId = req.user?.branch_id;

    let query = supabase
      .from('bookings')
      .select(`
        *,
        clients (id, full_name, full_name_ar, phone),
        seasons (id, name, type),
        flights (id, code, departure_date),
        accommodations (id, name, name_ar, city),
        pilgrims (id, full_name, full_name_ar, gender),
        creator:users!bookings_created_by_fkey (id, full_name, branch_id)
      `)
      .forAgency(agencyId)
      .order('created_at', { ascending: false });

    // Handle deleted bookings filter (only admins can see deleted bookings)
    const isAdmin = role === 'agency_admin' || role === 'super_admin';
    if (show_deleted === 'true' && isAdmin) {
      // Show only deleted bookings
      query = query.not('deleted_at', 'is', null);
    } else if (show_deleted === 'all' && isAdmin) {
      // Show all bookings (both deleted and non-deleted)
      // No filter needed
    } else {
      // Default: exclude soft-deleted bookings
      query = query.is('deleted_at', null);
    }

    if (status) {
      query = query.eq('status', status);
    }
    if (season_id) {
      query = query.eq('season_id', season_id);
    }

    // Role-based filtering
    if (role === 'agent') {
      // Agent sees only their own bookings
      query = query.eq('created_by', userId);
    } else if (role === 'manager' && userBranchId) {
      // Manager sees bookings created by users in their branch
      const branchUserIds = await getBranchUserIds(userBranchId);
      if (branchUserIds.length > 0) {
        query = query.in('created_by', branchUserIds);
      } else {
        // No users in branch, return empty
        return res.json([]);
      }
    }
    // Admin sees all (no additional filter)

    const { data, error } = await query;

    if (error) throw error;

    // Filter by search if provided (client name or booking number)
    let result = data;
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      result = data?.filter((b: any) => 
        b.booking_number?.toLowerCase().includes(searchLower) ||
        b.clients?.full_name?.toLowerCase().includes(searchLower) ||
        b.clients?.full_name_ar?.includes(search)
      );
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get single booking by ID with all details
export const getBookingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const userId = req.user?.id;
    const userBranchId = req.user?.branch_id;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        clients (*),
        seasons (id, name, type),
        flights (id, code, departure_city, arrival_city, departure_date, return_date, carrier),
        accommodations (id, name, name_ar, city),
        room_types (id, type, total_beds, price_per_bed),
        pilgrims (
          id, full_name, full_name_ar, gender, date_of_birth,
          passport_number, phone, mahram_group_id, spouse_id, parent_id,
          hotel_inventory_ids, room_type_id, accommodation_id
        ),
        invoice_items (
          id, pilgrim_id, item_type, description, quantity, unit_price, total_price, extra_service_id,
          extra_services (name, name_ar)
        ),
        payments (
          id, amount, payment_method, reference_number, notes, payment_date
        ),
        room_assignments (
          id, room_number, pilgrim_id, accommodation_id, room_type_id
        ),
        creator:users!bookings_created_by_fkey (id, full_name, branch_id)
      `)
      .eq('id', id)
      .forAgency(agencyId)
      .is('deleted_at', null)  // Exclude soft-deleted bookings
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Role-based access check
    const isAdmin = role === 'agency_admin' || role === 'super_admin';
    if (!isAdmin) {
      if (role === 'agent' && data.created_by !== userId) {
        return res.status(403).json({ error: 'You can only view your own bookings' });
      }
      if (role === 'manager' && userBranchId) {
        const branchUserIds = await getBranchUserIds(userBranchId);
        if (!branchUserIds.includes(data.created_by)) {
          return res.status(403).json({ error: 'You can only view bookings from your branch' });
        }
      }
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get booking hotels for room distribution (multi-hotel support)
export const getBookingHotels = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, accommodation_id, room_type_id, hotel_inventory_ids, same_selection_for_all,
        pilgrims (id, hotel_inventory_ids, room_type_id, accommodation_id)
      `)
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (error || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const invIds = new Set<string>();
    const sameForAll = (booking as any).same_selection_for_all !== false;
    const bookingInvIds = (booking as any).hotel_inventory_ids as string[] | null | undefined;

    // Prefer booking hotel_inventory_ids; fallback to pilgrims' (aligned when same_selection_for_all)
    if (sameForAll && bookingInvIds && Array.isArray(bookingInvIds) && bookingInvIds.length > 0) {
      bookingInvIds.forEach((x: string) => x && invIds.add(x));
    }
    if (invIds.size === 0) {
      const pilgrims = (booking as any).pilgrims || [];
      for (const p of pilgrims) {
        const ids = (p as any).hotel_inventory_ids;
        if (ids && Array.isArray(ids)) ids.forEach((x: string) => x && invIds.add(x));
      }
    }

    const pilgrimsList = (booking as any).pilgrims || [];
    const allPilgrimIds = pilgrimsList.map((p: any) => p.id).filter(Boolean);

    if (invIds.size === 0) {
      const accId = (booking as any).accommodation_id;
      const rtId = (booking as any).room_type_id;
      if (accId && rtId) {
        const { data: acc } = await supabase.from('accommodations').select('id, name, name_ar, city').eq('id', accId).single();
        const { data: rt } = await supabase.from('room_types').select('id, type, total_beds').eq('id', rtId).single();
        if (acc && rt) {
          return res.json([{ accommodation: acc, room_type: rt, accommodation_id: accId, room_type_id: rtId, pilgrim_ids: allPilgrimIds }]);
        }
      }
      return res.json([]);
    }

    const { data: inventories } = await supabase
      .from('hotel_bed_inventory')
      .select(`
        id, accommodation_id, room_type_id,
        accommodations (id, name, name_ar, city),
        room_types (id, type, total_beds)
      `)
      .in('id', Array.from(invIds));

    const invToHotel = new Map<string, { accId: string; rtId: string }>();
    for (const inv of inventories || []) {
      if (inv?.id && inv?.accommodation_id && inv?.room_type_id) {
        invToHotel.set(inv.id, { accId: inv.accommodation_id, rtId: inv.room_type_id });
      }
    }

    const getPilgrimIdsForHotel = (accId: string, rtId: string): string[] => {
      if (sameForAll) return allPilgrimIds;
      const ids: string[] = [];
      for (const p of pilgrimsList) {
        const invIdsP = (p as any).hotel_inventory_ids as string[] | null | undefined;
        if (!invIdsP || !Array.isArray(invIdsP)) continue;
        const hasThisHotel = invIdsP.some((invId: string) => {
          const h = invToHotel.get(invId);
          return h && h.accId === accId && h.rtId === rtId;
        });
        if (hasThisHotel && (p as any).id) ids.push((p as any).id);
      }
      return ids;
    };

    const seen = new Set<string>();
    const hotels: any[] = [];
    for (const inv of inventories || []) {
      if (!inv?.accommodation_id || !inv?.room_type_id) continue;
      const key = `${inv.accommodation_id}|${inv.room_type_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const acc = Array.isArray(inv.accommodations) ? inv.accommodations[0] : inv.accommodations;
      const rt = Array.isArray(inv.room_types) ? inv.room_types[0] : inv.room_types;
      if (acc && rt) {
        hotels.push({
          accommodation: acc,
          room_type: rt,
          accommodation_id: inv.accommodation_id,
          room_type_id: inv.room_type_id,
          pilgrim_ids: getPilgrimIdsForHotel(inv.accommodation_id, inv.room_type_id)
        });
      }
    }
    res.json(hotels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Create new booking
export const createBooking = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const userId = req.user?.id;
    const {
      client_id,
      season_id,
      flight_id,
      flight_seat_inventory_id,
      accommodation_id,
      room_type_id,
      hotel_inventory_ids,
      same_selection_for_all = true,
      notes,
      pilgrims,
      extra_services
    } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'Client is required' });
    }

    const pilgrimsCount = pilgrims?.length || 0;
    if (pilgrimsCount > 0) {
      const missingPassport = pilgrims.find((p: any) => !(p.passport_number || '').toString().trim());
      if (missingPassport) {
        return res.status(400).json({
          error: 'رقم الجواز إلزامي لجميع المعتمرين',
          error_en: 'Passport number is required for all pilgrims'
        });
      }
    }

    // Validate room type(s) have INVENTORY
    // Skip validation if hotel_inventory_ids are explicitly provided — those ARE the inventory
    const topLevelInventoryIds = Array.isArray(hotel_inventory_ids) ? hotel_inventory_ids : [];
    const pilgrimLevelInventoryIds = (pilgrims || []).some((p: any) => Array.isArray(p.hotel_inventory_ids) && p.hotel_inventory_ids.length > 0);
    const hasExplicitInventory = topLevelInventoryIds.length > 0 || pilgrimLevelInventoryIds;

    console.log('[createBooking] inventory validation:', {
      hotel_inventory_ids,
      topLevelCount: topLevelInventoryIds.length,
      pilgrimLevelInventoryIds,
      hasExplicitInventory,
      accommodation_id,
      room_type_id,
      season_id,
      same_selection_for_all
    });

    if (!hasExplicitInventory && accommodation_id && season_id) {
      if (same_selection_for_all && room_type_id) {
        const { data: roomType, error: roomTypeError } = await supabase
          .from('room_types')
          .select('id, type')
          .eq('id', room_type_id)
          .single();

        if (roomTypeError || !roomType) {
          return res.status(400).json({ 
            error: 'نوع الغرفة المحدد غير موجود',
            error_en: 'Selected room type not found'
          });
        }

        const { data: inventory } = await supabase
          .from('hotel_bed_inventory')
          .select('beds_purchased, beds_available')
          .eq('accommodation_id', accommodation_id)
          .eq('room_type_id', room_type_id)
          .eq('season_id', season_id)
          .forAgency(agencyId);

        const totalBedsPurchased = (inventory || []).reduce((sum: number, inv: any) => sum + (inv.beds_purchased || 0), 0);
        const totalBedsAvailable = (inventory || []).reduce((sum: number, inv: any) => sum + (inv.beds_available || 0), 0);

        if (totalBedsPurchased === 0) {
          return res.status(400).json({ 
            error: 'لا يوجد مخزون لنوع الغرفة المحدد. يرجى شراء مخزون من صفحة المخزون أولاً.',
            error_en: 'No inventory exists for selected room type. Please purchase inventory first.',
            room_type: roomType.type,
            inventory_purchased: 0
          });
        }
        if (pilgrimsCount > 0 && totalBedsAvailable < pilgrimsCount) {
          return res.status(400).json({ 
            error: `لا توجد أسرة كافية متاحة. يوجد ${totalBedsAvailable} سرير متاح وتحتاج ${pilgrimsCount} سرير.`,
            error_en: `Not enough beds available. ${totalBedsAvailable} beds available but ${pilgrimsCount} needed.`,
            beds_available: totalBedsAvailable,
            beds_needed: pilgrimsCount
          });
        }
      } else if (!same_selection_for_all && pilgrimsCount > 0) {
        // Validate each pilgrim's room type has inventory
        const roomTypeCounts: Record<string, number> = {};
        for (const p of pilgrims) {
          const rtId = p.room_type_id || room_type_id;
          if (rtId) roomTypeCounts[rtId] = (roomTypeCounts[rtId] || 0) + 1;
        }
        for (const [rtId, count] of Object.entries(roomTypeCounts)) {
          const { data: inv } = await supabase
            .from('hotel_bed_inventory')
            .select('beds_available')
            .eq('accommodation_id', accommodation_id)
            .eq('room_type_id', rtId)
            .eq('season_id', season_id)
            .forAgency(agencyId);
          const avail = (inv || []).reduce((s: number, i: any) => s + (i.beds_available || 0), 0);
          if (avail < count) {
            return res.status(400).json({ 
              error: `لا توجد أسرة كافية لنوع الغرفة المحدد. تحتاج ${count} أسرة.`,
              error_en: `Not enough beds for selected room type. Need ${count}.`
            });
          }
        }
      }
    }

    // Generate booking number — booking_number is GLOBALLY unique (Issue #18 fix:
    // RPC generate_booking_number scopes per-agency but DB UNIQUE is global, so a
    // second tenant's first booking would collide). Scope globally here instead.
    const year = new Date().getFullYear();
    let generatedNumber: string;
    {
      const { data: maxRow } = await supabase
        .from('bookings')
        .select('booking_number')
        .like('booking_number', `BK-${year}-%`)
        .order('booking_number', { ascending: false })
        .limit(1);
      let nextSeq = 1;
      if (maxRow && maxRow.length > 0) {
        const m = String(maxRow[0].booking_number || '').match(new RegExp(`^BK-${year}-(\\d+)$`));
        if (m) nextSeq = parseInt(m[1], 10) + 1;
      }
      generatedNumber = `BK-${year}-${String(nextSeq).padStart(4, '0')}`;
    }

    // Generate hold session ID and calculate expiration (24 hours)
    const holdSessionId = `booking-hold-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const holdExpiresAt = new Date();
    holdExpiresAt.setHours(holdExpiresAt.getHours() + 24);

    const primaryFlightInv = same_selection_for_all ? flight_seat_inventory_id : (pilgrims?.[0]?.flight_seat_inventory_id || flight_seat_inventory_id);
    const primaryRoomType = same_selection_for_all ? room_type_id : (pilgrims?.[0]?.room_type_id || room_type_id);

    // Create the booking with hold information
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        booking_number: generatedNumber,
        agency_id: agencyId,
        client_id,
        season_id,
        flight_id,
        flight_seat_inventory_id: primaryFlightInv || null,
        accommodation_id,
        room_type_id: primaryRoomType || null,
        hotel_inventory_ids: hotel_inventory_ids && Array.isArray(hotel_inventory_ids) && hotel_inventory_ids.length > 0 ? hotel_inventory_ids : null,
        same_selection_for_all: same_selection_for_all !== false,
        notes,
        created_by: userId,
        status: 'draft',
        hold_session_id: holdSessionId,
        hold_expires_at: holdExpiresAt.toISOString()
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Create 24-hour hold locks for inventory
    if (pilgrimsCount > 0) {
      // Create bed lock(s) - one per room type when different per pilgrim
      if (accommodation_id && season_id) {
        if (same_selection_for_all && primaryRoomType) {
          const { error: bedLockError } = await supabase
            .from('booking_locks')
            .insert({
              agency_id: agencyId,
              user_id: userId,
              booking_id: booking.id,
              resource_type: 'bed',
              accommodation_id,
              room_type_id: primaryRoomType,
              season_id,
              quantity: pilgrimsCount,
              session_id: holdSessionId,
              expires_at: holdExpiresAt.toISOString(),
              user_name: req.user?.user_metadata?.full_name || req.user?.email || 'Unknown',
              user_email: req.user?.email || ''
            });
          if (bedLockError) console.error('Error creating bed hold lock:', bedLockError);
        } else if (!same_selection_for_all) {
          const roomTypeCounts: Record<string, number> = {};
          for (const p of pilgrims) {
            const rtId = p.room_type_id;
            if (rtId) roomTypeCounts[rtId] = (roomTypeCounts[rtId] || 0) + 1;
          }
          for (const [rtId, qty] of Object.entries(roomTypeCounts)) {
            const { error: bedLockError } = await supabase
              .from('booking_locks')
              .insert({
                agency_id: agencyId,
                user_id: userId,
                booking_id: booking.id,
                resource_type: 'bed',
                accommodation_id,
                room_type_id: rtId,
                season_id,
                quantity: qty,
                session_id: holdSessionId,
                expires_at: holdExpiresAt.toISOString(),
                user_name: req.user?.user_metadata?.full_name || req.user?.email || 'Unknown',
                user_email: req.user?.email || ''
              });
            if (bedLockError) console.error('Error creating bed hold lock:', bedLockError);
          }
        }
      }

      // Create flight seat lock if flight selected
      if (flight_id && season_id) {
        const { error: flightLockError } = await supabase
          .from('booking_locks')
          .insert({
            agency_id: agencyId,
            user_id: userId,
            booking_id: booking.id,
            resource_type: 'flight_seat',
            flight_id,
            season_id,
            quantity: pilgrimsCount,
            session_id: holdSessionId,
            expires_at: holdExpiresAt.toISOString(),
            user_name: req.user?.user_metadata?.full_name || req.user?.email || 'Unknown',
            user_email: req.user?.email || ''
          });
        
        if (flightLockError) {
          console.error('Error creating flight hold lock:', flightLockError);
        }
      }
    }

    // Add pilgrims if provided
    if (pilgrims && pilgrims.length > 0) {
      // Separate existing pilgrims (have valid UUID id) from new ones
      const existingPilgrims = pilgrims.filter((p: any) => p.id && p.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
      const newPilgrims = pilgrims.filter((p: any) => !p.id || !p.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
      
      let allPilgrims: any[] = [];
      
      // Update existing pilgrims to link them to this booking
      if (existingPilgrims.length > 0) {
        for (let i = 0; i < existingPilgrims.length; i++) {
          const p = existingPilgrims[i];
          const pilgrimRoomType = !same_selection_for_all ? p.room_type_id : primaryRoomType;
          const pilgrimFlightInv = !same_selection_for_all ? p.flight_seat_inventory_id : primaryFlightInv;
          const pilgrimHotelInvIds = same_selection_for_all && hotel_inventory_ids && Array.isArray(hotel_inventory_ids) && hotel_inventory_ids.length > 0
            ? hotel_inventory_ids
            : (!same_selection_for_all && p.hotel_inventory_ids && Array.isArray(p.hotel_inventory_ids) ? p.hotel_inventory_ids : null);
          const { data: updatedPilgrim, error: updateError } = await supabase
            .from('pilgrims')
            .update({
              booking_id: booking.id,
              season_id,
              flight_id,
              accommodation_id,
              room_type_id: pilgrimRoomType || primaryRoomType,
              flight_seat_inventory_id: pilgrimFlightInv || null,
              hotel_inventory_ids: pilgrimHotelInvIds,
              relationship_type: p.relationship_type || 'family',
              is_mahram: p.is_mahram || false,
              status: 'pending'
            })
            .eq('id', p.id)
            .forAgency(agencyId)
            .select()
            .single();
          
          if (updateError) {
            console.error('Error updating existing pilgrim:', updateError);
          } else if (updatedPilgrim) {
            allPilgrims.push(updatedPilgrim);
          }
        }
      }
      
      // Insert new pilgrims
      if (newPilgrims.length > 0) {
        const pilgrimsToInsert = newPilgrims.map((p: any) => {
          const pilgrimRoomType = !same_selection_for_all ? p.room_type_id : primaryRoomType;
          const pilgrimFlightInv = !same_selection_for_all ? p.flight_seat_inventory_id : primaryFlightInv;
          const pilgrimHotelInvIds = same_selection_for_all && hotel_inventory_ids && Array.isArray(hotel_inventory_ids) && hotel_inventory_ids.length > 0
            ? hotel_inventory_ids
            : (!same_selection_for_all && p.hotel_inventory_ids && Array.isArray(p.hotel_inventory_ids) ? p.hotel_inventory_ids : null);
          return {
            agency_id: agencyId,
            booking_id: booking.id,
            client_id,
            season_id,
            flight_id,
            accommodation_id,
            room_type_id: pilgrimRoomType || primaryRoomType,
            flight_seat_inventory_id: pilgrimFlightInv || null,
            hotel_inventory_ids: pilgrimHotelInvIds,
            full_name: p.full_name,
            full_name_ar: p.full_name_ar,
            gender: p.gender,
            date_of_birth: p.date_of_birth,
            passport_number: p.passport_number,
            phone: p.phone,
            photo_url: p.photo_url || null,
            passport_scan_url: p.passport_scan_url || null,
            mahram_group_id: p.mahram_group_id,
            relationship_type: p.relationship_type || 'family',
            is_mahram: p.is_mahram || false,
            status: 'pending'
          };
        });

        const { data: insertedPilgrims, error: pilgrimsError } = await supabase
          .from('pilgrims')
          .insert(pilgrimsToInsert)
          .select();

        if (pilgrimsError) throw pilgrimsError;
        
        if (insertedPilgrims) {
          allPilgrims = [...allPilgrims, ...insertedPilgrims];
        }
      }
      
      const insertedPilgrims = allPilgrims;

      // Create invoice items for each pilgrim
      if (insertedPilgrims && insertedPilgrims.length > 0) {
        const invoiceItems: any[] = [];

        // Collect all inventory IDs to fetch in one query
        const allInvIds = new Set<string>();
        for (const p of insertedPilgrims) {
          const pInvIds = same_selection_for_all && hotel_inventory_ids?.length > 0
            ? hotel_inventory_ids
            : (Array.isArray(p.hotel_inventory_ids) ? p.hotel_inventory_ids : []);
          pInvIds.forEach((id: string) => allInvIds.add(id));
        }

        // Fetch all inventory records once
        const invMap = new Map<string, any>();
        if (allInvIds.size > 0) {
          const { data: invRecords, error: invError } = await supabase
            .from('hotel_bed_inventory')
            .select('id, sell_price_per_bed, check_in_date, check_out_date, accommodations (name, name_ar), room_types (type)')
            .in('id', Array.from(allInvIds));
          console.log('[createBooking] inventory query:', { ids: Array.from(allInvIds), recordsFound: invRecords?.length, error: invError?.message });
          for (const inv of invRecords || []) {
            console.log('[createBooking] inv record:', { id: inv.id, sell_price_per_bed: inv.sell_price_per_bed, accommodations: inv.accommodations, room_types: inv.room_types });
            invMap.set(inv.id, inv);
          }
        } else {
          console.log('[createBooking] no inventory IDs collected, allInvIds empty');
        }

        // Fetch flight inventory sell price if applicable
        let flightSellPrice = 0;
        let flightCode = '';
        if (primaryFlightInv) {
          const { data: flightInvData, error: flightInvError } = await supabase
            .from('flight_seat_inventory')
            .select('sell_price_per_seat, flights (code)')
            .eq('id', primaryFlightInv)
            .single();
          console.log('[createBooking] flight inv:', { id: primaryFlightInv, sell_price: flightInvData?.sell_price_per_seat, error: flightInvError?.message });
          flightSellPrice = Number(flightInvData?.sell_price_per_seat ?? 0);
          flightCode = (flightInvData as any)?.flights?.code || '';
        }

        for (const p of insertedPilgrims) {
          // Flight item
          const pilgrimFlightInvId = same_selection_for_all ? primaryFlightInv : (p.flight_seat_inventory_id || primaryFlightInv);
          const pilgrimFlightPrice = pilgrimFlightInvId === primaryFlightInv ? flightSellPrice : 0;
          if (pilgrimFlightPrice > 0) {
            invoiceItems.push({
              booking_id: booking.id,
              pilgrim_id: p.id,
              item_type: 'package',
              description: `الرحلة${flightCode ? ` - ${flightCode}` : ''}`,
              quantity: 1,
              unit_price: pilgrimFlightPrice
            });
          }

          // Accommodation items (one per inventory batch)
          const pInvIds = same_selection_for_all && hotel_inventory_ids?.length > 0
            ? hotel_inventory_ids
            : (Array.isArray(p.hotel_inventory_ids) ? p.hotel_inventory_ids : []);

          if (pInvIds.length > 0) {
            for (const invId of pInvIds) {
              const inv = invMap.get(invId);
              if (!inv || !(inv.sell_price_per_bed > 0)) continue;
              const hotelName = (inv.accommodations as any)?.name_ar || (inv.accommodations as any)?.name || '';
              const roomTypeLabel = (inv.room_types as any)?.type || '';
              const nightsCount = (inv.check_in_date && inv.check_out_date
                ? Math.ceil((new Date(inv.check_out_date).getTime() - new Date(inv.check_in_date).getTime()) / 86400000)
                : 0);
              invoiceItems.push({
                booking_id: booking.id,
                pilgrim_id: p.id,
                item_type: 'package',
                description: `السكن${hotelName ? ` - ${hotelName}` : ''}${roomTypeLabel ? ` (${roomTypeLabel})` : ''}${nightsCount > 0 ? ` - ${nightsCount} ليالي` : ''}`,
                quantity: 1,
                unit_price: inv.sell_price_per_bed
              });
            }
          } else {
            // Fallback: single hotel from room_type price
            const rtId = p.room_type_id || primaryRoomType;
            if (rtId) {
              const { data: roomType } = await supabase
                .from('room_types')
                .select('price_per_bed, type')
                .eq('id', rtId)
                .single();
              if (roomType && (roomType.price_per_bed || 0) > 0) {
                invoiceItems.push({
                  booking_id: booking.id,
                  pilgrim_id: p.id,
                  item_type: 'package',
                  description: `السكن - ${roomType.type}`,
                  quantity: 1,
                  unit_price: roomType.price_per_bed || 0
                });
              }
            }
          }
        }

        console.log('[createBooking] invoice items to insert:', invoiceItems.length, invoiceItems.map(i => ({ type: i.item_type, price: i.unit_price, desc: i.description })));
        if (invoiceItems.length > 0) {
          const { error: insertError } = await supabase.from('invoice_items').insert(invoiceItems);
          if (insertError) console.error('[createBooking] invoice insert error:', insertError);
        }
      }

      // Add extra services if provided
      if (extra_services && extra_services.length > 0) {
        const serviceItems: any[] = [];
        
        for (const service of extra_services) {
          const { data: serviceData } = await supabase
            .from('extra_services')
            .select('id, name, name_ar, price')
            .eq('id', service.service_id)
            .single();

          if (serviceData && insertedPilgrims) {
            // Issue #22 fix: pilgrim_ids may arrive from the wizard as either
            // (a) array of UUIDs (existing pilgrims) OR (b) array of stringified indices into
            // insertedPilgrims (because new pilgrims have no UUID at wizard time).
            // Resolve both cases, defaulting to all when empty.
            let targetPilgrims: any[] = insertedPilgrims;
            if (Array.isArray(service.pilgrim_ids) && service.pilgrim_ids.length > 0) {
              const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              const resolved = new Set<string>();
              for (const ref of service.pilgrim_ids) {
                const key = String(ref);
                if (uuidRe.test(key)) {
                  resolved.add(key);
                } else if (/^\d+$/.test(key)) {
                  const idx = parseInt(key, 10);
                  if (insertedPilgrims[idx]?.id) resolved.add(insertedPilgrims[idx].id);
                }
              }
              targetPilgrims = insertedPilgrims.filter((p: any) => resolved.has(p.id));
              if (targetPilgrims.length === 0) targetPilgrims = insertedPilgrims; // safety fallback
            }

            for (const pilgrim of targetPilgrims) {
              serviceItems.push({
                booking_id: booking.id,
                pilgrim_id: pilgrim.id,
                item_type: 'service',
                description: serviceData.name_ar || serviceData.name,
                quantity: service.quantity || 1,
                unit_price: serviceData.price,
                extra_service_id: serviceData.id
              });
            }
          }
        }

        if (serviceItems.length > 0) {
          await supabase.from('invoice_items').insert(serviceItems);
        }
      }

      // Handle mahram relationships (spouse_id, parent_id)
      if (pilgrims.some((p: any) => p.spouse_index !== undefined || p.parent_index !== undefined)) {
        for (let i = 0; i < pilgrims.length; i++) {
          const p = pilgrims[i];
          const updates: any = {};

          if (p.spouse_index !== undefined && insertedPilgrims[p.spouse_index]) {
            updates.spouse_id = insertedPilgrims[p.spouse_index].id;
          }
          if (p.parent_index !== undefined && insertedPilgrims[p.parent_index]) {
            updates.parent_id = insertedPilgrims[p.parent_index].id;
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from('pilgrims')
              .update(updates)
              .eq('id', insertedPilgrims[i].id);
          }
        }
      }
    }

    // Sync total_amount on the booking row
    await recalcBookingTotals(booking.id);

    // Fetch the complete booking with all relations
    const { data: completeBooking, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        *,
        clients (*),
        pilgrims (*),
        invoice_items (*)
      `)
      .eq('id', booking.id)
      .single();

    if (fetchError) throw fetchError;

    res.status(201).json(completeBooking);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update booking
export const updateBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const {
      season_id,
      flight_id,
      accommodation_id,
      room_type_id,
      notes
    } = req.body;

    // Check if booking exists and is not confirmed
    const { data: existing } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (existing.status === 'confirmed' || existing.status === 'paid') {
      return res.status(400).json({ error: 'Cannot modify confirmed booking' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({
        season_id,
        flight_id,
        accommodation_id,
        room_type_id,
        notes
      })
      .eq('id', id)
      .forAgency(agencyId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Confirm booking
export const confirmBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const userId = req.user?.id;

    // Verify booking has pilgrims and invoice items
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        pilgrims (id, room_type_id, flight_seat_inventory_id, hotel_inventory_ids, accommodation_id),
        invoice_items (id),
        room_assignments (id, room_type_id),
        room_types (id, type, total_beds)
      `)
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    console.log('[confirmBooking] status:', booking.status, 'pilgrims:', booking.pilgrims?.length, 'invoice_items:', booking.invoice_items?.length, 'hotel_inventory_ids:', (booking as any).hotel_inventory_ids);
    if (booking.status !== 'draft') {
      console.log('[confirmBooking] REJECTED: status is', booking.status);
      return res.status(400).json({ error: 'Booking is already confirmed or cancelled' });
    }
    if (!booking.pilgrims || booking.pilgrims.length === 0) {
      console.log('[confirmBooking] REJECTED: no pilgrims');
      return res.status(400).json({ error: 'Booking must have at least one pilgrim' });
    }
    if (!booking.invoice_items || booking.invoice_items.length === 0) {
      console.log('[confirmBooking] REJECTED: no invoice items');
      return res.status(400).json({ error: 'Booking must have invoice items' });
    }

    // Validate INVENTORY availability before confirming
    // Skip old-style validation if booking uses explicit hotel_inventory_ids (multi-hotel)
    const bookingInvIds = (booking as any).hotel_inventory_ids;
    const hasBookingInventoryIds = Array.isArray(bookingInvIds) && bookingInvIds.length > 0;
    const hasPilgrimInventoryIds = (booking.pilgrims || []).some((p: any) => Array.isArray(p.hotel_inventory_ids) && p.hotel_inventory_ids.length > 0);

    if (!hasBookingInventoryIds && !hasPilgrimInventoryIds && booking.accommodation_id && booking.season_id) {
      const pilgrimsList = booking.pilgrims || [];
      const roomTypeCounts: Record<string, number> = {};
      for (const p of pilgrimsList) {
        const rtId = p.room_type_id || booking.room_type_id;
        if (rtId) roomTypeCounts[rtId] = (roomTypeCounts[rtId] || 0) + 1;
      }
      for (const [rtId, needed] of Object.entries(roomTypeCounts)) {
        const { data: inventory } = await supabase
          .from('hotel_bed_inventory')
          .select('beds_available')
          .eq('accommodation_id', booking.accommodation_id)
          .eq('room_type_id', rtId)
          .eq('season_id', booking.season_id)
          .forAgency(agencyId);
        const avail = (inventory || []).reduce((s: number, i: any) => s + (i.beds_available || 0), 0);
        if (avail < needed) {
          return res.status(400).json({
            error: `لا يمكن تأكيد الحجز: لا توجد أسرة كافية متاحة في المخزون.`,
            error_en: `Cannot confirm booking: Not enough beds available in inventory.`
          });
        }
      }
    }

    // Release the 24-hour hold locks (inventory is now truly allocated)
    if (booking.hold_session_id) {
      const { error: releaseLockError } = await supabase
        .from('booking_locks')
        .delete()
        .eq('booking_id', id);
      
      if (releaseLockError) {
        console.error('Error releasing hold locks:', releaseLockError);
      }
    }

    // Update booking status and clear hold information
    const { data: updatedBooking, error } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        hold_expires_at: null,
        hold_session_id: null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Auto-allocate from inventory
    try {
      const pilgrimsCount = booking.pilgrims?.length || 0;

      // Allocate hotel beds if booking has accommodation
      if (booking.accommodation_id && (booking.room_type_id || (booking.pilgrims || []).some((p: any) => p.room_type_id))) {
        const pilgrimsList = booking.pilgrims || [];
        const pilgrimsCount = pilgrimsList.length;
        const hotelInventoryIds = (booking as any).hotel_inventory_ids as string[] | null | undefined;

        const sameSelectionForAll = (booking as any).same_selection_for_all !== false;
        if (hotelInventoryIds && Array.isArray(hotelInventoryIds) && hotelInventoryIds.length > 0 && sameSelectionForAll) {
          // Multi-batch (same for all): allocate beds from each specified inventory
          const bedsPerBatch = pilgrimsCount;
          for (const invId of hotelInventoryIds) {
            if (!invId) continue;
            const { data: inv, error: invErr } = await supabase
              .from('hotel_bed_inventory')
              .select('*')
              .eq('id', invId)
              .forAgency(agencyId)
              .single();
            if (invErr || !inv) {
              throw new Error(`Invalid hotel inventory ID: ${invId}`);
            }
            const avail = inv.beds_available || 0;
            if (avail < bedsPerBatch) {
              throw new Error(`Insufficient beds in inventory ${invId}. Need ${bedsPerBatch}, available ${avail}.`);
            }
            if (inv.beds_sold + bedsPerBatch > inv.beds_purchased) {
              throw new Error(`Cannot allocate ${bedsPerBatch} beds from inventory ${invId}.`);
            }
            const { error: allocErr } = await supabase
              .from('booking_bed_allocations')
              .insert({
                booking_id: id,
                hotel_bed_inventory_id: invId,
                beds_allocated: bedsPerBatch,
                price_charged: inv.sell_price_per_bed || 0,
                allocated_by: userId,
                notes: `Allocated from selected inventory (multi-batch)`
              });
            if (allocErr) throw allocErr;
          }
        } else if (!sameSelectionForAll && pilgrimsList.some((p: any) => p.hotel_inventory_ids && Array.isArray(p.hotel_inventory_ids) && p.hotel_inventory_ids.length > 0)) {
          // Per-pilgrim: allocate 1 bed from each pilgrim's hotel_inventory_ids
          for (const pilgrim of pilgrimsList) {
            const invIds = (pilgrim as any).hotel_inventory_ids as string[] | null | undefined;
            if (!invIds || !Array.isArray(invIds)) continue;
            for (const invId of invIds) {
              if (!invId) continue;
              const { data: inv, error: invErr } = await supabase
                .from('hotel_bed_inventory')
                .select('*')
                .eq('id', invId)
                .forAgency(agencyId)
                .single();
              if (invErr || !inv || (inv.beds_available || 0) < 1) continue;
              const { error: pilgrimAllocErr } = await supabase.from('booking_bed_allocations').insert({
                booking_id: id,
                pilgrim_id: pilgrim.id,
                hotel_bed_inventory_id: invId,
                beds_allocated: 1,
                price_charged: inv.sell_price_per_bed || 0,
                allocated_by: userId,
                notes: `Per-pilgrim allocation`
              });
              if (pilgrimAllocErr) throw pilgrimAllocErr;
            }
          }
        } else {
          // Legacy: allocate by room type (FIFO)
          const roomTypeCounts: Record<string, number> = {};
          for (const p of pilgrimsList) {
            const rtId = p.room_type_id || booking.room_type_id;
            if (rtId) roomTypeCounts[rtId] = (roomTypeCounts[rtId] || 0) + 1;
          }

          for (const [rtId, bedsNeeded] of Object.entries(roomTypeCounts)) {
            const { data: hotelInventory } = await supabase
              .from('hotel_bed_inventory')
              .select('*')
              .forAgency(agencyId)
              .eq('accommodation_id', booking.accommodation_id)
              .eq('room_type_id', rtId)
              .eq('season_id', booking.season_id)
              .gt('beds_available', 0)
              .order('created_at', { ascending: true });

            if (!hotelInventory || hotelInventory.length === 0) {
              throw new Error(`No hotel inventory available for room type.`);
            }

            let remaining = bedsNeeded;
            for (const inv of hotelInventory) {
              if (remaining <= 0) break;
              const avail = inv.beds_available || 0;
              if (avail <= 0) continue;
              const toAlloc = Math.min(remaining, avail);
              if (inv.beds_sold + toAlloc > inv.beds_purchased) {
                throw new Error(`Cannot allocate ${toAlloc} beds.`);
              }
              const { error: allocErr } = await supabase
                .from('booking_bed_allocations')
                .insert({
                  booking_id: id,
                  hotel_bed_inventory_id: inv.id,
                  beds_allocated: toAlloc,
                  price_charged: inv.sell_price_per_bed || 0,
                  allocated_by: userId,
                  notes: `Auto-allocated on booking confirmation`
                });
              if (allocErr) throw allocErr;
              remaining -= toAlloc;
            }
            if (remaining > 0) {
              throw new Error(`Insufficient beds for room type. Need ${bedsNeeded}, allocated ${bedsNeeded - remaining}.`);
            }
          }
        }
      }

      // Allocate flight seats if booking has flight
      if (booking.flight_id) {
        const pilgrimsList = booking.pilgrims || [];
        const flightInvCounts: Record<string, number> = {};
        for (const p of pilgrimsList) {
          const invId = p.flight_seat_inventory_id || booking.flight_seat_inventory_id;
          if (invId) flightInvCounts[invId] = (flightInvCounts[invId] || 0) + 1;
        }

        let flightAllocated = false;
        for (const [invId, seatsNeeded] of Object.entries(flightInvCounts)) {
          if (!invId) continue;
          const { data: selectedInv, error: selErr } = await supabase
            .from('flight_seat_inventory')
            .select('*')
            .eq('id', invId)
            .forAgency(agencyId)
            .eq('flight_id', booking.flight_id)
            .single();

          if (selErr || !selectedInv) continue;
          const avail = selectedInv.seats_available || 0;
          if (avail < seatsNeeded) {
            throw new Error(`Insufficient seats in selected class. Need ${seatsNeeded}, available ${avail}.`);
          }
          const { error: allocErr } = await supabase
            .from('booking_flight_allocations')
            .insert({
              booking_id: id,
              flight_seat_inventory_id: invId,
              seats_allocated: seatsNeeded,
              price_charged: selectedInv.sell_price_per_seat || 0,
              allocated_by: userId,
              notes: `Auto-allocated on booking confirmation`
            });
          if (allocErr) throw allocErr;
          flightAllocated = true;
        }

        if (!flightAllocated) {
          const { data: fifoInventory } = await supabase
            .from('flight_seat_inventory')
            .select('*')
            .forAgency(agencyId)
            .eq('flight_id', booking.flight_id)
            .gt('seats_available', 0)
            .order('created_at', { ascending: true });
          const flightInv = fifoInventory || [];
          if (flightInv.length > 0) {
            let remaining = pilgrimsCount;
            for (const inv of flightInv) {
              if (remaining <= 0) break;
              const avail = inv.seats_available || 0;
              if (avail <= 0) continue;
              const toAlloc = Math.min(remaining, avail);
              const { error: allocErr } = await supabase
                .from('booking_flight_allocations')
                .insert({
                  booking_id: id,
                  flight_seat_inventory_id: inv.id,
                  seats_allocated: toAlloc,
                  price_charged: inv.sell_price_per_seat || 0,
                  allocated_by: userId,
                  notes: `Auto-allocated on booking confirmation`
                });
              if (allocErr) throw allocErr;
              remaining -= toAlloc;
            }
            if (remaining > 0) {
              throw new Error(`Insufficient seats available. Need ${pilgrimsCount}.`);
            }
          } else {
            throw new Error(`No flight inventory available for this flight.`);
          }
        }
      }
    } catch (allocError: any) {
      console.error('Error auto-allocating inventory:', allocError);
      // Surface allocation errors to user - don't silently confirm with failed allocation
      throw allocError;
    }

    // Issue #21 fix: auto-assign room numbers based on mahram/gender rules.
    // Non-blocking — bookings can be confirmed even if allocation has warnings.
    try {
      const allocResult = await autoAllocateRooms(id as string, {
        separateGenders: true,
        allowMahram: true,
        preferFamilyGroups: true,
      });
      if (allocResult.warnings?.length) {
        console.warn(`[confirmBooking ${id}] room allocation warnings:`, allocResult.warnings);
      }
    } catch (roomErr: any) {
      console.error(`[confirmBooking ${id}] room allocation failed (non-fatal):`, roomErr.message);
    }

    res.json(updatedBooking);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Cancel booking
export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    // Verify booking exists
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Delete allocations (triggers will automatically update inventory)
    await supabase
      .from('booking_bed_allocations')
      .delete()
      .eq('booking_id', id);

    await supabase
      .from('booking_flight_allocations')
      .delete()
      .eq('booking_id', id);

    // Update booking status
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Add pilgrim to existing booking
export const addPilgrimToBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const pilgrimData = req.body;

    // Check if booking exists and is draft
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, room_types (price_per_bed, type)')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (booking.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot add pilgrim to confirmed booking' });
    }

    const passportNumber = (pilgrimData.passport_number || '').toString().trim();
    if (!passportNumber) {
      return res.status(400).json({ error: 'رقم الجواز إلزامي', error_en: 'Passport number is required' });
    }

    // Insert pilgrim
    const { data: pilgrim, error: pilgrimError } = await supabase
      .from('pilgrims')
      .insert({
        agency_id: agencyId,
        booking_id: id,
        client_id: booking.client_id,
        season_id: booking.season_id,
        flight_id: booking.flight_id,
        accommodation_id: booking.accommodation_id,
        room_type_id: booking.room_type_id,
        full_name: pilgrimData.full_name,
        full_name_ar: pilgrimData.full_name_ar,
        gender: pilgrimData.gender,
        date_of_birth: pilgrimData.date_of_birth,
        passport_number: pilgrimData.passport_number,
        phone: pilgrimData.phone,
        photo_url: pilgrimData.photo_url || null,
        passport_scan_url: pilgrimData.passport_scan_url || null,
        mahram_group_id: pilgrimData.mahram_group_id,
        spouse_id: pilgrimData.spouse_id,
        parent_id: pilgrimData.parent_id,
        relationship_type: pilgrimData.relationship_type || 'family',
        is_mahram: pilgrimData.is_mahram || false,
        status: 'pending'
      })
      .select()
      .single();

    if (pilgrimError) throw pilgrimError;

    // Create invoice item for package
    if (booking.room_types?.price_per_bed) {
      await supabase.from('invoice_items').insert({
        booking_id: id,
        pilgrim_id: pilgrim.id,
        item_type: 'package',
        description: `Package - ${booking.room_types.type} Room`,
        quantity: 1,
        unit_price: booking.room_types.price_per_bed
      });
    }

    res.status(201).json(pilgrim);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Remove pilgrim from booking
export const removePilgrimFromBooking = async (req: Request, res: Response) => {
  try {
    const { id, pilgrimId } = req.params;
    const agencyId = req.user?.agency_id;

    // Check if booking is draft
    const { data: booking } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (booking.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot remove pilgrim from confirmed booking' });
    }

    // Delete invoice items first
    await supabase
      .from('invoice_items')
      .delete()
      .eq('pilgrim_id', pilgrimId);

    // Delete room assignments
    await supabase
      .from('room_assignments')
      .delete()
      .eq('pilgrim_id', pilgrimId);

    // Delete pilgrim
    const { error } = await supabase
      .from('pilgrims')
      .delete()
      .eq('id', pilgrimId)
      .eq('booking_id', id);

    if (error) throw error;
    res.json({ message: 'Pilgrim removed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get invoice data for booking
export const getBookingInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        clients (*),
        seasons (name, type),
        flights (code, departure_city, arrival_city, departure_date, return_date),
        accommodations (name, name_ar, city),
        room_types (type, price_per_bed),
        pilgrims (id, full_name, full_name_ar, passport_number, gender),
        invoice_items (
          id, pilgrim_id, item_type, description, quantity, unit_price, total_price
        ),
        payments (
          id, amount, payment_method, payment_date, reference_number
        )
      `)
      .eq('id', id)
      .forAgency(agencyId)
      .is('deleted_at', null)  // Exclude soft-deleted bookings
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Calculate totals
    const totalAmount = data.invoice_items?.reduce((sum: number, item: any) => 
      sum + (item.total_price || item.quantity * item.unit_price), 0) || 0;
    const paidAmount = data.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;

    res.json({
      ...data,
      calculated_total: totalAmount,
      calculated_paid: paidAmount,
      calculated_remaining: totalAmount - paidAmount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Export invoice as PDF
export const exportInvoicePDF = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    // Fetch booking with all related data
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        clients (*),
        seasons (name, type),
        flights (code, departure_city, arrival_city, departure_date, return_date),
        accommodations (name, name_ar, city),
        room_types (type, price_per_bed),
        pilgrims (id, full_name, full_name_ar, passport_number, gender),
        invoice_items (
          id, pilgrim_id, item_type, description, quantity, unit_price, total_price
        ),
        payments (
          id, amount, payment_method, payment_date, reference_number
        )
      `)
      .eq('id', id)
      .forAgency(agencyId)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Get agency info for header
    const { data: agency } = await supabase
      .from('agencies')
      .select('name, name_ar, logo_url, invoice_logo_url, phone, email, address, invoice_footer, hide_platform_mark, legal_name')
      .eq('id', agencyId)
      .single();

    const entitlements = agencyId ? await getAgencyEntitlements(agencyId).catch(() => null) : null;
    const branding = await db('platform_branding').where({ id: 1 }).first().catch(() => null);
    const showPoweredBy = !entitlements?.features.white_label || !agency?.hide_platform_mark;
    const platformName = branding?.app_name_fr || branding?.app_name || 'Hujjaj';

    // Calculate totals
    const totalAmount = booking.invoice_items?.reduce((sum: number, item: any) => 
      sum + (item.total_price || item.quantity * item.unit_price), 0) || 0;
    const paidAmount = booking.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
    const remainingAmount = totalAmount - paidAmount;

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Set response headers
    const filename = `facture_${booking.booking_number}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Helper function to format currency
    const formatCurrency = (amount: number): string => {
      const formatted = new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
      // Replace non-breaking space with regular space for PDF compatibility
      return formatted.replace(/\u00A0/g, ' ') + ' MAD';
    };

    // Helper function to format date in French
    const formatDate = (dateStr: string): string => {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Status translations to French
    const statusFr: { [key: string]: string } = {
      'draft': 'Brouillon',
      'confirmed': 'Confirmé', 
      'pending': 'En attente',
      'completed': 'Terminé',
      'cancelled': 'Annulé',
      'paid': 'Payé'
    };

    // Payment method translations
    const paymentMethodFr: { [key: string]: string } = {
      'cash': 'Espèces',
      'transfer': 'Virement',
      'check': 'Chèque',
      'card': 'Carte bancaire',
      'other': 'Autre'
    };

    // ===== HEADER =====
    const agencyName = agency?.legal_name || agency?.name || 'Agence';
    const logoPath = localUploadPath(agency?.invoice_logo_url || agency?.logo_url);
    if (logoPath) {
      try {
        doc.image(logoPath, 247, doc.y, { width: 100 });
        doc.moveDown(4);
      } catch {
        /* ignore broken image */
      }
    }
    doc.fontSize(22).font('Helvetica-Bold').text(agencyName, { align: 'center' });
    doc.font('Helvetica');
    doc.moveDown(0.3);
    
    if (agency?.phone || agency?.email) {
      doc.fontSize(10).fillColor('#666666').text(
        [agency?.phone, agency?.email].filter(Boolean).join(' | '),
        { align: 'center' }
      );
    }
    if (agency?.address) {
      doc.fontSize(9).text(agency.address, { align: 'center' });
    }
    
    doc.moveDown();
    doc.fillColor('#000000');

    // Title
    doc.fontSize(20).font('Helvetica-Bold').text('FACTURE', { align: 'center' });
    doc.font('Helvetica');
    doc.moveDown();

    // Separator
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#D4AF37');
    doc.moveDown();

    // ===== INVOICE INFO =====
    const infoY = doc.y;
    
    // Left side - Client info
    doc.fontSize(11).font('Helvetica-Bold').text('Client:', 50, infoY);
    doc.font('Helvetica').fontSize(10);
    doc.text(booking.clients?.full_name || booking.clients?.full_name_ar || '-', 50, doc.y);
    doc.text(booking.clients?.phone || '', 50, doc.y);

    // Right side - Invoice details
    doc.fontSize(10);
    doc.font('Helvetica-Bold').text('Facture N°:', 350, infoY, { continued: true });
    doc.font('Helvetica').text(` ${booking.booking_number}`);
    
    doc.font('Helvetica-Bold').text('Date:', 350, doc.y, { continued: true });
    doc.font('Helvetica').text(` ${formatDate(booking.created_at)}`);
    
    doc.font('Helvetica-Bold').text('Saison:', 350, doc.y, { continued: true });
    doc.font('Helvetica').text(` ${booking.seasons?.name || '-'}`);
    
    doc.font('Helvetica-Bold').text('Statut:', 350, doc.y, { continued: true });
    doc.font('Helvetica').text(` ${statusFr[booking.status] || booking.status}`);

    doc.moveDown(2);

    // ===== ITEMS TABLE =====
    doc.fontSize(12).font('Helvetica-Bold').text('Articles', { underline: true });
    doc.font('Helvetica');
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const colX = {
      num: 50,
      desc: 80,
      qty: 320,
      price: 380,
      total: 470
    };

    // Draw header background
    doc.rect(50, tableTop, 495, 22).fill('#D4AF37');
    doc.fillColor('#FFFFFF');

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('#', colX.num + 5, tableTop + 6);
    doc.text('Description', colX.desc, tableTop + 6);
    doc.text('Qté', colX.qty, tableTop + 6);
    doc.text('Prix Unit.', colX.price, tableTop + 6);
    doc.text('Total', colX.total, tableTop + 6);

    doc.fillColor('#000000');
    doc.font('Helvetica');

    let currentY = tableTop + 28;

    // Table rows
    const items = booking.invoice_items || [];
    items.forEach((item: any, index: number) => {
      // Check if we need a new page
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      const itemTotal = item.total_price || (item.quantity * item.unit_price);
      
      // Alternate row background
      if (index % 2 === 0) {
        doc.rect(50, currentY - 3, 495, 20).fill('#FDF8F0');
        doc.fillColor('#000000');
      }

      doc.fontSize(9);
      doc.text(`${index + 1}`, colX.num + 5, currentY);
      // Use full description without truncation
      doc.text(item.description || '-', colX.desc, currentY, { width: 230 });
      doc.text(`${item.quantity}`, colX.qty, currentY);
      doc.text(formatCurrency(item.unit_price), colX.price, currentY);
      doc.text(formatCurrency(itemTotal), colX.total, currentY);

      currentY += 20;
    });

    // Table border
    doc.rect(50, tableTop, 495, currentY - tableTop + 5).stroke('#D4AF37');

    doc.y = currentY + 20;

    // ===== TOTALS =====
    doc.fontSize(11).font('Helvetica');
    doc.text(`Sous-total: ${formatCurrency(totalAmount)}`, 50);
    
    doc.moveDown(0.3);
    doc.fillColor('#228B22');
    doc.text(`Payé: ${formatCurrency(paidAmount)}`, 50);
    
    doc.moveDown(0.3);
    doc.fillColor('#000000');
    doc.moveTo(50, doc.y).lineTo(250, doc.y).stroke('#D4AF37');
    doc.moveDown(0.4);

    doc.fontSize(13).font('Helvetica-Bold');
    const remainingColor = remainingAmount > 0 ? '#DC143C' : '#228B22';
    doc.fillColor(remainingColor);
    doc.text(`Reste à payer: ${formatCurrency(remainingAmount)}`, 50);
    doc.font('Helvetica').fillColor('#000000');

    // ===== PAYMENTS HISTORY =====
    if (booking.payments && booking.payments.length > 0) {
      doc.moveDown(2);
      doc.fontSize(12).font('Helvetica-Bold').text('Historique des paiements', { underline: true });
      doc.font('Helvetica');
      doc.moveDown(0.5);

      // Payments table header
      const payTableTop = doc.y;
      doc.rect(50, payTableTop, 495, 20).fill('#D4AF37');
      doc.fillColor('#FFFFFF');

      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('Date', 60, payTableTop + 5);
      doc.text('Montant', 180, payTableTop + 5);
      doc.text('Méthode', 300, payTableTop + 5);
      doc.text('Référence', 420, payTableTop + 5);

      doc.fillColor('#000000');
      doc.font('Helvetica');

      let payY = payTableTop + 25;
      booking.payments.forEach((payment: any, index: number) => {
        // Alternate row background
        if (index % 2 === 0) {
          doc.rect(50, payY - 3, 495, 18).fill('#FDF8F0');
          doc.fillColor('#000000');
        }
        doc.fontSize(9);
        doc.text(formatDate(payment.payment_date), 60, payY);
        doc.fillColor('#228B22').text(formatCurrency(payment.amount), 180, payY);
        doc.fillColor('#000000').text(paymentMethodFr[payment.payment_method] || payment.payment_method || '-', 300, payY);
        doc.text(payment.reference_number || '-', 420, payY);
        payY += 18;
      });

      doc.rect(50, payTableTop, 495, payY - payTableTop + 5).stroke('#D4AF37');
    }

    // ===== FOOTER =====
    doc.moveDown(3);
    doc.fontSize(10).fillColor('#666666');
    if (agency?.invoice_footer && entitlements?.features.white_label) {
      doc.text(agency.invoice_footer, { align: 'center' });
      doc.moveDown(0.4);
    }
    doc.text('Merci pour votre confiance !', { align: 'center' });
    if (showPoweredBy) {
      doc.moveDown(0.3);
      doc.fontSize(8).fillColor('#999999').text(`Powered by ${platformName}`, { align: 'center' });
    }
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#999999');
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'center' });

    doc.end();

  } catch (error: any) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: error.message });
  }
};

// Add invoice item (extra service or discount)
export const addInvoiceItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const { pilgrim_id, item_type, description, quantity, unit_price, extra_service_id } = req.body;

    // Verify booking belongs to agency
    const { data: booking } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { data, error } = await supabase
      .from('invoice_items')
      .insert({
        booking_id: id,
        pilgrim_id,
        item_type: item_type || 'service',
        description,
        quantity: quantity || 1,
        unit_price,
        extra_service_id
      })
      .select()
      .single();

    if (error) throw error;
    await recalcBookingTotals(id as string);
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete invoice item
export const deleteInvoiceItem = async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const agencyId = req.user?.agency_id;

    // Verify booking belongs to agency
    const { data: booking } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (booking.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot modify confirmed booking' });
    }

    const { error } = await supabase
      .from('invoice_items')
      .delete()
      .eq('id', itemId)
      .eq('booking_id', id);

    if (error) throw error;
    await recalcBookingTotals(id as string);
    res.json({ message: 'Item deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Soft delete booking with full rollback
export const softDeleteBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const userId = req.user?.id;
    const role = req.user?.role;
    const { deletion_password, reason } = req.body;

    // Only admins can delete bookings
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can delete bookings' });
    }

    // Verify deletion password
    if (!deletion_password) {
      return res.status(400).json({ error: 'Deletion password is required' });
    }

    const isValidPassword = await verifyDeletionPassword(userId!, deletion_password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid deletion password' });
    }

    // Verify booking exists and belongs to agency
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_number, status, deleted_at')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (bookingError) {
      console.error('Error fetching booking:', bookingError);
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if already deleted
    if (booking.deleted_at) {
      return res.status(400).json({ error: 'Booking is already deleted' });
    }

    // Check if booking is cancelled - must cancel before deleting
    if (booking.status !== 'cancelled') {
      return res.status(400).json({ 
        error: 'Booking must be cancelled before it can be deleted. Please cancel the booking first.',
        current_status: booking.status
      });
    }

    // Start rollback process
    console.log(`Starting soft delete for booking ${booking.booking_number}`);

    // 1. Delete bed allocations (triggers restore bed inventory)
    const { error: roomAllocError } = await supabase
      .from('booking_bed_allocations')
      .delete()
      .eq('booking_id', id);
    
    if (roomAllocError) {
      console.error('Error deleting bed allocations:', roomAllocError);
      // Don't throw - table might not exist or have records
    } else {
      console.log('Deleted bed allocations for booking');
    }

    // 2. Delete flight allocations (triggers restore flight inventory)
    const { error: flightAllocError } = await supabase
      .from('booking_flight_allocations')
      .delete()
      .eq('booking_id', id);
    
    if (flightAllocError) {
      console.error('Error deleting flight allocations:', flightAllocError);
      // Don't throw - table might not exist or have records
    } else {
      console.log('Deleted flight allocations for booking');
    }

    // 3. Delete room assignments
    const { error: roomAssignError } = await supabase
      .from('room_assignments')
      .delete()
      .eq('booking_id', id);
    
    if (roomAssignError) {
      console.error('Error deleting room assignments:', roomAssignError);
    } else {
      console.log('Deleted room assignments for booking');
    }

    // 4. Delete invoice items
    const { error: invoiceError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('booking_id', id);
    
    if (invoiceError) {
      console.error('Error deleting invoice items:', invoiceError);
    } else {
      console.log('Deleted invoice items for booking');
    }

    // 5. Delete payments
    const { error: paymentsError } = await supabase
      .from('payments')
      .delete()
      .eq('booking_id', id);
    
    if (paymentsError) {
      console.error('Error deleting payments:', paymentsError);
    } else {
      console.log('Deleted payments for booking');
    }

    // 6. Unlink pilgrims from booking (set booking_id to NULL)
    const { error: pilgrimsError } = await supabase
      .from('pilgrims')
      .update({ booking_id: null })
      .eq('booking_id', id);
    
    if (pilgrimsError) {
      console.error('Error unlinking pilgrims:', pilgrimsError);
    } else {
      console.log('Unlinked pilgrims from booking');
    }

    // 7. Soft delete the booking
    const { data: deletedBooking, error: deleteError } = await supabase
      .from('bookings')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_reason: reason || null,
        status: 'cancelled'
      })
      .eq('id', id)
      .select()
      .single();

    if (deleteError) {
      console.error('Error soft deleting booking:', deleteError);
      throw deleteError;
    }

    console.log(`Successfully soft deleted booking ${booking.booking_number}`);

    res.json({
      message: 'Booking deleted successfully',
      booking: deletedBooking
    });
  } catch (error: any) {
    console.error('Error in softDeleteBooking:', error);
    res.status(500).json({ error: error.message });
  }
};

// Permanently delete a soft-deleted booking (admin only)
export const permanentDeleteBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const userId = req.user?.id;
    const role = req.user?.role;
    const { deletion_password } = req.body;

    // Only admins can permanently delete bookings
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can permanently delete bookings' });
    }

    // Verify deletion password
    if (!deletion_password) {
      return res.status(400).json({ error: 'Deletion password is required' });
    }

    const isValidPassword = await verifyDeletionPassword(userId!, deletion_password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid deletion password' });
    }

    // Verify booking exists, belongs to agency, and is already soft-deleted
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_number, deleted_at')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Must be soft-deleted first
    if (!booking.deleted_at) {
      return res.status(400).json({ 
        error: 'Booking must be soft-deleted before it can be permanently deleted'
      });
    }

    console.log(`Starting permanent delete for booking ${booking.booking_number}`);

    // Permanently delete the booking (cascades will handle related records)
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error permanently deleting booking:', deleteError);
      throw deleteError;
    }

    console.log(`Successfully permanently deleted booking ${booking.booking_number}`);

    res.json({
      message: 'Booking permanently deleted',
      booking_number: booking.booking_number
    });
  } catch (error: any) {
    console.error('Error in permanentDeleteBooking:', error);
    res.status(500).json({ error: error.message });
  }
};

// =============================================
// 24-Hour Booking Hold Functions
// =============================================

// Expire booking holds - called by scheduled job
export const expireBookingHolds = async (req: Request, res: Response) => {
  console.log('[Bookings] expireBookingHolds called');
  
  try {
    // Find all draft bookings with expired holds
    const { data: expiredBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, booking_number, hold_session_id')
      .eq('status', 'draft')
      .not('hold_expires_at', 'is', null)
      .lt('hold_expires_at', new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!expiredBookings || expiredBookings.length === 0) {
      return res.json({
        message: 'No expired booking holds found',
        expired_count: 0,
        expired_bookings: []
      });
    }

    const expiredBookingNumbers: string[] = [];

    // Expire each booking
    for (const booking of expiredBookings) {
      // Delete associated locks
      await supabase
        .from('booking_locks')
        .delete()
        .eq('booking_id', booking.id);

      // Update booking status to expired
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'expired',
          hold_expires_at: null,
          hold_session_id: null
        })
        .eq('id', booking.id);

      if (!updateError) {
        expiredBookingNumbers.push(booking.booking_number);
      }
    }

    // Also cleanup any orphaned expired locks
    await supabase
      .from('booking_locks')
      .delete()
      .lt('expires_at', new Date().toISOString());

    console.log(`[Bookings] Expired ${expiredBookingNumbers.length} booking holds`);

    res.json({
      message: `Expired ${expiredBookingNumbers.length} booking holds`,
      expired_count: expiredBookingNumbers.length,
      expired_bookings: expiredBookingNumbers
    });
  } catch (error: any) {
    console.error('Error expiring booking holds:', error);
    res.status(500).json({ error: error.message });
  }
};

// Extend booking hold period
export const extendBookingHold = async (req: Request, res: Response) => {
  const { id } = req.params;
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const { extend_hours = 24 } = req.body;

  console.log(`[Bookings] extendBookingHold called for booking ${id}`);

  try {
    // Verify booking exists and is in draft status
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status, hold_expires_at, hold_session_id')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (fetchError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'draft') {
      return res.status(400).json({ error: 'Can only extend hold for draft bookings' });
    }

    // Calculate new expiration time
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + extend_hours);

    // Update booking hold expiration
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        hold_expires_at: newExpiresAt.toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update associated locks
    if (booking.hold_session_id) {
      await supabase
        .from('booking_locks')
        .update({
          expires_at: newExpiresAt.toISOString()
        })
        .eq('booking_id', id);
    }

    console.log(`[Bookings] Extended hold for booking ${id} to ${newExpiresAt.toISOString()}`);

    res.json({
      message: 'Booking hold extended',
      booking_id: id,
      new_expires_at: newExpiresAt.toISOString(),
      hours_extended: extend_hours
    });
  } catch (error: any) {
    console.error('Error extending booking hold:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get booking hold status
export const getBookingHoldStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  try {
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, booking_number, status, hold_expires_at, hold_session_id')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (fetchError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Get associated locks
    const { data: locks } = await supabase
      .from('booking_locks')
      .select('id, resource_type, quantity, expires_at')
      .eq('booking_id', id);

    // Calculate hold status
    let holdStatus = 'none';
    let hoursRemaining: number | null = null;

    if (booking.hold_expires_at) {
      const expiresAt = new Date(booking.hold_expires_at);
      const now = new Date();
      const hoursLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursLeft <= 0) {
        holdStatus = 'expired';
        hoursRemaining = 0;
      } else if (hoursLeft <= 2) {
        holdStatus = 'expiring_soon';
        hoursRemaining = Math.round(hoursLeft * 10) / 10;
      } else {
        holdStatus = 'active';
        hoursRemaining = Math.round(hoursLeft * 10) / 10;
      }
    }

    res.json({
      booking_id: booking.id,
      booking_number: booking.booking_number,
      status: booking.status,
      hold_status: holdStatus,
      hold_expires_at: booking.hold_expires_at,
      hours_remaining: hoursRemaining,
      locks: locks || []
    });
  } catch (error: any) {
    console.error('Error getting booking hold status:', error);
    res.status(500).json({ error: error.message });
  }
};
