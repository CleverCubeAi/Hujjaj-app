import { Router } from 'express';
import {
  listHotelInventory,
  getHotelInventory,
  createHotelInventory,
  updateHotelInventory,
  deleteHotelInventory,
  getAvailableRooms,
  getBedMap
} from '../controllers/hotelInventory.controller';

const router = Router();

router.get('/', listHotelInventory);
router.get('/available', getAvailableRooms);
router.get('/:id/bed-map', getBedMap);
router.get('/:id', getHotelInventory);
router.post('/', createHotelInventory);
router.put('/:id', updateHotelInventory);
router.delete('/:id', deleteHotelInventory);

export default router;
