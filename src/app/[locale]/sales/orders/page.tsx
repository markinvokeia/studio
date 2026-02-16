'use client';

import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { OrderItemsTable } from '@/components/tables/order-items-table';
import { OrdersTable } from '@/components/tables/orders-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_ROUTES } from '@/constants/routes';
import { Invoice, InvoiceItem, Order, OrderItem, Payment } from '@/lib/types';
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
            service_id: apiItem.service_id || apiItem.serviceId || apiItem.service_id_raw || apiItem.id,
            service_name: apiItem.service_name || 'N/A',
            quantity: apiItem.quantity,
            unit_price: apiItem.unit_price,
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

async function getPaymentsForOrder(orderId: string): Promise<Payment[]> {
    if (!orderId) return [];
    try {
        const data = await api.get(API_ROUTES.SALES.ORDER_PAYMENTS, { order_id: orderId, is_sales: 'true' });
        const paymentsData = Array.isArray(data) ? data : (data.payments || data.data || []);

        if (!hasValidPayments(paymentsData)) {
            return [];
        }

        const isNewFormat = paymentsData[0].amount_applied !== undefined && typeof paymentsData[0].amount_applied === 'string';

        return paymentsData.map((apiPayment: any) => ({
            id: apiPayment.transaction_id ? String(apiPayment.transaction_id) : (apiPayment.id ? String(apiPayment.id) : 'N/A'),
            doc_no: apiPayment.doc_no || (apiPayment.transaction_doc_no ? String(apiPayment.transaction_doc_no) : 'N/A'),
            order_id: apiPayment.order_id || '',
            order_doc_no: apiPayment.order_doc_no || `ORD-${apiPayment.order_id}`,
            invoice_id: apiPayment.invoice_id || '',
            invoice_doc_no: apiPayment.invoice_doc_no || 'N/A',
            quote_id: apiPayment.quote_id || '',
            quote_doc_no: apiPayment.quote_doc_no || 'N/A',
            user_name: apiPayment.user_name || 'N/A',
            payment_date: apiPayment.payment_date || apiPayment.created_at || new Date().toISOString().split('T')[0],
            amount_applied: isNewFormat ? parseFloat(apiPayment.amount_applied) : (parseFloat(apiPayment.converted_amount) || 0),
            source_amount: isNewFormat ? parseFloat(apiPayment.source_amount) : (parseFloat(apiPayment.amount) || 0),
            source_currency: apiPayment.source_currency || 'UYU',
            exchange_rate: isNewFormat ? parseFloat(apiPayment.exchange_rate) : (parseFloat(apiPayment.exchange_rate) || 1),
            payment_method: apiPayment.payment_method_name || apiPayment.method || 'credit_card',
            payment_method_code: apiPayment.payment_method_code,
            transaction_type: apiPayment.transaction_type || 'direct_payment',
            transaction_id: apiPayment.transaction_id ? String(apiPayment.transaction_id) : (apiPayment.doc_no || String(apiPayment.id)),
            status: apiPayment.status || 'completed',
            createdAt: apiPayment.payment_date || apiPayment.created_at || new Date().toISOString().split('T')[0],
            updatedAt: apiPayment.payment_date || apiPayment.updatedAt || new Date().toISOString().split('T')[0],
            amount: isNewFormat ? parseFloat(apiPayment.amount_applied) : (parseFloat(apiPayment.converted_amount) || 0),
            method: apiPayment.payment_method_name || apiPayment.method || 'credit_card',
            currency: isNewFormat ? apiPayment.invoice_currency : (apiPayment.invoice_currency || 'USD'),
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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                isRightPanelOpen={!!selectedOrder}
                leftPanel={
                    <OrdersTable
                        orders={orders}
                        isLoading={isLoadingOrders}
                        onRowSelectionChange={handleRowSelectionChange}
                        onRefresh={loadOrders}
                        isRefreshing={isLoadingOrders}
                        rowSelection={rowSelection}
                        setRowSelection={setRowSelection}
                        isSales={true}
                        isCompact={!!selectedOrder}
                        standalone={true}
                        title={t('title')}
                        description={t('description')}
                    />
                }
                rightPanel={
                    selectedOrder && (
                        <Card className="h-full border-0 lg:border shadow-none lg:shadow-sm flex flex-col min-h-0">
                            <CardHeader className="flex flex-row items-start justify-between flex-none p-4">
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="text-lg lg:text-xl truncate">{t('detailsFor', { name: selectedOrder.user_name })}</CardTitle>
                                    <CardDescription className="text-xs">{t('orderId')}: {selectedOrder.doc_no}</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                    <X className="h-5 w-5" />
                                    <span className="sr-only">{t('close')}</span>
                                </Button>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 pt-0">
                                <Tabs defaultValue="items" className="flex-1 flex flex-col min-h-0">
                                    <TabsList className="h-auto items-center justify-start flex-wrap flex-none bg-muted/50 p-1">
                                        <TabsTrigger value="items" className="text-xs">{tQuotes('tabs.items')}</TabsTrigger>
                                        <TabsTrigger value="invoices" className="text-xs">{tQuotes('tabs.invoices')}</TabsTrigger>
                                        <TabsTrigger value="payments" className="text-xs">{tQuotes('tabs.payments')}</TabsTrigger>
                                    </TabsList>
                                    <div className="flex-1 min-h-0 mt-3 flex flex-col overflow-hidden">
                                        <TabsContent value="items" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                                            <div className="flex items-center justify-between mb-2 flex-none">
                                                <h4 className="text-sm font-semibold">{tOrderItems('title', { id: selectedOrder.doc_no || selectedOrder.id })}</h4>
                                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadOrderItems} disabled={isLoadingOrderItems}>
                                                    <RefreshCw className={`h-4 w-4 ${isLoadingOrderItems ? 'animate-spin' : ''}`} />
                                                </Button>
                                            </div>
                                            <OrderItemsTable
                                                items={orderItems}
                                                isLoading={isLoadingOrderItems}
                                                onItemsUpdate={loadOrderItems}
                                                quoteId={selectedOrder.quote_id}
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
                                        </TabsContent>
                                        <TabsContent value="invoices" className="m-0 flex-1 h-full overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col pr-2">
                                            <div className="flex-1 min-h-[400px] flex flex-col">
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
                                                    <div className="flex items-center justify-between mb-2 flex-none">
                                                        <h4 className="text-sm font-semibold">{tInvoiceItems('titleWithId', { id: selectedInvoice.doc_no || selectedInvoice.id })}</h4>
                                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadInvoiceItems} disabled={isLoadingInvoiceItems}>
                                                            <RefreshCw className={`h-4 w-4 ${isLoadingInvoiceItems ? 'animate-spin' : ''}`} />
                                                        </Button>
                                                    </div>
                                                    <InvoiceItemsTable items={invoiceItems} isLoading={isLoadingInvoiceItems} />
                                                </div>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="payments" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                                            <PaymentsTable
                                                payments={payments}
                                                isLoading={isLoadingPayments}
                                                onRefresh={loadPayments}
                                                isRefreshing={isLoadingPayments}
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
    );
}
