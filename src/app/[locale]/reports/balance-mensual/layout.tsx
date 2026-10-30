import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { REPORTS_PERMISSIONS } from '@/constants/permissions';

export default function BalanceMensualLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={REPORTS_PERMISSIONS.BALANCE_MENSUAL_VIEW}>
      {children}
    </RoutePermissionGuard>
  );
}
