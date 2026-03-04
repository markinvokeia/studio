'use client';

import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { InvoiceAllocation } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Badge } from '../ui/badge';

interface AllocationsTableProps {
  allocations: InvoiceAllocation[];
  isLoading: boolean;
}

const getColumns = (t: (key: string) => string): ColumnDef<InvoiceAllocation>[] => {
  const columns: ColumnDef<InvoiceAllocation>[] = [
    {
      accessorKey: 'destino_doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('destino_doc_no')} />
      ),
      cell: ({ row }) => {
        const docNo = row.getValue('destino_doc_no') as string;
        return docNo || 'N/A';
      },
    },
    {
      accessorKey: 'destino_tipo',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('destino_tipo')} />
      ),
      cell: ({ row }) => {
        const tipo = row.getValue('destino_tipo') as string;
        return (
          <Badge variant="outline">
            {t(`documentTypes.${tipo}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'monto_asignado',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('monto_asignado')} />
      ),
      cell: ({ row }) => {
        const monto = row.getValue('monto_asignado') as string;
        const moneda = row.original.moneda;
        const numMonto = parseFloat(monto);
        return `${moneda} ${numMonto.toFixed(2)}`;
      },
    },
    {
      accessorKey: 'tipo_cambio',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tipo_cambio')} />
      ),
      cell: ({ row }) => {
        const cambio = row.getValue('tipo_cambio') as string;
        return parseFloat(cambio).toFixed(4);
      },
    },
    {
      accessorKey: 'monto_en_destino',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('monto_en_destino')} />
      ),
      cell: ({ row }) => {
        const monto = row.getValue('monto_en_destino') as string;
        return parseFloat(monto).toFixed(2);
      },
    },
    {
      accessorKey: 'fecha_asignacion',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('fecha_asignacion')} />
      ),
      cell: ({ row }) => formatDateTime(row.getValue('fecha_asignacion')),
    },
  ];

  return columns;
};

export function AllocationsTable({ allocations, isLoading }: AllocationsTableProps) {
  const tMain = useTranslations('InvoicesPage.AllocationsTable');

  const columns = React.useMemo(() => getColumns(tMain), [tMain]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-8 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (allocations.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        {tMain('empty')}
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={allocations}
    />
  );
}
