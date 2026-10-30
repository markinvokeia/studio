import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { REPORTS_PERMISSIONS } from '@/constants/permissions';

export default function EstadoPresupuestosLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={REPORTS_PERMISSIONS.INGRESOS_VIEW}>
      {children}
    </RoutePermissionGuard>
  );
}
