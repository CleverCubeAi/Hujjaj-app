import { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase';
import { sendEmail, EmailConfig } from '../services/email.service';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  'sent': ['pending', 'canceled'],
  'pending': ['received', 'refused', 'canceled'],
  'received': [],
  'refused': [],
  'canceled': []
};

// Get all handovers with filters
export const getHandovers = async (req: Request, res: Response) => {
  console.log('[Handovers] getHandovers called');
  const agencyId = req.agencyId;
  const { handover_type, status, season_id, date_from, date_to, created_by, recipient_user_id } = req.query;

  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  try {
    let query = supabaseAdmin
      .from('financial_handovers')
      .select(`
        *,
        creator:created_by (id, full_name),
        recipient:recipient_user_id (id, full_name),
        seasons (id, name)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (handover_type) query = query.eq('handover_type', handover_type);
    if (status) query = query.eq('status', status);
    if (season_id) query = query.eq('season_id', season_id);
    if (date_from) query = query.gte('handover_date', date_from as string);
    if (date_to) query = query.lte('handover_date', date_to as string);
    if (created_by) query = query.eq('created_by', created_by);
    if (recipient_user_id) query = query.eq('recipient_user_id', recipient_user_id);

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching handovers:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get single handover with status history
export const getHandoverById = async (req: Request, res: Response) => {
  console.log('[Handovers] getHandoverById called');
  const agencyId = req.agencyId;
  const { id } = req.params;

  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  try {
    // Get handover
    const { data: handover, error: handoverError } = await supabaseAdmin
      .from('financial_handovers')
      .select(`
        *,
        creator:created_by (id, full_name),
        recipient:recipient_user_id (id, full_name),
        seasons (id, name)
      `)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (handoverError) throw handoverError;
    if (!handover) {
      return res.status(404).json({ error: 'Handover not found' });
    }

    // Get status history
    const { data: history, error: historyError } = await supabaseAdmin
      .from('financial_handover_status_history')
      .select(`
        *,
        changed_by_user:changed_by (id, full_name)
      `)
      .eq('handover_id', id)
      .order('changed_at', { ascending: true });

    if (historyError) throw historyError;

    res.json({
      ...handover,
      status_history: history || []
    });
  } catch (error: any) {
    console.error('Error fetching handover:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create new handover
export const createHandover = async (req: Request, res: Response) => {
  console.log('[Handovers] createHandover called');
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const {
    handover_type,
    amount,
    handover_date,
    payment_method,
    payment_reference,
    recipient_user_id,
    season_id,
    notes
  } = req.body;

  if (!agencyId || !userId) {
    return res.status(403).json({ error: 'Agency ID or User ID not found' });
  }

  // Validation
  if (!handover_type || !amount || !payment_method || !recipient_user_id) {
    return res.status(400).json({ error: 'Missing required fields: handover_type, amount, payment_method, recipient_user_id' });
  }

  if ((payment_method === 'wire' || payment_method === 'check') && !payment_reference) {
    return res.status(400).json({ error: 'Payment reference is required for wire or check payments' });
  }

  try {
    // Create handover
    const { data: handover, error: createError } = await supabaseAdmin
      .from('financial_handovers')
      .insert({
        agency_id: agencyId,
        created_by: userId,
        handover_type,
        amount,
        handover_date: handover_date || new Date().toISOString().split('T')[0],
        payment_method,
        payment_reference,
        recipient_user_id,
        season_id: season_id || null,
        notes,
        status: 'sent'
      })
      .select(`
        *,
        creator:created_by (id, full_name),
        recipient:recipient_user_id (id, full_name)
      `)
      .single();

    if (createError) throw createError;

    // Log initial status in history
    await supabaseAdmin
      .from('financial_handover_status_history')
      .insert({
        handover_id: handover.id,
        old_status: null,
        new_status: 'sent',
        changed_by: userId,
        notes: 'تم إنشاء طلب التسليم'
      });

    // Try to send email notification (don't fail if email fails)
    try {
      await sendHandoverNotification(agencyId, handover, 'created');
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    res.status(201).json(handover);
  } catch (error: any) {
    console.error('Error creating handover:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update handover status (admin only)
export const updateHandoverStatus = async (req: Request, res: Response) => {
  console.log('[Handovers] updateHandoverStatus called');
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!agencyId || !userId) {
    return res.status(403).json({ error: 'Agency ID or User ID not found' });
  }

  // Check if user has admin/manager role
  if (!['super_admin', 'agency_admin', 'manager'].includes(userRole || '')) {
    return res.status(403).json({ error: 'Only admins and managers can change handover status' });
  }

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    // Get current handover
    const { data: currentHandover, error: fetchError } = await supabaseAdmin
      .from('financial_handovers')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (fetchError) throw fetchError;
    if (!currentHandover) {
      return res.status(404).json({ error: 'Handover not found' });
    }

    // Validate status transition
    const validNextStatuses = VALID_TRANSITIONS[currentHandover.status] || [];
    if (!validNextStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status transition from '${currentHandover.status}' to '${status}'. Valid options: ${validNextStatuses.join(', ')}` 
      });
    }

    // Require notes for refused status
    if (status === 'refused' && !notes) {
      return res.status(400).json({ error: 'Notes are required when refusing a handover' });
    }

    // Update handover
    const { data: updatedHandover, error: updateError } = await supabaseAdmin
      .from('financial_handovers')
      .update({ status })
      .eq('id', id)
      .select(`
        *,
        creator:created_by (id, full_name),
        recipient:recipient_user_id (id, full_name)
      `)
      .single();

    if (updateError) throw updateError;

    // Log status change
    await supabaseAdmin
      .from('financial_handover_status_history')
      .insert({
        handover_id: id,
        old_status: currentHandover.status,
        new_status: status,
        changed_by: userId,
        notes: notes || null
      });

    // Try to send email notification
    try {
      await sendHandoverNotification(agencyId, updatedHandover, 'status_changed', status, notes);
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    res.json(updatedHandover);
  } catch (error: any) {
    console.error('Error updating handover status:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete/Cancel handover
export const deleteHandover = async (req: Request, res: Response) => {
  console.log('[Handovers] deleteHandover called');
  const agencyId = req.agencyId;
  const userId = req.user?.id;
  const { id } = req.params;

  if (!agencyId || !userId) {
    return res.status(403).json({ error: 'Agency ID or User ID not found' });
  }

  try {
    // Get current handover
    const { data: currentHandover, error: fetchError } = await supabaseAdmin
      .from('financial_handovers')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (fetchError) throw fetchError;
    if (!currentHandover) {
      return res.status(404).json({ error: 'Handover not found' });
    }

    // Can only cancel if not already received/refused/canceled
    if (['received', 'refused', 'canceled'].includes(currentHandover.status)) {
      return res.status(400).json({ error: 'Cannot cancel a handover that has already been processed' });
    }

    // Update to canceled status
    const { error: updateError } = await supabaseAdmin
      .from('financial_handovers')
      .update({ status: 'canceled' })
      .eq('id', id);

    if (updateError) throw updateError;

    // Log cancellation
    await supabaseAdmin
      .from('financial_handover_status_history')
      .insert({
        handover_id: id,
        old_status: currentHandover.status,
        new_status: 'canceled',
        changed_by: userId,
        notes: 'تم إلغاء طلب التسليم'
      });

    res.json({ message: 'Handover canceled successfully' });
  } catch (error: any) {
    console.error('Error canceling handover:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get handover statistics/summary
export const getHandoverStats = async (req: Request, res: Response) => {
  console.log('[Handovers] getHandoverStats called');
  const agencyId = req.agencyId;
  const { season_id } = req.query;

  if (!agencyId) {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

  try {
    let query = supabaseAdmin
      .from('financial_handovers')
      .select('handover_type, status, amount')
      .eq('agency_id', agencyId);

    if (season_id) query = query.eq('season_id', season_id);

    const { data, error } = await query;

    if (error) throw error;

    // Calculate statistics
    const stats = {
      sales_to_admin: {
        total_amount: 0,
        pending_amount: 0,
        received_amount: 0,
        count: 0,
        pending_count: 0,
        received_count: 0
      },
      expense_reimbursement: {
        total_amount: 0,
        pending_amount: 0,
        received_amount: 0,
        count: 0,
        pending_count: 0,
        received_count: 0
      }
    };

    data?.forEach((h: any) => {
      const type = h.handover_type as 'sales_to_admin' | 'expense_reimbursement';
      if (stats[type]) {
        stats[type].count++;
        stats[type].total_amount += h.amount || 0;

        if (['sent', 'pending'].includes(h.status)) {
          stats[type].pending_amount += h.amount || 0;
          stats[type].pending_count++;
        } else if (h.status === 'received') {
          stats[type].received_amount += h.amount || 0;
          stats[type].received_count++;
        }
      }
    });

    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching handover stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to get user email from auth.users
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data.user) return null;
    return data.user.email || null;
  } catch {
    return null;
  }
}

// Helper function to send email notifications
async function sendHandoverNotification(
  agencyId: string,
  handover: any,
  action: 'created' | 'status_changed',
  newStatus?: string,
  notes?: string
) {
  try {
    // Get agency email settings
    const { data: settings } = await supabaseAdmin
      .from('notification_settings')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('type', 'email')
      .single();

    if (!settings || !settings.is_active) {
      console.log('Email notifications not configured or inactive');
      return;
    }

    const config: EmailConfig = {
      provider: settings.provider,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.username,
        pass: settings.password
      },
      from_email: settings.from_email,
      from_name: settings.from_name
    };

    const handoverTypeName = handover.handover_type === 'sales_to_admin' 
      ? 'تسليم مبلغ للإدارة' 
      : 'استرداد مصاريف';
    
    const paymentMethodName = handover.payment_method === 'wire' 
      ? 'تحويل بنكي' 
      : handover.payment_method === 'check' 
        ? 'شيك' 
        : 'نقداً';

    let subject: string;
    let recipientEmail: string | null = null;
    let html: string;

    if (action === 'created') {
      subject = `طلب تسليم مالي جديد - ${handoverTypeName}`;
      // Get recipient email from auth.users
      if (handover.recipient_user_id) {
        recipientEmail = await getUserEmail(handover.recipient_user_id);
      }
      html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>طلب تسليم مالي جديد</h2>
          <p>تم إنشاء طلب تسليم مالي جديد:</p>
          <ul>
            <li><strong>النوع:</strong> ${handoverTypeName}</li>
            <li><strong>المبلغ:</strong> ${handover.amount} درهم</li>
            <li><strong>تاريخ العملية:</strong> ${handover.handover_date}</li>
            <li><strong>طريقة الدفع:</strong> ${paymentMethodName}</li>
            ${handover.payment_reference ? `<li><strong>رقم المرجع:</strong> ${handover.payment_reference}</li>` : ''}
            <li><strong>من:</strong> ${handover.creator?.full_name || '-'}</li>
            ${handover.notes ? `<li><strong>ملاحظات:</strong> ${handover.notes}</li>` : ''}
          </ul>
          <p>يرجى مراجعة الطلب وتحديث حالته.</p>
        </div>
      `;
    } else {
      const statusNames: Record<string, string> = {
        'pending': 'قيد المراجعة',
        'received': 'تم الاستلام',
        'refused': 'مرفوض',
        'canceled': 'ملغى'
      };

      subject = `تحديث حالة طلب التسليم - ${statusNames[newStatus || ''] || newStatus}`;
      // Get creator email from auth.users
      if (handover.created_by) {
        recipientEmail = await getUserEmail(handover.created_by);
      }
      html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>تحديث حالة طلب التسليم</h2>
          <p>تم تحديث حالة طلب التسليم المالي:</p>
          <ul>
            <li><strong>النوع:</strong> ${handoverTypeName}</li>
            <li><strong>المبلغ:</strong> ${handover.amount} درهم</li>
            <li><strong>الحالة الجديدة:</strong> ${statusNames[newStatus || ''] || newStatus}</li>
            ${notes ? `<li><strong>ملاحظات:</strong> ${notes}</li>` : ''}
          </ul>
        </div>
      `;
    }

    if (recipientEmail) {
      await sendEmail(config, recipientEmail, subject, html);
      console.log('Handover notification email sent to:', recipientEmail);
    }
  } catch (error) {
    console.error('Error sending handover notification:', error);
    throw error;
  }
}
