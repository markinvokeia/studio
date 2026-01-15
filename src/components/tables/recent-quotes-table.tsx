
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Quote } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { cn, formatDateTime } from '@/lib/utils';
import { MoreHorizontal, Printer, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { DocumentTextIcon } from '../icons/document-text-icon';

const getColumns = (
  t: (key: string) => string,
  onEdit: (quote: Quote) => void,
  onDelete: (quote: Quote) => void,
  onQuoteAction: (quote: Quote, action: 'confirm' | 'reject') => void,
  onPrint: (quote: Quote) => void,
  onSendEmail: (quote: Quote) => void
): ColumnDef<Quote>[] => [
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
      accessorKey: 'id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.quoteId')} />
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
      cell: ({ row }) => formatDateTime(row.getValue('createdAt')),
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.total')} />
      ),
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
      accessorKey: 'currency',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.currency')} />
      ),
      cell: ({ row }) => row.original.currency || 'N/A',
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
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const t = useTranslations('UserColumns');
        const tQuotes = useTranslations('QuotesPage');
        const quote = row.original;
        const status = (quote.status || '').toLowerCase();
        const isDraft = status === 'draft';
        const isPending = status === 'pending';

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tQuotes('itemDialog.actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onPrint(quote)}>
                <Printer className="mr-2 h-4 w-4" />
                <span>{tQuotes('print')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSendEmail(quote)}>
                <Send className="mr-2 h-4 w-4" />
                <span>{tQuotes('sendEmail')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(quote)} disabled={!isDraft}>
                {tQuotes('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(quote)} className="text-destructive" disabled={!isDraft}>
                {tQuotes('delete')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onQuoteAction(quote, 'confirm')} disabled={!isDraft && !isPending}>
                {tQuotes('confirm')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuoteAction(quote, 'reject')} className="text-destructive" disabled={!isDraft && !isPending}>
                {tQuotes('reject')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];


interface RecentQuotesTableProps {
  quotes: Quote[];
  onRowSelectionChange?: (selectedRows: Quote[]) => void;
  onCreate?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  rowSelection?: RowSelectionState;
  setRowSelection?: (selection: RowSelectionState) => void;
  onEdit?: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
  onQuoteAction?: (quote: Quote, action: 'confirm' | 'reject') => void;
}

export function RecentQuotesTable({ quotes, onRowSelectionChange, onCreate, onRefresh, isRefreshing, rowSelection, setRowSelection, onEdit = () => { }, onDelete = () => { }, onQuoteAction = () => { } }: RecentQuotesTableProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = React.useState<Quote | null>(null);
  const [emailRecipients, setEmailRecipients] = React.useState('');

  const handlePrintQuote = async (quote: Quote) => {
    try {
      const blob = await api.postBlob(API_ROUTES.QUOTES_PRINT, { quoteId: quote.id });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quote-${quote.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({
        title: "Download Started",
        description: `Your PDF for Quote #${quote.id} is downloading.`,
      });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Print Error',
        description: error instanceof Error ? error.message : 'Could not print the quote.',
      });
    }
  };

  const handleSendEmailClick = (quote: Quote) => {
    setSelectedQuoteForEmail(quote);
    setEmailRecipients(quote.userEmail || '');
    setIsSendEmailDialogOpen(true);
  };

  const handleConfirmSendEmail = async () => {
    if (!selectedQuoteForEmail) return;

    const emails = emailRecipients.split(',').map(email => email.trim()).filter(email => email);
    if (emails.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter at least one recipient email.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Email Address',
        description: `The following emails are invalid: ${invalidEmails.join(', ')}`,
      });
      return;
    }


    try {
      await api.post(API_ROUTES.QUOTES_SEND, { quoteId: selectedQuoteForEmail.id, emails });

      toast({
        title: 'Email Sent',
        description: `The quote has been successfully sent to ${emails.join(', ')}.`,
      });

      setIsSendEmailDialogOpen(false);

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    }
  };

  const columns = React.useMemo(() => getColumns(t, onEdit, onDelete, onQuoteAction, handlePrintQuote, handleSendEmailClick), [t, onEdit, onDelete, onQuoteAction]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-6 w-6 text-amber-500" />
            <CardTitle>{t('RecentQuotesTable.title')}</CardTitle>
          </div>
          <CardDescription>{t('RecentQuotesTable.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={quotes}
            filterColumnId="user_name"
            filterPlaceholder={t('RecentQuotesTable.filterPlaceholder')}
            onRowSelectionChange={onRowSelectionChange}
            enableSingleRowSelection={onRowSelectionChange ? true : false}
            onCreate={onCreate}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            columnTranslations={{
              id: t('QuoteColumns.quoteId'),
              user_name: t('UserColumns.name'),
              createdAt: t('QuoteColumns.createdAt'),
              total: t('QuoteColumns.total'),
              currency: t('QuoteColumns.currency'),
              status: t('UserColumns.status'),
              billing_status: t('QuoteColumns.billingStatus'),
              payment_status: t('Navigation.Payments'),
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('QuotesPage.sendEmailDialog.title')}</DialogTitle>
            <DialogDescription>{t('QuotesPage.sendEmailDialog.description', { id: selectedQuoteForEmail?.id })}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
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
            <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)}>{t('QuotesPage.quoteDialog.cancel')}</Button>
            <Button onClick={handleConfirmSendEmail}>{t('QuotesPage.sendEmail')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

