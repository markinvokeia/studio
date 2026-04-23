'use client';

import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { API_ROUTES } from '@/constants/routes';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { useToast } from '@/hooks/use-toast';
import { DataCard } from '@/components/ui/data-card';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { Quote } from '@/lib/types';
import { cn, formatDateTime, getDocumentFileName } from '@/lib/utils';
import { api } from '@/services/api';
import { ColumnDef, ColumnFiltersState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, RowSelectionState, SortingState, useReactTable } from '@tanstack/react-table';
import { CheckCircle, Loader2, Pencil, Printer, Send, Trash2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { DocumentTextIcon } from '../icons/document-text-icon';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DataTablePagination } from '../ui/data-table-pagination';
import { DataTableToolbar } from '../ui/data-table-toolbar';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface QuoteActionsProps {
  quote: Quote;
  onEdit: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
  onQuoteActionRequest: (quote: Quote, action: 'confirm' | 'reject') => void;
  onPrint: (quote: Quote) => void;
  onSendEmail: (quote: Quote) => void;
  canEdit: boolean;
  canDelete: boolean;
  canConfirm: boolean;
  canReject: boolean;
  canPrint: boolean;
  canSendEmail: boolean;
}

function QuoteActions({
  quote,
  onEdit,
  onDelete,
  onQuoteActionRequest,
  onPrint,
  onSendEmail,
  canEdit,
  canDelete,
  canConfirm,
  canReject,
  canPrint,
  canSendEmail,
}: QuoteActionsProps) {
  const tQuotes = useTranslations('QuotesPage');
  const status = (quote.status || '').toLowerCase();
  const isDraft = status === 'draft';
  const isPending = status === 'pending';

  const actions = [
    { icon: Printer, label: tQuotes('print'), onClick: () => onPrint(quote), disabled: false, destructive: false, visible: canPrint },
    { icon: Send, label: tQuotes('sendEmail'), onClick: () => onSendEmail(quote), disabled: false, destructive: false, visible: canSendEmail },
    { icon: Pencil, label: tQuotes('edit'), onClick: () => onEdit(quote), disabled: !isDraft, destructive: false, visible: canEdit },
    { icon: CheckCircle, label: tQuotes('confirm'), onClick: () => onQuoteActionRequest(quote, 'confirm'), disabled: !isDraft && !isPending, destructive: false, visible: canConfirm },
    { icon: XCircle, label: tQuotes('reject'), onClick: () => onQuoteActionRequest(quote, 'reject'), disabled: !isDraft && !isPending, destructive: true, visible: canReject },
    { icon: Trash2, label: tQuotes('delete'), onClick: () => onDelete(quote), disabled: !isDraft, destructive: true, visible: canDelete },
  ].filter((action) => action.visible);

  if (actions.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {actions.map(({ icon: Icon, label, onClick, disabled, destructive }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className={cn(
            'flex min-w-[44px] flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35',
            destructive && 'hover:bg-destructive/10 hover:text-destructive',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="max-w-[48px] truncate text-[9px] font-medium leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}

const getColumns = (
  t: (key: string) => string,
  onEdit: (quote: Quote) => void,
  onDelete: (quote: Quote) => void,
  onQuoteActionRequest: (quote: Quote, action: 'confirm' | 'reject') => void,
  onPrint: (quote: Quote) => void,
  onSendEmail: (quote: Quote) => void,
  isCompact: boolean = false,
  actionPermissions: QuoteActionPermissions,
): ColumnDef<Quote>[] => {
  const columns: ColumnDef<Quote>[] = [
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
      size: 20,
    },
    {
      accessorKey: 'doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('OrderColumns.orderId')} />
      ),
      size: 50,
    },
    {
      accessorKey: 'user_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('UserColumns.name')} />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.createdAt')} />
      ),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.total')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('total'));
        const roundedAmount = Math.round(amount * 100) / 100;
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: row.original.currency || 'USD',
        }).format(roundedAmount);
        return <div className="font-medium">{formatted}</div>;
      },
      enableHiding: !isCompact,
    },
    {
      accessorKey: 'currency',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.currency')} />
      ),
      cell: ({ row }) => row.original.currency || 'N/A',
      enableHiding: !isCompact,
    },
    {
      accessorKey: 'exchange_rate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.exchangeRate')} />
      ),
      cell: ({ row }) => {
        const rate = row.original.exchange_rate;
        return rate ? <div className="font-medium">{rate.toFixed(2)}</div> : <div className="text-muted-foreground">-</div>;
      },
      enableHiding: !isCompact,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('UserColumns.status')} />
      ),
      cell: ({ row }) => {
        const status = (row.getValue('status') as string) || '';
        const variant = {
          accepted: 'success',
          confirmed: 'success',
          sent: 'default',
          pending: 'info',
          draft: 'outline',
          rejected: 'destructive',
        }[status.toLowerCase()] ?? ('default' as any);

        const translationKey = `QuotesPage.quoteDialog.${status.toLowerCase()}`;
        const translatedStatus = t(translationKey as any);

        return (
          <Badge variant={variant} className="capitalize">
            {translatedStatus === translationKey ? status : translatedStatus}
          </Badge>
        );
      },
      enableHiding: !isCompact,
    },
    {
      accessorKey: 'billing_status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.billingStatus')} />
      ),
      cell: ({ row }) => {
        const status = (row.getValue('billing_status') as string) || '';

        const statusKeyMap: { [key: string]: string } = {
          'invoiced': 'invoiced',
          'partially invoiced': 'partiallyInvoiced',
          'not invoiced': 'notInvoiced',
          'partially_invoiced': 'partially_invoiced',
          'not_invoiced': 'not_invoiced',
        };
        const variantMap: { [key: string]: any } = {
          'invoiced': 'success',
          'partially invoiced': 'info',
          'not invoiced': 'outline',
          'partially_invoiced': 'info',
          'not_invoiced': 'outline',
        };

        const normalizedStatus = status.toLowerCase();
        const translationKey = `QuotesPage.quoteDialog.${statusKeyMap[normalizedStatus] || normalizedStatus.replace(/\s+/g, '_')}`;
        const translatedStatus = t(translationKey as any);

        return (
          <Badge variant={variantMap[normalizedStatus] ?? 'default'} className="capitalize">
            {translatedStatus === translationKey ? status : translatedStatus}
          </Badge>
        );
      },
      enableHiding: !isCompact,
    },
    {
      accessorKey: 'payment_status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Navigation.Payments')} />
      ),
      cell: ({ row }) => {
        const status = (row.getValue('payment_status') as string) || '';
        const variant = {
          paid: 'success',
          partial: 'info',
          unpaid: 'outline',
          partially_paid: 'info',
          'not invoiced': 'outline',
          'not_invoiced': 'outline',
        }[status.toLowerCase()] ?? ('default' as any);

        const statusKeyMap: { [key: string]: string } = {
          'partially_paid': 'partiallyPaid',
          'unpaid': 'unpaid',
          'not_paid': 'not_paid',
          'paid': 'paid',
          'partial': 'partial',
          'not invoiced': 'notInvoiced',
          'not_invoiced': 'not_invoiced',
        };

        const normalizedStatus = status.toLowerCase();
        const translationKey = `QuotesPage.quoteDialog.${statusKeyMap[normalizedStatus] || normalizedStatus.replace(/\s+/g, '_')}`;
        const translatedStatus = t(translationKey as any);

        return (
          <Badge variant={variant} className="capitalize">
            {translatedStatus === translationKey ? status : translatedStatus}
          </Badge>
        );
      },
      enableHiding: !isCompact,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const quote = row.original;

        return (
          <QuoteActions
            quote={quote}
            onEdit={onEdit}
            onDelete={onDelete}
            onQuoteActionRequest={onQuoteActionRequest}
            onPrint={onPrint}
            onSendEmail={onSendEmail}
            {...actionPermissions}
          />
        );
      },
      enableHiding: false,
      size: 300,
    },
  ];
  return columns.filter((column) => !isCompact || column.id !== 'actions');
};


