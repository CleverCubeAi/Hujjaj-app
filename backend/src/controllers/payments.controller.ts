import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';

// Legacy: Update pilgrim payment (for backward compatibility)
export const updatePilgrimPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // pilgrim_id
    const { advance_payment, agreed_price } = req.body;
    const agencyId = req.user?.agency_id;
    
    const updates: any = {};
    if (advance_payment !== undefined) updates.advance_payment = advance_payment;
    if (agreed_price !== undefined) updates.agreed_price = agreed_price;
    
    const { data, error } = await supabase
      .from('pilgrims')
      .update(updates)
      .eq('id', id)
      .forAgency(agencyId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get all payments for a booking
export const getBookingPayments = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const agencyId = req.user?.agency_id;

    // Verify booking belongs to agency
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, total_amount, paid_amount, remaining_balance')
      .eq('id', bookingId)
      .forAgency(agencyId)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        *,
        pilgrims (full_name, full_name_ar),
        users:paid_by (full_name)
      `)
      .eq('booking_id', bookingId)
      .order('payment_date', { ascending: false });

    if (error) throw error;

    res.json({
      booking_summary: {
        total_amount: booking.total_amount,
        paid_amount: booking.paid_amount,
        remaining_balance: booking.remaining_balance
      },
      payments
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Record a new payment for booking
export const createBookingPayment = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id;
    const agencyId = req.user?.agency_id;
    const { amount, payment_method, reference_number, notes, pilgrim_id, payment_date } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    // Verify booking belongs to agency
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, remaining_balance')
      .eq('id', bookingId)
      .forAgency(agencyId)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot add payment to cancelled booking' });
    }

    // Create payment
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        booking_id: bookingId,
        pilgrim_id: pilgrim_id || null,
        amount,
        payment_method: payment_method || 'cash',
        reference_number,
        notes,
        paid_by: userId,
        payment_date: payment_date || new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Recalculate paid_amount from all payments (remaining_balance is a generated column)
    const { data: allPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('booking_id', bookingId);

    const newPaidAmount = (allPayments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const { data: currentBooking } = await supabase
      .from('bookings')
      .select('total_amount')
      .eq('id', bookingId)
      .single();

    const totalAmount = (currentBooking as any)?.total_amount || 0;
    const newRemaining = totalAmount - newPaidAmount;

    await supabase
      .from('bookings')
      .update({
        paid_amount: newPaidAmount,
        ...(newRemaining <= 0 && totalAmount > 0 ? { status: 'paid' } : {})
      })
      .eq('id', bookingId);

    res.status(201).json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update a payment
export const updatePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;
    const { amount, payment_method, reference_number, notes, payment_date } = req.body;

    // Verify payment belongs to agency's booking
    const { data: existingPayment } = await supabase
      .from('payments')
      .select(`
        id,
        booking_id,
        bookings!inner (agency_id, status)
      `)
      .eq('id', id)
      .single();

    if (!existingPayment || (existingPayment as any).bookings.agency_id !== agencyId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const { data, error } = await supabase
      .from('payments')
      .update({
        amount,
        payment_method,
        reference_number,
        notes,
        payment_date
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a payment
export const deletePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agency_id;

    // Verify payment belongs to agency's booking
    const { data: payment } = await supabase
      .from('payments')
      .select(`
        id,
        booking_id,
        bookings!inner (agency_id, status)
      `)
      .eq('id', id)
      .single();

    if (!payment || (payment as any).bookings.agency_id !== agencyId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Recalculate paid_amount and remaining_balance
    const { data: allPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('booking_id', payment.booking_id);

    const newPaidAmount = (allPayments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const { data: currentBooking } = await supabase
      .from('bookings')
      .select('total_amount')
      .eq('id', payment.booking_id)
      .single();

    const totalAmount = (currentBooking as any)?.total_amount || 0;
    const newRemaining = totalAmount - newPaidAmount;

    await supabase
      .from('bookings')
      .update({
        paid_amount: newPaidAmount,
        // Revert paid status if no longer fully paid
        ...((payment as any).bookings.status === 'paid' && newRemaining > 0 ? { status: 'confirmed' } : {})
      })
      .eq('id', payment.booking_id);

    res.json({ message: 'Payment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get payment summary by booking
export const getPaymentSummary = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_number,
        total_amount,
        paid_amount,
        remaining_balance,
        status,
        clients (full_name, full_name_ar)
      `)
      .forAgency(agencyId)
      .in('status', ['confirmed', 'paid'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const summary = {
      total_receivable: data?.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0) || 0,
      total_received: data?.reduce((sum: number, b: any) => sum + (b.paid_amount || 0), 0) || 0,
      total_pending: data?.reduce((sum: number, b: any) => sum + (b.remaining_balance || 0), 0) || 0,
      bookings: data
    };

    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get payment methods
export const getPaymentMethods = async (_req: Request, res: Response) => {
  try {
    const methods = [
      { value: 'cash', label: 'نقداً', label_en: 'Cash' },
      { value: 'card', label: 'بطاقة', label_en: 'Card' },
      { value: 'bank_transfer', label: 'تحويل بنكي', label_en: 'Bank Transfer' },
      { value: 'check', label: 'شيك', label_en: 'Check' }
    ];
    res.json(methods);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
