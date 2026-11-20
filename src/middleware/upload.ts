import multer from 'multer';
import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { ApiError } from './error.js';

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});

export const handleSingleUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const uploadHandler = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(400, 'File size exceeds maximum limit of 5 MB'));
        }
        return next(new ApiError(400, err.message));
      }
      return next(err);
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const file = req.file || files?.image?.[0] || files?.file?.[0];

    if (!file) {
      return next(new ApiError(400, 'No image file provided'));
    }

    req.file = file;
    next();
  });
};

export const publicUploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      new ApiError(
        429,
        'Too many upload requests from this IP, please try again after 15 minutes.'
      )
    );
  },
});
