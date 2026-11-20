import { Router } from 'express';
import {
  createCheckoutSession,
  getSessionStatus,
} from '../controllers/payment.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('vendor'));

router.post('/create-checkout-session', createCheckoutSession);
router.get('/session-status', getSessionStatus);

export default router;
