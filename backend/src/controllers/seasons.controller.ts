import { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase';

export const listSeasons = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const { data, error } = await supabaseAdmin
    .from('seasons')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const getSeason = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const { data, error } = await supabaseAdmin
    .from('seasons')
    .select('*')
    .eq('id', id)
    .eq('agency_id', agencyId)
    .single();
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const createSeason = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { name, type, start_date, end_date } = req.body;
  
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const { data, error } = await supabaseAdmin
    .from('seasons')
    .insert({
      name,
      type,
      start_date,
      end_date,
      agency_id: agencyId
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const updateSeason = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { name, type, start_date, end_date, status } = req.body;
  
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (status !== undefined) updates.status = status;

  const { data, error } = await supabaseAdmin
    .from('seasons')
    .update(updates)
    .eq('id', id)
    .eq('agency_id', agencyId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const deleteSeason = async (req: Request, res: Response) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  
  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  const { error } = await supabaseAdmin
    .from('seasons')
    .delete()
    .eq('id', id)
    .eq('agency_id', agencyId);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Season deleted successfully' });
};
