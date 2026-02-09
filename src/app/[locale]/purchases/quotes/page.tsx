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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { normalizeApiResponse } from '@/lib/api-utils';
import { Invoice, InvoiceItem, Order, OrderItem, Payment, Quote, QuoteItem, Service, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Check, ChevronsUpDown, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';


const quoteFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    user_id: z.string().min(1, t('validation.userRequired')),
    total: z.coerce.number().min(0, t('validation.totalPositive')),
    currency: z.enum(['UYU', 'USD']).default('USD'),
    status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'pending', 'confirmed']),
    payment_status: z.enum(['unpaid', 'paid', 'partial', 'partially_paid']),
    billing_status: z.enum(['not invoiced', 'partially invoiced', 'invoiced']),
    exchange_rate: z.coerce.number().optional(),
});

type QuoteFormValues = z.infer<ReturnType<typeof quoteFormSchema>>;

const quoteItemFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    quote_id: z.string(),
    service_id: z.string().min(1, t('validation.serviceRequired')),
    quantity: z.coerce.number().min(1, t('validation.quantityMinOne')),
    unit_price: z.coerce.number().min(0, t('validation.unitPricePositive')),
    total: z.coerce.number().min(0, t('validation.totalPositive')),
    exchange_rate: z.coerce.number().optional(),
    tooth_number: z.coerce.number().int().min(11, t('validation.toothNumberMin')).max(85, t('validation.toothNumberMax')).optional().or(z.literal('')),
});

type QuoteItemFormValues = z.infer<ReturnType<typeof quoteItemFormSchema>>;


async function getQuotes(t: (key: string) => string): Promise<Quote[]> {
    try {
        const data = await api.get(API_ROUTES.PURCHASES.QUOTES_ALL, { is_sales: 'false' });
        const normalized = normalizeApiResponse(data);
        const quotesData = normalized.items;

        return quotesData.map((apiQuote: any) => ({
            id: apiQuote.id ? String(apiQuote.id) : `qt_${Math.random().toString(36).substr(2, 9)}`,
            doc_no: apiQuote.doc_no || t('defaults.notAvailable'),
            user_id: apiQuote.user_id || t('defaults.notAvailable'),
            total: apiQuote.total || 0,
            status: apiQuote.status || 'draft',
            payment_status: apiQuote.payment_status || 'unpaid',
            billing_status: apiQuote.billing_status || 'not invoiced',
            currency: apiQuote.currency || 'UYU',
            user_name: apiQuote.user_name || t('defaults.noName'),
            userEmail: apiQuote.userEmail || t('defaults.noEmail'),
            createdAt: apiQuote.created_at || new Date().toISOString().split('T')[0],
            exchange_rate: parseFloat(apiQuote.exchange_rate) || 1,
        }));
    } catch (error) {
        console.error("Failed to fetch quotes:", error);
        return [];
    }
}

async function getQuoteItems(quoteId: string, t: (key: string) => string): Promise<QuoteItem[]> {
    if (!quoteId) return [];
    try {
        const data = await api.get(API_ROUTES.PURCHASES.QUOTES_ITEMS, { quote_id: quoteId, is_sales: 'false' });
        const normalized = normalizeApiResponse(data);
        const itemsData = normalized.items;

        return itemsData.map((apiItem: any) => ({
            id: apiItem.id ? String(apiItem.id) : t('defaults.notAvailable'),
            service_id: apiItem.service_id || t('defaults.notAvailable'),
            service_name: apiItem.service_name || t('defaults.notAvailable'),
            unit_price: apiItem.unit_price || 0,
            quantity: apiItem.quantity || 0,
            total: apiItem.total || 0,
            tooth_number: apiItem.tooth_number ? Number(apiItem.tooth_number) : undefined,
        }));
    } catch (error) {
        console.error("Failed to fetch quote items:", error);
        return [];
    }
}

async function getServices(): Promise<Service[]> {
    try {
        const data = await api.get(API_ROUTES.PURCHASES.SERVICES_ALL, { is_sales: 'false' });
        const normalized = normalizeApiResponse(data);
        const servicesData = normalized.items;
        return servicesData.map((s: any) => ({ ...s, id: String(s.id), currency: s.currency || 'USD' }));
    } catch (error) {
        console.error("Failed to fetch services:", error);
        return [];
    }
}

async function upsertQuoteItem(itemData: QuoteItemFormValues, t: (key: string) => string) {
    const responseData = await api.post(API_ROUTES.PURCHASES.QUOTES_LINES_UPSERT, { ...itemData, is_sales: false });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : t('errors.failedToSaveQuoteItem');
        throw new Error(message);
    }
    return responseData;
}