interface RecentQuotesTableProps {
  quotes: Quote[];
  onRowSelectionChange?: (selectedRows: Quote[]) => void;
  onRowClick?: (quote: Quote) => void;
  onCreate?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  onEdit?: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
  onQuoteActionRequest?: (quote: Quote, action: 'confirm' | 'reject') => void;
  className?: string;
  isCompact?: boolean;
  title?: string;
  description?: string;
  standalone?: boolean;
  isSendingEmail?: boolean;
  setIsSendingEmail?: (sending: boolean) => void;
  isSales?: boolean;
  canEditQuote?: boolean;
  canDeleteQuote?: boolean;
  canConfirmQuote?: boolean;
  canRejectQuote?: boolean;
  canPrintQuote?: boolean;
  canSendQuoteEmail?: boolean;
}

interface QuoteActionPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canConfirm: boolean;
  canReject: boolean;
  canPrint: boolean;
  canSendEmail: boolean;
}

export function RecentQuotesTable({
  quotes,
  onRowSelectionChange,
  onRowClick,
  onCreate,
  onRefresh,
  isRefreshing,
  rowSelection,
  setRowSelection,
  onEdit = () => { },
  onDelete = () => { },
  onQuoteActionRequest = () => { },
  className,
  isCompact = false,
  title,
  description,
  standalone = false,
  isSendingEmail = false,
  setIsSendingEmail,
  isSales = false,
  canEditQuote = false,
  canDeleteQuote = false,
  canConfirmQuote = false,
  canRejectQuote = false,
  canPrintQuote = true,
  canSendQuoteEmail = true,
}: RecentQuotesTableProps) {
  const { isNarrow: panelNarrow } = useNarrowMode();
  const viewportNarrow = useViewportNarrow();
  const isNarrow = isCompact || panelNarrow || viewportNarrow;
  const t = useTranslations();
  const { toast } = useToast();
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = React.useState<Quote | null>(null);
  const [emailRecipients, setEmailRecipients] = React.useState('');
  const [isWarningDialogOpen, setIsWarningDialogOpen] = React.useState(false);
  const [disabledEmails, setDisabledEmails] = React.useState<string[]>([]);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const handlePrintQuote = React.useCallback(async (quote: Quote) => {
    const fileName = getDocumentFileName(quote, 'quote');
    toast({
      title: t('QuotesPage.generatingPdf'),
      description: t('QuotesPage.pleaseWait', { id: fileName }),
    });

    try {
      const blob = await api.getBlob(API_ROUTES.PURCHASES.QUOTES_PRINT, { quote_id: quote.id.toString() });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({
        title: t('QuotesPage.downloadStarted'),
        description: t('QuotesPage.pdfDownloading', { id: fileName }),
      });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('QuotesPage.printError'),
        description: error instanceof Error ? error.message : t('QuotesPage.couldNotPrint'),
      });
    }
  }, [t, toast]);

  const handleSendEmailClick = (quote: Quote) => {
    setSelectedQuoteForEmail(quote);
    setEmailRecipients(quote.userEmail || '');
    setIsSendEmailDialogOpen(true);
  };

  const handleConfirmSendEmail = async () => {
    if (!selectedQuoteForEmail) return;

    const emails = emailRecipients.split(',').map(email => email.trim()).filter(email => email);
    if (emails.length === 0) {
      toast({ variant: 'destructive', title: t('QuotesPage.emailError'), description: t('QuotesPage.atLeastOneEmail') });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      toast({
        variant: 'destructive',
        title: t('QuotesPage.invalidEmail'),
        description: t('QuotesPage.invalidEmails', { emails: invalidEmails.join(', ') }),
      });
      return;
    }

    const preferences = await checkPreferencesByEmails(emails, 'email', 'billing');
    const disabled = getDisabledEmails(preferences);

    if (disabled.length > 0) {
      setDisabledEmails(disabled);
      setIsWarningDialogOpen(true);
      return;
    }

    await sendEmail(emails);
  };

  const sendEmail = async (emails: string[]) => {
    if (!selectedQuoteForEmail) return;

    const handleSetSending = (sending: boolean) => {
      if (setIsSendingEmail) {
        setIsSendingEmail(sending);
      }
    };

    handleSetSending(true);
    try {
      await api.post(API_ROUTES.PURCHASES.QUOTES_SEND, {
        quote_id: selectedQuoteForEmail.id,
        is_sales: isSales,
        emails,
      });

      toast({
        title: t('QuotesPage.emailSent'),
        description: t('QuotesPage.emailSentSuccess', { emails: emails.join(', ') }),
      });

      setIsSendEmailDialogOpen(false);

    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('QuotesPage.emailError'),
        description: error instanceof Error ? error.message : t('QuotesPage.unexpectedError'),
      });
    } finally {
      handleSetSending(false);
    }
  };

  const handleWarningConfirm = async () => {
    if (!selectedQuoteForEmail) return;
    const emails = emailRecipients.split(',').map(email => email.trim()).filter(email => email);
    await sendEmail(emails);
    setIsWarningDialogOpen(false);
  };

  const actionPermissions = React.useMemo<QuoteActionPermissions>(() => ({
    canEdit: canEditQuote,
    canDelete: canDeleteQuote,
    canConfirm: canConfirmQuote,
    canReject: canRejectQuote,
    canPrint: canPrintQuote,
    canSendEmail: canSendQuoteEmail,
  }), [canEditQuote, canDeleteQuote, canConfirmQuote, canRejectQuote, canPrintQuote, canSendQuoteEmail]);

  const columns = React.useMemo(
    () => getColumns(t, onEdit, onDelete, onQuoteActionRequest, handlePrintQuote, handleSendEmailClick, isCompact, actionPermissions),
    [t, onEdit, onDelete, onQuoteActionRequest, handlePrintQuote, isCompact, actionPermissions],
  );

  const table = useReactTable({
    data: quotes,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection: rowSelection ?? {},
    },
    enableRowSelection: true,
    enableMultiRowSelection: !true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Hide columns when isCompact is true
  React.useEffect(() => {
    if (isCompact) {
      // Hide the columns that will be shown in detail header
      const columnsToHide = ['total', 'currency', 'exchange_rate', 'status', 'billing_status', 'payment_status'];
      columnsToHide.forEach(colId => {
        const column = table.getColumn(colId);
        if (column) {
          column.toggleVisibility(false);
        }
      });
    } else {
      // Show all columns when not compact
      const columnsToShow = ['total', 'currency', 'exchange_rate', 'status', 'billing_status', 'payment_status'];
      columnsToShow.forEach(colId => {
        const column = table.getColumn(colId);
        if (column) {
          column.toggleVisibility(true);
        }
      });
    }
  }, [isCompact, table]);

  React.useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
      onRowSelectionChange(selectedRows);
    }
  }, [rowSelection, table, onRowSelectionChange]);


  const columnTranslations = {
    id: t('QuoteColumns.quoteId'),
    user_name: t('UserColumns.name'),
    createdAt: t('QuoteColumns.createdAt'),
    total: t('QuoteColumns.total'),
    currency: t('QuoteColumns.currency'),
    exchange_rate: t('QuoteColumns.exchangeRate'),
    status: t('UserColumns.status'),
    billing_status: t('QuoteColumns.billingStatus'),
    payment_status: t('Navigation.Payments'),
  };

  return (
    <>
      <Card className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
        {title && (
          <CardHeader className="flex-none p-4 pb-2">
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <DocumentTextIcon className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <CardTitle className="text-lg">{title}</CardTitle>
                {description && <CardDescription className="text-xs">{description}</CardDescription>}
              </div>
            </div>
          </CardHeader>
        )}
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden pt-2">
          {isNarrow ? (
            <div className="flex flex-col gap-2 overflow-auto flex-1 min-h-0 px-0.5 py-0.5">
              {table.getRowModel().rows.length > 0
                ? table.getRowModel().rows.map((row) => (
                  <DataCard
                      key={row.id}
                      title={row.original.doc_no || String(row.original.id)}
                      subtitle={[row.original.user_name, row.original.status].filter(Boolean).join(' · ')}
                      isSelected={row.getIsSelected()}
                      showArrow={!!(onRowClick || onRowSelectionChange)}
                      actions={!isCompact && !viewportNarrow ? (
                        <QuoteActions
                          quote={row.original}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onQuoteActionRequest={onQuoteActionRequest}
                          onPrint={handlePrintQuote}
                          onSendEmail={handleSendEmailClick}
                          {...actionPermissions}
                        />
                      ) : undefined}
                      onClick={() => {
                        table.toggleAllPageRowsSelected(false);
                        row.toggleSelected(true);
                        onRowSelectionChange?.([row.original]);
                        onRowClick?.(row.original);
                      }}
                    />
                  ))
                : <div className="py-8 text-center text-sm text-muted-foreground">{t('General.noResults')}</div>
              }
            </div>
          ) : (
          <div className="flex flex-col flex-1 min-h-0 space-y-4 overflow-hidden">
            {standalone ? (
              <DataTableAdvancedToolbar
                table={table}
                isCompact={isCompact}
                filterPlaceholder={t('RecentQuotesTable.filterPlaceholder')}
                searchQuery={(columnFilters.find(f => f.id === 'user_name')?.value as string) || ''}
                onSearchChange={(value) => {
                  setColumnFilters((prev) => {
                    const newFilters = prev.filter((f) => f.id !== 'user_name');
                    if (value) {
                      newFilters.push({ id: 'user_name', value });
                    }
                    return newFilters;
                  });
                }}
                onCreate={onCreate}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                columnTranslations={columnTranslations}
              />
            ) : (
              <DataTableToolbar
                table={table}
                filterColumnId="user_name"
                filterPlaceholder={t('RecentQuotesTable.filterPlaceholder')}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                onCreate={onCreate}
                columnTranslations={columnTranslations}
              />
            )}
            <div className="rounded-md border overflow-auto flex-1 min-h-0 relative">
              <table className={cn("w-full caption-bottom text-sm")}>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined }}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        onClick={() => {
                          if (onRowSelectionChange) {
                            table.toggleAllPageRowsSelected(false);
                            row.toggleSelected(true);
                          }
                          onRowClick?.(row.original);
                        }}
                        className={onRowSelectionChange || onRowClick ? 'cursor-pointer' : ''}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        {t('General.noResults')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </table>
            </div>
            <div className="flex-none">
              <DataTablePagination table={table} />
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('QuotesPage.sendEmailDialog.title')}</DialogTitle>
            <DialogDescription>{t('QuotesPage.sendEmailDialog.description', { id: selectedQuoteForEmail?.doc_no || selectedQuoteForEmail?.id })}</DialogDescription>
          </DialogHeader>
          <div className="py-4 px-6">
            <Label htmlFor="email-recipients">{t('QuotesPage.sendEmailDialog.recipients')}</Label>
            <Input
              id="email-recipients"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder={t('QuotesPage.sendEmailDialog.placeholder')}
            />
            <p className="text-sm text-muted-foreground mt-1">{t('QuotesPage.sendEmailDialog.helperText')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)} disabled={isSendingEmail}>{t('QuotesPage.quoteDialog.cancel')}</Button>
            <Button onClick={handleConfirmSendEmail} disabled={isSendingEmail}>
              {isSendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('QuotesPage.sendEmailDialog.sending')}
                </>
              ) : (
                t('QuotesPage.sendEmail')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CommunicationWarningDialog
        open={isWarningDialogOpen}
        onOpenChange={setIsWarningDialogOpen}
        disabledItems={disabledEmails}
        onConfirm={handleWarningConfirm}
      />
    </>
  );
}
