import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '../utils/httpError';

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  agencyName: z.string().min(1).max(200),
  fullName: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  full_name: z.string().min(1).max(200),
  user_role: z.enum(['agency_admin', 'manager', 'agent']),
  branch_id: z.string().uuid().nullable().optional(),
  avatar_url: z.string().max(2000).nullable().optional(),
});
