import { Router } from 'express';
import {
  listFlightInventory,
  getFlightInventory,
  createFlightInventory,
  updateFlightInventory,
  deleteFlightInventory,
  getAvailableSeats,
  getSeatMap
} from '../controllers/flightInventory.controller';

const router = Router();

router.get('/', listFlightInventory);
router.get('/available', getAvailableSeats);
router.get('/:id/seat-map', getSeatMap);
router.get('/:id', getFlightInventory);
router.post('/', createFlightInventory);
router.put('/:id', updateFlightInventory);
router.delete('/:id', deleteFlightInventory);

export default router;
