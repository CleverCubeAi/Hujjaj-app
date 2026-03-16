import { Router } from 'express';
import { 
  updatePilgrimPayment,
  getBookingPayments,
  createBookingPayment,
  updatePayment,
  deletePayment,
  getPaymentSummary,
  getPaymentMethods
} from '../controllers/payments.controller';
import { authMiddleware as authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Payment methods reference
router.get('/methods', getPaymentMethods);

// Payment summary
router.get('/summary', getPaymentSummary);

// Booking payments
router.get('/booking/:bookingId', getBookingPayments);
router.post('/booking/:bookingId', createBookingPayment);

// Individual payment operations
router.put('/:id', updatePayment);
router.delete('/:id', deletePayment);

// Legacy: pilgrim direct payment update
router.put('/pilgrim/:id', updatePilgrimPayment);

export default router;
