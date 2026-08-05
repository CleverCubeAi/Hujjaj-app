import { Request, Response } from 'express';
import db from '../services/db';
import { resolveAgencyId, requireAgencyId } from '../utils/tenant';

export const listSeasons = async (req: Request, res: Response) => {
  const agencyId = resolveAgencyId(req, res);
  if (agencyId === undefined) return;

  try {
    let q = db('seasons').orderBy('created_at', 'desc');
    if (agencyId) q = q.where({ agency_id: agencyId });
    res.json(await q);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const getSeason = async (req: Request, res: Response) => {
  const agencyId = resolveAgencyId(req, res);
  if (agencyId === undefined) return;
  const { id } = req.params;

  try {
    let q = db('seasons').where({ id });
    if (agencyId) q = q.andWhere({ agency_id: agencyId });
    const data = await q.first();
    if (!data) return res.status(404).json({ error: 'Season not found' });
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const createSeason = async (req: Request, res: Response) => {
  const agencyId = requireAgencyId(req, res);
  if (agencyId === undefined) return;
  const { name, type, start_date, end_date } = req.body;

  try {
    const [data] = await db('seasons')
      .insert({
        name,
        type,
        start_date,
        end_date,
        agency_id: agencyId,
      })
      .returning('*');
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const updateSeason = async (req: Request, res: Response) => {
  const agencyId = resolveAgencyId(req, res);
  if (agencyId === undefined) return;
  const { id } = req.params;
  const { name, type, start_date, end_date, status } = req.body;

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (status !== undefined) updates.status = status;

  try {
    let q = db('seasons').where({ id });
    if (agencyId) q = q.andWhere({ agency_id: agencyId });
    const [data] = await q.update(updates).returning('*');
    if (!data) return res.status(404).json({ error: 'Season not found' });
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteSeason = async (req: Request, res: Response) => {
  const agencyId = resolveAgencyId(req, res);
  if (agencyId === undefined) return;
  const { id } = req.params;

  try {
    let q = db('seasons').where({ id });
    if (agencyId) q = q.andWhere({ agency_id: agencyId });
    const deleted = await q.del();
    if (!deleted) return res.status(404).json({ error: 'Season not found' });
    res.json({ message: 'Season deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};
