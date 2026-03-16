import { Router } from 'express';
import { 
  getClients, 
  getClientById, 
  createClient, 
  updateClient, 
  deleteClient 
} from '../controllers/clients.controller';
import { authMiddleware as authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getClients);
router.get('/:id', getClientById);
router.post('/', createClient);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);

export default router;
