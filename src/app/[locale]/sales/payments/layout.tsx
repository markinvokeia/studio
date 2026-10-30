import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { SALES_PERMISSIONS } from '@/constants/permissions';

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={SALES_PERMISSIONS.PAYMENTS_VIEW_MENU}>
      {children}
    </RoutePermissionGuard>
  );
}
