import { Router } from 'express';
import {
  createBooking,
  getCustomerBookings,
  getCustomerBookingById,
  cancelBooking,
} from '../controllers/booking.controller.js';
import { updateVendorBookingStatus } from '../controllers/vendor.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize('customer'), createBooking);
router.get('/', authorize('customer'), getCustomerBookings);
router.get('/my', authorize('customer'), getCustomerBookings);
router.get('/customer', authorize('customer'), getCustomerBookings);
router.get('/:id', authorize('customer'), getCustomerBookingById);
router.patch('/:id/cancel', authorize('customer'), cancelBooking);

router.patch('/:id/status', (req, res, next) => {
  if (req.user?.role === 'vendor') {
    return updateVendorBookingStatus(req, res, next);
  }
  return cancelBooking(req, res, next);
});

router.patch('/:id', (req, res, next) => {
  if (req.user?.role === 'vendor') {
    return updateVendorBookingStatus(req, res, next);
  }
  return cancelBooking(req, res, next);
});

router.post('/:id/accept', (req, res, next) => {
  if (req.user?.role === 'vendor') {
    req.body = { status: 'accepted' };
    return updateVendorBookingStatus(req, res, next);
  }
  res.status(403).json({ success: false, message: 'Forbidden: Access denied. Required role: vendor' });
});

router.post('/:id/reject', (req, res, next) => {
  if (req.user?.role === 'vendor') {
    req.body = { status: 'rejected' };
    return updateVendorBookingStatus(req, res, next);
  }
  res.status(403).json({ success: false, message: 'Forbidden: Access denied. Required role: vendor' });
});

export default router;
