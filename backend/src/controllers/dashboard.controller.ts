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
        pilgrims (id, gender),
        seasons (name, type)
      `)
      .forAgency(agencyId)
      .is('deleted_at', null);

    if (userIdsFilter !== null) {
      if (userIdsFilter.length > 0) {
        bookingsQuery = bookingsQuery.in('created_by', userIdsFilter);
      } else {
        // No matching users, return empty stats
        return res.json({
          pilgrims: { total: 0, male: 0, female: 0 },
          bookings: { total: 0, draft: 0, confirmed: 0, paid: 0, cancelled: 0 },
          financial: { totalAgreed: 0, totalPaid: 0, totalRemaining: 0, paymentPercentage: 0 },
          recentBookings: [],
          accommodations: [],
          flightsCount: 0,
          hotelsCount: 0,
          clientsCount: 0,
          weeklyBookings: [],
          monthlyRevenue: [],
          destinations: [],
          upcomingSeasons: [],
          trends: { bookings: 0, revenue: 0, clients: 0 },
          inventory: { hotel: { totalBeds: 0, soldBeds: 0, availableBeds: 0 }, flight: { totalSeats: 0, soldSeats: 0, availableSeats: 0 } },
          userRole: role,
          isFiltered: true,
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

    // Get recent bookings (last 8)
    const recentBookings = bookings
      ?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)
      .map((b: any) => ({
        id: b.id,
        booking_number: b.booking_number,
        client_name: b.clients?.full_name_ar || b.clients?.full_name || '-',
        total_amount: num(b.total_amount),
        paid_amount: num(b.paid_amount),
        status: b.status,
        pilgrims_count: b.pilgrims?.length || 0,
        created_at: b.created_at,
        season_name: b.seasons?.name || null,
        season_type: b.seasons?.type || null,
      })) || [];

    const weekdayKey = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const weeklyBookings = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      const key = weekdayKey(d);
      const count = bookings?.filter((b: any) => String(b.created_at).slice(0, 10) === key).length || 0;
      return { date: key, weekday: d.getDay(), count };
    });

    const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (5 - i));
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amount = bookings
        ?.filter((b: any) => String(b.created_at).slice(0, 7) === ym)
        .reduce((sum: number, b: any) => sum + num(b.total_amount), 0) || 0;
      return { month: ym, amount };
    });

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthCount = bookings?.filter((b: any) => String(b.created_at).slice(0, 7) === thisMonthKey).length || 0;
    const lastMonthCount = bookings?.filter((b: any) => String(b.created_at).slice(0, 7) === lastMonthKey).length || 0;
    const thisMonthRevenue = bookings?.filter((b: any) => String(b.created_at).slice(0, 7) === thisMonthKey).reduce((s: number, b: any) => s + num(b.total_amount), 0) || 0;
    const lastMonthRevenue = bookings?.filter((b: any) => String(b.created_at).slice(0, 7) === lastMonthKey).reduce((s: number, b: any) => s + num(b.total_amount), 0) || 0;
    const trendPct = (curr: number, prev: number) => {
      if (prev <= 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

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
      .forAgency(agencyId)
      .limit(10);

    // 3. Get flights count (agency-wide)
    const { data: flights } = await supabase
      .from('flights')
      .select('id')
      .forAgency(agencyId);

    // 4. Get inventory stats (agency-wide)
    const { data: hotelInventory } = await supabase
      .from('hotel_bed_inventory')
      .select('beds_purchased, beds_sold, beds_available')
      .forAgency(agencyId);

    const { data: flightInventory } = await supabase
      .from('flight_seat_inventory')
      .select('seats_purchased, seats_sold, seats_available')
      .forAgency(agencyId);

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

    const { count: clientsCount } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .forAgency(agencyId);

    const { data: seasons } = await supabase
      .from('seasons')
      .select('id, name, type, start_date, end_date, status')
      .forAgency(agencyId)
      .order('start_date', { ascending: true })
      .limit(12);

    const today = weekdayKey(new Date());
    const upcomingSeasons = (seasons || [])
      .filter((s: any) => !s.end_date || String(s.end_date).slice(0, 10) >= today)
      .slice(0, 4);

    const cityCounts: Record<string, number> = {};
    (accommodations || []).forEach((a: any) => {
      const city = (a.city || '').trim() || 'other';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });
    const destinations = Object.entries(cityCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

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
      hotelsCount: accommodations?.length || 0,
      clientsCount: clientsCount || 0,
      inventory: inventoryStats,
      weeklyBookings,
      monthlyRevenue,
      destinations,
      upcomingSeasons,
      trends: {
        bookings: trendPct(thisMonthCount, lastMonthCount),
        revenue: trendPct(thisMonthRevenue, lastMonthRevenue),
        clients: trendPct(thisMonthCount, lastMonthCount),
      },
      userRole: role,
      isFiltered: userIdsFilter !== null
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
};
