'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Permission } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const columns: ColumnDef<Permission>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Permission" />,
  },
  {
    accessorKey: 'description',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
  },
  {
    accessorKey: 'action',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
    cell: ({ row }) => <Badge variant="secondary" className="capitalize">{row.getValue('action')}</Badge>,
  },
  {
    accessorKey: 'resource',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Resource" />,
    cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.getValue('resource')}</Badge>,
  },
];

async function getPermissionsForRole(roleId: string): Promise<Permission[]> {
  if (!roleId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/role_permissions?role_id=${roleId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const permissionsData = Array.isArray(data) ? data : (data.role_permissions || data.data || data.result || []);

    return permissionsData.map((apiPerm: any) => ({
      id: apiPerm.id ? String(apiPerm.id) : `perm_${Math.random().toString(36).substr(2, 9)}`,
      name: apiPerm.name || 'Unknown Permission',
      action: apiPerm.action || 'N/A',
      resource: apiPerm.resource || 'N/A',
      description: apiPerm.description || 'No description',
    }));
  } catch (error) {
    console.error("Failed to fetch role permissions:", error);
    return [];
  }
}

interface RolePermissionsProps {
  roleId: string;
}

export function RolePermissions({ roleId }: RolePermissionsProps) {
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadPermissions() {
      if (!roleId) return;
      setIsLoading(true);
      const fetchedPermissions = await getPermissionsForRole(roleId);
      setPermissions(fetchedPermissions);
      setIsLoading(false);
    }
    loadPermissions();
  }, [roleId]);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={permissions}
          filterColumnId='name'
          filterPlaceholder='Filter by permission...'
        />
      </CardContent>
    </Card>
  );
}
