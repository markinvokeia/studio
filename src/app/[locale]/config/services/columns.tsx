
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import type { Service } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import React from 'react';
import { useTranslations } from 'next-intl';


interface ServicesColumnsProps {
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
}

export const ServicesColumnsWrapper = ({ onEdit, onDelete }: ServicesColumnsProps): ColumnDef<Service>[] => {
  const t = useTranslations('ServicesColumns');
  const columns: ColumnDef<Service>[] = [
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(service)}>{t('edit')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(service)} className="text-destructive">{t('delete')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return columns;
};
