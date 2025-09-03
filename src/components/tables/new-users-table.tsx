
'use client';

import { ColumnDef } from '@tanstack/react-table';
import Image from 'next/image';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { User } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Image
          src={row.original.avatar}
          width={32}
          height={32}
          alt={row.original.name}
          className="rounded-full"
        />
        <span className="font-medium">{row.getValue('name')}</span>
      </div>
    ),
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
  },
  {
    accessorKey: 'is_active',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={row.getValue('is_active') ? 'default' : 'outline'}>
        {row.getValue('is_active') ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

interface NewUsersTableProps {
  users: User[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function NewUsersTable({ users, onRefresh, isRefreshing }: NewUsersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>New Users</CardTitle>
        <CardDescription>A list of the newest users.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={users}
          filterColumnId="name"
          filterPlaceholder="Filter by name..."
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}

    