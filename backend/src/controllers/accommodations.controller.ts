import { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase';

export const listAccommodations = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { season_id } = req.query;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  let query = supabaseAdmin.from('accommodations').select(`
    *,
    room_types (*),
    seasons (name)
  `).forAgency(agencyId).order('created_at', { ascending: false });
  if (season_id) query = query.eq('season_id', season_id);
  
  const { data, error } = await query;
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const getAccommodation = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const { data, error } = await supabaseAdmin
    .from('accommodations')
    .select(`
      *,
      room_types (*),
      seasons (name)
    `)
    .eq('id', id)
    .forAgency(agencyId)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const getCapacity = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params; // accommodation_id

  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const { data, error } = await supabaseAdmin
    .from('room_bed_status')
    .select('*')
    .eq('accommodation_id', id);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const createAccommodation = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { season_id, name, name_ar, city, photo_url, room_types } = req.body;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  // 1. Create Accommodation
  const { data: acc, error: accError } = await supabaseAdmin
    .from('accommodations')
    .insert({
      agency_id: agencyId,
      season_id,
      name,
      name_ar,
      city,
      photo_url
    })
    .select()
    .single();

  if (accError) return res.status(400).json({ error: accError.message });

  // 2. Create Room Types if provided
  if (room_types && room_types.length > 0) {
    const roomsToInsert = room_types.map((rt: any) => ({
      accommodation_id: acc.id,
      type: rt.type,
      total_rooms: rt.total_rooms,
      total_beds: rt.total_beds,
      price_per_bed: rt.price_per_bed
    }));
    
    const { error: rtError } = await supabaseAdmin
      .from('room_types')
      .insert(roomsToInsert);
      
    if (rtError) return res.status(400).json({ error: 'Accommodation created but room types failed: ' + rtError.message });
  }

  // Return with room_types
  const { data: fullAcc } = await supabaseAdmin
    .from('accommodations')
    .select(`*, room_types (*)`)
    .eq('id', acc.id)
    .single();

  res.json(fullAcc || acc);
};

export const updateAccommodation = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { name, name_ar, city, season_id, photo_url } = req.body;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (name_ar !== undefined) updates.name_ar = name_ar;
  if (city !== undefined) updates.city = city;
  if (season_id !== undefined) updates.season_id = season_id;
  if (photo_url !== undefined) updates.photo_url = photo_url;

  const { data, error } = await supabaseAdmin
    .from('accommodations')
    .update(updates)
    .eq('id', id)
    .forAgency(agencyId)
    .select(`*, room_types (*)`)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const deleteAccommodation = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  // Room types will be deleted via CASCADE
  const { error } = await supabaseAdmin
    .from('accommodations')
    .delete()
    .eq('id', id)
    .forAgency(agencyId);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Accommodation deleted successfully' });
};

// Room Types CRUD
export const createRoomType = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { accommodation_id, type, total_rooms, total_beds, price_per_bed, photo_url } = req.body;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  // Verify accommodation belongs to agency
  const { data: acc } = await supabaseAdmin
    .from('accommodations')
    .select('id')
    .eq('id', accommodation_id)
    .forAgency(agencyId)
    .single();

  if (!acc) {
    return res.status(403).json({ error: 'Accommodation not found or access denied' });
  }

  const { data, error } = await supabaseAdmin
    .from('room_types')
    .insert({
      accommodation_id,
      type,
      total_rooms: total_rooms || 0,
      total_beds: total_beds || 0,
      price_per_bed: price_per_bed || 0,
      photo_url
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const updateRoomType = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { type, total_rooms, total_beds, price_per_bed, photo_url } = req.body;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const updates: any = {};
  if (type !== undefined) updates.type = type;
  if (total_rooms !== undefined) updates.total_rooms = total_rooms;
  if (total_beds !== undefined) updates.total_beds = total_beds;
  if (price_per_bed !== undefined) updates.price_per_bed = price_per_bed;
  if (photo_url !== undefined) updates.photo_url = photo_url;

  const { data, error } = await supabaseAdmin
    .from('room_types')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const deleteRoomType = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  
  if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const { error } = await supabaseAdmin
    .from('room_types')
    .delete()
    .eq('id', id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Room type deleted successfully' });
};
