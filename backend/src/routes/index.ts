import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantGuard, requireAgencyOnMutate } from '../utils/tenant';
import { rlsContextMiddleware } from '../middleware/rlsContext';
import { requireRoles, denyRoles } from '../middleware/roles';
import { requireFeature } from '../middleware/entitlements';

import authRoutes from './auth.routes';
import seasonsRoutes from './seasons.routes';
import flightsRoutes from './flights.routes';
import accommodationsRoutes from './accommodations.routes';
import pilgrimsRoutes from './pilgrims.routes';
import expensesRoutes from './expenses.routes';
import clientsRoutes from './clients.routes';
import bookingsRoutes from './bookings.routes';
import servicesRoutes from './services.routes';
import paymentsRoutes from './payments.routes';
import roomsRoutes from './rooms.routes';
import reportsRoutes from './reports.routes';
import settingsRoutes from './settings.routes';
import usersRoutes from './users.routes';
import notificationsRoutes from './notifications.routes';
import expenseCategoriesRoutes from './expense_categories.routes';
import hotelInventoryRoutes from './hotelInventory.routes';
import flightInventoryRoutes from './flightInventory.routes';
import handoversRoutes from './handovers.routes';
import branchesRoutes from './branches.routes';
import dashboardRoutes from './dashboard.routes';
import uploadRoutes from './upload.routes';
import bookingLocksRoutes from './bookingLocks.routes';
import discountsRoutes from './discounts.routes';
import messagesRoutes from './messages.routes';
import platformRoutes from './platform.routes';
import publicRoutes from './public.routes';
import billingRoutes from './billing.routes';
import llmRoutes from './llm.routes';
import { cmiPayRedirect, cmiWebhook } from '../controllers/billing.controller';

const router = Router();

const authOnly = [authMiddleware, rlsContextMiddleware];
const agencyProtect = [
  authMiddleware,
  denyRoles('super_admin'),
  tenantGuard,
  rlsContextMiddleware,
  requireAgencyOnMutate,
];
const platformProtect = [authMiddleware, requireRoles('super_admin'), rlsContextMiddleware];

router.use('/auth', authRoutes);
router.use('/public', publicRoutes);
router.post('/billing/webhooks/cmi', cmiWebhook);
router.get('/billing/cmi/pay/:invoiceId', cmiPayRedirect);

router.use('/platform', ...platformProtect, platformRoutes);
router.use('/settings', ...authOnly, settingsRoutes);
router.use('/billing', ...agencyProtect, billingRoutes);
router.use('/llm', ...agencyProtect, llmRoutes);

router.use('/seasons', ...agencyProtect, seasonsRoutes);
router.use('/flights', ...agencyProtect, flightsRoutes);
router.use('/accommodations', ...agencyProtect, accommodationsRoutes);
router.use('/pilgrims', ...agencyProtect, pilgrimsRoutes);
router.use('/expenses', ...agencyProtect, expensesRoutes);

router.use('/clients', ...agencyProtect, clientsRoutes);
router.use('/bookings', ...agencyProtect, bookingsRoutes);
router.use('/services', ...agencyProtect, servicesRoutes);
router.use('/payments', ...agencyProtect, paymentsRoutes);
router.use('/rooms', ...agencyProtect, roomsRoutes);
router.use('/reports', ...agencyProtect, requireFeature('reports'), reportsRoutes);

router.use('/users', ...agencyProtect, usersRoutes);
router.use('/branches', ...agencyProtect, branchesRoutes);
router.use('/notifications', ...agencyProtect, notificationsRoutes);
router.use('/expense-categories', ...agencyProtect, expenseCategoriesRoutes);
router.use('/hotel-inventory', ...agencyProtect, requireFeature('inventory'), hotelInventoryRoutes);
router.use('/flight-inventory', ...agencyProtect, requireFeature('inventory'), flightInventoryRoutes);
router.use('/handovers', ...agencyProtect, handoversRoutes);
router.use('/dashboard', ...agencyProtect, dashboardRoutes);
router.use('/upload', ...agencyProtect, uploadRoutes);
router.use('/booking-locks', ...agencyProtect, bookingLocksRoutes);
router.use('/discounts', ...agencyProtect, requireFeature('discounts'), discountsRoutes);
router.use('/messages', ...agencyProtect, messagesRoutes);

export default router;

