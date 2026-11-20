import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';

export const uploadToImgBB = async (file: Express.Multer.File): Promise<string> => {
  try {
    const formData = new FormData();
    const base64Image = file.buffer.toString('base64');
    formData.append('image', base64Image);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${env.IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
    });

    const data = (await response.json()) as {
      success?: boolean;
      status?: number;
      data?: {
        url?: string;
        display_url?: string;
      };
      error?: {
        message?: string;
      };
    };

    if (!response.ok || !data.success || !data.data?.url) {
      const errorMsg = data.error?.message || `ImgBB responded with status ${response.status}`;
      throw new ApiError(502, `Image upload service failed: ${errorMsg}`);
    }

    return data.data.url;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    throw new ApiError(502, `Image upload service failed: ${message}`);
  }
};

export const uploadImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      throw new ApiError(400, 'No image file provided');
    }

    const url = await uploadToImgBB(file);

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      url,
      data: { url },
    });
  } catch (error) {
    next(error);
  }
};
