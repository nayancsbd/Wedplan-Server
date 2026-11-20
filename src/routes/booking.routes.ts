import { Router } from 'express';
import { createBooking } from '../controllers/booking.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('customer'));

router.post('/', createBooking);

export default router;
