import { Router } from 'express';
import {
  getPublicServices,
  getFeaturedServices,
  getCategories,
  getLocations,
  getServiceById,
} from '../controllers/service.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', getPublicServices);
router.get('/featured', getFeaturedServices);
router.get('/categories', getCategories);
router.get('/locations', getLocations);
router.get('/:id', authenticate, getServiceById);

export default router;
