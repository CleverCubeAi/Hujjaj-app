import { Router } from 'express';
import { getPublicBranding } from '../controllers/branding.controller';
import { listPublicPackages } from '../controllers/packages.controller';

const router = Router();

router.get('/branding', getPublicBranding);
router.get('/packages', listPublicPackages);

export default router;
