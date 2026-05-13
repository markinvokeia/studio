import { NavItem } from '@/config/nav';

function cleanSeparators(items: NavItem[]): NavItem[] {
  const result: NavItem[] = [];
  for (const item of items) {
    if (item.isSeparator) {
      // Only add separator if there's at least one non-separator item before it
      // (prevents leading separators and consecutive separators)
      if (result.length > 0 && !result[result.length - 1].isSeparator) {
        result.push(item);
      }
    } else {
      result.push(item);
    }
  }
  // Remove trailing separator if it's the last item
  while (result.length > 0 && result[result.length - 1].isSeparator) {
    result.pop();
  }
  return result;
}

export function filterNavByPermissions(
  items: NavItem[],
  userPermissions: string[],
  userRoles: string[]
): NavItem[] {
  const filtered = items.filter(item => {
    if (item.isSeparator) return true;

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

  return cleanSeparators(filtered);
}
