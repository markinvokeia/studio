
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { MiscellaneousCategory } from '@/lib/types';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface MiscellaneousCategoriesColumnsProps {
  onEdit: (category: MiscellaneousCategory) => void;
  onDelete: (category: MiscellaneousCategory) => void;
}

export const MiscellaneousCategoriesColumnsWrapper = ({ onEdit, onDelete }: MiscellaneousCategoriesColumnsProps): ColumnDef<MiscellaneousCategory>[] => {
  const t = useTranslations('MiscellaneousCategoriesPage.columns');

  const columns: ColumnDef<MiscellaneousCategory>[] = [
    createSelectColumn<MiscellaneousCategory>(),
    { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('id')} /> },
    { accessorKey: 'code', header: ({ column }) => <DataTableColumnHeader column={column} title={t('code')} /> },
    { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('name')} /> },
    { accessorKey: 'description', header: ({ column }) => <DataTableColumnHeader column={column} title={t('description')} /> },
    {
      accessorKey: 'type',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('type')} />,
      cell: ({ row }) => {
        const type = row.original.type;
        return <Badge variant={type === 'income' ? 'success' : 'destructive'} className="capitalize">{t(type)}</Badge>
      }
    },
    {
      accessorKey: 'is_active',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('isActive')} />,
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'destructive'}>{row.original.is_active ? t('yes') : t('no')}</Badge>
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const category = row.original;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(category)}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
          </button>
          <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(category)}>
            <Trash2 className="h-3.5 w-3.5" />
            <span className="text-[9px] font-medium leading-tight">{t('delete')}</span>
          </button>
          </div>
        );
      },
    },
  ];
  return columns;
}
