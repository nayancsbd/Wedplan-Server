import type { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { getServicesCollection, getBookingsCollection, getTransactionsCollection } from '../lib/db.js';
import { isPremiumActive } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import type { Service, BookingStatus } from '../types/index.js';
import {
  createServiceSchema,
  updateServiceSchema,
  toggleAvailabilitySchema,
} from '../validators/service.validator.js';
import { updateBookingStatusSchema } from '../validators/booking.validator.js';
import { vendorTransactionsQuerySchema } from '../validators/payment.validator.js';

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
      serviceId,
      status: { $in: ['pending', 'accepted'] },
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
          vendorId: vendorObjectId,
          status: 'pending',
        }),
        getBookingsCollection().countDocuments({
          vendorId: vendorObjectId,
          status: 'accepted',
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

export const getVendorBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const vendorObjectId = new ObjectId(user.id);

    const matchStage: Record<string, any> = {
      vendorId: vendorObjectId,
    };

    const statusQuery = req.query.status;
    const validStatuses: BookingStatus[] = ['pending', 'accepted', 'rejected', 'cancelled'];

    if (statusQuery) {
      if (typeof statusQuery === 'string' && validStatuses.includes(statusQuery as BookingStatus)) {
        matchStage.status = statusQuery;
      } else if (Array.isArray(statusQuery)) {
        const filtered = statusQuery.filter(
          (s): s is BookingStatus => typeof s === 'string' && validStatuses.includes(s as BookingStatus)
        );
        if (filtered.length > 0) {
          matchStage.status = { $in: filtered };
        }
      } else {
        throw new ApiError(
          400,
          `Invalid status filter. Allowed values: ${validStatuses.join(', ')}`
        );
      }
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 as const } },
      {
        $lookup: {
          from: 'services',
          localField: 'serviceId',
          foreignField: '_id',
          as: 'service',
        },
      },
      {
        $unwind: {
          path: '$service',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'user',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer',
        },
      },
      {
        $unwind: {
          path: '$customer',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          serviceId: 1,
          vendorId: 1,
          customerId: 1,
          eventDate: 1,
          eventLocation: 1,
          message: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          service: {
            serviceName: '$service.serviceName',
            category: '$service.category',
            price: '$service.price',
            location: '$service.location',
            image: { $arrayElemAt: ['$service.images', 0] },
            images: '$service.images',
          },
          customer: {
            name: '$customer.name',
            email: '$customer.email',
            image: '$customer.image',
          },
        },
      },
    ];

    const bookings = await getBookingsCollection().aggregate(pipeline).toArray();

    res.status(200).json({
      success: true,
      message: 'Vendor bookings retrieved successfully',
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

export const updateVendorBookingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

    if (!id || !ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid booking ID format');
    }

    const data = updateBookingStatusSchema.parse(req.body);
    const bookingObjectId = new ObjectId(id);
    const vendorObjectId = new ObjectId(user.id);
    const updatedAt = new Date();

    const updated = await getBookingsCollection().findOneAndUpdate(
      {
        _id: bookingObjectId,
        vendorId: vendorObjectId,
        status: 'pending',
      },
      {
        $set: {
          status: data.status,
          updatedAt,
        },
      },
      { returnDocument: 'after' }
    );

    if (updated) {
      res.status(200).json({
        success: true,
        message: `Booking has been ${data.status} successfully`,
        data: updated,
      });
      return;
    }

    const existing = await getBookingsCollection().findOne({ _id: bookingObjectId });

    if (!existing) {
      throw new ApiError(404, 'Booking not found');
    }

    if (existing.vendorId.toString() !== user.id) {
      throw new ApiError(403, 'Forbidden: You do not own this booking');
    }

    if (existing.status !== 'pending') {
      throw new ApiError(
        409,
        `Cannot update booking with status '${existing.status}'. Only pending bookings can be processed.`
      );
    }

    throw new ApiError(409, 'Failed to update booking status');
  } catch (error) {
    next(error);
  }
};

export const getVendorTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const vendorObjectId = new ObjectId(user.id);
    const query = vendorTransactionsQuerySchema.parse(req.query);
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { vendorId: vendorObjectId },
        { vendorId: user.id },
        { userId: user.id },
      ],
    };

    const [transactions, total] = await Promise.all([
      getTransactionsCollection()
        .find(filter, {
          projection: {
            _id: 1,
            plan: 1,
            amount: 1,
            currency: 1,
            status: 1,
            createdAt: 1,
            stripeSessionId: 1,
            stripeSubscriptionId: 1,
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      getTransactionsCollection().countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Vendor transactions retrieved successfully',
      data: {
        transactions,
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
