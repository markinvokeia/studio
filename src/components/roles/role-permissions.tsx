'use client';

import * as React from 'react';
import { PermissionMatrix } from './permission-matrix';

interface RolePermissionsProps {
  roleId: string;
  canAssignPermission?: boolean;
  canRemovePermission?: boolean;
}

export function RolePermissions({ roleId, canAssignPermission = true, canRemovePermission = true }: RolePermissionsProps) {
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handlePermissionsChange = React.useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <div key={`${roleId}-${refreshKey}`}>
      <PermissionMatrix
        roleId={roleId}
        onPermissionsChange={handlePermissionsChange}
      />
    </div>
  );
}
