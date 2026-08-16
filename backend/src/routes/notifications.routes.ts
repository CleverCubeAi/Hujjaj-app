import { Router } from 'express';
import {
  getEmailSettings,
  updateEmailSettings,
  testEmail,
  getSMSSettings,
  updateSMSSettings,
  testSMS
} from '../controllers/notifications.controller';
import { requireFeature } from '../middleware/entitlements';

const router = Router();

router.get('/email', getEmailSettings);
router.put('/email', updateEmailSettings);
router.post('/email/test', requireFeature('email'), testEmail);
router.get('/sms', getSMSSettings);
router.put('/sms', updateSMSSettings);
router.post('/sms/test', requireFeature('sms'), testSMS);

export default router;
