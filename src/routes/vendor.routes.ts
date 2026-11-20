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
router.patch('/bookings/:id/status', updateVendorBookingStatus);
router.get('/transactions', getVendorTransactions);

export default router;
