import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';

export default function PurchaseQuotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={PURCHASES_PERMISSIONS.QUOTES_VIEW_MENU}>
      {children}
    </RoutePermissionGuard>
  );
}
