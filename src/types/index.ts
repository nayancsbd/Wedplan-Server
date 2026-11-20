import type { ObjectId } from 'mongodb';

export const SERVICE_CATEGORIES = [
  'Photography & Videography',
  'Wedding Venues',
  'Decoration & Florist',
  'Catering Services',
  'Makeup & Styling',
  'Wedding Fashion',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
export type ServiceStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'customer' | 'vendor' | 'admin';
export type SubscriptionPlan = 'free' | 'premium';
export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
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
  vendorId: ObjectId;
  serviceName: string;
  category: ServiceCategory;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: ServiceStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  _id?: ObjectId;
  serviceId: ObjectId;
  vendorId: ObjectId;
  customerId: ObjectId;
  eventDate: Date;
  eventLocation: string;
  message: string;
  status: BookingStatus;
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
