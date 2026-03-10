'use client';

import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { OrderItemsTable } from '@/components/tables/order-items-table';
import { OrdersTable } from '@/components/tables/orders-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { QuoteItemsTable } from '@/components/tables/quote-items-table';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { normalizeApiResponse } from '@/lib/api-utils';
import { Clinic, Invoice, InvoiceItem, Order, OrderItem, Payment, Quote, QuoteItem, Service, User } from '@/lib/types';
import { cn, getDocumentFileName } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { RowSelectionState } from '@tanstack/react-table';
import { 
    AlertTriangle, 
    Check, 
    ChevronsUpDown, 
    FileText, 
    Receipt, 
    RefreshCw, 
    ShoppingCart, 
    X, 
    Printer, 
    Send, 
    Edit3, 
    DollarSign, 
    CreditCard,
    PlusCircle,
    User as UserIcon,
    CalendarIcon
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { DatePicker } from '@/components/ui/date-picker';

const quoteFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    user_id: z.string().min(1, t('validation.userRequired')),
    total: z.coerce.number().min(0, t('validation.totalPositive')),
    currency: z.enum(['UYU', 'USD']).default('USD'),
    status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'pending', 'confirmed']),
    payment_status: z.enum(['unpaid', 'paid', 'partial', 'partially_paid']),
    billing_status: z.enum(['not invoiced', 'partially invoiced', 'invoiced']),
    exchange_rate: z.coerce.number().min(0.0001, t('validation.exchangeRatePositive')).optional(),
});

type QuoteFormValues = z.infer<ReturnType<typeof quoteFormSchema>>;

const quoteItemFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    quote_id: z.string(),
    service_id: z.string().min(1, t('validation.serviceRequired')),
    quantity: z.coerce.number().min(1, t('validation.quantityMinOne')),
    unit_price: z.coerce.number().min(0, t('validation.unitPricePositive')),
    total: z.coerce.number().min(0, t('validation.totalPositive')),
    tooth_number: z.coerce.number().int().min(11, t('validation.toothNumberMin')).max(85, t('validation.toothNumberMax')).optional().or(z.literal('')),
});

type QuoteItemFormValues = z.infer<ReturnType<typeof quoteItemFormSchema>>;

async function getQuotes(t: any): Promise<Quote[]> {
    try {
        const data = await api.get(API_ROUTES.PURCHASES.QUOTES_ALL, { is_sales: 'true' });
        const normalized = normalizeApiResponse(data);
        return normalized.items.map((apiQuote: any) => ({
            id: apiQuote.id ? String(apiQuote.id) : `qt_${Math.random().toString(36).substr(2, 9)}`,
            doc_no: apiQuote.doc_no || 'N/A',
            user_id: apiQuote.user_id || 'N/A',
            total: apiQuote.total || 0,
            status: apiQuote.status || 'draft',
            payment_status: apiQuote.payment_status || 'unpaid',
            billing_status: apiQuote.billing_status || 'not invoiced',
            currency: apiQuote.currency || 'UYU',
            user_name: apiQuote.user_name || 'No Name',
            userEmail: apiQuote.userEmail || 'no-email@example.com',
            createdAt: apiQuote.created_at || new Date().toISOString().split('T')[0],
            exchange_rate: parseFloat(apiQuote.exchange_rate) || 1,
        }));
    } catch (e) { return []; }
}

async function getQuoteItems(quoteId: string, t: any): Promise<QuoteItem[]> {
    if (!quoteId) return [];
    try {
        const data = await api.get(API_ROUTES.SALES.QUOTES_ITEMS, { quote_id: quoteId });
        const normalized = normalizeApiResponse(data);
        return normalized.items.map((apiItem: any) => ({
            id: apiItem.id ? String(apiItem.id) : 'N/A',
            service_id: apiItem.service_id || 'N/A',
            service_name: apiItem.service_name || 'N/A',
            unit_price: apiItem.unit_price || 0,
            quantity: apiItem.quantity || 0,
            total: apiItem.total || 0,
            tooth_number: apiItem.tooth_number ? Number(apiItem.tooth_number) : undefined,
        }));
    } catch (e) { return []; }
}

async function getServices(): Promise<Service[]> {
    try {
        const data = await api.get(API_ROUTES.SERVICES, { is_sales: 'true' });
        const normalized = normalizeApiResponse(data);
        return normalized.items.map((s: any) => ({ ...s, id: String(s.id), currency: s.currency || 'USD' }));
    } catch (e) { return []; }
}

