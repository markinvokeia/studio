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
import { cn } from '@/lib/utils';
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
    Star, 
    Printer, 
    Send, 
    Edit3, 
    DollarSign, 
    CreditCard,
    PlusCircle,
    User as UserIcon
} from 'lucide-react';
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


async function getQuotes(t: (key: string) => string): Promise<Quote[]> {
    try {
        const data = await api.get(API_ROUTES.PURCHASES.QUOTES_ALL, { is_sales: 'true' });
        const normalized = normalizeApiResponse(data);
        const quotesData = normalized.items;

        return quotesData.map((apiQuote: any) => ({
            id: apiQuote.id ? String(apiQuote.id) : t('defaults.notAvailable'),
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
        const data = await api.get(API_ROUTES.SALES.QUOTES_ITEMS, { quote_id: quoteId });
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
        const data = await api.get(API_ROUTES.SERVICES, { is_sales: 'true' });
        const normalized = normalizeApiResponse(data);
        const servicesData = normalized.items;
        return servicesData.map((s: any) => ({ ...s, id: String(s.id), currency: s.currency || 'USD' }));
    } catch (error) {
        console.error("Failed to fetch services:", error);
        return [];
    }
}

async function upsertQuoteItem(itemData: QuoteItemFormValues, t: (key: string) => string) {
    const responseData = await api.post(API_ROUTES.SALES.QUOTES_LINES_UPSERT, { ...itemData, tooth_number: null, is_sales: true });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : t('errors.failedToSaveQuoteItem');
        throw new Error(message);
    }
    return responseData;
}

async function deleteQuoteItem(id: string, quoteId: string, t: (key: string) => string) {
    const responseData = await api.delete(API_ROUTES.SALES.QUOTES_LINES_DELETE, { id, quote_id: quoteId, is_sales: true });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : t('errors.failedToDeleteQuoteItem');
        throw new Error(message);
    }
    return responseData;
}


async function getOrders(quoteId: string, t: (key: string) => string): Promise<Order[]> {
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
            updatedAt: apiOrder.updated_at || apiOrder.updatedAt || new Date().toISOString().split('T')[0],
            currency: apiOrder.currency || 'UYU',
        }));
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return [];
    }
}

