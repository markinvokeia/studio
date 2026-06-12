
'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DataCard } from '@/components/ui/data-card';
import { DataListRow } from '@/components/ui/data-list-row';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { useTableViewMode } from '@/hooks/use-table-view-mode';
import { DataTable } from '@/components/ui/data-table';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { PURCHASES_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { Payment } from '@/lib/types';
import { cn, formatDisplayDate } from '@/lib/utils';
import { isPaymentEditable } from '@/services/payments-service';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { CreditCard, Download, MoreHorizontal, Pencil, Printer, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';

function HistoricalBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      {label}
    </Badge>
  );
}

const getPaymentType = (payment: Payment): { type: 'direct_payment' | 'prepaid' | 'payment_allocation' | 'credit_note_allocation'; variant: 'default' | 'secondary' | 'outline' } => {
  if (payment.transaction_type === 'credit_note_allocation') return { type: 'credit_note_allocation', variant: 'secondary' };
  if (payment.transaction_type === 'payment_allocation') return { type: 'payment_allocation', variant: 'secondary' };
  if (payment.transaction_type === 'direct_payment' && !payment.invoice_id) return { type: 'prepaid', variant: 'outline' };
  return { type: 'direct_payment', variant: 'default' };
};

const getColumns = (
  t: (key: string) => string,
  tActions: (key: string) => string,
  tPaymentMethods: (key: string) => string,
  onPrint?: (payment: Payment) => void,
  onSendEmail?: (payment: Payment) => void,
  onEdit?: (payment: Payment) => void,
  onAllocate?: (payment: Payment) => void
): ColumnDef<Payment>[] => {


  const columns: ColumnDef<Payment>[] = [
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
      accessorKey: 'user_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('user')} />
      ),
    },
    {
      accessorKey: 'invoice_doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('invoice_doc_no')} />
      ),
      cell: ({ row }) => {
        const isCreditNote = row.original.invoice_id === null;
        return isCreditNote ? 'N/A' : (row.getValue('invoice_doc_no') as string) || 'N/A';
      },
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('type')} />
      ),
      cell: ({ row }) => {
        const { type, variant } = getPaymentType(row.original);
        return (
          <Badge variant={variant}>
            {t(`paymentTypes.${type}`)}
          </Badge>
        );
      },
    },

    {
      accessorKey: 'payment_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('date')} />
      ),
      cell: ({ row }) => formatDisplayDate(row.getValue('payment_date'))
    },
    {
      accessorKey: 'amount_applied',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('amount_applied')} />
      ),
      cell: ({ row }) => {
        const amount = Math.abs(parseFloat(row.getValue('amount_applied')));
        const formatted = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
        return <div className="text-right font-medium pr-4">{formatted}</div>;
      },
    },
    {
      accessorKey: 'source_amount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('source_amount')} />
      ),
      cell: ({ row }) => {
        const amount = Math.abs(parseFloat(row.getValue('source_amount')));
        const currency = row.original.source_currency || 'USD';
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency,
        }).format(amount);
        return <div className="text-right font-medium pr-4">{formatted}</div>;
      },
    },
    {
      accessorKey: 'source_currency',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('source_currency')} />,
    },
    {
      accessorKey: 'exchange_rate',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('exchange_rate')} />,
      cell: ({ row }) => {
        const rate = parseFloat(String(row.getValue('exchange_rate')));
        return <div className="text-right pr-4">{!isNaN(rate) ? rate.toFixed(4) : 'N/A'}</div>;
      }
    },
    {
      accessorKey: 'payment_method_code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('method')} />
      ),
      cell: ({ row }) => {
        const payment = row.original;
        const methodCode = payment.payment_method_code || payment.method;

        if (!methodCode || methodCode === 'N/A') {
          return <div>N/A</div>;
        }

        // Try to get translated payment method, fallback to original value
        const translatedMethod = tPaymentMethods(methodCode) || methodCode;
        return <div className="capitalize">{translatedMethod}</div>;
      },
    },
    {
      accessorKey: 'is_historical',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('isHistorical')} />
      ),
      cell: ({ row }) => {
        const isHistorical = row.original.is_historical;
        if (!isHistorical) return null;
        return (
          <HistoricalBadge label={t('isHistorical')} />
        );
      },
    },

  ];

  if (onPrint || onSendEmail || onEdit || onAllocate) {
    columns.push({
      id: 'actions',
      cell: ({ row }) => {
        const payment = row.original;
        const isPrepaid = getPaymentType(payment).type === 'prepaid';
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
                <DropdownMenuItem onClick={() => onPrint(payment)}>
                  <Printer className="mr-2 h-4 w-4" />
                  {tActions('print')}
                </DropdownMenuItem>
              )}
              {onAllocate && isPrepaid && (
                <DropdownMenuItem onClick={() => onAllocate(payment)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>{tActions('viewAllocations')}</span>
                </DropdownMenuItem>
              )}
              {onEdit && (
                isPaymentEditable(payment) ? (
                  <DropdownMenuItem onClick={() => onEdit(payment)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>{tActions('edit')}</span>
                  </DropdownMenuItem>
                ) : null
              )}
              {onSendEmail && (
                <DropdownMenuItem onClick={() => onSendEmail(payment)}>
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

interface PaymentsTableProps {
  payments: Payment[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  columnsToHide?: string[];
  onPrint?: (payment: Payment) => void;
  onSendEmail?: (payment: Payment) => void;
  onEdit?: (payment: Payment) => void;
  onAllocate?: (payment: Payment) => void;
  onCreate?: () => void;
  className?: string;
  pagination?: PaginationState;
  onPaginationChange?: React.Dispatch<React.SetStateAction<PaginationState>>;
  pageCount?: number;
  /** Total de registros en el servidor; necesario para mostrar el total correcto con paginación manual */
  rowCount?: number;
  manualPagination?: boolean;
  /** Controlled column filters (server-side search); enables manual filtering in DataTable */
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  onRowSelectionChange?: (selectedRows: Payment[]) => void;
  rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  title?: string;
  description?: string;
  canCreate?: boolean;
  isCompact?: boolean;
  onExport?: () => void;
  isSales?: boolean;
}

export function PaymentsTable({ payments, isLoading = false, onRefresh, isRefreshing, columnsToHide = [], onPrint, onSendEmail, onEdit, onAllocate, onCreate, className, pagination, onPaginationChange, pageCount, rowCount, manualPagination = false, columnFilters, onColumnFiltersChange, onRowSelectionChange, rowSelection, setRowSelection, title, description, canCreate, isCompact = false, onExport, isSales = true }: PaymentsTableProps) {
  const t = useTranslations('PaymentsPage.columns');
  const tPage = useTranslations('PaymentsPage');
  const { hasPermission } = usePermissions();
  const tActions = useTranslations('PaymentsPage.actions');
  const tPaymentMethods = useTranslations('PaymentsPage.columns.paymentMethods');
  const { isNarrow: panelNarrow } = useNarrowMode();
  const viewportNarrow = useViewportNarrow();
  const [viewMode, setViewMode] = useTableViewMode('payments', 'table');
  const showToggle = !viewportNarrow;
  const useListView = showToggle && viewMode === 'list';
  const isNarrow = panelNarrow || viewportNarrow || useListView;
  const columns = React.useMemo(() => getColumns(t, tActions, tPaymentMethods, onPrint, onSendEmail, onEdit, onAllocate), [t, tActions, tPaymentMethods, onPrint, onSendEmail, onEdit, onAllocate]);

  const filteredColumns = columns.filter(col => !columnsToHide.includes((col as any).accessorKey));

  return (
    <Card className={cn("h-full flex-1 flex flex-col min-h-0 border-0 lg:border shadow-none lg:shadow-sm", className)}>
      {title && (
        <CardHeader className="flex-none p-4">
          <div className="flex items-start gap-3">
            <div className="header-icon-circle mt-0.5">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex flex-col text-left">
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && <CardDescription className="text-xs">{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden bg-card">
        <DataTable
          columns={filteredColumns}
          data={payments}
          isLoading={isLoading}
          filterColumnId="doc_no"
          filterPlaceholder={tPage('filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onCreate={canCreate ? () => onCreate?.() : undefined}
          createButtonLabel={tPage('createPrepaid')}
          columnTranslations={{
            doc_no: t('doc_no'),
            user_name: t('user'),
            invoice_doc_no: t('invoice_doc_no'),
            type: t('type'),
            payment_date: t('date'),
            amount_applied: t('amount_applied'),
            source_amount: t('source_amount'),
            source_currency: t('source_currency'),
            exchange_rate: t('exchange_rate'),
            payment_method_code: t('method'),
            method: t('method'),
          }}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          pageCount={pageCount}
          rowCount={rowCount}
          manualPagination={manualPagination}
          columnFilters={columnFilters}
          onColumnFiltersChange={onColumnFiltersChange}
          enableSingleRowSelection={!!onRowSelectionChange}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          onRowSelectionChange={onRowSelectionChange}
          getRowClassName={(row: Payment) => row.is_historical ? 'border-l-4 border-l-amber-400 bg-amber-50/70 dark:border-l-amber-700 dark:bg-amber-950/30' : ''}
          isNarrow={isNarrow}
          viewControls={showToggle ? <ViewModeToggle value={viewMode} onChange={setViewMode} /> : undefined}
          extraButtons={
            onExport && hasPermission(isSales ? SALES_PERMISSIONS.PAYMENTS_EXPORT : PURCHASES_PERMISSIONS.PAYMENTS_EXPORT) ? (
              <Button variant="outline" size="sm" className="h-9" onClick={onExport}>
                <Download className="mr-2 h-4 w-4" /> {tPage('export')}
              </Button>
            ) : undefined
          }
          cardListClassName={useListView ? 'gap-0 px-0 py-0 rounded-md border' : undefined}
          renderCard={(row: Payment, _isSelected: boolean) => {
            const amount = row.amount_applied != null
              ? [row.source_currency, new Intl.NumberFormat('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(row.amount_applied)))].filter(Boolean).join(' ')
              : undefined;
            const histBadge = row.is_historical ? <HistoricalBadge label={t('isHistorical')} /> : undefined;
            if (useListView) {
              return (
                <DataListRow
                  isSelected={_isSelected}
                  onClick={() => onRowSelectionChange?.([row])}
                  className={row.is_historical ? 'bg-amber-50/70 dark:bg-amber-950/30' : undefined}
                  title={row.doc_no || String(row.id)}
                  badge={histBadge}
                  meta={(
                    <>
                      {row.user_name ? <span>{row.user_name}</span> : null}
                      <span>{formatDisplayDate(row.payment_date)}</span>
                      {row.payment_method_code ? <span>{t('method')}: {row.payment_method_code}</span> : null}
                      {row.invoice_doc_no ? <span>{t('invoice_doc_no')}: {row.invoice_doc_no}</span> : null}
                      {amount ? <span className="font-medium text-foreground">{t('amount_applied')}: {amount}</span> : null}
                    </>
                  )}
                />
              );
            }
            return (
              <DataCard isSelected={_isSelected}
                className={row.is_historical ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30' : undefined}
                title={row.doc_no || String(row.id)}
                subtitle={[
                  row.user_name,
                  formatDisplayDate(row.payment_date),
                  amount,
                  row.payment_method_code,
                ].filter(Boolean).join(' · ')}
                badge={histBadge}
                showArrow
                onClick={() => onRowSelectionChange?.([row])}
              />
            );
          }}
        />
      </CardContent>
    </Card>
  );
}
