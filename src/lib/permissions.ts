import { NavItem } from '@/config/nav';
import { DASHBOARD_PERMISSIONS, PATIENTS_PERMISSIONS, TIMELINE_PERMISSIONS } from '@/constants/permissions';

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

const DOCTOR_WORKSPACE_SUPPORTING_ANY = [
  PATIENTS_PERMISSIONS.VIEW_DETAIL,
  PATIENTS_PERMISSIONS.VIEW_DETAIL_HISTORY,
  PATIENTS_PERMISSIONS.VIEW_DETAIL_APPOINTMENTS,
  PATIENTS_PERMISSIONS.VIEW_LIST,
];

export function hasDoctorWorkspaceAccess(userPermissions: string[]): boolean {
  const hasPatientAccess = DOCTOR_WORKSPACE_SUPPORTING_ANY.some(permission => userPermissions.includes(permission));
  const hasWorkspaceAccess = userPermissions.includes(DASHBOARD_PERMISSIONS.DOCTOR_WORKSPACE_ACCESS);

  return hasWorkspaceAccess && hasPatientAccess;
}

const DOCTOR_WORKSPACE_SESSION_WRITE_ANY = [
  TIMELINE_PERMISSIONS.CREATE,
  TIMELINE_PERMISSIONS.UPDATE,
];

export function canManageDoctorWorkspaceSessions(userPermissions: string[]): boolean {
  return DOCTOR_WORKSPACE_SESSION_WRITE_ANY.some(permission => userPermissions.includes(permission));
}
