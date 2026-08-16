import { Router } from 'express';
import { Request, Response } from 'express';
import { assertLlmAllowed } from '../services/llm.service';
import { sendApiError } from '../utils/httpError';

const router = Router();

router.get('/status', async (req: Request, res: Response) => {
  try {
    await assertLlmAllowed(req.user?.agency_id || null);
    res.json({ allowed: true });
  } catch (err) {
    return sendApiError(res, err);
  }
});

export default router;
