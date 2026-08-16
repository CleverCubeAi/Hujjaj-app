import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  signUploadToken,
  verifyUploadToken,
  UPLOAD_TOKEN_TTL_SECONDS,
  PILGRIM_UPLOAD_TTL_SECONDS,
} from '../utils/crypto';
import { sendError } from '../utils/httpError';

export const VALID_FOLDERS = ['agencies', 'avatars', 'airlines', 'hotels', 'rooms', 'pilgrims'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const SAFE_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;
const SAFE_FILENAME_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/;

function uploadsRoot() {
  return path.resolve(process.cwd(), 'uploads');
}

function publicBaseUrl() {
  return (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
}

function ttlForFolder(folder: string) {
  return folder === 'pilgrims' ? PILGRIM_UPLOAD_TTL_SECONDS : UPLOAD_TOKEN_TTL_SECONDS;
}

function signedUrl(folder: string, relativePath: string) {
  const exp = Math.floor(Date.now() / 1000) + ttlForFolder(folder);
  const tokenPath = `${folder}/${relativePath}`;
  const sig = signUploadToken(tokenPath, exp);
  return `${publicBaseUrl()}/uploads/${tokenPath}?exp=${exp}&sig=${sig}`;
}

function safeResolve(folder: string, filePath: string, agencyId?: string) {
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.resolve(uploadsRoot(), folder, normalized);
  const folderRoot = path.resolve(uploadsRoot(), folder);
  if (!fullPath.startsWith(folderRoot + path.sep) && fullPath !== folderRoot) {
    return null;
  }
  if (agencyId) {
    const agencyRoot = path.resolve(folderRoot, agencyId);
    if (!fullPath.startsWith(agencyRoot + path.sep) && fullPath !== agencyRoot) {
      return null;
    }
  }

  try {
    const realFolderRoot = fs.realpathSync.native(folderRoot);
    const parentDir = path.dirname(fullPath);
    const realParentDir = fs.realpathSync.native(parentDir);
    const realFullPath = path.join(realParentDir, path.basename(fullPath));

    if (!realFullPath.startsWith(realFolderRoot + path.sep) && realFullPath !== realFolderRoot) {
      return null;
    }

    if (agencyId) {
      const realAgencyRoot = fs.realpathSync.native(path.resolve(folderRoot, agencyId));
      if (!realFullPath.startsWith(realAgencyRoot + path.sep) && realFullPath !== realAgencyRoot) {
        return null;
      }
    }
  } catch {
    return null;
  }

  return fullPath;
}

export const uploadFile = async (req: Request, res: Response) => {
  try {
    const folder = Array.isArray(req.params.folder) ? req.params.folder[0] : req.params.folder;
    const agencyId = req.user?.agency_id || req.agencyId;

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

    const rawExt = (file.originalname.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const fileExt = ALLOWED_EXT.includes(rawExt) ? rawExt : 'jpg';
    const relativePath = `${agencyId}/${randomUUID()}.${fileExt}`;
    const destDir = path.join(uploadsRoot(), folder, agencyId);
    const destPath = path.join(uploadsRoot(), folder, relativePath);

    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(destPath, file.buffer);

    res.json({
      message: 'File uploaded successfully',
      url: signedUrl(folder, relativePath),
      path: relativePath,
    });
  } catch (error: any) {
    return sendError(res, error);
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const folder = Array.isArray(req.params.folder) ? req.params.folder[0] : req.params.folder;
    const { path: filePath } = req.body;
    const agencyId = req.user?.agency_id || req.agencyId;

    if (!agencyId) {
      return res.status(400).json({
        error: 'Agency ID required. Super admin is not tied to an agency.',
      });
    }

    if (!VALID_FOLDERS.includes(folder)) {
      return res.status(400).json({ error: 'Invalid folder' });
    }

    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = safeResolve(folder, filePath, agencyId);
    if (!fullPath) {
      return res.status(403).json({ error: 'Cannot delete files from other agencies' });
    }

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    return sendError(res, error);
  }
};

export const serveUpload = async (req: Request, res: Response) => {
  try {
    const folder = Array.isArray(req.params.folder) ? req.params.folder[0] : req.params.folder;
    const agencyIdParam = Array.isArray(req.params.agencyId) ? req.params.agencyId[0] : req.params.agencyId;
    const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
    if (!VALID_FOLDERS.includes(folder) || !agencyIdParam || !filename) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    if (
      !SAFE_SEGMENT_RE.test(agencyIdParam) ||
      !SAFE_FILENAME_RE.test(filename) ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.startsWith('.')
    ) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const rest = `${agencyIdParam}/${filename}`;
    const relative = `${folder}/${rest}`.replace(/\\/g, '/');
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig || '');
    const signedOk = verifyUploadToken(relative, exp, sig);
    const agencyId = req.user?.agency_id || req.agencyId;
    const authedOk = !!req.user && (!agencyId || agencyIdParam === agencyId || req.user.role === 'super_admin');

    // Passport scans require a logged-in session; a leaked signed URL is not enough.
    if (folder === 'pilgrims') {
      if (!authedOk) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else if (!signedOk && !authedOk) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fullPath = safeResolve(folder, rest, authedOk ? (agencyId || undefined) : undefined);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.sendFile(fullPath);
  } catch (error: any) {
    return sendError(res, error);
  }
};
