import { Router } from 'express';
import * as seasonsController from '../controllers/seasons.controller';

const router = Router();

router.get('/', seasonsController.listSeasons);
router.get('/:id', seasonsController.getSeason);
router.post('/', seasonsController.createSeason);
router.put('/:id', seasonsController.updateSeason);
router.delete('/:id', seasonsController.deleteSeason);

export default router;
