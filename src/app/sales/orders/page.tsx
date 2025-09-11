
'use client';

import * as React from 'react';
import { Order, OrderItem, Invoice, Payment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { OrdersTable } from '@/components/tables/orders-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { OrderItemsTable } from '@/components/tables/order-items-table';
import { RefreshCw } from 'lucide-react';

async function getOrders(): Promise<Order[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/all_orders', {
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
            payment_status: apiOrder.payment_status,
            billing_status: apiOrder.billing_status,
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

async function getInvoicesForOrder(orderId: string): Promise<Invoice[]> {
    if (!orderId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/order_invoices?order_id=${orderId}`, {
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
        }));
    } catch (error) {
        console.error("Failed to fetch invoices for order:", error);
        return [];
    }
}

async function getPaymentsForOrder(orderId: string): Promise<Payment[]> {
    if (!orderId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/order_payments?order_id=${orderId}`, {
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
            user_name: apiPayment.user_name || 'N/A',
            amount: apiPayment.amount || 0,
            method: apiPayment.method || 'credit_card',
            status: apiPayment.status || 'pending',
            createdAt: apiPayment.createdAt || new Date().toISOString().split('T')[0],
            updatedAt: apiPayment.updatedAt || new Date().toISOString().split('T')[0],
        }));
    } catch (error) {
        console.error("Failed to fetch payments for order:", error);
        return [];
    }
}

export default function OrdersPage() {
    const [orders, setOrders] = React.useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);

    const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [payments, setPayments] = React.useState<Payment[]>([]);

    const [isLoadingOrders, setIsLoadingOrders] = React.useState(false);
    const [isLoadingOrderItems, setIsLoadingOrderItems] = React.useState(false);
    const [isLoadingInvoices, setIsLoadingInvoices] = React.useState(false);
    const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);

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


    React.useEffect(() => {
        if (selectedOrder) {
            loadOrderItems();
            loadInvoices();
            loadPayments();
        } else {
            setOrderItems([]);
            setInvoices([]);
            setPayments([]);
        }
    }, [selectedOrder, loadOrderItems, loadInvoices, loadPayments]);

    const handleRowSelectionChange = (selectedRows: Order[]) => {
        const order = selectedRows.length > 0 ? selectedRows[0] : null;
        setSelectedOrder(order);
    };

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={cn("transition-all duration-300", selectedOrder ? "lg:col-span-1" : "lg:col-span-2")}>
                 <Card>
                    <CardHeader>
                        <CardTitle>Orders</CardTitle>
                        <CardDescription>Manage all customer orders.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <OrdersTable 
                            orders={orders}
                            isLoading={isLoadingOrders}
                            onRowSelectionChange={handleRowSelectionChange}
                            onRefresh={loadOrders}
                            isRefreshing={isLoadingOrders}
                        />
                    </CardContent>
                </Card>
            </div>

            {selectedOrder && (
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Details for Order</CardTitle>
                            <CardDescription>Order ID: {selectedOrder.id}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="items" className="w-full">
                                <TabsList className="h-auto items-center justify-start flex-wrap">
                                    <TabsTrigger value="items">Order Items</TabsTrigger>
                                    <TabsTrigger value="invoices">Invoices</TabsTrigger>
                                    <TabsTrigger value="payments">Payments</TabsTrigger>
                                </TabsList>
                                <TabsContent value="items">
                                   <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-md font-semibold">Order Items for {selectedOrder.id}</h4>
                                        <Button variant="outline" size="icon" onClick={loadOrderItems} disabled={isLoadingOrderItems}>
                                            <RefreshCw className={`h-4 w-4 ${isLoadingOrderItems ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>
                                   <OrderItemsTable items={orderItems} isLoading={isLoadingOrderItems} />
                                </TabsContent>
                                <TabsContent value="invoices">
                                    <InvoicesTable 
                                        invoices={invoices} 
                                        isLoading={isLoadingInvoices} 
                                        onRefresh={loadInvoices}
                                        isRefreshing={isLoadingInvoices}
                                    />
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
                </div>
            )}
        </div>
    );
}
