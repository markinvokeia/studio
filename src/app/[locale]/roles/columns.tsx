
'use client';

import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Role } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface RolesColumnsProps {
  onDelete: (role: Role) => void;
  canDelete?: boolean;
}

export const RolesColumnsWrapper = ({ onDelete, canDelete = true }: RolesColumnsProps): ColumnDef<Role>[] => {
  const t = useTranslations('RolesColumns');

  const columns: ColumnDef<Role>[] = [
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
        <DataTableColumnHeader column={column} title={t('roleId')} />
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('name')} />
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {canDelete && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(role)}>
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
