import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';
import { SMSConfig, sendSMS } from '../services/sms.service';

// Load SMS config for agency (same pattern as notifications.controller)
async function getSMSConfig(agencyId: string): Promise<SMSConfig | null> {
  const { data: settings, error } = await supabase
    .from('sms_settings')
    .select('*')
    .eq('agency_id', agencyId)
    .single();

  if (error || !settings || !settings.enabled) return null;

  const config: SMSConfig = {
    provider: settings.provider as 'twilio' | 'custom'
  };

  if (settings.provider === 'twilio') {
    if (!settings.account_sid_encrypted || !settings.auth_token_encrypted) return null;
    config.account_sid = settings.account_sid_encrypted;
    config.auth_token = settings.auth_token_encrypted;
    config.from_number = settings.from_number;
  } else if (settings.provider === 'custom') {
    if (!settings.api_url || !settings.api_key_encrypted) return null;
    config.api_url = settings.api_url;
    config.api_key = settings.api_key_encrypted;
    if (settings.api_secret_encrypted) config.api_secret = settings.api_secret_encrypted;
    config.from_number = settings.from_number;
  }

  return config;
}

// Replace placeholders in template body
function replacePlaceholders(body: string, vars: Record<string, string>): string {
  let result = body;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result.replace(/\{\{[^}]+\}\}/g, '');
}

// ========== Sent messages ==========

export const listSentMessages = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    if (!agencyId && req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Agency ID not found' });

    const { status, client_id, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('sent_messages')
      .select(`
        id, channel, recipient_phone, recipient_name, body, status, error_message,
        client_id, booking_id, template_id, sent_by, created_at,
        clients (id, full_name, full_name_ar),
        bookings (id, booking_number)
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (status && typeof status === 'string') query = query.eq('status', status);
    if (client_id && typeof client_id === 'string') query = query.eq('client_id', client_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const userId = req.user?.id;
    if (!agencyId) {
      return res.status(400).json({
        error: 'Agency ID required to send messages. Super admin is not tied to an agency.',
      });
    }

    const { template_id, body: rawBody, recipient_phone, recipient_name, client_id, booking_id } = req.body;

    if (!recipient_phone) {
      return res.status(400).json({ error: 'recipient_phone is required' });
    }

    let body = rawBody;
    let recipientName = recipient_name || '';

    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('message_templates')
        .select('body')
        .eq('id', template_id)
        .eq('agency_id', agencyId)
        .single();

      if (templateError || !template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const vars: Record<string, string> = {
        client_name: '',
        booking_number: '',
        total: '',
        paid: '',
        remaining: '',
        pilgrim_name: ''
      };

      if (client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('full_name, full_name_ar')
          .eq('id', client_id)
          .eq('agency_id', agencyId)
          .single();
        if (client) {
          vars.client_name = client.full_name_ar || client.full_name || '';
          if (!recipientName) recipientName = client.full_name_ar || client.full_name || '';
        }
      }

      if (booking_id) {
        const { data: booking } = await supabase
          .from('bookings')
          .select(`
            booking_number, total_amount, paid_amount, remaining_balance,
            pilgrims (full_name, full_name_ar)
          `)
          .eq('id', booking_id)
          .eq('agency_id', agencyId)
          .single();

        if (booking) {
          const b = booking as any;
          vars.booking_number = b.booking_number || '';
          vars.total = String(b.total_amount ?? 0);
          vars.paid = String(b.paid_amount ?? 0);
          vars.remaining = String(b.remaining_balance ?? 0);
          const pilgrims = b.pilgrims;
          if (Array.isArray(pilgrims) && pilgrims.length > 0) {
            vars.pilgrim_name = pilgrims[0].full_name_ar || pilgrims[0].full_name || '';
          }
        }
      }

      body = replacePlaceholders(template.body, vars);
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Message body is required' });
    }

    const smsConfig = await getSMSConfig(agencyId);
    if (!smsConfig) {
      return res.status(503).json({ error: 'SMS is not configured. Configure it in Settings.' });
    }

    let status: 'sent' | 'failed' = 'sent';
    let errorMessage: string | null = null;

    try {
      await sendSMS(smsConfig, recipient_phone, body);
    } catch (err: any) {
      status = 'failed';
      errorMessage = err.message || 'Send failed';
    }

    const { data: inserted, error: insertError } = await supabase
      .from('sent_messages')
      .insert({
        agency_id: agencyId,
        channel: 'sms',
        recipient_phone,
        recipient_name: recipientName || null,
        body,
        status,
        error_message: errorMessage,
        client_id: client_id || null,
        booking_id: booking_id || null,
        template_id: template_id || null,
        sent_by: userId
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (status === 'failed') {
      return res.status(500).json({
        error: errorMessage,
        sent_message: inserted
      });
    }

    res.json(inserted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ========== Templates CRUD ==========

export const listTemplates = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    if (!agencyId && req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Agency ID not found' });

    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTemplate = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const { id } = req.params;
    if (!agencyId && req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Agency ID not found' });

    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Template not found' });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const { name, name_ar, body, channel = 'sms' } = req.body;
    if (!agencyId && req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Agency ID not found' });
    if (!name || !body) return res.status(400).json({ error: 'name and body are required' });

    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        agency_id: agencyId,
        name,
        name_ar: name_ar || null,
        body,
        channel
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const { id } = req.params;
    const { name, name_ar, body, channel } = req.body;
    if (!agencyId && req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Agency ID not found' });

    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (name_ar !== undefined) updates.name_ar = name_ar;
    if (body !== undefined) updates.body = body;
    if (channel !== undefined) updates.channel = channel;

    const { data, error } = await supabase
      .from('message_templates')
      .update(updates)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Template not found' });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const { id } = req.params;
    if (!agencyId && req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Agency ID not found' });

    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) throw error;
    res.json({ message: 'Template deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
