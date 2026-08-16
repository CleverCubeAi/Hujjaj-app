import { Router } from 'express';
import { 
  getBookings,
  getBookingById,
  getBookingHotels,
  createBooking,
  updateBooking,
  confirmBooking,
  cancelBooking,
  addPilgrimToBooking,
  removePilgrimFromBooking,
  getBookingInvoice,
  exportInvoicePDF,
  addInvoiceItem,
  deleteInvoiceItem,
  softDeleteBooking,
  permanentDeleteBooking,
  extendBookingHold,
  getBookingHoldStatus
} from '../controllers/bookings.controller';
import { authMiddleware as authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Booking CRUD
router.get('/', getBookings);
router.get('/:id', getBookingById);
router.get('/:id/hotels', getBookingHotels);
router.post('/', createBooking);
router.put('/:id', updateBooking);
router.delete('/:id', softDeleteBooking);  // Soft delete with password verification

// Booking actions
router.post('/:id/confirm', confirmBooking);
router.post('/:id/cancel', cancelBooking);
router.post('/:id/permanent-delete', permanentDeleteBooking);  // Permanently delete (admin only)

// Pilgrims management
router.post('/:id/pilgrims', addPilgrimToBooking);
router.delete('/:id/pilgrims/:pilgrimId', removePilgrimFromBooking);

// Invoice
router.get('/:id/invoice', getBookingInvoice);
router.get('/:id/invoice/pdf', exportInvoicePDF);
router.post('/:id/invoice-items', addInvoiceItem);
router.delete('/:id/invoice-items/:itemId', deleteInvoiceItem);

// Booking holds (24-hour reservation) — expiry is handled by the server cron job
router.get('/:id/hold-status', getBookingHoldStatus);
router.post('/:id/extend-hold', extendBookingHold);

export default router;
