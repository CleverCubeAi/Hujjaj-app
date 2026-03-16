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

const router = Router();

router.get('/sent', listSentMessages);
router.post('/send', sendMessage);

router.get('/templates', listTemplates);
router.get('/templates/:id', getTemplate);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

export default router;
