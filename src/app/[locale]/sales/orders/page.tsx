'use client';

import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { OrderItemsTable } from '@/components/tables/order-items-table';
import { CreateOrderDialog, OrdersTable } from '@/components/tables/orders-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_ROUTES } from '@/constants/routes';
import { Invoice, InvoiceItem, Order, OrderItem, Payment } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { RowSelectionState } from '@tanstack/react-table';
import { RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

async function getOrders(): Promise<Order[]> {
    try {
        const data = await api.get(API_ROUTES.SALES.ORDERS_ALL, { is_sales: 'true' });
        const ordersData = Array.isArray(data) ? data : (data.orders || data.data || []);
        return ordersData.map((apiOrder: any) => ({
            id: apiOrder.id ? String(apiOrder.id) : 'N/A',
            doc_no: apiOrder.doc_no || 'N/A',
            user_id: apiOrder.user_id,
            quote_id: apiOrder.quote_id,
            quote_doc_no: apiOrder.quote_doc_no || 'N/A',
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
        const data = await api.get(API_ROUTES.SALES.ORDER_ITEMS, { order_id: orderId, is_sales: 'true' });
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
        const data = await api.get(API_ROUTES.SALES.ORDER_INVOICES, { order_id: orderId, is_sales: 'true' });
        const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);
        return invoicesData.map((apiInvoice: any) => ({
            id: apiInvoice.id ? String(apiInvoice.id) : `inv_${Math.random().toString(36).substr(2, 9)}`,
            invoice_ref: apiInvoice.invoice_ref || 'N/A',
            doc_no: apiInvoice.doc_no || `INV-${apiInvoice.id}`,
            order_id: apiInvoice.order_id,
            order_doc_no: apiInvoice.order_doc_no || `ORD-${apiInvoice.order_id}`,
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
        const data = await api.get(API_ROUTES.SALES.ORDER_PAYMENTS, { order_id: orderId, is_sales: 'true' });
        const paymentsData = Array.isArray(data) ? data : (data.payments || data.data || []);
        return paymentsData.map((apiPayment: any) => ({
            id: apiPayment.id ? String(apiPayment.id) : `pay_${Math.random().toString(36).substr(2, 9)}`,
            doc_no: apiPayment.doc_no || `PAY-${apiPayment.id}`,
            order_id: apiPayment.order_id,
            order_doc_no: apiPayment.order_doc_no || `ORD-${apiPayment.order_id}`,
            invoice_id: apiPayment.invoice_id,
            quote_id: apiPayment.quote_id,
            user_name: apiPayment.user_name || 'N/A',
            payment_date: apiPayment.created_at || new Date().toISOString().split('T')[0],
            amount_applied: parseFloat(apiPayment.converted_amount) || 0,
            source_amount: parseFloat(apiPayment.amount) || 0,
            source_currency: apiPayment.currency || 'UYU',
            exchange_rate: parseFloat(apiPayment.exchange_rate) || 1,
            payment_method: apiPayment.method || 'credit_card',
            transaction_type: 'direct_payment',
            transaction_id: apiPayment.doc_no || String(apiPayment.id),
            status: apiPayment.status || 'pending',
            createdAt: apiPayment.created_at || new Date().toISOString().split('T')[0],
            updatedAt: apiPayment.updatedAt || new Date().toISOString().split('T')[0],
            amount: parseFloat(apiPayment.converted_amount) || 0,
            method: apiPayment.method || 'credit_card',
            currency: apiPayment.invoice_currency || 'USD',
        }));
    } catch (error) {
        console.error("Failed to fetch payments for order:", error);
        return [];
    }
}

async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    if (!invoiceId) return [];
    try {
        const data = await api.get(API_ROUTES.SALES.INVOICE_ITEMS, { invoice_id: invoiceId, is_sales: 'true' });
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
    const tInvoiceItems = useTranslations('InvoicesPage.InvoiceItemsTable');
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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden pr-2 pb-4">
            <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="flex-none">
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="relative flex-1 min-h-0">
                        <div className={cn("transition-all duration-300 w-full h-full flex flex-col")}>
                            <OrdersTable
                                orders={orders}
                                isLoading={isLoadingOrders}
                                onRowSelectionChange={handleRowSelectionChange}
                                onRefresh={loadOrders}
                                isRefreshing={isLoadingOrders}
                                onCreate={() => setIsCreateDialogOpen(true)}
                                rowSelection={rowSelection}
                                setRowSelection={setRowSelection}
                                isSales={true}
                                className="!border-none !shadow-none !p-0"
                            />
                        </div>

                <div className={cn(
                    "absolute top-0 right-0 h-full w-[75%] bg-background/95 backdrop-blur-sm border-l z-20 transition-transform duration-300 ease-in-out",
                    selectedOrder ? 'translate-x-0' : 'translate-x-full'
                )}>
                    {selectedOrder && (
                        <Card className="h-full shadow-lg rounded-none">
                            <CardHeader className="flex flex-row items-start justify-between">
                                <div>
                                    <CardTitle>{t('detailsFor', { name: selectedOrder.user_name })}</CardTitle>
                                    <CardDescription>{t('orderId')}: {selectedOrder.doc_no}</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                    <X className="h-5 w-5" />
                                    <span className="sr-only">{t('close')}</span>
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
                                            <h4 className="text-md font-semibold">{tOrderItems('title', { id: selectedOrder.doc_no })}</h4>
                                            <Button variant="outline" size="icon" onClick={loadOrderItems} disabled={isLoadingOrderItems}>
                                                <RefreshCw className={`h-4 w-4 ${isLoadingOrderItems ? 'animate-spin' : ''}`} />
                                            </Button>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                            <X className="h-5 w-5" />
                                            <span className="sr-only">{t('close')}</span>
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
                                                <OrderItemsTable items={orderItems} isLoading={isLoadingOrderItems} onItemsUpdate={loadOrderItems} quoteId={selectedOrder.quote_id} userId={selectedOrder.user_id} />
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
                                                            <h4 className="text-md font-semibold">{tInvoiceItems('title', { id: selectedInvoice.id })}</h4>
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
                                                />
                                            </TabsContent>
                                        </Tabs>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
            <CreateOrderDialog
                isOpen={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onOrderCreated={loadOrders}
                isSales={true}
            />
        </div>
    );
}
