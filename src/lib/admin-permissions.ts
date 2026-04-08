export type AdminPermission =
  | 'dashboard.view'
  | 'products.manage'
  | 'orders.manage'
  | 'users.view'
  | 'users.manage'
  | 'users.change_role'
  | 'finance.view'
  | 'finance.manage'
  | 'settings.manage'
  | 'moderation.manage'
  | 'marketing.manage'
  | 'logistics.manage'
  | 'logs.view'
  | 'support.manage'
  | 'disputes.manage'
  | 'refunds.manage'
  | 'returns.manage'
  | 'analytics.view';

const ALL_PERMISSIONS: AdminPermission[] = [
  'dashboard.view', 'products.manage', 'orders.manage',
  'users.view', 'users.manage', 'users.change_role',
  'finance.view', 'finance.manage', 'settings.manage',
  'moderation.manage', 'marketing.manage', 'logistics.manage',
  'logs.view', 'support.manage', 'disputes.manage',
  'refunds.manage', 'returns.manage', 'analytics.view',
];

export const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter(p => p !== 'users.change_role'),
  moderator: [
    'dashboard.view', 'products.manage', 'moderation.manage',
    'orders.manage', 'support.manage', 'disputes.manage',
    'refunds.manage', 'returns.manage',
  ],
  analyst: [
    'dashboard.view', 'finance.view', 'analytics.view', 'logs.view',
  ],
};

export const ADMIN_ROLES = ['super_admin', 'admin', 'moderator', 'analyst'] as const;

export function hasPermission(role: string | undefined, perm: AdminPermission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.includes(perm) : false;
}

export function isAdminRole(role: string | undefined): boolean {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}
