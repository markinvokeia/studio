
'use client';

import * as React from 'react';
import { Order, OrderItem, Invoice, Payment, User, Quote, InvoiceItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrdersTable, CreateOrderDialog } from '@/components/tables/orders-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { OrderItemsTable } from '@/components/tables/order-items-table';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { RefreshCw, X } from 'lucide-react';
import { RowSelectionState } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

async function getOrders(): Promise<Order[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/all_orders?is_sales=false', {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return [];
        }
        const data = await response.json();
        const ordersData = Array.isArray(data) ? data : (data.orders || data.data || []);
        return ordersData.map((apiOrder: any) => ({
            id: apiOrder.id ? String(apiOrder.id) : `ord_${Math.random().toString(36).substr(2, 9)}`,
            user_id: apiOrder.user_id,
            quote_id: apiOrder.quote_id,
            user_name: apiOrder.user_name || 'N/A',
            status: apiOrder.status,
            currency: apiOrder.currency || 'URU',
            createdAt: apiOrder.createdAt || new Date().toISOString().split('T')[0],
            updatedAt: apiOrder.updatedAt || new Date().toISOString().split('T')[0],
        }));
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return [];
    }
}

async function getOrderItems(orderId: string): Promise<OrderItem[]> {
    if (!orderId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/order_items?order_id=${orderId}&is_sales=false`, {
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

async function getInvoicesForOrder(orderId: string): Promise<Invoice[]> {
    if (!orderId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/order_invoices?order_id=${orderId}&is_sales=false`, {
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
            order_id: apiInvoice.order_id,
            quote_id: apiInvoice.quote_id,
            user_name: apiInvoice.user_name || 'N/A',
            total: apiInvoice.total || 0,
            status: apiInvoice.status || 'draft',
            payment_status: apiInvoice.payment_status || 'unpaid',
            createdAt: apiInvoice.createdAt || new Date().toISOString().split('T')[0],
            updatedAt: apiInvoice.updatedAt || new Date().toISOString().split('T')[0],
            currency: apiInvoice.currency || 'URU',
        }));
    } catch (error) {
        console.error("Failed to fetch invoices for order:", error);
        return [];
    }
}

