import { Router } from 'express';
import {
  getEmailSettings,
  updateEmailSettings,
  testEmail,
  getSMSSettings,
  updateSMSSettings,
  testSMS
} from '../controllers/notifications.controller';

const router = Router();

router.get('/email', getEmailSettings);
router.put('/email', updateEmailSettings);
router.post('/email/test', testEmail);
router.get('/sms', getSMSSettings);
router.put('/sms', updateSMSSettings);
router.post('/sms/test', testSMS);

export default router;