async function upsertQuoteItem(itemData: QuoteItemFormValues, t: any) {
    const responseData = await api.post(API_ROUTES.SALES.QUOTES_LINES_UPSERT, { ...itemData, tooth_number: null, is_sales: true });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) throw new Error(responseData[0]?.message);
    return responseData;
}

async function deleteQuoteItem(id: string, quoteId: string, t: any) {
    const responseData = await api.delete(API_ROUTES.SALES.QUOTES_LINES_DELETE, { id, quote_id: quoteId, is_sales: true });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) throw new Error(responseData[0]?.message);
    return responseData;
}

async function getOrders(quoteId: string, t: any): Promise<Order[]> {
    if (!quoteId) return [];
    try {
        const data = await api.get(API_ROUTES.SALES.QUOTES_ORDERS, { quote_id: quoteId });
        const ordersData = Array.isArray(data) ? data : (data.orders || data.data || []);
        return ordersData.map((apiOrder: any) => ({
            id: apiOrder.id ? String(apiOrder.id) : t('defaults.notAvailable'),
            doc_no: apiOrder.doc_no || t('defaults.notAvailable'),
            user_id: apiOrder.user_id,
            quote_id: apiOrder.quote_id,
            user_name: apiOrder.user_name || apiOrder.name || t('defaults.notAvailable'),
            status: apiOrder.status,
            createdAt: apiOrder.created_at || apiOrder.createdAt || new Date().toISOString().split('T')[0],
            updatedAt: apiOrder.updated_at || new Date().toISOString(),
            currency: apiOrder.currency || 'UYU',
        }));
    } catch (e) { return []; }
}

async function getOrderItems(orderId: string, t: any): Promise<OrderItem[]> {
    if (!orderId) return [];
    try {
        const data = await api.get(API_ROUTES.SALES.ORDER_ITEMS, { order_id: orderId });
        const itemsData = Array.isArray(data) ? data : (data.order_items || data.data || []);
        return itemsData.map((apiItem: any) => ({
            id: apiItem.order_item_id ? String(apiItem.order_item_id) : 'N/A',
            service_id: apiItem.service_id || apiItem.id,
            service_name: apiItem.service_name || 'N/A',
            unit_price: apiItem.unit_price,
            quantity: apiItem.quantity,
            total: apiItem.total,
            tooth_number: apiItem.tooth_number ? Number(apiItem.tooth_number) : undefined,
            status: apiItem.status || 'scheduled',
            scheduled_date: apiItem.scheduled_date,
            completed_date: apiItem.completed_date,
            invoiced_date: apiItem.invoiced_date,
        }));
    } catch (e) { return []; }
}

async function getInvoices(quoteId: string, t: any): Promise<Invoice[]> {
    if (!quoteId) return [];
    try {
        const data = await api.get(API_ROUTES.SALES.QUOTES_INVOICES, { quote_id: quoteId });
        const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);
        return invoicesData.map((apiInvoice: any) => ({
            id: apiInvoice.id ? String(apiInvoice.id) : t('defaults.notAvailable'),
            invoice_ref: apiInvoice.invoice_ref || t('defaults.notAvailable'),
            doc_no: apiInvoice.doc_no || `INV-${apiInvoice.id}`,
            total: parseFloat(apiInvoice.total) || 0,
            status: apiInvoice.status || 'draft',
            createdAt: apiInvoice.created_at || apiInvoice.createdAt || new Date().toISOString(),
            currency: apiInvoice.currency || 'USD',
            order_id: apiInvoice.order_id,
            user_name: apiInvoice.user_name || apiInvoice.name || t('defaults.notAvailable'),
            user_id: apiInvoice.user_id,
            payment_status: apiInvoice.payment_state || 'unpaid',
            paid_amount: parseFloat(apiInvoice.paid_amount) || 0,
            type: apiInvoice.type || 'invoice',
        }));
    } catch (e) { return []; }
}

async function getInvoiceItems(invoiceId: string, t: any): Promise<InvoiceItem[]> {
    if (!invoiceId) return [];
    try {
        const data = await api.get(API_ROUTES.SALES.INVOICE_ITEMS, { invoice_id: invoiceId });
        const itemsData = Array.isArray(data) ? data : (data.invoice_items || data.data || []);
        return itemsData.map((apiItem: any) => ({
            id: apiItem.id ? String(apiItem.id) : t('defaults.notAvailable'),
            service_id: apiItem.service_id,
            service_name: apiItem.service_name || t('defaults.notAvailable'),
            quantity: apiItem.quantity,
            unit_price: apiItem.unit_price,
            total: apiItem.total,
        }));
    } catch (e) { return []; }
}

