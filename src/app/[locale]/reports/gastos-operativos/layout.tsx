import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { REPORTS_PERMISSIONS } from '@/constants/permissions';

export default function GastosOperativosLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={REPORTS_PERMISSIONS.GASTOS_VIEW}>
      {children}
    </RoutePermissionGuard>
  );
}
