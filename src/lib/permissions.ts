import { NavItem } from '@/config/nav';

export function filterNavByPermissions(
  items: NavItem[],
  userPermissions: string[],
  userRoles: string[]
): NavItem[] {
  return items.filter(item => {
    if (item.requiredPermission && !userPermissions.includes(item.requiredPermission)) {
      return false;
    }

    if (item.requiredPermissions) {
      const hasAll = item.requiredPermissions.every(p => userPermissions.includes(p));
      if (!hasAll) return false;
    }

    if (item.requiredAnyPermission) {
      const hasAny = item.requiredAnyPermission.some(p => userPermissions.includes(p));
      if (!hasAny) return false;
    }

    if (item.requiredRole && !userRoles.includes(item.requiredRole)) {
      return false;
    }

    if (item.items && item.items.length > 0) {
      const filteredItems = filterNavByPermissions(item.items, userPermissions, userRoles);
      if (filteredItems.length === 0) return false;
      item.items = filteredItems;
    }

    return true;
  });
}
