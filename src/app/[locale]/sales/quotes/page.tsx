
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';
import { Quote, QuoteItem, Order, Invoice, Payment, OrderItem, InvoiceItem, User, Service } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuoteItemsTable } from '@/components/tables/quote-items-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { OrdersTable } from '@/components/tables/orders-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { OrderItemsTable } from '@/components/tables/order-items-table';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { RefreshCw, X, AlertTriangle, ChevronsUpDown, Check } from 'lucide-react';
import { RowSelectionState } from '@tanstack/react-table';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslations } from 'next-intl';


const quoteFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  user_id: z.string().min(1, t('quoteDialog.user')),
  total: z.coerce.number().min(0, 'Total must be a positive number'),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'pending', 'confirmed']),
  payment_status: z.enum(['unpaid', 'paid', 'partial', 'partially paid']),
  billing_status: z.enum(['not invoiced', 'partially invoiced', 'invoiced']),
});

type QuoteFormValues = z.infer<ReturnType<typeof quoteFormSchema>>;

const quoteItemFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    quote_id: z.string(),
    service_id: z.string().min(1, t('itemDialog.service')),
    quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
    unit_price: z.coerce.number().min(0, 'Unit price must be positive'),
    total: z.coerce.number().min(0, 'Total must be positive'),
});

type QuoteItemFormValues = z.infer<ReturnType<typeof quoteItemFormSchema>>;


async function getQuotes(): Promise<Quote[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quotes', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const quotesData = Array.isArray(data) ? data : (data.quotes || data.data || data.result || []);
    
    return quotesData.map((apiQuote: any) => ({
      id: apiQuote.id ? String(apiQuote.id) : `qt_${Math.random().toString(36).substr(2, 9)}`,
      user_id: apiQuote.user_id || 'N/A',
      total: apiQuote.total || 0,
      status: apiQuote.status || 'draft',
      payment_status: apiQuote.payment_status || 'unpaid',
      billing_status: apiQuote.billing_status || 'not invoiced',
      user_name: apiQuote.user_name || 'No Name',
      userEmail: apiQuote.userEmail || 'no-email@example.com',
      createdAt: apiQuote.created_at || new Date().toISOString().split('T')[0],
    }));
  } catch (error) {
    console.error("Failed to fetch quotes:", error);
    return [];
  }
}

async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    if (!quoteId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quote_items?quote_id=${quoteId}`, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const itemsData = Array.isArray(data) ? data : (data.quote_items || data.data || data.result || []);
        
        return itemsData.map((apiItem: any) => ({
            id: apiItem.id ? String(apiItem.id) : `qi_${Math.random().toString(36).substr(2, 9)}`,
            service_id: apiItem.service_id || 'N/A',
            service_name: apiItem.service_name || 'N/A',
            unit_price: apiItem.unit_price || 0,
            quantity: apiItem.quantity || 0,
            total: apiItem.total || 0,
        }));
    } catch (error) {
        console.error("Failed to fetch quote items:", error);
        return [];
    }
}

async function getServices(): Promise<Service[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const data = await response.json();
    const servicesData = Array.isArray(data) ? data : (data.services || data.data || []);
    return servicesData.map((s: any) => ({ ...s, id: String(s.id) }));
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

async function upsertQuoteItem(itemData: QuoteItemFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quote/lines/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save quote item.';
        throw new Error(message);
    }
    return responseData;
}

async function deleteQuoteItem(id: string, quoteId: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quote/lines/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quote_id: quoteId }),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete quote item.';
        throw new Error(message);
    }
    return responseData;
}


async function getOrders(quoteId: string): Promise<Order[]> {
    if (!quoteId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quote_orders?quote_id=${quoteId}`, {
             method: 'GET',
             mode: 'cors',
             headers: { 'Accept': 'application/json' },
             cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const ordersData = Array.isArray(data) ? data : (data.orders || data.data || []);
        return ordersData.map((apiOrder: any) => ({
            id: apiOrder.id ? String(apiOrder.id) : `ord_${Math.random().toString(36).substr(2, 9)}`,
            user_id: apiOrder.user_id,
            status: apiOrder.status,
            createdAt: apiOrder.createdAt || new Date().toISOString().split('T')[0],
        }));
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return [];
    }
}

