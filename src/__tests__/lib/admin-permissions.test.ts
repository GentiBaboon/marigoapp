import { describe, it, expect } from 'vitest';
import {
  ROLE_PERMISSIONS,
  ADMIN_ROLES,
  hasPermission,
  isAdminRole,
  type AdminPermission,
} from '@/lib/admin-permissions';

const ALL_PERMISSION_NAMES: AdminPermission[] = [
  'dashboard.view', 'products.manage', 'orders.manage',
  'users.view', 'users.manage', 'users.change_role',
  'finance.view', 'finance.manage', 'settings.manage',
  'moderation.manage', 'marketing.manage', 'logistics.manage',
  'logs.view', 'support.manage', 'disputes.manage',
  'refunds.manage', 'returns.manage', 'analytics.view',
];

describe('admin-permissions', () => {
  describe('ROLE_PERMISSIONS', () => {
    it('super_admin has all 18 permissions', () => {
      expect(ROLE_PERMISSIONS.super_admin).toHaveLength(18);
      for (const perm of ALL_PERMISSION_NAMES) {
        expect(ROLE_PERMISSIONS.super_admin).toContain(perm);
      }
    });

    it('admin has all permissions except users.change_role', () => {
      expect(ROLE_PERMISSIONS.admin).toHaveLength(17);
      expect(ROLE_PERMISSIONS.admin).not.toContain('users.change_role');
      for (const perm of ALL_PERMISSION_NAMES.filter(p => p !== 'users.change_role')) {
        expect(ROLE_PERMISSIONS.admin).toContain(perm);
      }
    });

    it('moderator has exactly 8 permissions', () => {
      expect(ROLE_PERMISSIONS.moderator).toHaveLength(8);
      expect(ROLE_PERMISSIONS.moderator).toContain('dashboard.view');
      expect(ROLE_PERMISSIONS.moderator).toContain('products.manage');
      expect(ROLE_PERMISSIONS.moderator).toContain('moderation.manage');
      expect(ROLE_PERMISSIONS.moderator).toContain('orders.manage');
      expect(ROLE_PERMISSIONS.moderator).toContain('support.manage');
      expect(ROLE_PERMISSIONS.moderator).toContain('disputes.manage');
      expect(ROLE_PERMISSIONS.moderator).toContain('refunds.manage');
      expect(ROLE_PERMISSIONS.moderator).toContain('returns.manage');
    });

    it('moderator cannot access finance.view or settings.manage', () => {
      expect(ROLE_PERMISSIONS.moderator).not.toContain('finance.view');
      expect(ROLE_PERMISSIONS.moderator).not.toContain('settings.manage');
    });

    it('analyst has exactly 4 permissions', () => {
      expect(ROLE_PERMISSIONS.analyst).toHaveLength(4);
      expect(ROLE_PERMISSIONS.analyst).toContain('dashboard.view');
      expect(ROLE_PERMISSIONS.analyst).toContain('finance.view');
      expect(ROLE_PERMISSIONS.analyst).toContain('analytics.view');
      expect(ROLE_PERMISSIONS.analyst).toContain('logs.view');
    });

    it('analyst cannot access products.manage', () => {
      expect(ROLE_PERMISSIONS.analyst).not.toContain('products.manage');
    });
  });

  describe('hasPermission', () => {
    it('returns true for valid role + permission combo', () => {
      expect(hasPermission('super_admin', 'users.change_role')).toBe(true);
      expect(hasPermission('admin', 'dashboard.view')).toBe(true);
      expect(hasPermission('moderator', 'orders.manage')).toBe(true);
      expect(hasPermission('analyst', 'analytics.view')).toBe(true);
    });

    it('returns false for undefined role', () => {
      expect(hasPermission(undefined, 'dashboard.view')).toBe(false);
    });

    it('returns false for non-admin role like buyer', () => {
      expect(hasPermission('buyer', 'dashboard.view')).toBe(false);
    });

    it('admin does not have users.change_role', () => {
      expect(hasPermission('admin', 'users.change_role')).toBe(false);
    });

    it('analyst does not have products.manage', () => {
      expect(hasPermission('analyst', 'products.manage')).toBe(false);
    });
  });

  describe('isAdminRole', () => {
    it('returns true for all 4 admin roles', () => {
      for (const role of ADMIN_ROLES) {
        expect(isAdminRole(role)).toBe(true);
      }
    });

    it('returns false for buyer', () => {
      expect(isAdminRole('buyer')).toBe(false);
    });

    it('returns false for seller', () => {
      expect(isAdminRole('seller')).toBe(false);
    });

    it('returns false for courier', () => {
      expect(isAdminRole('courier')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isAdminRole(undefined)).toBe(false);
    });
  });
});
