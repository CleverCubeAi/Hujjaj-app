import { Router } from 'express';
import * as accommodationsController from '../controllers/accommodations.controller';

const router = Router();

// Accommodations
router.get('/', accommodationsController.listAccommodations);
router.get('/:id', accommodationsController.getAccommodation);
router.post('/', accommodationsController.createAccommodation);
router.put('/:id', accommodationsController.updateAccommodation);
router.delete('/:id', accommodationsController.deleteAccommodation);

// Capacity
router.get('/:id/capacity', accommodationsController.getCapacity);

// Room Types
router.post('/room-types', accommodationsController.createRoomType);
router.put('/room-types/:id', accommodationsController.updateRoomType);
router.delete('/room-types/:id', accommodationsController.deleteRoomType);

export default router;
