import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';

// Helper function to get user IDs in a branch
async function getBranchUserIds(branchId: string): Promise<string[]> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('branch_id', branchId);
  return data?.map((u: any) => u.id) || [];
}

// Get dashboard statistics with role-based filtering
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const userId = req.user?.id;
    const role = req.user?.role;
    const userBranchId = req.user?.branch_id;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Determine user IDs for filtering based on role
    let userIdsFilter: string[] | null = null;
    const isAdmin = role === 'agency_admin' || role === 'super_admin';
    
    if (role === 'agent') {
      // Agent sees only their own data
      userIdsFilter = userId ? [userId] : [];
    } else if (role === 'manager' && userBranchId) {
      // Manager sees branch data
      userIdsFilter = await getBranchUserIds(userBranchId);
    }
    // Admin sees all (userIdsFilter stays null)

    // 1. Get bookings with role-based filtering
    let bookingsQuery = supabase
      .from('bookings')
      .select(`
        id,
        booking_number,
        total_amount,
        paid_amount,
        status,
        created_at,
        created_by,
        clients (full_name, full_name_ar),
        pilgrims (id, gender)
      `)
      .eq('agency_id', agencyId)
      .is('deleted_at', null);

    if (userIdsFilter !== null) {
      if (userIdsFilter.length > 0) {
        bookingsQuery = bookingsQuery.in('created_by', userIdsFilter);
      } else {
        // No matching users, return empty stats
        return res.json({
          pilgrims: { total: 0, male: 0, female: 0 },
          bookings: { total: 0, draft: 0, confirmed: 0, paid: 0, cancelled: 0 },
          financial: { totalAgreed: 0, totalPaid: 0, totalRemaining: 0 },
          recentBookings: [],
          accommodations: []
        });
      }
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery;
    if (bookingsError) throw bookingsError;

    // Calculate pilgrim stats from bookings
    let totalPilgrims = 0;
    let malePilgrims = 0;
    let femalePilgrims = 0;

    bookings?.forEach((booking: any) => {
      if (booking.pilgrims) {
        totalPilgrims += booking.pilgrims.length;
        booking.pilgrims.forEach((p: any) => {
          if (p.gender === 'male') malePilgrims++;
          else if (p.gender === 'female') femalePilgrims++;
        });
      }
    });

    // Calculate booking stats
    const bookingStats = {
      total: bookings?.length || 0,
      draft: bookings?.filter((b: any) => b.status === 'draft').length || 0,
      confirmed: bookings?.filter((b: any) => b.status === 'confirmed').length || 0,
      paid: bookings?.filter((b: any) => b.status === 'paid').length || 0,
      cancelled: bookings?.filter((b: any) => b.status === 'cancelled').length || 0
    };

    // Calculate financial stats (pg returns NUMERIC as strings — coerce before summing)
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const totalAgreed = bookings?.reduce((sum: number, b: any) => sum + num(b.total_amount), 0) || 0;
    const totalPaid = bookings?.reduce((sum: number, b: any) => sum + num(b.paid_amount), 0) || 0;
    const totalRemaining = totalAgreed - totalPaid;

    // Get recent bookings (last 5)
    const recentBookings = bookings
      ?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((b: any) => ({
        id: b.id,
        booking_number: b.booking_number,
        client_name: b.clients?.full_name_ar || b.clients?.full_name || '-',
        total_amount: num(b.total_amount),
        paid_amount: num(b.paid_amount),
        status: b.status,
        pilgrims_count: b.pilgrims?.length || 0,
        created_at: b.created_at
      })) || [];

    // 2. Get accommodations (agency-wide - all users can see)
    const { data: accommodations } = await supabase
      .from('accommodations')
      .select(`
        id,
        name,
        name_ar,
        city,
        room_types (id, type, total_beds, total_rooms)
      `)
      .eq('agency_id', agencyId)
      .limit(10);

    // 3. Get flights count (agency-wide)
    const { data: flights } = await supabase
      .from('flights')
      .select('id')
      .eq('agency_id', agencyId);

    // 4. Get inventory stats (agency-wide)
    const { data: hotelInventory } = await supabase
      .from('hotel_bed_inventory')
      .select('beds_purchased, beds_sold, beds_available')
      .eq('agency_id', agencyId);

    const { data: flightInventory } = await supabase
      .from('flight_seat_inventory')
      .select('seats_purchased, seats_sold, seats_available')
      .eq('agency_id', agencyId);

    const inventoryStats = {
      hotel: {
        totalBeds: hotelInventory?.reduce((sum: number, i: any) => sum + num(i.beds_purchased), 0) || 0,
        soldBeds: hotelInventory?.reduce((sum: number, i: any) => sum + num(i.beds_sold), 0) || 0,
        availableBeds: hotelInventory?.reduce((sum: number, i: any) => sum + num(i.beds_available), 0) || 0
      },
      flight: {
        totalSeats: flightInventory?.reduce((sum: number, i: any) => sum + num(i.seats_purchased), 0) || 0,
        soldSeats: flightInventory?.reduce((sum: number, i: any) => sum + num(i.seats_sold), 0) || 0,
        availableSeats: flightInventory?.reduce((sum: number, i: any) => sum + num(i.seats_available), 0) || 0
      }
    };

    res.json({
      pilgrims: {
        total: totalPilgrims,
        male: malePilgrims,
        female: femalePilgrims
      },
      bookings: bookingStats,
      financial: {
        totalAgreed,
        totalPaid,
        totalRemaining,
        paymentPercentage: totalAgreed > 0 ? Math.round((totalPaid / totalAgreed) * 100) : 0
      },
      recentBookings,
      accommodations: accommodations || [],
      flightsCount: flights?.length || 0,
      inventory: inventoryStats,
      userRole: role,
      isFiltered: userIdsFilter !== null
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
};