async function getOrderItems(orderId: string): Promise<OrderItem[]> {
    if (!orderId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/order_items?order_id=${orderId}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const itemsData = Array.isArray(data) ? data : (data.order_items || data.data || data.result || []);
        return itemsData.map((apiItem: any) => ({
            id: apiItem.order_item_id ? String(apiItem.order_item_id) : `oi_${Math.random().toString(36).substr(2, 9)}`,
            service_id: apiItem.service_id,
            service_name: apiItem.service_name || 'N/A',
            quantity: apiItem.quantity,
            unit_price: apiItem.unit_price,
            total: apiItem.total,
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

async function getInvoices(quoteId: string): Promise<Invoice[]> {
    if (!quoteId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quote_invoices?quote_id=${quoteId}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);
        return invoicesData.map((apiInvoice: any) => ({
            id: apiInvoice.id ? String(apiInvoice.id) : `inv_${Math.random().toString(36).substr(2, 9)}`,
            quote_id: apiInvoice.quote_id,
            total: apiInvoice.total || 0,
            status: apiInvoice.status || 'draft',
            createdAt: apiInvoice.createdAt || new Date().toISOString().split('T')[0],
        }));
    } catch (error) {
        console.error("Failed to fetch invoices:", error);
        return [];
    }
}

async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    if (!invoiceId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/invoice_items?invoice_id=${invoiceId}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const itemsData = Array.isArray(data) ? data : (data.invoice_items || data.data || []);
        return itemsData.map((apiItem: any) => ({
            id: apiItem.id ? String(apiItem.id) : `ii_${Math.random().toString(36).substr(2, 9)}`,
            service_id: apiItem.service_id,
            service_name: apiItem.service_name || 'N/A',
            quantity: apiItem.quantity,
            unit_price: apiItem.unit_price,
            total: apiItem.total,
        }));
    } catch (error) {
        console.error("Failed to fetch invoice items:", error);
        return [];
    }
}


async function getPayments(quoteId: string): Promise<Payment[]> {
    if (!quoteId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quote_payments?quote_id=${quoteId}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const paymentsData = Array.isArray(data) ? data : (data.payments || data.data || []);
        return paymentsData.map((apiPayment: any) => ({
            id: apiPayment.id ? String(apiPayment.id) : `pay_${Math.random().toString(36).substr(2, 9)}`,
            invoice_id: apiPayment.invoice_id,
            amount: apiPayment.amount || 0,
            method: apiPayment.method || 'credit_card',
            status: apiPayment.status || 'pending',
            createdAt: apiPayment.createdAt || new Date().toISOString().split('T')[0],
        }));
    } catch (error) {
        console.error("Failed to fetch payments:", error);
        return [];
    }
}

async function getUsers(): Promise<User[]> {
    try {
      const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users', {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });
      if (!response.ok) return [];
      const responseData = await response.json();
      const data = (Array.isArray(responseData) && responseData.length > 0) ? responseData[0] : { data: [], total: 0 };
      const usersData = Array.isArray(data.data) ? data.data : [];
      return usersData.map((apiUser: any) => ({
        id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
        name: apiUser.name || 'No Name',
        email: apiUser.email || 'no-email@example.com',
        phone_number: apiUser.phone_number || '000-000-0000',
        is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      }));
    } catch (error) {
      console.error("Failed to fetch users:", error);
      return [];
    }
  }
  
async function upsertQuote(quoteData: QuoteFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quotes/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save quote';
        throw new Error(message);
    }
    return responseData;
}
  
async function deleteQuote(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quote/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete quote';
        throw new Error(message);
    }
    return responseData;
}


export default function QuotesPage() {
    const t = useTranslations('QuotesPage');
    const { toast } = useToast();
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

    const quoteForm = useForm<QuoteFormValues>({ resolver: zodResolver(quoteFormSchema(t)) });
    const quoteItemForm = useForm<QuoteItemFormValues>({ resolver: zodResolver(quoteItemFormSchema(t)) });

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
        const fetchedQuotes = await getQuotes();
        setQuotes(fetchedQuotes);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadQuotes();
    }, [loadQuotes]);

    React.useEffect(() => {
        if (isQuoteDialogOpen) getUsers().then(setAllUsers);
        if (isQuoteItemDialogOpen) getServices().then(setAllServices);
    }, [isQuoteDialogOpen, isQuoteItemDialogOpen]);

    const loadQuoteItems = React.useCallback(async () => {
        if (!selectedQuote) return;
        setIsLoadingItems(true);
        setQuoteItems(await getQuoteItems(selectedQuote.id));
        setIsLoadingItems(false);
    }, [selectedQuote]);

    const loadOrders = React.useCallback(async () => {
        if (!selectedQuote) return;
        setIsLoadingOrders(true);
        setOrders(await getOrders(selectedQuote.id));
        setIsLoadingOrders(false);
    }, [selectedQuote]);

    const loadOrderItems = React.useCallback(async () => {
        if (!selectedOrder) return;
        setIsLoadingOrderItems(true);
        setOrderItems(await getOrderItems(selectedOrder.id));
        setIsLoadingOrderItems(false);
    }, [selectedOrder]);

    const loadInvoices = React.useCallback(async () => {
        if (!selectedQuote) return;
        setIsLoadingInvoices(true);
        setInvoices(await getInvoices(selectedQuote.id));
        setIsLoadingInvoices(false);
    }, [selectedQuote]);

    const loadInvoiceItems = React.useCallback(async () => {
        if (!selectedInvoice) return;
        setIsLoadingInvoiceItems(true);
        setInvoiceItems(await getInvoiceItems(selectedInvoice.id));
        setIsLoadingInvoiceItems(false);
    }, [selectedInvoice]);

    const loadPayments = React.useCallback(async () => {
        if (!selectedQuote) return;
        setIsLoadingPayments(true);
        setPayments(await getPayments(selectedQuote.id));
        setIsLoadingPayments(false);
    }, [selectedQuote]);

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
        if(selectedOrder) {
            loadOrderItems();
        } else {
            setOrderItems([]);
        }
    }, [selectedOrder, loadOrderItems]);

    React.useEffect(() => {
        if(selectedInvoice) {
            loadInvoiceItems();
        } else {
            setInvoiceItems([]);
        }
    }, [selectedInvoice, loadInvoiceItems]);

    const handleCreateQuote = () => {
        setEditingQuote(null);
        quoteForm.reset({ user_id: '', total: 0, status: 'draft', payment_status: 'unpaid', billing_status: 'not invoiced' });
        setQuoteSubmissionError(null);
        setIsQuoteDialogOpen(true);
      };
      
    const handleEditQuote = (quote: Quote) => {
        if (quote.status.toLowerCase() !== 'draft') {
            toast({ variant: 'destructive', title: 'Cannot Edit Quote', description: 'You can only edit quotes that are in "Draft" status.' });
            return;
        }
        setEditingQuote(quote);
        quoteForm.reset({ id: quote.id, user_id: quote.user_id, total: quote.total, status: quote.status, payment_status: quote.payment_status, billing_status: quote.billing_status as any });
        setQuoteSubmissionError(null);
        setIsQuoteDialogOpen(true);
    };
    
    const handleDeleteQuote = (quote: Quote) => {
        if (quote.status.toLowerCase() !== 'draft') {
            toast({ variant: 'destructive', title: 'Cannot Delete Quote', description: 'You can only delete quotes that are in "Draft" status.' });
            return;
        }
        setDeletingQuote(quote);
        setIsDeleteQuoteDialogOpen(true);
    };

    const confirmDeleteQuote = async () => {
        if (!deletingQuote) return;
        try {
            await deleteQuote(deletingQuote.id);
            toast({ title: t('toast.quoteDeleted'), description: t('toast.quoteDeleteSuccess', { id: deletingQuote.id }) });
            setIsDeleteQuoteDialogOpen(false);
            setDeletingQuote(null);
            loadQuotes();
            if (selectedQuote?.id === deletingQuote.id) setSelectedQuote(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : t('toast.quoteDeleteError') });
        }
    };
    
    const onQuoteSubmit = async (values: QuoteFormValues) => {
        setQuoteSubmissionError(null);
        try {
            await upsertQuote(values);
            toast({ title: editingQuote ? t('toast.quoteUpdated') : t('toast.quoteCreated'), description: t('toast.quoteSaveSuccess') });
            setIsQuoteDialogOpen(false);
            loadQuotes();
        } catch (error) {
            setQuoteSubmissionError(error instanceof Error ? error.message : t('toast.quoteError'));
        }
    };

    const handleCreateQuoteItem = () => {
        if (!selectedQuote) return;
        setEditingQuoteItem(null);
        quoteItemForm.reset({ quote_id: selectedQuote.id, service_id: '', quantity: 1, unit_price: 0, total: 0 });
        setQuoteItemSubmissionError(null);
        setIsQuoteItemDialogOpen(true);
    };
    
    const handleEditQuoteItem = (item: QuoteItem) => {
        setEditingQuoteItem(item);
        const service = allServices.find(s => String(s.id) === String(item.service_id));
        quoteItemForm.reset({ 
            id: item.id, 
            quote_id: selectedQuote!.id, 
            service_id: String(item.service_id), 
            quantity: item.quantity, 
            unit_price: item.unit_price, 
            total: item.total 
        });
        if(service) quoteItemForm.setValue('unit_price', service.price);
        setQuoteItemSubmissionError(null);
        setIsQuoteItemDialogOpen(true);
    };

    const handleDeleteQuoteItem = (item: QuoteItem) => {
        setDeletingQuoteItem(item);
        setIsDeleteQuoteItemDialogOpen(true);
    };

    const confirmDeleteQuoteItem = async () => {
        if (!deletingQuoteItem || !selectedQuote) return;
        try {
            await deleteQuoteItem(deletingQuoteItem.id, selectedQuote.id);
            toast({ title: t('toast.itemDeleted'), description: t('toast.itemDeleteSuccess') });
            loadQuoteItems();
            loadQuotes(); // To update total
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : t('toast.itemDeleteError') });
        } finally {
            setIsDeleteQuoteItemDialogOpen(false);
            setDeletingQuoteItem(null);
        }
    };

    const onQuoteItemSubmit = async (values: QuoteItemFormValues) => {
        setQuoteItemSubmissionError(null);
        try {
            await upsertQuoteItem(values);
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
            const payload = { quote_number: quote.id, confirm_reject: action };
            const endpoint = `https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quote/${action}`;
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const responseData = await response.json();
            if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
                const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : t('toast.quoteActionError', {action: action});
                throw new Error(message);
            }
            toast({ title: action === 'confirm' ? t('toast.quoteConfirmed') : t('toast.quoteRejected'), description: t(action === 'confirm' ? 'toast.quoteConfirmSuccess' : 'toast.quoteRejectSuccess', { id: quote.id }) });
            loadQuotes();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : t('toast.quoteActionError', {action: action}) });
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

    // Auto-calculate total for quote item form
    const watchedServiceId = quoteItemForm.watch('service_id');
    const watchedQuantity = quoteItemForm.watch('quantity');

    React.useEffect(() => {
        const service = allServices.find(s => String(s.id) === watchedServiceId);
        if (service) {
            const unitPrice = service.price;
            const quantity = Number(watchedQuantity) || 0;
            quoteItemForm.setValue('unit_price', unitPrice);
            quoteItemForm.setValue('total', unitPrice * quantity);
        }
    }, [watchedServiceId, watchedQuantity, allServices, quoteItemForm]);
    
    return (
        <>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className={cn("transition-all duration-300", selectedQuote ? "lg:col-span-2" : "lg:col-span-5")}>
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
                />
            </div>

            {selectedQuote && (
                <div className="lg:col-span-3">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div>
                                <CardTitle>{t('detailsFor')}</CardTitle>
                                <CardDescription>{t('quoteId')}: {selectedQuote.id}</CardDescription>
                            </div>
                            <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                                <X className="h-5 w-5" />
                                <span className="sr-only">Close details</span>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="items" className="w-full">
                                <TabsList className="h-auto items-center justify-start flex-wrap">
                                    <TabsTrigger value="items">{t('tabs.items')}</TabsTrigger>
                                    <TabsTrigger value="orders">{t('tabs.orders')}</TabsTrigger>
                                    <TabsTrigger value="invoices">{t('tabs.invoices')}</TabsTrigger>
                                    <TabsTrigger value="payments">{t('tabs.payments')}</TabsTrigger>
                                </TabsList>
                                <TabsContent value="items">
                                   <QuoteItemsTable 
                                        items={quoteItems} 
                                        isLoading={isLoadingItems}
                                        onRefresh={loadQuoteItems}
                                        isRefreshing={isLoadingItems}
                                        canEdit={canEditQuote}
                                        onCreate={handleCreateQuoteItem}
                                        onEdit={handleEditQuoteItem}
                                        onDelete={handleDeleteQuoteItem}
                                    />
                                </TabsContent>
                                <TabsContent value="orders">
                                    <OrdersTable 
                                        orders={orders} 
                                        isLoading={isLoadingOrders} 
                                        onRowSelectionChange={handleOrderSelectionChange} 
                                        onRefresh={loadOrders}
                                        isRefreshing={isLoadingOrders}
                                    />
                                    {selectedOrder && (
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-md font-semibold">Order Items for {selectedOrder.id}</h4>
                                                <Button variant="outline" size="icon" onClick={loadOrderItems} disabled={isLoadingOrderItems}>
                                                    <RefreshCw className={`h-4 w-4 ${isLoadingOrderItems ? 'animate-spin' : ''}`} />
                                                </Button>
                                            </div>
                                            <OrderItemsTable items={orderItems} isLoading={isLoadingOrderItems} onItemsUpdate={loadOrderItems} quoteId={selectedQuote.id} />
                                        </div>
                                    )}
                                </TabsContent>
                                <TabsContent value="invoices">
                                    <InvoicesTable 
                                        invoices={invoices} 
                                        isLoading={isLoadingInvoices} 
                                        onRowSelectionChange={handleInvoiceSelectionChange}
                                        onRefresh={loadInvoices}
                                        isRefreshing={isLoadingInvoices}
                                    />
                                    {selectedInvoice && (
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-md font-semibold">Invoice Items for {selectedInvoice.id}</h4>
                                                <Button variant="outline" size="icon" onClick={loadInvoiceItems} disabled={isLoadingInvoiceItems}>
                                                    <RefreshCw className={`h-4 w-4 ${isLoadingInvoiceItems ? 'animate-spin' : ''}`} />
                                                </Button>
                                            </div>
                                            <InvoiceItemsTable items={invoiceItems} isLoading={isLoadingInvoiceItems} />
                                        </div>
                                    )}
                                </TabsContent>
                                <TabsContent value="payments">
                                    <PaymentsTable 
                                        payments={payments} 
                                        isLoading={isLoadingPayments}
                                        onRefresh={loadPayments}
                                        isRefreshing={isLoadingPayments}
                                        columnsToHide={['quote_id', 'order_id', 'user_name']}
                                    />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            )}
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
                                <AlertTitle>Error</AlertTitle>
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
                         <FormField
                            control={quoteForm.control}
                            name="total"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('quoteDialog.total')}</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="0.00" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
                                        <SelectItem value="partial">{t('quoteDialog.partial')}</SelectItem>
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
                        {t('deleteQuoteDialog.description', { id: deletingQuote?.id })}
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
                                <AlertTitle>Error</AlertTitle>
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
                        <FormField control={quoteItemForm.control} name="quantity" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('itemDialog.quantity')}</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={quoteItemForm.control} name="unit_price" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('itemDialog.unitPrice')}</FormLabel>
                                <FormControl><Input type="number" readOnly disabled {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={quoteItemForm.control} name="total" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('itemDialog.total')}</FormLabel>
                                <FormControl><Input type="number" readOnly disabled {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
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
