import type { ObjectId } from 'mongodb';

export type UserRole = 'customer' | 'vendor' | 'admin';
export type SubscriptionPlan = 'free' | 'premium';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  isBlocked: boolean;
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt?: Date | null;
  name?: string;
  businessName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface User {
  _id?: ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  role: UserRole;
  isBlocked: boolean;
  businessName?: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt?: Date;
  stripeCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  _id?: ObjectId;
  vendorId: string;
  title: string;
  description: string;
  category: string;
  price: number;
  location?: string;
  images: string[];
  capacity?: number;
  featured?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  _id?: ObjectId;
  customerId: string;
  vendorId: string;
  serviceId: ObjectId | string;
  eventDate: Date;
  status: BookingStatus;
  totalAmount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  _id?: ObjectId;
  userId: string;
  bookingId?: ObjectId | string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  plan?: string;
  createdAt: Date;
  updatedAt: Date;
}
