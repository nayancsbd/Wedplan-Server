import type { Request, Response, NextFunction } from 'express';
import { ObjectId, type Filter } from 'mongodb';
import { getServicesCollection } from '../lib/db.js';
import { ApiError } from '../middleware/error.js';
import { SERVICE_CATEGORIES, type Service } from '../types/index.js';
import { serviceQuerySchema } from '../validators/service.validator.js';
import { sanitizeRegex } from '../lib/sanitize.js';

export const getPublicServices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = serviceQuerySchema.parse(req.query);
    const filter: Filter<Service> = {
      status: 'approved',
      isActive: true,
    };

    if (query.search) {
      filter.serviceName = { $regex: sanitizeRegex(query.search), $options: 'i' };
    }

    if (query.category) {
      filter.category = query.category as Service['category'];
    }

    if (query.location) {
      filter.location = { $regex: sanitizeRegex(query.location), $options: 'i' };
    }

    const sortOption: Record<string, 1 | -1> =
      query.sort === 'price_asc'
        ? { price: 1 }
        : query.sort === 'price_desc'
        ? { price: -1 }
        : { createdAt: -1 };

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const total = await getServicesCollection().countDocuments(filter);

    const pipeline = [
      { $match: filter },
      { $sort: sortOption },
      { $skip: skip },
      { $limit: limit },
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
            id: '$vendor._id',
            name: '$vendor.name',
            businessName: '$vendor.businessName',
            image: '$vendor.image',
            isPremium: {
              $and: [
                { $eq: ['$vendor.subscriptionPlan', 'premium'] },
                { $gt: ['$vendor.subscriptionExpiresAt', new Date()] },
              ],
            },
          },
        },
      },
    ];

    const services = await getServicesCollection().aggregate(pipeline).toArray();

    res.status(200).json({
      success: true,
      message: 'Services retrieved successfully',
      data: {
        services,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getFeaturedServices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20);

    const pipeline = [
      {
        $match: {
          status: 'approved',
          isActive: true,
        },
      },
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
        $addFields: {
          isVendorPremium: {
            $and: [
              { $eq: ['$vendor.subscriptionPlan', 'premium'] },
              { $gt: ['$vendor.subscriptionExpiresAt', new Date()] },
            ],
          },
        },
      },
      {
        $sort: {
          isVendorPremium: -1,
          createdAt: -1,
        },
      },
      {
        $limit: limit,
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
            id: '$vendor._id',
            name: '$vendor.name',
            businessName: '$vendor.businessName',
            image: '$vendor.image',
            isPremium: '$isVendorPremium',
          },
        },
      },
    ];

    const services = await getServicesCollection().aggregate(pipeline).toArray();

    res.status(200).json({
      success: true,
      message: 'Featured services retrieved successfully',
      data: services,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const counts = await getServicesCollection()
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            status: 'approved',
            isActive: true,
          },
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const countMap = new Map(counts.map((item) => [item._id, item.count]));

    const categories = SERVICE_CATEGORIES.map((category) => ({
      category,
      count: countMap.get(category) ?? 0,
    }));

    res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

export const getLocations = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawLocations = await getServicesCollection().distinct('location', {
      status: 'approved',
      isActive: true,
    });

    const locations = (rawLocations as string[])
      .filter((loc) => Boolean(loc && typeof loc === 'string' && loc.trim()))
      .sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      success: true,
      message: 'Locations retrieved successfully',
      data: locations,
    });
  } catch (error) {
    next(error);
  }
};

export const getServiceById = async (
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

    const serviceId = new ObjectId(id);

    const pipeline = [
      { $match: { _id: serviceId } },
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
            id: '$vendor._id',
            name: '$vendor.name',
            businessName: '$vendor.businessName',
            image: '$vendor.image',
            isPremium: {
              $and: [
                { $eq: ['$vendor.subscriptionPlan', 'premium'] },
                { $gt: ['$vendor.subscriptionExpiresAt', new Date()] },
              ],
            },
          },
        },
      },
    ];

    const results = await getServicesCollection().aggregate(pipeline).toArray();
    const service = results[0];

    if (!service) {
      throw new ApiError(404, 'Service not found');
    }

    const user = req.user;
    const isOwner = Boolean(user && service.vendorId && service.vendorId.toString() === user.id);
    const isAdmin = Boolean(user && user.role === 'admin');

    if (!isOwner && !isAdmin) {
      if (service.status !== 'approved' || !service.isActive) {
        throw new ApiError(404, 'Service not found');
      }
    }

    res.status(200).json({
      success: true,
      message: 'Service retrieved successfully',
      data: service,
    });
  } catch (error) {
    next(error);
  }
};
