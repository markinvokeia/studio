'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Quote } from '@/lib/types';
import { Badge } from '../ui/badge';

const columns: ColumnDef<Quote>[] = [
    {
        accessorKey: 'id',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Quote ID" />,
    },
    {
        accessorKey: 'total',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue('total'));
            const formatted = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
            }).format(amount);
            return <div className="font-medium">{formatted}</div>;
        }
    },
    {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.getValue('status') as string;
          const variant = {
            accepted: 'success',
            confirmed: 'success',
            sent: 'default',
            pending: 'info',
            draft: 'outline',
            rejected: 'destructive',
          }[status.toLowerCase()] ?? ('default' as any);
    
          return (
            <Badge variant={variant} className="capitalize">
              {status}
            </Badge>
          );
        },
    },
    {
        accessorKey: 'payment_status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Payment" />,
         cell: ({ row }) => {
          const status = row.getValue('payment_status') as string;
          const variant = {
            paid: 'success',
            partial: 'info',
            unpaid: 'outline',
          }[status.toLowerCase()] ?? ('default'as any);
    
          return (
            <Badge variant={variant} className="capitalize">
              {status}
            </Badge>
          );
        },
    }
];

async function getQuotesForUser(userId: string): Promise<Quote[]> {
  if (!userId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_quotes?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const userQuotesData = Array.isArray(data) ? data : (data.user_quotes || data.data || data.result || []);

    return userQuotesData.map((apiQuote: any) => ({
      id: apiQuote.id ? String(apiQuote.id) : `qt_${Math.random().toString(36).substr(2, 9)}`,
      user_id: apiQuote.user_id || 'N/A',
      total: apiQuote.total || 0,
      status: apiQuote.status || 'draft',
      payment_status: apiQuote.payment_status || 'unpaid',
      createdAt: apiQuote.createdAt || new Date().toISOString().split('T')[0],
    }));
  } catch (error) {
    console.error("Failed to fetch user quotes:", error);
    return [];
  }
}

interface UserQuotesProps {
  userId: string;
}

export function UserQuotes({ userId }: UserQuotesProps) {
  const [userQuotes, setUserQuotes] = React.useState<Quote[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadQuotes() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedUserQuotes = await getQuotesForUser(userId);
      setUserQuotes(fetchedUserQuotes);
      setIsLoading(false);
    }
    loadQuotes();
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
          data={userQuotes}
          filterColumnId='id'
          filterPlaceholder='Filter by quote ID...'
        />
      </CardContent>
    </Card>
  );
}