async function getOrderItems(orderId: string, t: (key: string) => string): Promise<OrderItem[]> {
    if (!orderId) return [];
    try {
        const data = await api.get(API_ROUTES.SALES.ORDER_ITEMS, { order_id: orderId });
        const itemsData = Array.isArray(data) ? data : (data.order_items || data.data || data.result || []);
        return itemsData.map((apiItem: any) => ({
            id: apiItem.order_item_id ? String(apiItem.order_item_id) : t('defaults.notAvailable'),
            service_id: apiItem.service_id || apiItem.serviceId || apiItem.id,
            service_name: apiItem.service_name || t('defaults.notAvailable'),
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
        const data = await api.get(API_ROUTES.SALES.QUOTES_INVOICES, { quote_id: quoteId });
        const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);
        return invoicesData.map((apiInvoice: any) => ({
            id: apiInvoice.id ? String(apiInvoice.id) : t('defaults.notAvailable'),
            invoice_ref: apiInvoice.invoice_ref || t('defaults.notAvailable'),
            doc_no: apiInvoice.doc_no || `INV-${apiInvoice.id}`,
            order_doc_no: apiInvoice.order_doc_no || t('defaults.notAvailable'),
            quote_id: apiInvoice.quote_id,
            total: parseFloat(apiInvoice.total) || 0,
            status: apiInvoice.status || 'draft',
            createdAt: apiInvoice.created_at || apiInvoice.createdAt || new Date().toISOString(),
            currency: apiInvoice.currency || 'USD',
            order_id: apiInvoice.order_id,
            user_name: apiInvoice.user_name || apiInvoice.name || t('defaults.notAvailable'),
            user_id: apiInvoice.user_id,
            payment_status: apiInvoice.payment_state || apiInvoice.payment_status || 'unpaid',
            paid_amount: parseFloat(apiInvoice.paid_amount) || 0,
            type: apiInvoice.type || 'invoice',
            updatedAt: apiInvoice.updated_at || apiInvoice.updatedAt || new Date().toISOString()
        }));
    } catch (error) {
        console.error("Failed to fetch invoices:", error);
        return [];
    }
}

async function getInvoiceItems(invoiceId: string, t: (key: string) => string): Promise<InvoiceItem[]> {
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
    } catch (error) {
        console.error("Failed to fetch invoice items:", error);
        return [];
    }
}


function hasValidPayments(paymentsData: any[]): boolean {
    if (!Array.isArray(paymentsData) || paymentsData.length === 0) {
        return false;
    }

    const firstItem = paymentsData[0];

    if (!firstItem || typeof firstItem !== 'object') {
        return false;
    }

    const isNewFormat = firstItem.amount_applied !== undefined && typeof firstItem.amount_applied === 'string';
    const isOldFormat = firstItem.amount !== undefined || firstItem.converted_amount !== undefined;

    return isNewFormat || isOldFormat;
}


async function getPayments(quoteId: string, t: (key: string) => string): Promise<Payment[]> {
    if (!quoteId) return [];
    try {
        const data = await api.get(API_ROUTES.SALES.QUOTES_PAYMENTS, { quote_id: quoteId });
        const paymentsData = Array.isArray(data) ? data : (data.payments || data.data || []);

        if (!hasValidPayments(paymentsData)) {
            return [];
        }

        const isNewFormat = paymentsData[0].amount_applied !== undefined && typeof paymentsData[0].amount_applied === 'string';

        return paymentsData.map((apiPayment: any) => ({
            id: apiPayment.transaction_id ? String(apiPayment.transaction_id) : (apiPayment.id ? String(apiPayment.id) : t('defaults.notAvailable')),
            doc_no: apiPayment.doc_no || (apiPayment.transaction_doc_no ? String(apiPayment.transaction_doc_no) : 'N/A'),
            invoice_id: apiPayment.invoice_id || '',
            invoice_doc_no: apiPayment.invoice_doc_no || 'N/A',
            amount: isNewFormat ? parseFloat(apiPayment.amount_applied) : (parseFloat(apiPayment.amount) || 0),
            amount_applied: isNewFormat ? parseFloat(apiPayment.amount_applied) : (parseFloat(apiPayment.amount) || 0),
            source_amount: isNewFormat ? parseFloat(apiPayment.source_amount) : (parseFloat(apiPayment.amount) || 0),
            source_currency: (isNewFormat ? apiPayment.source_currency : apiPayment.currency) as 'UYU' | 'USD' || 'UYU',
            method: apiPayment.payment_method_name || apiPayment.method,
            payment_method: apiPayment.payment_method_name || apiPayment.method,
            payment_method_code: apiPayment.payment_method_code,
            status: apiPayment.status || 'completed',
            createdAt: apiPayment.payment_date || apiPayment.created_at,
            payment_date: apiPayment.payment_date || apiPayment.created_at,
            currency: isNewFormat ? apiPayment.invoice_currency : apiPayment.currency,
            order_id: apiPayment.order_id || '',
            order_doc_no: apiPayment.order_doc_no || 'N/A',
            quote_id: apiPayment.quote_id || '',
            user_name: apiPayment.user_name || t('defaults.notAvailable'),
            exchange_rate: isNewFormat ? parseFloat(apiPayment.exchange_rate) : (parseFloat(apiPayment.exchange_rate) || 1),
            transaction_type: apiPayment.transaction_type || 'direct_payment',
            transaction_id: apiPayment.transaction_id ? String(apiPayment.transaction_id) : String(apiPayment.id),
            updatedAt: apiPayment.payment_date || apiPayment.updated_at || apiPayment.created_at
        }));
    } catch (error) {
        console.error("Failed to fetch payments:", error);
        return [];
    }
}

async function getUsers(t: (key: string) => string): Promise<User[]> {
    try {
        const responseData = await api.get(API_ROUTES.SALES.USERS, { filter_type: 'PACIENTE' });
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
    const responseData = await api.post(API_ROUTES.SALES.QUOTES_UPSERT, { ...quoteData, is_sales: true });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : t('errors.failedToSaveQuote');
        throw new Error(message);
    }
    return responseData;
}

async function deleteQuote(id: string, t: (key: string) => string) {
    const responseData = await api.delete(API_ROUTES.SALES.QUOTE_DELETE, { id, is_sales: true });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : t('errors.failedToDeleteQuote');
        throw new Error(message);
    }
    return responseData;
}

async function getClinic(): Promise<Clinic | null> {
    try {
        const data = await api.get(API_ROUTES.CLINIC);
        const clinicsData = Array.isArray(data) ? data : (data.clinics || data.data || data.result || []);
        if (clinicsData.length === 0) return null;
        const apiClinic = clinicsData[0];
        return {
            id: apiClinic.id ? String(apiClinic.id) : '',
            name: apiClinic.name || '',
            location: apiClinic.address || '',
            contact_email: apiClinic.email || '',
            phone_number: apiClinic.phone || '',
            currency: apiClinic.currency || 'UYU',
        };
    } catch (error) {
        console.error("Failed to fetch clinic:", error);
        return null;
    }
}


export default function QuotesPage() {
    return <QuotesPageContent />;
}

