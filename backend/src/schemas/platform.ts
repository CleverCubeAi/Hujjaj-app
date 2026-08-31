import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '../utils/httpError';

export const AGENCY_STATUSES = ['active', 'inactive', 'suspended'] as const;
export const AGENCY_USER_ROLES = ['agency_admin', 'manager', 'agent'] as const;

export const createAgencySchema = z.object({
  name: z.string().min(1).max(200),
  country: z.string().max(100).optional().nullable(),
  package_id: z.string().uuid().optional(),
  status: z.enum(AGENCY_STATUSES).default('active'),
  admin_email: z.string().email().max(255),
  admin_password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  admin_full_name: z.string().min(1).max(200),
  send_invite: z.boolean().optional(),
});

export const updateAgencySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  country: z.string().max(100).optional().nullable(),
  status: z.enum(AGENCY_STATUSES).optional(),
  logo_url: z.string().max(2000).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal('')),
  phone: z.string().max(40).optional().nullable(),
});

export const createAgencyUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  full_name: z.string().min(1).max(200),
  user_role: z.enum(AGENCY_USER_ROLES).default('agency_admin'),
});

export const updateAgencyUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200).optional(),
  full_name: z.string().min(1).max(200).optional(),
  user_role: z.enum(AGENCY_USER_ROLES).optional(),
});
