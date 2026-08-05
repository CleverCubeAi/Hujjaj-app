import { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import path from 'path';

// Arabic text reshaper for proper rendering
const arabicReshaper = require('arabic-reshaper');

// Path to Arabic fonts
const AMIRI_REGULAR = path.join(__dirname, '../assets/fonts/Amiri-Regular.ttf');
const AMIRI_BOLD = path.join(__dirname, '../assets/fonts/Amiri-Bold.ttf');

/** pg returns NUMERIC as strings — always coerce before arithmetic */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

// Helper function to get user IDs in a branch
async function getBranchUserIds(branchId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('branch_id', branchId);
  return data?.map((u: any) => u.id) || [];
}

export const getReports = async (req: Request, res: Response) => {
  console.log('[Reports] getReports called');
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const role = req.user?.role;
  const userBranchId = req.user?.branch_id;
  const { season_id, date_from, date_to } = req.query;

  console.log('[Reports] agencyId:', agencyId, 'query:', { season_id, date_from, date_to });

  if (!agencyId) {
    console.log('[Reports] No agency ID found');
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  try {
    // Get user IDs for filtering based on role
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

    // Financial Summary
    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('id, total_amount, paid_amount, status, created_at, created_by, invoice_items (total_price, quantity, unit_price), payments (amount)')
      .eq('agency_id', agencyId)
      .is('deleted_at', null);

    // Apply role-based filter
    if (userIdsFilter !== null) {
      if (userIdsFilter.length > 0) {
        bookingsQuery = bookingsQuery.in('created_by', userIdsFilter);
      } else {
        // No matching users, return empty results
        return res.json({
          financial: { total_revenue: 0, total_received: 0, total_pending: 0, bookings_count: 0, average_booking_value: 0 },
          bookings: { by_status: [], by_season: [], recent: [] },
          pilgrims: { total: 0, by_gender: { male: 0, female: 0 }, by_status: [] },
          accommodations: { total_rooms: 0, occupied_rooms: 0, occupancy_rate: 0, by_hotel: [] },
          flights: { total: 0, direct: 0, indirect: 0, by_season: [] }
        });
      }
    }

    if (season_id) bookingsQuery = bookingsQuery.eq('season_id', season_id);
    if (date_from) bookingsQuery = bookingsQuery.gte('created_at', date_from as string);
    if (date_to) bookingsQuery = bookingsQuery.lte('created_at', date_to as string);

    const { data: bookings, error: bookingsError } = await bookingsQuery;

    if (bookingsError) throw bookingsError;

    // Financial totals — only confirmed/paid bookings, calculated from invoice_items & payments
    const activeBookings = bookings?.filter((b: any) => b.status === 'confirmed' || b.status === 'paid') || [];
    const total_revenue = activeBookings.reduce((sum: number, b: any) => {
      const itemsTotal = (b.invoice_items || []).reduce((s: number, i: any) => s + (i.total_price != null ? num(i.total_price) : (num(i.quantity) * num(i.unit_price))), 0);
      return sum + (itemsTotal > 0 ? itemsTotal : (b.total_amount || 0));
    }, 0);
    const total_received = activeBookings.reduce((sum: number, b: any) => {
      const paymentsTotal = (b.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      return sum + (paymentsTotal > 0 ? paymentsTotal : (b.paid_amount || 0));
    }, 0);
    const total_pending = total_revenue - total_received;
    const bookings_count = activeBookings.length;
    const average_booking_value = bookings_count > 0 ? total_revenue / bookings_count : 0;

    // Bookings by Status
    const bookingsByStatus = bookings?.reduce((acc: any, b) => {
      const status = b.status || 'draft';
      if (!acc[status]) acc[status] = { status, count: 0, total: 0 };
      acc[status].count++;
      acc[status].total += num(b.total_amount);
      return acc;
    }, {}) || {};

    // Bookings by Season
    let bookingsBySeasonQuery = supabaseAdmin
      .from('bookings')
      .select('season_id, total_amount, created_by, seasons (name)')
      .eq('agency_id', agencyId);

    // Apply role-based filter
    if (userIdsFilter !== null && userIdsFilter.length > 0) {
      bookingsBySeasonQuery = bookingsBySeasonQuery.in('created_by', userIdsFilter);
    }

    if (date_from) bookingsBySeasonQuery = bookingsBySeasonQuery.gte('created_at', date_from as string);
    if (date_to) bookingsBySeasonQuery = bookingsBySeasonQuery.lte('created_at', date_to as string);

    const { data: bookingsWithSeasons } = await bookingsBySeasonQuery;
    const bookingsBySeason = bookingsWithSeasons?.reduce((acc: any, b: any) => {
      const seasonName = b.seasons?.name || 'بدون موسم';
      if (!acc[seasonName]) acc[seasonName] = { season_name: seasonName, count: 0, total: 0 };
      acc[seasonName].count++;
      acc[seasonName].total += num(b.total_amount);
      return acc;
    }, {}) || {};

    // Recent Bookings
    let recentBookingsQuery = supabaseAdmin
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
        creator:users!bookings_created_by_fkey (id, full_name)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Apply role-based filter
    if (userIdsFilter !== null && userIdsFilter.length > 0) {
      recentBookingsQuery = recentBookingsQuery.in('created_by', userIdsFilter);
    }

    if (season_id) recentBookingsQuery = recentBookingsQuery.eq('season_id', season_id);
    if (date_from) recentBookingsQuery = recentBookingsQuery.gte('created_at', date_from as string);
    if (date_to) recentBookingsQuery = recentBookingsQuery.lte('created_at', date_to as string);

    const { data: recentBookings } = await recentBookingsQuery;

    // Pilgrims Summary
    let pilgrimsQuery = supabaseAdmin
      .from('pilgrims')
      .select('gender, status')
      .eq('agency_id', agencyId);

    if (season_id) {
      // Get pilgrims from bookings in this season
      const { data: seasonBookings } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('season_id', season_id);
      
      if (seasonBookings && seasonBookings.length > 0) {
        pilgrimsQuery = pilgrimsQuery.in('booking_id', seasonBookings.map(b => b.id));
      } else {
        pilgrimsQuery = pilgrimsQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // No results
      }
    }

    const { data: pilgrims } = await pilgrimsQuery;

    const pilgrimsByGender = {
      male: pilgrims?.filter(p => p.gender === 'male').length || 0,
      female: pilgrims?.filter(p => p.gender === 'female').length || 0
    };

    const pilgrimsByStatus = pilgrims?.reduce((acc: any, p) => {
      const status = p.status || 'active';
      if (!acc[status]) acc[status] = { status, count: 0 };
      acc[status].count++;
      return acc;
    }, {}) || {};

    // Accommodations Occupancy
    let accommodationsQuery = supabaseAdmin
      .from('accommodations')
      .select(`
        id,
        name,
        room_types (id, total_rooms, total_beds)
      `)
      .eq('agency_id', agencyId);

    const { data: accommodations } = await accommodationsQuery;

    let totalRooms = 0;
    let occupiedRooms = 0;
    const byHotel: any[] = [];

    for (const acc of accommodations || []) {
      const roomTypes = Array.isArray(acc.room_types) ? acc.room_types : [acc.room_types];
      let hotelRooms = 0;
      let hotelOccupied = 0;

      for (const rt of roomTypes) {
        if (!rt) continue;
        const rooms = rt.total_rooms || 0;
        hotelRooms += rooms;

        // Count occupied rooms for this room type
        const { data: assignments } = await supabaseAdmin
          .from('room_assignments')
          .select('room_number', { count: 'exact' })
          .eq('accommodation_id', acc.id)
          .eq('room_type_id', rt.id);

        const uniqueRooms = new Set(assignments?.map(a => a.room_number) || []).size;
        hotelOccupied += uniqueRooms;
      }

      totalRooms += hotelRooms;
      occupiedRooms += hotelOccupied;
      byHotel.push({
        name: acc.name,
        occupied: hotelOccupied,
        total: hotelRooms
      });
    }

    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // Flights Summary
    let flightsQuery = supabaseAdmin
      .from('flights')
      .select('is_direct, season_id, seasons (name)')
      .eq('agency_id', agencyId);

    if (season_id) flightsQuery = flightsQuery.eq('season_id', season_id);

    const { data: flights } = await flightsQuery;

    const flightsBySeason = flights?.reduce((acc: any, f: any) => {
      const seasonName = f.seasons?.name || 'بدون موسم';
      if (!acc[seasonName]) acc[seasonName] = { season_name: seasonName, count: 0 };
      acc[seasonName].count++;
      return acc;
    }, {}) || {};

    const response = {
      financial: {
        total_revenue,
        total_received,
        total_pending,
        bookings_count,
        average_booking_value
      },
      bookings: {
        by_status: Object.values(bookingsByStatus),
        by_season: Object.values(bookingsBySeason),
        recent: recentBookings?.map((b: any) => ({
          id: b.id,
          booking_number: b.booking_number,
          client_name: b.clients?.full_name_ar || b.clients?.full_name || '-',
          total_amount: b.total_amount || 0,
          paid_amount: b.paid_amount || 0,
          status: b.status,
          created_at: b.created_at,
          created_by: b.creator?.full_name || '-'
        })) || []
      },
      pilgrims: {
        total: pilgrims?.length || 0,
        by_gender: pilgrimsByGender,
        by_status: Object.values(pilgrimsByStatus)
      },
      accommodations: {
        total_rooms: totalRooms,
        occupied_rooms: occupiedRooms,
        occupancy_rate: occupancyRate,
        by_hotel: byHotel
      },
      flights: {
        total: flights?.length || 0,
        direct: flights?.filter(f => f.is_direct).length || 0,
        indirect: flights?.filter(f => !f.is_direct).length || 0,
        by_season: Object.values(flightsBySeason)
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error generating reports:', error);
    res.status(500).json({ error: error.message });
  }
};

export const exportReport = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const role = req.user?.role;
  const userBranchId = req.user?.branch_id;
  const { format, tab, season_id, date_from, date_to } = req.query;

  console.log('[Reports] exportReport called', { format, tab, season_id, date_from, date_to });

  if (!agencyId) {
    return res.status(400).json({
      error: 'Agency ID required to export reports. Super admin is not tied to an agency.',
    });
  }

  if (!format || !['pdf', 'excel'].includes(format as string)) {
    return res.status(400).json({ error: 'Invalid format. Use "pdf" or "excel"' });
  }

  try {
    // Get user IDs for filtering based on role
    let userIdsFilter: string[] | null = null;
    
    if (role === 'agent') {
      userIdsFilter = userId ? [userId] : [];
    } else if (role === 'manager' && userBranchId) {
      userIdsFilter = await getBranchUserIds(userBranchId);
    }

    // Fetch report data based on tab
    const reportData = await fetchReportDataForExport(
      agencyId,
      tab as string || 'financial',
      userIdsFilter,
      season_id as string,
      date_from as string,
      date_to as string
    );

    // Get agency info for header
    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('name, name_ar, logo_url')
      .eq('id', agencyId)
      .single();

    const agencyName = agency?.name_ar || agency?.name || 'Agency Report';

    // Generate export based on format
    if (format === 'pdf') {
      await generatePDFExport(res, reportData, tab as string || 'financial', agencyName, {
        season_id: season_id as string,
        date_from: date_from as string,
        date_to: date_to as string
      });
    } else {
      await generateExcelExport(res, reportData, tab as string || 'financial', agencyName, {
        season_id: season_id as string,
        date_from: date_from as string,
        date_to: date_to as string
      });
    }
  } catch (error: any) {
    console.error('Error exporting report:', error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to fetch report data for export
async function fetchReportDataForExport(
  agencyId: string,
  tab: string,
  userIdsFilter: string[] | null,
  season_id?: string,
  date_from?: string,
  date_to?: string
) {
  const data: any = {};

  // Financial Tab
  if (tab === 'financial' || tab === 'all') {
    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('total_amount, paid_amount, status, created_at, created_by')
      .eq('agency_id', agencyId);

    if (userIdsFilter !== null && userIdsFilter.length > 0) {
      bookingsQuery = bookingsQuery.in('created_by', userIdsFilter);
    }
    if (season_id) bookingsQuery = bookingsQuery.eq('season_id', season_id);
    if (date_from) bookingsQuery = bookingsQuery.gte('created_at', date_from);
    if (date_to) bookingsQuery = bookingsQuery.lte('created_at', date_to);

    const { data: bookings } = await bookingsQuery;

    const total_revenue = bookings?.reduce((sum, b) => sum + num(b.total_amount), 0) || 0;
    const total_received = bookings?.reduce((sum, b) => sum + num(b.paid_amount), 0) || 0;
    const total_pending = total_revenue - total_received;
    const bookings_count = bookings?.length || 0;
    const average_booking_value = bookings_count > 0 ? total_revenue / bookings_count : 0;

    // Bookings by status
    const bookingsByStatus = bookings?.reduce((acc: any, b) => {
      const status = b.status || 'draft';
      if (!acc[status]) acc[status] = { status, count: 0, total: 0 };
      acc[status].count++;
      acc[status].total += num(b.total_amount);
      return acc;
    }, {}) || {};

    data.financial = {
      total_revenue,
      total_received,
      total_pending,
      bookings_count,
      average_booking_value,
      by_status: Object.values(bookingsByStatus)
    };
  }

  // Financial Status Tab
  if (tab === 'financial-status' || tab === 'all') {
    // Sales from bookings
    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('id, booking_number, total_amount, paid_amount, status, created_at, clients (full_name, full_name_ar)')
      .eq('agency_id', agencyId)
      .is('deleted_at', null);

    if (userIdsFilter !== null && userIdsFilter.length > 0) {
      bookingsQuery = bookingsQuery.in('created_by', userIdsFilter);
    }
    if (season_id) bookingsQuery = bookingsQuery.eq('season_id', season_id);
    if (date_from) bookingsQuery = bookingsQuery.gte('created_at', date_from);
    if (date_to) bookingsQuery = bookingsQuery.lte('created_at', date_to);

    const { data: bookings } = await bookingsQuery;

    const totalSales = bookings?.reduce((sum, b) => sum + num(b.total_amount), 0) || 0;
    const totalReceived = bookings?.reduce((sum, b) => sum + num(b.paid_amount), 0) || 0;

    // Expenses
    let expensesQuery = supabaseAdmin
      .from('expenses')
      .select('id, category, description, amount, paid_date, expense_categories (name, name_ar)')
      .eq('agency_id', agencyId);

    if (season_id) expensesQuery = expensesQuery.eq('season_id', season_id);
    if (date_from) expensesQuery = expensesQuery.gte('paid_date', date_from);
    if (date_to) expensesQuery = expensesQuery.lte('paid_date', date_to);

    const { data: expenses } = await expensesQuery;
    const totalExpenses = expenses?.reduce((sum, e) => sum + num(e.amount), 0) || 0;

    data.financialStatus = {
      sales: {
        total: totalSales,
        received: totalReceived,
        pending: totalSales - totalReceived,
        details: bookings?.map((b: any) => ({
          booking_number: b.booking_number,
          client: b.clients?.full_name_ar || b.clients?.full_name || '-',
          total: b.total_amount || 0,
          paid: b.paid_amount || 0,
          remaining: (b.total_amount || 0) - (b.paid_amount || 0),
          status: b.status,
          date: b.created_at
        })) || []
      },
      expenses: {
        total: totalExpenses,
        details: expenses?.map((e: any) => ({
          category: e.expense_categories?.name_ar || e.expense_categories?.name || e.category || '-',
          description: e.description,
          amount: e.amount,
          date: e.paid_date
        })) || []
      },
      balance: totalReceived - totalExpenses
    };
  }

  // Bookings Tab
  if (tab === 'bookings' || tab === 'all') {
    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select(`
        id, booking_number, total_amount, paid_amount, status, created_at,
        clients (full_name, full_name_ar),
        seasons (name)
      `)
      .eq('agency_id', agencyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (userIdsFilter !== null && userIdsFilter.length > 0) {
      bookingsQuery = bookingsQuery.in('created_by', userIdsFilter);
    }
    if (season_id) bookingsQuery = bookingsQuery.eq('season_id', season_id);
    if (date_from) bookingsQuery = bookingsQuery.gte('created_at', date_from);
    if (date_to) bookingsQuery = bookingsQuery.lte('created_at', date_to);

    const { data: bookings } = await bookingsQuery;

    // Group by status
    const byStatus = bookings?.reduce((acc: any, b) => {
      const status = b.status || 'draft';
      if (!acc[status]) acc[status] = { status, count: 0, total: 0 };
      acc[status].count++;
      acc[status].total += num(b.total_amount);
      return acc;
    }, {}) || {};

    data.bookings = {
      total: bookings?.length || 0,
      total_amount: bookings?.reduce((sum, b) => sum + num(b.total_amount), 0) || 0,
      by_status: Object.values(byStatus),
      list: bookings?.map((b: any) => ({
        booking_number: b.booking_number,
        client: b.clients?.full_name_ar || b.clients?.full_name || '-',
        season: b.seasons?.name || '-',
        total: b.total_amount || 0,
        paid: b.paid_amount || 0,
        status: b.status,
        date: b.created_at
      })) || []
    };
  }

  // Pilgrims Tab
  if (tab === 'pilgrims' || tab === 'all') {
    let pilgrimsQuery = supabaseAdmin
      .from('pilgrims')
      .select(`
        id, full_name, full_name_ar, gender, nationality, passport_number, phone, status,
        bookings (booking_number)
      `)
      .eq('agency_id', agencyId);

    if (season_id) {
      const { data: seasonBookings } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('season_id', season_id);
      
      if (seasonBookings && seasonBookings.length > 0) {
        pilgrimsQuery = pilgrimsQuery.in('booking_id', seasonBookings.map(b => b.id));
      }
    }

    const { data: pilgrims } = await pilgrimsQuery;

    const byGender = {
      male: pilgrims?.filter(p => p.gender === 'male').length || 0,
      female: pilgrims?.filter(p => p.gender === 'female').length || 0
    };

    const byStatus = pilgrims?.reduce((acc: any, p) => {
      const status = p.status || 'active';
      if (!acc[status]) acc[status] = { status, count: 0 };
      acc[status].count++;
      return acc;
    }, {}) || {};

    data.pilgrims = {
      total: pilgrims?.length || 0,
      by_gender: byGender,
      by_status: Object.values(byStatus),
      list: pilgrims?.map((p: any) => ({
        name: p.full_name_ar || p.full_name || '-',
        gender: p.gender,
        nationality: p.nationality,
        passport: p.passport_number,
        phone: p.phone,
        status: p.status,
        booking: p.bookings?.booking_number || '-'
      })) || []
    };
  }

  // Operations Tab (Accommodations & Flights)
  if (tab === 'operations' || tab === 'all') {
    // Accommodations
    const { data: accommodations } = await supabaseAdmin
      .from('accommodations')
      .select('id, name, name_ar, city, room_types (id, type, total_rooms, total_beds)')
      .eq('agency_id', agencyId);

    let totalRooms = 0;
    let occupiedRooms = 0;
    const hotelStats: any[] = [];

    for (const acc of accommodations || []) {
      const roomTypes = Array.isArray(acc.room_types) ? acc.room_types : [acc.room_types];
      let hotelRooms = 0;
      let hotelOccupied = 0;

      for (const rt of roomTypes) {
        if (!rt) continue;
        hotelRooms += rt.total_rooms || 0;

        const { data: assignments } = await supabaseAdmin
          .from('room_assignments')
          .select('room_number')
          .eq('accommodation_id', acc.id)
          .eq('room_type_id', rt.id);

        hotelOccupied += new Set(assignments?.map(a => a.room_number) || []).size;
      }

      totalRooms += hotelRooms;
      occupiedRooms += hotelOccupied;
      hotelStats.push({
        name: acc.name_ar || acc.name,
        city: acc.city,
        total_rooms: hotelRooms,
        occupied: hotelOccupied,
        occupancy: hotelRooms > 0 ? Math.round((hotelOccupied / hotelRooms) * 100) : 0
      });
    }

    // Flights
    let flightsQuery = supabaseAdmin
      .from('flights')
      .select('id, code, departure_city, arrival_city, departure_date, return_date, carrier, is_direct, seasons (name)')
      .eq('agency_id', agencyId);

    if (season_id) flightsQuery = flightsQuery.eq('season_id', season_id);

    const { data: flights } = await flightsQuery;

    data.operations = {
      accommodations: {
        total_rooms: totalRooms,
        occupied_rooms: occupiedRooms,
        occupancy_rate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
        hotels: hotelStats
      },
      flights: {
        total: flights?.length || 0,
        direct: flights?.filter(f => f.is_direct).length || 0,
        indirect: flights?.filter(f => !f.is_direct).length || 0,
        list: flights?.map((f: any) => ({
          code: f.code,
          route: `${f.departure_city} → ${f.arrival_city}`,
          carrier: f.carrier,
          departure: f.departure_date,
          return: f.return_date,
          type: f.is_direct ? 'Direct' : 'Indirect',
          season: f.seasons?.name || '-'
        })) || []
      }
    };
  }

  return data;
}

// Format currency helper
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) + ' MAD';
}

// Format date helper
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-MA');
}

// Status translation helper
function translateStatus(status: string): string {
  const translations: { [key: string]: string } = {
    'draft': 'مسودة',
    'confirmed': 'مؤكد',
    'pending': 'قيد الانتظار',
    'completed': 'مكتمل',
    'cancelled': 'ملغي',
    'active': 'نشط',
    'inactive': 'غير نشط',
    'male': 'ذكر',
    'female': 'أنثى'
  };
  return translations[status] || status;
}

// Generate PDF Export
async function generatePDFExport(
  res: Response,
  data: any,
  tab: string,
  agencyName: string,
  filters: { season_id?: string; date_from?: string; date_to?: string }
) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Register Arabic fonts
  doc.registerFont('Amiri', AMIRI_REGULAR);
  doc.registerFont('Amiri-Bold', AMIRI_BOLD);

  // Set response headers
  const filename = `report_${tab}_${new Date().toISOString().split('T')[0]}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  doc.pipe(res);

  // Helper to write text with Arabic support
  const writeText = (text: string, options?: any) => {
    if (containsArabic(text)) {
      doc.font('Amiri').text(processArabicText(text), options);
      doc.font('Helvetica');
    } else {
      doc.font('Helvetica').text(text, options);
    }
  };

  // Header - handle Arabic agency name
  if (containsArabic(agencyName)) {
    doc.font('Amiri').fontSize(20).text(processArabicText(agencyName), { align: 'center' });
    doc.font('Helvetica');
  } else {
    doc.fontSize(20).text(agencyName, { align: 'center' });
  }
  doc.moveDown(0.5);
  
  const tabTitles: { [key: string]: string } = {
    'financial': 'Financial Report',
    'financial-status': 'Financial Status',
    'bookings': 'Bookings Report',
    'pilgrims': 'Pilgrims Report',
    'operations': 'Operations Report'
  };
  
  doc.font('Helvetica').fontSize(16).text(tabTitles[tab] || 'Report', { align: 'center' });
  doc.moveDown(0.5);

  // Filters applied
  doc.fontSize(10).fillColor('#666666');
  let filterText = `Generated: ${new Date().toLocaleDateString('fr-MA')}`;
  if (filters.date_from) filterText += ` | From: ${filters.date_from}`;
  if (filters.date_to) filterText += ` | To: ${filters.date_to}`;
  doc.text(filterText, { align: 'center' });
  doc.moveDown();
  doc.fillColor('#000000');

  // Separator line
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Content based on tab
  if (tab === 'financial' && data.financial) {
    const f = data.financial;
    
    doc.font('Helvetica').fontSize(14).text('Summary', { underline: true });
    doc.moveDown(0.5);
    
    doc.fontSize(11);
    doc.text(`Total Revenue: ${formatCurrency(f.total_revenue)}`);
    doc.text(`Received: ${formatCurrency(f.total_received)}`);
    doc.text(`Pending: ${formatCurrency(f.total_pending)}`);
    doc.text(`Bookings Count: ${f.bookings_count}`);
    doc.text(`Average Value: ${formatCurrency(f.average_booking_value)}`);
    
    if (f.by_status && f.by_status.length > 0) {
      doc.moveDown();
      doc.fontSize(14).text('By Status', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      
      for (const s of f.by_status) {
        doc.text(`${translateStatus(s.status)}: ${s.count} bookings - ${formatCurrency(s.total)}`);
      }
    }
  }

  if (tab === 'financial-status' && data.financialStatus) {
    const fs = data.financialStatus;
    
    doc.font('Helvetica').fontSize(14).text('Sales Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Sales: ${formatCurrency(fs.sales.total)}`);
    doc.text(`Received: ${formatCurrency(fs.sales.received)}`);
    doc.text(`Pending: ${formatCurrency(fs.sales.pending)}`);
    
    doc.moveDown();
    doc.font('Helvetica').fontSize(14).text('Expenses Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Expenses: ${formatCurrency(fs.expenses.total)}`);
    
    doc.moveDown();
    doc.fontSize(14).text('Balance', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    const balanceStatus = fs.balance >= 0 ? 'To Pay' : 'To Receive';
    doc.text(`Net Balance: ${formatCurrency(Math.abs(fs.balance))} (${balanceStatus})`);
  }

  if (tab === 'bookings' && data.bookings) {
    const b = data.bookings;
    
    doc.font('Helvetica').fontSize(14).text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Bookings: ${b.total}`);
    doc.text(`Total Amount: ${formatCurrency(b.total_amount)}`);
    
    if (b.by_status && b.by_status.length > 0) {
      doc.moveDown();
      doc.fontSize(14).text('By Status', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      for (const s of b.by_status) {
        doc.text(`${translateStatus(s.status)}: ${s.count} - ${formatCurrency(s.total)}`);
      }
    }

    if (b.list && b.list.length > 0) {
      doc.moveDown();
      doc.fontSize(14).text('Bookings List', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9);
      
      // Table header
      const startY = doc.y;
      doc.text('No.', 50, startY, { width: 30 });
      doc.text('Client', 80, startY, { width: 120 });
      doc.text('Total', 200, startY, { width: 80 });
      doc.text('Paid', 280, startY, { width: 80 });
      doc.text('Status', 360, startY, { width: 60 });
      doc.text('Date', 420, startY, { width: 80 });
      doc.moveDown();
      
      // Table rows (limit to fit page)
      const maxRows = Math.min(b.list.length, 20);
      for (let i = 0; i < maxRows; i++) {
        const item = b.list[i];
        const y = doc.y;
        doc.text(`${i + 1}`, 50, y, { width: 30 });
        // Handle Arabic client names - use full name without truncation
        const clientName = item.client || '-';
        if (containsArabic(clientName)) {
          doc.font('Amiri').text(processArabicText(clientName), 80, y, { width: 150 });
          doc.font('Helvetica');
        } else {
          doc.text(clientName, 80, y, { width: 150 });
        }
        doc.text(formatCurrency(item.total), 200, y, { width: 80 });
        doc.text(formatCurrency(item.paid), 280, y, { width: 80 });
        doc.text(translateStatus(item.status), 360, y, { width: 60 });
        doc.text(formatDate(item.date), 420, y, { width: 80 });
        doc.moveDown(0.5);
      }
      
      if (b.list.length > maxRows) {
        doc.text(`... and ${b.list.length - maxRows} more bookings`);
      }
    }
  }

  if (tab === 'pilgrims' && data.pilgrims) {
    const p = data.pilgrims;
    
    doc.font('Helvetica').fontSize(14).text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Pilgrims: ${p.total}`);
    doc.text(`Male: ${p.by_gender.male}`);
    doc.text(`Female: ${p.by_gender.female}`);
    
    if (p.by_status && p.by_status.length > 0) {
      doc.moveDown();
      doc.fontSize(14).text('By Status', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      for (const s of p.by_status) {
        doc.text(`${translateStatus(s.status)}: ${s.count}`);
      }
    }

    if (p.list && p.list.length > 0) {
      doc.moveDown();
      doc.fontSize(14).text('Pilgrims List', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9);
      
      const startY = doc.y;
      doc.text('No.', 50, startY, { width: 30 });
      doc.text('Name', 80, startY, { width: 150 });
      doc.text('Gender', 230, startY, { width: 50 });
      doc.text('Passport', 280, startY, { width: 100 });
      doc.text('Status', 380, startY, { width: 60 });
      doc.moveDown();
      
      const maxRows = Math.min(p.list.length, 25);
      for (let i = 0; i < maxRows; i++) {
        const item = p.list[i];
        const y = doc.y;
        doc.font('Helvetica').text(`${i + 1}`, 50, y, { width: 30 });
        // Handle Arabic pilgrim names - use full name without truncation
        const pilgrimName = item.name || '-';
        if (containsArabic(pilgrimName)) {
          doc.font('Amiri').text(processArabicText(pilgrimName), 80, y, { width: 180 });
          doc.font('Helvetica');
        } else {
          doc.text(pilgrimName, 80, y, { width: 180 });
        }
        doc.text(translateStatus(item.gender || '-'), 230, y, { width: 50 });
        doc.text(item.passport || '-', 280, y, { width: 100 });
        doc.text(translateStatus(item.status || '-'), 380, y, { width: 60 });
        doc.moveDown(0.5);
      }
      
      if (p.list.length > maxRows) {
        doc.text(`... and ${p.list.length - maxRows} more pilgrims`);
      }
    }
  }

  if (tab === 'operations' && data.operations) {
    const o = data.operations;
    
    doc.font('Helvetica').fontSize(14).text('Accommodations', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Rooms: ${o.accommodations.total_rooms}`);
    doc.text(`Occupied: ${o.accommodations.occupied_rooms}`);
    doc.text(`Occupancy Rate: ${o.accommodations.occupancy_rate}%`);
    
    if (o.accommodations.hotels && o.accommodations.hotels.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10);
      for (const h of o.accommodations.hotels) {
        // Handle Arabic hotel names
        const hotelName = h.name || '-';
        if (containsArabic(hotelName)) {
          doc.font('Amiri').text(processArabicText(hotelName), { continued: true });
          doc.font('Helvetica').text(` (${h.city}): ${h.occupied}/${h.total_rooms} (${h.occupancy}%)`);
        } else {
          doc.text(`${hotelName} (${h.city}): ${h.occupied}/${h.total_rooms} (${h.occupancy}%)`);
        }
      }
    }
    
    doc.moveDown();
    doc.fontSize(14).text('Flights', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total Flights: ${o.flights.total}`);
    doc.text(`Direct: ${o.flights.direct}`);
    doc.text(`Indirect: ${o.flights.indirect}`);
    
    if (o.flights.list && o.flights.list.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10);
      for (const f of o.flights.list.slice(0, 10)) {
        doc.text(`${f.code}: ${f.route} - ${f.carrier} (${f.type})`);
      }
      if (o.flights.list.length > 10) {
        doc.text(`... and ${o.flights.list.length - 10} more flights`);
      }
    }
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999999');
  doc.text(`Page 1 | Generated by Hujjaj System`, { align: 'center' });

  doc.end();
}

// Generate Excel Export
async function generateExcelExport(
  res: Response,
  data: any,
  tab: string,
  agencyName: string,
  filters: { season_id?: string; date_from?: string; date_to?: string }
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hujjaj System';
  workbook.created = new Date();

  const tabTitles: { [key: string]: string } = {
    'financial': 'Financial Report',
    'financial-status': 'Financial Status',
    'bookings': 'Bookings Report',
    'pilgrims': 'Pilgrims Report',
    'operations': 'Operations Report'
  };

  // Set response headers
  const filename = `report_${tab}_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  if (tab === 'financial' && data.financial) {
    const sheet = workbook.addWorksheet('Financial Summary');
    const f = data.financial;

    // Header
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = agencyName;
    sheet.getCell('A1').font = { bold: true, size: 16 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = 'Financial Report / التقرير المالي';
    sheet.getCell('A2').font = { bold: true, size: 14 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    // Summary section
    sheet.getCell('A4').value = 'Summary';
    sheet.getCell('A4').font = { bold: true };

    sheet.getCell('A5').value = 'Total Revenue';
    sheet.getCell('B5').value = f.total_revenue;
    sheet.getCell('B5').numFmt = '#,##0.00 "MAD"';

    sheet.getCell('A6').value = 'Received';
    sheet.getCell('B6').value = f.total_received;
    sheet.getCell('B6').numFmt = '#,##0.00 "MAD"';

    sheet.getCell('A7').value = 'Pending';
    sheet.getCell('B7').value = f.total_pending;
    sheet.getCell('B7').numFmt = '#,##0.00 "MAD"';

    sheet.getCell('A8').value = 'Bookings Count';
    sheet.getCell('B8').value = f.bookings_count;

    sheet.getCell('A9').value = 'Average Value';
    sheet.getCell('B9').value = f.average_booking_value;
    sheet.getCell('B9').numFmt = '#,##0.00 "MAD"';

    // By Status
    if (f.by_status && f.by_status.length > 0) {
      sheet.getCell('A11').value = 'By Status';
      sheet.getCell('A11').font = { bold: true };

      sheet.getRow(12).values = ['Status', 'Count', 'Total'];
      sheet.getRow(12).font = { bold: true };

      let row = 13;
      for (const s of f.by_status) {
        sheet.getRow(row).values = [translateStatus(s.status), s.count, s.total];
        sheet.getCell(`C${row}`).numFmt = '#,##0.00 "MAD"';
        row++;
      }
    }

    sheet.columns = [
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 20 }
    ];
  }

  if (tab === 'financial-status' && data.financialStatus) {
    const fs = data.financialStatus;

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.mergeCells('A1:D1');
    summarySheet.getCell('A1').value = agencyName;
    summarySheet.getCell('A1').font = { bold: true, size: 16 };

    summarySheet.getCell('A3').value = 'Sales Summary';
    summarySheet.getCell('A3').font = { bold: true };
    summarySheet.getCell('A4').value = 'Total Sales';
    summarySheet.getCell('B4').value = fs.sales.total;
    summarySheet.getCell('B4').numFmt = '#,##0.00 "MAD"';
    summarySheet.getCell('A5').value = 'Received';
    summarySheet.getCell('B5').value = fs.sales.received;
    summarySheet.getCell('B5').numFmt = '#,##0.00 "MAD"';
    summarySheet.getCell('A6').value = 'Pending';
    summarySheet.getCell('B6').value = fs.sales.pending;
    summarySheet.getCell('B6').numFmt = '#,##0.00 "MAD"';

    summarySheet.getCell('A8').value = 'Expenses Summary';
    summarySheet.getCell('A8').font = { bold: true };
    summarySheet.getCell('A9').value = 'Total Expenses';
    summarySheet.getCell('B9').value = fs.expenses.total;
    summarySheet.getCell('B9').numFmt = '#,##0.00 "MAD"';

    summarySheet.getCell('A11').value = 'Balance';
    summarySheet.getCell('A11').font = { bold: true };
    summarySheet.getCell('A12').value = 'Net Balance';
    summarySheet.getCell('B12').value = fs.balance;
    summarySheet.getCell('B12').numFmt = '#,##0.00 "MAD"';

    summarySheet.columns = [{ width: 20 }, { width: 20 }];

    // Sales Details Sheet
    if (fs.sales.details && fs.sales.details.length > 0) {
      const salesSheet = workbook.addWorksheet('Sales Details');
      salesSheet.getRow(1).values = ['Booking #', 'Client', 'Total', 'Paid', 'Remaining', 'Status', 'Date'];
      salesSheet.getRow(1).font = { bold: true };
      salesSheet.autoFilter = 'A1:G1';

      let row = 2;
      for (const s of fs.sales.details) {
        salesSheet.getRow(row).values = [
          s.booking_number,
          s.client,
          s.total,
          s.paid,
          s.remaining,
          translateStatus(s.status),
          s.date ? new Date(s.date) : ''
        ];
        salesSheet.getCell(`C${row}`).numFmt = '#,##0.00';
        salesSheet.getCell(`D${row}`).numFmt = '#,##0.00';
        salesSheet.getCell(`E${row}`).numFmt = '#,##0.00';
        if (s.date) salesSheet.getCell(`G${row}`).numFmt = 'yyyy-mm-dd';
        row++;
      }

      salesSheet.columns = [
        { width: 15 }, { width: 25 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 12 }, { width: 12 }
      ];
    }

    // Expenses Details Sheet
    if (fs.expenses.details && fs.expenses.details.length > 0) {
      const expensesSheet = workbook.addWorksheet('Expenses Details');
      expensesSheet.getRow(1).values = ['Category', 'Description', 'Amount', 'Date'];
      expensesSheet.getRow(1).font = { bold: true };
      expensesSheet.autoFilter = 'A1:D1';

      let row = 2;
      for (const e of fs.expenses.details) {
        expensesSheet.getRow(row).values = [
          e.category,
          e.description,
          e.amount,
          e.date ? new Date(e.date) : ''
        ];
        expensesSheet.getCell(`C${row}`).numFmt = '#,##0.00';
        if (e.date) expensesSheet.getCell(`D${row}`).numFmt = 'yyyy-mm-dd';
        row++;
      }

      expensesSheet.columns = [{ width: 20 }, { width: 30 }, { width: 15 }, { width: 12 }];
    }
  }

  if (tab === 'bookings' && data.bookings) {
    const b = data.bookings;
    
    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.mergeCells('A1:D1');
    summarySheet.getCell('A1').value = agencyName;
    summarySheet.getCell('A1').font = { bold: true, size: 16 };

    summarySheet.getCell('A3').value = 'Total Bookings';
    summarySheet.getCell('B3').value = b.total;
    summarySheet.getCell('A4').value = 'Total Amount';
    summarySheet.getCell('B4').value = b.total_amount;
    summarySheet.getCell('B4').numFmt = '#,##0.00 "MAD"';

    if (b.by_status && b.by_status.length > 0) {
      summarySheet.getCell('A6').value = 'By Status';
      summarySheet.getCell('A6').font = { bold: true };
      summarySheet.getRow(7).values = ['Status', 'Count', 'Total'];
      summarySheet.getRow(7).font = { bold: true };

      let row = 8;
      for (const s of b.by_status) {
        summarySheet.getRow(row).values = [translateStatus(s.status), s.count, s.total];
        summarySheet.getCell(`C${row}`).numFmt = '#,##0.00 "MAD"';
        row++;
      }
    }

    summarySheet.columns = [{ width: 20 }, { width: 15 }, { width: 20 }];

    // Bookings List Sheet
    if (b.list && b.list.length > 0) {
      const listSheet = workbook.addWorksheet('Bookings List');
      listSheet.getRow(1).values = ['Booking #', 'Client', 'Season', 'Total', 'Paid', 'Status', 'Date'];
      listSheet.getRow(1).font = { bold: true };
      listSheet.autoFilter = 'A1:G1';

      let row = 2;
      for (const item of b.list) {
        listSheet.getRow(row).values = [
          item.booking_number,
          item.client,
          item.season,
          item.total,
          item.paid,
          translateStatus(item.status),
          item.date ? new Date(item.date) : ''
        ];
        listSheet.getCell(`D${row}`).numFmt = '#,##0.00';
        listSheet.getCell(`E${row}`).numFmt = '#,##0.00';
        if (item.date) listSheet.getCell(`G${row}`).numFmt = 'yyyy-mm-dd';
        row++;
      }

      listSheet.columns = [
        { width: 15 }, { width: 25 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 12 }, { width: 12 }
      ];
    }
  }

  if (tab === 'pilgrims' && data.pilgrims) {
    const p = data.pilgrims;

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.mergeCells('A1:D1');
    summarySheet.getCell('A1').value = agencyName;
    summarySheet.getCell('A1').font = { bold: true, size: 16 };

    summarySheet.getCell('A3').value = 'Total Pilgrims';
    summarySheet.getCell('B3').value = p.total;
    summarySheet.getCell('A4').value = 'Male';
    summarySheet.getCell('B4').value = p.by_gender.male;
    summarySheet.getCell('A5').value = 'Female';
    summarySheet.getCell('B5').value = p.by_gender.female;

    if (p.by_status && p.by_status.length > 0) {
      summarySheet.getCell('A7').value = 'By Status';
      summarySheet.getCell('A7').font = { bold: true };
      let row = 8;
      for (const s of p.by_status) {
        summarySheet.getCell(`A${row}`).value = translateStatus(s.status);
        summarySheet.getCell(`B${row}`).value = s.count;
        row++;
      }
    }

    summarySheet.columns = [{ width: 20 }, { width: 15 }];

    // Pilgrims List Sheet
    if (p.list && p.list.length > 0) {
      const listSheet = workbook.addWorksheet('Pilgrims List');
      listSheet.getRow(1).values = ['Name', 'Gender', 'Nationality', 'Passport', 'Phone', 'Status', 'Booking'];
      listSheet.getRow(1).font = { bold: true };
      listSheet.autoFilter = 'A1:G1';

      let row = 2;
      for (const item of p.list) {
        listSheet.getRow(row).values = [
          item.name,
          translateStatus(item.gender || '-'),
          item.nationality || '-',
          item.passport || '-',
          item.phone || '-',
          translateStatus(item.status || '-'),
          item.booking || '-'
        ];
        row++;
      }

      listSheet.columns = [
        { width: 25 }, { width: 10 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 12 }, { width: 15 }
      ];
    }
  }

  if (tab === 'operations' && data.operations) {
    const o = data.operations;

    // Accommodations Sheet
    const accSheet = workbook.addWorksheet('Accommodations');
    accSheet.mergeCells('A1:D1');
    accSheet.getCell('A1').value = agencyName;
    accSheet.getCell('A1').font = { bold: true, size: 16 };

    accSheet.getCell('A3').value = 'Total Rooms';
    accSheet.getCell('B3').value = o.accommodations.total_rooms;
    accSheet.getCell('A4').value = 'Occupied';
    accSheet.getCell('B4').value = o.accommodations.occupied_rooms;
    accSheet.getCell('A5').value = 'Occupancy Rate';
    accSheet.getCell('B5').value = o.accommodations.occupancy_rate / 100;
    accSheet.getCell('B5').numFmt = '0%';

    if (o.accommodations.hotels && o.accommodations.hotels.length > 0) {
      accSheet.getCell('A7').value = 'Hotels';
      accSheet.getCell('A7').font = { bold: true };
      accSheet.getRow(8).values = ['Hotel', 'City', 'Total Rooms', 'Occupied', 'Occupancy'];
      accSheet.getRow(8).font = { bold: true };

      let row = 9;
      for (const h of o.accommodations.hotels) {
        accSheet.getRow(row).values = [h.name, h.city, h.total_rooms, h.occupied, h.occupancy / 100];
        accSheet.getCell(`E${row}`).numFmt = '0%';
        row++;
      }
    }

    accSheet.columns = [{ width: 25 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 12 }];

    // Flights Sheet
    const flightsSheet = workbook.addWorksheet('Flights');
    flightsSheet.getCell('A1').value = 'Flights Summary';
    flightsSheet.getCell('A1').font = { bold: true, size: 14 };

    flightsSheet.getCell('A3').value = 'Total Flights';
    flightsSheet.getCell('B3').value = o.flights.total;
    flightsSheet.getCell('A4').value = 'Direct';
    flightsSheet.getCell('B4').value = o.flights.direct;
    flightsSheet.getCell('A5').value = 'Indirect';
    flightsSheet.getCell('B5').value = o.flights.indirect;

    if (o.flights.list && o.flights.list.length > 0) {
      flightsSheet.getCell('A7').value = 'Flights List';
      flightsSheet.getCell('A7').font = { bold: true };
      flightsSheet.getRow(8).values = ['Code', 'Route', 'Carrier', 'Departure', 'Return', 'Type', 'Season'];
      flightsSheet.getRow(8).font = { bold: true };
      flightsSheet.autoFilter = 'A8:G8';

      let row = 9;
      for (const f of o.flights.list) {
        flightsSheet.getRow(row).values = [
          f.code,
          f.route,
          f.carrier,
          f.departure ? new Date(f.departure) : '',
          f.return ? new Date(f.return) : '',
          f.type,
          f.season
        ];
        if (f.departure) flightsSheet.getCell(`D${row}`).numFmt = 'yyyy-mm-dd';
        if (f.return) flightsSheet.getCell(`E${row}`).numFmt = 'yyyy-mm-dd';
        row++;
      }
    }

    flightsSheet.columns = [
      { width: 12 }, { width: 25 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 15 }
    ];
  }

  // Write to response
  await workbook.xlsx.write(res);
  res.end();
}

// Get Financial Status - Shows what user sold vs bought and balance to hand to admin
export const getFinancialStatus = async (req: Request, res: Response) => {
  console.log('[Reports] getFinancialStatus called');
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const role = req.user?.role;
  const userBranchId = req.user?.branch_id;
  const { season_id, date_from, date_to, user_id } = req.query;

  const isAdmin = role === 'agency_admin' || role === 'super_admin';

  // Determine target user IDs based on role
  let targetUserIds: string[] | null = null;
  
  if (user_id && isAdmin) {
    // Admin can view specific user's financial status
    targetUserIds = [user_id as string];
  } else if (role === 'agent') {
    // Agent sees only their own data
    targetUserIds = userId ? [userId] : [];
  } else if (role === 'manager' && userBranchId) {
    // Manager sees branch data
    targetUserIds = await getBranchUserIds(userBranchId);
  }
  // Admin sees all (targetUserIds stays null)

  console.log('[Reports] Financial Status - agencyId:', agencyId, 'role:', role, 'targetUserIds:', targetUserIds);

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  try {
    // =============================================
    // 1. SALES (What user has sold - Revenue from bookings)
    // =============================================
    
    // Get bookings based on role
    let bookingsQuery = supabaseAdmin
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
        creator:users!bookings_created_by_fkey (id, full_name)
      `)
      .eq('agency_id', agencyId)
      .is('deleted_at', null);

    // Apply role-based filter
    if (targetUserIds !== null) {
      if (targetUserIds.length > 0) {
        bookingsQuery = bookingsQuery.in('created_by', targetUserIds);
      } else {
        // No matching users, empty bookings
        bookingsQuery = bookingsQuery.eq('created_by', '00000000-0000-0000-0000-000000000000');
      }
    }
    
    if (season_id) bookingsQuery = bookingsQuery.eq('season_id', season_id);
    if (date_from) bookingsQuery = bookingsQuery.gte('created_at', date_from as string);
    if (date_to) bookingsQuery = bookingsQuery.lte('created_at', date_to as string);

    const { data: bookings, error: bookingsError } = await bookingsQuery;
    if (bookingsError) throw bookingsError;

    // Calculate sales totals
    const totalSales = bookings?.reduce((sum, b) => sum + num(b.total_amount), 0) || 0;
    const totalPaymentsReceived = bookings?.reduce((sum, b) => sum + num(b.paid_amount), 0) || 0;
    const pendingPayments = totalSales - totalPaymentsReceived;

    // Sales by booking (details)
    const salesDetails = bookings?.map((b: any) => ({
      id: b.id,
      booking_number: b.booking_number,
      client_name: b.clients?.full_name_ar || b.clients?.full_name || '-',
      total_amount: b.total_amount || 0,
      paid_amount: b.paid_amount || 0,
      remaining: (b.total_amount || 0) - (b.paid_amount || 0),
      status: b.status,
      created_at: b.created_at,
      created_by: b.creator?.full_name || '-'
    })) || [];

    // =============================================
    // 2. PURCHASES (What user has bought/spent)
    // =============================================

    // 2a. Expenses (direct expenses like visas, transport, misc)
    let expensesQuery = supabaseAdmin
      .from('expenses')
      .select(`
        id,
        category,
        description,
        amount,
        paid_date,
        expense_type,
        category_id,
        expense_categories (name, name_ar)
      `)
      .eq('agency_id', agencyId);

    if (season_id) expensesQuery = expensesQuery.eq('season_id', season_id);
    if (date_from) expensesQuery = expensesQuery.gte('paid_date', date_from as string);
    if (date_to) expensesQuery = expensesQuery.lte('paid_date', date_to as string);

    const { data: expenses, error: expensesError } = await expensesQuery;
    if (expensesError) throw expensesError;

    const totalExpenses = expenses?.reduce((sum, e) => sum + num(e.amount), 0) || 0;

    // Group expenses by category
    const expensesByCategory = expenses?.reduce((acc: any, e: any) => {
      const categoryName = e.expense_categories?.name_ar || e.expense_categories?.name || e.category || 'أخرى';
      if (!acc[categoryName]) {
        acc[categoryName] = { category: categoryName, count: 0, total: 0, items: [] };
      }
      acc[categoryName].count++;
      acc[categoryName].total += e.amount || 0;
      acc[categoryName].items.push({
        id: e.id,
        description: e.description,
        amount: e.amount,
        paid_date: e.paid_date,
        type: e.expense_type
      });
      return acc;
    }, {}) || {};

    // 2b. Hotel Beds Purchased (from hotel_bed_inventory)
    let bedsQuery = supabaseAdmin
      .from('hotel_bed_inventory')
      .select(`
        id,
        beds_purchased,
        purchase_price_per_bed,
        total_purchase_cost,
        check_in_date,
        check_out_date,
        beds_sold,
        beds_available,
        sell_price_per_bed,
        supplier_name,
        accommodations (name, name_ar, city),
        room_types (type)
      `)
      .eq('agency_id', agencyId);

    if (season_id) bedsQuery = bedsQuery.eq('season_id', season_id);
    if (date_from) bedsQuery = bedsQuery.gte('check_in_date', date_from as string);
    if (date_to) bedsQuery = bedsQuery.lte('check_out_date', date_to as string);

    const { data: bedInventory, error: bedsError } = await bedsQuery;
    if (bedsError) throw bedsError;

    const totalBedsPurchaseCost = bedInventory?.reduce((sum, b) => sum + num(b.total_purchase_cost), 0) || 0;
    const totalBedsSold = bedInventory?.reduce((sum, b) => sum + num(b.beds_sold), 0) || 0;
    const totalBedsPurchased = bedInventory?.reduce((sum, b) => sum + num(b.beds_purchased), 0) || 0;
    const totalBedsRevenue = bedInventory?.reduce((sum, b) => sum + (num(b.beds_sold) * num(b.sell_price_per_bed)), 0) || 0;

    const bedDetails = bedInventory?.map((b: any) => ({
      id: b.id,
      hotel_name: b.accommodations?.name_ar || b.accommodations?.name || '-',
      city: b.accommodations?.city || '-',
      room_type: b.room_types?.type || '-',
      beds_purchased: b.beds_purchased,
      purchase_price: b.purchase_price_per_bed,
      total_cost: b.total_purchase_cost,
      beds_sold: b.beds_sold,
      beds_available: b.beds_available,
      sell_price: b.sell_price_per_bed,
      revenue: num(b.beds_sold) * num(b.sell_price_per_bed),
      profit: (num(b.beds_sold) * num(b.sell_price_per_bed)) - (num(b.beds_sold) * num(b.purchase_price_per_bed)),
      check_in: b.check_in_date,
      check_out: b.check_out_date,
      supplier: b.supplier_name
    })) || [];

    // 2c. Flight Seats Purchased (from flight_seat_inventory)
    let flightSeatsQuery = supabaseAdmin
      .from('flight_seat_inventory')
      .select(`
        id,
        seats_purchased,
        purchase_price_per_seat,
        total_purchase_cost,
        seats_sold,
        seats_available,
        sell_price_per_seat,
        flights (code, departure_city, arrival_city, departure_date, return_date, carrier)
      `)
      .eq('agency_id', agencyId);

    if (season_id) flightSeatsQuery = flightSeatsQuery.eq('season_id', season_id);

    const { data: flightInventory, error: flightsError } = await flightSeatsQuery;
    // If table doesn't exist, just use empty array
    const flightSeats = flightsError ? [] : (flightInventory || []);

    const totalFlightsPurchaseCost = flightSeats.reduce((sum: number, f: any) => sum + num(f.total_purchase_cost), 0);
    const totalSeatsSold = flightSeats.reduce((sum: number, f: any) => sum + num(f.seats_sold), 0);
    const totalSeatsPurchased = flightSeats.reduce((sum: number, f: any) => sum + num(f.seats_purchased), 0);
    const totalFlightsRevenue = flightSeats.reduce((sum: number, f: any) => sum + (num(f.seats_sold) * num(f.sell_price_per_seat)), 0);

    const flightDetails = flightSeats.map((f: any) => ({
      id: f.id,
      flight_code: f.flights?.code || '-',
      route: `${f.flights?.departure_city || ''} → ${f.flights?.arrival_city || ''}`,
      carrier: f.flights?.carrier || '-',
      departure_date: f.flights?.departure_date,
      seats_purchased: f.seats_purchased,
      purchase_price: f.purchase_price_per_seat,
      total_cost: f.total_purchase_cost,
      seats_sold: f.seats_sold,
      seats_available: f.seats_available,
      sell_price: f.sell_price_per_seat,
      revenue: num(f.seats_sold) * num(f.sell_price_per_seat),
      profit: (num(f.seats_sold) * num(f.sell_price_per_seat)) - (num(f.seats_sold) * num(f.purchase_price_per_seat)),
      supplier: null
    }));

    // =============================================
    // 3. CALCULATE BALANCE (What user owes to admin)
    // =============================================
    
    // Total money received from clients (payments received)
    const moneyReceived = totalPaymentsReceived;
    
    // Total money spent on purchases (expenses + beds + flights)
    const totalPurchases = totalExpenses + totalBedsPurchaseCost + totalFlightsPurchaseCost;
    
    // Balance = Money Received - Money Spent
    // Positive = User has extra money to give to admin
    // Negative = User needs to be reimbursed by admin
    const balanceToAdmin = moneyReceived - totalPurchases;

    // Inventory profit (from sales of beds and flights)
    const inventoryProfit = (totalBedsRevenue - totalBedsPurchaseCost) + (totalFlightsRevenue - totalFlightsPurchaseCost);

    const response = {
      // Summary
      summary: {
        total_sales: totalSales,
        payments_received: totalPaymentsReceived,
        pending_payments: pendingPayments,
        total_purchases: totalPurchases,
        total_expenses: totalExpenses,
        total_beds_cost: totalBedsPurchaseCost,
        total_flights_cost: totalFlightsPurchaseCost,
        balance_to_admin: balanceToAdmin,
        inventory_profit: inventoryProfit
      },
      
      // Sales Details
      sales: {
        total: totalSales,
        received: totalPaymentsReceived,
        pending: pendingPayments,
        bookings_count: bookings?.length || 0,
        details: salesDetails
      },
      
      // Purchases Details
      purchases: {
        // Expenses
        expenses: {
          total: totalExpenses,
          by_category: Object.values(expensesByCategory),
          count: expenses?.length || 0
        },
        // Hotel Beds
        beds: {
          total_cost: totalBedsPurchaseCost,
          total_purchased: totalBedsPurchased,
          total_sold: totalBedsSold,
          revenue: totalBedsRevenue,
          profit: totalBedsRevenue - totalBedsPurchaseCost,
          details: bedDetails
        },
        // Flight Seats
        flights: {
          total_cost: totalFlightsPurchaseCost,
          total_purchased: totalSeatsPurchased,
          total_sold: totalSeatsSold,
          revenue: totalFlightsRevenue,
          profit: totalFlightsRevenue - totalFlightsPurchaseCost,
          details: flightDetails
        }
      },
      
      // Balance
      balance: {
        money_received: moneyReceived,
        money_spent: totalPurchases,
        net_balance: balanceToAdmin,
        status: balanceToAdmin >= 0 ? 'to_pay' : 'to_receive'
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error generating financial status:', error);
    res.status(500).json({ error: error.message });
  }
};
