import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { SALES_PERMISSIONS } from '@/constants/permissions';

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={SALES_PERMISSIONS.SERVICES_VIEW_MENU}>
      {children}
    </RoutePermissionGuard>
  );
}
