import type { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { env } from '../config/env.js';
import { stripe } from '../lib/stripe.js';
import { getUsersCollection, getTransactionsCollection } from '../lib/db.js';
import { isPremiumActive } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { sessionStatusQuerySchema } from '../validators/payment.validator.js';

export const createCheckoutSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const vendorId = user.id;

    if (isPremiumActive(user)) {
      throw new ApiError(409, 'You already have an active Premium subscription');
    }

    const userObjectId = ObjectId.isValid(vendorId) ? new ObjectId(vendorId) : null;
    const userQuery = userObjectId
      ? { $or: [{ _id: userObjectId }, { id: vendorId }] }
      : { id: vendorId };

    const dbUser = await getUsersCollection().findOne(userQuery);

    if (!dbUser) {
      throw new ApiError(404, 'User not found');
    }

    if (isPremiumActive(dbUser)) {
      throw new ApiError(409, 'You already have an active Premium subscription');
    }

    let stripeCustomerId = dbUser.stripeCustomerId;

    if (stripeCustomerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(stripeCustomerId);
        if (existingCustomer.deleted) {
          stripeCustomerId = undefined;
        }
      } catch {
        stripeCustomerId = undefined;
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || user.businessName || undefined,
        metadata: {
          vendorId,
        },
      });

      stripeCustomerId = customer.id;

      await getUsersCollection().updateOne(userQuery, {
        $set: {
          stripeCustomerId,
          updatedAt: new Date(),
        },
      });
    }

    let priceId = env.STRIPE_PREMIUM_PRICE_ID;
    if (priceId.startsWith('prod_') || priceId.startsWith('pprod_')) {
      const cleanProdId = priceId.startsWith('pprod_') ? priceId.slice(1) : priceId;
      const prices = await stripe.prices.list({
        product: cleanProdId,
        active: true,
        type: 'recurring',
        limit: 1,
      });
      if (prices.data.length > 0) {
        priceId = prices.data[0].id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        vendorId,
      },
      client_reference_id: vendorId,
      success_url: `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.CLIENT_URL}/payment/cancel`,
    });

    res.status(200).json({
      success: true,
      message: 'Checkout session created successfully',
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const vendorId = user.id;

    const { session_id: sessionId } = sessionStatusQuerySchema.parse(req.query);

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      throw new ApiError(404, 'Stripe checkout session not found');
    }

    const sessionVendorId = session.metadata?.vendorId || session.client_reference_id;

    if (sessionVendorId !== vendorId) {
      throw new ApiError(403, 'Forbidden: You do not own this checkout session');
    }

    const userObjectId = ObjectId.isValid(vendorId) ? new ObjectId(vendorId) : null;
    const userQuery = userObjectId
      ? { $or: [{ _id: userObjectId }, { id: vendorId }] }
      : { id: vendorId };

    const dbUser = await getUsersCollection().findOne(userQuery);

    if (!dbUser) {
      throw new ApiError(404, 'User not found');
    }

    const transaction = await getTransactionsCollection().findOne({
      stripeSessionId: sessionId,
    });

    res.status(200).json({
      success: true,
      message: 'Session status retrieved successfully',
      data: {
        plan: dbUser.subscriptionPlan || 'free',
        subscriptionPlan: dbUser.subscriptionPlan || 'free',
        expiry: dbUser.subscriptionExpiresAt || null,
        subscriptionExpiresAt: dbUser.subscriptionExpiresAt || null,
        isPremiumActive: isPremiumActive(dbUser),
        hasTransaction: Boolean(transaction),
        transaction: transaction
          ? {
              _id: transaction._id,
              amount: transaction.amount,
              currency: transaction.currency,
              status: transaction.status,
              createdAt: transaction.createdAt,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};
