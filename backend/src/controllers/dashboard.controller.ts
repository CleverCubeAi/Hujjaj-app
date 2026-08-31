import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';

async function getBranchUserIds(branchId: string): Promise<string[]> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('branch_id', branchId);
  return data?.map((u: any) => u.id) || [];
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const EXCLUDED_REVENUE = new Set(['cancelled', 'expired', 'draft']);
const EXCLUDED_VOLUME = new Set(['cancelled', 'expired']);

function utcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function createdDateKey(createdAt: unknown): string {
  const d = toDate(createdAt);
  return d ? d.toISOString().slice(0, 10) : '';
}

function createdMonthKey(createdAt: unknown): string {
  return createdDateKey(createdAt).slice(0, 7);
}

function relatedCity(rel: any): string | null {
  if (!rel) return null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  return canonicalCity(row?.city);
}

function trendPct(curr: number, prev: number): number {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function canonicalCity(raw: string | null | undefined): string | null {
  const city = (raw || '').trim();
  if (!city) return null;
  const lower = city.toLowerCase();
  if (['makkah', 'mecca', 'makka', 'مكة', 'مكة المكرمة'].includes(lower)) return 'Makkah';
  if (['madinah', 'medina', 'madina', 'المدينة', 'المدينة المنورة'].includes(lower)) return 'Madinah';
  if (['jeddah', 'jidda', 'جدة'].includes(lower)) return 'Jeddah';
  return city;
}

function emptyStats(role: string | undefined, isFiltered: boolean) {
  return {
    pilgrims: { total: 0, male: 0, female: 0 },
    bookings: { total: 0, draft: 0, confirmed: 0, paid: 0, cancelled: 0 },
    financial: { totalAgreed: 0, totalPaid: 0, totalRemaining: 0, paymentPercentage: 0 },
    recentBookings: [],
    accommodations: [],
    flightsCount: 0,
    hotelsCount: 0,
    clientsCount: 0,
    weeklyBookings: [],
    monthlyBookings: [],
    yearlyBookings: [],
    monthlyRevenue: [],
    destinations: [],
    upcomingSeasons: [],
    trends: { bookings: 0, revenue: 0, clients: 0 },
    performance: {
      week: { total: 0, growth: 0 },
      month: { total: 0, growth: 0 },
      year: { total: 0, growth: 0 },
    },
    seasonRevenue: { total: 0, growth: 0 },
    inventory: { hotel: { totalBeds: 0, soldBeds: 0, availableBeds: 0 }, flight: { totalSeats: 0, soldSeats: 0, availableSeats: 0 } },
    userRole: role,
    isFiltered,
  };
}

function countInRange(
  rows: Array<{ created_at: unknown }>,
  startKey: string,
  endKey: string,
  by: 'day' | 'month' = 'day',
): number {
  return rows.filter((row) => {
    const key = by === 'month' ? createdMonthKey(row.created_at) : createdDateKey(row.created_at);
    return key >= startKey && key <= endKey;
  }).length;
}

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const userId = req.user?.id;
    const role = req.user?.role;
    const userBranchId = req.user?.branch_id;

    if (!agencyId && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    let userIdsFilter: string[] | null = null;

    if (role === 'agent') {
      userIdsFilter = userId ? [userId] : [];
    } else if (role === 'manager' && userBranchId) {
      userIdsFilter = await getBranchUserIds(userBranchId);
    }

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
        client_id,
        season_id,
        accommodation_id,
        hotel_inventory_ids,
        clients (full_name, full_name_ar),
        pilgrims (id, gender),
        seasons (name, type),
        accommodations (city)
      `)
      .forAgency(agencyId)
      .is('deleted_at', null);

    if (userIdsFilter !== null) {
      if (userIdsFilter.length > 0) {
        bookingsQuery = bookingsQuery.in('created_by', userIdsFilter);
      } else {
        return res.json(emptyStats(role, true));
      }
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery;
    if (bookingsError) throw bookingsError;

    const allBookings = bookings || [];
    const volumeBookings = allBookings.filter((b: any) => !EXCLUDED_VOLUME.has(b.status));
    const revenueBookings = allBookings.filter((b: any) => !EXCLUDED_REVENUE.has(b.status));

    let totalPilgrims = 0;
    let malePilgrims = 0;
    let femalePilgrims = 0;

    volumeBookings.forEach((booking: any) => {
      if (booking.pilgrims) {
        totalPilgrims += booking.pilgrims.length;
        booking.pilgrims.forEach((p: any) => {
          if (p.gender === 'male') malePilgrims++;
          else if (p.gender === 'female') femalePilgrims++;
        });
      }
    });

    const bookingStats = {
      total: allBookings.length,
      draft: allBookings.filter((b: any) => b.status === 'draft').length,
      confirmed: allBookings.filter((b: any) => b.status === 'confirmed').length,
      paid: allBookings.filter((b: any) => b.status === 'paid').length,
      cancelled: allBookings.filter((b: any) => b.status === 'cancelled').length,
    };

    const totalAgreed = revenueBookings.reduce((sum: number, b: any) => sum + num(b.total_amount), 0);
    const totalPaid = revenueBookings.reduce((sum: number, b: any) => sum + num(b.paid_amount), 0);
    const totalRemaining = totalAgreed - totalPaid;

    const recentBookings = [...allBookings]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
      }));

    const today = utcDay();

    const weeklyBookings = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - (6 - i));
      const key = dateKey(d);
      const count = volumeBookings.filter((b: any) => createdDateKey(b.created_at) === key).length;
      return { date: key, weekday: d.getUTCDay(), count };
    });

    const weekStart = weeklyBookings[0].date;
    const weekEnd = weeklyBookings[6].date;
    const prevWeekStartDate = new Date(today);
    prevWeekStartDate.setUTCDate(prevWeekStartDate.getUTCDate() - 13);
    const prevWeekEndDate = new Date(today);
    prevWeekEndDate.setUTCDate(prevWeekEndDate.getUTCDate() - 7);
    const weekTotal = weeklyBookings.reduce((s, d) => s + d.count, 0);
    const lastWeekTotal = countInRange(volumeBookings, dateKey(prevWeekStartDate), dateKey(prevWeekEndDate));

    const monthlyBookings = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - (29 - i));
      const key = dateKey(d);
      const count = volumeBookings.filter((b: any) => createdDateKey(b.created_at) === key).length;
      return { date: key, count };
    });
    const monthStart = monthlyBookings[0].date;
    const monthEnd = monthlyBookings[29].date;
    const prevMonthStartDate = new Date(today);
    prevMonthStartDate.setUTCDate(prevMonthStartDate.getUTCDate() - 59);
    const prevMonthEndDate = new Date(today);
    prevMonthEndDate.setUTCDate(prevMonthEndDate.getUTCDate() - 30);
    const monthTotal = monthlyBookings.reduce((s, d) => s + d.count, 0);
    const lastMonthPeriodTotal = countInRange(volumeBookings, dateKey(prevMonthStartDate), dateKey(prevMonthEndDate));

    const yearlyBookings = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (11 - i), 1));
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const count = volumeBookings.filter((b: any) => createdMonthKey(b.created_at) === ym).length;
      return { month: ym, count };
    });
    const yearStart = yearlyBookings[0].month;
    const yearEnd = yearlyBookings[11].month;
    const prevYearStartDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 23, 1));
    const prevYearEndDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 12, 1));
    const prevYearStart = `${prevYearStartDate.getUTCFullYear()}-${String(prevYearStartDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const prevYearEnd = `${prevYearEndDate.getUTCFullYear()}-${String(prevYearEndDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const yearTotal = yearlyBookings.reduce((s, d) => s + d.count, 0);
    const lastYearTotal = countInRange(volumeBookings, prevYearStart, prevYearEnd, 'month');

    const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (5 - i), 1));
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const amount = revenueBookings
        .filter((b: any) => createdMonthKey(b.created_at) === ym)
        .reduce((sum: number, b: any) => sum + num(b.total_amount), 0);
      return { month: ym, amount };
    });

    const thisMonthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const lastMonthKey = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const thisMonthCount = volumeBookings.filter((b: any) => createdMonthKey(b.created_at) === thisMonthKey).length;
    const lastMonthCount = volumeBookings.filter((b: any) => createdMonthKey(b.created_at) === lastMonthKey).length;
    const thisMonthRevenue = revenueBookings
      .filter((b: any) => createdMonthKey(b.created_at) === thisMonthKey)
      .reduce((s: number, b: any) => s + num(b.total_amount), 0);
    const lastMonthRevenue = revenueBookings
      .filter((b: any) => createdMonthKey(b.created_at) === lastMonthKey)
      .reduce((s: number, b: any) => s + num(b.total_amount), 0);

    const { data: accommodations, count: hotelsCount } = await supabase
      .from('accommodations')
      .select('id, city', { count: 'exact' })
      .forAgency(agencyId);

    const { count: flightsCount } = await supabase
      .from('flights')
      .select('id', { count: 'exact', head: true })
      .forAgency(agencyId);

    const { data: hotelInventory } = await supabase
      .from('hotel_bed_inventory')
      .select('id, accommodation_id, beds_purchased, beds_sold, beds_available, accommodations (city)')
      .forAgency(agencyId);

    const { data: flightInventory } = await supabase
      .from('flight_seat_inventory')
      .select('seats_purchased, seats_sold, seats_available')
      .forAgency(agencyId);

    const inventoryStats = {
      hotel: {
        totalBeds: hotelInventory?.reduce((sum: number, i: any) => sum + num(i.beds_purchased), 0) || 0,
        soldBeds: hotelInventory?.reduce((sum: number, i: any) => sum + num(i.beds_sold), 0) || 0,
        availableBeds: hotelInventory?.reduce((sum: number, i: any) => sum + num(i.beds_available), 0) || 0,
      },
      flight: {
        totalSeats: flightInventory?.reduce((sum: number, i: any) => sum + num(i.seats_purchased), 0) || 0,
        soldSeats: flightInventory?.reduce((sum: number, i: any) => sum + num(i.seats_sold), 0) || 0,
        availableSeats: flightInventory?.reduce((sum: number, i: any) => sum + num(i.seats_available), 0) || 0,
      },
    };

    const { data: clientRows, count: clientsCount } = await supabase
      .from('clients')
      .select('created_at', { count: 'exact' })
      .forAgency(agencyId);

    const thisMonthClients = (clientRows || []).filter((c: any) => createdMonthKey(c.created_at) === thisMonthKey).length;
    const lastMonthClients = (clientRows || []).filter((c: any) => createdMonthKey(c.created_at) === lastMonthKey).length;

    const { data: seasons } = await supabase
      .from('seasons')
      .select('id, name, type, start_date, end_date, status')
      .forAgency(agencyId)
      .order('start_date', { ascending: true })
      .limit(12);

    const todayKey = dateKey(today);
    const upcomingSeasons = (seasons || [])
      .filter((s: any) => {
        const end = createdDateKey(s.end_date);
        return !end || end >= todayKey;
      })
      .slice(0, 4);

    const invCity = new Map<string, string>();
    (hotelInventory || []).forEach((inv: any) => {
      const city = relatedCity(inv.accommodations);
      if (inv.id && city) invCity.set(String(inv.id), city);
    });

    const cityCounts: Record<string, number> = {};
    volumeBookings.forEach((booking: any) => {
      const cities = new Set<string>();
      const ids = Array.isArray(booking.hotel_inventory_ids)
        ? booking.hotel_inventory_ids
        : typeof booking.hotel_inventory_ids === 'string'
          ? String(booking.hotel_inventory_ids).replace(/[{}]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];
      ids.forEach((id: string) => {
        const city = invCity.get(String(id));
        if (city) cities.add(city);
      });
      if (cities.size === 0) {
        const city = relatedCity(booking.accommodations);
        if (city) cities.add(city);
      }
      cities.forEach((city) => {
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      });
    });

    let destinations = Object.entries(cityCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    if (destinations.length === 0) {
      const catalogCounts: Record<string, number> = {};
      (accommodations || []).forEach((a: any) => {
        const city = canonicalCity(a.city) || 'other';
        catalogCounts[city] = (catalogCounts[city] || 0) + 1;
      });
      destinations = Object.entries(catalogCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    }

    const seasonRevenueTotal = monthlyRevenue.reduce((s, m) => s + m.amount, 0);
    const lastMonthBar = monthlyRevenue[monthlyRevenue.length - 1]?.amount || 0;
    const prevMonthBar = monthlyRevenue[monthlyRevenue.length - 2]?.amount || 0;

    res.json({
      pilgrims: {
        total: totalPilgrims,
        male: malePilgrims,
        female: femalePilgrims,
      },
      bookings: bookingStats,
      financial: {
        totalAgreed,
        totalPaid,
        totalRemaining,
        paymentPercentage: totalAgreed > 0 ? Math.round((totalPaid / totalAgreed) * 100) : 0,
      },
      recentBookings,
      accommodations: accommodations || [],
      flightsCount: flightsCount || 0,
      hotelsCount: hotelsCount || 0,
      clientsCount: clientsCount || 0,
      inventory: inventoryStats,
      weeklyBookings,
      monthlyBookings,
      yearlyBookings,
      monthlyRevenue,
      destinations,
      upcomingSeasons,
      trends: {
        bookings: trendPct(thisMonthCount, lastMonthCount),
        revenue: trendPct(thisMonthRevenue, lastMonthRevenue),
        clients: trendPct(thisMonthClients, lastMonthClients),
      },
      performance: {
        week: { total: weekTotal, growth: trendPct(weekTotal, lastWeekTotal), from: weekStart, to: weekEnd },
        month: { total: monthTotal, growth: trendPct(monthTotal, lastMonthPeriodTotal), from: monthStart, to: monthEnd },
        year: { total: yearTotal, growth: trendPct(yearTotal, lastYearTotal), from: yearStart, to: yearEnd },
      },
      seasonRevenue: {
        total: seasonRevenueTotal,
        growth: trendPct(lastMonthBar, prevMonthBar),
      },
      userRole: role,
      isFiltered: userIdsFilter !== null,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
};