async function getPayments(quoteId: string, t: any): Promise<Payment[]> {
    if (!quoteId) return [];
    try {
        const data = await api.get(API_ROUTES.SALES.QUOTES_PAYMENTS, { quote_id: quoteId });
        const paymentsData = Array.isArray(data) ? data : (data.payments || []);
        if (!hasValidPayments(paymentsData)) return [];
        const isNewFormat = paymentsData[0].amount_applied !== undefined;
        return paymentsData.map((apiPayment: any) => ({
            id: String(apiPayment.transaction_id || apiPayment.id || 'N/A'),
            doc_no: apiPayment.doc_no || 'N/A',
            amount_applied: parseFloat(apiPayment.amount_applied || apiPayment.amount || 0),
            currency: apiPayment.invoice_currency || apiPayment.currency || 'USD',
            payment_date: apiPayment.payment_date || apiPayment.created_at,
            method: apiPayment.payment_method_name || apiPayment.method,
            status: apiPayment.status || 'completed',
        }));
    } catch (e) { return []; }
}

function hasValidPayments(paymentsData: any[]): boolean {
    if (!Array.isArray(paymentsData) || paymentsData.length === 0) return false;
    const firstItem = paymentsData[0];
    if (!firstItem || typeof firstItem !== 'object') return false;
    return firstItem.amount_applied !== undefined || firstItem.amount !== undefined;
}

async function getUsers(t: any): Promise<User[]> {
    try {
        const data = await api.get(API_ROUTES.SALES.USERS, { filter_type: 'PACIENTE' });
        const normalized = (Array.isArray(data) && data.length > 0) ? data[0].data : (data.data || []);
        return normalized.map((u: any) => ({ id: String(u.id), name: u.name || 'N/A' }));
    } catch (e) { return []; }
}

async function upsertQuote(quoteData: QuoteFormValues, t: any) {
    const responseData = await api.post(API_ROUTES.SALES.QUOTES_UPSERT, { ...quoteData, is_sales: true });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) throw new Error(responseData[0]?.message);
    return responseData;
}

async function deleteQuote(id: string, t: any) {
    const responseData = await api.delete(API_ROUTES.SALES.QUOTE_DELETE, { id, is_sales: true });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) throw new Error(responseData[0]?.message);
    return responseData;
}

async function getClinic(): Promise<Clinic | null> {
    try {
        const data = await api.get(API_ROUTES.CLINIC);
        const clinics = Array.isArray(data) ? data : (data.clinics || []);
        if (clinics.length === 0) return null;
        return clinics[0];
    } catch (e) { return null; }
}

export default function QuotesPage() {
    return <QuotesPageContent />;
}

