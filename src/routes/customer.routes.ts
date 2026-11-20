import { Router } from 'express';
import {
  createBooking,
  getCustomerBookings,
  getCustomerBookingById,
  cancelBooking,
  getCustomerOverview,
} from '../controllers/booking.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('customer'));

router.post('/bookings', createBooking);
router.get('/bookings', getCustomerBookings);
router.get('/bookings/:id', getCustomerBookingById);
router.patch('/bookings/:id/cancel', cancelBooking);
router.get('/overview', getCustomerOverview);

export default router;
