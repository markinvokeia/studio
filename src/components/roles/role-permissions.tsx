'use client';

import { PermissionMatrix } from './permission-matrix';
import * as React from 'react';

interface RolePermissionsProps {
  roleId: string;
}

export function RolePermissions({ roleId }: RolePermissionsProps) {
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
