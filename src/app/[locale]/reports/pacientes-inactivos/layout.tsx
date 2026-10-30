import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { REPORTS_PERMISSIONS } from '@/constants/permissions';

export default function PacientesInactivosLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={REPORTS_PERMISSIONS.PACIENTES_VIEW}>
      {children}
    </RoutePermissionGuard>
  );
}
