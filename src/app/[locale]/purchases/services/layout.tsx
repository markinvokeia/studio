import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';

export default function PurchaseServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={PURCHASES_PERMISSIONS.PRODUCTS_VIEW_MENU}>
      {children}
    </RoutePermissionGuard>
  );
}
