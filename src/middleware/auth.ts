import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ObjectId } from 'mongodb';
import { env } from '../config/env.js';
import { db } from '../lib/db.js';
import { ApiError } from './error.js';
import type { AuthUser, UserRole } from '../types/index.js';

const jwks = createRemoteJWKSet(new URL(`${env.BETTER_AUTH_URL}/api/auth/jwks`));

export const isPremiumActive = (
  user?: { subscriptionPlan?: string; subscriptionExpiresAt?: Date | string | null } | null
): boolean => {
  if (!user || user.subscriptionPlan !== 'premium' || !user.subscriptionExpiresAt) {
    return false;
  }
  const expiresAt = new Date(user.subscriptionExpiresAt);
  return !isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
};

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Unauthorized: Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new ApiError(401, 'Unauthorized: Missing bearer token');
    }

    let payload: { sub?: string; id?: string };
    try {
      const verified = await jwtVerify(token, jwks, {
        issuer: env.BETTER_AUTH_URL,
        audience: env.BETTER_AUTH_URL,
      });
      payload = verified.payload as { sub?: string; id?: string };
    } catch {
      throw new ApiError(401, 'Unauthorized: Invalid or expired token');
    }

    const userId = payload.sub || payload.id;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized: Invalid token payload');
    }

    const userCol = db.collection('user');
    const query = ObjectId.isValid(userId)
      ? { $or: [{ _id: new ObjectId(userId) }, { id: userId }] }
      : { id: userId };

    const user = await userCol.findOne(query);

    if (!user) {
      throw new ApiError(401, 'Unauthorized: User does not exist');
    }

    if (user.isBlocked) {
      throw new ApiError(403, 'Your account has been blocked');
    }

    const authUser: AuthUser = {
      id: user._id ? user._id.toString() : String(user.id),
      email: user.email,
      role: user.role,
      isBlocked: Boolean(user.isBlocked),
      subscriptionPlan: user.subscriptionPlan || 'free',
      subscriptionExpiresAt: user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null,
      name: user.name,
      businessName: user.businessName,
    };

    req.user = authUser;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'Unauthorized'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'Forbidden: Access is denied'));
      return;
    }

    next();
  };
};
