import { Router } from 'express';
import {
  createCheckoutSession,
  getSessionStatus,
} from '../controllers/payment.controller.js';
import {
  getVendorTransactions,
  getVendorSubscription,
} from '../controllers/vendor.controller.js';
import { getAdminTransactions } from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Transactions endpoint accessible to vendor and admin
router.get(
  '/transactions',
  authenticate,
  authorize('vendor', 'admin'),
  (req, res, next) => {
    if (req.user?.role === 'admin') {
      return getAdminTransactions(req, res, next);
    }
    return getVendorTransactions(req, res, next);
  }
);

// Vendor-specific transaction aliases
router.get(
  '/vendor/transactions',
  authenticate,
  authorize('vendor'),
  getVendorTransactions
);
router.get(
  '/history',
  authenticate,
  authorize('vendor'),
  getVendorTransactions
);

// Subscription aliases
router.get(
  '/vendor/subscription',
  authenticate,
  authorize('vendor'),
  getVendorSubscription
);
router.get(
  '/subscription',
  authenticate,
  authorize('vendor'),
  getVendorSubscription
);

// Checkout session creation and verification
router.post(
  '/create-checkout-session',
  authenticate,
  authorize('vendor'),
  createCheckoutSession
);
router.get(
  '/session-status',
  authenticate,
  authorize('vendor'),
  getSessionStatus
);

export default router;
