
'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { User } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import React from 'react';

interface GetColumnsOptions {
  /** Personal/contact data (email, phone). Gated by PATIENTS_VIEW_DETAIL_INFO. */
  showContactColumns?: boolean;
}

export const getColumns = (
  t: (key: string) => string,
  { showContactColumns = true }: GetColumnsOptions = {},
): ColumnDef<User>[] => [
  {
    id: 'select',
    header: () => null,
    cell: ({ row, table }) => {
      const isSelected = row.getIsSelected();
      return (
        <RadioGroup
          value={isSelected ? row.id : ''}
          onValueChange={() => {
            table.toggleAllPageRowsSelected(false);
            row.toggleSelected(true);
          }}
        >
          <RadioGroupItem value={row.id} id={row.id} aria-label="Select row" />
        </RadioGroup>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('name')} />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{row.getValue('name')}</span>
      </div>
    ),
  },
  ...(showContactColumns
    ? [
        {
          accessorKey: 'email',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('email')} />
          ),
        } as ColumnDef<User>,
      ]
    : []),
  {
    accessorKey: 'identity_document',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('identity_document')} />
    ),
  },
  ...(showContactColumns
    ? [
        {
          accessorKey: 'phone_number',
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={t('phone')} />
          ),
        } as ColumnDef<User>,
      ]
    : []),
  {
    accessorKey: 'is_active',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('status')} />
    ),
    cell: ({ row }) => (
      <Badge variant={row.getValue('is_active') ? 'default' : 'outline'}>
        {row.getValue('is_active') ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    accessorKey: 'internal_id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('internal_id')} />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.getValue('internal_id') ?? '—'}
      </span>
    ),
  },
];


export function UserColumnsWrapper({ showContactColumns = true }: GetColumnsOptions = {}) {
  const t = useTranslations('UserColumns');
  const columns = React.useMemo(() => {
    return getColumns(t, { showContactColumns });
  }, [t, showContactColumns]);
  return columns;
}
