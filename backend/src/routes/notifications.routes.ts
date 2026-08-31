import { Router } from 'express';
import {
  getEmailSettings,
  updateEmailSettings,
  testEmail,
  getSMSSettings,
  updateSMSSettings,
  testSMS,
  getInbox,
  markInboxSeen
} from '../controllers/notifications.controller';
import { requireFeature } from '../middleware/entitlements';

const router = Router();

router.get('/inbox', getInbox);
router.post('/inbox/seen', markInboxSeen);
router.get('/email', getEmailSettings);
router.put('/email', updateEmailSettings);
router.post('/email/test', requireFeature('email'), testEmail);
router.get('/sms', getSMSSettings);
router.put('/sms', updateSMSSettings);
router.post('/sms/test', requireFeature('sms'), testSMS);

export default router;
