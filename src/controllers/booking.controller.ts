import type { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { getBookingsCollection, getServicesCollection } from '../lib/db.js';
import { ApiError } from '../middleware/error.js';
import type { Booking } from '../types/index.js';
import { createBookingSchema } from '../validators/booking.validator.js';

export const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const data = createBookingSchema.parse(req.body);

    if (!ObjectId.isValid(data.serviceId)) {
      throw new ApiError(400, 'Invalid service ID format');
    }

    const serviceObjectId = new ObjectId(data.serviceId);
    const service = await getServicesCollection().findOne({ _id: serviceObjectId });

    if (!service || service.status !== 'approved' || !service.isActive) {
      throw new ApiError(400, 'Service is not available for booking');
    }

    if (service.vendorId.toString() === user.id) {
      throw new ApiError(400, 'You cannot book your own service');
    }

    const eventDate = new Date(data.eventDate);
    const customerObjectId = new ObjectId(user.id);

    const existingActiveBooking = await getBookingsCollection().findOne({
      customerId: customerObjectId,
      serviceId: serviceObjectId,
      eventDate,
      status: { $in: ['pending', 'accepted'] },
    });

    if (existingActiveBooking) {
      throw new ApiError(
        409,
        'You already have an active booking (pending or accepted) for this service on this date'
      );
    }

    const now = new Date();
    const newBooking: Booking = {
      serviceId: serviceObjectId,
      vendorId: service.vendorId,
      customerId: customerObjectId,
      eventDate,
      eventLocation: data.eventLocation,
      message: data.message || '',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await getBookingsCollection().insertOne(newBooking);

      res.status(201).json({
        success: true,
        message: 'Booking request submitted successfully',
        data: {
          ...newBooking,
          _id: result.insertedId,
        },
      });
    } catch (insertError: unknown) {
      if (
        insertError &&
        typeof insertError === 'object' &&
        'code' in insertError &&
        (insertError as { code: number }).code === 11000
      ) {
        throw new ApiError(
          409,
          'You already have an active booking (pending or accepted) for this service on this date'
        );
      }
      throw insertError;
    }
  } catch (error) {
    next(error);
  }
};

export const getCustomerBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const customerObjectId = new ObjectId(user.id);

    const pipeline = [
      { $match: { customerId: customerObjectId } },
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
          vendor: {
            id: '$vendor._id',
            name: '$vendor.name',
            businessName: '$vendor.businessName',
            image: '$vendor.image',
          },
        },
      },
    ];

    const bookings = await getBookingsCollection().aggregate(pipeline).toArray();

    res.status(200).json({
      success: true,
      message: 'Customer bookings retrieved successfully',
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerBookingById = async (
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

    const bookingObjectId = new ObjectId(id);
    const customerObjectId = new ObjectId(user.id);

    const pipeline = [
      {
        $match: {
          _id: bookingObjectId,
          customerId: customerObjectId,
        },
      },
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
            description: '$service.description',
            price: '$service.price',
            location: '$service.location',
            image: { $arrayElemAt: ['$service.images', 0] },
            images: '$service.images',
          },
          vendor: {
            id: '$vendor._id',
            name: '$vendor.name',
            businessName: '$vendor.businessName',
            image: '$vendor.image',
          },
        },
      },
    ];

    const results = await getBookingsCollection().aggregate(pipeline).toArray();
    const booking = results[0];

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    res.status(200).json({
      success: true,
      message: 'Booking retrieved successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (
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

    const bookingObjectId = new ObjectId(id);
    const booking = await getBookingsCollection().findOne({ _id: bookingObjectId });

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    if (booking.customerId.toString() !== user.id) {
      throw new ApiError(404, 'Booking not found');
    }

    if (booking.status !== 'pending') {
      throw new ApiError(
        409,
        `Cannot cancel booking with status '${booking.status}'. Only pending bookings can be cancelled.`
      );
    }

    const updatedAt = new Date();
    await getBookingsCollection().updateOne(
      { _id: bookingObjectId },
      {
        $set: {
          status: 'cancelled',
          updatedAt,
        },
      }
    );

    const updated = await getBookingsCollection().findOne({ _id: bookingObjectId });

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerOverview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const customerObjectId = new ObjectId(user.id);

    const [total, pending, accepted, rejected, cancelled] = await Promise.all([
      getBookingsCollection().countDocuments({ customerId: customerObjectId }),
      getBookingsCollection().countDocuments({
        customerId: customerObjectId,
        status: 'pending',
      }),
      getBookingsCollection().countDocuments({
        customerId: customerObjectId,
        status: 'accepted',
      }),
      getBookingsCollection().countDocuments({
        customerId: customerObjectId,
        status: 'rejected',
      }),
      getBookingsCollection().countDocuments({
        customerId: customerObjectId,
        status: 'cancelled',
      }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Customer overview retrieved successfully',
      data: {
        total,
        pending,
        accepted,
        rejected,
        cancelled,
      },
    });
  } catch (error) {
    next(error);
  }
};
