/**
 * Full Al-Baraka Travel demo seed (idempotent).
 *
 * Creates a complete agency scenario: branches, users, seasons, flights,
 * hotels, inventory, services, discounts, clients, multi-status bookings,
 * pilgrims, payments, allocations, expenses, handovers, and messages.
 *
 * Env:
 *   SEED_DEMO=false  — skip seeding (default: run)
 *   DEMO_PASSWORD    — password for all demo agency users (default: Demo123!)
 *
 * Agency admin login: ahmed@albaraka.ma / Demo123!
 */
import dotenv from 'dotenv';
import path from 'path';
import db from '../services/db';
import { hashPassword } from '../services/auth.service';
import { runAsPlatform } from '../middleware/rlsContext';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const AGENCY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo123!';

const IDS = {
  branchHQ: 'b1000001-0000-4000-8000-000000000001',
  branchRabat: 'b1000001-0000-4000-8000-000000000002',
  branchMarrakech: 'b1000001-0000-4000-8000-000000000003',

  userAhmed: 'a1000001-0000-4000-8000-000000000001',
  userFatima: 'a1000001-0000-4000-8000-000000000002',
  userYoussef: 'a1000001-0000-4000-8000-000000000003',
  userKhadija: 'a1000001-0000-4000-8000-000000000004',

  seasonRamadan: 'e1000001-0000-4000-8000-000000000001',
  seasonHajj: 'e1000001-0000-4000-8000-000000000002',
  seasonSummer: 'e1000001-0000-4000-8000-000000000003',

  flight001: 'f1000001-0000-4000-8000-000000000001',
  flight002: 'f1000001-0000-4000-8000-000000000002',
  flight003: 'f1000001-0000-4000-8000-000000000003',
  flight004: 'f1000001-0000-4000-8000-000000000004',
  flightSummer: 'f1000001-0000-4000-8000-000000000005',

  hotel001: 'aa000001-0000-4000-8000-000000000001',
  hotel002: 'aa000001-0000-4000-8000-000000000002',
  hotel003: 'aa000001-0000-4000-8000-000000000003',
  hotel004: 'aa000001-0000-4000-8000-000000000004',
  hotel005: 'aa000001-0000-4000-8000-000000000005',
  hotel006: 'aa000001-0000-4000-8000-000000000006',
  hotelSummer: 'aa000001-0000-4000-8000-000000000007',

  // Dar Al-Tawhid
  rt001: 'bb000001-0000-4000-8000-000000000001',
  rt002: 'bb000001-0000-4000-8000-000000000002',
  rt003: 'bb000001-0000-4000-8000-000000000003',
  rt004: 'bb000001-0000-4000-8000-000000000004',
  // Swissotel
  rtSwissD: 'bb000001-0000-4000-8000-000000000014',
  rtSwissT: 'bb000001-0000-4000-8000-000000000015',
  // Al-Safwa
  rt005: 'bb000001-0000-4000-8000-000000000005',
  rt006: 'bb000001-0000-4000-8000-000000000006',
  rt007: 'bb000001-0000-4000-8000-000000000007',
  // Dar Al-Taqwa
  rt008: 'bb000001-0000-4000-8000-000000000008',
  rt009: 'bb000001-0000-4000-8000-000000000009',
  rt010: 'bb000001-0000-4000-8000-00000000000a',
  // Anwar
  rtAnwarD: 'bb000001-0000-4000-8000-000000000016',
  rtAnwarT: 'bb000001-0000-4000-8000-000000000017',
  // Al-Noor
  rt011: 'bb000001-0000-4000-8000-000000000011',
  rt012: 'bb000001-0000-4000-8000-000000000012',
  rt013: 'bb000001-0000-4000-8000-000000000013',
  // Summer
  rtSummerD: 'bb000001-0000-4000-8000-000000000018',
  rtSummerT: 'bb000001-0000-4000-8000-000000000019',

  fsi001: 'cc000001-0000-4000-8000-000000000001',
  fsi002: 'cc000001-0000-4000-8000-000000000002',
  fsi003: 'cc000001-0000-4000-8000-000000000003',
  fsi004: 'cc000001-0000-4000-8000-000000000004',
  fsi005: 'cc000001-0000-4000-8000-000000000005',
  fsiSummer: 'cc000001-0000-4000-8000-000000000006',

  hbi001: 'dd000001-0000-4000-8000-000000000001',
  hbi002: 'dd000001-0000-4000-8000-000000000002',
  hbi003: 'dd000001-0000-4000-8000-000000000003',
  hbi004: 'dd000001-0000-4000-8000-000000000004',
  hbi005: 'dd000001-0000-4000-8000-000000000005',
  hbi006: 'dd000001-0000-4000-8000-000000000006',
  hbiSafwa: 'dd000001-0000-4000-8000-000000000007',
  hbiNoor: 'dd000001-0000-4000-8000-000000000008',
  hbiSummer: 'dd000001-0000-4000-8000-000000000009',

  svc001: 'ee000001-0000-4000-8000-000000000001',
  svc002: 'ee000001-0000-4000-8000-000000000002',
  svc003: 'ee000001-0000-4000-8000-000000000003',
  svc004: 'ee000001-0000-4000-8000-000000000004',
  svc005: 'ee000001-0000-4000-8000-000000000005',
  svc006: 'ee000001-0000-4000-8000-000000000006',
  svc007: 'ee000001-0000-4000-8000-000000000007',
  svc008: 'ee000001-0000-4000-8000-000000000008',
  svc009: 'ee000001-0000-4000-8000-000000000009',
  svc010: 'ee000001-0000-4000-8000-00000000000a',

  disc001: 'ff000001-0000-4000-8000-000000000001',
  disc002: 'ff000001-0000-4000-8000-000000000002',
  disc003: 'ff000001-0000-4000-8000-000000000003',
  disc004: 'ff000001-0000-4000-8000-000000000004',
  disc005: 'ff000001-0000-4000-8000-000000000005',
  disc006: 'ff000001-0000-4000-8000-000000000006',

  client001: 'c1000001-0000-4000-8000-000000000001',
  client002: 'c1000001-0000-4000-8000-000000000002',
  client003: 'c1000001-0000-4000-8000-000000000003',
  client004: 'c1000001-0000-4000-8000-000000000004',
  client005: 'c1000001-0000-4000-8000-000000000005',
  client006: 'c1000001-0000-4000-8000-000000000006',

  mahramElFassi: 'ab000001-0000-4000-8000-000000000001',
  mahramAlami: 'ab000001-0000-4000-8000-000000000002',
  mahramBenjelloun: 'ab000001-0000-4000-8000-000000000003',

  booking001: 'ac000001-0000-4000-8000-000000000001',
  booking002: 'ac000001-0000-4000-8000-000000000002',
  booking003: 'ac000001-0000-4000-8000-000000000003',
  booking004: 'ac000001-0000-4000-8000-000000000004',
  booking005: 'ac000001-0000-4000-8000-000000000005',
  booking006: 'ac000001-0000-4000-8000-000000000006',

  pkg001: 'ad000001-0000-4000-8000-000000000001',
  pkg002: 'ad000001-0000-4000-8000-000000000002',
  pkg003: 'ad000001-0000-4000-8000-000000000003',

  tpl001: 'ae000001-0000-4000-8000-000000000001',
  tpl002: 'ae000001-0000-4000-8000-000000000002',
};

/** Whole-stay bed prices (app stores stay totals, not per-night). */
const STAY = {
  makkahDouble: { purchase: 600 * 15, sell: 800 * 15 },
  makkahTriple: { purchase: 520 * 15, sell: 700 * 15 },
  makkahQuad: { purchase: 450 * 15, sell: 600 * 15 },
  madinahDouble: { purchase: 450 * 7, sell: 600 * 7 },
  madinahTriple: { purchase: 400 * 7, sell: 550 * 7 },
  madinahQuad: { purchase: 350 * 7, sell: 480 * 7 },
  safwaQuad: { purchase: 300 * 15, sell: 400 * 15 },
  noorQuad: { purchase: 180 * 7, sell: 240 * 7 },
  summerDouble: { purchase: 350 * 7, sell: 480 * 7 },
};

function holdExpiresAt(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 48);
  return d;
}

