import { Router } from 'express';
import { 
  createLock, 
  releaseLock, 
  releaseAllLocks, 
  getActiveLocks, 
  extendLock,
  getAvailabilityWithLocks,
  cleanupExpiredLocks,
  deleteAllLocks
} from '../controllers/bookingLocks.controller';

const router = Router();

// Create a new lock
router.post('/', createLock);

// Get active locks (with optional filters)
router.get('/', getActiveLocks);

// Get availability considering locks
router.get('/availability', getAvailabilityWithLocks);

// Clean up expired locks
router.post('/cleanup', cleanupExpiredLocks);

// Delete all locks (admin/testing)
router.delete('/all', deleteAllLocks);

// Extend locks for a session
router.put('/extend/:session_id', extendLock);

// Release specific lock type for a session
router.delete('/:session_id/:resource_type', releaseLock);

// Release all locks for a session
router.delete('/:session_id', releaseAllLocks);

export default router;
