import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';
import { pickAllowed } from '../utils/httpError';

const EXPENSE_FIELDS = [
  'category', 'category_id', 'description', 'amount', 'paid_date', 'season_id',
  'expense_type', 'linked_resource_type', 'linked_resource_id', 'total_quantity',
  'used_quantity', 'branch_id', 'notes',
] as const;

export const listExpenses = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const { season_id, category, expense_type } = req.query;
    
    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    let query = supabase
      .from('expenses')
      .select(`
        *,
        expense_categories!left (id, name, name_ar)
      `)
      .forAgency(agencyId)
      .order('created_at', { ascending: false });

    if (season_id) query = query.eq('season_id', season_id);
    if (category) query = query.eq('category', category);
    
    const { data: expenses, error } = await query;
    if (error) throw error;

    res.json(expenses || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const userId = req.user?.id;
    const {
      category,
      category_id,
      description,
      amount,
      paid_date,
      season_id
    } = req.body;
    
    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        agency_id: agencyId,
        category: category || null,
        category_id: category_id || null,
        description,
        amount,
        paid_date,
        season_id,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const updateData = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can update expenses
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if expense exists
    const { data: existing } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }


    const { data, error } = await supabase
      .from('expenses')
      .update(pickAllowed(updateData, EXPENSE_FIELDS))
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

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can delete expenses
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if expense exists
    const { data: existing } = await supabase
      .from('expenses')
      .select('id')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .forAgency(agencyId);

    if (error) throw error;
    res.json({ message: 'Expense deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getExpenseSummary = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const { season_id } = req.query;
    
    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    let query = supabase.from('expense_summary').select('*').forAgency(agencyId);
    if (season_id) query = query.eq('season_id', season_id);
    
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
