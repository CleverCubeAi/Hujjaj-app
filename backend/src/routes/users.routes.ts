import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserRole
} from '../controllers/users.controller';
import { requireRoles } from '../middleware/roles';
import { validateBody } from '../middleware/validate';
import { createUserSchema } from '../schemas/auth';
import { requireLimit } from '../middleware/entitlements';

const router = Router();

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', requireRoles('agency_admin'), requireLimit('max_users'), validateBody(createUserSchema), createUser);
router.put('/:id', requireRoles('agency_admin'), updateUser);
router.delete('/:id', requireRoles('agency_admin'), deleteUser);
router.put('/:id/role', requireRoles('agency_admin'), updateUserRole);

export default router;
