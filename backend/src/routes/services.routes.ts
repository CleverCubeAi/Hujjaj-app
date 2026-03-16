import { Router } from 'express';
import { 
  getServices, 
  getServiceById, 
  createService, 
  updateService, 
  deleteService,
  getServiceCategories
} from '../controllers/services.controller';
import { authMiddleware as authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/categories', getServiceCategories);
router.get('/', getServices);
router.get('/:id', getServiceById);
router.post('/', createService);
router.put('/:id', updateService);
router.delete('/:id', deleteService);

export default router;
