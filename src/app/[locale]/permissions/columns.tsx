
'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Permission } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PermissionsColumnsProps {
  onDelete: (permission: Permission) => void;
  canDelete?: boolean;
}

export const PermissionsColumnsWrapper = ({ onDelete, canDelete = true }: PermissionsColumnsProps): ColumnDef<Permission>[] => {
  const t = useTranslations('PermissionsPage.columns');
  const columns: ColumnDef<Permission>[] = [
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
      accessorKey: 'id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('id')} />
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('name')} />
      ),
    },
    {
      accessorKey: 'description',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('description')} />
      ),
    },
    {
      accessorKey: 'action',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('action')} />
      ),
      cell: ({ row }) => <Badge variant="secondary" className="capitalize">{row.getValue('action')}</Badge>
    },
    {
      accessorKey: 'resource',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('resource')} />
      ),
      cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.getValue('resource')}</Badge>
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const permission = row.original;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {canDelete && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(permission)}>
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium leading-tight">{t('delete')}</span>
            </button>}
          </div>
        );
      },
    },
  ];
  return columns;
};
