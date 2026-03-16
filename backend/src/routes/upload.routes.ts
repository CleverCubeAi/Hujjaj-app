import { Router } from 'express';
import multer from 'multer';
import { uploadFile, deleteFile } from '../controllers/upload.controller';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// POST /api/upload/:folder - Upload file to specified folder
router.post('/:folder', upload.single('file'), uploadFile);

// DELETE /api/upload/:folder - Delete file from specified folder
router.delete('/:folder', deleteFile);

export default router;
