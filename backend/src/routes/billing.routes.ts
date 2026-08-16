import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { checkoutSchema } from '../schemas/appManagement';
import { requireRoles } from '../middleware/roles';
import {
  createCheckout,
  listAgencyInvoices,
  getAgencyInvoice,
} from '../controllers/billing.controller';

const router = Router();

router.post('/checkout', requireRoles('agency_admin'), validateBody(checkoutSchema), createCheckout);
router.get('/invoices', requireRoles('agency_admin'), listAgencyInvoices);
router.get('/invoices/:id', requireRoles('agency_admin'), getAgencyInvoice);

export default router;
