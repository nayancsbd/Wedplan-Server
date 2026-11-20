import type { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { ZodError } from 'zod';
import { getUsersCollection } from '../lib/db.js';
import { isPremiumActive } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { updateProfileSchema } from '../validators/profile.validator.js';

export const formatSafeProfile = (user: any) => {
  return {
    id: user._id ? user._id.toString() : String(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    isBlocked: Boolean(user.isBlocked),
    image: user.image ?? null,
    businessName: user.businessName ?? null,
    phone: user.phone ?? null,
    bio: user.bio ?? null,
    subscriptionPlan: user.subscriptionPlan || 'free',
    subscriptionExpiresAt: user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null,
    isPremiumActive: isPremiumActive(user),
  };
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const query = ObjectId.isValid(user.id)
      ? { $or: [{ _id: new ObjectId(user.id) }, { id: user.id }] }
      : { id: user.id };

    const dbUser = await getUsersCollection().findOne(query);

    if (!dbUser) {
      throw new ApiError(404, 'User not found');
    }

    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: formatSafeProfile(dbUser),
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;

    let data;
    try {
      data = updateProfileSchema.parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) {
        const unrecognized = err.issues
          .filter((i) => i.code === 'unrecognized_keys')
          .flatMap((i: any) => i.keys);

        const msg =
          unrecognized.length > 0
            ? `Cannot update restricted or unrecognized fields: ${unrecognized.join(', ')}`
            : err.issues.map((i) => i.message).join('; ');

        throw new ApiError(400, msg, err.flatten().fieldErrors);
      }
      throw err;
    }

    if (user.role !== 'vendor' && data.businessName !== undefined) {
      throw new ApiError(400, 'Only vendors can update businessName');
    }

    const query = ObjectId.isValid(user.id)
      ? { $or: [{ _id: new ObjectId(user.id) }, { id: user.id }] }
      : { id: user.id };

    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateFields.name = data.name;
    if (data.image !== undefined) updateFields.image = data.image;
    if (data.phone !== undefined) updateFields.phone = data.phone;
    if (data.bio !== undefined) updateFields.bio = data.bio;
    if (user.role === 'vendor' && data.businessName !== undefined) {
      updateFields.businessName = data.businessName;
    }

    await getUsersCollection().updateOne(query, { $set: updateFields });

    const updated = await getUsersCollection().findOne(query);

    if (!updated) {
      throw new ApiError(404, 'User not found');
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: formatSafeProfile(updated),
    });
  } catch (error) {
    next(error);
  }
};
