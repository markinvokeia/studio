'use client';

import { useAuth } from '@/context/AuthContext';

export type Action = 'create' | 'read' | 'update' | 'delete';

export interface UsePermissionsReturn {
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  hasAllPermissions: (codes: string[]) => boolean;
  canAccess: (action: Action, resource: string) => boolean;
  permissions: string[];
  roles: string[];
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, isLoading } = useAuth();

  const permissions = user?.roles_and_permissions?.flatMap(role =>
    role.permissions.map(p => p.code)
  ) ?? [];

  const roles = user?.roles_and_permissions?.map(r => r.role_name) ?? [];

  const hasPermission = (code: string): boolean => {
    return permissions.includes(code);
  };

  const hasAnyPermission = (codes: string[]): boolean => {
    return codes.some(code => permissions.includes(code));
  };

  const hasAllPermissions = (codes: string[]): boolean => {
    return codes.every(code => permissions.includes(code));
  };

  const canAccess = (action: Action, resource: string): boolean => {
    const prefix = resource.toUpperCase().replace(/\s+/g, '_');
    const code = `${prefix}_${action.toUpperCase()}`;
    return permissions.includes(code);
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccess,
    permissions,
    roles,
    isLoading,
  };
}
