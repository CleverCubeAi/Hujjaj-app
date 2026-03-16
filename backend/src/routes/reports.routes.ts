import { Router } from 'express';
import * as reportsController from '../controllers/reports.controller';

const router = Router();

router.get('/', reportsController.getReports);
router.get('/export', reportsController.exportReport);
router.get('/financial-status', reportsController.getFinancialStatus);

export default router;
