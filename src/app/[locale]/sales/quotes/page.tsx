
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';
import { Quote, QuoteItem, Order, Invoice, Payment, OrderItem, InvoiceItem, User } from '@/lib/types';
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


const quoteFormSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().min(1, 'User is required'),
  total: z.coerce.number().min(0, 'Total must be a positive number'),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'pending', 'confirmed']),
  payment_status: z.enum(['unpaid', 'paid', 'partial']),
  billing_status: z.enum(['not invoiced', 'partially invoiced', 'invoiced']),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;


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
      createdAt: apiQuote.createdAt || new Date().toISOString().split('T')[0],
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
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quote/upsert', {
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
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingQuote, setEditingQuote] = React.useState<Quote | null>(null);
    const [deletingQuote, setDeletingQuote] = React.useState<Quote | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const [allUsers, setAllUsers] = React.useState<User[]>([]);
    const [isUserSearchOpen, setUserSearchOpen] = React.useState(false);

    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

    const form = useForm<QuoteFormValues>({
        resolver: zodResolver(quoteFormSchema),
      });

    const watchedStatus = form.watch("status");
    const isStatusDraft = watchedStatus === 'draft';

    React.useEffect(() => {
        if (isStatusDraft) {
            form.setValue('payment_status', 'unpaid');
            form.setValue('billing_status', 'not invoiced');
        }
    }, [isStatusDraft, form]);


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
        if (isDialogOpen) {
          getUsers().then(setAllUsers);
        }
    }, [isDialogOpen]);

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

    const handleCreate = () => {
        setEditingQuote(null);
        form.reset({
          user_id: '',
          total: 0,
          status: 'draft',
          payment_status: 'unpaid',
          billing_status: 'not invoiced',
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
      };
      
    const handleEdit = (quote: Quote) => {
        if (quote.status !== 'draft') {
            toast({
                variant: 'destructive',
                title: 'Cannot Edit Quote',
                description: 'You can only edit quotes that are in "Draft" status.',
            });
            return;
        }
        setEditingQuote(quote);
        form.reset({
            id: quote.id,
            user_id: quote.user_id,
            total: quote.total,
            status: quote.status,
            payment_status: quote.payment_status,
            billing_status: quote.billing_status as any,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };
    
    const handleDelete = (quote: Quote) => {
        if (quote.status !== 'draft') {
            toast({
                variant: 'destructive',
                title: 'Cannot Delete Quote',
                description: 'You can only delete quotes that are in "Draft" status.',
            });
            return;
        }
        setDeletingQuote(quote);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingQuote) return;
        try {
            await deleteQuote(deletingQuote.id);
            toast({
                title: "Quote Deleted",
                description: `Quote "${deletingQuote.id}" has been deleted.`,
            });
            setIsDeleteDialogOpen(false);
            setDeletingQuote(null);
            loadQuotes();
            if (selectedQuote?.id === deletingQuote.id) {
                setSelectedQuote(null);
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : "Could not delete the quote.",
            });
        }
    };
    
    const onSubmit = async (values: QuoteFormValues) => {
        setSubmissionError(null);
        try {
            await upsertQuote(values);
            toast({
                title: editingQuote ? "Quote Updated" : "Quote Created",
                description: `The quote has been saved successfully.`,
            });
            setIsDialogOpen(false);
            loadQuotes();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : "An unexpected error occurred.");
        }
    };

    const handleQuoteAction = async (quote: Quote, action: 'confirm' | 'reject') => {
        try {
            const user = allUsers.find(u => u.id === quote.user_id) || { id: quote.user_id, name: quote.user_name, email: quote.userEmail };
            const payload = {
                quote_number: quote.id,
                confirm_reject: action,
                patient_email: user.email,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
            };

            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/quotes/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Failed to ${action} quote.`);
            }

            toast({
                title: `Quote ${action === 'confirm' ? 'Confirmed' : 'Rejected'}`,
                description: `Quote #${quote.id} has been successfully ${action === 'confirm' ? 'confirmed' : 'rejected'}.`,
            });
            loadQuotes();

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : `Could not ${action} the quote.`,
            });
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
    
    return (
        <>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className={cn("transition-all duration-300", selectedQuote ? "lg:col-span-2" : "lg:col-span-5")}>
                 <RecentQuotesTable 
                    quotes={quotes} 
                    onRowSelectionChange={handleRowSelectionChange} 
                    onCreate={handleCreate}
                    onRefresh={loadQuotes}
                    isRefreshing={isRefreshing}
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onQuoteAction={handleQuoteAction}
                />
            </div>

            {selectedQuote && (
                <div className="lg:col-span-3">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div>
                                <CardTitle>Details for Quote</CardTitle>
                                <CardDescription>Quote ID: {selectedQuote.id}</CardDescription>
                            </div>
                            <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                                <X className="h-5 w-5" />
                                <span className="sr-only">Close details</span>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="items" className="w-full">
                                <TabsList className="h-auto items-center justify-start flex-wrap">
                                    <TabsTrigger value="items">Quote Items</TabsTrigger>
                                    <TabsTrigger value="orders">Orders</TabsTrigger>
                                    <TabsTrigger value="invoices">Invoices</TabsTrigger>
                                    <TabsTrigger value="payments">Payments</TabsTrigger>
                                </TabsList>
                                <TabsContent value="items">
                                   <QuoteItemsTable 
                                        items={quoteItems} 
                                        isLoading={isLoadingItems}
                                        onRefresh={loadQuoteItems}
                                        isRefreshing={isLoadingItems}
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
                                            <OrderItemsTable items={orderItems} isLoading={isLoadingOrderItems} />
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingQuote ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
                    <DialogDescription>
                        {editingQuote ? 'Update the details for this quote.' : 'Fill in the details below to add a new quote.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        {submissionError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{submissionError}</AlertDescription>
                            </Alert>
                        )}
                        <FormField
                            control={form.control}
                            name="user_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>User</FormLabel>
                                    <Popover open={isUserSearchOpen} onOpenChange={setUserSearchOpen}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                                    {field.value ? allUsers.find(user => user.id === field.value)?.name : "Select user"}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search user..." />
                                                <CommandList>
                                                    <CommandEmpty>No user found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {allUsers.map((user) => (
                                                            <CommandItem value={user.name} key={user.id} onSelect={() => { form.setValue("user_id", user.id); setUserSearchOpen(false); }}>
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
                            control={form.control}
                            name="total"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Total</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="0.00" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="confirmed">Confirmed</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="payment_status"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Payment Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={isStatusDraft}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a payment status" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="unpaid">Unpaid</SelectItem>
                                        <SelectItem value="partial">Partial</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                    </SelectContent>
                                    </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="billing_status"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Billing Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={isStatusDraft}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a billing status" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="not invoiced">Not Invoiced</SelectItem>
                                        <SelectItem value="partially invoiced">Partially Invoiced</SelectItem>
                                        <SelectItem value="invoiced">Invoiced</SelectItem>
                                    </SelectContent>
                                    </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">{editingQuote ? 'Save Changes' : 'Create Quote'}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the quote "{deletingQuote?.id}". This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
