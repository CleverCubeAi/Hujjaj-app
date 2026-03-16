import { Router } from 'express';
import {
  // Discount Settings
  listDiscountSettings,
  getDiscountSetting,
  createDiscountSetting,
  updateDiscountSetting,
  deleteDiscountSetting,
  // Available Discounts
  getAvailableDiscounts,
  calculateDiscount,
  // User Permissions
  listUserPermissions,
  getUserPermissions,
  createUserPermission,
  updateUserPermission,
  deleteUserPermission,
  bulkUpdateUserPermissions,
  // Usage Log
  logDiscountUsage,
  getUsageLog,
  getUsageStats
} from '../controllers/discounts.controller';

const router = Router();

// ============================================
// Static routes MUST come before parametric routes
// ============================================

// List all discount settings
router.get('/', listDiscountSettings);

// Available discounts for current user (booking wizard)
router.get('/available', getAvailableDiscounts);

// Calculate discount amount
router.post('/calculate', calculateDiscount);

// ============================================
// User Permissions Routes (before /:id)
// ============================================
router.get('/user-permissions', listUserPermissions);
router.post('/user-permissions', createUserPermission);
router.get('/user-permissions/user/:user_id', getUserPermissions);
router.put('/user-permissions/bulk/:user_id', bulkUpdateUserPermissions);
router.put('/user-permissions/:id', updateUserPermission);
router.delete('/user-permissions/:id', deleteUserPermission);

// ============================================
// Usage Log Routes (before /:id)
// ============================================
router.get('/usage-log', getUsageLog);
router.post('/usage-log', logDiscountUsage);
router.get('/usage-stats', getUsageStats);

// ============================================
// Parametric routes MUST come last
// ============================================
router.get('/:id', getDiscountSetting);
router.post('/', createDiscountSetting);
router.put('/:id', updateDiscountSetting);
router.delete('/:id', deleteDiscountSetting);

export default router;
