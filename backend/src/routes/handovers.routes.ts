import { Router } from 'express';
import * as handoversController from '../controllers/handovers.controller';

const router = Router();

// Get all handovers with filters
router.get('/', handoversController.getHandovers);

// Get handover statistics
router.get('/stats', handoversController.getHandoverStats);

// Get single handover with status history
router.get('/:id', handoversController.getHandoverById);

// Create new handover
router.post('/', handoversController.createHandover);

// Update handover status (admin only)
router.put('/:id/status', handoversController.updateHandoverStatus);

// Cancel/delete handover
router.delete('/:id', handoversController.deleteHandover);

export default router;
