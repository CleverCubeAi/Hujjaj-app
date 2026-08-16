import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantGuard, requireAgencyOnMutate } from '../utils/tenant';
import { rlsContextMiddleware } from '../middleware/rlsContext';

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

const router = Router();

const protect = [authMiddleware, tenantGuard, rlsContextMiddleware, requireAgencyOnMutate];

// Public Routes
router.use('/auth', authRoutes);

// Protected Routes
router.use('/seasons', ...protect, seasonsRoutes);
router.use('/flights', ...protect, flightsRoutes);
router.use('/accommodations', ...protect, accommodationsRoutes);
router.use('/pilgrims', ...protect, pilgrimsRoutes);
router.use('/expenses', ...protect, expensesRoutes);

// New booking workflow routes
router.use('/clients', ...protect, clientsRoutes);
router.use('/bookings', ...protect, bookingsRoutes);
router.use('/services', ...protect, servicesRoutes);
router.use('/payments', ...protect, paymentsRoutes);
router.use('/rooms', ...protect, roomsRoutes);
router.use('/reports', ...protect, reportsRoutes);

// Settings and notifications routes
router.use('/settings', ...protect, settingsRoutes);
router.use('/users', ...protect, usersRoutes);
router.use('/branches', ...protect, branchesRoutes);
router.use('/notifications', ...protect, notificationsRoutes);
router.use('/expense-categories', ...protect, expenseCategoriesRoutes);
router.use('/hotel-inventory', ...protect, hotelInventoryRoutes);
router.use('/flight-inventory', ...protect, flightInventoryRoutes);
router.use('/handovers', ...protect, handoversRoutes);
router.use('/dashboard', ...protect, dashboardRoutes);
router.use('/upload', ...protect, uploadRoutes);
router.use('/booking-locks', ...protect, bookingLocksRoutes);
router.use('/discounts', ...protect, discountsRoutes);
router.use('/messages', ...protect, messagesRoutes);

export default router;
