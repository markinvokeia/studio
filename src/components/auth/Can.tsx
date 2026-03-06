'use client';

import { usePermissions } from '@/hooks/usePermissions';

interface CanProps {
  permission?: string;
  permissions?: string[];
  anyPermissions?: string[];
  role?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function Can({
  permission,
  permissions,
  anyPermissions,
  role,
  children,
  fallback = null,
}: CanProps) {
  const { hasPermission, hasAllPermissions, hasAnyPermission, roles } = usePermissions();

  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (permissions && !hasAllPermissions(permissions)) return <>{fallback}</>;
  if (anyPermissions && !hasAnyPermission(anyPermissions)) return <>{fallback}</>;
  if (role && !roles.includes(role)) return <>{fallback}</>;

  return <>{children}</>;
}
