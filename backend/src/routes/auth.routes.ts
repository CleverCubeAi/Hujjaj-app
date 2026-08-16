import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';
import { rlsContextMiddleware } from '../middleware/rlsContext';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../schemas/auth';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

router.post('/login', authLimiter, validateBody(loginSchema), authController.login);
router.post('/register', authLimiter, validateBody(registerSchema), authController.register);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authMiddleware, rlsContextMiddleware, authController.me);

export default router;
