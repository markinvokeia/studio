import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';

export default function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={PURCHASES_PERMISSIONS.ORDERS_VIEW_MENU}>
      {children}
    </RoutePermissionGuard>
  );
}
