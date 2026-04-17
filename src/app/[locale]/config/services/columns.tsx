
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import type { Service } from '@/lib/types';
import { Pencil, Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';


interface ServicesColumnsProps {
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
}

export const ServicesColumnsWrapper = ({ onEdit, onDelete }: ServicesColumnsProps): ColumnDef<Service>[] => {
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
      accessorKey: 'duration_minutes',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('duration')} />
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const service = row.original;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(service)}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
            </button>
            <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(service)}>
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium leading-tight">{t('delete')}</span>
            </button>
            </div>
          );
      },
    },
  ];

  return columns;
};
