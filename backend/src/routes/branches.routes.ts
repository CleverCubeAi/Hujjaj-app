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

const router = Router();

router.get('/', getBranches);
router.get('/:id', getBranchById);
router.get('/:id/stats', getBranchStats);
router.get('/:id/users', getBranchUsers);
router.post('/', createBranch);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);

export default router;
