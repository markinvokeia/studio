
'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import type { Service } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';


interface ServicesColumnsProps {
  onDelete?: (service: Service) => void;
}

export const ServicesColumnsWrapper = ({ onDelete }: ServicesColumnsProps): ColumnDef<Service>[] => {
  const t = useTranslations('ServicesColumns');

  const columns: ColumnDef<Service>[] = [
    createSelectColumn<Service>(),
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
      accessorKey: 'category',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('category')} />
      ),
    },
    {
      accessorKey: 'price',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('price')} />
      ),
      cell: ({ row }) => `$${row.original.price}`,
    },
    {
      accessorKey: 'currency',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('currency')} />
      ),
    },
    {
      accessorKey: 'color',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('color')} />
      ),
      cell: ({ row }) => {
        const color = row.original.color;
        if (color) {
          return (
            <div className="flex items-center justify-center">
              <div
                className="w-6 h-6 rounded-md border-2 border-gray-200 shadow-sm"
                style={{ backgroundColor: color }}
                title=""
              />
            </div>
          );
        }
        return (
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 rounded-md border-2 border-gray-200 bg-gray-100" />
          </div>
        );
      },
    },
    {
      accessorKey: 'is_active',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('isActive')} />
      ),
      cell: ({ row }) => {
        const isActive = row.original.is_active;
        return (
          <Badge variant={isActive ? 'success' : 'outline'}>
            {isActive ? t('active') : t('inactive')}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const service = row.original;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onDelete && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(service)}>
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
