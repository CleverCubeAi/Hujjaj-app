import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const VALID_FOLDERS = ['agencies', 'avatars', 'airlines', 'hotels', 'rooms', 'pilgrims'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function uploadsRoot() {
  return path.resolve(process.cwd(), 'uploads');
}

function publicBaseUrl() {
  return (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
}

export const uploadFile = async (req: Request, res: Response) => {
  try {
    const folder = Array.isArray(req.params.folder) ? req.params.folder[0] : req.params.folder;
    const agencyId = req.user?.agency_id;

    if (!agencyId) {
      return res.status(400).json({
        error: 'Agency ID required for uploads. Super admin is not tied to an agency.',
      });
    }

    if (!VALID_FOLDERS.includes(folder)) {
      return res.status(400).json({
        error: `Invalid folder. Must be one of: ${VALID_FOLDERS.join(', ')}`,
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return res.status(400).json({
        error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

    const fileExt = file.originalname.split('.').pop();
    const relativePath = `${agencyId}/${randomUUID()}.${fileExt}`;
    const destDir = path.join(uploadsRoot(), folder, agencyId);
    const destPath = path.join(uploadsRoot(), folder, relativePath);

    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(destPath, file.buffer);

    const url = `${publicBaseUrl()}/uploads/${folder}/${relativePath}`;

    res.json({
      message: 'File uploaded successfully',
      url,
      path: relativePath,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const folder = Array.isArray(req.params.folder) ? req.params.folder[0] : req.params.folder;
    const { path: filePath } = req.body;
    const agencyId = req.user?.agency_id;

    if (!agencyId) {
      return res.status(400).json({
        error: 'Agency ID required. Super admin is not tied to an agency.',
      });
    }

    if (!VALID_FOLDERS.includes(folder)) {
      return res.status(400).json({ error: 'Invalid folder' });
    }

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    if (!filePath.startsWith(agencyId)) {
      return res.status(403).json({ error: 'Cannot delete files from other agencies' });
    }

    const fullPath = path.join(uploadsRoot(), folder, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
};