async function deleteQuoteItem(id: string, quoteId: string, t: (key: string) => string) {
    const responseData = await api.delete(API_ROUTES.PURCHASES.QUOTES_LINES_DELETE, { id, quote_id: quoteId, is_sales: false });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : t('errors.failedToDeleteQuoteItem');
        throw new Error(message);
    }
    return responseData;
}


async function getOrders(quoteId: string, t: (key: string) => string): Promise<Order[]> {
    if (!quoteId) return [];
    try {
        const data = await api.get(API_ROUTES.PURCHASES.QUOTES_ORDERS, { quote_id: quoteId, is_sales: 'false' });
        const ordersData = Array.isArray(data) ? data : (data.orders || data.data || []);
        return ordersData.map((apiOrder: any) => ({
            id: apiOrder.id ? String(apiOrder.id) : t('defaults.notAvailable'),
            doc_no: apiOrder.doc_no || t('defaults.notAvailable'),
            user_id: apiOrder.user_id,
            user_name: apiOrder.user_name || apiOrder.name || t('defaults.notAvailable'),
            status: apiOrder.status,
            createdAt: apiOrder.created_at || apiOrder.createdAt || new Date().toISOString().split('T')[0],
            currency: apiOrder.currency || 'UYU',
            quote_id: apiOrder.quote_id,
        }));
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return [];
    }
}

