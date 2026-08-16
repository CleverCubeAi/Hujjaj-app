import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';

// Get all categories (all stored in DB, including defaults)
export const getCategories = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    
    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Get all categories (default + custom, all stored in DB)
    const { data: categories, error } = await supabase
      .from('expense_categories')
      .select('*')
      .forAgency(agencyId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;

    // Format categories with value field
    const formattedCategories = (categories || []).map(cat => ({
      ...cat,
      value: cat.id || cat.name?.toLowerCase().replace(/\s+/g, '_') || ''
    }));

    res.json(formattedCategories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create category (default or custom)
export const createCategory = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const { name, name_ar, description, is_default } = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can create categories
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category already exists
    const { data: existing } = await supabase
      .from('expense_categories')
      .select('id')
      .forAgency(agencyId)
      .eq('name', name)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }

    const { data, error } = await supabase
      .from('expense_categories')
      .insert({
        agency_id: agencyId,
        name,
        name_ar,
        description,
        is_default: is_default || false,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update category (including default categories)
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const { name, name_ar, description, is_active } = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can update categories
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if category exists and belongs to agency
    const { data: existing } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // If name is being changed, check for duplicates
    if (name && name !== existing.name) {
      const { data: duplicate } = await supabase
        .from('expense_categories')
        .select('id')
        .forAgency(agencyId)
        .eq('name', name)
        .neq('id', id)
        .single();

      if (duplicate) {
        return res.status(400).json({ error: 'Category with this name already exists' });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (name_ar !== undefined) updateData.name_ar = name_ar;
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('expense_categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete category (including default categories, but check if used)
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can delete categories
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if category exists and belongs to agency
    const { data: existing } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('id', id)
      .forAgency(agencyId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category is used in expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id')
      .eq('category_id', id)
      .limit(1);

    if (expenses && expenses.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category that is used in expenses. Deactivate it instead.' 
      });
    }

    const { error } = await supabase
      .from('expense_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
