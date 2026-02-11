
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { User } from '@/lib/types';
import { ColumnFiltersState, PaginationState } from '@tanstack/react-table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import React from 'react';
import { useTranslations } from 'next-intl';
import { UserPlusIcon } from '../icons/user-plus-icon';

const getColumns = (t: (key: string) => string): ColumnDef<User>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('UserColumns.name')} />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
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

interface NewPatientsTableProps {
  patients: User[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: React.Dispatch<React.SetStateAction<PaginationState>>;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  className?: string;
}

export function NewPatientsTable({
  patients,
  onRefresh,
  isRefreshing,
  pageCount,
  pagination,
  onPaginationChange,
  columnFilters,
  onColumnFiltersChange,
  className,
}: NewPatientsTableProps) {
  const t = useTranslations();
  const columns = React.useMemo(() => getColumns(t), [t]);

  return (
    <Card className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
      <CardHeader className="flex-none p-6 pb-0">
        <div className="flex items-center gap-2">
          <UserPlusIcon className="h-6 w-6 text-emerald-500" />
          <CardTitle className="text-lg lg:text-xl">{t('NewPatientsTable.title')}</CardTitle>
        </div>
        <CardDescription className="text-xs">{t('NewPatientsTable.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden pt-4">
        <DataTable
          columns={columns}
          data={patients}
          filterColumnId="name"
          filterPlaceholder={t('NewPatientsTable.filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          columnFilters={columnFilters}
          onColumnFiltersChange={onColumnFiltersChange}
          manualPagination={true}
        />
      </CardContent>
    </Card>
  );
}