async function getOrderItems(orderId: string, t: (key: string) => string): Promise<OrderItem[]> {
    if (!orderId) return [];
    try {
        const data = await api.get(API_ROUTES.PURCHASES.ORDER_ITEMS, { order_id: orderId, is_sales: 'false' });
        const itemsData = Array.isArray(data) ? data : (data.order_items || data.data || data.result || []);
        return itemsData.map((apiItem: any) => ({
            id: apiItem.order_item_id ? String(apiItem.order_item_id) : 'N/A',
            service_id: apiItem.service_id,
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
    } catch (error) {
        console.error("Failed to fetch order items:", error);
        return [];
    }
}

async function getInvoices(quoteId: string, t: (key: string) => string): Promise<Invoice[]> {
    if (!quoteId) return [];
    try {
        const data = await api.get(API_ROUTES.PURCHASES.QUOTES_INVOICES, { quote_id: quoteId, is_sales: 'false' });
        const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);
        return invoicesData.map((apiInvoice: any) => ({
            id: apiInvoice.id ? String(apiInvoice.id) : t('defaults.notAvailable'),
            invoice_ref: apiInvoice.invoice_ref || t('defaults.notAvailable'),
            doc_no: apiInvoice.doc_no || `INV-${apiInvoice.id}`,
            order_doc_no: apiInvoice.order_doc_no || t('defaults.notAvailable'),
            quote_id: apiInvoice.quote_id,
            total: apiInvoice.total || 0,
            status: apiInvoice.status || 'draft',
            createdAt: apiInvoice.createdAt || new Date().toISOString().split('T')[0],
            currency: apiInvoice.currency || 'UYU',
            order_id: apiInvoice.order_id,
            user_name: apiInvoice.user_name || t('defaults.notAvailable'),
            payment_status: apiInvoice.payment_status || 'unpaid',
            updatedAt: apiInvoice.updatedAt || new Date().toISOString().split('T')[0]
        }));
    } catch (error) {
        console.error("Failed to fetch invoices:", error);
        return [];
    }
}

async function getInvoiceItems(invoiceId: string, t: (key: string) => string): Promise<InvoiceItem[]> {
    if (!invoiceId) return [];
    try {
        const data = await api.get(API_ROUTES.PURCHASES.INVOICE_ITEMS, { invoice_id: invoiceId, is_sales: 'false' });
        const itemsData = Array.isArray(data) ? data : (data.invoice_items || data.data || []);
        return itemsData.map((apiItem: any) => ({
            id: apiItem.id ? String(apiItem.id) : t('defaults.notAvailable'),
            service_id: apiItem.service_id,
            service_name: apiItem.service_name || t('defaults.notAvailable'),
            quantity: apiItem.quantity,
            unit_price: apiItem.unit_price,
            total: apiItem.total,
        }));
    } catch (error) {
        console.error("Failed to fetch invoice items:", error);
        return [];
    }
}


async function getPayments(quoteId: string, t: (key: string) => string): Promise<Payment[]> {
    if (!quoteId) return [];
    try {
        const data = await api.get(API_ROUTES.PURCHASES.QUOTES_PAYMENTS, { quote_id: quoteId, is_sales: 'false' });
        const paymentsData = Array.isArray(data) ? data : (data.payments || data.data || []);
        return paymentsData.map((apiPayment: any) => ({
            id: apiPayment.id ? String(apiPayment.id) : t('defaults.notAvailable'),
            doc_no: apiPayment.doc_no || `PAY-${apiPayment.id}`,
            invoice_id: apiPayment.invoice_id,
            amount: parseFloat(apiPayment.amount) || 0,
            amount_applied: parseFloat(apiPayment.amount) || 0,
            source_amount: parseFloat(apiPayment.amount) || 0,
            source_currency: apiPayment.currency as 'UYU' | 'USD' || 'UYU',
            method: apiPayment.method || 'credit_card',
            payment_method: apiPayment.method || 'credit_card',
            status: apiPayment.status || 'pending',
            createdAt: apiPayment.created_at || new Date().toISOString().split('T')[0],
            payment_date: apiPayment.created_at || new Date().toISOString().split('T')[0],
            currency: apiPayment.currency || 'UYU',
            order_id: apiPayment.order_id || '',
            order_doc_no: apiPayment.order_doc_no || (apiPayment.order_id ? `ORD-${apiPayment.order_id}` : ''),
            quote_id: apiPayment.quote_id,
            user_name: apiPayment.user_name || t('defaults.notAvailable'),
            exchange_rate: parseFloat(apiPayment.exchange_rate) || 1,
            transaction_type: apiPayment.transaction_type || 'direct_payment',
            transaction_id: String(apiPayment.id),
            updatedAt: apiPayment.updated_at || new Date().toISOString().split('T')[0]
        }));
    } catch (error) {
        console.error("Failed to fetch payments:", error);
        return [];
    }
}

async function getUsers(t: (key: string) => string): Promise<User[]> {
    try {
        const responseData = await api.get(API_ROUTES.PURCHASES.USERS, { filter_type: 'PROVEEDOR' });
        const data = (Array.isArray(responseData) && responseData.length > 0) ? responseData[0] : { data: [], total: 0 };
        const usersData = Array.isArray(data.data) ? data.data : [];
        return usersData.map((apiUser: any) => ({
            id: apiUser.id ? String(apiUser.id) : t('defaults.notAvailable'),
            name: apiUser.name || t('defaults.noName'),
            email: apiUser.email || t('defaults.noEmail'),
            phone_number: apiUser.phone_number || '000-000-0000',
            is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
            avatar: '',
            identity_document: ''
        }));
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
}

async function upsertQuote(quoteData: QuoteFormValues, t: (key: string) => string) {
    const responseData = await api.post(API_ROUTES.PURCHASES.QUOTES_UPSERT, { ...quoteData, is_sales: false });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : t('errors.failedToSaveQuote');
        throw new Error(message);
    }
    return responseData;
}

async function deleteQuote(id: string, t: (key: string) => string) {
    const responseData = await api.delete(API_ROUTES.PURCHASES.QUOTE_DELETE, { id, is_sales: false });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : t('errors.failedToDeleteQuote');
        throw new Error(message);
    }
    return responseData;
}


export default function QuotesPage() {
    const t = useTranslations('QuotesPage');
    const tRoot = useTranslations();
    const tVal = useTranslations('QuotesPage');
    const { toast } = useToast();
    const { user, activeCashSession } = useAuth();
    const [quotes, setQuotes] = React.useState<Quote[]>([]);
    const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
    const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);

    const [orders, setOrders] = React.useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
    const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);

    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
    const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([]);

    const [payments, setPayments] = React.useState<Payment[]>([]);

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

    const [exchangeRate, setExchangeRate] = React.useState<number>(1);
    const [showConversion, setShowConversion] = React.useState(false);
    const [originalServicePrice, setOriginalServicePrice] = React.useState<number | null>(null);
    const [originalServiceCurrency, setOriginalServiceCurrency] = React.useState('');


    const quoteForm = useForm<QuoteFormValues>({ resolver: zodResolver(quoteFormSchema(tVal)) });
    const quoteItemForm = useForm<QuoteItemFormValues>({ resolver: zodResolver(quoteItemFormSchema(tVal)) });

    const watchedQuoteStatus = quoteForm.watch("status");
    const isStatusDraft = watchedQuoteStatus === 'draft';
    const canEditQuote = selectedQuote?.status.toLowerCase() === 'draft';

    React.useEffect(() => {
        if (isStatusDraft) {
            quoteForm.setValue('payment_status', 'unpaid');
            quoteForm.setValue('billing_status', 'not invoiced');
        }
    }, [isStatusDraft, quoteForm]);


    const loadQuotes = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedQuotes = await getQuotes(t);
        setQuotes(fetchedQuotes);
        setIsRefreshing(false);
    }, [t]);

    React.useEffect(() => {
        loadQuotes();
    }, [loadQuotes]);

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

    React.useEffect(() => {
        if (selectedQuote) {
            loadQuoteItems();
            loadOrders();
            loadInvoices();
            loadPayments();
            setSelectedOrder(null);
            setSelectedInvoice(null);
        } else {
            setQuoteItems([]);
            setOrders([]);
            setInvoices([]);
            setPayments([]);
        }
    }, [selectedQuote, loadQuoteItems, loadOrders, loadInvoices, loadPayments]);

    React.useEffect(() => {
        if (selectedOrder) {
            loadOrderItems();
        } else {
            setOrderItems([]);
        }
    }, [selectedOrder, loadOrderItems]);

    React.useEffect(() => {
        if (selectedInvoice) {
            loadInvoiceItems();
        } else {
            setInvoiceItems([]);
        }
    }, [selectedInvoice, loadInvoiceItems]);

    const handleCreateQuote = async () => {
        setEditingQuote(null);
        const sessionRate = getSessionExchangeRate();
        quoteForm.reset({ user_id: '', total: 0, currency: 'USD', status: 'draft', payment_status: 'unpaid', billing_status: 'not invoiced', exchange_rate: sessionRate });
        setQuoteSubmissionError(null);
        setAllUsers(await getUsers(t));
        setIsQuoteDialogOpen(true);
    };

    const handleEditQuote = async (quote: Quote) => {
        if (quote.status.toLowerCase() !== 'draft') {
            toast({ variant: 'destructive', title: t('errors.cannotEditQuote'), description: t('errors.cannotEditQuoteDetail') });
            return;
        }
        setEditingQuote(quote);
        const sessionRate = getSessionExchangeRate();
        quoteForm.reset({ id: quote.id, user_id: quote.user_id, total: quote.total, currency: quote.currency || 'USD', status: quote.status, payment_status: quote.payment_status as any, billing_status: quote.billing_status as any, exchange_rate: quote.exchange_rate || sessionRate });
        setQuoteSubmissionError(null);
        setAllUsers(await getUsers(t));
        setIsQuoteDialogOpen(true);
    };

    const handleDeleteQuote = (quote: Quote) => {
        if (quote.status.toLowerCase() !== 'draft') {
            toast({ variant: 'destructive', title: t('errors.cannotDeleteQuote'), description: t('errors.cannotDeleteQuoteDetail') });
            return;
        }
        setDeletingQuote(quote);
        setIsDeleteQuoteDialogOpen(true);
    };

    const confirmDeleteQuote = async () => {
        if (!deletingQuote) return;
        try {
            await deleteQuote(deletingQuote.id, t);
            toast({ title: t('toast.quoteDeleted'), description: t('toast.quoteDeleteSuccess', { id: deletingQuote.doc_no || deletingQuote.id }) });
            setIsDeleteQuoteDialogOpen(false);
            setDeletingQuote(null);
            loadQuotes();
            if (selectedQuote?.id === deletingQuote.id) setSelectedQuote(null);
        } catch (error) {
            toast({ variant: 'destructive', title: t('errors.errorTitle'), description: error instanceof Error ? error.message : t('toast.quoteDeleteError') });
        }
    };

    const onQuoteSubmit = async (values: QuoteFormValues) => {
        setQuoteSubmissionError(null);
        try {
            await upsertQuote(values, t);
            toast({ title: editingQuote ? t('toast.quoteUpdated') : t('toast.quoteCreated'), description: t('toast.quoteSaveSuccess') });
            setIsQuoteDialogOpen(false);
            loadQuotes();
        } catch (error) {
            setQuoteSubmissionError(error instanceof Error ? error.message : t('toast.quoteError'));
        }
    };

    const getSessionExchangeRate = React.useCallback(() => {
        if (!activeCashSession?.data?.opening_details?.date_rate) {
            return 1;
        }
        return activeCashSession.data.opening_details.date_rate;
    }, [activeCashSession]);

    const handleCreateQuoteItem = async () => {
        if (!selectedQuote) return;

        if (!activeCashSession?.data?.opening_details?.date_rate) {
            toast({
                variant: 'destructive',
                title: t('errors.cashSessionRequired'),
                description: t('errors.cashSessionRequiredDetail')
            });
            return;
        }

        setEditingQuoteItem(null);
        setQuoteItemSubmissionError(null);
        setShowConversion(false);
        setOriginalServicePrice(null);
        setOriginalServiceCurrency('');

        const sessionRate = getSessionExchangeRate();
        setExchangeRate(sessionRate);

        try {
            const fetchedServices = await getServices();
            setAllServices(fetchedServices);
            quoteItemForm.reset({ quote_id: selectedQuote.id, service_id: '', quantity: 1, unit_price: 0, total: 0, tooth_number: '' });
            setIsQuoteItemDialogOpen(true);
        } catch (error) {
            toast({ variant: 'destructive', title: t('errors.errorTitle'), description: t('errors.failedToLoadServices') });
        }
    };

    const handleEditQuoteItem = async (item: QuoteItem) => {
        if (!selectedQuote) return;
        try {
            const fetchedServices = await getServices();
            setAllServices(fetchedServices);
            setEditingQuoteItem(item);
            setQuoteItemSubmissionError(null);
            setShowConversion(false);

            const service = fetchedServices.find(s => String(s.id) === String(item.service_id));

            if (service) {
                const servicePrice = Number(service.price);
                setOriginalServicePrice(servicePrice);
                setOriginalServiceCurrency(service.currency || 'USD');

                const quoteCurrency = selectedQuote.currency || 'USD';
                const serviceCurrency = service.currency || 'USD';
                const conversionNeeded = quoteCurrency !== serviceCurrency;
                setShowConversion(conversionNeeded);
                setExchangeRate(1);
            } else {
                setOriginalServicePrice(null);
                setOriginalServiceCurrency('');
            }

            quoteItemForm.reset({
                id: item.id,
                quote_id: selectedQuote.id,
                service_id: String(item.service_id),
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.total,
                tooth_number: item.tooth_number || ''
            });

            setIsQuoteItemDialogOpen(true);
        } catch (error) {
            toast({ variant: 'destructive', title: t('errors.errorTitle'), description: t('errors.failedToLoadServiceData') });
        }
    };

    const handleDeleteQuoteItem = (item: QuoteItem) => {
        setDeletingQuoteItem(item);
        setIsDeleteQuoteItemDialogOpen(true);
    };

    const confirmDeleteQuoteItem = async () => {
        if (!deletingQuoteItem || !selectedQuote) return;
        try {
            await deleteQuoteItem(deletingQuoteItem.id, selectedQuote.id, t);
            toast({ title: t('toast.itemDeleted'), description: t('toast.itemDeleteSuccess') });
            loadQuoteItems();
            loadQuotes(); // To update total
        } catch (error) {
            toast({ variant: 'destructive', title: t('errors.errorTitle'), description: error instanceof Error ? error.message : t('toast.itemDeleteError') });
        } finally {
            setIsDeleteQuoteItemDialogOpen(false);
            setDeletingQuoteItem(null);
        }
    };

    const onQuoteItemSubmit = async (values: QuoteItemFormValues) => {
        setQuoteItemSubmissionError(null);
        try {
            await upsertQuoteItem(values, t);
            toast({ title: editingQuoteItem ? t('toast.itemUpdated') : t('toast.itemAdded'), description: t('toast.itemSaveSuccess') });
            setIsQuoteItemDialogOpen(false);
            loadQuoteItems();
            loadQuotes(); // To update total
        } catch (error) {
            setQuoteItemSubmissionError(error instanceof Error ? error.message : t('toast.itemError'));
        }
    };

    const handleQuoteAction = async (quote: Quote, action: 'confirm' | 'reject') => {
        try {
            const payload = { quote_number: quote.id, confirm_reject: action, is_sales: false };
            const responseData = await api.post(action === 'confirm' ? API_ROUTES.PURCHASES.QUOTE_CONFIRM : API_ROUTES.PURCHASES.QUOTE_REJECT, payload);
            if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
                const message = responseData[0]?.message ? responseData[0].message : t('toast.quoteActionError', { action: action });
                throw new Error(message);
            }
            toast({ title: action === 'confirm' ? t('toast.quoteConfirmed') : t('toast.quoteRejected'), description: t(action === 'confirm' ? 'toast.quoteConfirmSuccess' : 'toast.quoteRejectSuccess', { id: quote.doc_no || quote.id }) });
            loadQuotes();
        } catch (error) {
            toast({ variant: 'destructive', title: t('errors.errorTitle'), description: error instanceof Error ? error.message : t('toast.quoteActionError', { action: action }) });
        }
    };

    const handleRowSelectionChange = (selectedRows: Quote[]) => {
        const quote = selectedRows.length > 0 ? selectedRows[0] : null;
        setSelectedQuote(quote);
    };

    const handleOrderSelectionChange = (selectedRows: Order[]) => {
        const order = selectedRows.length > 0 ? selectedRows[0] : null;
        setSelectedOrder(order);
    };

    const handleInvoiceSelectionChange = (selectedRows: Invoice[]) => {
        const invoice = selectedRows.length > 0 ? selectedRows[0] : null;
        setSelectedInvoice(invoice);
    };

    const handleCloseDetails = () => {
        setSelectedQuote(null);
        setRowSelection({});
    };

    const watchedServiceId = quoteItemForm.watch('service_id');
    const watchedQuantity = quoteItemForm.watch('quantity');
    const watchedQuoteExchangeRate = quoteForm.watch('exchange_rate');

    React.useEffect(() => {
        const service = allServices.find(s => String(s.id) === watchedServiceId);
        if (service && selectedQuote) {
            const servicePrice = Number(service.price);

            setOriginalServicePrice(servicePrice);

            const quoteCurrency = selectedQuote.currency || 'USD';
            const serviceCurrency = service.currency || 'USD';
            setOriginalServiceCurrency(serviceCurrency);

            const conversionNeeded = quoteCurrency !== serviceCurrency;
            setShowConversion(conversionNeeded);

            let newUnitPrice = servicePrice;
            if (conversionNeeded) {
                const exchangeRate = Number(watchedQuoteExchangeRate) || getSessionExchangeRate();
                setExchangeRate(exchangeRate);
                quoteItemForm.setValue('exchange_rate', exchangeRate);

                if (quoteCurrency === 'UYU' && serviceCurrency === 'USD') {
                    newUnitPrice = servicePrice * exchangeRate;
                } else if (quoteCurrency === 'USD' && serviceCurrency === 'UYU') {
                    newUnitPrice = exchangeRate > 0 ? servicePrice / exchangeRate : 0;
                }
            } else {
                setExchangeRate(1);
            }

            const quantity = Number(watchedQuantity) || 0;
            quoteItemForm.setValue('unit_price', newUnitPrice);
            quoteItemForm.setValue('total', newUnitPrice * quantity);
        }
    }, [watchedServiceId, watchedQuantity, watchedQuoteExchangeRate, allServices, selectedQuote, quoteItemForm, getSessionExchangeRate]);

    return (
        <>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <TwoPanelLayout
                    isRightPanelOpen={!!selectedQuote}
                    leftPanel={
                        <RecentQuotesTable
                            quotes={quotes}
                            onRowSelectionChange={handleRowSelectionChange}
                            onCreate={handleCreateQuote}
                            onRefresh={loadQuotes}
                            isRefreshing={isRefreshing}
                            rowSelection={rowSelection}
                            setRowSelection={setRowSelection}
                            onEdit={handleEditQuote}
                            onDelete={handleDeleteQuote}
                            onQuoteAction={handleQuoteAction}
                            isCompact={!!selectedQuote}
                            standalone={true}
                            title={t('title')}
                            description={t('description')}
                            className="h-full"
                        />
                    }
                    rightPanel={
                        selectedQuote && (
                            <Card className="h-full border-0 lg:border shadow-none lg:shadow-sm flex flex-col min-h-0">
                                <CardHeader className="flex flex-row items-start justify-between flex-none p-4">
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="text-lg lg:text-xl truncate">{t('detailsFor', { name: selectedQuote.user_name })}</CardTitle>
                                        <CardDescription className="text-xs">{t('quoteId')}: {selectedQuote.doc_no || selectedQuote.id}</CardDescription>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                        <X className="h-5 w-5" />
                                        <span className="sr-only">{t('common.closeDetails')}</span>
                                    </Button>
                                </CardHeader>
                                <CardContent className="flex-1 flex flex-col overflow-hidden p-4 pt-0 min-h-0">
                                    <Tabs defaultValue="items" className="flex-1 flex flex-col min-h-0">
                                        <TabsList className="h-auto items-center justify-start flex-wrap flex-none bg-muted/50 p-1">
                                            <TabsTrigger value="items" className="text-xs">{t('tabs.items')}</TabsTrigger>
                                            <TabsTrigger value="orders" className="text-xs">{t('tabs.orders')}</TabsTrigger>
                                            <TabsTrigger value="invoices" className="text-xs">{t('tabs.invoices')}</TabsTrigger>
                                            <TabsTrigger value="payments" className="text-xs">{t('tabs.payments')}</TabsTrigger>
                                        </TabsList>
                                        <div className="flex-1 min-h-0 mt-4 flex flex-col">
                                            <TabsContent value="items" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                                <QuoteItemsTable
                                                    items={quoteItems}
                                                    isLoading={isLoadingItems}
                                                    onRefresh={loadQuoteItems}
                                                    isRefreshing={isLoadingItems}
                                                    canEdit={canEditQuote}
                                                    onCreate={handleCreateQuoteItem}
                                                    onEdit={handleEditQuoteItem}
                                                    onDelete={handleCreateQuoteItem}
                                                />
                                            </TabsContent>
                                            <TabsContent value="orders" className="m-0 h-full overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col pr-2">
                                                <div className="flex-1 min-h-[400px]">
                                                    <OrdersTable
                                                        orders={orders}
                                                        isLoading={isLoadingOrders}
                                                        onRowSelectionChange={handleOrderSelectionChange}
                                                        onRefresh={loadOrders}
                                                        isRefreshing={isLoadingOrders}
                                                        columnsToHide={['user_name', 'quote_id']}
                                                        isCompact={true}
                                                    />
                                                </div>
                                                {selectedOrder && (
                                                    <div className="mt-4 border-t pt-4 flex-1 flex flex-col min-h-[400px]">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className="text-sm font-semibold">{tRoot('OrderItemsTable.title', { id: selectedOrder.doc_no || selectedOrder.id })}</h4>
                                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadOrderItems} disabled={isLoadingOrderItems}>
                                                                <RefreshCw className={`h-4 w-4 ${isLoadingOrderItems ? 'animate-spin' : ''}`} />
                                                            </Button>
                                                        </div>
                                                        <OrderItemsTable items={orderItems} isLoading={isLoadingOrderItems} onItemsUpdate={loadOrderItems} quoteId={selectedQuote.id} isSales={false} userId={selectedOrder.user_id} />
                                                    </div>
                                                )}
                                            </TabsContent>
                                            <TabsContent value="invoices" className="m-0 h-full overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col pr-2">
                                                <div className="flex-1 min-h-[400px]">
                                                    <InvoicesTable
                                                        invoices={invoices}
                                                        isLoading={isLoadingInvoices}
                                                        onRowSelectionChange={handleInvoiceSelectionChange}
                                                        onRefresh={loadInvoices}
                                                        isRefreshing={isLoadingInvoices}
                                                        isCompact={true}
                                                    />
                                                </div>
                                                {selectedInvoice && (
                                                    <div className="mt-4 border-t pt-4 flex-1 flex flex-col min-h-[400px]">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className="text-sm font-semibold">{tRoot('InvoicesPage.InvoiceItemsTable.titleWithId', { id: selectedInvoice.doc_no || selectedInvoice.id })}</h4>
                                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadInvoiceItems} disabled={isLoadingInvoiceItems}>
                                                                <RefreshCw className={`h-4 w-4 ${isLoadingInvoiceItems ? 'animate-spin' : ''}`} />
                                                            </Button>
                                                        </div>
                                                        <InvoiceItemsTable items={invoiceItems} isLoading={isLoadingInvoiceItems} />
                                                    </div>
                                                )}
                                            </TabsContent>
                                            <TabsContent value="payments" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                                <PaymentsTable
                                                    payments={payments}
                                                    isLoading={isLoadingPayments}
                                                    onRefresh={loadPayments}
                                                    isRefreshing={isLoadingPayments}
                                                    columnsToHide={['quote_id', 'order_id', 'user_name']}
                                                />
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </CardContent>
                            </Card>
                        )
                    }
                />
            </div>

            <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingQuote ? t('quoteDialog.editTitle') : t('quoteDialog.createTitle')}</DialogTitle>
                        <DialogDescription>
                            {editingQuote ? t('quoteDialog.editDescription') : t('quoteDialog.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...quoteForm}>
                        <form onSubmit={quoteForm.handleSubmit(onQuoteSubmit)} className="space-y-4 py-4">
                            {quoteSubmissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('errors.errorTitle')}</AlertTitle>
                                    <AlertDescription>{quoteSubmissionError}</AlertDescription>
                                </Alert>
                            )}
                            <FormField
                                control={quoteForm.control}
                                name="user_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('quoteDialog.user')}</FormLabel>
                                        <Popover open={isUserSearchOpen} onOpenChange={setUserSearchOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                                        {field.value ? allUsers.find(user => user.id === field.value)?.name : t('quoteDialog.selectUser')}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command>
                                                    <CommandInput placeholder={t('quoteDialog.searchUser')} />
                                                    <CommandList>
                                                        <CommandEmpty>{t('quoteDialog.noUserFound')}</CommandEmpty>
                                                        <CommandGroup>
                                                            {allUsers.map((user) => (
                                                                <CommandItem value={user.name} key={user.id} onSelect={() => { quoteForm.setValue("user_id", user.id); setUserSearchOpen(false); }}>
                                                                    <Check className={cn("mr-2 h-4 w-4", user.id === field.value ? "opacity-100" : "opacity-0")} />
                                                                    {user.name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                {editingQuote && (
                                    <FormField
                                        control={quoteForm.control}
                                        name="total"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('quoteDialog.total')}</FormLabel>
                                                <FormControl>
                                                    <Input type="number" placeholder={t('placeholders.total')} {...field} disabled />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                                <FormField
                                    control={quoteForm.control}
                                    name="currency"
                                    render={({ field }) => (
                                        <FormItem className={cn(!editingQuote && 'col-span-2')}>
                                            <FormLabel>{t('quoteDialog.currency')}</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder={t('quoteDialog.selectCurrency')} /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="USD">USD</SelectItem>
                                                    <SelectItem value="UYU">UYU</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {editingQuote && (
                                <FormField
                                    control={quoteForm.control}
                                    name="exchange_rate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('quoteDialog.exchangeRate')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.0001"
                                                    placeholder={t('placeholders.exchangeRate')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            <FormField
                                control={quoteForm.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('quoteDialog.status')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={t('quoteDialog.selectStatus')} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="draft">{t('quoteDialog.draft')}</SelectItem>
                                                <SelectItem value="pending">{t('quoteDialog.pending')}</SelectItem>
                                                <SelectItem value="confirmed">{t('quoteDialog.confirmed')}</SelectItem>
                                                <SelectItem value="rejected">{t('quoteDialog.rejected')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={quoteForm.control}
                                name="payment_status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('quoteDialog.paymentStatus')}</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={isStatusDraft}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={t('quoteDialog.selectPaymentStatus')} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="unpaid">{t('quoteDialog.unpaid')}</SelectItem>
                                                <SelectItem value="partially_paid">{t('quoteDialog.partiallyPaid')}</SelectItem>
                                                <SelectItem value="paid">{t('quoteDialog.paid')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={quoteForm.control}
                                name="billing_status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('quoteDialog.billingStatus')}</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={isStatusDraft}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={t('quoteDialog.selectBillingStatus')} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="not invoiced">{t('quoteDialog.notInvoiced')}</SelectItem>
                                                <SelectItem value="partially invoiced">{t('quoteDialog.partiallyInvoiced')}</SelectItem>
                                                <SelectItem value="invoiced">{t('quoteDialog.invoiced')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsQuoteDialogOpen(false)}>{t('quoteDialog.cancel')}</Button>
                                <Button type="submit">{editingQuote ? t('quoteDialog.editSave') : t('quoteDialog.save')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteQuoteDialogOpen} onOpenChange={setIsDeleteQuoteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteQuoteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteQuoteDialog.description', { id: deletingQuote?.doc_no || deletingQuote?.id })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('deleteQuoteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteQuote} className="bg-destructive hover:bg-destructive/90">{t('deleteQuoteDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Quote Item Dialog */}
            <Dialog open={isQuoteItemDialogOpen} onOpenChange={setIsQuoteItemDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingQuoteItem ? t('itemDialog.editTitle') : t('itemDialog.createTitle')}</DialogTitle>
                        <DialogDescription>{t('itemDialog.description')}</DialogDescription>
                    </DialogHeader>
                    <Form {...quoteItemForm}>
                        <form onSubmit={quoteItemForm.handleSubmit(onQuoteItemSubmit)} className="space-y-4 py-4">
                            {quoteItemSubmissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('errors.errorTitle')}</AlertTitle>
                                    <AlertDescription>{quoteItemSubmissionError}</AlertDescription>
                                </Alert>
                            )}
                            <FormField
                                control={quoteItemForm.control}
                                name="service_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('itemDialog.service')}</FormLabel>
                                        <Popover open={isServiceSearchOpen} onOpenChange={setServiceSearchOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                                        {field.value ? allServices.find(s => s.id === field.value)?.name : t('itemDialog.selectService')}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command>
                                                    <CommandInput placeholder={t('itemDialog.searchService')} />
                                                    <CommandList>
                                                        <CommandEmpty>{t('itemDialog.noServiceFound')}</CommandEmpty>
                                                        <CommandGroup>
                                                            {allServices.map((service) => (
                                                                <CommandItem value={service.name} key={service.id} onSelect={() => { quoteItemForm.setValue("service_id", String(service.id)); setServiceSearchOpen(false); }}>
                                                                    <Check className={cn("mr-2 h-4 w-4", String(service.id) === field.value ? "opacity-100" : "opacity-0")} />
                                                                    {service.name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={quoteItemForm.control}
                                name="tooth_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('itemDialog.toothNumber')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder={t('placeholders.toothNumber')}
                                                {...field}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    field.onChange(value === '' ? '' : Number(value));
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {showConversion && (
                                <div className="grid grid-cols-2 gap-4">
                                    <FormItem>
                                        <FormLabel>{t('itemDialog.originalPrice')} ({originalServiceCurrency})</FormLabel>
                                        <Input
                                            value={originalServicePrice !== null ? Number(originalServicePrice).toFixed(2) : ''}
                                            readOnly
                                            disabled
                                        />
                                    </FormItem>
                                    <FormField
                                        control={quoteItemForm.control}
                                        name="exchange_rate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('itemDialog.exchangeRate')}</FormLabel>
                                                <Input
                                                    type="number"
                                                    value={exchangeRate}
                                                    onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                                                />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                            <FormField control={quoteItemForm.control} name="quantity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('itemDialog.quantity')}</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={quoteItemForm.control} name="unit_price" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('itemDialog.unitPrice')} ({selectedQuote?.currency})</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={quoteItemForm.control} name="total" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('itemDialog.total')}</FormLabel>
                                    <FormControl><Input type="number" readOnly disabled {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsQuoteItemDialogOpen(false)}>{t('itemDialog.cancel')}</Button>
                                <Button type="submit">{editingQuoteItem ? t('itemDialog.editSave') : t('itemDialog.save')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteQuoteItemDialogOpen} onOpenChange={setIsDeleteQuoteItemDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteItemDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteItemDialog.description')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('deleteItemDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteQuoteItem} className="bg-destructive hover:bg-destructive/90">{t('deleteItemDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
