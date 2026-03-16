import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';

const router = Router();

// GET /api/dashboard - Get dashboard statistics with role-based filtering
router.get('/', getDashboardStats);

export default router;
