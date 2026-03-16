import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../services/supabase';

// Valid folder/bucket names
const VALID_FOLDERS = ['agencies', 'avatars', 'airlines', 'hotels', 'rooms', 'pilgrims'];

// File size limit (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const uploadFile = async (req: Request, res: Response) => {
  try {
    const folder = Array.isArray(req.params.folder) ? req.params.folder[0] : req.params.folder;
    const agencyId = req.user?.agency_id;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    // Validate folder
    if (!VALID_FOLDERS.includes(folder)) {
      return res.status(400).json({ 
        error: `Invalid folder. Must be one of: ${VALID_FOLDERS.join(', ')}` 
      });
    }

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ 
        error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}` 
      });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
      });
    }

    // Generate unique filename
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${agencyId}/${randomUUID()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(folder)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return res.status(500).json({ error: 'Failed to upload file: ' + error.message });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(folder)
      .getPublicUrl(fileName);

    res.json({
      message: 'File uploaded successfully',
      url: urlData.publicUrl,
      path: data.path
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const folder = Array.isArray(req.params.folder) ? req.params.folder[0] : req.params.folder;
    const { path } = req.body;
    const agencyId = req.user?.agency_id;

    if (!agencyId) {
      return res.status(403).json({ error: 'Agency ID not found' });
    }

    // Validate folder
    if (!VALID_FOLDERS.includes(folder)) {
      return res.status(400).json({ error: 'Invalid folder' });
    }

    if (!path) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Ensure the file belongs to the agency (path should start with agencyId)
    if (!path.startsWith(agencyId)) {
      return res.status(403).json({ error: 'Cannot delete files from other agencies' });
    }

    // Delete from Supabase Storage
    const { error } = await supabaseAdmin.storage
      .from(folder)
      .remove([path]);

    if (error) {
      console.error('Supabase storage delete error:', error);
      return res.status(500).json({ error: 'Failed to delete file: ' + error.message });
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
};
