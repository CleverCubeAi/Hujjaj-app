import { Router } from 'express';
import { 
  allocateRooms,
  getBookingRoomAssignments,
  createRoomAssignment,
  updateRoomAssignment,
  deleteRoomAssignment,
  getAvailableRooms
} from '../controllers/rooms.controller';
import { authMiddleware as authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Room allocation
router.post('/booking/:bookingId/allocate', allocateRooms);
router.get('/booking/:bookingId', getBookingRoomAssignments);

// Manual assignments
router.post('/', createRoomAssignment);
router.put('/:id', updateRoomAssignment);
router.delete('/:id', deleteRoomAssignment);

// Availability check
router.get('/availability/:accommodationId', getAvailableRooms);

export default router;
