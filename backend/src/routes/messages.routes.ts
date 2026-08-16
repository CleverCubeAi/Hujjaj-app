import { Router } from 'express';
import {
  listSentMessages,
  sendMessage,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate
} from '../controllers/messages.controller';
import { requireFeature } from '../middleware/entitlements';

const router = Router();

router.get('/sent', listSentMessages);
router.post('/send', requireFeature('sms'), sendMessage);

router.get('/templates', listTemplates);
router.get('/templates/:id', getTemplate);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

export default router;
