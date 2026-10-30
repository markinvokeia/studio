import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { SALES_PERMISSIONS } from '@/constants/permissions';

export default function QuotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={SALES_PERMISSIONS.QUOTES_VIEW_MENU}>
      {children}
    </RoutePermissionGuard>
  );
}
