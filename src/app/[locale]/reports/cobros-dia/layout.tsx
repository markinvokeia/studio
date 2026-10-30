import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { REPORTS_PERMISSIONS } from '@/constants/permissions';

export default function CobrosDiaLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoutePermissionGuard requiredPermission={REPORTS_PERMISSIONS.CAJA_VIEW}>
      {children}
    </RoutePermissionGuard>
  );
}
