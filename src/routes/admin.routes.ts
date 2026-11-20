import { Router } from 'express';
import {
  getAdminOverview,
  getAdminUsers,
  getAdminUserById,
  blockUser,
  unblockUser,
  getAdminServices,
  updateServiceStatus,
  deleteServiceByAdmin,
} from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/overview', getAdminOverview);
router.get('/users', getAdminUsers);
router.get('/users/:id', getAdminUserById);
router.patch('/users/:id/block', blockUser);
router.patch('/users/:id/unblock', unblockUser);
router.get('/services', getAdminServices);
router.patch('/services/:id/status', updateServiceStatus);
router.delete('/services/:id', deleteServiceByAdmin);

export default router;
