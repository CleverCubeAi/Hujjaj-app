import cron from 'node-cron';
import { supabaseAdmin } from '../services/supabase';

// Check interval in minutes (from environment or default to 5)
const CHECK_INTERVAL_MINUTES = parseInt(process.env.HOLD_EXPIRY_CHECK_INTERVAL_MINUTES || '5');

/**
 * Expires booking holds that have passed their 24-hour deadline
 * Runs every X minutes (default: 5)
 */
export async function expireBookingHoldsJob() {
  console.log(`[ExpireBookings Job] Running at ${new Date().toISOString()}`);
  
  try {
    // Find all draft bookings with expired holds
    const { data: expiredBookings, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_number, hold_session_id, agency_id')
      .eq('status', 'draft')
      .not('hold_expires_at', 'is', null)
      .lt('hold_expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('[ExpireBookings Job] Error fetching expired bookings:', fetchError);
      return;
    }

    if (!expiredBookings || expiredBookings.length === 0) {
      console.log('[ExpireBookings Job] No expired booking holds found');
      return;
    }

    console.log(`[ExpireBookings Job] Found ${expiredBookings.length} expired booking holds`);

    let expiredCount = 0;

    // Expire each booking
    for (const booking of expiredBookings) {
      try {
        // Delete associated locks
        await supabaseAdmin
          .from('booking_locks')
          .delete()
          .eq('booking_id', booking.id);

        // Update booking status to expired
        const { error: updateError } = await supabaseAdmin
          .from('bookings')
          .update({
            status: 'expired',
            hold_expires_at: null,
            hold_session_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', booking.id);

        if (updateError) {
          console.error(`[ExpireBookings Job] Error expiring booking ${booking.booking_number}:`, updateError);
        } else {
          expiredCount++;
          console.log(`[ExpireBookings Job] Expired booking ${booking.booking_number}`);
        }
      } catch (err) {
        console.error(`[ExpireBookings Job] Error processing booking ${booking.booking_number}:`, err);
      }
    }

    // Cleanup any orphaned expired locks (locks without valid bookings)
    const { error: cleanupError } = await supabaseAdmin
      .from('booking_locks')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (cleanupError) {
      console.error('[ExpireBookings Job] Error cleaning up orphaned locks:', cleanupError);
    }

    console.log(`[ExpireBookings Job] Completed. Expired ${expiredCount} bookings.`);
  } catch (error) {
    console.error('[ExpireBookings Job] Unexpected error:', error);
  }
}

/**
 * Schedule the expiration job to run every X minutes
 */
export function scheduleExpireBookingsJob() {
  // Cron expression for every X minutes: */X * * * *
  const cronExpression = `*/${CHECK_INTERVAL_MINUTES} * * * *`;
  
  console.log(`[ExpireBookings Job] Scheduling to run every ${CHECK_INTERVAL_MINUTES} minutes`);
  
  cron.schedule(cronExpression, () => {
    expireBookingHoldsJob();
  });

  // Also run immediately on startup
  console.log('[ExpireBookings Job] Running initial check on startup...');
  expireBookingHoldsJob();
}

export default {
  expireBookingHoldsJob,
  scheduleExpireBookingsJob
};
