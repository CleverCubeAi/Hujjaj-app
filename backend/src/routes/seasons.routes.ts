import { Router } from 'express';
import * as seasonsController from '../controllers/seasons.controller';
import { requireLimit } from '../middleware/entitlements';

const router = Router();

router.get('/', seasonsController.listSeasons);
router.get('/:id', seasonsController.getSeason);
router.post('/', requireLimit('max_seasons'), seasonsController.createSeason);
router.put('/:id', seasonsController.updateSeason);
router.delete('/:id', seasonsController.deleteSeason);

export default router;
