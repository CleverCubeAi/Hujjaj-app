import { Router } from 'express';
import {
  getBranches,
  getBranchById,
  getBranchStats,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchUsers
} from '../controllers/branches.controller';
import { requireLimit } from '../middleware/entitlements';

const router = Router();

router.get('/', getBranches);
router.get('/:id', getBranchById);
router.get('/:id/stats', getBranchStats);
router.get('/:id/users', getBranchUsers);
router.post('/', requireLimit('max_branches'), createBranch);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);

export default router;