async function seedDemo() {
  if (process.env.SEED_DEMO === 'false' || process.env.SEED_DEMO === '0') {
    console.log('[seed:demo] SEED_DEMO=false — skipping demo data');
    return;
  }

  try {
    await runAsPlatform(async () => {
    const existing = await db('agencies').where({ id: AGENCY_ID }).first();
    if (existing) {
      console.log('[seed:demo] Al-Baraka demo agency already exists — skipping');
      return;
    }

    const emailTaken = await db('users').where({ email: 'ahmed@albaraka.ma' }).first();
    if (emailTaken) {
      console.log('[seed:demo] Demo user ahmed@albaraka.ma already exists — skipping');
      return;
    }

    console.log('[seed:demo] Seeding full Al-Baraka Travel demo…');
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    await db.transaction(async (trx) => {
      // ── Agency ──────────────────────────────────────────────────────────
      await trx('agencies').insert({
        id: AGENCY_ID,
        name: 'Al-Baraka Travel Agency',
        country: 'Morocco',
        status: 'active',
        subscription_plan: 'premium',
        logo_url: null,
      });

      // ── Branches ────────────────────────────────────────────────────────
      await trx('branches').insert([
        {
          id: IDS.branchHQ,
          agency_id: AGENCY_ID,
          name: 'Casablanca HQ',
          city: 'Casablanca',
          address: 'Boulevard Mohammed V, Casablanca',
          phone: '+212522123456',
          email: 'casa@albaraka.ma',
          contact_person: 'Ahmed Bennani',
          bank_name: 'Attijariwafa Bank',
          bank_account: '0077800001234567890123',
          bank_iban: 'MA640077800001234567890123',
          is_headquarters: true,
          is_active: true,
        },
        {
          id: IDS.branchRabat,
          agency_id: AGENCY_ID,
          name: 'Rabat Office',
          city: 'Rabat',
          address: 'Avenue Hassan II, Rabat',
          phone: '+212537123456',
          email: 'rabat@albaraka.ma',
          contact_person: 'Youssef Tazi',
          is_headquarters: false,
          is_active: true,
        },
        {
          id: IDS.branchMarrakech,
          agency_id: AGENCY_ID,
          name: 'Marrakech Office',
          city: 'Marrakech',
          address: 'Jemaa el-Fnaa, Marrakech',
          phone: '+212524123456',
          email: 'marrakech@albaraka.ma',
          contact_person: 'Khadija Idrissi',
          is_headquarters: false,
          is_active: true,
        },
      ]);

      // ── Users ───────────────────────────────────────────────────────────
      await trx('users').insert([
        {
          id: IDS.userAhmed,
          email: 'ahmed@albaraka.ma',
          password_hash: passwordHash,
          agency_id: AGENCY_ID,
          full_name: 'Ahmed Bennani',
          role: 'agency_admin',
          branch_id: IDS.branchHQ,
        },
        {
          id: IDS.userFatima,
          email: 'fatima@albaraka.ma',
          password_hash: passwordHash,
          agency_id: AGENCY_ID,
          full_name: 'Fatima Alaoui',
          role: 'manager',
          branch_id: IDS.branchHQ,
        },
        {
          id: IDS.userYoussef,
          email: 'youssef@albaraka.ma',
          password_hash: passwordHash,
          agency_id: AGENCY_ID,
          full_name: 'Youssef Tazi',
          role: 'agent',
          branch_id: IDS.branchRabat,
        },
        {
          id: IDS.userKhadija,
          email: 'khadija@albaraka.ma',
          password_hash: passwordHash,
          agency_id: AGENCY_ID,
          full_name: 'Khadija Idrissi',
          role: 'agent',
          branch_id: IDS.branchMarrakech,
        },
      ]);

      await trx('user_preferences').insert([
        { user_id: IDS.userAhmed, language: 'ar', theme: 'light' },
        { user_id: IDS.userFatima, language: 'fr', theme: 'light' },
        { user_id: IDS.userYoussef, language: 'ar', theme: 'light' },
        { user_id: IDS.userKhadija, language: 'fr', theme: 'light' },
      ]);

      // ── Seasons ─────────────────────────────────────────────────────────
      await trx('seasons').insert([
        {
          id: IDS.seasonRamadan,
          agency_id: AGENCY_ID,
          name: 'عمرة رمضان 2026',
          type: 'ramadan',
          start_date: '2026-03-01',
          end_date: '2026-04-15',
          status: 'active',
        },
        {
          id: IDS.seasonHajj,
          agency_id: AGENCY_ID,
          name: 'حج 2026',
          type: 'hajj',
          start_date: '2026-06-01',
          end_date: '2026-06-30',
          status: 'upcoming',
        },
        {
          id: IDS.seasonSummer,
          agency_id: AGENCY_ID,
          name: 'عمرة صيفية 2026',
          type: 'omra',
          start_date: '2026-07-01',
          end_date: '2026-09-30',
          status: 'upcoming',
        },
      ]);

      // ── Flights ─────────────────────────────────────────────────────────
      await trx('flights').insert([
        {
          id: IDS.flight001,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          code: 'RAM-350',
          departure_city: 'CMN',
          arrival_city: 'JED',
          departure_date: '2026-03-05',
          return_date: '2026-03-20',
          carrier: 'Royal Air Maroc',
          is_direct: true,
          total_duration_minutes: 330,
        },
        {
          id: IDS.flight002,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          code: 'RAM-352',
          departure_city: 'CMN',
          arrival_city: 'JED',
          departure_date: '2026-03-10',
          return_date: '2026-03-25',
          carrier: 'Royal Air Maroc',
          is_direct: true,
          total_duration_minutes: 330,
        },
        {
          id: IDS.flight003,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          code: 'SV-210',
          departure_city: 'CMN',
          arrival_city: 'MED',
          departure_date: '2026-03-08',
          return_date: '2026-03-23',
          carrier: 'Saudia',
          is_direct: false,
          total_duration_minutes: 480,
        },
        {
          id: IDS.flight004,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          code: 'RAM-354',
          departure_city: 'CMN',
          arrival_city: 'JED',
          departure_date: '2026-03-15',
          return_date: '2026-03-30',
          carrier: 'Royal Air Maroc',
          is_direct: true,
          total_duration_minutes: 330,
        },
        {
          id: IDS.flightSummer,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonSummer,
          code: 'AT-880',
          departure_city: 'CMN',
          arrival_city: 'JED',
          departure_date: '2026-08-01',
          return_date: '2026-08-15',
          carrier: 'Royal Air Maroc',
          is_direct: true,
          total_duration_minutes: 330,
        },
      ]);

      await trx('flight_transits').insert({
        flight_id: IDS.flight003,
        stop_order: 1,
        city: 'Riyadh',
        airport_code: 'RUH',
        arrival_time: '2026-03-08T14:30:00Z',
        departure_time: '2026-03-08T16:00:00Z',
        layover_minutes: 90,
        carrier: 'Saudia',
        flight_number: 'SV-1055',
        notes: 'Transit via Riyadh',
      });

      // ── Accommodations + room types ─────────────────────────────────────
      await trx('accommodations').insert([
        {
          id: IDS.hotel001,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          name: 'Dar Al-Tawhid InterContinental',
          name_ar: 'دار التوحيد انتركونتيننتال',
          city: 'Makkah',
          country: 'SA',
        },
        {
          id: IDS.hotel002,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          name: 'Swissotel Al Maqam',
          name_ar: 'سويس اوتيل المقام',
          city: 'Makkah',
          country: 'SA',
        },
        {
          id: IDS.hotel003,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          name: 'Al-Safwa Towers',
          name_ar: 'أبراج الصفوة',
          city: 'Makkah',
          country: 'SA',
        },
        {
          id: IDS.hotel004,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          name: 'Dar Al-Taqwa',
          name_ar: 'دار التقوى',
          city: 'Madinah',
          country: 'SA',
        },
        {
          id: IDS.hotel005,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          name: 'Anwar Al-Madinah Mövenpick',
          name_ar: 'أنوار المدينة موفنبيك',
          city: 'Madinah',
          country: 'SA',
        },
        {
          id: IDS.hotel006,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          name: 'Al-Noor Hotel',
          name_ar: 'فندق النور',
          city: 'Madinah',
          country: 'SA',
        },
        {
          id: IDS.hotelSummer,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonSummer,
          name: 'Pullman ZamZam Makkah',
          name_ar: 'بولمان زمزم مكة',
          city: 'Makkah',
          country: 'SA',
        },
      ]);

      await trx('room_types').insert([
        { id: IDS.rt001, accommodation_id: IDS.hotel001, type: 'double', total_rooms: 15, total_beds: 30, price_per_bed: 800 },
        { id: IDS.rt002, accommodation_id: IDS.hotel001, type: 'triple', total_rooms: 10, total_beds: 30, price_per_bed: 700 },
        { id: IDS.rt003, accommodation_id: IDS.hotel001, type: 'quad', total_rooms: 8, total_beds: 32, price_per_bed: 600 },
        { id: IDS.rt004, accommodation_id: IDS.hotel001, type: 'quint', total_rooms: 5, total_beds: 25, price_per_bed: 500 },
        { id: IDS.rtSwissD, accommodation_id: IDS.hotel002, type: 'double', total_rooms: 12, total_beds: 24, price_per_bed: 750 },
        { id: IDS.rtSwissT, accommodation_id: IDS.hotel002, type: 'triple', total_rooms: 8, total_beds: 24, price_per_bed: 650 },
        { id: IDS.rt005, accommodation_id: IDS.hotel003, type: 'double', total_rooms: 20, total_beds: 40, price_per_bed: 500 },
        { id: IDS.rt006, accommodation_id: IDS.hotel003, type: 'triple', total_rooms: 15, total_beds: 45, price_per_bed: 450 },
        { id: IDS.rt007, accommodation_id: IDS.hotel003, type: 'quad', total_rooms: 10, total_beds: 40, price_per_bed: 400 },
        { id: IDS.rt008, accommodation_id: IDS.hotel004, type: 'double', total_rooms: 12, total_beds: 24, price_per_bed: 600 },
        { id: IDS.rt009, accommodation_id: IDS.hotel004, type: 'triple', total_rooms: 10, total_beds: 30, price_per_bed: 550 },
        { id: IDS.rt010, accommodation_id: IDS.hotel004, type: 'quad', total_rooms: 8, total_beds: 32, price_per_bed: 480 },
        { id: IDS.rtAnwarD, accommodation_id: IDS.hotel005, type: 'double', total_rooms: 10, total_beds: 20, price_per_bed: 550 },
        { id: IDS.rtAnwarT, accommodation_id: IDS.hotel005, type: 'triple', total_rooms: 8, total_beds: 24, price_per_bed: 500 },
        { id: IDS.rt011, accommodation_id: IDS.hotel006, type: 'double', total_rooms: 25, total_beds: 50, price_per_bed: 300 },
        { id: IDS.rt012, accommodation_id: IDS.hotel006, type: 'triple', total_rooms: 20, total_beds: 60, price_per_bed: 270 },
        { id: IDS.rt013, accommodation_id: IDS.hotel006, type: 'quad', total_rooms: 15, total_beds: 60, price_per_bed: 240 },
        { id: IDS.rtSummerD, accommodation_id: IDS.hotelSummer, type: 'double', total_rooms: 10, total_beds: 20, price_per_bed: 550 },
        { id: IDS.rtSummerT, accommodation_id: IDS.hotelSummer, type: 'triple', total_rooms: 8, total_beds: 24, price_per_bed: 480 },
      ]);

      // ── Flight seat inventory ───────────────────────────────────────────
      await trx('flight_seat_inventory').insert([
        {
          id: IDS.fsi001,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight001,
          seats_purchased: 50,
          purchase_price_per_seat: 7500,
          sell_price_per_seat: 9500,
          seat_class: 'economy',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.fsi002,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight001,
          seats_purchased: 10,
          purchase_price_per_seat: 15000,
          sell_price_per_seat: 20000,
          seat_class: 'business',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.fsi003,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight002,
          seats_purchased: 45,
          purchase_price_per_seat: 7500,
          sell_price_per_seat: 9500,
          seat_class: 'economy',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.fsi004,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight003,
          seats_purchased: 60,
          purchase_price_per_seat: 7000,
          sell_price_per_seat: 8500,
          seat_class: 'economy',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.fsi005,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight004,
          seats_purchased: 50,
          purchase_price_per_seat: 7500,
          sell_price_per_seat: 9500,
          seat_class: 'economy',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.fsiSummer,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonSummer,
          flight_id: IDS.flightSummer,
          seats_purchased: 40,
          purchase_price_per_seat: 7200,
          sell_price_per_seat: 9000,
          seat_class: 'economy',
          created_by: IDS.userAhmed,
        },
      ]);

      // ── Hotel bed inventory (prices = whole stay) ───────────────────────
      await trx('hotel_bed_inventory').insert([
        {
          id: IDS.hbi001,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          accommodation_id: IDS.hotel001,
          room_type_id: IDS.rt001,
          beds_purchased: 20,
          purchase_price_per_bed: STAY.makkahDouble.purchase,
          sell_price_per_bed: STAY.makkahDouble.sell,
          check_in_date: '2026-03-05',
          check_out_date: '2026-03-20',
          supplier_name: 'Dar Al-Tawhid InterContinental',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.hbi002,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          accommodation_id: IDS.hotel001,
          room_type_id: IDS.rt002,
          beds_purchased: 24,
          purchase_price_per_bed: STAY.makkahTriple.purchase,
          sell_price_per_bed: STAY.makkahTriple.sell,
          check_in_date: '2026-03-05',
          check_out_date: '2026-03-20',
          supplier_name: 'Dar Al-Tawhid InterContinental',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.hbi003,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          accommodation_id: IDS.hotel001,
          room_type_id: IDS.rt003,
          beds_purchased: 24,
          purchase_price_per_bed: STAY.makkahQuad.purchase,
          sell_price_per_bed: STAY.makkahQuad.sell,
          check_in_date: '2026-03-05',
          check_out_date: '2026-03-20',
          supplier_name: 'Dar Al-Tawhid InterContinental',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.hbi004,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          accommodation_id: IDS.hotel004,
          room_type_id: IDS.rt008,
          beds_purchased: 16,
          purchase_price_per_bed: STAY.madinahDouble.purchase,
          sell_price_per_bed: STAY.madinahDouble.sell,
          check_in_date: '2026-03-05',
          check_out_date: '2026-03-12',
          supplier_name: 'Dar Al-Taqwa',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.hbi005,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          accommodation_id: IDS.hotel004,
          room_type_id: IDS.rt009,
          beds_purchased: 21,
          purchase_price_per_bed: STAY.madinahTriple.purchase,
          sell_price_per_bed: STAY.madinahTriple.sell,
          check_in_date: '2026-03-05',
          check_out_date: '2026-03-12',
          supplier_name: 'Dar Al-Taqwa',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.hbi006,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          accommodation_id: IDS.hotel004,
          room_type_id: IDS.rt010,
          beds_purchased: 20,
          purchase_price_per_bed: STAY.madinahQuad.purchase,
          sell_price_per_bed: STAY.madinahQuad.sell,
          check_in_date: '2026-03-05',
          check_out_date: '2026-03-12',
          supplier_name: 'Dar Al-Taqwa',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.hbiSafwa,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          accommodation_id: IDS.hotel003,
          room_type_id: IDS.rt007,
          beds_purchased: 20,
          purchase_price_per_bed: STAY.safwaQuad.purchase,
          sell_price_per_bed: STAY.safwaQuad.sell,
          check_in_date: '2026-03-08',
          check_out_date: '2026-03-23',
          supplier_name: 'Al-Safwa Towers',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.hbiNoor,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          accommodation_id: IDS.hotel006,
          room_type_id: IDS.rt013,
          beds_purchased: 20,
          purchase_price_per_bed: STAY.noorQuad.purchase,
          sell_price_per_bed: STAY.noorQuad.sell,
          check_in_date: '2026-03-08',
          check_out_date: '2026-03-15',
          supplier_name: 'Al-Noor Hotel',
          created_by: IDS.userAhmed,
        },
        {
          id: IDS.hbiSummer,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonSummer,
          accommodation_id: IDS.hotelSummer,
          room_type_id: IDS.rtSummerD,
          beds_purchased: 16,
          purchase_price_per_bed: STAY.summerDouble.purchase,
          sell_price_per_bed: STAY.summerDouble.sell,
          check_in_date: '2026-08-01',
          check_out_date: '2026-08-08',
          supplier_name: 'Pullman ZamZam Makkah',
          created_by: IDS.userAhmed,
        },
      ]);

      // ── Packages (templates) ────────────────────────────────────────────
      await trx('packages').insert([
        {
          id: IDS.pkg001,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          name: 'باقة رمضان فاخرة - دار التوحيد',
          accommodation_id: IDS.hotel001,
          room_type: 'triple',
          includes_visa: true,
          includes_transport: true,
          price: 25000,
          is_template: true,
        },
        {
          id: IDS.pkg002,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          name: 'باقة رمضان اقتصادية - الصفوة',
          accommodation_id: IDS.hotel003,
          room_type: 'quad',
          includes_visa: true,
          includes_transport: true,
          price: 16500,
          is_template: true,
        },
        {
          id: IDS.pkg003,
          agency_id: AGENCY_ID,
          season_id: IDS.seasonSummer,
          name: 'باقة صيفية - بولمان زمزم',
          accommodation_id: IDS.hotelSummer,
          room_type: 'double',
          includes_visa: true,
          includes_transport: true,
          price: 18000,
          is_template: true,
        },
      ]);

      // ── Extra services ──────────────────────────────────────────────────
      await trx('extra_services').insert([
        { id: IDS.svc001, agency_id: AGENCY_ID, name: 'Airport Transfer (Round-trip)', name_ar: 'نقل المطار (ذهاب وإياب)', category: 'transport', price: 500, is_active: true },
        { id: IDS.svc002, agency_id: AGENCY_ID, name: 'Private Guide (Per Day)', name_ar: 'مرشد خاص (يومي)', category: 'guide', price: 800, is_active: true },
        { id: IDS.svc003, agency_id: AGENCY_ID, name: 'Ziyarat Makkah Tour', name_ar: 'جولة زيارات مكة', category: 'tours', price: 400, is_active: true },
        { id: IDS.svc004, agency_id: AGENCY_ID, name: 'Ziyarat Madinah Tour', name_ar: 'جولة زيارات المدينة', category: 'tours', price: 350, is_active: true },
        { id: IDS.svc005, agency_id: AGENCY_ID, name: 'Travel Insurance', name_ar: 'تأمين السفر', category: 'insurance', price: 300, is_active: true },
        { id: IDS.svc006, agency_id: AGENCY_ID, name: 'Meal Package (15 days)', name_ar: 'وجبات (15 يوم)', category: 'meals', price: 1500, is_active: true },
        { id: IDS.svc007, agency_id: AGENCY_ID, name: 'Zamzam Water (5L)', name_ar: 'ماء زمزم (5 لتر)', category: 'other', price: 100, is_active: true },
        { id: IDS.svc008, agency_id: AGENCY_ID, name: 'SIM Card with Data', name_ar: 'شريحة اتصال مع انترنت', category: 'other', price: 150, is_active: true },
        { id: IDS.svc009, agency_id: AGENCY_ID, name: 'Wheelchair Assistance', name_ar: 'خدمة الكرسي المتحرك', category: 'other', price: 1000, is_active: true },
        { id: IDS.svc010, agency_id: AGENCY_ID, name: 'VIP Lounge Access', name_ar: 'صالة كبار الشخصيات', category: 'other', price: 600, is_active: true },
      ]);

      // ── Discounts ───────────────────────────────────────────────────────
      await trx('discount_settings').insert([
        { id: IDS.disc001, agency_id: AGENCY_ID, name: 'Early Bird (30+ days)', name_ar: 'حجز مبكر', discount_type: 'percent', discount_value: 5, max_discount_amount: 2000, min_booking_amount: 20000, is_default: true, is_active: true, sort_order: 1, created_by: IDS.userAhmed },
        { id: IDS.disc002, agency_id: AGENCY_ID, name: 'Family Discount (4+)', name_ar: 'خصم عائلي', discount_type: 'percent', discount_value: 10, max_discount_amount: 5000, min_booking_amount: 50000, is_default: false, is_active: true, sort_order: 2, created_by: IDS.userAhmed },
        { id: IDS.disc003, agency_id: AGENCY_ID, name: 'Returning Customer', name_ar: 'عميل عائد', discount_type: 'percent', discount_value: 3, max_discount_amount: 1500, min_booking_amount: 15000, is_default: false, is_active: true, sort_order: 3, created_by: IDS.userAhmed },
        { id: IDS.disc004, agency_id: AGENCY_ID, name: 'Senior Citizen (65+)', name_ar: 'كبار السن', discount_type: 'fixed', discount_value: 500, max_discount_amount: null, min_booking_amount: 10000, is_default: false, is_active: true, sort_order: 4, created_by: IDS.userAhmed },
        { id: IDS.disc005, agency_id: AGENCY_ID, name: 'Student Discount', name_ar: 'خصم الطلاب', discount_type: 'percent', discount_value: 7, max_discount_amount: 2500, min_booking_amount: 15000, is_default: false, is_active: true, sort_order: 5, created_by: IDS.userAhmed },
        { id: IDS.disc006, agency_id: AGENCY_ID, name: 'Group Booking (10+)', name_ar: 'حجز جماعي', discount_type: 'percent', discount_value: 15, max_discount_amount: 10000, min_booking_amount: 100000, is_default: false, is_active: true, sort_order: 6, created_by: IDS.userAhmed },
      ]);

      const allDiscs = [IDS.disc001, IDS.disc002, IDS.disc003, IDS.disc004, IDS.disc005, IDS.disc006];
      await trx('user_discount_permissions').insert([
        ...allDiscs.map((d) => ({
          user_id: IDS.userAhmed,
          discount_setting_id: d,
          usage_limit: null,
          usage_count: 0,
          reset_period: 'never',
          granted_by: IDS.userAhmed,
        })),
        { user_id: IDS.userFatima, discount_setting_id: IDS.disc001, usage_limit: 10, usage_count: 3, reset_period: 'monthly', granted_by: IDS.userAhmed },
        { user_id: IDS.userFatima, discount_setting_id: IDS.disc002, usage_limit: 10, usage_count: 3, reset_period: 'monthly', granted_by: IDS.userAhmed },
        { user_id: IDS.userFatima, discount_setting_id: IDS.disc003, usage_limit: 10, usage_count: 3, reset_period: 'monthly', granted_by: IDS.userAhmed },
        { user_id: IDS.userYoussef, discount_setting_id: IDS.disc001, usage_limit: 5, usage_count: 1, reset_period: 'monthly', granted_by: IDS.userAhmed },
        { user_id: IDS.userYoussef, discount_setting_id: IDS.disc003, usage_limit: 5, usage_count: 1, reset_period: 'monthly', granted_by: IDS.userAhmed },
        { user_id: IDS.userKhadija, discount_setting_id: IDS.disc001, usage_limit: 3, usage_count: 0, reset_period: 'monthly', granted_by: IDS.userAhmed },
      ]);

      // ── Clients ─────────────────────────────────────────────────────────
      await trx('clients').insert([
        { id: IDS.client001, agency_id: AGENCY_ID, branch_id: IDS.branchHQ, full_name: 'Mohammed El Fassi', full_name_ar: 'محمد الفاسي', phone: '+212661123456', email: 'm.elfassi@email.com', address: 'Casablanca', id_number: 'BE123456' },
        { id: IDS.client002, agency_id: AGENCY_ID, branch_id: IDS.branchHQ, full_name: 'Aicha Benjelloun', full_name_ar: 'عائشة بنجلون', phone: '+212662234567', email: 'aicha.b@email.com', address: 'Casablanca', id_number: 'BE234567' },
        { id: IDS.client003, agency_id: AGENCY_ID, branch_id: IDS.branchRabat, full_name: 'Omar Chraibi', full_name_ar: 'عمر الشرايبي', phone: '+212663345678', email: 'omar.c@email.com', address: 'Rabat', id_number: 'BE345678' },
        { id: IDS.client004, agency_id: AGENCY_ID, branch_id: IDS.branchMarrakech, full_name: 'Fatima Zahra Alami', full_name_ar: 'فاطمة الزهراء العلمي', phone: '+212664456789', email: 'fz.alami@email.com', address: 'Marrakech', id_number: 'BE456789' },
        { id: IDS.client005, agency_id: AGENCY_ID, branch_id: IDS.branchHQ, full_name: 'Rachid Benkirane', full_name_ar: 'رشيد بنكيران', phone: '+212665567890', email: 'rachid.b@email.com', address: 'Casablanca', id_number: 'BE567890' },
        { id: IDS.client006, agency_id: AGENCY_ID, branch_id: IDS.branchRabat, full_name: 'Sara Mansouri', full_name_ar: 'سارة منصوري', phone: '+212666678901', email: 'sara.m@email.com', address: 'Salé', id_number: 'BE678901', notes: 'Cancelled booking client' },
      ]);

      await trx('mahram_groups').insert([
        { id: IDS.mahramElFassi, agency_id: AGENCY_ID, name: 'عائلة الفاسي' },
        { id: IDS.mahramAlami, agency_id: AGENCY_ID, name: 'عائلة العلمي' },
        { id: IDS.mahramBenjelloun, agency_id: AGENCY_ID, name: 'عائلة بنجلون' },
      ]);

      // ── Bookings ────────────────────────────────────────────────────────
      const holdExp = holdExpiresAt();

      await trx('bookings').insert([
        {
          id: IDS.booking001,
          booking_number: 'BK-2026-0001',
          agency_id: AGENCY_ID,
          branch_id: IDS.branchHQ,
          client_id: IDS.client001,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight001,
          accommodation_id: IDS.hotel001,
          room_type_id: IDS.rt002,
          flight_seat_inventory_id: IDS.fsi001,
          hotel_inventory_ids: [IDS.hbi002, IDS.hbi005],
          same_selection_for_all: true,
          status: 'confirmed',
          total_amount: 0,
          paid_amount: 0,
          notes: 'El Fassi family — partial payment',
          created_by: IDS.userFatima,
          confirmed_at: '2026-02-10T10:00:00Z',
        },
        {
          id: IDS.booking002,
          booking_number: 'BK-2026-0002',
          agency_id: AGENCY_ID,
          branch_id: IDS.branchHQ,
          client_id: IDS.client002,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight001,
          accommodation_id: IDS.hotel001,
          room_type_id: IDS.rt001,
          flight_seat_inventory_id: IDS.fsi001,
          hotel_inventory_ids: [IDS.hbi001, IDS.hbi004],
          same_selection_for_all: true,
          status: 'paid',
          total_amount: 0,
          paid_amount: 0,
          notes: 'Benjelloun couple — fully paid',
          created_by: IDS.userAhmed,
          confirmed_at: '2026-02-12T11:00:00Z',
        },
        {
          id: IDS.booking003,
          booking_number: 'BK-2026-0003',
          agency_id: AGENCY_ID,
          branch_id: IDS.branchRabat,
          client_id: IDS.client003,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight003,
          accommodation_id: IDS.hotel003,
          room_type_id: IDS.rt007,
          flight_seat_inventory_id: IDS.fsi004,
          hotel_inventory_ids: [IDS.hbiSafwa, IDS.hbiNoor],
          same_selection_for_all: true,
          status: 'pending',
          total_amount: 0,
          paid_amount: 0,
          notes: 'Omar Chraibi — advance only',
          created_by: IDS.userYoussef,
        },
        {
          id: IDS.booking004,
          booking_number: 'BK-2026-0004',
          agency_id: AGENCY_ID,
          branch_id: IDS.branchMarrakech,
          client_id: IDS.client004,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight002,
          accommodation_id: IDS.hotel001,
          room_type_id: IDS.rt003,
          flight_seat_inventory_id: IDS.fsi003,
          hotel_inventory_ids: [IDS.hbi003, IDS.hbi006],
          same_selection_for_all: true,
          status: 'confirmed',
          total_amount: 0,
          paid_amount: 0,
          notes: 'Alami extended family — 8 pilgrims',
          created_by: IDS.userKhadija,
          confirmed_at: '2026-02-15T09:00:00Z',
        },
        {
          id: IDS.booking005,
          booking_number: 'BK-2026-0005',
          agency_id: AGENCY_ID,
          branch_id: IDS.branchHQ,
          client_id: IDS.client005,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight004,
          accommodation_id: IDS.hotel001,
          room_type_id: IDS.rt001,
          flight_seat_inventory_id: IDS.fsi005,
          hotel_inventory_ids: [IDS.hbi001],
          same_selection_for_all: true,
          status: 'draft',
          total_amount: 0,
          paid_amount: 0,
          notes: 'Draft with active inventory hold',
          created_by: IDS.userFatima,
          hold_expires_at: holdExp.toISOString(),
          hold_session_id: 'demo-hold-session-benkirane',
        },
        {
          id: IDS.booking006,
          booking_number: 'BK-2026-0006',
          agency_id: AGENCY_ID,
          branch_id: IDS.branchRabat,
          client_id: IDS.client006,
          season_id: IDS.seasonRamadan,
          flight_id: IDS.flight004,
          accommodation_id: IDS.hotel003,
          room_type_id: IDS.rt005,
          flight_seat_inventory_id: IDS.fsi005,
          hotel_inventory_ids: null,
          same_selection_for_all: true,
          status: 'cancelled',
          total_amount: 0,
          paid_amount: 0,
          notes: 'Cancelled by client before confirmation',
          created_by: IDS.userYoussef,
          deletion_reason: null,
        },
      ]);

      // Pilgrim IDs
      const P = {
        p01: 'af000001-0000-4000-8000-000000000001',
        p02: 'af000001-0000-4000-8000-000000000002',
        p03: 'af000001-0000-4000-8000-000000000003',
        p04: 'af000001-0000-4000-8000-000000000004',
        p05: 'af000001-0000-4000-8000-000000000005',
        p06: 'af000001-0000-4000-8000-000000000006',
        p07: 'af000001-0000-4000-8000-000000000007',
        p08: 'af000001-0000-4000-8000-000000000008',
        p09: 'af000001-0000-4000-8000-000000000009',
        p10: 'af000001-0000-4000-8000-00000000000a',
        p11: 'af000001-0000-4000-8000-00000000000b',
        p12: 'af000001-0000-4000-8000-00000000000c',
        p13: 'af000001-0000-4000-8000-00000000000d',
        p14: 'af000001-0000-4000-8000-00000000000e',
        p15: 'af000001-0000-4000-8000-00000000000f',
        p16: 'af000001-0000-4000-8000-000000000010',
        p17: 'af000001-0000-4000-8000-000000000011',
      };

      // ── Pilgrims ────────────────────────────────────────────────────────
      await trx('pilgrims').insert([
        // Booking 1 — El Fassi
        {
          id: P.p01, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight001,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt002, booking_id: IDS.booking001,
          client_id: IDS.client001, mahram_group_id: IDS.mahramElFassi,
          flight_seat_inventory_id: IDS.fsi001, hotel_inventory_ids: [IDS.hbi002, IDS.hbi005],
          full_name: 'Mohammed El Fassi', full_name_ar: 'محمد الفاسي', passport_number: 'MA1234567',
          phone: '+212661123456', gender: 'male', date_of_birth: '1970-05-15',
          relationship_type: 'family', is_mahram: true, agreed_price: 24150, status: 'confirmed',
        },
        {
          id: P.p02, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight001,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt002, booking_id: IDS.booking001,
          client_id: IDS.client001, mahram_group_id: IDS.mahramElFassi, spouse_id: P.p01,
          flight_seat_inventory_id: IDS.fsi001, hotel_inventory_ids: [IDS.hbi002, IDS.hbi005],
          full_name: 'Khadija El Fassi', full_name_ar: 'خديجة الفاسي', passport_number: 'MA1234568',
          gender: 'female', date_of_birth: '1975-08-20',
          relationship_type: 'married', is_mahram: false, agreed_price: 24150, status: 'confirmed',
        },
        {
          id: P.p03, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight001,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt002, booking_id: IDS.booking001,
          client_id: IDS.client001, mahram_group_id: IDS.mahramElFassi, parent_id: P.p01,
          flight_seat_inventory_id: IDS.fsi001, hotel_inventory_ids: [IDS.hbi002, IDS.hbi005],
          full_name: 'Youssef El Fassi', full_name_ar: 'يوسف الفاسي', passport_number: 'MA1234569',
          gender: 'male', date_of_birth: '1998-03-10',
          relationship_type: 'family', is_mahram: true, agreed_price: 24150, status: 'confirmed',
        },
        {
          id: P.p04, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight001,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt002, booking_id: IDS.booking001,
          client_id: IDS.client001, mahram_group_id: IDS.mahramElFassi, parent_id: P.p01,
          flight_seat_inventory_id: IDS.fsi001, hotel_inventory_ids: [IDS.hbi002, IDS.hbi005],
          full_name: 'Fatima El Fassi', full_name_ar: 'فاطمة الفاسي', passport_number: 'MA1234570',
          gender: 'female', date_of_birth: '2000-11-25',
          relationship_type: 'family', is_mahram: false, agreed_price: 24150, status: 'confirmed',
        },
        // Booking 2 — Benjelloun
        {
          id: P.p05, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight001,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt001, booking_id: IDS.booking002,
          client_id: IDS.client002, mahram_group_id: IDS.mahramBenjelloun,
          flight_seat_inventory_id: IDS.fsi001, hotel_inventory_ids: [IDS.hbi001, IDS.hbi004],
          full_name: 'Aicha Benjelloun', full_name_ar: 'عائشة بنجلون', passport_number: 'MA2345678',
          phone: '+212662234567', gender: 'female', date_of_birth: '1965-02-14',
          relationship_type: 'married', is_mahram: false, agreed_price: 26500, status: 'confirmed',
        },
        {
          id: P.p06, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight001,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt001, booking_id: IDS.booking002,
          client_id: IDS.client002, mahram_group_id: IDS.mahramBenjelloun, spouse_id: P.p05,
          flight_seat_inventory_id: IDS.fsi001, hotel_inventory_ids: [IDS.hbi001, IDS.hbi004],
          full_name: 'Hassan Benjelloun', full_name_ar: 'حسن بنجلون', passport_number: 'MA2345679',
          gender: 'male', date_of_birth: '1962-09-30',
          relationship_type: 'married', is_mahram: true, agreed_price: 26500, status: 'confirmed',
        },
        // Booking 3 — Chraibi
        {
          id: P.p07, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight003,
          accommodation_id: IDS.hotel003, room_type_id: IDS.rt007, booking_id: IDS.booking003,
          client_id: IDS.client003,
          flight_seat_inventory_id: IDS.fsi004, hotel_inventory_ids: [IDS.hbiSafwa, IDS.hbiNoor],
          full_name: 'Omar Chraibi', full_name_ar: 'عمر الشرايبي', passport_number: 'MA3456789',
          phone: '+212663345678', gender: 'male', date_of_birth: '1985-07-22',
          relationship_type: 'family', is_mahram: true, agreed_price: 16680, status: 'pending',
        },
        // Booking 4 — Alami (8)
        {
          id: P.p08, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight002,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt003, booking_id: IDS.booking004,
          client_id: IDS.client004, mahram_group_id: IDS.mahramAlami,
          flight_seat_inventory_id: IDS.fsi003, hotel_inventory_ids: [IDS.hbi003, IDS.hbi006],
          full_name: 'Driss Alami', full_name_ar: 'دريس العلمي', passport_number: 'MA4567801',
          gender: 'male', date_of_birth: '1955-01-10',
          relationship_type: 'family', is_mahram: true, agreed_price: 24160, status: 'confirmed',
        },
        {
          id: P.p09, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight002,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt003, booking_id: IDS.booking004,
          client_id: IDS.client004, mahram_group_id: IDS.mahramAlami, spouse_id: P.p08,
          flight_seat_inventory_id: IDS.fsi003, hotel_inventory_ids: [IDS.hbi003, IDS.hbi006],
          full_name: 'Fatima Zahra Alami', full_name_ar: 'فاطمة الزهراء العلمي', passport_number: 'MA4567802',
          phone: '+212664456789', gender: 'female', date_of_birth: '1960-04-05',
          relationship_type: 'married', is_mahram: false, agreed_price: 24160, status: 'confirmed',
        },
        {
          id: P.p10, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight002,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt003, booking_id: IDS.booking004,
          client_id: IDS.client004, mahram_group_id: IDS.mahramAlami, parent_id: P.p08,
          flight_seat_inventory_id: IDS.fsi003, hotel_inventory_ids: [IDS.hbi003, IDS.hbi006],
          full_name: 'Karim Alami', full_name_ar: 'كريم العلمي', passport_number: 'MA4567803',
          gender: 'male', date_of_birth: '1980-06-15',
          relationship_type: 'family', is_mahram: true, agreed_price: 24160, status: 'confirmed',
        },
        {
          id: P.p11, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight002,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt003, booking_id: IDS.booking004,
          client_id: IDS.client004, mahram_group_id: IDS.mahramAlami, spouse_id: P.p10,
          flight_seat_inventory_id: IDS.fsi003, hotel_inventory_ids: [IDS.hbi003, IDS.hbi006],
          full_name: 'Naima Alami', full_name_ar: 'نعيمة العلمي', passport_number: 'MA4567804',
          gender: 'female', date_of_birth: '1983-09-20',
          relationship_type: 'married', is_mahram: false, agreed_price: 24160, status: 'confirmed',
        },
        {
          id: P.p12, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight002,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt003, booking_id: IDS.booking004,
          client_id: IDS.client004, mahram_group_id: IDS.mahramAlami, parent_id: P.p08,
          flight_seat_inventory_id: IDS.fsi003, hotel_inventory_ids: [IDS.hbi003, IDS.hbi006],
          full_name: 'Samir Alami', full_name_ar: 'سمير العلمي', passport_number: 'MA4567805',
          gender: 'male', date_of_birth: '1985-12-08',
          relationship_type: 'family', is_mahram: true, agreed_price: 24160, status: 'confirmed',
        },
        {
          id: P.p13, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight002,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt003, booking_id: IDS.booking004,
          client_id: IDS.client004, mahram_group_id: IDS.mahramAlami, spouse_id: P.p12,
          flight_seat_inventory_id: IDS.fsi003, hotel_inventory_ids: [IDS.hbi003, IDS.hbi006],
          full_name: 'Laila Alami', full_name_ar: 'ليلى العلمي', passport_number: 'MA4567806',
          gender: 'female', date_of_birth: '1988-03-25',
          relationship_type: 'married', is_mahram: false, agreed_price: 24160, status: 'confirmed',
        },
        {
          id: P.p14, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight002,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt003, booking_id: IDS.booking004,
          client_id: IDS.client004, mahram_group_id: IDS.mahramAlami, parent_id: P.p10,
          flight_seat_inventory_id: IDS.fsi003, hotel_inventory_ids: [IDS.hbi003, IDS.hbi006],
          full_name: 'Hamza Alami', full_name_ar: 'حمزة العلمي', passport_number: 'MA4567807',
          gender: 'male', date_of_birth: '2005-07-12',
          relationship_type: 'family', is_mahram: true, agreed_price: 24160, status: 'confirmed',
        },
        {
          id: P.p15, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight002,
          accommodation_id: IDS.hotel001, room_type_id: IDS.rt003, booking_id: IDS.booking004,
          client_id: IDS.client004, mahram_group_id: IDS.mahramAlami, parent_id: P.p10,
          flight_seat_inventory_id: IDS.fsi003, hotel_inventory_ids: [IDS.hbi003, IDS.hbi006],
          full_name: 'Yasmine Alami', full_name_ar: 'ياسمين العلمي', passport_number: 'MA4567808',
          gender: 'female', date_of_birth: '2008-11-30',
          relationship_type: 'family', is_mahram: false, agreed_price: 24160, status: 'confirmed',
        },
        // Booking 5 draft — no pilgrims yet (hold only)
        // Booking 6 cancelled — placeholder pilgrim
        {
          id: P.p16, agency_id: AGENCY_ID, season_id: IDS.seasonRamadan, flight_id: IDS.flight004,
          accommodation_id: IDS.hotel003, room_type_id: IDS.rt005, booking_id: IDS.booking006,
          client_id: IDS.client006,
          full_name: 'Sara Mansouri', full_name_ar: 'سارة منصوري', passport_number: 'MA5678901',
          phone: '+212666678901', gender: 'female', date_of_birth: '1992-04-18',
          relationship_type: 'family', is_mahram: false, agreed_price: 0, status: 'cancelled',
        },
      ]);

      // Fix spouse links that need reverse (p05 spouse is p06 — already set from p06 side via spouse_id on p06)
      await trx('pilgrims').where({ id: P.p05 }).update({ spouse_id: P.p06 });
      await trx('pilgrims').where({ id: P.p02 }).update({ spouse_id: P.p01 });

      // ── Invoice items (triggers update booking.total_amount) ────────────
      const invoiceRows: Array<Record<string, unknown>> = [
        // Booking 1 — 96,600 after discount
        { booking_id: IDS.booking001, item_type: 'package', description: 'Flight RAM-350 Economy', quantity: 4, unit_price: 9500 },
        { booking_id: IDS.booking001, item_type: 'package', description: 'Makkah - Dar Al-Tawhid (Triple, 15N)', quantity: 4, unit_price: 10500 },
        { booking_id: IDS.booking001, item_type: 'package', description: 'Madinah - Dar Al-Taqwa (Triple, 7N)', quantity: 4, unit_price: 3850 },
        { booking_id: IDS.booking001, item_type: 'service', description: 'Airport Transfer', quantity: 4, unit_price: 500, extra_service_id: IDS.svc001 },
        { booking_id: IDS.booking001, item_type: 'service', description: 'Ziyarat Makkah Tour', quantity: 4, unit_price: 400, extra_service_id: IDS.svc003 },
        { booking_id: IDS.booking001, item_type: 'service', description: 'Ziyarat Madinah Tour', quantity: 4, unit_price: 350, extra_service_id: IDS.svc004 },
        { booking_id: IDS.booking001, item_type: 'service', description: 'Travel Insurance', quantity: 4, unit_price: 300, extra_service_id: IDS.svc005 },
        { booking_id: IDS.booking001, item_type: 'discount', description: 'Family Discount (10%, capped)', quantity: 1, unit_price: -5000 },
        // Booking 2 — 53,000
        { booking_id: IDS.booking002, item_type: 'package', description: 'Flight RAM-350 Economy', quantity: 2, unit_price: 9500 },
        { booking_id: IDS.booking002, item_type: 'package', description: 'Makkah - Dar Al-Tawhid (Double, 15N)', quantity: 2, unit_price: 12000 },
        { booking_id: IDS.booking002, item_type: 'package', description: 'Madinah - Dar Al-Taqwa (Double, 7N)', quantity: 2, unit_price: 4200 },
        { booking_id: IDS.booking002, item_type: 'service', description: 'Airport Transfer', quantity: 2, unit_price: 500, extra_service_id: IDS.svc001 },
        { booking_id: IDS.booking002, item_type: 'service', description: 'Travel Insurance', quantity: 2, unit_price: 300, extra_service_id: IDS.svc005 },
        { booking_id: IDS.booking002, item_type: 'service', description: 'Wheelchair Assistance', quantity: 1, unit_price: 1000, extra_service_id: IDS.svc009 },
        { booking_id: IDS.booking002, item_type: 'discount', description: 'Senior Citizen Discount', quantity: 2, unit_price: -500 },
        // Booking 3 — 16,680
        { booking_id: IDS.booking003, item_type: 'package', description: 'Flight SV-210 Economy', quantity: 1, unit_price: 8500 },
        { booking_id: IDS.booking003, item_type: 'package', description: 'Makkah - Al-Safwa Towers (Quad, 15N)', quantity: 1, unit_price: 6000 },
        { booking_id: IDS.booking003, item_type: 'package', description: 'Madinah - Al-Noor Hotel (Quad, 7N)', quantity: 1, unit_price: 1680 },
        { booking_id: IDS.booking003, item_type: 'service', description: 'Airport Transfer', quantity: 1, unit_price: 500, extra_service_id: IDS.svc001 },
        // Booking 4 — 193,280
        { booking_id: IDS.booking004, item_type: 'package', description: 'Flight RAM-352 Economy', quantity: 8, unit_price: 9500 },
        { booking_id: IDS.booking004, item_type: 'package', description: 'Makkah - Dar Al-Tawhid (Quad, 15N)', quantity: 8, unit_price: 9000 },
        { booking_id: IDS.booking004, item_type: 'package', description: 'Madinah - Dar Al-Taqwa (Quad, 7N)', quantity: 8, unit_price: 3360 },
        { booking_id: IDS.booking004, item_type: 'service', description: 'Airport Transfer', quantity: 8, unit_price: 500, extra_service_id: IDS.svc001 },
        { booking_id: IDS.booking004, item_type: 'service', description: 'Ziyarat Makkah Tour', quantity: 8, unit_price: 400, extra_service_id: IDS.svc003 },
        { booking_id: IDS.booking004, item_type: 'service', description: 'Ziyarat Madinah Tour', quantity: 8, unit_price: 350, extra_service_id: IDS.svc004 },
        { booking_id: IDS.booking004, item_type: 'service', description: 'Travel Insurance', quantity: 8, unit_price: 300, extra_service_id: IDS.svc005 },
        { booking_id: IDS.booking004, item_type: 'service', description: 'Meal Package (15 days)', quantity: 8, unit_price: 1500, extra_service_id: IDS.svc006 },
        { booking_id: IDS.booking004, item_type: 'discount', description: 'Family Discount (10%, capped)', quantity: 1, unit_price: -5000 },
        { booking_id: IDS.booking004, item_type: 'discount', description: 'Senior Citizen Discount', quantity: 2, unit_price: -500 },
      ];
      await trx('invoice_items').insert(invoiceRows);

      // ── Payments (triggers update paid_amount) ──────────────────────────
      await trx('payments').insert([
        { booking_id: IDS.booking001, amount: 50000, payment_method: 'bank_transfer', reference_number: 'VIR-2026-001', notes: 'First installment', paid_by: IDS.userFatima, payment_date: '2026-02-10T12:00:00Z' },
        { booking_id: IDS.booking001, amount: 30000, payment_method: 'cash', notes: 'Second installment', paid_by: IDS.userFatima, payment_date: '2026-02-25T15:00:00Z' },
        { booking_id: IDS.booking002, amount: 53000, payment_method: 'bank_transfer', reference_number: 'VIR-2026-002', notes: 'Full payment', paid_by: IDS.userAhmed, payment_date: '2026-02-12T14:00:00Z' },
        { booking_id: IDS.booking003, amount: 5000, payment_method: 'cash', notes: 'Advance deposit', paid_by: IDS.userYoussef, payment_date: '2026-02-20T10:00:00Z' },
        { booking_id: IDS.booking004, amount: 100000, payment_method: 'bank_transfer', reference_number: 'VIR-2026-004', notes: 'First installment', paid_by: IDS.userKhadija, payment_date: '2026-02-15T11:00:00Z' },
        { booking_id: IDS.booking004, amount: 50000, payment_method: 'card', reference_number: 'CARD-8891', notes: 'Second installment', paid_by: IDS.userKhadija, payment_date: '2026-03-01T16:00:00Z' },
      ]);

      // ── Inventory allocations (triggers update sold counts) ─────────────
      await trx('booking_flight_allocations').insert([
        { booking_id: IDS.booking001, flight_seat_inventory_id: IDS.fsi001, seats_allocated: 4, price_charged: 9500, allocated_by: IDS.userFatima },
        { booking_id: IDS.booking002, flight_seat_inventory_id: IDS.fsi001, seats_allocated: 2, price_charged: 9500, allocated_by: IDS.userAhmed },
        { booking_id: IDS.booking003, flight_seat_inventory_id: IDS.fsi004, seats_allocated: 1, price_charged: 8500, allocated_by: IDS.userYoussef },
        { booking_id: IDS.booking004, flight_seat_inventory_id: IDS.fsi003, seats_allocated: 8, price_charged: 9500, allocated_by: IDS.userKhadija },
      ]);

      await trx('booking_bed_allocations').insert([
        { booking_id: IDS.booking001, hotel_bed_inventory_id: IDS.hbi002, beds_allocated: 4, price_charged: STAY.makkahTriple.sell, allocated_by: IDS.userFatima },
        { booking_id: IDS.booking001, hotel_bed_inventory_id: IDS.hbi005, beds_allocated: 4, price_charged: STAY.madinahTriple.sell, allocated_by: IDS.userFatima },
        { booking_id: IDS.booking002, hotel_bed_inventory_id: IDS.hbi001, beds_allocated: 2, price_charged: STAY.makkahDouble.sell, allocated_by: IDS.userAhmed },
        { booking_id: IDS.booking002, hotel_bed_inventory_id: IDS.hbi004, beds_allocated: 2, price_charged: STAY.madinahDouble.sell, allocated_by: IDS.userAhmed },
        { booking_id: IDS.booking003, hotel_bed_inventory_id: IDS.hbiSafwa, beds_allocated: 1, price_charged: STAY.safwaQuad.sell, allocated_by: IDS.userYoussef },
        { booking_id: IDS.booking003, hotel_bed_inventory_id: IDS.hbiNoor, beds_allocated: 1, price_charged: STAY.noorQuad.sell, allocated_by: IDS.userYoussef },
        { booking_id: IDS.booking004, hotel_bed_inventory_id: IDS.hbi003, beds_allocated: 8, price_charged: STAY.makkahQuad.sell, allocated_by: IDS.userKhadija },
        { booking_id: IDS.booking004, hotel_bed_inventory_id: IDS.hbi006, beds_allocated: 8, price_charged: STAY.madinahQuad.sell, allocated_by: IDS.userKhadija },
      ]);

      // ── Room assignments ────────────────────────────────────────────────
      await trx('room_assignments').insert([
        { booking_id: IDS.booking001, accommodation_id: IDS.hotel001, room_type_id: IDS.rt002, room_number: '305', pilgrim_id: P.p01, assigned_by: IDS.userFatima },
        { booking_id: IDS.booking001, accommodation_id: IDS.hotel001, room_type_id: IDS.rt002, room_number: '305', pilgrim_id: P.p02, assigned_by: IDS.userFatima },
        { booking_id: IDS.booking001, accommodation_id: IDS.hotel001, room_type_id: IDS.rt002, room_number: '305', pilgrim_id: P.p03, assigned_by: IDS.userFatima },
        { booking_id: IDS.booking001, accommodation_id: IDS.hotel001, room_type_id: IDS.rt002, room_number: '306', pilgrim_id: P.p04, assigned_by: IDS.userFatima },
        { booking_id: IDS.booking001, accommodation_id: IDS.hotel004, room_type_id: IDS.rt009, room_number: '201', pilgrim_id: P.p01, assigned_by: IDS.userFatima },
        { booking_id: IDS.booking001, accommodation_id: IDS.hotel004, room_type_id: IDS.rt009, room_number: '201', pilgrim_id: P.p02, assigned_by: IDS.userFatima },
        { booking_id: IDS.booking001, accommodation_id: IDS.hotel004, room_type_id: IDS.rt009, room_number: '201', pilgrim_id: P.p03, assigned_by: IDS.userFatima },
        { booking_id: IDS.booking001, accommodation_id: IDS.hotel004, room_type_id: IDS.rt009, room_number: '202', pilgrim_id: P.p04, assigned_by: IDS.userFatima },
        { booking_id: IDS.booking002, accommodation_id: IDS.hotel001, room_type_id: IDS.rt001, room_number: '410', pilgrim_id: P.p05, assigned_by: IDS.userAhmed },
        { booking_id: IDS.booking002, accommodation_id: IDS.hotel001, room_type_id: IDS.rt001, room_number: '410', pilgrim_id: P.p06, assigned_by: IDS.userAhmed },
        { booking_id: IDS.booking002, accommodation_id: IDS.hotel004, room_type_id: IDS.rt008, room_number: '112', pilgrim_id: P.p05, assigned_by: IDS.userAhmed },
        { booking_id: IDS.booking002, accommodation_id: IDS.hotel004, room_type_id: IDS.rt008, room_number: '112', pilgrim_id: P.p06, assigned_by: IDS.userAhmed },
      ]);

      // ── Booking locks (draft hold) ──────────────────────────────────────
      await trx('booking_locks').insert([
        {
          agency_id: AGENCY_ID,
          user_id: IDS.userFatima,
          booking_id: IDS.booking005,
          resource_type: 'bed',
          accommodation_id: IDS.hotel001,
          room_type_id: IDS.rt001,
          season_id: IDS.seasonRamadan,
          quantity: 2,
          expires_at: holdExp.toISOString(),
          session_id: 'demo-hold-session-benkirane',
          user_name: 'Fatima Alaoui',
          user_email: 'fatima@albaraka.ma',
        },
        {
          agency_id: AGENCY_ID,
          user_id: IDS.userFatima,
          booking_id: IDS.booking005,
          resource_type: 'flight_seat',
          flight_id: IDS.flight004,
          season_id: IDS.seasonRamadan,
          quantity: 2,
          expires_at: holdExp.toISOString(),
          session_id: 'demo-hold-session-benkirane',
          user_name: 'Fatima Alaoui',
          user_email: 'fatima@albaraka.ma',
        },
      ]);

      // ── Discount usage log ──────────────────────────────────────────────
      await trx('discount_usage_log').insert([
        {
          agency_id: AGENCY_ID,
          booking_id: IDS.booking001,
          user_id: IDS.userFatima,
          discount_setting_id: IDS.disc002,
          discount_name: 'Family Discount (4+)',
          discount_type: 'percent',
          discount_value: 10,
          discount_amount: 5000,
          booking_total_before: 101600,
          booking_total_after: 96600,
        },
        {
          agency_id: AGENCY_ID,
          booking_id: IDS.booking002,
          user_id: IDS.userAhmed,
          discount_setting_id: IDS.disc004,
          discount_name: 'Senior Citizen (65+)',
          discount_type: 'fixed',
          discount_value: 500,
          discount_amount: 1000,
          booking_total_before: 54000,
          booking_total_after: 53000,
        },
        {
          agency_id: AGENCY_ID,
          booking_id: IDS.booking004,
          user_id: IDS.userKhadija,
          discount_setting_id: IDS.disc002,
          discount_name: 'Family Discount (4+)',
          discount_type: 'percent',
          discount_value: 10,
          discount_amount: 5000,
          booking_total_before: 199280,
          booking_total_after: 194280,
        },
      ]);

      // ── Expenses ────────────────────────────────────────────────────────
      const categories = await trx('expense_categories').where({ agency_id: AGENCY_ID });
      const catByName = Object.fromEntries(categories.map((c: { name: string; id: string }) => [c.name, c.id]));

      await trx('expenses').insert([
        {
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          branch_id: IDS.branchHQ,
          category: 'transport',
          category_id: catByName['Transport'] || null,
          expense_type: 'prepayment',
          description: 'Flight seat purchases — Ramadan 2026 (all flights)',
          amount: 1507500,
          paid_date: '2026-01-15',
          linked_resource_type: 'flight',
          linked_resource_id: IDS.flight001,
          total_quantity: 215,
          used_quantity: 15,
          unit_cost: 7000,
          created_by: IDS.userAhmed,
        },
        {
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          branch_id: IDS.branchHQ,
          category: 'hotels',
          category_id: catByName['Hotels'] || null,
          expense_type: 'prepayment',
          description: 'Hotel bed purchases — Makkah & Madinah Ramadan 2026',
          amount: 687400,
          paid_date: '2026-01-20',
          linked_resource_type: 'accommodation',
          linked_resource_id: IDS.hotel001,
          total_quantity: 165,
          used_quantity: 30,
          unit_cost: 4166,
          created_by: IDS.userAhmed,
        },
        {
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          branch_id: IDS.branchHQ,
          category: 'transport',
          category_id: catByName['Transport'] || null,
          expense_type: 'simple',
          description: 'Airport bus rentals — Jeddah & Madinah',
          amount: 15000,
          paid_date: '2026-02-28',
          created_by: IDS.userFatima,
        },
        {
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          branch_id: IDS.branchHQ,
          category: 'misc',
          category_id: catByName['Miscellaneous'] || null,
          expense_type: 'simple',
          description: 'Guide salaries — Ramadan groups',
          amount: 8000,
          paid_date: '2026-03-01',
          created_by: IDS.userFatima,
        },
        {
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          branch_id: IDS.branchHQ,
          category: 'misc',
          category_id: catByName['Miscellaneous'] || null,
          expense_type: 'simple',
          description: 'Marketing & advertising — Ramadan campaign',
          amount: 5000,
          paid_date: '2026-01-10',
          created_by: IDS.userAhmed,
        },
        {
          agency_id: AGENCY_ID,
          season_id: IDS.seasonRamadan,
          branch_id: IDS.branchRabat,
          category: 'visas',
          category_id: catByName['Visas'] || null,
          expense_type: 'simple',
          description: 'Visa processing fees — batch February',
          amount: 12000,
          paid_date: '2026-02-05',
          created_by: IDS.userYoussef,
        },
      ]);

      // ── Financial handovers ─────────────────────────────────────────────
      const [handover1] = await trx('financial_handovers')
        .insert({
          agency_id: AGENCY_ID,
          created_by: IDS.userFatima,
          handover_type: 'sales_to_admin',
          amount: 45000,
          handover_date: '2026-02-26',
          payment_method: 'cash',
          payment_reference: 'HO-2026-001',
          recipient_user_id: IDS.userAhmed,
          status: 'received',
          season_id: IDS.seasonRamadan,
          notes: 'Casablanca branch cash collection handover',
        })
        .returning(['id']);

      await trx('financial_handovers').insert({
        agency_id: AGENCY_ID,
        created_by: IDS.userYoussef,
        handover_type: 'sales_to_admin',
        amount: 5000,
        handover_date: '2026-02-21',
        payment_method: 'wire',
        payment_reference: 'HO-2026-002',
        recipient_user_id: IDS.userAhmed,
        status: 'pending',
        season_id: IDS.seasonRamadan,
        notes: 'Rabat advance from Chraibi booking',
      });

      await trx('financial_handovers').insert({
        agency_id: AGENCY_ID,
        created_by: IDS.userKhadija,
        handover_type: 'expense_reimbursement',
        amount: 2500,
        handover_date: '2026-02-18',
        payment_method: 'cash',
        recipient_user_id: IDS.userAhmed,
        status: 'sent',
        season_id: IDS.seasonRamadan,
        notes: 'Local transport reimbursement Marrakech office',
      });

      // Status history for received handover (trigger may also log — insert explicit history)
      if (handover1?.id) {
        await trx('financial_handover_status_history').insert({
          handover_id: handover1.id,
          old_status: 'sent',
          new_status: 'received',
          changed_by: IDS.userAhmed,
          notes: 'Cash counted and received at HQ',
        });
      }

      // ── Message templates & sent messages ───────────────────────────────
      await trx('message_templates').insert([
        {
          id: IDS.tpl001,
          agency_id: AGENCY_ID,
          name: 'Payment Reminder',
          name_ar: 'تذكير بالدفع',
          body: 'السلام عليكم {{name}}، تذكير بباقي المبلغ {{remaining}} درهم لحجزكم {{booking}}. شكراً - البركة للسفر',
          channel: 'sms',
        },
        {
          id: IDS.tpl002,
          agency_id: AGENCY_ID,
          name: 'Booking Confirmation',
          name_ar: 'تأكيد الحجز',
          body: 'تم تأكيد حجزكم {{booking}} بنجاح. عدد الحجاج: {{count}}. وكالة البركة للسفر',
          channel: 'sms',
        },
      ]);

      await trx('sent_messages').insert([
        {
          agency_id: AGENCY_ID,
          channel: 'sms',
          recipient_phone: '+212661123456',
          recipient_name: 'Mohammed El Fassi',
          body: 'السلام عليكم محمد الفاسي، تذكير بباقي المبلغ 16600 درهم لحجزكم BK-2026-0001. شكراً - البركة للسفر',
          status: 'sent',
          client_id: IDS.client001,
          booking_id: IDS.booking001,
          template_id: IDS.tpl001,
          sent_by: IDS.userFatima,
          created_at: '2026-02-28T09:00:00Z',
        },
        {
          agency_id: AGENCY_ID,
          channel: 'sms',
          recipient_phone: '+212662234567',
          recipient_name: 'Aicha Benjelloun',
          body: 'تم تأكيد حجزكم BK-2026-0002 بنجاح. عدد الحجاج: 2. وكالة البركة للسفر',
          status: 'sent',
          client_id: IDS.client002,
          booking_id: IDS.booking002,
          template_id: IDS.tpl002,
          sent_by: IDS.userAhmed,
          created_at: '2026-02-12T15:00:00Z',
        },
        {
          agency_id: AGENCY_ID,
          channel: 'sms',
          recipient_phone: '+212663345678',
          recipient_name: 'Omar Chraibi',
          body: 'السلام عليكم عمر الشرايبي، تذكير بباقي المبلغ 11680 درهم لحجزكم BK-2026-0003.',
          status: 'failed',
          error_message: 'Demo: Twilio not configured',
          client_id: IDS.client003,
          booking_id: IDS.booking003,
          template_id: IDS.tpl001,
          sent_by: IDS.userYoussef,
          created_at: '2026-02-22T10:00:00Z',
        },
      ]);
    });

    console.log('[seed:demo] ✓ Full demo data seeded');
    console.log('[seed:demo] Agency: Al-Baraka Travel Agency (premium)');
    console.log('[seed:demo] Login as agency admin — email: ahmed@albaraka.ma / password: ' + DEMO_PASSWORD);
    console.log('[seed:demo] Other users: fatima@ / youssef@ / khadija@albaraka.ma (same password)');
    console.log('[seed:demo] Platform super admin is separate (see SUPER_ADMIN_* env)');
    });
  } finally {
    await db.destroy();
  }
}

seedDemo().catch((err) => {
  console.error('[seed:demo] Failed:', err.message || err);
  process.exit(1);
});
