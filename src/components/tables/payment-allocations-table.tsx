'use client';

import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { PaymentAllocation } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Badge } from '../ui/badge';

interface PaymentAllocationsTableProps {
  allocations: PaymentAllocation[];
  isLoading: boolean;
}

const getColumns = (t: (key: string) => string): ColumnDef<PaymentAllocation>[] => {
  const columns: ColumnDef<PaymentAllocation>[] = [
    {
      accessorKey: 'factura_doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('factura_doc_no')} />
      ),
      cell: ({ row }) => {
        const docNo = row.getValue('factura_doc_no') as string;
        return docNo || 'N/A';
      },
    },
    {
      accessorKey: 'factura_tipo',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('factura_tipo')} />
      ),
      cell: ({ row }) => {
        const tipo = row.getValue('factura_tipo') as string;
        return (
          <Badge variant="outline">
            {t(`documentTypes.${tipo}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'moneda_factura',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('moneda_factura')} />
      ),
    },
    {
      accessorKey: 'monto_desde_pago',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('monto_desde_pago')} />
      ),
      cell: ({ row }) => {
        const monto = row.getValue('monto_desde_pago') as string;
        const moneda = row.original.moneda_pago;
        const numMonto = parseFloat(monto);
        return (
          <div className="text-right">
            {moneda} {numMonto.toFixed(2)}
          </div>
        );
      },
    },
    {
      accessorKey: 'tipo_cambio',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tipo_cambio')} />
      ),
      cell: ({ row }) => {
        const cambio = row.getValue('tipo_cambio') as string;
        return parseFloat(cambio || '0').toFixed(4);
      },
    },
    {
      accessorKey: 'monto_aplicado_a_factura',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('monto_aplicado_a_factura')} />
      ),
      cell: ({ row }) => {
        const monto = row.getValue('monto_aplicado_a_factura') as string;
        const moneda = row.original.moneda_allocation;
        const numMonto = parseFloat(monto);
        return (
          <div className="text-right font-medium">
            {moneda} {numMonto.toFixed(2)}
          </div>
        );
      },
    },
    {
      accessorKey: 'fecha_aplicacion',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('fecha_aplicacion')} />
      ),
      cell: ({ row }) => formatDateTime(row.getValue('fecha_aplicacion')),
    },
  ];

  return columns;
};

export function PaymentAllocationsTable({ allocations, isLoading }: PaymentAllocationsTableProps) {
  const tMain = useTranslations('PaymentsPage.PaymentAllocationsTable');

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
