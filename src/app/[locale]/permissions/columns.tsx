
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import type { Permission } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PermissionsColumnsProps {
  onEdit: (permission: Permission) => void;
  onDelete: (permission: Permission) => void;
}

export const PermissionsColumnsWrapper = ({ onEdit, onDelete }: PermissionsColumnsProps): ColumnDef<Permission>[] => {
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(permission)}>{t('edit')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(permission)} className="text-destructive">{t('delete')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
  return columns;
};
