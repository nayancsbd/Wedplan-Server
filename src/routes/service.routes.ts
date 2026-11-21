import { Router } from 'express';
import {
  getPublicServices,
  getFeaturedServices,
  getCategories,
  getLocations,
  getServiceById,
} from '../controllers/service.controller.js';
import {
  createService,
  updateVendorService,
  toggleServiceAvailability,
  deleteVendorService,
} from '../controllers/vendor.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getPublicServices);
router.get('/featured', getFeaturedServices);
router.get('/categories', getCategories);
router.get('/locations', getLocations);
router.get('/:id', authenticate, getServiceById);

router.post('/', authenticate, authorize('vendor'), createService);
router.put('/:id', authenticate, authorize('vendor'), updateVendorService);
router.patch('/:id', authenticate, authorize('vendor'), updateVendorService);
router.patch('/:id/availability', authenticate, authorize('vendor'), toggleServiceAvailability);
router.delete('/:id', authenticate, authorize('vendor'), deleteVendorService);

export default router;
