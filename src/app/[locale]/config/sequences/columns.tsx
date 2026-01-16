'use client';

import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sequence } from '@/lib/types';
import { generateSequenceNumber } from '@/lib/sequence-utils';
import { ColumnDef } from '@tanstack/react-table';
import { Edit, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SequencesColumnsProps {
  onEdit: (sequence: Sequence) => void;
  onDelete: (sequence: Sequence) => void;
}

export function SequencesColumnsWrapper({ onEdit, onDelete }: SequencesColumnsProps) {
  const t = useTranslations('SequencesPage');

  const columns: ColumnDef<Sequence>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.name')} />
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue('name')}</div>
      ),
    },
    {
      accessorKey: 'document_type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.documentType')} />
      ),
      cell: ({ row }) => (
        <div>{t(`documentTypes.${row.getValue('document_type')}` as any)}</div>
      ),
    },
    {
      accessorKey: 'pattern',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.pattern')} />
      ),
      cell: ({ row }) => {
        const sequence = row.original;
        const pattern = row.getValue('pattern') as string || sequence.pattern;
        
        if (!pattern) {
          return (
            <div className="max-w-xs">
              <code className="text-xs bg-muted px-2 py-1 rounded">
                -
              </code>
            </div>
          );
        }
        
        return (
          <div className="max-w-xs">
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {pattern}
            </code>
            <div className="text-xs text-muted-foreground mt-1">
              {t('createDialog.previewExample')}
              {generateSequenceNumber(
                pattern,
                sequence.current_counter || 1,
                sequence.document_type || 'invoice'
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'current_counter',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.currentCounter')} />
      ),
      cell: ({ row }) => (
        <div className="text-center">{row.getValue('current_counter')}</div>
      ),
    },
    {
      accessorKey: 'reset_period',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.resetPeriod')} />
      ),
      cell: ({ row }) => (
        <div>{t(`resetPeriods.${row.getValue('reset_period')}` as any)}</div>
      ),
    },
    {
      accessorKey: 'is_active',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.isActive')} />
      ),
      cell: ({ row }) => (
        <Switch
          checked={row.getValue('is_active')}
          disabled
          aria-label={t('columns.isActive')}
        />
      ),
    },
    {
      id: 'actions',
      header: t('columns.actions'),
      cell: ({ row }) => {
        const sequence = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(sequence)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
              <span className="sr-only">{t('columns.edit')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(sequence)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">{t('columns.delete')}</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return columns;
}