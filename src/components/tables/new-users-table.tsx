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
import React from 'react';
import { useTranslations } from 'next-intl';

const getColumns = (t: (key: string) => string): ColumnDef<User>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('UserColumns.name')} />
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
      <DataTableColumnHeader column={column} title={t('UserColumns.email')} />
    ),
  },
  {
    accessorKey: 'is_active',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('UserColumns.status')} />
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
  const t = useTranslations();
  console.log('Translations for NewUsersTable loaded.');
  const columns = React.useMemo(() => getColumns(t), [t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('NewUsersTable.title')}</CardTitle>
        <CardDescription>{t('NewUsersTable.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={users}
          filterColumnId="name"
          filterPlaceholder={t('NewUsersTable.filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}