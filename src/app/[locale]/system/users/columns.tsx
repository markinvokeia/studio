
'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { User } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, ToggleLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

export const getColumns = (
  t: (key: string) => string,
  onToggleActivate: (user: User) => void,
  onEdit: (user: User) => void,
  canEdit: boolean = true,
  canToggleStatus: boolean = true
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
        const t = useTranslations('SystemUserColumns');
        const user = row.original;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(user)}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
            </button>}
            {canToggleStatus && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onToggleActivate(user)}>
              <ToggleLeft className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium leading-tight">{user.is_active ? t('deactivate') : t('activate')}</span>
            </button>}
          </div>
        );
      },
    },
  ];


export function SystemUserColumnsWrapper({
  onToggleActivate,
  onEdit,
  canEdit = true,
  canToggleStatus = true
}: {
  onToggleActivate: (user: User) => void;
  onEdit: (user: User) => void;
  canEdit?: boolean;
  canToggleStatus?: boolean;
}) {
  const t = useTranslations('SystemUserColumns');
  const columns = React.useMemo(() => {
    return getColumns(t, onToggleActivate, onEdit, canEdit, canToggleStatus);
  }, [t, onToggleActivate, onEdit, canEdit, canToggleStatus]);
  return columns;
}
