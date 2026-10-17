import { Router } from 'express';
import { requireRoles } from '../middleware/roles';
import {
  archiveTravelPackage,
  createTravelPackage,
  getTravelPackage,
  getTravelPackageCatalog,
  listTravelPackages,
  publishTravelPackage,
  updateTravelPackage,
} from '../controllers/travelPackages.controller';

const router = Router();
const editors = requireRoles('agency_admin', 'manager');

router.get('/catalog', editors, getTravelPackageCatalog);
router.get('/', listTravelPackages);
router.get('/:id', getTravelPackage);
router.post('/', editors, createTravelPackage);
router.put('/:id', editors, updateTravelPackage);
router.post('/:id/publish', editors, publishTravelPackage);
router.post('/:id/archive', editors, archiveTravelPackage);

export default router;
