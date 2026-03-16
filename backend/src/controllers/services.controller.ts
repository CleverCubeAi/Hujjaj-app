import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';

// Get all extra services for the agency
export const getServices = async (req: Request, res: Response) => {
  try {
    const { category, active_only } = req.query;
    const agencyId = req.user?.agency_id;

    let query = supabase
      .from('extra_services')
      .select('*')
      .eq('agency_id', agencyId)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }
    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get single service by ID
export const getServiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    const { data, error } = await supabase
      .from('extra_services')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create new service
export const createService = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const { name, name_ar, description, price, category, is_active } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const { data, error } = await supabase
      .from('extra_services')
      .insert({
        agency_id: agencyId,
        name,
        name_ar,
        description,
        price,
        category: category || 'other',
        is_active: is_active !== false
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update service
export const updateService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const { name, name_ar, description, price, category, is_active } = req.body;

    const { data, error } = await supabase
      .from('extra_services')
      .update({
        name,
        name_ar,
        description,
        price,
        category,
        is_active
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete service
export const deleteService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    // Check if service is used in any invoice items
    const { data: usedItems } = await supabase
      .from('invoice_items')
      .select('id')
      .eq('extra_service_id', id)
      .limit(1);

    if (usedItems && usedItems.length > 0) {
      // Instead of deleting, deactivate it
      const { data, error } = await supabase
        .from('extra_services')
        .update({ is_active: false })
        .eq('id', id)
        .eq('agency_id', agencyId)
        .select()
        .single();

      if (error) throw error;
      return res.json({ message: 'Service deactivated (in use by existing bookings)', data });
    }

    const { error } = await supabase
      .from('extra_services')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) throw error;
    res.json({ message: 'Service deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get service categories
export const getServiceCategories = async (_req: Request, res: Response) => {
  try {
    const categories = [
      { value: 'transport', label: 'النقل', label_en: 'Transport' },
      { value: 'guide', label: 'المرشد', label_en: 'Guide' },
      { value: 'meals', label: 'الوجبات', label_en: 'Meals' },
      { value: 'tours', label: 'الجولات', label_en: 'Tours' },
      { value: 'insurance', label: 'التأمين', label_en: 'Insurance' },
      { value: 'other', label: 'أخرى', label_en: 'Other' }
    ];
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
