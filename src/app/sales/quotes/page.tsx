
'use client';

import * as React from 'react';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';
import { Quote, QuoteItem, Order, Invoice, Payment } from '@/lib/types';
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
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrdersTable } from '@/components/tables/orders-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { PaymentsTable } from '@/components/tables/payments-table';


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

async function getInvoices(quoteId: string): Promise<Invoice[]> {
    if (!quoteId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/invoices?quote_id=${quoteId}`, {
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
            total: apiInvoice.total || 0,
            status: apiInvoice.status || 'draft',
            createdAt: apiInvoice.createdAt || new Date().toISOString().split('T')[0],
        }));
    } catch (error) {
        console.error("Failed to fetch invoices:", error);
        return [];
    }
}

async function getPayments(quoteId: string): Promise<Payment[]> {
    if (!quoteId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/payments?quote_id=${quoteId}`, {
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


export default function QuotesPage() {
    const [quotes, setQuotes] = React.useState<Quote[]>([]);
    const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
    const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
    const [orders, setOrders] = React.useState<Order[]>([]);
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [payments, setPayments] = React.useState<Payment[]>([]);

    const [isLoadingItems, setIsLoadingItems] = React.useState(false);
    const [isLoadingOrders, setIsLoadingOrders] = React.useState(false);
    const [isLoadingInvoices, setIsLoadingInvoices] = React.useState(false);
    const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);
    
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

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
        if (selectedQuote) {
            async function loadQuoteSubItems() {
                setIsLoadingItems(true);
                setQuoteItems(await getQuoteItems(selectedQuote!.id));
                setIsLoadingItems(false);

                setIsLoadingOrders(true);
                setOrders(await getOrders(selectedQuote!.id));
                setIsLoadingOrders(false);

                setIsLoadingInvoices(true);
                setInvoices(await getInvoices(selectedQuote!.id));
                setIsLoadingInvoices(false);

                setIsLoadingPayments(true);
                setPayments(await getPayments(selectedQuote!.id));
                setIsLoadingPayments(false);
            }
            loadQuoteSubItems();
        } else {
            setQuoteItems([]);
            setOrders([]);
            setInvoices([]);
            setPayments([]);
        }
    }, [selectedQuote]);

    const handleRowSelectionChange = (selectedRows: Quote[]) => {
        const quote = selectedRows.length > 0 ? selectedRows[0] : null;
        setSelectedQuote(quote);
    };
    
    return (
        <>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className={cn("transition-all duration-300", selectedQuote ? "lg:col-span-3" : "lg:col-span-5")}>
                 <RecentQuotesTable 
                    quotes={quotes} 
                    onRowSelectionChange={handleRowSelectionChange} 
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadQuotes}
                    isRefreshing={isRefreshing}
                />
            </div>

            {selectedQuote && (
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Details for Quote</CardTitle>
                            <CardDescription>Quote ID: {selectedQuote.id}</CardDescription>
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
                                   <QuoteItemsTable items={quoteItems} isLoading={isLoadingItems} />
                                </TabsContent>
                                <TabsContent value="orders">
                                    <OrdersTable orders={orders} isLoading={isLoadingOrders} />
                                </TabsContent>
                                <TabsContent value="invoices">
                                    <InvoicesTable invoices={invoices} isLoading={isLoadingInvoices} />
                                </TabsContent>
                                <TabsContent value="payments">
                                    <PaymentsTable payments={payments} isLoading={isLoadingPayments} />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Quote</DialogTitle>
                <DialogDescription>
                    Fill in the details below to add a new quote.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="user_id" className="text-right">
                    User ID
                    </Label>
                    <Input id="user_id" placeholder="usr_..." className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="total" className="text-right">
                    Total
                    </Label>
                    <Input id="total" type="number" placeholder="0.00" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">
                    Status
                    </Label>
                    <Select>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="payment_status" className="text-right">
                    Payment Status
                    </Label>
                    <Select>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a payment status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Quote</Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}

    