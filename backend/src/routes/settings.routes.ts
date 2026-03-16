import { Router } from 'express';
import {
  getAgency,
  updateAgency,
  getProfile,
  updateProfile,
  changePassword,
  getPreferences,
  updatePreferences,
  getDeletionPasswordStatus,
  setDeletionPassword
} from '../controllers/settings.controller';

const router = Router();

router.get('/agency', getAgency);
router.put('/agency', updateAgency);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

// Deletion password (security settings)
router.get('/deletion-password/status', getDeletionPasswordStatus);
router.put('/deletion-password', setDeletionPassword);

export default router;
