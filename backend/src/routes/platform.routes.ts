import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { validateBody } from '../middleware/validate';
import {
  createAgencySchema,
  updateAgencySchema,
  createAgencyUserSchema,
  updateAgencyUserSchema,
} from '../schemas/platform';
import {
  brandingPatchSchema,
  createPackageSchema,
  updatePackageSchema,
  assignSubscriptionSchema,
  platformEmailSchema,
  platformEmailTestSchema,
  llmPatchSchema,
  paymentGatewayPatchSchema,
  createPlatformInvoiceSchema,
  markPaidSchema,
} from '../schemas/appManagement';
import {
  getPlatformDashboard,
  listAgencies,
  getAgencyById,
  createAgency,
  updateAgency,
  listAgencyUsers,
  createAgencyUser,
  updateAgencyUser,
  deleteAgencyUser,
} from '../controllers/platform.controller';
import { getPlatformBranding, patchPlatformBranding } from '../controllers/branding.controller';
import { uploadPlatformBranding } from '../controllers/upload.controller';
import {
  listPackages,
  createPackage,
  updatePackage,
  deletePackage,
  assignAgencySubscription,
} from '../controllers/packages.controller';
import { getPlatformEmail, patchPlatformEmail, testPlatformEmail } from '../controllers/platformEmail.controller';
import { getPlatformLlm, patchPlatformLlm, testPlatformLlm, getPlatformLlmUsage } from '../controllers/llm.controller';
import {
  listPaymentGateways,
  getPaymentGateway,
  patchPaymentGateway,
  testPaymentGateway,
  listPlatformInvoices,
  createPlatformInvoice,
  markInvoicePaid,
  voidInvoice,
  refundInvoice,
} from '../controllers/platformPayments.controller';

const router = Router();

const testLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.get('/dashboard', getPlatformDashboard);
router.get('/agencies', listAgencies);
router.post('/agencies', validateBody(createAgencySchema), createAgency);
router.get('/agencies/:id', getAgencyById);
router.patch('/agencies/:id', validateBody(updateAgencySchema), updateAgency);
router.post('/agencies/:id/subscription', validateBody(assignSubscriptionSchema), assignAgencySubscription);
router.get('/agencies/:id/users', listAgencyUsers);
router.post('/agencies/:id/users', validateBody(createAgencyUserSchema), createAgencyUser);
router.patch('/agencies/:id/users/:userId', validateBody(updateAgencyUserSchema), updateAgencyUser);
router.delete('/agencies/:id/users/:userId', deleteAgencyUser);

router.get('/settings/branding', getPlatformBranding);
router.patch('/settings/branding', validateBody(brandingPatchSchema), patchPlatformBranding);
router.post('/upload/branding', brandingUpload.single('file'), uploadPlatformBranding);

router.get('/packages', listPackages);
router.post('/packages', validateBody(createPackageSchema), createPackage);
router.patch('/packages/:id', validateBody(updatePackageSchema), updatePackage);
router.delete('/packages/:id', deletePackage);

router.get('/settings/email', getPlatformEmail);
router.patch('/settings/email', validateBody(platformEmailSchema), patchPlatformEmail);
router.post('/settings/email/test', testLimiter, validateBody(platformEmailTestSchema), testPlatformEmail);

router.get('/settings/llm', getPlatformLlm);
router.patch('/settings/llm', validateBody(llmPatchSchema), patchPlatformLlm);
router.post('/settings/llm/test', testLimiter, testPlatformLlm);
router.get('/settings/llm/usage', getPlatformLlmUsage);

router.get('/settings/payments', listPaymentGateways);
router.get('/settings/payments/:provider', getPaymentGateway);
router.patch('/settings/payments/:provider', validateBody(paymentGatewayPatchSchema), patchPaymentGateway);
router.post('/settings/payments/:provider/test', testLimiter, testPaymentGateway);

router.get('/invoices', listPlatformInvoices);
router.post('/invoices', validateBody(createPlatformInvoiceSchema), createPlatformInvoice);
router.post('/invoices/:id/mark-paid', validateBody(markPaidSchema), markInvoicePaid);
router.post('/invoices/:id/void', voidInvoice);
router.post('/invoices/:id/refund', refundInvoice);

export default router;
