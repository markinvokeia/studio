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
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DataCard } from '@/components/ui/data-card';

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
        {row.getValue('is_active') ? t('UserColumns.active') : t('UserColumns.inactive')}
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
  const isNarrow = useViewportNarrow();

  return (
    <Card className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
      <CardHeader className="flex-none p-4 pb-2">
        <div className="flex items-start gap-3">
          <div className="header-icon-circle mt-0.5">
            <UserPlusIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <CardTitle className="text-lg">{t('NewPatientsTable.title')}</CardTitle>
            <CardDescription className="text-xs">{t('NewPatientsTable.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden pt-2">
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
          isNarrow={isNarrow}
          renderCard={(patient: User) => (
            <DataCard
              title={patient.name}
              subtitle={patient.email || patient.phone_number || patient.identity_document || ''}
              badge={<Badge variant={patient.is_active ? 'default' : 'outline'}>{patient.is_active ? t('UserColumns.active') : t('UserColumns.inactive')}</Badge>}
            />
          )}
        />
      </CardContent>
    </Card>
  );
}
