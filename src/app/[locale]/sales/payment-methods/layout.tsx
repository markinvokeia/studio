import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { SALES_PERMISSIONS } from '@/constants/permissions';

export default function PaymentMethodsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={SALES_PERMISSIONS.PAYMENT_METHODS_VIEW_MENU}>
      {children}
    </RoutePermissionGuard>
  );
}
