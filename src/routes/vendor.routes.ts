import { Router } from 'express';
import {
  createService,
  getVendorServices,
  updateVendorService,
  toggleServiceAvailability,
  deleteVendorService,
  getVendorOverview,
  getVendorBookings,
  updateVendorBookingStatus,
  getVendorTransactions,
  getVendorSubscription,
} from '../controllers/vendor.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('vendor'));

router.post('/services', createService);
router.get('/services', getVendorServices);
router.put('/services/:id', updateVendorService);
router.patch('/services/:id/availability', toggleServiceAvailability);
router.delete('/services/:id', deleteVendorService);
router.get('/overview', getVendorOverview);
router.get('/bookings', getVendorBookings);
router.get('/booking-requests', getVendorBookings);
router.patch('/bookings/:id/status', updateVendorBookingStatus);
router.patch('/bookings/:id', updateVendorBookingStatus);
router.patch('/booking-requests/:id/status', updateVendorBookingStatus);
router.patch('/booking-requests/:id', updateVendorBookingStatus);
router.post('/bookings/:id/accept', (req, res, next) => {
  req.body = { status: 'accepted' };
  return updateVendorBookingStatus(req, res, next);
});
router.post('/bookings/:id/reject', (req, res, next) => {
  req.body = { status: 'rejected' };
  return updateVendorBookingStatus(req, res, next);
});
router.get('/transactions', getVendorTransactions);
router.get('/subscription', getVendorSubscription);

export default router;
