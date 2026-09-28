
'use client';

import { ColumnDef } from '@tanstack/react-table';
import Image from 'next/image';
import { Loader2, Pencil, ToggleLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import type { User } from '@/lib/types';
import { useTranslations } from 'next-intl';
import React from 'react';

export const getColumns = (
  t: (key: string) => string,
  onToggleActivate: (user: User) => void,
  onEdit: (user: User) => void,
  isTogglePending: (userId: string) => boolean = () => false,
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
            table.setRowSelection({ [row.id]: true });
          }}
        >
          <RadioGroupItem value={row.id} id={row.id} aria-label={t('selectRow')} />
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
        {row.getValue('is_active') ? t('active') : t('inactive')}
      </Badge>
    ),
  },
  {
    id: 'actions',
    cell: function Cell({ row }) {
      const t = useTranslations('DoctorsPage.DoctorColumns');
      const user = row.original;
      const togglePending = isTogglePending(user.id);
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(user)}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-50"
            onClick={() => onToggleActivate(user)}
            disabled={togglePending}
            aria-busy={togglePending || undefined}
          >
            {togglePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ToggleLeft className="h-3.5 w-3.5" />}
            <span className="text-[9px] font-medium leading-tight">{user.is_active ? t('deactivate') : t('activate')}</span>
          </button>
        </div>
      );
    },
  },
];


export function DoctorsColumnsWrapper({ onToggleActivate, onEdit, isTogglePending }: { onToggleActivate: (user: User) => void; onEdit: (user: User) => void; isTogglePending?: (userId: string) => boolean; }) {
  const t = useTranslations('DoctorsPage.DoctorColumns');
  const columns = React.useMemo(() => {
    return getColumns(t, onToggleActivate, onEdit, isTogglePending);
  }, [t, onToggleActivate, onEdit, isTogglePending]);
  return columns;
}