function QuotesPageContent() {
    const t = useTranslations('QuotesPage');
    const tRoot = useTranslations();
    const tInvoices = useTranslations('InvoicesPage');
    const { toast } = useToast();
    const { user, activeCashSession } = useAuth();
    const { hasPermission } = usePermissions();

    const canCreateQuote = hasPermission(SALES_PERMISSIONS.QUOTES_CREATE);
    const canUpdateQuote = hasPermission(SALES_PERMISSIONS.QUOTES_UPDATE);
    const canDeleteQuote = hasPermission(SALES_PERMISSIONS.QUOTES_DELETE);
    const canConfirmQuote = hasPermission(SALES_PERMISSIONS.QUOTES_CONFIRM);
    const canUpdateItem = hasPermission(SALES_PERMISSIONS.QUOTES_UPDATE_ITEM);

    const [quotes, setQuotes] = React.useState<Quote[]>([]);
    const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
    const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
    const [orders, setOrders] = React.useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
    const [orderRowSelection, setOrderRowSelection] = React.useState<RowSelectionState>({});
    const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
    const [invoiceRowSelection, setInvoiceRowSelection] = React.useState<RowSelectionState>({});
    const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([]);
    const [payments, setPayments] = React.useState<Payment[]>([]);
    const [clinic, setClinic] = React.useState<Clinic | null>(null);

    const [isLoadingItems, setIsLoadingItems] = React.useState(false);
    const [isLoadingOrders, setIsLoadingOrders] = React.useState(false);
    const [isLoadingOrderItems, setIsLoadingOrderItems] = React.useState(false);
    const [isLoadingInvoices, setIsLoadingInvoices] = React.useState(false);
    const [isLoadingInvoiceItems, setIsLoadingInvoiceItems] = React.useState(false);
    const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);

    const [isQuoteDialogOpen, setIsQuoteDialogOpen] = React.useState(false);
    const [editingQuote, setEditingQuote] = React.useState<Quote | null>(null);
    const [deletingQuote, setDeletingQuote] = React.useState<Quote | null>(null);
    const [isDeleteQuoteDialogOpen, setIsDeleteQuoteDialogOpen] = React.useState(false);
    const [quoteSubmissionError, setQuoteSubmissionError] = React.useState<string | null>(null);

    const [isQuoteItemDialogOpen, setIsQuoteItemDialogOpen] = React.useState(false);
    const [editingQuoteItem, setEditingQuoteItem] = React.useState<QuoteItem | null>(null);
    const [deletingQuoteItem, setDeletingQuoteItem] = React.useState<QuoteItem | null>(null);
    const [isDeleteQuoteItemDialogOpen, setIsDeleteQuoteItemDialogOpen] = React.useState(false);
    const [quoteItemSubmissionError, setQuoteItemSubmissionError] = React.useState<string | null>(null);

    const [allUsers, setAllUsers] = React.useState<User[]>([]);
    const [allServices, setAllServices] = React.useState<Service[]>([]);
    const [isUserSearchOpen, setUserSearchOpen] = React.useState(false);
    const [isServiceSearchOpen, setServiceSearchOpen] = React.useState(false);

    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

    const [isOrderInvoicingDialogOpen, setIsOrderInvoicingDialogOpen] = React.useState(false);
    const [orderToInvoice, setOrderToInvoice] = React.useState<Order | null>(null);
    const [orderInvoicingDate, setOrderInvoicingDate] = React.useState<Date | undefined>(new Date());
    const [orderInvoicingError, setOrderInvoicingError] = React.useState<string | null>(null);

    const quoteForm = useForm<QuoteFormValues>({ resolver: zodResolver(quoteFormSchema(t)), mode: 'onBlur' });
    const quoteItemForm = useForm<QuoteItemFormValues>({ resolver: zodResolver(quoteItemFormSchema(t)), mode: 'onBlur' });

    const loadQuotes = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedQuotes = await getQuotes(t);
        setQuotes(fetchedQuotes);
        setIsRefreshing(false);
    }, [t]);

    const loadQuoteItems = React.useCallback(async () => {
        if (!selectedQuote) return;
        setIsLoadingItems(true);
        setQuoteItems(await getQuoteItems(selectedQuote.id, t));
        setIsLoadingItems(false);
    }, [selectedQuote, t]);

    const loadOrders = React.useCallback(async () => {
        if (!selectedQuote) return;
        setIsLoadingOrders(true);
        setOrders(await getOrders(selectedQuote.id, t));
        setIsLoadingOrders(false);
    }, [selectedQuote, t]);

    const loadOrderItems = React.useCallback(async () => {
        if (!selectedOrder) return;
        setIsLoadingOrderItems(true);
        setOrderItems(await getOrderItems(selectedOrder.id, t));
        setIsLoadingOrderItems(false);
    }, [selectedOrder, t]);

    const loadInvoices = React.useCallback(async () => {
        if (!selectedQuote) return;
        setIsLoadingInvoices(true);
        setInvoices(await getInvoices(selectedQuote.id, t));
        setIsLoadingInvoices(false);
    }, [selectedQuote, t]);

    const loadInvoiceItems = React.useCallback(async () => {
        if (!selectedInvoice) return;
        setIsLoadingInvoiceItems(true);
        setInvoiceItems(await getInvoiceItems(selectedInvoice.id, t));
        setIsLoadingInvoiceItems(false);
    }, [selectedInvoice, t]);

    const loadPayments = React.useCallback(async () => {
        if (!selectedQuote) return;
        setIsLoadingPayments(true);
        setPayments(await getPayments(selectedQuote.id, t));
        setIsLoadingPayments(false);
    }, [selectedQuote, t]);

    React.useEffect(() => { loadQuotes(); getClinic().then(setClinic); }, [loadQuotes]);

    React.useEffect(() => {
        if (selectedQuote) {
            loadQuoteItems(); loadOrders(); loadInvoices(); loadPayments();
            setSelectedOrder(null); setSelectedInvoice(null);
            setOrderRowSelection({}); setInvoiceRowSelection({});
        } else {
            setQuoteItems([]); setOrders([]); setInvoices([]); setPayments([]);
        }
    }, [selectedQuote, loadQuoteItems, loadOrders, loadInvoices, loadPayments]);

    React.useEffect(() => { if (selectedOrder) loadOrderItems(); else setOrderItems([]); }, [selectedOrder, loadOrderItems]);
    React.useEffect(() => { if (selectedInvoice) loadInvoiceItems(); else setInvoiceItems([]); }, [selectedInvoice, loadInvoiceItems]);

    const handleCreateQuote = async () => {
        setEditingQuote(null);
        quoteForm.reset({ user_id: '', total: 0, currency: clinic?.currency || 'UYU', status: 'draft', payment_status: 'unpaid', billing_status: 'not invoiced', exchange_rate: 1 });
        setIsQuoteDialogOpen(true);
        if (allUsers.length === 0) getUsers(t).then(setAllUsers);
    };

    const handleEditQuote = (quote: Quote) => {
        setEditingQuote(quote);
        quoteForm.reset({ id: quote.id, user_id: quote.user_id, total: quote.total, currency: quote.currency || 'USD', status: quote.status, payment_status: quote.payment_status as any, billing_status: quote.billing_status as any, exchange_rate: quote.exchange_rate });
        setIsQuoteDialogOpen(true);
        if (allUsers.length === 0) getUsers(t).then(setAllUsers);
    };

    const onQuoteSubmit = async (values: QuoteFormValues) => {
        try {
            await upsertQuote(values, t);
            toast({ title: 'Success' });
            setIsQuoteDialogOpen(false);
            loadQuotes();
        } catch (e: any) { setQuoteSubmissionError(e.message); }
    };

    const handleQuoteAction = async (quote: Quote, action: 'confirm' | 'reject') => {
        try {
            await api.post(action === 'confirm' ? API_ROUTES.SALES.QUOTE_CONFIRM : API_ROUTES.SALES.QUOTE_REJECT, { quote_number: quote.id, confirm_reject: action, is_sales: true });
            toast({ title: 'Success' });
            loadQuotes();
        } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    };

    const handleCloseDetails = () => {
        setSelectedQuote(null);
        setRowSelection({});
    };

    const ActionButton = ({ onClick, icon: Icon, label, variant = "ghost", disabled = false, className = "" }: { onClick: () => void, icon: any, label: string, variant?: any, disabled?: boolean, className?: string }) => (
        <Button
            variant={variant}
            size="sm"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            disabled={disabled}
            className={cn("flex flex-col items-center justify-center h-14 min-w-[80px] w-auto px-3 py-1 gap-1 text-[9px] font-bold uppercase", className)}
        >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap text-center leading-none">{label}</span>
        </Button>
    );

    const handlePrintQuote = async (quote: Quote) => {
        try {
            const blob = await api.getBlob(API_ROUTES.SALES.QUOTES_PRINT, { quoteId: quote.id });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `QUO-${quote.id}.pdf`; a.click();
        } catch (e) { toast({ variant: 'destructive', title: 'Print Error' }); }
    };

    const handleOrderInvoicing = (order: Order) => {
        setOrderToInvoice(order);
        setIsOrderInvoicingDialogOpen(true);
    };

    const handleConfirmOrderInvoicing = async () => {
        if (!orderToInvoice || !orderInvoicingDate) return;
        try {
            await api.post(API_ROUTES.SALES.ORDER_INVOICE, { order_id: orderToInvoice.id, is_sales: true, query: JSON.stringify({ order_id: parseInt(orderToInvoice.id, 10), invoice_date: orderInvoicingDate.toISOString(), is_sales: true, user_id: orderToInvoice.user_id }) });
            toast({ title: 'Invoice Created' });
            setIsOrderInvoicingDialogOpen(false);
            loadInvoices();
        } catch (e: any) { setOrderInvoicingError(e.message); }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                isRightPanelOpen={!!selectedQuote}
                leftPanel={
                    <RecentQuotesTable
                        quotes={quotes}
                        onRowSelectionChange={(rows) => setSelectedQuote(rows[0] || null)}
                        onCreate={canCreateQuote ? handleCreateQuote : undefined}
                        onRefresh={loadQuotes}
                        isRefreshing={isRefreshing}
                        rowSelection={rowSelection}
                        setRowSelection={setRowSelection}
                        onEdit={handleEditQuote}
                        onDelete={(q) => { setDeletingQuote(q); setIsDeleteQuoteDialogOpen(true); }}
                        onQuoteAction={handleQuoteAction}
                        isCompact={true}
                        standalone={true}
                        title={t('title')}
                        description={t('description')}
                    />
                }
                rightPanel={
                    selectedQuote && (
                        <Card className="h-full border-0 lg:border shadow-none lg:shadow-sm flex flex-col min-h-0 overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-card">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div className="header-icon-circle">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <h2 className="text-xs font-bold tracking-tight text-muted-foreground">{selectedQuote.doc_no || `Presupuesto #${selectedQuote.id}`}</h2>
                                        <div className="flex items-center gap-1.5 text-sm font-bold truncate">
                                            <UserIcon className="h-4 w-4 text-primary" />
                                            <span>{selectedQuote.user_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20 w-fit mt-1 text-[10px] font-black uppercase">
                                            <div className="flex items-center gap-1">
                                                <div className={cn("h-1.5 w-1.5 rounded-full", (selectedQuote.status.toLowerCase() === 'confirmed' || selectedQuote.status.toLowerCase() === 'accepted') ? "bg-green-500" : "bg-slate-400")} />
                                                <span>{t(`quoteDialog.${selectedQuote.status.toLowerCase()}` as any)}</span>
                                            </div>
                                            <div className="h-3 w-px bg-primary/20" />
                                            <span>{t(`quoteDialog.${selectedQuote.billing_status.toLowerCase().replace(/\s+/g, '_')}` as any)}</span>
                                            <div className="h-3 w-px bg-primary/20" />
                                            <span>{t(`quoteDialog.${selectedQuote.payment_status.toLowerCase().replace(/\s+/g, '_')}` as any)}</span>
                                            <div className="h-3 w-px bg-primary/20" />
                                            <span className="text-primary">{selectedQuote.currency} {Number(selectedQuote.total || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {(selectedQuote.status.toLowerCase() === 'draft' || selectedQuote.status.toLowerCase() === 'pending') && (
                                        <div className="flex items-center gap-1 mr-2 pr-2 border-r">
                                            <ActionButton onClick={() => handleQuoteAction(selectedQuote, 'confirm')} icon={Check} label={t('confirm')} variant="default" className="bg-green-600 hover:bg-green-700 text-white rounded-lg" />
                                            <ActionButton onClick={() => handleQuoteAction(selectedQuote, 'reject')} icon={X} label={t('reject')} className="text-rose-600 hover:bg-rose-50 rounded-lg" />
                                        </div>
                                    )}
                                    <ActionButton onClick={() => handleEditQuote(selectedQuote)} icon={Edit3} label={t('edit')} disabled={selectedQuote.status.toLowerCase() !== 'draft'} className="rounded-lg" />
                                    <ActionButton onClick={() => handlePrintQuote(selectedQuote)} icon={Printer} label={t('print')} className="rounded-lg" />
                                    <ActionButton onClick={() => {}} icon={Send} label={t('sendEmail')} className="rounded-lg" />
                                    <Button variant="ghost" size="icon" onClick={handleCloseDetails} className="ml-2 hover:bg-destructive/10 hover:text-destructive"><X className="h-5 w-5" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden relative">
                                <Tabs defaultValue="items" className="flex-1 flex flex-col min-h-0">
                                    <TabsList className="flex-none px-4 bg-muted/20 border-b h-auto py-1 gap-2">
                                        <TabsTrigger value="items" className="text-[10px] font-bold uppercase py-2 flex flex-col items-center gap-1"><DollarSign className="h-4 w-4" /><span>{t('tabs.items')}</span></TabsTrigger>
                                        <TabsTrigger value="orders" className="text-[10px] font-bold uppercase py-2 flex flex-col items-center gap-1"><ShoppingCart className="h-4 w-4" /><span>{t('tabs.orders')}</span></TabsTrigger>
                                        <TabsTrigger value="invoices" className="text-[10px] font-bold uppercase py-2 flex flex-col items-center gap-1"><Receipt className="h-4 w-4" /><span>{t('tabs.invoices')}</span></TabsTrigger>
                                        <TabsTrigger value="payments" className="text-[10px] font-bold uppercase py-2 flex flex-col items-center gap-1"><CreditCard className="h-4 w-4" /><span>{t('tabs.payments')}</span></TabsTrigger>
                                    </TabsList>
                                    <div className="flex-1 overflow-hidden">
                                        <TabsContent value="items" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                            <QuoteItemsTable items={quoteItems} isLoading={isLoadingItems} onRefresh={loadQuoteItems} isRefreshing={isLoadingItems} canEdit={selectedQuote.status.toLowerCase() === 'draft' && canUpdateItem} onCreate={() => setIsQuoteItemDialogOpen(true)} onEdit={(item) => { setEditingQuoteItem(item); setIsQuoteItemDialogOpen(true); }} onDelete={(item) => { setDeletingQuoteItem(item); setIsDeleteQuoteItemDialogOpen(true); }} showToothNumber={true} />
                                        </TabsContent>
                                        <TabsContent value="orders" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                            <OrdersTable orders={orders} isLoading={isLoadingOrders} onRowSelectionChange={(rows) => setSelectedOrder(rows[0] || null)} onRefresh={loadOrders} isRefreshing={isLoadingOrders} columnsToHide={['user_name', 'quote_id']} isCompact={true} rowSelection={orderRowSelection} setRowSelection={setOrderRowSelection} />
                                        </TabsContent>
                                        <TabsContent value="invoices" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                            <InvoicesTable invoices={invoices} isLoading={isLoadingInvoices} onRowSelectionChange={(rows) => setSelectedInvoice(rows[0] || null)} onRefresh={loadInvoices} isRefreshing={isLoadingInvoices} isCompact={true} canCreate={false} rowSelection={invoiceRowSelection} setRowSelection={setInvoiceRowSelection} />
                                        </TabsContent>
                                        <TabsContent value="payments" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                            <PaymentsTable payments={payments} isLoading={isLoadingPayments} onRefresh={loadPayments} isRefreshing={isLoadingPayments} columnsToHide={['quote_id', 'order_id', 'user_name']} />
                                        </TabsContent>
                                    </div>
                                </Tabs>
                                {selectedOrder && (
                                    <div className="absolute inset-0 z-[40] bg-background flex flex-col animate-in slide-in-from-right duration-300">
                                        <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-card">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="header-icon-circle"><ShoppingCart className="h-5 w-5" /></div>
                                                <div className="flex flex-col min-w-0">
                                                    <h2 className="text-xs font-bold tracking-tight text-muted-foreground">{selectedOrder.doc_no || `Orden #${selectedOrder.id}`}</h2>
                                                    <div className="flex items-center gap-1.5 text-sm font-bold truncate"><UserIcon className="h-4 w-4 text-primary" /><span>{selectedOrder.user_name}</span></div>
                                                    <div className="flex items-center gap-2 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20 w-fit mt-1 text-[10px] font-black uppercase">
                                                        <div className="flex items-center gap-1">
                                                            <div className={cn("h-1.5 w-1.5 rounded-full", (selectedOrder.status.toLowerCase() === 'completed') ? "bg-green-500" : "bg-slate-400")} />
                                                            <span>{tRoot(`OrdersPage.status.${selectedOrder.status.toLowerCase().replace(/\s+/g, '_')}` as any)}</span>
                                                        </div>
                                                        <div className="h-3 w-px bg-primary/20 mx-1" />
                                                        <span className="text-primary">{selectedOrder.currency || selectedQuote.currency} {Number(selectedQuote.total || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <ActionButton onClick={() => handleOrderInvoicing(selectedOrder)} icon={Receipt} label={tRoot('Navigation.InvoiceAction')} className="rounded-lg" />
                                                <ActionButton onClick={loadOrderItems} icon={RefreshCw} label={tRoot('DataTableToolbar.refresh')} disabled={isLoadingOrderItems} className="rounded-lg" />
                                                <Button variant="ghost" size="icon" onClick={() => { setSelectedOrder(null); setOrderRowSelection({}); }} className="ml-2 hover:bg-destructive/10 hover:text-destructive"><X className="h-5 w-5" /></Button>
                                            </div>
                                        </CardHeader>
                                        <div className="flex-1 overflow-hidden">
                                            <OrderItemsTable items={orderItems} isLoading={isLoadingOrderItems} onItemsUpdate={loadOrderItems} quoteId={selectedQuote.id} isSales={true} userId={selectedOrder.user_id} patient={{ id: selectedOrder.user_id, name: selectedOrder.user_name || 'Patient', email: '', phone_number: '', is_active: true, avatar: '' }} />
                                        </div>
                                    </div>
                                )}
                                {selectedInvoice && (
                                    <div className="absolute inset-0 z-[40] bg-background flex flex-col animate-in slide-in-from-right duration-300">
                                        <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-card">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="header-icon-circle"><Receipt className="h-5 w-5" /></div>
                                                <div className="flex flex-col min-w-0">
                                                    <h2 className="text-xs font-bold tracking-tight text-muted-foreground">{selectedInvoice.doc_no || `Factura #${selectedInvoice.id}`}</h2>
                                                    <div className="flex items-center gap-1.5 text-sm font-bold truncate"><UserIcon className="h-4 w-4 text-primary" /><span>{selectedInvoice.user_name}</span></div>
                                                    <div className="flex items-center gap-2 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20 w-fit mt-1 text-[10px] font-black uppercase">
                                                        <div className="flex items-center gap-1">
                                                            <div className={cn("h-1.5 w-1.5 rounded-full", (selectedInvoice.status.toLowerCase() === 'paid') ? "bg-green-500" : "bg-slate-400")} />
                                                            <span>{tInvoices(`status.${selectedInvoice.status.toLowerCase().replace(/\s+/g, '_')}` as any)}</span>
                                                        </div>
                                                        <div className="h-3 w-px bg-primary/20 mx-1" />
                                                        <div className="flex items-center gap-1">
                                                            <div className={cn("h-1.5 w-1.5 rounded-full", (selectedInvoice.payment_status.toLowerCase() === 'paid') ? "bg-green-500" : "bg-slate-400")} />
                                                            <span>{tInvoices(`status.${selectedInvoice.payment_status.toLowerCase().replace(/\s+/g, '_')}` as any)}</span>
                                                        </div>
                                                        <div className="h-3 w-px bg-primary/20 mx-1" />
                                                        <span className="text-primary">{selectedInvoice.currency} {Number(selectedInvoice.total || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <ActionButton onClick={() => {}} icon={CreditCard} label={tInvoices('paymentDialog.add')} className="rounded-lg" />
                                                <ActionButton onClick={loadInvoiceItems} icon={RefreshCw} label={tRoot('DataTableToolbar.refresh')} disabled={isLoadingInvoiceItems} className="rounded-lg" />
                                                <Button variant="ghost" size="icon" onClick={() => { setSelectedInvoice(null); setInvoiceRowSelection({}); }} className="ml-2 hover:bg-destructive/10 hover:text-destructive"><X className="h-5 w-5" /></Button>
                                            </div>
                                        </CardHeader>
                                        <div className="flex-1 overflow-hidden">
                                            <InvoiceItemsTable items={invoiceItems} isLoading={isLoadingInvoiceItems} />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                }
            />
            <Dialog open={isOrderInvoicingDialogOpen} onOpenChange={setIsOrderInvoicingDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>{t('invoiceDialog.title')}</DialogTitle><DialogDescription>{t('invoiceDialog.description', { orderId: orderToInvoice?.doc_no })}</DialogDescription></DialogHeader>
                    {orderInvoicingError && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{orderInvoicingError}</AlertDescription></Alert>}
                    <div className="flex justify-center py-4"><DatePicker mode="single" selected={orderInvoicingDate} onSelect={setOrderInvoicingDate} initialFocus /></div>
                    <DialogFooter><Button onClick={handleConfirmOrderInvoicing}>{t('invoiceDialog.confirm')}</Button><Button variant="outline" onClick={() => setIsOrderInvoicingDialogOpen(false)}>{t('cancel')}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>{editingQuote ? t('quoteDialog.editTitle') : t('quoteDialog.createTitle')}</DialogTitle></DialogHeader>
                    <Form {...quoteForm}><form onSubmit={quoteForm.handleSubmit(onQuoteSubmit)} className="space-y-4 py-4 px-6">
                        <FormField control={quoteForm.control} name="user_id" render={({ field }) => (
                            <FormItem><FormLabel>{t('quoteDialog.user')}</FormLabel><Popover open={isUserSearchOpen} onOpenChange={setUserSearchOpen}><PopoverTrigger asChild><Button variant="outline" className="w-full justify-between">{field.value ? allUsers.find(u => u.id === field.value)?.name : t('quoteDialog.selectUser')}<ChevronsUpDown className="h-4 w-4 opacity-50" /></Button></PopoverTrigger><PopoverContent className="p-0 w-96"><Command><CommandInput placeholder={t('quoteDialog.searchUser')} onValueChange={(v) => getUsers(t).then(setAllUsers)} /><CommandList><CommandEmpty>No users found.</CommandEmpty><CommandGroup>{allUsers.map(u => <CommandItem key={u.id} value={u.name} onSelect={() => { quoteForm.setValue('user_id', u.id); setUserSearchOpen(false); }}>{u.name}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover></FormItem>
                        )} />
                        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                    </form></Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