function QuotesPageContent() {
    const t = useTranslations('QuotesPage');
    const tRoot = useTranslations();
    const tVal = useTranslations('QuotesPage');
    const tInvoiceItems = useTranslations('InvoicesPage.InvoiceItemsTable');
    const { toast } = useToast();
    const { user, activeCashSession } = useAuth();
    const { hasPermission } = usePermissions();

    // Permission checks
    const canViewList = hasPermission(SALES_PERMISSIONS.QUOTES_VIEW_LIST);
    const canCreateQuote = hasPermission(SALES_PERMISSIONS.QUOTES_CREATE);
    const canUpdateQuote = hasPermission(SALES_PERMISSIONS.QUOTES_UPDATE);
    const canDeleteQuote = hasPermission(SALES_PERMISSIONS.QUOTES_DELETE);
    const canConfirmQuote = hasPermission(SALES_PERMISSIONS.QUOTES_CONFIRM);
    const canRejectQuote = hasPermission(SALES_PERMISSIONS.QUOTES_REJECT);
    const canAddItem = hasPermission(SALES_PERMISSIONS.QUOTES_ADD_ITEM);
    const canUpdateItem = hasPermission(SALES_PERMISSIONS.QUOTES_UPDATE_ITEM);
    const canDeleteItem = hasPermission(SALES_PERMISSIONS.QUOTES_DELETE_ITEM);

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
    const [isSendingEmail, setIsSendingEmail] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

    const [exchangeRate, setExchangeRate] = React.useState<number>(1);
    const [showConversion, setShowConversion] = React.useState(false);
    const [originalServicePrice, setOriginalServicePrice] = React.useState<number | null>(null);
    const [originalServiceCurrency, setOriginalServiceCurrency] = React.useState('');


    const quoteForm = useForm<QuoteFormValues>({ resolver: zodResolver(quoteFormSchema(tVal)), mode: 'onBlur' });
    const quoteItemForm = useForm<QuoteItemFormValues>({ resolver: zodResolver(quoteItemFormSchema(tVal)), mode: 'onBlur' });

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

    React.useEffect(() => {
        getClinic().then(setClinic);
    }, []);

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

    const loadUsersForQuoteDialog = React.useCallback(async () => {
        try {
            setAllUsers(await getUsers(t));
        } catch (error) {
            toast({ variant: 'destructive', title: t('errors.errorTitle'), description: t('errors.failedToLoadUsers') });
        }
    }, [t, toast]);

    const handleCreateQuote = async () => {
        setEditingQuote(null);
        const sessionRate = getSessionExchangeRate();
        const defaultCurrency = clinic?.currency || 'UYU';
        const exchangeRate = defaultCurrency === clinic?.currency ? 1 : sessionRate;
        quoteForm.reset({ user_id: '', total: 0, currency: defaultCurrency, status: 'draft', payment_status: 'unpaid', billing_status: 'not invoiced', exchange_rate: exchangeRate });
        setQuoteSubmissionError(null);
        setIsQuoteDialogOpen(true);
        if (allUsers.length === 0) {
            void loadUsersForQuoteDialog();
        }
    };

    const handleEditQuote = async (quote: Quote) => {
        if (quote.status.toLowerCase() !== 'draft') {
            toast({ variant: 'destructive', title: t('errors.cannotEdit'), description: t('errors.cannotEditDetail') });
            return;
        }
        setEditingQuote(quote);
        const sessionRate = getSessionExchangeRate();
        const exchangeRate = quote.currency === clinic?.currency ? 1 : (quote.exchange_rate || sessionRate);
        quoteForm.reset({ id: quote.id, user_id: quote.user_id, total: quote.total, currency: quote.currency || 'USD', status: quote.status, payment_status: quote.payment_status as any, billing_status: quote.billing_status as any, exchange_rate: exchangeRate });
        setQuoteSubmissionError(null);
        setIsQuoteDialogOpen(true);
        if (allUsers.length === 0) {
            void loadUsersForQuoteDialog();
        }
    };

    const handleDeleteQuote = (quote: Quote) => {
        if (quote.status.toLowerCase() !== 'draft') {
            toast({ variant: 'destructive', title: t('errors.cannotDelete'), description: t('errors.cannotDeleteDetail') });
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

        setEditingQuoteItem(null);
        setQuoteItemSubmissionError(null);
        setShowConversion(false);
        setOriginalServicePrice(null);
        setOriginalServiceCurrency('');

        const sessionRate = getSessionExchangeRate();
        setExchangeRate(sessionRate);

        quoteItemForm.reset({ quote_id: selectedQuote.id, service_id: '', quantity: 1, unit_price: 0, total: 0, tooth_number: '' });
        setIsQuoteItemDialogOpen(true);

        if (allServices.length === 0) {
            try {
                const fetchedServices = await getServices();
                setAllServices(fetchedServices);
            } catch (error) {
                toast({ variant: 'destructive', title: t('errors.errorTitle'), description: t('errors.failedToLoadServices') });
            }
        }
    };

    const handleEditQuoteItem = async (item: QuoteItem) => {
        if (!selectedQuote) return;
        try {
            const fetchedServices = allServices.length > 0 ? allServices : await getServices();
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
            } else {
                setEditingQuoteItem(item);
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
            }
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
            const payload = { quote_number: quote.id, confirm_reject: action, is_sales: true };
            const endpoint = action === 'confirm' ? API_ROUTES.SALES.QUOTE_CONFIRM : API_ROUTES.SALES.QUOTE_REJECT;
            const responseData = await api.post(endpoint, payload);
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
    const watchedQuoteCurrency = quoteForm.watch('currency');
    const isClinicCurrency = watchedQuoteCurrency === (clinic?.currency || 'UYU');

    React.useEffect(() => {
        if (isClinicCurrency) {
            if (watchedQuoteExchangeRate !== 1) {
                quoteForm.setValue('exchange_rate', 1);
            }
        } else {
            const sessionRate = getSessionExchangeRate();
            if (watchedQuoteExchangeRate === 1 || !watchedQuoteExchangeRate) {
                quoteForm.setValue('exchange_rate', sessionRate);
            }
        }
    }, [isClinicCurrency, watchedQuoteExchangeRate, quoteForm, getSessionExchangeRate]);

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

                if (quoteCurrency === 'UYU' && serviceCurrency === 'USD') {
                    newUnitPrice = servicePrice * exchangeRate;
                } else if (quoteCurrency === 'USD' && serviceCurrency === 'UYU') {
                    newUnitPrice = exchangeRate > 0 ? servicePrice / exchangeRate : 0;
                }
            }

            const quantity = Number(watchedQuantity) || 0;
            const roundedUnitPrice = Math.round(newUnitPrice * 100) / 100;
            const roundedTotal = Math.round((roundedUnitPrice * quantity) * 100) / 100;
            quoteItemForm.setValue('unit_price', roundedUnitPrice);
            quoteItemForm.setValue('total', roundedTotal);
        }
    }, [watchedServiceId, watchedQuantity, watchedQuoteExchangeRate, allServices, selectedQuote, quoteItemForm, getSessionExchangeRate]);

    const ActionButton = ({ onClick, icon: Icon, label, variant = "ghost", disabled = false, className = "" }: { onClick: () => void, icon: any, label: string, variant?: any, disabled?: boolean, className?: string }) => (
        <Button
            variant={variant}
            size="sm"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            disabled={disabled}
            className={cn(
                "flex flex-col items-center justify-center h-14 w-16 p-1 gap-1 text-[9px] font-bold uppercase transition-colors",
                className
            )}
        >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap text-center leading-none">{label}</span>
        </Button>
    );

    return (
        <>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <TwoPanelLayout
                    isRightPanelOpen={!!selectedQuote}
                    leftPanel={
                        <RecentQuotesTable
                            quotes={quotes}
                            onRowSelectionChange={handleRowSelectionChange}
                            onCreate={canCreateQuote ? handleCreateQuote : undefined}
                            onRefresh={loadQuotes}
                            isRefreshing={isRefreshing}
                            rowSelection={rowSelection}
                            setRowSelection={setRowSelection}
                            onEdit={canUpdateQuote ? handleEditQuote : undefined}
                            onDelete={canDeleteQuote ? handleDeleteQuote : undefined}
                            onQuoteAction={(canConfirmQuote || canRejectQuote) ? handleQuoteAction : undefined}
                            isCompact={true}
                            standalone={true}
                            title={t('title')}
                            description={t('description')}
                            className="h-full"
                            isSendingEmail={isSendingEmail}
                            setIsSendingEmail={setIsSendingEmail}
                        />
                    }
                    rightPanel={
                        selectedQuote && (
                            <div className="flex h-full min-h-0 bg-background overflow-hidden">
                                <Tabs defaultValue="items" className="flex flex-1 min-h-0 overflow-hidden" orientation="vertical">
                                    {/* Sidebar Vertical Tabs */}
                                    <TabsList className="vertical-tabs-list shrink-0 border-r bg-muted/10 p-0 rounded-none w-20">
                                        <TabsTrigger value="items" className="vertical-tab-trigger h-20 w-20" title={t('tabs.items')}>
                                            <div className="flex flex-col items-center gap-1.5">
                                                <DollarSign className="h-5 w-5" />
                                                <span className="text-[9px] font-bold uppercase tracking-tight">{t('tabs.items')}</span>
                                            </div>
                                        </TabsTrigger>
                                        <TabsTrigger value="orders" className="vertical-tab-trigger h-20 w-20" title={t('tabs.orders')}>
                                            <div className="flex flex-col items-center gap-1.5">
                                                <ShoppingCart className="h-5 w-5" />
                                                <span className="text-[9px] font-bold uppercase tracking-tight">{t('tabs.orders')}</span>
                                            </div>
                                        </TabsTrigger>
                                        <TabsTrigger value="invoices" className="vertical-tab-trigger h-20 w-20" title={t('tabs.invoices')}>
                                            <div className="flex flex-col items-center gap-1.5">
                                                <Receipt className="h-5 w-5" />
                                                <span className="text-[9px] font-bold uppercase tracking-tight">{t('tabs.invoices')}</span>
                                            </div>
                                        </TabsTrigger>
                                        <TabsTrigger value="payments" className="vertical-tab-trigger h-20 w-20" title={t('tabs.payments')}>
                                            <div className="flex flex-col items-center gap-1.5">
                                                <CreditCard className="h-5 w-5" />
                                                <span className="text-[9px] font-bold uppercase tracking-tight">{t('tabs.payments')}</span>
                                            </div>
                                        </TabsTrigger>
                                        <div className="mt-auto pb-4">
                                            {canUpdateQuote && selectedQuote.status.toLowerCase() === 'draft' && (
                                                <TabsTrigger value="edit" className="vertical-tab-trigger h-20 w-20" title={t('edit')}>
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        <Edit3 className="h-5 w-5" />
                                                        <span className="text-[9px] font-bold uppercase tracking-tight">{t('edit')}</span>
                                                    </div>
                                                </TabsTrigger>
                                            )}
                                        </div>
                                    </TabsList>

                                    {/* Main Content Area */}
                                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                                        {/* Header */}
                                        <div className="flex flex-col flex-none p-6 border-b bg-card">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                                                    <div className="flex flex-col">
                                                        <h2 className="text-2xl font-black tracking-tight">{selectedQuote.doc_no || `Presupuesto #${selectedQuote.id}`}</h2>
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold uppercase tracking-wide">
                                                            <UserIcon className="h-4 w-4" />
                                                            <span>{selectedQuote.user_name}</span>
                                                        </div>
                                                        
                                                        {/* NEW COMPACT SUMMARY LINE */}
                                                        <div className="flex items-center gap-3 px-3 py-1.5 bg-accent/5 rounded-full border border-accent/10 w-fit mt-3 shadow-sm">
                                                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
                                                                <div className={cn(
                                                                    "h-2 w-2 rounded-full",
                                                                    (selectedQuote.status.toLowerCase() === 'confirmed' || selectedQuote.status.toLowerCase() === 'accepted') ? "bg-green-500" :
                                                                    selectedQuote.status.toLowerCase() === 'draft' ? "bg-slate-400" : "bg-blue-500"
                                                                )} />
                                                                <span className={cn(
                                                                    (selectedQuote.status.toLowerCase() === 'confirmed' || selectedQuote.status.toLowerCase() === 'accepted') ? "text-green-700" :
                                                                    selectedQuote.status.toLowerCase() === 'draft' ? "text-slate-600" : "text-blue-700"
                                                                )}>
                                                                    {t(`quoteDialog.${selectedQuote.status.toLowerCase()}` as any)}
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="h-3 w-px bg-border" />
                                                            
                                                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
                                                                <FileText className="h-3 w-3 text-blue-600" />
                                                                <span className="text-blue-700">
                                                                    {t(`quoteDialog.${selectedQuote.billing_status.toLowerCase().replace(/\s+/g, '_')}` as any)}
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="h-3 w-px bg-border" />
                                                            
                                                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
                                                                <CreditCard className="h-3 w-3 text-emerald-600" />
                                                                <span className="text-emerald-700">
                                                                    {t(`quoteDialog.${selectedQuote.payment_status.toLowerCase().replace(/\s+/g, '_')}` as any)}
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="ml-4 pl-4 border-l border-border flex items-center gap-2">
                                                                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Monto Total:</span>
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className="text-[10px] font-bold text-primary">{selectedQuote.currency}</span>
                                                                    <span className="text-sm font-black text-primary">
                                                                        {new Intl.NumberFormat('es-UY', {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2
                                                                        }).format(Number(selectedQuote.total))}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-3">
                                                    {/* Confirm/Reject Actions */}
                                                    {(selectedQuote.status.toLowerCase() === 'draft' || selectedQuote.status.toLowerCase() === 'pending') && (
                                                        <div className="flex items-center gap-2 mr-2 pr-4 border-r">
                                                            <ActionButton 
                                                                onClick={() => handleQuoteAction(selectedQuote, 'confirm')} 
                                                                icon={Check} 
                                                                label={t('confirm')} 
                                                                variant="default"
                                                                className="bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm"
                                                            />
                                                            <ActionButton 
                                                                onClick={() => handleQuoteAction(selectedQuote, 'reject')} 
                                                                icon={X} 
                                                                label={t('reject')} 
                                                                className="text-rose-600 hover:bg-rose-50 rounded-lg"
                                                            />
                                                        </div>
                                                    )}
                                                    
                                                    {/* Common Actions */}
                                                    <div className="flex items-center gap-1">
                                                        <ActionButton onClick={() => handlePrintQuote(selectedQuote)} icon={Printer} label={t('print')} className="rounded-lg" />
                                                        <ActionButton onClick={() => handleSendEmailClick(selectedQuote)} icon={Send} label={t('sendEmail')} className="rounded-lg" />
                                                    </div>
                                                    
                                                    <Button variant="ghost" size="icon" onClick={handleCloseDetails} className="ml-2 hover:bg-destructive/10 hover:text-destructive transition-colors">
                                                        <X className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content Tabs */}
                                        <div className="flex-1 overflow-hidden p-6 bg-card/30">
                                            <TabsContent value="items" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="font-black text-lg flex items-center gap-2 text-primary">
                                                        <DollarSign className="h-5 w-5" />
                                                        {t('tabs.items')}
                                                    </h3>
                                                    {canEditQuote && canAddItem && (
                                                        <Button onClick={handleCreateQuoteItem} size="sm" className="gap-2 font-bold uppercase text-[10px] h-8">
                                                            <PlusCircle className="h-4 w-4" /> {t('addItem')}
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-h-0">
                                                    <QuoteItemsTable
                                                        items={quoteItems}
                                                        isLoading={isLoadingItems}
                                                        onRefresh={loadQuoteItems}
                                                        isRefreshing={isLoadingItems}
                                                        canEdit={canEditQuote && canUpdateItem}
                                                        onCreate={handleCreateQuoteItem}
                                                        onEdit={handleEditQuoteItem}
                                                        onDelete={handleDeleteQuoteItem}
                                                        showToothNumber={true}
                                                    />
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="orders" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                                <TwoPanelLayout
                                                    isRightPanelOpen={!!selectedOrder}
                                                    leftPanel={
                                                        <div className="h-full flex flex-col min-h-0">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h3 className="font-black text-lg flex items-center gap-2 text-primary">
                                                                    <ShoppingCart className="h-5 w-5" />
                                                                    {t('tabs.orders')}
                                                                </h3>
                                                            </div>
                                                            <div className="flex-1 min-h-0">
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
                                                        </div>
                                                    }
                                                    rightPanel={
                                                        selectedOrder && (
                                                            <Card className="h-full border shadow-sm flex flex-col min-h-0 animate-in slide-in-from-left duration-300">
                                                                <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-muted/30">
                                                                    <div className="flex flex-col">
                                                                        <CardTitle className="text-sm font-black">{tRoot('OrderItemsTable.title', { id: selectedOrder.doc_no || selectedOrder.id })}</CardTitle>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadOrderItems} disabled={isLoadingOrderItems}>
                                                                            <RefreshCw className={cn("h-4 w-4", isLoadingOrderItems && "animate-spin")} />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedOrder(null)}>
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </CardHeader>
                                                                <CardContent className="flex-1 overflow-hidden p-0">
                                                                    <OrderItemsTable
                                                                        items={orderItems}
                                                                        isLoading={isLoadingOrderItems}
                                                                        onItemsUpdate={loadOrderItems}
                                                                        quoteId={selectedQuote.id}
                                                                        isSales={true}
                                                                        userId={selectedOrder.user_id}
                                                                        patient={{
                                                                            id: selectedOrder.user_id,
                                                                            name: selectedOrder.user_name || 'Patient',
                                                                            email: '',
                                                                            phone_number: '',
                                                                            is_active: true,
                                                                            avatar: ''
                                                                        }}
                                                                    />
                                                                </CardContent>
                                                            </Card>
                                                        )
                                                    }
                                                />
                                            </TabsContent>

                                            <TabsContent value="invoices" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                                <TwoPanelLayout
                                                    isRightPanelOpen={!!selectedInvoice}
                                                    leftPanel={
                                                        <div className="h-full flex flex-col min-h-0">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h3 className="font-black text-lg flex items-center gap-2 text-primary">
                                                                    <Receipt className="h-5 w-5" />
                                                                    {t('tabs.invoices')}
                                                                </h3>
                                                            </div>
                                                            <div className="flex-1 min-h-0">
                                                                <InvoicesTable
                                                                    invoices={invoices}
                                                                    isLoading={isLoadingInvoices}
                                                                    onRowSelectionChange={handleInvoiceSelectionChange}
                                                                    onRefresh={loadInvoices}
                                                                    isRefreshing={isLoadingInvoices}
                                                                    isCompact={true}
                                                                    canCreate={false}
                                                                    columnTranslations={{
                                                                        doc_no: tRoot('InvoicesPage.columns.docNo'),
                                                                        user_name: tRoot('InvoicesPage.columns.userName'),
                                                                        total: tRoot('InvoicesPage.columns.total'),
                                                                        currency: tRoot('InvoicesPage.columns.currency'),
                                                                        status: tRoot('InvoicesPage.columns.status'),
                                                                        type: tRoot('InvoicesPage.columns.type'),
                                                                        payment_status: tRoot('InvoicesPage.columns.paymentStatus'),
                                                                        paid_amount: tRoot('InvoicesPage.columns.paidAmount'),
                                                                        createdAt: tRoot('InvoicesPage.columns.createdAt'),
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    }
                                                    rightPanel={
                                                        selectedInvoice && (
                                                            <Card className="h-full border shadow-sm flex flex-col min-h-0 animate-in slide-in-from-left duration-300">
                                                                <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-muted/30">
                                                                    <div className="flex flex-col">
                                                                        <CardTitle className="text-sm font-black">{tRoot('InvoiceItemsTable.titleWithId', { id: selectedInvoice.doc_no || selectedInvoice.id })}</CardTitle>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadInvoiceItems} disabled={isLoadingInvoiceItems}>
                                                                            <RefreshCw className={cn("h-4 w-4", isLoadingInvoiceItems && "animate-spin")} />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedInvoice(null)}>
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </CardHeader>
                                                                <CardContent className="flex-1 overflow-hidden p-0">
                                                                    <InvoiceItemsTable items={invoiceItems} isLoading={isLoadingInvoiceItems} />
                                                                </CardContent>
                                                            </Card>
                                                        )
                                                    }
                                                />
                                            </TabsContent>

                                            <TabsContent value="payments" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="font-black text-lg flex items-center gap-2 text-primary">
                                                        <CreditCard className="h-5 w-5" />
                                                        {t('tabs.payments')}
                                                    </h3>
                                                </div>
                                                <div className="flex-1 min-h-0">
                                                    <PaymentsTable
                                                        payments={payments}
                                                        isLoading={isLoadingPayments}
                                                        onRefresh={loadPayments}
                                                        isRefreshing={isLoadingPayments}
                                                        columnsToHide={['quote_id', 'order_id', 'user_name']}
                                                    />
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="edit" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="font-black text-lg flex items-center gap-2 text-primary">
                                                        <Edit3 className="h-5 w-5" />
                                                        {t('edit')}
                                                    </h3>
                                                </div>
                                                <ScrollArea className="flex-1 bg-background rounded-xl border p-8">
                                                    <div className="max-w-md mx-auto space-y-6">
                                                        <div className="p-6 bg-muted/20 rounded-xl border text-center space-y-4">
                                                            <Edit3 className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                                                            <div>
                                                                <p className="font-bold text-foreground">{t('quoteDialog.editTitle')}</p>
                                                                <p className="text-sm text-muted-foreground mt-1">Utilice el botón Editar del encabezado principal o modifique los items directamente en la pestaña correspondiente.</p>
                                                            </div>
                                                            <Button onClick={() => handleEditQuote(selectedQuote)} variant="outline" className="w-full font-bold uppercase tracking-wider h-10">
                                                                Abrir Editor de Encabezado
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </ScrollArea>
                                            </TabsContent>
                                        </div>
                                    </div>
                                </Tabs>
                            </div>
                        )
                    }
                />
            </div>

            <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingQuote ? t('quoteDialog.editTitle') : t('quoteDialog.createTitle')}</DialogTitle>
                        <DialogDescription>
                            {editingQuote ? t('quoteDialog.editDescription') : t('quoteDialog.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...quoteForm}>
                        <form onSubmit={quoteForm.handleSubmit(onQuoteSubmit)} className="flex flex-col flex-1 overflow-hidden">
                            <DialogBody className="space-y-4 py-4 px-6">
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
                                                        step="0.01"
                                                        placeholder={t('placeholders.exchangeRate')}
                                                        value={field.value ? Number(field.value).toFixed(2) : ''}
                                                        disabled={isClinicCurrency}
                                                        onChange={(e) => {
                                                            if (isClinicCurrency) {
                                                                field.onChange(1);
                                                            } else {
                                                                field.onChange(parseFloat(e.target.value) || 0);
                                                            }
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit">{editingQuote ? t('quoteDialog.editSave') : t('quoteDialog.save')}</Button>
                                <Button type="button" variant="outline" onClick={() => setIsQuoteDialogOpen(false)}>{t('quoteDialog.cancel')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteQuoteDialogOpen} onOpenChange={setIsDeleteQuoteDialogOpen}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteQuoteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteQuoteDialog.description', { id: deletingQuote?.doc_no || deletingQuote?.id })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={confirmDeleteQuote} className="bg-destructive hover:bg-destructive/90">{t('deleteQuoteDialog.confirm')}</AlertDialogAction>
                        <AlertDialogCancel>{t('deleteQuoteDialog.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Quote Item Dialog */}
            <Dialog open={isQuoteItemDialogOpen} onOpenChange={setIsQuoteItemDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingQuoteItem ? t('itemDialog.editTitle') : t('itemDialog.createTitle')}</DialogTitle>
                        <DialogDescription>{t('itemDialog.description')}</DialogDescription>
                    </DialogHeader>
                    <Form {...quoteItemForm}>
                        <form onSubmit={quoteItemForm.handleSubmit(onQuoteItemSubmit)} className="flex flex-col flex-1 overflow-hidden">
                            <DialogBody className="space-y-4 py-4 px-6">
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

                                {showConversion && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormItem>
                                            <FormLabel>{t('itemDialog.originalPrice')} ({originalServiceCurrency})</FormLabel>
                                            <Input
                                                value={originalServicePrice !== null && !isNaN(Number(originalServicePrice)) ? Number(originalServicePrice).toFixed(2) : ''}
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
                                                        step="0.0001"
                                                        {...field}
                                                        value={field.value ?? exchangeRate}
                                                        onChange={(e) => {
                                                            const value = Number(e.target.value) || 1;
                                                            const roundedValue = Math.round(value * 10000) / 10000;
                                                            setExchangeRate(roundedValue);
                                                            field.onChange(roundedValue);
                                                        }}
                                                        onBlur={async () => {
                                                            field.onBlur();
                                                            await quoteItemForm.trigger('exchange_rate');
                                                        }}
                                                    />
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={quoteItemForm.control} name="quantity" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('itemDialog.quantity')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    {...field}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        field.onChange(value === '' ? '' : Number(value));
                                                    }}
                                                    onBlur={async (e) => {
                                                        field.onBlur();
                                                        const value = e.target.value;
                                                        if (value !== '') {
                                                            const quantity = Number(value);
                                                            const unitPrice = quoteItemForm.getValues('unit_price') || 0;
                                                            const nameTotal = Math.round((unitPrice * quantity) * 100) / 100;
                                                            quoteItemForm.setValue('total', nameTotal);
                                                        }
                                                        await quoteItemForm.trigger('quantity');
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={quoteItemForm.control} name="tooth_number" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('itemDialog.toothNumber')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder={t('placeholders.toothNumber')}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={quoteItemForm.control} name="unit_price" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('itemDialog.unitPrice')} ({selectedQuote?.currency})</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                value={typeof field.value === 'number' && !isNaN(field.value) ? field.value.toFixed(2) : ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    if (value === '') {
                                                        field.onChange('');
                                                    } else {
                                                        const numValue = Number(value);
                                                        field.onChange(Math.round(numValue * 100) / 100);
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    const value = e.target.value;
                                                    if (value !== '') {
                                                        const numValue = Number(value);
                                                        field.onChange(Math.round(numValue * 100) / 100);
                                                        // Recalculate total
                                                        const quantity = quoteItemForm.getValues('quantity') || 0;
                                                        const newTotal = Math.round((numValue * quantity) * 100) / 100;
                                                        quoteItemForm.setValue('total', newTotal);
                                                    }
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={quoteItemForm.control} name="total" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('itemDialog.total')}</FormLabel>
                                        <FormControl><Input type="number" readOnly disabled value={typeof field.value === 'number' && !isNaN(field.value) ? field.value.toFixed(2) : ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit">{editingQuoteItem ? t('itemDialog.editSave') : t('itemDialog.save')}</Button>
                                <Button type="button" variant="outline" onClick={() => setIsQuoteItemDialogOpen(false)}>{t('itemDialog.cancel')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteQuoteItemDialogOpen} onOpenChange={setIsDeleteQuoteItemDialogOpen}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteItemDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteItemDialog.description')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <DialogFooter>
                        <AlertDialogAction onClick={confirmDeleteQuoteItem} className="bg-destructive hover:bg-destructive/90">{t('deleteItemDialog.confirm')}</AlertDialogAction>
                        <AlertDialogCancel>{t('deleteItemDialog.cancel')}</AlertDialogCancel>
                    </DialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
