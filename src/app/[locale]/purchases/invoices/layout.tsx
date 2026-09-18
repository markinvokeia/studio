import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';

export default function PurchaseInvoicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={PURCHASES_PERMISSIONS.INVOICES_VIEW_MENU}>
      {children}
    </RoutePermissionGuard>
  );
}
