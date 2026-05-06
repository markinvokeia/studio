'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { CreditNote } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { ColumnDef, PaginationState } from '@tanstack/react-table';
import { MoreHorizontal, Printer, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Skeleton } from '../ui/skeleton';

const getColumns = (
  t: (key: string) => string,
  tActions: (key: string) => string,
  onPrint?: (creditNote: CreditNote) => void,
  onSendEmail?: (creditNote: CreditNote) => void
): ColumnDef<CreditNote>[] => {

  const columns: ColumnDef<CreditNote>[] = [
    {
      accessorKey: 'doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('doc_no')} />
      ),
      cell: ({ row }) => {
        const docNo = row.getValue('doc_no') as string;
        return docNo || 'N/A';
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('date')} />
      ),
      cell: ({ row }) => {
        const date = row.getValue('createdAt');
        if (!date) return 'N/A';
        return formatDateTime(String(date));
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('total')} />
      ),
      cell: ({ row }) => {
        const amount = Math.abs(parseFloat(String(row.getValue('total'))));
        const formatted = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
        return <div className="text-right font-medium pr-4">{formatted}</div>;
      },
    },
    {
      accessorKey: 'currency',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('currency')} />
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('status')} />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        let variant: 'default' | 'secondary' | 'outline' | 'destructive' = 'outline';
        
        switch (status) {
          case 'booked':
          case 'paid':
            variant = 'default';
            break;
          case 'draft':
            variant = 'secondary';
            break;
          case 'overdue':
            variant = 'destructive';
            break;
          default:
            variant = 'outline';
        }
        
        return (
          <Badge variant={variant}>
            {t(`statuses.${status}`)}
          </Badge>
        );
      },
    },
  ];

  if (onPrint || onSendEmail) {
    columns.push({
      id: 'actions',
      cell: ({ row }) => {
        const creditNote = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{tActions('openMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tActions('title')}</DropdownMenuLabel>
              {onPrint && (
                <DropdownMenuItem onClick={() => onPrint(creditNote)}>
                  <Printer className="mr-2 h-4 w-4" />
                  {tActions('print')}
                </DropdownMenuItem>
              )}
              {onSendEmail && (
                <DropdownMenuItem onClick={() => onSendEmail(creditNote)}>
                  <Send className="mr-2 h-4 w-4" />
                  <span>{tActions('sendEmail')}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    });
  }

  return columns;
};

interface CreditNotesTableProps {
  creditNotes: CreditNote[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onPrint?: (creditNote: CreditNote) => void;
  onSendEmail?: (creditNote: CreditNote) => void;
  className?: string;
  pagination?: PaginationState;
  onPaginationChange?: React.Dispatch<React.SetStateAction<PaginationState>>;
  pageCount?: number;
  manualPagination?: boolean;
}

export function CreditNotesTable({ creditNotes, isLoading = false, onRefresh, isRefreshing, onPrint, onSendEmail, className, pagination, onPaginationChange, pageCount, manualPagination = false }: CreditNotesTableProps) {
  const t = useTranslations('InvoicesPage.creditNotesTable');
  const tActions = useTranslations('InvoicesPage.actions');
  const { isNarrow: panelNarrow } = useNarrowMode();
  const viewportNarrow = useViewportNarrow();
  const isNarrow = panelNarrow || viewportNarrow;
  const columns = React.useMemo(() => getColumns(t, tActions, onPrint, onSendEmail), [t, tActions, onPrint, onSendEmail]);

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <Card className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
      <CardContent className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden">
        <DataTable
          columns={columns}
          data={creditNotes}
          filterColumnId="doc_no"
          filterPlaceholder={t('filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          columnTranslations={{
            doc_no: t('doc_no'),
            createdAt: t('date'),
            total: t('total'),
            currency: t('currency'),
            status: t('status'),
          }}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          pageCount={pageCount}
          manualPagination={manualPagination}
          isNarrow={isNarrow}
          renderCard={(creditNote: CreditNote) => (
            <DataCard
              title={creditNote.doc_no || String(creditNote.id)}
              subtitle={[
                creditNote.createdAt ? formatDateTime(creditNote.createdAt) : null,
                creditNote.currency || null,
                creditNote.status ? t(`statuses.${creditNote.status}`) : null,
              ].filter(Boolean).join(' · ')}
              badge={
                creditNote.total != null ? (
                  <Badge variant="outline">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: creditNote.currency || 'USD',
                    }).format(Math.abs(Number(creditNote.total)))}
                  </Badge>
                ) : undefined
              }
            />
          )}
        />
      </CardContent>
    </Card>
  );
}
