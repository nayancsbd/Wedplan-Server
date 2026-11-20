import type { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import {
  getUsersCollection,
  getServicesCollection,
  getTransactionsCollection,
} from '../lib/db.js';
import { ApiError } from '../middleware/error.js';
import {
  adminUsersQuerySchema,
  adminServicesQuerySchema,
  updateServiceStatusSchema,
} from '../validators/admin.validator.js';

export const getAdminOverview = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const usersCol = getUsersCollection();
    const servicesCol = getServicesCollection();
    const transactionsCol = getTransactionsCollection();

    const [
      totalUsers,
      totalVendors,
      totalCustomers,
      totalServices,
      pendingServices,
      totalTransactions,
    ] = await Promise.all([
      usersCol.countDocuments({}),
      usersCol.countDocuments({ role: 'vendor' }),
      usersCol.countDocuments({ role: 'customer' }),
      servicesCol.countDocuments({}),
      servicesCol.countDocuments({ status: 'pending' }),
      transactionsCol.countDocuments({}),
    ]);

    res.status(200).json({
      success: true,
      message: 'Admin overview retrieved successfully',
      data: {
        totalUsers,
        totalVendors,
        totalCustomers,
        totalServices,
        pendingServices,
        totalTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = adminUsersQuerySchema.parse(req.query);
    const { search, role, page, limit } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (role) {
      filter.role = role;
    }

    if (search && search.length > 0) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const usersCol = getUsersCollection();

    const [users, total] = await Promise.all([
      usersCol
        .find(filter, {
          projection: {
            _id: 1,
            name: 1,
            email: 1,
            emailVerified: 1,
            image: 1,
            role: 1,
            isBlocked: 1,
            businessName: 1,
            subscriptionPlan: 1,
            subscriptionExpiresAt: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      usersCol.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

    if (!id) {
      throw new ApiError(400, 'User ID is required');
    }

    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id }] }
      : { id };

    const user = await getUsersCollection().findOne(query, {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        emailVerified: 1,
        image: 1,
        role: 1,
        isBlocked: 1,
        businessName: 1,
        subscriptionPlan: 1,
        subscriptionExpiresAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.status(200).json({
      success: true,
      message: 'User details retrieved successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const blockUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentAdmin = req.user!;
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

    if (!id) {
      throw new ApiError(400, 'User ID is required');
    }

    if (id === currentAdmin.id) {
      throw new ApiError(403, 'Admins cannot block themselves');
    }

    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id }] }
      : { id };

    const targetUser = await getUsersCollection().findOne(query);

    if (!targetUser) {
      throw new ApiError(404, 'User not found');
    }

    const targetUserId = targetUser._id ? targetUser._id.toString() : String(targetUser.id);
    if (targetUserId === currentAdmin.id) {
      throw new ApiError(403, 'Admins cannot block themselves');
    }

    if (targetUser.role === 'admin') {
      throw new ApiError(403, 'Admins cannot block another admin');
    }

    if (targetUser.isBlocked) {
      throw new ApiError(409, 'User is already blocked');
    }

    const now = new Date();
    await getUsersCollection().updateOne(query, {
      $set: {
        isBlocked: true,
        updatedAt: now,
      },
    });

    const updated = await getUsersCollection().findOne(query, {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        emailVerified: 1,
        image: 1,
        role: 1,
        isBlocked: 1,
        businessName: 1,
        subscriptionPlan: 1,
        subscriptionExpiresAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    res.status(200).json({
      success: true,
      message: 'User blocked successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const unblockUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

    if (!id) {
      throw new ApiError(400, 'User ID is required');
    }

    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id }] }
      : { id };

    const targetUser = await getUsersCollection().findOne(query);

    if (!targetUser) {
      throw new ApiError(404, 'User not found');
    }

    if (!targetUser.isBlocked) {
      throw new ApiError(409, 'User is not blocked');
    }

    const now = new Date();
    await getUsersCollection().updateOne(query, {
      $set: {
        isBlocked: false,
        updatedAt: now,
      },
    });

    const updated = await getUsersCollection().findOne(query, {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        emailVerified: 1,
        image: 1,
        role: 1,
        isBlocked: 1,
        businessName: 1,
        subscriptionPlan: 1,
        subscriptionExpiresAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminServices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = adminServicesQuerySchema.parse(req.query);
    const { search, status, category, page, limit } = query;
    const skip = (page - 1) * limit;

    const matchStage: Record<string, any> = {};

    if (status) {
      matchStage.status = status;
    }

    if (category) {
      matchStage.category = category;
    }

    if (search && search.length > 0) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      matchStage.serviceName = { $regex: escaped, $options: 'i' };
    }

    const pipeline: any[] = [
      { $match: matchStage },
      { $sort: { createdAt: -1 as const } },
      {
        $lookup: {
          from: 'user',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor',
        },
      },
      {
        $unwind: {
          path: '$vendor',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          vendorId: 1,
          serviceName: 1,
          category: 1,
          description: 1,
          price: 1,
          location: 1,
          images: 1,
          status: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          vendor: {
            _id: '$vendor._id',
            name: '$vendor.name',
            email: '$vendor.email',
            businessName: '$vendor.businessName',
            image: '$vendor.image',
            subscriptionPlan: '$vendor.subscriptionPlan',
            isPremium: {
              $and: [
                { $eq: ['$vendor.subscriptionPlan', 'premium'] },
                { $gt: ['$vendor.subscriptionExpiresAt', new Date()] },
              ],
            },
          },
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const [services, total] = await Promise.all([
      getServicesCollection().aggregate(pipeline).toArray(),
      getServicesCollection().countDocuments(matchStage),
    ]);

    res.status(200).json({
      success: true,
      message: 'Admin services retrieved successfully',
      data: {
        services,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateServiceStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

    if (!id || !ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid service ID format');
    }

    const data = updateServiceStatusSchema.parse(req.body);
    const serviceObjectId = new ObjectId(id);

    const service = await getServicesCollection().findOne({ _id: serviceObjectId });

    if (!service) {
      throw new ApiError(404, 'Service not found');
    }

    const now = new Date();
    await getServicesCollection().updateOne(
      { _id: serviceObjectId },
      {
        $set: {
          status: data.status,
          updatedAt: now,
        },
      }
    );

    const updated = await getServicesCollection().findOne({ _id: serviceObjectId });

    res.status(200).json({
      success: true,
      message: `Service status updated to '${data.status}' successfully`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteServiceByAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

    if (!id || !ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid service ID format');
    }

    const serviceObjectId = new ObjectId(id);
    const service = await getServicesCollection().findOne({ _id: serviceObjectId });

    if (!service) {
      throw new ApiError(404, 'Service not found');
    }

    await getServicesCollection().deleteOne({ _id: serviceObjectId });

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully by admin',
    });
  } catch (error) {
    next(error);
  }
};
