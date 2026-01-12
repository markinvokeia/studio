
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { MiscellaneousCategory } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

interface MiscellaneousCategoriesColumnsProps {
  onEdit: (category: MiscellaneousCategory) => void;
  onDelete: (category: MiscellaneousCategory) => void;
}

export const MiscellaneousCategoriesColumnsWrapper = ({ onEdit, onDelete }: MiscellaneousCategoriesColumnsProps): ColumnDef<MiscellaneousCategory>[] => {
  const t = useTranslations('MiscellaneousCategoriesPage.columns');

  const columns: ColumnDef<MiscellaneousCategory>[] = [
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t('openMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(category)}>{t('edit')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(category)} className="text-destructive">{t('delete')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
  return columns;
}
