import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

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

// Public Routes
router.use('/auth', authRoutes);

// Protected Routes
router.use('/seasons', authMiddleware, seasonsRoutes);
router.use('/flights', authMiddleware, flightsRoutes);
router.use('/accommodations', authMiddleware, accommodationsRoutes);
router.use('/pilgrims', authMiddleware, pilgrimsRoutes);
router.use('/expenses', authMiddleware, expensesRoutes);

// New booking workflow routes
router.use('/clients', authMiddleware, clientsRoutes);
router.use('/bookings', authMiddleware, bookingsRoutes);
router.use('/services', authMiddleware, servicesRoutes);
router.use('/payments', authMiddleware, paymentsRoutes);
router.use('/rooms', authMiddleware, roomsRoutes);
router.use('/reports', authMiddleware, reportsRoutes);

// Settings and notifications routes
router.use('/settings', authMiddleware, settingsRoutes);
router.use('/users', authMiddleware, usersRoutes);
router.use('/branches', authMiddleware, branchesRoutes);
router.use('/notifications', authMiddleware, notificationsRoutes);
router.use('/expense-categories', authMiddleware, expenseCategoriesRoutes);
router.use('/hotel-inventory', authMiddleware, hotelInventoryRoutes);
router.use('/flight-inventory', authMiddleware, flightInventoryRoutes);
router.use('/handovers', authMiddleware, handoversRoutes);
router.use('/dashboard', authMiddleware, dashboardRoutes);
router.use('/upload', authMiddleware, uploadRoutes);
router.use('/booking-locks', authMiddleware, bookingLocksRoutes);
router.use('/discounts', authMiddleware, discountsRoutes);
router.use('/messages', authMiddleware, messagesRoutes);

export default router;
