import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { handleSingleUpload, publicUploadRateLimiter } from '../middleware/upload.js';
import { uploadImage } from '../controllers/upload.controller.js';

const router = Router();

router.post('/public', publicUploadRateLimiter, handleSingleUpload, uploadImage);
router.post('/', authenticate, handleSingleUpload, uploadImage);

export default router;
