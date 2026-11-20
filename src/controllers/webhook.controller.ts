import type { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import type Stripe from 'stripe';
import { env } from '../config/env.js';
import { stripe } from '../lib/stripe.js';
import { getUsersCollection, getTransactionsCollection } from '../lib/db.js';

const getSubscriptionPeriodEnd = (sub: any): Date => {
  if (sub?.current_period_end) {
    return new Date(sub.current_period_end * 1000);
  }
  if (sub?.items?.data?.[0]?.current_period_end) {
    return new Date(sub.items.data[0].current_period_end * 1000);
  }
  return new Date(Date.now() + 30 * 86400000);
};

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'];

  if (!sig || typeof sig !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Missing stripe-signature header',
    });
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: `Webhook signature verification failed: ${err.message}`,
    });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;

        if (session.payment_status === 'paid') {
          const vendorId = session.metadata?.vendorId || session.client_reference_id;
          const stripeCustomerId = (session.customer as string) || undefined;
          const stripeSubscriptionId = (session.subscription as string) || undefined;
          const stripeSessionId = session.id as string;

          let subscriptionExpiresAt = new Date(Date.now() + 30 * 86400000);

          if (stripeSubscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
              subscriptionExpiresAt = getSubscriptionPeriodEnd(sub);
            } catch (subErr) {
              console.error('Error retrieving subscription in webhook:', subErr);
            }
          }

          if (vendorId) {
            const userObjectId = ObjectId.isValid(vendorId) ? new ObjectId(vendorId) : null;
            const userQuery = userObjectId
              ? { $or: [{ _id: userObjectId }, { id: vendorId }] }
              : { id: vendorId };

            const updatePayload: Record<string, any> = {
              subscriptionPlan: 'premium',
              subscriptionExpiresAt,
              updatedAt: new Date(),
            };

            if (stripeCustomerId) {
              updatePayload.stripeCustomerId = stripeCustomerId;
            }

            await getUsersCollection().updateOne(userQuery, { $set: updatePayload });

            const existingTx = await getTransactionsCollection().findOne({
              $or: [{ stripeSessionId }, { stripeEventId: event.id }],
            });

            if (!existingTx) {
              try {
                await getTransactionsCollection().insertOne({
                  vendorId: userObjectId || vendorId,
                  userId: vendorId,
                  plan: 'premium',
                  amount: session.amount_total ? session.amount_total / 100 : 0,
                  currency: session.currency || 'usd',
                  stripeSessionId,
                  stripeSubscriptionId,
                  stripeEventId: event.id,
                  status: 'paid',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              } catch (txErr: any) {
                if (txErr?.code !== 11000) {
                  console.error('Error inserting checkout transaction:', txErr);
                }
              }
            }
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const stripeSubscriptionId = (invoice.subscription as string) || (invoice.lines?.data?.[0]?.subscription as string) || undefined;
        const stripeCustomerId = (invoice.customer as string) || undefined;
        const stripePaymentIntentId = (invoice.payment_intent as string) || undefined;

        let vendorId: string | undefined;
        let subscriptionExpiresAt: Date | undefined;

        if (stripeSubscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            subscriptionExpiresAt = getSubscriptionPeriodEnd(sub);
            vendorId = sub.metadata?.vendorId;
          } catch (subErr) {
            console.error('Error retrieving subscription on invoice.paid:', subErr);
          }
        }

        if (!vendorId && stripeCustomerId) {
          const user = await getUsersCollection().findOne({ stripeCustomerId });
          if (user) {
            vendorId = user._id ? user._id.toString() : String(user.id);
          }
        }

        if (vendorId) {
          const userObjectId = ObjectId.isValid(vendorId) ? new ObjectId(vendorId) : null;
          const userQuery = userObjectId
            ? { $or: [{ _id: userObjectId }, { id: vendorId }] }
            : { id: vendorId };

          if (!subscriptionExpiresAt && invoice.lines?.data?.[0]?.period?.end) {
            subscriptionExpiresAt = new Date(invoice.lines.data[0].period.end * 1000);
          }

          await getUsersCollection().updateOne(userQuery, {
            $set: {
              subscriptionPlan: 'premium',
              subscriptionExpiresAt: subscriptionExpiresAt || new Date(Date.now() + 30 * 86400000),
              updatedAt: new Date(),
            },
          });

          const existingTx = await getTransactionsCollection().findOne({
            $or: [
              { stripeEventId: event.id },
              ...(stripePaymentIntentId ? [{ stripePaymentIntentId }] : []),
            ],
          });

          if (!existingTx) {
            try {
              await getTransactionsCollection().insertOne({
                vendorId: userObjectId || vendorId,
                userId: vendorId,
                plan: 'premium',
                amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
                currency: invoice.currency || 'usd',
                stripeSubscriptionId,
                stripePaymentIntentId,
                stripeEventId: event.id,
                status: 'paid',
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            } catch (txErr: any) {
              if (txErr?.code !== 11000) {
                console.error('Error inserting invoice.paid transaction:', txErr);
              }
            }
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const stripeCustomerId = (invoice.customer as string) || undefined;
        const stripeSubscriptionId = (invoice.subscription as string) || (invoice.lines?.data?.[0]?.subscription as string) || undefined;
        const stripePaymentIntentId = (invoice.payment_intent as string) || undefined;

        let vendorId: string | undefined;

        if (stripeSubscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            vendorId = sub.metadata?.vendorId;
          } catch {}
        }

        if (!vendorId && stripeCustomerId) {
          const user = await getUsersCollection().findOne({ stripeCustomerId });
          if (user) {
            vendorId = user._id ? user._id.toString() : String(user.id);
          }
        }

        const userObjectId = vendorId && ObjectId.isValid(vendorId) ? new ObjectId(vendorId) : null;

        const existingTx = await getTransactionsCollection().findOne({ stripeEventId: event.id });

        if (!existingTx) {
          try {
            await getTransactionsCollection().insertOne({
              vendorId: userObjectId || vendorId || undefined,
              userId: vendorId || 'unknown',
              plan: 'premium',
              amount: invoice.amount_due ? invoice.amount_due / 100 : 0,
              currency: invoice.currency || 'usd',
              stripeSubscriptionId,
              stripePaymentIntentId,
              stripeEventId: event.id,
              status: 'failed',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } catch (txErr: any) {
            if (txErr?.code !== 11000) {
              console.error('Error inserting invoice.payment_failed transaction:', txErr);
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const stripeCustomerId = (subscription.customer as string) || undefined;
        let vendorId = subscription.metadata?.vendorId;

        if (!vendorId && stripeCustomerId) {
          const user = await getUsersCollection().findOne({ stripeCustomerId });
          if (user) {
            vendorId = user._id ? user._id.toString() : String(user.id);
          }
        }

        if (vendorId) {
          const userObjectId = ObjectId.isValid(vendorId) ? new ObjectId(vendorId) : null;
          const userQuery = userObjectId
            ? { $or: [{ _id: userObjectId }, { id: vendorId }] }
            : { id: vendorId };

          const currentPeriodEnd = getSubscriptionPeriodEnd(subscription);
          const isEnded = currentPeriodEnd.getTime() <= Date.now() || event.type === 'customer.subscription.deleted';

          if (isEnded) {
            await getUsersCollection().updateOne(userQuery, {
              $set: {
                subscriptionPlan: 'free',
                updatedAt: new Date(),
              },
            });
          } else {
            await getUsersCollection().updateOne(userQuery, {
              $set: {
                subscriptionExpiresAt: currentPeriodEnd,
                updatedAt: new Date(),
              },
            });
          }
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as any;
        const vendorId = session.metadata?.vendorId || session.client_reference_id;
        const userObjectId = vendorId && ObjectId.isValid(vendorId) ? new ObjectId(vendorId) : null;
        const stripeSessionId = session.id as string;

        const existingTx = await getTransactionsCollection().findOne({
          $or: [{ stripeSessionId }, { stripeEventId: event.id }],
        });

        if (!existingTx) {
          try {
            await getTransactionsCollection().insertOne({
              vendorId: userObjectId || vendorId || undefined,
              userId: vendorId || 'unknown',
              plan: 'premium',
              amount: session.amount_total ? session.amount_total / 100 : 0,
              currency: session.currency || 'usd',
              stripeSessionId,
              stripeEventId: event.id,
              status: 'failed',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } catch (txErr: any) {
            if (txErr?.code !== 11000) {
              console.error('Error inserting expired checkout session:', txErr);
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event received: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing Stripe webhook:', error);
    res.status(200).json({ received: true });
  }
};
