
'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { User } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import * as React from 'react';

async function getUsersForPermission(permissionId: string): Promise<User[]> {
  if (!permissionId) return [];
  try {
    const data = await api.get(API_ROUTES.PERMISSION_USERS, { permission_id: permissionId });
    const usersData = Array.isArray(data) ? data : (data.permission_users || data.data || data.result || []);

    return usersData.map((apiUser: any) => ({
      id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
      name: apiUser.name || 'No Name',
      email: apiUser.email || 'no-email@example.com',
      phone_number: apiUser.phone_number || '000-000-0000',
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
    }));
  } catch (error) {
    console.error("Failed to fetch permission users:", error);
    return [];
  }
}

interface PermissionUsersProps {
  permissionId: string;
}

export function PermissionUsers({ permissionId }: PermissionUsersProps) {
  const t = useTranslations('UserColumns');
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('name')} />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.getValue('name')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('email')} />,
    },
    {
      accessorKey: 'is_active',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('status')} />,
      cell: ({ row }) => (
        <Badge variant={row.getValue('is_active') ? 'default' : 'outline'}>
          {row.getValue('is_active') ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  React.useEffect(() => {
    async function loadUsers() {
      if (!permissionId) return;
      setIsLoading(true);
      const fetchedUsers = await getUsersForPermission(permissionId);
      setUsers(fetchedUsers);
      setIsLoading(false);
    }
    loadUsers();
  }, [permissionId]);

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
          data={users}
          filterColumnId='name'
          filterPlaceholder='Filter by user...'
        />
      </CardContent>
    </Card>
  );
}
