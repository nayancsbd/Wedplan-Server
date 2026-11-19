import type { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { getServicesCollection, getBookingsCollection } from '../lib/db.js';
import { isPremiumActive } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import type { Service } from '../types/index.js';
import {
  createServiceSchema,
  updateServiceSchema,
  toggleAvailabilitySchema,
} from '../validators/service.validator.js';

export const createService = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const data = createServiceSchema.parse(req.body);

    const isPremium = isPremiumActive(user);
    if (!isPremium) {
      const activeCount = await getServicesCollection().countDocuments({
        vendorId: new ObjectId(user.id),
        isActive: true,
        status: { $in: ['pending', 'approved'] },
      });

      if (activeCount >= 3) {
        throw new ApiError(
          403,
          'Free plan limit reached. You can only have up to 3 active services. Please upgrade to Premium for unlimited services.'
        );
      }
    }

    const now = new Date();
    const newService: Service = {
      vendorId: new ObjectId(user.id),
      serviceName: data.serviceName,
      category: data.category,
      description: data.description,
      price: data.price,
      location: data.location,
      images: data.images,
      status: 'pending',
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await getServicesCollection().insertOne(newService);

    res.status(201).json({
      success: true,
      message: 'Service submitted successfully and is pending approval',
      data: {
        ...newService,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorServices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const services = await getServicesCollection()
      .find({ vendorId: new ObjectId(user.id) })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      message: 'Vendor services retrieved successfully',
      data: services,
    });
  } catch (error) {
    next(error);
  }
};

export const updateVendorService = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

    if (!id || !ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid service ID format');
    }

    const serviceId = new ObjectId(id);
    const existing = await getServicesCollection().findOne({ _id: serviceId });

    if (!existing) {
      throw new ApiError(404, 'Service not found');
    }

    if (existing.vendorId.toString() !== user.id) {
      throw new ApiError(403, 'Forbidden: You do not own this service');
    }

    const data = updateServiceSchema.parse(req.body);

    let nextStatus = existing.status;
    if (existing.status === 'approved') {
      nextStatus = 'pending';
    }

    const updateFields: Partial<Service> = {
      ...data,
      status: nextStatus,
      updatedAt: new Date(),
    };

    await getServicesCollection().updateOne(
      { _id: serviceId },
      { $set: updateFields }
    );

    const updated = await getServicesCollection().findOne({ _id: serviceId });

    res.status(200).json({
      success: true,
      message:
        existing.status === 'approved'
          ? 'Service updated and sent back to pending review'
          : 'Service updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const toggleServiceAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

    if (!id || !ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid service ID format');
    }

    const serviceId = new ObjectId(id);
    const service = await getServicesCollection().findOne({ _id: serviceId });

    if (!service) {
      throw new ApiError(404, 'Service not found');
    }

    if (service.vendorId.toString() !== user.id) {
      throw new ApiError(403, 'Forbidden: You do not own this service');
    }

    const parsed = toggleAvailabilitySchema.parse(req.body);
    const targetIsActive =
      typeof parsed.isActive === 'boolean' ? parsed.isActive : !service.isActive;

    if (targetIsActive && !service.isActive) {
      const isPremium = isPremiumActive(user);
      if (!isPremium) {
        const activeCount = await getServicesCollection().countDocuments({
          vendorId: new ObjectId(user.id),
          isActive: true,
          status: { $in: ['pending', 'approved'] },
        });

        if (activeCount >= 3) {
          throw new ApiError(
            403,
            'Free plan limit reached. You can only have up to 3 active services. Please upgrade to Premium to activate more services.'
          );
        }
      }
    }

    await getServicesCollection().updateOne(
      { _id: serviceId },
      {
        $set: {
          isActive: targetIsActive,
          updatedAt: new Date(),
        },
      }
    );

    const updated = await getServicesCollection().findOne({ _id: serviceId });

    res.status(200).json({
      success: true,
      message: `Service availability set to ${targetIsActive ? 'active' : 'inactive'}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVendorService = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

    if (!id || !ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid service ID format');
    }

    const serviceId = new ObjectId(id);
    const service = await getServicesCollection().findOne({ _id: serviceId });

    if (!service) {
      throw new ApiError(404, 'Service not found');
    }

    if (service.vendorId.toString() !== user.id) {
      throw new ApiError(403, 'Forbidden: You do not own this service');
    }

    const activeBooking = await getBookingsCollection().findOne({
      $or: [{ serviceId }, { serviceId: id }],
      status: { $in: ['pending', 'confirmed', 'accepted'] },
    });

    if (activeBooking) {
      throw new ApiError(
        400,
        'Cannot delete service with active bookings (pending or accepted). Please resolve or cancel all bookings for this service before deleting.'
      );
    }

    await getServicesCollection().deleteOne({ _id: serviceId });

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorOverview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const vendorObjectId = new ObjectId(user.id);

    const [totalServices, activeServices, pendingBookings, acceptedBookings] =
      await Promise.all([
        getServicesCollection().countDocuments({ vendorId: vendorObjectId }),
        getServicesCollection().countDocuments({
          vendorId: vendorObjectId,
          isActive: true,
          status: 'approved',
        }),
        getBookingsCollection().countDocuments({
          $or: [{ vendorId: user.id }, { vendorId: vendorObjectId }],
          status: 'pending',
        }),
        getBookingsCollection().countDocuments({
          $or: [{ vendorId: user.id }, { vendorId: vendorObjectId }],
          status: { $in: ['confirmed', 'accepted'] },
        }),
      ]);

    res.status(200).json({
      success: true,
      message: 'Vendor overview retrieved successfully',
      data: {
        totalServices,
        activeServices,
        pendingBookings,
        acceptedBookings,
        subscriptionPlan: user.subscriptionPlan,
        isPremiumActive: isPremiumActive(user),
      },
    });
  } catch (error) {
    next(error);
  }
};
