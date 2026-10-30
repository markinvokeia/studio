import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';

export default function PurchasePaymentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={PURCHASES_PERMISSIONS.PAYMENTS_VIEW_MENU}>
      {children}
    </RoutePermissionGuard>
  );
}
