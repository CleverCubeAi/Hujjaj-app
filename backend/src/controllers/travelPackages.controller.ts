import { Request, Response } from 'express';
import db from '../services/db';
import { requireAgencyId, resolveAgencyId } from '../utils/tenant';

type ComponentInput = {
  component_type: 'flight' | 'hotel' | 'service';
  flight_seat_inventory_id?: string | null;
  hotel_bed_inventory_id?: string | null;
  extra_service_id?: string | null;
};

type ResolvedComponent = {
  component_type: 'flight' | 'hotel' | 'service';
  flight_seat_inventory_id: string | null;
  hotel_bed_inventory_id: string | null;
  extra_service_id: string | null;
  snapshot_sell_price: number;
  snapshot_cost: number;
  sort_order: number;
};

function paramId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function money(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function placesLeft(seats: number | null, beds: number[]): number | null {
  const nums: number[] = [];
  if (seats != null) nums.push(seats);
  nums.push(...beds);
  if (nums.length === 0) return null;
  return Math.min(...nums);
}

async function assertSeason(agencyId: string, seasonId: string) {
  const season = await db('seasons').where({ id: seasonId, agency_id: agencyId }).first();
  if (!season) {
    const err: any = new Error('الموسم غير موجود');
    err.status = 400;
    throw err;
  }
  return season;
}

async function resolveComponents(agencyId: string, seasonId: string, input: ComponentInput[]): Promise<{
  rows: ResolvedComponent[];
  calculated: number;
  cost: number;
  flightInventoryId: string | null;
}> {
  const flights = input.filter((c) => c.component_type === 'flight');
  const hotels = input.filter((c) => c.component_type === 'hotel');
  const services = input.filter((c) => c.component_type === 'service');

  if (flights.length > 1) {
    const err: any = new Error('الباقة تقبل رحلة واحدة');
    err.status = 400;
    throw err;
  }

  const flightIds = flights.map((c) => c.flight_seat_inventory_id).filter(Boolean) as string[];
  const hotelIds = hotels.map((c) => c.hotel_bed_inventory_id).filter(Boolean) as string[];
  const serviceIds = services.map((c) => c.extra_service_id).filter(Boolean) as string[];

  if (new Set(hotelIds).size !== hotelIds.length || new Set(serviceIds).size !== serviceIds.length) {
    const err: any = new Error('لا يمكن تكرار نفس العنصر في الباقة');
    err.status = 400;
    throw err;
  }

  const flightRows = flightIds.length
    ? await db('flight_seat_inventory').where({ agency_id: agencyId, season_id: seasonId }).whereIn('id', flightIds)
    : [];
  const hotelRows = hotelIds.length
    ? await db('hotel_bed_inventory').where({ agency_id: agencyId, season_id: seasonId }).whereIn('id', hotelIds)
    : [];
  const serviceRows = serviceIds.length
    ? await db('extra_services').where({ agency_id: agencyId }).whereIn('id', serviceIds)
    : [];

  if (flightRows.length !== flightIds.length) {
    const err: any = new Error('مخزون الرحلة لا ينتمي إلى هذا الموسم');
    err.status = 400;
    throw err;
  }
  if (hotelRows.length !== hotelIds.length) {
    const err: any = new Error('مخزون الفندق لا ينتمي إلى هذا الموسم');
    err.status = 400;
    throw err;
  }
  if (serviceRows.length !== serviceIds.length) {
    const err: any = new Error('إحدى الخدمات غير موجودة');
    err.status = 400;
    throw err;
  }

  const flightMap = new Map(flightRows.map((r: any) => [r.id, r]));
  const hotelMap = new Map(hotelRows.map((r: any) => [r.id, r]));
  const serviceMap = new Map(serviceRows.map((r: any) => [r.id, r]));

  const rows: ResolvedComponent[] = [];
  let order = 0;
  for (const id of flightIds) {
    const row = flightMap.get(id);
    rows.push({
      component_type: 'flight',
      flight_seat_inventory_id: id,
      hotel_bed_inventory_id: null,
      extra_service_id: null,
      snapshot_sell_price: money(row.sell_price_per_seat),
      snapshot_cost: money(row.purchase_price_per_seat),
      sort_order: order++,
    });
  }
  for (const id of hotelIds) {
    const row = hotelMap.get(id);
    rows.push({
      component_type: 'hotel',
      flight_seat_inventory_id: null,
      hotel_bed_inventory_id: id,
      extra_service_id: null,
      snapshot_sell_price: money(row.sell_price_per_bed),
      snapshot_cost: money(row.purchase_price_per_bed),
      sort_order: order++,
    });
  }
  for (const id of serviceIds) {
    const row = serviceMap.get(id);
    rows.push({
      component_type: 'service',
      flight_seat_inventory_id: null,
      hotel_bed_inventory_id: null,
      extra_service_id: id,
      snapshot_sell_price: money(row.price),
      snapshot_cost: 0,
      sort_order: order++,
    });
  }

  const calculated = money(rows.reduce((sum, r) => sum + r.snapshot_sell_price, 0));
  const cost = money(rows.reduce((sum, r) => sum + r.snapshot_cost, 0));
  return {
    rows,
    calculated,
    cost,
    flightInventoryId: flightIds[0] || null,
  };
}

async function presentMany(agencyId: string, packageRows: any[]) {
  if (packageRows.length === 0) return [];
  const ids = packageRows.map((p) => p.id);
  const components = await db('package_components').whereIn('package_id', ids).orderBy('sort_order', 'asc');

  const flightIds = [...new Set(components.map((c: any) => c.flight_seat_inventory_id).filter(Boolean))];
  const hotelIds = [...new Set(components.map((c: any) => c.hotel_bed_inventory_id).filter(Boolean))];
  const serviceIds = [...new Set(components.map((c: any) => c.extra_service_id).filter(Boolean))];
  const seasonIds = [...new Set(packageRows.map((p) => p.season_id).filter(Boolean))];

  const [flights, hotels, services, seasons] = await Promise.all([
    flightIds.length
      ? db('flight_seat_inventory as i')
        .leftJoin('flights as f', 'f.id', 'i.flight_id')
        .where('i.agency_id', agencyId)
        .whereIn('i.id', flightIds)
        .select(
          'i.id', 'i.flight_id', 'i.seat_class', 'i.seats_available', 'i.sell_price_per_seat', 'i.purchase_price_per_seat',
          'f.code', 'f.departure_city', 'f.arrival_city', 'f.departure_date', 'f.return_date', 'f.carrier'
        )
      : [],
    hotelIds.length
      ? db('hotel_bed_inventory as i')
        .leftJoin('accommodations as a', 'a.id', 'i.accommodation_id')
        .leftJoin('room_types as rt', 'rt.id', 'i.room_type_id')
        .where('i.agency_id', agencyId)
        .whereIn('i.id', hotelIds)
        .select(
          'i.id', 'i.accommodation_id', 'i.room_type_id', 'i.beds_available', 'i.sell_price_per_bed',
          'i.purchase_price_per_bed', 'i.check_in_date', 'i.check_out_date', 'i.nights',
          'a.name as accommodation_name', 'a.name_ar as accommodation_name_ar', 'a.city',
          'rt.type as room_type'
        )
      : [],
    serviceIds.length
      ? db('extra_services').where({ agency_id: agencyId }).whereIn('id', serviceIds)
        .select('id', 'name', 'name_ar', 'price', 'category')
      : [],
    seasonIds.length
      ? db('seasons').whereIn('id', seasonIds).select('id', 'name', 'type')
      : [],
  ]);

  const flightMap = new Map((flights as any[]).map((r) => [r.id, r]));
  const hotelMap = new Map((hotels as any[]).map((r) => [r.id, r]));
  const serviceMap = new Map((services as any[]).map((r) => [r.id, r]));
  const seasonMap = new Map((seasons as any[]).map((r) => [r.id, r]));
  const byPackage = new Map<string, any[]>();
  for (const c of components as any[]) {
    const list = byPackage.get(c.package_id) || [];
    list.push(c);
    byPackage.set(c.package_id, list);
  }

  return packageRows.map((pkg) => {
    const comps = byPackage.get(pkg.id) || [];
    const flightComp = comps.find((c) => c.component_type === 'flight');
    const flight = flightComp ? flightMap.get(flightComp.flight_seat_inventory_id) : null;
    const hotelComps = comps.filter((c) => c.component_type === 'hotel');
    const hotelDetails = hotelComps.map((c) => {
      const h = hotelMap.get(c.hotel_bed_inventory_id);
      return {
        id: c.id,
        hotel_bed_inventory_id: c.hotel_bed_inventory_id,
        snapshot_sell_price: money(c.snapshot_sell_price),
        snapshot_cost: money(c.snapshot_cost),
        accommodation_id: h?.accommodation_id || null,
        room_type_id: h?.room_type_id || null,
        beds_available: h ? Number(h.beds_available) : 0,
        sell_price_per_bed: h ? money(h.sell_price_per_bed) : money(c.snapshot_sell_price),
        purchase_price_per_bed: h ? money(h.purchase_price_per_bed) : money(c.snapshot_cost),
        check_in_date: h?.check_in_date || null,
        check_out_date: h?.check_out_date || null,
        nights: h?.nights != null ? Number(h.nights) : null,
        accommodations: h ? { name: h.accommodation_name, name_ar: h.accommodation_name_ar, city: h.city } : null,
        room_types: h ? { type: h.room_type } : null,
      };
    });
    const serviceDetails = comps.filter((c) => c.component_type === 'service').map((c) => {
      const s = serviceMap.get(c.extra_service_id);
      return {
        id: c.id,
        extra_service_id: c.extra_service_id,
        snapshot_sell_price: money(c.snapshot_sell_price),
        name: s?.name || '',
        name_ar: s?.name_ar || null,
        price: s ? money(s.price) : money(c.snapshot_sell_price),
        category: s?.category || null,
      };
    });
    const calculated = money(pkg.calculated_price);
    const selling = money(pkg.selling_price);
    const season = pkg.season_id ? seasonMap.get(pkg.season_id) : null;
    return {
      id: pkg.id,
      agency_id: pkg.agency_id,
      season_id: pkg.season_id,
      season: season ? { id: season.id, name: season.name, type: season.type } : null,
      name: pkg.name,
      name_ar: pkg.name_ar,
      status: pkg.status || 'draft',
      flight_seat_inventory_id: pkg.flight_seat_inventory_id,
      calculated_price: calculated,
      selling_price: selling,
      saving: money(Math.max(0, calculated - selling)),
      cost: money(comps.reduce((sum, c) => sum + money(c.snapshot_cost), 0)),
      places_left: placesLeft(
        flight ? Number(flight.seats_available) : null,
        hotelDetails.map((h) => h.beds_available)
      ),
      published_at: pkg.published_at,
      created_at: pkg.created_at,
      updated_at: pkg.updated_at,
      flight: flight ? {
        flight_seat_inventory_id: flight.id,
        flight_id: flight.flight_id,
        code: flight.code,
        departure_city: flight.departure_city,
        arrival_city: flight.arrival_city,
        departure_date: flight.departure_date,
        return_date: flight.return_date,
        carrier: flight.carrier,
        seat_class: flight.seat_class,
        seats_available: Number(flight.seats_available),
        sell_price_per_seat: money(flight.sell_price_per_seat),
        purchase_price_per_seat: money(flight.purchase_price_per_seat),
      } : null,
      hotels: hotelDetails,
      services: serviceDetails,
      components: comps.map((c) => ({
        id: c.id,
        component_type: c.component_type,
        flight_seat_inventory_id: c.flight_seat_inventory_id,
        hotel_bed_inventory_id: c.hotel_bed_inventory_id,
        extra_service_id: c.extra_service_id,
        snapshot_sell_price: money(c.snapshot_sell_price),
        snapshot_cost: money(c.snapshot_cost),
        sort_order: c.sort_order,
      })),
    };
  });
}

function readComponents(body: any): ComponentInput[] {
  return Array.isArray(body?.components) ? body.components : [];
}

function sellingOrCalculated(raw: unknown, calculated: number): number {
  if (raw === undefined || raw === null || raw === '') return calculated;
  const selling = money(raw);
  if (selling < 0) {
    const err: any = new Error('سعر الباقة لا يمكن أن يكون سالباً');
    err.status = 400;
    throw err;
  }
  if (selling > calculated) {
    const err: any = new Error('سعر الباقة يجب أن يكون أقل من أو يساوي مجموع الأسعار المنفصلة');
    err.status = 400;
    throw err;
  }
  return selling;
}

async function loadOwned(agencyId: string, id: string) {
  const row = await db('packages').where({ id, agency_id: agencyId }).first();
  if (!row) return null;
  const [presented] = await presentMany(agencyId, [row]);
  return presented;
}

export const listTravelPackages = async (req: Request, res: Response) => {
  const agencyId = resolveAgencyId(req, res);
  if (agencyId === undefined) return;
  if (!agencyId) return res.status(403).json({ error: 'Agency ID not found' });

  try {
    const role = req.user?.role;
    let status = typeof req.query.status === 'string' ? req.query.status : '';
    if (role === 'agent') status = 'published';
    const seasonId = typeof req.query.season_id === 'string' ? req.query.season_id : '';

    let q = db('packages').where({ agency_id: agencyId }).orderBy('created_at', 'desc');
    if (status) q = q.andWhere({ status });
    if (seasonId) q = q.andWhere({ season_id: seasonId });
    const rows = await q;
    res.json(await presentMany(agencyId, rows));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

export const getTravelPackage = async (req: Request, res: Response) => {
  const agencyId = resolveAgencyId(req, res);
  if (agencyId === undefined) return;
  if (!agencyId) return res.status(403).json({ error: 'Agency ID not found' });

  try {
    const presented = await loadOwned(agencyId, paramId(req.params.id));
    if (!presented) return res.status(404).json({ error: 'Package not found' });
    if (req.user?.role === 'agent' && presented.status !== 'published') {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(presented);
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

export const getTravelPackageCatalog = async (req: Request, res: Response) => {
  const agencyId = requireAgencyId(req, res);
  if (agencyId === undefined) return;
  const seasonId = typeof req.query.season_id === 'string' ? req.query.season_id : '';
  if (!seasonId) return res.status(400).json({ error: 'season_id is required' });

  try {
    await assertSeason(agencyId, seasonId);
    const [flights, hotels, services] = await Promise.all([
      db('flight_seat_inventory as i')
        .leftJoin('flights as f', 'f.id', 'i.flight_id')
        .where({ 'i.agency_id': agencyId, 'i.season_id': seasonId })
        .orderBy('f.departure_date', 'asc')
        .select(
          'i.id', 'i.flight_id', 'i.seat_class', 'i.seats_available', 'i.sell_price_per_seat', 'i.purchase_price_per_seat',
          'f.code', 'f.departure_city', 'f.arrival_city', 'f.departure_date', 'f.return_date', 'f.carrier'
        ),
      db('hotel_bed_inventory as i')
        .leftJoin('accommodations as a', 'a.id', 'i.accommodation_id')
        .leftJoin('room_types as rt', 'rt.id', 'i.room_type_id')
        .where({ 'i.agency_id': agencyId, 'i.season_id': seasonId })
        .orderBy('a.name', 'asc')
        .select(
          'i.id', 'i.accommodation_id', 'i.room_type_id', 'i.beds_available', 'i.sell_price_per_bed',
          'i.purchase_price_per_bed', 'i.check_in_date', 'i.check_out_date', 'i.nights',
          'a.name as accommodation_name', 'a.name_ar as accommodation_name_ar', 'a.city',
          'rt.type as room_type'
        ),
      db('extra_services')
        .where({ agency_id: agencyId, is_active: true })
        .orderBy('name', 'asc')
        .select('id', 'name', 'name_ar', 'price', 'category'),
    ]);

    res.json({
      flights: (flights as any[]).map((f) => ({
        ...f,
        seats_available: Number(f.seats_available),
        sell_price_per_seat: money(f.sell_price_per_seat),
        purchase_price_per_seat: money(f.purchase_price_per_seat),
      })),
      hotels: (hotels as any[]).map((h) => ({
        ...h,
        beds_available: Number(h.beds_available),
        sell_price_per_bed: money(h.sell_price_per_bed),
        purchase_price_per_bed: money(h.purchase_price_per_bed),
        nights: h.nights != null ? Number(h.nights) : null,
      })),
      services: (services as any[]).map((s) => ({ ...s, price: money(s.price) })),
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

export const createTravelPackage = async (req: Request, res: Response) => {
  const agencyId = requireAgencyId(req, res);
  if (agencyId === undefined) return;
  const name = String(req.body?.name || '').trim();
  const seasonId = req.body?.season_id;
  if (!name) return res.status(400).json({ error: 'اسم الباقة مطلوب' });
  if (!seasonId) return res.status(400).json({ error: 'الموسم مطلوب' });

  try {
    await assertSeason(agencyId, seasonId);
    const resolved = await resolveComponents(agencyId, seasonId, readComponents(req.body));
    const selling = sellingOrCalculated(req.body?.selling_price, resolved.calculated);

    const created = await db.transaction(async (trx) => {
      const [row] = await trx('packages').insert({
        agency_id: agencyId,
        season_id: seasonId,
        name,
        name_ar: req.body?.name_ar ? String(req.body.name_ar).trim() : null,
        status: 'draft',
        is_template: true,
        flight_seat_inventory_id: resolved.flightInventoryId,
        calculated_price: resolved.calculated,
        selling_price: selling,
        price: selling,
      }).returning('*');

      if (resolved.rows.length > 0) {
        await trx('package_components').insert(resolved.rows.map((r) => ({ ...r, package_id: row.id })));
      }
      return row;
    });

    res.status(201).json(await loadOwned(agencyId, created.id));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

export const updateTravelPackage = async (req: Request, res: Response) => {
  const agencyId = requireAgencyId(req, res);
  if (agencyId === undefined) return;
  const id = paramId(req.params.id);

  try {
    const existing = await db('packages').where({ id, agency_id: agencyId }).first();
    if (!existing) return res.status(404).json({ error: 'Package not found' });
    if (existing.status === 'archived') {
      return res.status(400).json({ error: 'لا يمكن تعديل باقة مؤرشفة' });
    }

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
    if (!name) return res.status(400).json({ error: 'اسم الباقة مطلوب' });
    const seasonId = req.body?.season_id || existing.season_id;
    await assertSeason(agencyId, seasonId);

    const resolved = await resolveComponents(agencyId, seasonId, readComponents(req.body));
    const selling = sellingOrCalculated(
      req.body?.selling_price !== undefined ? req.body.selling_price : existing.selling_price,
      resolved.calculated
    );

    await db.transaction(async (trx) => {
      await trx('package_components').where({ package_id: id }).del();
      if (resolved.rows.length > 0) {
        await trx('package_components').insert(resolved.rows.map((r) => ({ ...r, package_id: id })));
      }
      await trx('packages').where({ id }).update({
        name,
        name_ar: req.body?.name_ar !== undefined ? (req.body.name_ar ? String(req.body.name_ar).trim() : null) : existing.name_ar,
        season_id: seasonId,
        flight_seat_inventory_id: resolved.flightInventoryId,
        calculated_price: resolved.calculated,
        selling_price: selling,
        price: selling,
        updated_at: trx.fn.now(),
      });
    });

    res.json(await loadOwned(agencyId, id));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

async function refreshSnapshots(agencyId: string, id: string) {
  const existing = await db('packages').where({ id, agency_id: agencyId }).first();
  if (!existing) return null;
  const comps = await db('package_components').where({ package_id: id }).orderBy('sort_order', 'asc');
  const input: ComponentInput[] = comps.map((c: any) => ({
    component_type: c.component_type,
    flight_seat_inventory_id: c.flight_seat_inventory_id,
    hotel_bed_inventory_id: c.hotel_bed_inventory_id,
    extra_service_id: c.extra_service_id,
  }));
  const resolved = await resolveComponents(agencyId, existing.season_id, input);
  const selling = money(existing.selling_price);
  if (selling > resolved.calculated) {
    const err: any = new Error('سعر الباقة أعلى من مجموع الأسعار الحالي. اخفض السعر قبل النشر');
    err.status = 400;
    throw err;
  }
  await db.transaction(async (trx) => {
    await trx('package_components').where({ package_id: id }).del();
    if (resolved.rows.length > 0) {
      await trx('package_components').insert(resolved.rows.map((r) => ({ ...r, package_id: id })));
    }
    await trx('packages').where({ id }).update({
      flight_seat_inventory_id: resolved.flightInventoryId,
      calculated_price: resolved.calculated,
      price: selling,
      updated_at: trx.fn.now(),
    });
  });
  return loadOwned(agencyId, id);
}

export const publishTravelPackage = async (req: Request, res: Response) => {
  const agencyId = requireAgencyId(req, res);
  if (agencyId === undefined) return;
  const id = paramId(req.params.id);

  try {
    const existing = await db('packages').where({ id, agency_id: agencyId }).first();
    if (!existing) return res.status(404).json({ error: 'Package not found' });
    if (!existing.name || !existing.season_id) {
      return res.status(400).json({ error: 'الاسم والموسم مطلوبان للنشر' });
    }

    const refreshed = await refreshSnapshots(agencyId, id);
    if (!refreshed?.flight || refreshed.hotels.length === 0) {
      return res.status(400).json({ error: 'النشر يتطلب رحلة وفندقاً واحداً على الأقل' });
    }
    if (refreshed.selling_price > refreshed.calculated_price) {
      return res.status(400).json({ error: 'سعر الباقة يجب أن يكون أقل من أو يساوي مجموع الأسعار المنفصلة' });
    }

    await db('packages').where({ id }).update({
      status: 'published',
      published_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
    res.json(await loadOwned(agencyId, id));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
};

export const archiveTravelPackage = async (req: Request, res: Response) => {
  const agencyId = requireAgencyId(req, res);
  if (agencyId === undefined) return;
  const id = paramId(req.params.id);

  try {
    const existing = await db('packages').where({ id, agency_id: agencyId }).first();
    if (!existing) return res.status(404).json({ error: 'Package not found' });
    await db('packages').where({ id }).update({
      status: 'archived',
      updated_at: db.fn.now(),
    });
    res.json(await loadOwned(agencyId, id));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
};
