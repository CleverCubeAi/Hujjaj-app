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
  setDeletionPassword,
  getSessionBranding
} from '../controllers/settings.controller';
import { getAgencySubscription } from '../controllers/packages.controller';
import { requireRoles } from '../middleware/roles';

const router = Router();

router.get('/agency', getAgency);
router.put('/agency', updateAgency);
router.get('/branding', getSessionBranding);
router.get('/subscription', requireRoles('agency_admin'), getAgencySubscription);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);
router.get('/deletion-password/status', getDeletionPasswordStatus);
router.put('/deletion-password', setDeletionPassword);

export default router;
