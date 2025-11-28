
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Invoice } from '@/lib/types';
import { Badge } from '../ui/badge';
import { useTranslations } from 'next-intl';

const getColumns = (t: (key: string) => string, tStatus: (key: string) => string): ColumnDef<Invoice>[] => [
  {
    accessorKey: 'id',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.invoiceId')} />,
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.total')} />,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('total'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: row.original.currency || 'USD',
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.status')} />,
    cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const variant = {
        paid: 'success',
        sent: 'default',
        draft: 'outline',
        overdue: 'destructive',
        }[status?.toLowerCase()] ?? ('default' as any);
        return <Badge variant={variant} className="capitalize">{tStatus(status.toLowerCase())}</Badge>;
    },
  },
  {
    accessorKey: 'payment_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.payment')} />,
    cell: ({ row }) => {
        const status = row.original.payment_status;
        const variant = {
        paid: 'success',
        partial: 'info',
        unpaid: 'outline',
        partially_paid: 'info'
        }[status?.toLowerCase() ?? ('default' as any)];
        return <Badge variant={variant} className="capitalize">{status ? tStatus(status.toLowerCase()) : ''}</Badge>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.createdAt')} />,
  },
];

async function getInvoicesForUser(userId: string): Promise<Invoice[]> {
  if (!userId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_invoices?user_id=${userId}`);
    if (!response.ok) throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    const data = await response.json();
    const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);
    return invoicesData.map((apiInvoice: any) => ({
      id: apiInvoice.id.toString(),
      order_id: apiInvoice.order_id?.toString() ?? '',
      quote_id: apiInvoice.quote_id?.toString() ?? '',
      user_name: '', // Not needed for this view
      total: parseFloat(apiInvoice.total),
      status: apiInvoice.status,
      payment_status: apiInvoice.payment_state,
      createdAt: apiInvoice.created_at,
      updatedAt: apiInvoice.updated_at,
      currency: apiInvoice.currency,
    }));
  } catch (error) {
    console.error("Failed to fetch user invoices:", error);
    return [];
  }
}

interface UserInvoicesProps {
  userId: string;
}

export function UserInvoices({ userId }: UserInvoicesProps) {
  const t = useTranslations();
  const tStatus = useTranslations('InvoicesPage.status');
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const columns = React.useMemo(() => getColumns(t, tStatus), [t, tStatus]);

  React.useEffect(() => {
    async function loadInvoices() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedInvoices = await getInvoicesForUser(userId);
      setInvoices(fetchedInvoices);
      setIsLoading(false);
    }
    loadInvoices();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={invoices}
          filterColumnId='id'
          filterPlaceholder={t('InvoicesPage.filterPlaceholder')}
        />
      </CardContent>
    </Card>
  );
}