async function getPaymentsForOrder(orderId: string): Promise<Payment[]> {
    if (!orderId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/order_payments?order_id=${orderId}&is_sales=false`, {
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
            order_id: apiPayment.order_id,
            invoice_id: apiPayment.invoice_id,
            quote_id: apiPayment.quote_id,
            user_name: apiPayment.user_name || 'N/A',
            amount: apiPayment.amount || 0,
            method: apiPayment.method || 'credit_card',
            status: apiPayment.status || 'pending',
            createdAt: apiPayment.created_at || new Date().toISOString().split('T')[0],
            updatedAt: apiPayment.updatedAt || new Date().toISOString().split('T')[0],
            currency: apiPayment.currency || 'URU',
        }));
    } catch (error) {
        console.error("Failed to fetch payments for order:", error);
        return [];
    }
}

async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    if (!invoiceId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/invoice_items?invoice_id=${invoiceId}&is_sales=false`, {
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

export default function OrdersPage() {
    const t = useTranslations('OrdersPage');
    const tQuotes = useTranslations('QuotesPage');
    const tOrderItems = useTranslations('OrderItemsTable');
    const tInvoiceItems = useTranslations('InvoiceItemsTable');
    const [orders, setOrders] = React.useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

    const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
    const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([]);
    const [payments, setPayments] = React.useState<Payment[]>([]);

    const [isLoadingOrders, setIsLoadingOrders] = React.useState(false);
    const [isLoadingOrderItems, setIsLoadingOrderItems] = React.useState(false);
    const [isLoadingInvoices, setIsLoadingInvoices] = React.useState(false);
    const [isLoadingInvoiceItems, setIsLoadingInvoiceItems] = React.useState(false);
    const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

    const loadOrders = React.useCallback(async () => {
        setIsLoadingOrders(true);
        const fetchedOrders = await getOrders();
        setOrders(fetchedOrders);
        setIsLoadingOrders(false);
    }, []);

    React.useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const loadOrderItems = React.useCallback(async () => {
        if (!selectedOrder) return;
        setIsLoadingOrderItems(true);
        setOrderItems(await getOrderItems(selectedOrder.id));
        setIsLoadingOrderItems(false);
    }, [selectedOrder]);

    const loadInvoices = React.useCallback(async () => {
        if (!selectedOrder) return;
        setIsLoadingInvoices(true);
        setInvoices(await getInvoicesForOrder(selectedOrder.id));
        setIsLoadingInvoices(false);
    }, [selectedOrder]);

    const loadPayments = React.useCallback(async () => {
        if (!selectedOrder) return;
        setIsLoadingPayments(true);
        setPayments(await getPaymentsForOrder(selectedOrder.id));
        setIsLoadingPayments(false);
    }, [selectedOrder]);

    const loadInvoiceItems = React.useCallback(async () => {
        if (!selectedInvoice) return;
        setIsLoadingInvoiceItems(true);
        setInvoiceItems(await getInvoiceItems(selectedInvoice.id));
        setIsLoadingInvoiceItems(false);
    }, [selectedInvoice]);


    React.useEffect(() => {
        if (selectedOrder) {
            loadOrderItems();
            loadInvoices();
            loadPayments();
            setSelectedInvoice(null);
        } else {
            setOrderItems([]);
            setInvoices([]);
            setPayments([]);
        }
    }, [selectedOrder, loadOrderItems, loadInvoices, loadPayments]);

    React.useEffect(() => {
        if (selectedInvoice) {
            loadInvoiceItems();
        } else {
            setInvoiceItems([]);
        }
    }, [selectedInvoice, loadInvoiceItems]);

    const handleRowSelectionChange = (selectedRows: Order[]) => {
        const order = selectedRows.length > 0 ? selectedRows[0] : null;
        setSelectedOrder(order);
    };

    const handleInvoiceSelectionChange = (selectedRows: Invoice[]) => {
        const invoice = selectedRows.length > 0 ? selectedRows[0] : null;
        setSelectedInvoice(invoice);
    };

    const handleCloseDetails = () => {
        setSelectedOrder(null);
        setRowSelection({});
    };

    return (
        <>
            <div className="relative overflow-hidden">
                <div className={cn("transition-all duration-300 w-full")}>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('title')}</CardTitle>
                            <CardDescription>{t('description')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <OrdersTable
                                orders={orders}
                                isLoading={isLoadingOrders}
                                onRowSelectionChange={handleRowSelectionChange}
                                onRefresh={loadOrders}
                                isRefreshing={isLoadingOrders}
                                onCreate={() => setIsCreateDialogOpen(true)}
                                rowSelection={rowSelection}
                                setRowSelection={setRowSelection}
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className={cn(
                    "absolute top-0 right-0 h-full w-[75%] bg-background/95 backdrop-blur-sm border-l z-20 transition-transform duration-300 ease-in-out",
                    selectedOrder ? 'translate-x-0' : 'translate-x-full'
                )}>
                    {selectedOrder && (
                        <Card className="h-full shadow-lg rounded-none">
                            <CardHeader className="flex flex-row items-start justify-between">
                                <div>
                                    <CardTitle>{t('detailsFor')}</CardTitle>
                                    <CardDescription>{t('orderId')}: {selectedOrder.id}</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                    <X className="h-5 w-5" />
                                    <span className="sr-only">Close details</span>
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="items" className="w-full">
                                    <TabsList className="h-auto items-center justify-start flex-wrap">
                                        <TabsTrigger value="items">{tQuotes('tabs.items')}</TabsTrigger>
                                        <TabsTrigger value="invoices">{tQuotes('tabs.invoices')}</TabsTrigger>
                                        <TabsTrigger value="payments">{tQuotes('tabs.payments')}</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="items">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-md font-semibold">{tOrderItems('title', { id: selectedOrder.id })}</h4>
                                            <Button variant="outline" size="icon" onClick={loadOrderItems} disabled={isLoadingOrderItems}>
                                                <RefreshCw className={`h-4 w-4 ${isLoadingOrderItems ? 'animate-spin' : ''}`} />
                                            </Button>
                                        </div>
                                        <OrderItemsTable items={orderItems} isLoading={isLoadingOrderItems} onItemsUpdate={loadOrderItems} quoteId={selectedOrder.quote_id} />
                                    </TabsContent>
                                    <TabsContent value="invoices">
                                        <div className="space-y-4">
                                            <InvoicesTable
                                                invoices={invoices}
                                                isLoading={isLoadingInvoices}
                                                onRowSelectionChange={handleInvoiceSelectionChange}
                                                onRefresh={loadInvoices}
                                                isRefreshing={isLoadingInvoices}
                                            />
                                            {selectedInvoice && (
                                                <div className="mt-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                                                    <div className="flex items-center justify-between p-4">
                                                        <h4 className="text-md font-semibold">{tInvoiceItems('title', { id: selectedInvoice.id })}</h4>
                                                        <Button variant="outline" size="icon" onClick={loadInvoiceItems} disabled={isLoadingInvoiceItems}>
                                                            <RefreshCw className={`h-4 w-4 ${isLoadingInvoiceItems ? 'animate-spin' : ''}`} />
                                                        </Button>
                                                    </div>
                                                    <InvoiceItemsTable items={invoiceItems} isLoading={isLoadingInvoiceItems} />
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="payments">
                                        <PaymentsTable
                                            payments={payments}
                                            isLoading={isLoadingPayments}
                                            onRefresh={loadPayments}
                                            isRefreshing={isLoadingPayments}
                                        />
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
            <CreateOrderDialog
                isOpen={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onOrderCreated={loadOrders}
            />
        </>
    );
}
