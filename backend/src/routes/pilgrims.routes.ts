import { Router } from 'express';
import * as pilgrimsController from '../controllers/pilgrims.controller';
import * as paymentsController from '../controllers/payments.controller';

const router = Router();

router.get('/', pilgrimsController.listPilgrims);
router.get('/:id', pilgrimsController.getPilgrim);
router.post('/', pilgrimsController.createPilgrim);
router.put('/:id', pilgrimsController.updatePilgrim);
router.delete('/:id', pilgrimsController.deletePilgrim);
router.post('/import', pilgrimsController.importPilgrims);

// Payment routes
router.put('/:id/payment', paymentsController.updatePayment);

export default router;
