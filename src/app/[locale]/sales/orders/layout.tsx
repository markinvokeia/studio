import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { SALES_PERMISSIONS } from '@/constants/permissions';

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={SALES_PERMISSIONS.ORDERS_VIEW_MENU}>
      {children}
    </RoutePermissionGuard>
  );
}
