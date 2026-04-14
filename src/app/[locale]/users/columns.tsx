
'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { User } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, ToggleLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

export const getColumns = (t: (key: string) => string, onToggleActivate: (user: User) => void, onEdit: (user: User) => void): ColumnDef<User>[] => [
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
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('email')} />
    ),
  },
  {
    accessorKey: 'identity_document',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('identity_document')} />
    ),
  },
  {
    accessorKey: 'phone_number',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('phone')} />
    ),
  },
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
    id: 'actions',
    cell: function Cell({ row }) {
      const t = useTranslations('UserColumns');
      const user = row.original;
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(user)}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
          </button>
          <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onToggleActivate(user)}>
            <ToggleLeft className="h-3.5 w-3.5" />
            <span className="text-[9px] font-medium leading-tight">{user.is_active ? t('deactivate') : t('activate')}</span>
          </button>
        </div>
      );
    },
  },
];


export function UserColumnsWrapper({ onToggleActivate, onEdit }: { onToggleActivate: (user: User) => void; onEdit: (user: User) => void; }) {
  const t = useTranslations('UserColumns');
  const columns = React.useMemo(() => {
    return getColumns(t, onToggleActivate, onEdit);
  }, [t, onToggleActivate, onEdit]);
  return columns;
}
