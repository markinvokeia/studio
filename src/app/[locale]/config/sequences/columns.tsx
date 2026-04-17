'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { generateSequenceNumber } from '@/lib/sequence-utils';
import { Sequence } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface SequencesColumnsProps {
  onEdit: (sequence: Sequence) => void;
  onDelete: (sequence: Sequence) => void;
}

export function SequencesColumnsWrapper({ onEdit, onDelete }: SequencesColumnsProps) {
  const t = useTranslations('SequencesPage');

  const columns: ColumnDef<Sequence>[] = [
    createSelectColumn<Sequence>(),
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
        <Badge variant={row.getValue('is_active') ? 'default' : 'outline'}>
          {row.getValue('is_active') ? t('active') : t('inactive')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('columns.actions'),
      cell: ({ row }) => {
        const sequence = row.original;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(sequence)}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium leading-tight">{t('columns.edit')}</span>
            </button>
            <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(sequence)}>
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium leading-tight">{t('columns.delete')}</span>
            </button>
          </div>
        );
      },
    },
  ];

  return columns;
}