import { Router } from 'express';
import * as flightsController from '../controllers/flights.controller';

const router = Router();

router.get('/', flightsController.listFlights);
router.get('/:id', flightsController.getFlight);
router.post('/', flightsController.createFlight);
router.put('/:id', flightsController.updateFlight);
router.delete('/:id', flightsController.deleteFlight);

export default router;
