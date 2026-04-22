'use client';

import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { OrderItemsTable } from '@/components/tables/order-items-table';
import { OrdersTable } from '@/components/tables/orders-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { QuoteItemsTable } from '@/components/tables/quote-items-table';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { ActionButton } from '@/components/ui/action-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DetailHeader } from '@/components/ui/detail-header';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ServiceSelector } from '@/components/ui/service-selector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { normalizeApiResponse } from '@/lib/api-utils';
import { invoiceOrder } from '@/lib/invoice-actions';
import { Clinic, Invoice, InvoiceItem, Order, OrderItem, Payment, Quote, QuoteItem, Service, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CalendarDays, Check, CheckCircle, ChevronsUpDown, FileText, Loader2, Pencil, Receipt, RefreshCw, ShoppingCart, Stethoscope, Trash2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';


const quoteFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    user_id: z.string().min(1, t('validation.userRequired')),
    total: z.coerce.number().min(0, t('validation.totalPositive')),
    currency: z.enum(['UYU', 'USD', 'URU']).default('USD'),
    status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'pending', 'confirmed',
        'Draft', 'Sent', 'Accepted', 'Rejected', 'Pending', 'Confirmed']),
    payment_status: z.enum(['unpaid', 'paid', 'partial', 'partially_paid',
        'not_paid', 'not invoiced', 'not_invoiced']),
    billing_status: z.enum(['not invoiced', 'partially invoiced', 'invoiced',
        'not_invoiced', 'partially_invoiced', 'Pending']),
    exchange_rate: z.coerce.number().min(0.0001, t('validation.exchangeRatePositive')).optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        id: z.string().optional(),
        service_id: z.string().min(1, t('validation.serviceRequired')),
        quantity: z.coerce.number().int().min(1, t('validation.quantityMinOne')),
        unit_price: z.coerce.number().min(0, t('validation.unitPricePositive')).multipleOf(0.01, t('validation.unitPriceTwoDecimals')),
        total: z.coerce.number().min(0, t('validation.totalPositive')),
        tooth_number: z.coerce.number().int().min(11, t('validation.toothNumberMin')).max(85, t('validation.toothNumberMax')).optional().or(z.literal('')),
    })).default([]),
});

type QuoteFormValues = z.infer<ReturnType<typeof quoteFormSchema>>;

const quoteItemFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    quote_id: z.string(),
    service_id: z.string().min(1, t('validation.serviceRequired')),
    quantity: z.coerce.number().int().min(1, t('validation.quantityMinOne')),
    unit_price: z.coerce.number().min(0, t('validation.unitPricePositive')).multipleOf(0.01, t('validation.unitPriceTwoDecimals')),
    total: z.coerce.number().min(0, t('validation.totalPositive')),
    tooth_number: z.coerce.number().int().min(11, t('validation.toothNumberMin')).max(85, t('validation.toothNumberMax')).optional().or(z.literal('')),
});

type QuoteItemFormValues = z.infer<ReturnType<typeof quoteItemFormSchema>>;

interface QuoteAppointment {
    id: number;
    summary: string;
    status: string;
    start_datetime: string;
    end_datetime: string;
    notes: string | null;
}

async function getQuoteAppointments(quoteId: string): Promise<QuoteAppointment[]> {
    try {
        const data = await api.get(API_ROUTES.SALES.QUOTE_APPOINTMENTS, { quote_id: quoteId });
        const raw = Array.isArray(data) ? data : (data.appointments || data.data || data.result || []);
        return raw
            .filter((a: any) => a.id != null)
            .map((a: any) => ({
                id: a.id,
                summary: a.summary || '',
                status: a.status || '',
                start_datetime: a.start_datetime || '',
                end_datetime: a.end_datetime || '',
                notes: a.notes || null,
            }));
    } catch {
        return [];
    }
}

function getAppointmentColumns(
    t: (key: string) => string,
    tStatus: (key: string) => string,
): ColumnDef<QuoteAppointment>[] {
    return [
        {
            accessorKey: 'summary',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('appointments.columns.summary')} />,
            cell: ({ row }) => (
                <span className="truncate max-w-[300px] block" title={row.getValue('summary')}>
                    {row.getValue('summary')}
                </span>
            ),
        },
        {
            accessorKey: 'start_datetime',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('appointments.columns.date')} />,
            cell: ({ row }) => {
                const val: string = row.getValue('start_datetime');
                if (!val) return <span className="text-muted-foreground">—</span>;
                const d = parseISO(val);
                return <span>{format(d, 'dd/MM/yyyy HH:mm')}</span>;
            },
        },
        {
            accessorKey: 'end_datetime',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('appointments.columns.endTime')} />,
            cell: ({ row }) => {
                const val: string = row.getValue('end_datetime');
                if (!val) return <span className="text-muted-foreground">—</span>;
                return <span>{format(parseISO(val), 'HH:mm')}</span>;
            },
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('appointments.columns.status')} />,
            cell: ({ row }) => {
                const status: string = row.getValue('status') || '';
                const key = status.toLowerCase();
                const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
                    key === 'confirmed' || key === 'completed' ? 'default' :
                    key === 'cancelled' ? 'destructive' : 'secondary';
                return (
                    <Badge variant={variant} className="capitalize text-xs">
                        {tStatus(key) || status}
                    </Badge>
                );
            },
        },
    ];
}

interface QuoteClinicSession {
    id: string;
    paciente_id: string;
    doctor_id: string;
    fecha_sesion: string;
    procedimiento_realizado: string;
    plan_proxima_cita: string | null;
    diagnostico: string | null;
    notas_clinicas: string;
    fecha_proxima_cita: string | null;
    quote_id: number;
    paciente_nombre: string;
    doctor_nombre: string | null;
}

async function getQuoteClinicSessions(quoteId: string): Promise<QuoteClinicSession[]> {
    try {
        const data = await api.get(API_ROUTES.SALES.QUOTE_CLINIC_SESSIONS, { quote_id: quoteId });
        const raw = Array.isArray(data) ? data : (data.sessions || data.data || data.result || []);
        // Filter out empty objects and sessions without id
        return raw
            .filter((s: any) => {
                // Check if object has any meaningful properties (not just an empty object)
                if (Object.keys(s).length === 0) return false;
                // Check if id exists
                return s.id != null;
            })
            .map((s: any) => ({
                id: s.id || '',
                paciente_id: s.paciente_id || '',
                doctor_id: s.doctor_id || '',
                fecha_sesion: s.fecha_sesion || '',
                procedimiento_realizado: s.procedimiento_realizado || '',
                plan_proxima_cita: s.plan_proxima_cita || null,
                diagnostico: s.diagnostico || null,
                notas_clinicas: s.notas_clinicas || '',
                fecha_proxima_cita: s.fecha_proxima_cita || null,
                quote_id: s.quote_id || 0,
                paciente_nombre: s.paciente_nombre || '',
                doctor_nombre: s.doctor_nombre || null,
            }));
    } catch {
        return [];
    }
}

function getClinicSessionColumns(
    t: (key: string) => string,
): ColumnDef<QuoteClinicSession>[] {
    return [
        {
            accessorKey: 'fecha_sesion',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('clinicSessions.columns.date')} />,
            cell: ({ row }) => {
                const val: string = row.getValue('fecha_sesion');
                if (!val) return <span className="text-muted-foreground">—</span>;
                const d = parseISO(val);
                return <span>{format(d, 'dd/MM/yyyy')}</span>;
            },
        },
        {
            accessorKey: 'procedimiento_realizado',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('clinicSessions.columns.procedure')} />,
            cell: ({ row }) => (
                <span className="truncate max-w-[300px] block" title={row.getValue('procedimiento_realizado')}>
                    {row.getValue('procedimiento_realizado')}
                </span>
            ),
        },
        {
            accessorKey: 'doctor_nombre',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('clinicSessions.columns.doctor')} />,
            cell: ({ row }) => {
                const val: string | null = row.getValue('doctor_nombre');
                return <span>{val || '—'}</span>;
            },
        },
        {
            accessorKey: 'plan_proxima_cita',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('clinicSessions.columns.nextPlan')} />,
            cell: ({ row }) => {
                const val: string | null = row.getValue('plan_proxima_cita');
                return (
                    <span className="truncate max-w-[200px] block" title={val || ''}>
                        {val || '—'}
                    </span>
                );
            },
        },
        {
            accessorKey: 'fecha_proxima_cita',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('clinicSessions.columns.nextDate')} />,
            cell: ({ row }) => {
                const val: string | null = row.getValue('fecha_proxima_cita');
                if (!val) return <span className="text-muted-foreground">—</span>;
                const d = parseISO(val);
                return <span>{format(d, 'dd/MM/yyyy')}</span>;
            },
        },
    ];
}

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
            notes: apiQuote.notes || '',
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


async function upsertQuoteItem(itemData: QuoteItemFormValues, t: (key: string) => string) {
    const responseData = await api.post(API_ROUTES.SALES.QUOTES_LINES_UPSERT, { ...itemData, is_sales: true });
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
        const data = await api.get(API_ROUTES.SALES.QUOTES_ORDERS, { quote_id: quoteId, is_sales: 'true' });
        const ordersData = Array.isArray(data) ? data : (data.orders || data.data || []);
        return ordersData.map((apiOrder: any) => ({
            id: apiOrder.id ? String(apiOrder.id) : t('defaults.notAvailable'),
            doc_no: apiOrder.doc_no || t('defaults.notAvailable'),
            user_id: apiOrder.user_id,
            quote_id: apiOrder.quote_id,
            quote_doc_no: apiOrder.quote_doc_no || t('defaults.notAvailable'),
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
        const data = await api.get(API_ROUTES.SALES.ORDER_ITEMS, { order_id: orderId, is_sales: 'true' });
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
            quote_item_id: apiItem.quote_item_id != null ? String(apiItem.quote_item_id) : undefined,
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
            updatedAt: apiInvoice.updated_at || apiInvoice.updatedAt || new Date().toISOString(),
            is_historical: apiInvoice.is_historical || false,
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
            updatedAt: apiPayment.payment_date || apiPayment.updated_at || apiPayment.created_at,
            is_historical: apiPayment.is_historical || false,
        }));
    } catch (error) {
        console.error("Failed to fetch payments:", error);
        return [];
    }
}

async function getUsers(t: (key: string) => string, search?: string): Promise<User[]> {
    try {
        const params: any = { filter_type: 'PACIENTE' };
        if (search?.trim()) {
            params.search = search.trim();
        }
        const responseData = await api.get(API_ROUTES.SALES.USERS, params);
        const data = (Array.isArray(responseData) && responseData.length > 0) ? responseData[0] : { data: [], total: 0 };
        const usersData = Array.isArray(data.data) ? data.data : [];
        return usersData.map((apiUser: any) => ({
            id: apiUser.id ? String(apiUser.id) : t('defaults.noName'),
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
    const t = useTranslations('QuotesPage');
    const tRoot = useTranslations();
    const tVal = useTranslations('QuotesPage');
    const { toast } = useToast();
    const { user, activeCashSession } = useAuth();
    const { hasPermission } = usePermissions();

    // Permission checks for UI elements (used in this page and child components)
    const canViewList = hasPermission(SALES_PERMISSIONS.QUOTES_VIEW_LIST);
    const canCreateQuote = hasPermission(SALES_PERMISSIONS.QUOTES_CREATE);
    const canUpdateQuote = hasPermission(SALES_PERMISSIONS.QUOTES_UPDATE);
    const canDeleteQuote = hasPermission(SALES_PERMISSIONS.QUOTES_DELETE);
    const canConfirmQuote = hasPermission(SALES_PERMISSIONS.QUOTES_CONFIRM);
    const canRejectQuote = hasPermission(SALES_PERMISSIONS.QUOTES_REJECT);
    const canSendEmail = hasPermission(SALES_PERMISSIONS.QUOTES_SEND_EMAIL);
    const canPrint = hasPermission(SALES_PERMISSIONS.QUOTES_PRINT);
    const canViewDetail = hasPermission(SALES_PERMISSIONS.QUOTES_VIEW_DETAIL);
    const canViewItems = hasPermission(SALES_PERMISSIONS.QUOTES_VIEW_ITEMS);
    const canAddItem = hasPermission(SALES_PERMISSIONS.QUOTES_ADD_ITEM);
    const canUpdateItem = hasPermission(SALES_PERMISSIONS.QUOTES_UPDATE_ITEM);
    const canDeleteItem = hasPermission(SALES_PERMISSIONS.QUOTES_DELETE_ITEM);
    const canViewOrders = hasPermission(SALES_PERMISSIONS.QUOTES_VIEW_ORDERS);
    const canViewInvoices = hasPermission(SALES_PERMISSIONS.QUOTES_VIEW_INVOICES);
    const canViewPayments = hasPermission(SALES_PERMISSIONS.QUOTES_VIEW_PAYMENTS);
    const canScheduleItem = hasPermission(SALES_PERMISSIONS.ORDERS_SCHEDULE_ITEM);
    const canCompleteItem = hasPermission(SALES_PERMISSIONS.ORDERS_COMPLETE_ITEM);
    const canInvoice = hasPermission(SALES_PERMISSIONS.ORDERS_INVOICE_FROM_ORDER);
    const [quotes, setQuotes] = React.useState<Quote[]>([]);
    const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
    const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);

    const [orders, setOrders] = React.useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
    const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
    const isQuoteReadyToInvoice = ['accepted', 'confirmed'].includes(selectedQuote?.status?.toLowerCase() || '');
    const selectedOrderBelongsToQuote = selectedQuote && selectedOrder && String(selectedOrder.quote_id) === selectedQuote.id;
    const hasServicesPendingInvoice = orderItems.some(item => !item.invoiced_date);

    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
    const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([]);

    const [payments, setPayments] = React.useState<Payment[]>([]);
    const [quoteAppointments, setQuoteAppointments] = React.useState<QuoteAppointment[]>([]);
    const [quoteClinicSessions, setQuoteClinicSessions] = React.useState<QuoteClinicSession[]>([]);

    const [clinic, setClinic] = React.useState<Clinic | null>(null);

    const [isLoadingItems, setIsLoadingItems] = React.useState(false);
    const [isLoadingOrders, setIsLoadingOrders] = React.useState(false);
    const [isLoadingOrderItems, setIsLoadingOrderItems] = React.useState(false);
    const [isLoadingInvoices, setIsLoadingInvoices] = React.useState(false);
    const [isLoadingInvoiceItems, setIsLoadingInvoiceItems] = React.useState(false);
    const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);
    const [isLoadingAppointments, setIsLoadingAppointments] = React.useState(false);
    const [isLoadingClinicSessions, setIsLoadingClinicSessions] = React.useState(false);

    const [isQuoteDialogOpen, setIsQuoteDialogOpen] = React.useState(false);
    const [editingQuote, setEditingQuote] = React.useState<Quote | null>(null);
    const [deletingQuote, setDeletingQuote] = React.useState<Quote | null>(null);
    const [isDeleteQuoteDialogOpen, setIsDeleteQuoteDialogOpen] = React.useState(false);
    const [quoteSubmissionError, setQuoteSubmissionError] = React.useState<string | null>(null);
    const [isSubmittingQuote, setIsSubmittingQuote] = React.useState(false);

    const [isQuoteItemDialogOpen, setIsQuoteItemDialogOpen] = React.useState(false);
    const [editingQuoteItem, setEditingQuoteItem] = React.useState<QuoteItem | null>(null);
    const [deletingQuoteItem, setDeletingQuoteItem] = React.useState<QuoteItem | null>(null);
    const [isDeleteQuoteItemDialogOpen, setIsDeleteQuoteItemDialogOpen] = React.useState(false);
    const [quoteItemSubmissionError, setQuoteItemSubmissionError] = React.useState<string | null>(null);
    const [isSubmittingQuoteItem, setIsSubmittingQuoteItem] = React.useState(false);

    const [allUsers, setAllUsers] = React.useState<User[]>([]);
    const [userSearchTerm, setUserSearchTerm] = React.useState('');
    const debouncedUserSearch = useDebounce(userSearchTerm, 300);
    const [isLoadingUsers, setIsLoadingUsers] = React.useState(false);
    const [isUserSearchOpen, setUserSearchOpen] = React.useState(false);
    const [allServices, setAllServices] = React.useState<Service[]>([]);

    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [isSendingEmail, setIsSendingEmail] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

    const [isConfirmQuoteDialogOpen, setIsConfirmQuoteDialogOpen] = React.useState(false);
    const [confirmingQuote, setConfirmingQuote] = React.useState<Quote | null>(null);
    const [confirmingAction, setConfirmingAction] = React.useState<'confirm' | 'reject'>('confirm');
    const [confirmNotes, setConfirmNotes] = React.useState('');

    const [exchangeRate, setExchangeRate] = React.useState<number>(1);
    const [showConversion, setShowConversion] = React.useState(false);
    const [originalServicePrice, setOriginalServicePrice] = React.useState<number | null>(null);
    const [originalServiceCurrency, setOriginalServiceCurrency] = React.useState('');
    const quoteForm = useForm<QuoteFormValues>({ resolver: zodResolver(quoteFormSchema(tVal)), mode: 'onBlur' });
    const quoteItemForm = useForm<QuoteItemFormValues>({ resolver: zodResolver(quoteItemFormSchema(tVal)), mode: 'onBlur' });
    const { fields: quoteFormFields, append: appendQuoteItem, remove: removeQuoteItem, replace: replaceQuoteItems } = useFieldArray({
        control: quoteForm.control,
        name: 'items',
    });

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

    const loadQuoteAppointments = React.useCallback(async () => {
        if (!selectedQuote) return;
        setIsLoadingAppointments(true);
        setQuoteAppointments(await getQuoteAppointments(selectedQuote.id));
        setIsLoadingAppointments(false);
    }, [selectedQuote]);

    const loadQuoteClinicSessions = React.useCallback(async () => {
        if (!selectedQuote) return;
        setIsLoadingClinicSessions(true);
        setQuoteClinicSessions(await getQuoteClinicSessions(selectedQuote.id));
        setIsLoadingClinicSessions(false);
    }, [selectedQuote]);

    React.useEffect(() => {
        if (selectedQuote) {
            loadQuoteItems();
            loadOrders();
            loadInvoices();
            loadPayments();
            loadQuoteAppointments();
            loadQuoteClinicSessions();
            setSelectedOrder(null);
            setSelectedInvoice(null);
        } else {
            setQuoteItems([]);
            setOrders([]);
            setInvoices([]);
            setPayments([]);
            setQuoteAppointments([]);
            setQuoteClinicSessions([]);
        }
    }, [selectedQuote, loadQuoteItems, loadOrders, loadInvoices, loadPayments, loadQuoteAppointments, loadQuoteClinicSessions]);

    React.useEffect(() => {
        if (selectedOrder) {
            loadOrderItems();
        } else {
            setOrderItems([]);
        }
    }, [selectedOrder, loadOrderItems]);

    // Auto-select first order for invoice-ready quotes once orders are loaded
    React.useEffect(() => {
        if (isQuoteReadyToInvoice && orders.length > 0) {
            setSelectedOrder(orders[0]);
        }
    }, [isQuoteReadyToInvoice, orders]);

    React.useEffect(() => {
        if (selectedInvoice) {
            loadInvoiceItems();
        } else {
            setInvoiceItems([]);
        }
    }, [selectedInvoice, loadInvoiceItems]);

    const loadUsersForQuoteDialog = React.useCallback(async () => {
        try {
            const users = await getUsers(t);
            setAllUsers(users);
        } catch (error) {
            toast({ variant: 'destructive', title: t('errors.errorTitle'), description: t('errors.failedToLoadUsers') });
        }
    }, [t, toast]);

    // Fetch users when search term changes (debounced) or when dialog opens
    React.useEffect(() => {
        const fetchUsers = async () => {
            // Only fetch if dialog is open and either we have a search term or it's initial load
            if (!isQuoteDialogOpen) return;
            setIsLoadingUsers(true);
            try {
                const users = await getUsers(t, debouncedUserSearch);
                setAllUsers(users);
            } catch (error) {
                console.error('Failed to fetch users:', error);
            } finally {
                setIsLoadingUsers(false);
            }
        };
        fetchUsers();
    }, [debouncedUserSearch, isQuoteDialogOpen, t]);

    // Reset user search when dialog closes
    React.useEffect(() => {
        if (!isQuoteDialogOpen) {
            setUserSearchTerm('');
        }
    }, [isQuoteDialogOpen]);

    const handleCreateQuote = async () => {
        setEditingQuote(null);
        const sessionRate = getSessionExchangeRate();
        const defaultCurrency = clinic?.currency || 'UYU';
        const exchangeRate = defaultCurrency === clinic?.currency ? 1 : sessionRate;
        quoteForm.reset(
            {
                user_id: '', total: 0, currency: defaultCurrency, status: 'draft',
                payment_status: 'unpaid', billing_status: 'not invoiced',
                exchange_rate: exchangeRate, notes: '', items: []
            },
            {
                keepErrors: false, keepDirty: false, keepIsSubmitted: false,
                keepTouched: false, keepIsValid: false, keepSubmitCount: false
            }
        );
        setQuoteSubmissionError(null);
        setIsQuoteDialogOpen(true);
    };

    const normalizeQuoteFields = (quote: Quote) => {
        const statusMap: Record<string, string> = {
            'Confirmed': 'confirmed', 'Rejected': 'rejected',
            'Pending': 'pending', 'Draft': 'draft', 'Sent': 'sent', 'Accepted': 'accepted',
        };
        const paymentStatusMap: Record<string, string> = {
            'not_paid': 'unpaid', 'not invoiced': 'unpaid', 'not_invoiced': 'unpaid',
        };
        const billingStatusMap: Record<string, string> = {
            'not_invoiced': 'not invoiced', 'partially_invoiced': 'partially invoiced',
            'Pending': 'not invoiced',
        };
        const currencyMap: Record<string, string> = { 'URU': 'UYU' };
        return {
            status: (statusMap[quote.status] || quote.status.toLowerCase()) as any,
            payment_status: (paymentStatusMap[quote.payment_status] || quote.payment_status) as any,
            billing_status: (billingStatusMap[quote.billing_status] || quote.billing_status) as any,
            currency: (currencyMap[quote.currency || ''] || quote.currency || 'USD') as any,
        };
    };

    const handleEditQuote = async (quote: Quote) => {
        if (quote.status.toLowerCase() !== 'draft') {
            toast({ variant: 'destructive', title: t('errors.cannotEdit'), description: t('errors.cannotEditDetail') });
            return;
        }
        setEditingQuote(quote);
        setIsSubmittingQuote(false);
        const sessionRate = getSessionExchangeRate();
        const normalized = normalizeQuoteFields(quote);
        const exchangeRate = normalized.currency === clinic?.currency ? 1 : (quote.exchange_rate || sessionRate);

        const items = await getQuoteItems(quote.id, t);
        const mappedItems = items.map(item => ({
            id: item.id,
            service_id: String(item.service_id),
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            tooth_number: item.tooth_number ? Number(item.tooth_number) : ('' as const)
        }));

        quoteForm.reset(
            {
                id: quote.id, user_id: quote.user_id, total: quote.total,
                currency: normalized.currency, status: normalized.status,
                payment_status: normalized.payment_status, billing_status: normalized.billing_status,
                exchange_rate: exchangeRate, notes: quote.notes || '', items: mappedItems
            },
            {
                keepErrors: false, keepDirty: false, keepIsSubmitted: false,
                keepTouched: false, keepIsValid: false, keepSubmitCount: false
            }
        );
        setQuoteSubmissionError(null);
        setIsQuoteDialogOpen(true);
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
        if (isSubmittingQuote) return;
        setIsSubmittingQuote(true);
        setQuoteSubmissionError(null);
        try {
            if (!editingQuote && (!values.items || values.items.length === 0)) {
                throw new Error(t('quoteDialog.atLeastOneItem'));
            }
            const itemsToSubmit = values.items.map(item => ({
                id: item.id,
                service_id: item.service_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.total,
                tooth_number: item.tooth_number ? Number(item.tooth_number) : null
            }));
            const normalizeBilling = (s: string) =>
                s === 'not_invoiced' ? 'not invoiced' : s === 'partially_invoiced' ? 'partially invoiced' : s;

            const payload = {
                ...values,
                billing_status: normalizeBilling(values.billing_status),
                items: itemsToSubmit
            };
            await upsertQuote(payload as any, t);
            toast({ title: editingQuote ? t('toast.quoteUpdated') : t('toast.quoteCreated'), description: t('toast.quoteSaveSuccess') });
            setIsQuoteDialogOpen(false);
            setEditingQuote(null);
            quoteForm.reset(
                undefined,
                {
                    keepErrors: false, keepDirty: false, keepIsSubmitted: false,
                    keepTouched: false, keepIsValid: false, keepSubmitCount: false
                }
            );
            loadQuotes();
        } catch (error) {
            setQuoteSubmissionError(error instanceof Error ? error.message : t('toast.quoteError'));
        } finally {
            setIsSubmittingQuote(false);
        }
    };

    // Recalculate total whenever items change
    const watchedItems = quoteForm.watch('items');
    React.useEffect(() => {
        const items = watchedItems || [];
        const newTotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        const currentTotal = quoteForm.getValues('total') || 0;
        if (Math.abs(newTotal - currentTotal) > 0.001) {
            quoteForm.setValue('total', newTotal, { shouldDirty: true });
        }
    }, [watchedItems, quoteForm]);

    const handleAddQuoteItem = () => {
        appendQuoteItem({ service_id: '', quantity: 1, unit_price: 0, total: 0, tooth_number: '' });
    };

    const handleRemoveQuoteItem = (index: number) => {
        removeQuoteItem(index);
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
    };

    const handleEditQuoteItem = async (item: QuoteItem) => {
        if (!selectedQuote) return;

        setEditingQuoteItem(item);
        setQuoteItemSubmissionError(null);
        setShowConversion(false);
        setOriginalServicePrice(null);
        setOriginalServiceCurrency('');

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
        if (isSubmittingQuoteItem) return;
        setIsSubmittingQuoteItem(true);
        setQuoteItemSubmissionError(null);
        try {
            await upsertQuoteItem(values, t);
            toast({ title: editingQuoteItem ? t('toast.itemUpdated') : t('toast.itemAdded'), description: t('toast.itemSaveSuccess') });
            setIsQuoteItemDialogOpen(false);
            setEditingQuoteItem(null);
            loadQuoteItems();
            loadQuotes();
        } catch (error) {
            setQuoteItemSubmissionError(error instanceof Error ? error.message : t('toast.itemError'));
        } finally {
            setIsSubmittingQuoteItem(false);
        }
    };

    const handleQuoteAction = async (quote: Quote, action: 'confirm' | 'reject', notes?: string) => {
        try {
            const payload = { quote_number: quote.id, confirm_reject: action, is_sales: true, notes: notes || '' };
            const endpoint = action === 'confirm' ? API_ROUTES.SALES.QUOTE_CONFIRM : API_ROUTES.SALES.QUOTE_REJECT;
            const responseData = await api.post(endpoint, payload);
            if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
                const message = responseData[0]?.message ? responseData[0]?.message : t('toast.quoteActionError', { action: action });
                throw new Error(message);
            }
            toast({ title: action === 'confirm' ? t('toast.quoteConfirmed') : t('toast.quoteRejected'), description: t(action === 'confirm' ? 'toast.quoteConfirmSuccess' : 'toast.quoteRejectSuccess', { id: quote.doc_no || quote.id }) });
            loadQuotes();
        } catch (error) {
            toast({ variant: 'destructive', title: t('errors.errorTitle'), description: error instanceof Error ? error.message : t('toast.quoteActionError', { action: action }) });
        }
    };

    const handleQuoteActionRequest = (quote: Quote, action: 'confirm' | 'reject') => {
        setConfirmingQuote(quote);
        setConfirmingAction(action);
        setConfirmNotes('');
        setIsConfirmQuoteDialogOpen(true);
    };

    const handleConfirmQuoteAction = async () => {
        if (!confirmingQuote) return;
        await handleQuoteAction(confirmingQuote, confirmingAction, confirmNotes);
        setIsConfirmQuoteDialogOpen(false);
        setConfirmingQuote(null);
        setConfirmNotes('');
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

    const handleInvoiceFromQuote = async () => {
        if (!selectedQuote || !selectedOrderBelongsToQuote || !hasServicesPendingInvoice) return;
        try {
            await invoiceOrder({
                orderId: selectedOrder.id,
                userId: selectedOrder.user_id,
                mode: 'sales',
            });
            toast({
                title: t('actions.invoiceSuccess'),
                description: t('actions.invoiceSuccessDesc', { orderId: selectedOrder.doc_no }),
            });
            loadQuotes();
            loadOrders();
            loadOrderItems();
            loadInvoices();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('errors.errorTitle'),
                description: error instanceof Error ? error.message : t('actions.invoiceError'),
            });
        }
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

    return (
        <>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <TwoPanelLayout
                    isRightPanelOpen={!!selectedQuote}
                    onBack={handleCloseDetails}
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
                            onQuoteActionRequest={(canConfirmQuote || canRejectQuote) ? handleQuoteActionRequest : undefined}
                            isCompact={!!selectedQuote}
                            standalone={true}
                            title={t('title')}
                            description={t('description')}
                            className="h-full"
                            isSendingEmail={isSendingEmail}
                            setIsSendingEmail={setIsSendingEmail}
                            isSales={true}
                        />
                    }
                    rightPanel={
                        selectedQuote && (
                            <Card className="h-full border-0 lg:border shadow-none lg:shadow-sm flex flex-col min-h-0">
                                <CardHeader className="flex-none p-4">
                                    <DetailHeader
                                        icon={FileText}
                                        title={t('detailsFor', { name: selectedQuote.user_name })}
                                        subtitle={`${t('quoteId')}: ${selectedQuote.doc_no || selectedQuote.id}`}
                                        fields={[
                                            {
                                                label: t('tabs.total'),
                                                value: new Intl.NumberFormat('en-US', {
                                                    style: 'currency',
                                                    currency: selectedQuote.currency || 'USD',
                                                }).format(selectedQuote.total),
                                                variant: 'default',
                                            },
                                            {
                                                label: t('UserColumns.status'),
                                                value: (() => {
                                                    const status = selectedQuote.status.toLowerCase();
                                                    const translated = t(`quoteDialog.${status}` as any);
                                                    return translated === `quoteDialog.${status}`
                                                        ? selectedQuote.status.charAt(0).toUpperCase() + selectedQuote.status.slice(1)
                                                        : translated;
                                                })(),
                                                variant: selectedQuote.status === 'accepted' || selectedQuote.status === 'confirmed' ? 'success' :
                                                    selectedQuote.status === 'rejected' ? 'destructive' :
                                                        selectedQuote.status === 'pending' ? 'info' : 'outline',
                                            },
                                            {
                                                label: t('QuoteColumns.billingStatus'),
                                                value: (() => {
                                                    const status = selectedQuote.billing_status.toLowerCase();
                                                    const statusKeyMap: { [key: string]: string } = {
                                                        'invoiced': 'invoiced',
                                                        'partially invoiced': 'partiallyInvoiced',
                                                        'not invoiced': 'notInvoiced',
                                                        'partially_invoiced': 'partially_invoiced',
                                                        'not_invoiced': 'not_invoiced',
                                                    };
                                                    const key = statusKeyMap[status] || status.replace(/\s+/g, '_');
                                                    const translated = t(`quoteDialog.${key}` as any);
                                                    return translated === `quoteDialog.${key}`
                                                        ? selectedQuote.billing_status.charAt(0).toUpperCase() + selectedQuote.billing_status.slice(1)
                                                        : translated;
                                                })(),
                                                variant: selectedQuote.billing_status === 'invoiced' ? 'success' :
                                                    selectedQuote.billing_status === 'partially invoiced' ? 'info' : 'outline',
                                            },
                                            {
                                                label: t('Navigation.Payments'),
                                                value: (() => {
                                                    const status = selectedQuote.payment_status.toLowerCase();
                                                    const statusKeyMap: { [key: string]: string } = {
                                                        'partially_paid': 'partiallyPaid',
                                                        'unpaid': 'unpaid',
                                                        'not_paid': 'not_paid',
                                                        'paid': 'paid',
                                                        'partial': 'partial',
                                                    };
                                                    const key = statusKeyMap[status] || status.replace(/\s+/g, '_');
                                                    const translated = t(`quoteDialog.${key}` as any);
                                                    return translated === `quoteDialog.${key}`
                                                        ? selectedQuote.payment_status.charAt(0).toUpperCase() + selectedQuote.payment_status.slice(1).replace('_', ' ')
                                                        : translated;
                                                })(),
                                                variant: selectedQuote.payment_status === 'paid' || selectedQuote.payment_status === 'partial' ? 'success' :
                                                    selectedQuote.payment_status === 'partially_paid' ? 'info' : 'outline',
                                            },
                                        ]}
                                        actions={
                                            <>
                                                {canUpdateQuote && selectedQuote.status.toLowerCase() === 'draft' && (
                                                    <ActionButton
                                                        icon={Pencil}
                                                        label={t('edit')}
                                                        tooltip={t('editTooltip') || t('edit')}
                                                        onClick={() => handleEditQuote(selectedQuote)}
                                                    />
                                                )}
                                                {(canConfirmQuote || canRejectQuote) && selectedQuote.status.toLowerCase() === 'draft' && (
                                                    <>
                                                        <ActionButton
                                                            icon={CheckCircle}
                                                            label={t('confirm')}
                                                            tooltip={t('confirmTooltip') || t('confirm')}
                                                            onClick={() => handleQuoteActionRequest(selectedQuote, 'confirm')}
                                                        />
                                                        <ActionButton
                                                            icon={XCircle}
                                                            label={t('reject')}
                                                            tooltip={t('rejectTooltip') || t('reject')}
                                                            destructive
                                                            onClick={() => handleQuoteActionRequest(selectedQuote, 'reject')}
                                                        />
                                                    </>
                                                )}
                                                {canDeleteQuote && selectedQuote.status.toLowerCase() === 'draft' && (
                                                    <ActionButton
                                                        icon={Trash2}
                                                        label={t('delete')}
                                                        tooltip={t('deleteTooltip') || t('delete')}
                                                        destructive
                                                        onClick={() => handleDeleteQuote(selectedQuote)}
                                                    />
                                                )}
                                                {canInvoice && isQuoteReadyToInvoice && selectedOrderBelongsToQuote && !isLoadingOrderItems && hasServicesPendingInvoice && (
                                                    <ActionButton
                                                        icon={Receipt}
                                                        label={t('actions.invoice')}
                                                        tooltip={t('actions.invoice')}
                                                        onClick={handleInvoiceFromQuote}
                                                    />
                                                )}
                                            </>
                                        }
                                        onClose={handleCloseDetails}
                                    />
                                </CardHeader>
                                <CardContent className="flex-1 flex flex-col overflow-hidden p-4 pt-0 min-h-0 bg-card">
                                    <Tabs defaultValue="items" className="flex-1 flex flex-col min-h-0">
                                        <TabsList>
                                            <TabsTrigger value="items" className="text-xs">{t('tabs.items')}</TabsTrigger>
                                            {/* hidden: orders tab <TabsTrigger value="orders" className="text-xs">{t('tabs.orders')}</TabsTrigger> */}
                                            <TabsTrigger value="invoices" className="text-xs">{t('tabs.invoices')}</TabsTrigger>
                                            <TabsTrigger value="payments" className="text-xs">{t('tabs.payments')}</TabsTrigger>
                                            <TabsTrigger value="notes" className="text-xs">{t('tabs.notes')}</TabsTrigger>
                                            <TabsTrigger value="appointments" className="text-xs">{t('tabs.appointments')}</TabsTrigger>
                                            <TabsTrigger value="clinicSessions" className="text-xs">{t('tabs.clinicSessions')}</TabsTrigger>
                                        </TabsList>
                                        <div className="flex-1 min-h-0 mt-4 flex flex-col">
                                            <TabsContent value="items" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                                                {isQuoteReadyToInvoice ? (
                                                    <OrderItemsTable
                                                        items={orderItems}
                                                        isLoading={isLoadingOrders || isLoadingOrderItems}
                                                        onItemsUpdate={loadOrderItems}
                                                        quoteId={selectedOrder?.quote_id}
                                                        quoteDocNo={selectedOrder?.quote_doc_no}
                                                        userId={selectedQuote.user_id}
                                                        patient={{
                                                            id: selectedQuote.user_id,
                                                            name: selectedQuote.user_name || '',
                                                            email: selectedQuote.userEmail || '',
                                                            phone_number: '',
                                                            is_active: true,
                                                            avatar: '',
                                                        }}
                                                        isSales={true}
                                                        canSchedule={canScheduleItem}
                                                        canComplete={canCompleteItem}
                                                    />
                                                ) : (
                                                    <QuoteItemsTable
                                                        items={quoteItems}
                                                        isLoading={isLoadingItems}
                                                        onRefresh={loadQuoteItems}
                                                        isRefreshing={isLoadingItems}
                                                        canEdit={canEditQuote && canUpdateItem}
                                                        onCreate={canAddItem ? handleCreateQuoteItem : () => { }}
                                                        onEdit={canUpdateItem ? handleEditQuoteItem : () => { }}
                                                        onDelete={canDeleteItem ? handleDeleteQuoteItem : () => { }}
                                                        showToothNumber={true}
                                                    />
                                                )}
                                            </TabsContent>
                                            {/* hidden: orders tab
                                            <TabsContent value="orders" className="m-0 h-full overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col pr-2">
                                                <div className="flex-1 min-h-[400px] flex flex-col">
                                                    <div className="flex items-center justify-between mb-2 flex-none">
                                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                                            <ShoppingCart className="h-4 w-4" />
                                                            {t('tabs.orders')}
                                                        </h4>
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
                                                {selectedOrder && (
                                                    <div className="mt-4 border-t pt-4 flex-1 flex flex-col min-h-[400px]">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className="text-sm font-semibold">{tRoot('OrderItemsTable.title', { id: selectedOrder.doc_no || selectedOrder.id })}</h4>
                                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadOrderItems} disabled={isLoadingOrderItems}>
                                                                <RefreshCw className={`h-4 w-4 ${isLoadingOrderItems ? 'animate-spin' : ''}`} />
                                                            </Button>
                                                        </div>
                                                        <OrderItemsTable
                                                            items={orderItems}
                                                            isLoading={isLoadingOrderItems}
                                                            onItemsUpdate={loadOrderItems}
                                                            quoteId={selectedQuote.id}
                                                            quoteDocNo={selectedQuote.doc_no}
                                                            userId={selectedOrder.user_id}
                                                            patient={{
                                                                id: selectedQuote.user_id,
                                                                name: selectedQuote.user_name || 'Patient',
                                                                email: selectedQuote.userEmail || '',
                                                                phone_number: '', // We don't have it here but ID and Name are enough for pre-selection
                                                                is_active: true,
                                                                avatar: ''
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </TabsContent>
                                            */}
                                            <TabsContent value="invoices" className="m-0 h-full overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col pr-2">
                                                <div className="flex-1 min-h-[400px]">
                                                    <div className="flex items-center justify-between mb-2 flex-none">
                                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                                            <Receipt className="h-4 w-4" />
                                                            {t('tabs.invoices')}
                                                        </h4>
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
                                            <TabsContent value="notes" className="m-0 h-full p-4">
                                                {selectedQuote?.notes ? (
                                                    <div className="whitespace-pre-wrap text-sm">{selectedQuote.notes}</div>
                                                ) : (
                                                    <p className="text-muted-foreground text-sm">{t('notes.noNotes')}</p>
                                                )}
                                            </TabsContent>
                                            <TabsContent value="appointments" className="m-0 h-full overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col pr-2">
                                                <div className="flex-1 min-h-[400px] flex flex-col">
                                                    <div className="flex items-center justify-between mb-2 flex-none">
                                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                                            <CalendarDays className="h-4 w-4" />
                                                            {t('tabs.appointments')}
                                                        </h4>
                                                    </div>
                                                    <div className="flex-1 min-h-0">
                                                        <DataTable
                                                            columns={getAppointmentColumns(t, (key) => tRoot(`AppointmentStatus.${key}`))}
                                                            data={quoteAppointments}
                                                            isRefreshing={isLoadingAppointments}
                                                            onRefresh={loadQuoteAppointments}
                                                        />
                                                    </div>
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="clinicSessions" className="m-0 h-full overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col pr-2">
                                                <div className="flex-1 min-h-[400px] flex flex-col">
                                                    <div className="flex items-center justify-between mb-2 flex-none">
                                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                                            <Stethoscope className="h-4 w-4" />
                                                            {t('tabs.clinicSessions')}
                                                        </h4>
                                                    </div>
                                                    <div className="flex-1 min-h-0">
                                                        <DataTable
                                                            columns={getClinicSessionColumns(t)}
                                                            data={quoteClinicSessions}
                                                            isRefreshing={isLoadingClinicSessions}
                                                            onRefresh={loadQuoteClinicSessions}
                                                        />
                                                    </div>
                                                </div>
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </CardContent>
                            </Card>
                        )
                    }
                />
            </div>
            <Dialog open={isQuoteDialogOpen} onOpenChange={(open) => {
                setIsQuoteDialogOpen(open);
                if (!open) {
                    setEditingQuote(null);
                }
            }}>
                <DialogContent showMaximize={true} maxWidth="6xl">
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
                                                    <Command shouldFilter={false}>
                                                        <CommandInput placeholder={t('quoteDialog.searchUser')} value={userSearchTerm} onValueChange={setUserSearchTerm} />
                                                        <CommandList>
                                                            {isLoadingUsers ? (
                                                                <CommandEmpty>Searching...</CommandEmpty>
                                                            ) : (
                                                                <>
                                                                    <CommandEmpty>{t('quoteDialog.noUserFound')}</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {allUsers.map((user) => (
                                                                            <CommandItem value={user.name} key={user.id} onSelect={() => { quoteForm.setValue("user_id", user.id); setUserSearchOpen(false); }}>
                                                                                <Check className={cn("mr-2 h-4 w-4", user.id === field.value ? "opacity-100" : "opacity-0")} />
                                                                                {user.name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </>
                                                            )}
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField
                                        control={quoteForm.control}
                                        name="total"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('quoteDialog.total')}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder={t('placeholders.total')}
                                                        {...field}
                                                        readOnly
                                                        className="bg-muted cursor-not-allowed"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={quoteForm.control}
                                        name="currency"
                                        render={({ field }) => (
                                            <FormItem>
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
                                </div>
                                <FormField
                                    control={quoteForm.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-3">
                                            <FormLabel>{t('quoteDialog.notes')}</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder={t('quoteDialog.notesPlaceholder')}
                                                    {...field}
                                                    value={field.value || ''}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Card>
                                    <CardHeader>
                                        <div className="flex justify-between items-center">
                                            <CardTitle>{t('quoteDialog.items.title')}</CardTitle>
                                            <Button type="button" size="sm" variant="outline" onClick={handleAddQuoteItem}>{t('quoteDialog.addItem')}</Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="bg-card">
                                        <div className="space-y-4">
                                            <table className="hidden md:table w-full text-sm">
                                                <thead>
                                                    <tr className="text-muted-foreground text-center">
                                                        <th className="text-left font-semibold p-2">{t('quoteDialog.items.service')}</th>
                                                        <th className="font-semibold p-2 w-24">{t('quoteDialog.items.quantity')}</th>
                                                        <th className="font-semibold p-2 w-28">{t('quoteDialog.items.unitPrice')}</th>
                                                        <th className="font-semibold p-2 w-28">{t('quoteDialog.items.total')}</th>
                                                        <th className="font-semibold p-2 w-24">{t('quoteDialog.items.toothNumber')}</th>
                                                        <th className="p-2 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {quoteFormFields.map((fieldItem, index) => (
                                                        <tr key={fieldItem.id} className="align-top">
                                                            <td className="p-1">
                                                                <div className="max-w-[600px] overflow-hidden">
                                                                    <FormField control={quoteForm.control} name={`items.${index}.service_id`} render={({ field }) => (
                                                                        <FormItem>
                                                                            <ServiceSelector
                                                                                isSales={true}
                                                                            value={field.value}
                                                                            onValueChange={(serviceId, service) => {
                                                                                field.onChange(serviceId);
                                                                                if (service) {
                                                                                    const quantity = quoteForm.getValues(`items.${index}.quantity`) || 1;
                                                                                    const servicePrice = Number(service.price);
                                                                                    quoteForm.setValue(`items.${index}.unit_price`, servicePrice, { shouldDirty: true, shouldValidate: true });
                                                                                    quoteForm.setValue(`items.${index}.total`, servicePrice * quantity, { shouldDirty: true, shouldValidate: true });
                                                                                }
                                                                            }}
                                                                            placeholder={t('itemDialog.searchService')}
                                                                            noResultsText={t('itemDialog.noServiceFound')}
                                                                            triggerText={t('quoteDialog.items.selectService')}
                                                                        />
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )} />
                                                                </div>
                                                            </td>
                                                            <td className="p-1">
                                                                <FormField control={quoteForm.control} name={`items.${index}.quantity`} render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input type="number" step="1" min="1" {...field} onChange={(e) => {
                                                                                const rounded = e.target.value === '' ? '' : Math.round(Number(e.target.value));
                                                                                field.onChange(e);
                                                                                const price = quoteForm.getValues(`items.${index}.unit_price`) || 0;
                                                                                const newQty = rounded === '' ? 0 : rounded;
                                                                                quoteForm.setValue(`items.${index}.quantity`, newQty, { shouldValidate: true });
                                                                                quoteForm.setValue(`items.${index}.total`, price * newQty, { shouldDirty: true });
                                                                            }} />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )} />
                                                            </td>
                                                            <td className="p-1">
                                                                <FormField control={quoteForm.control} name={`items.${index}.unit_price`} render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input type="number" step="0.01" min="0" {...field} onChange={(e) => {
                                                                                field.onChange(e);
                                                                                const quantity = quoteForm.getValues(`items.${index}.quantity`) || 1;
                                                                                const newPrice = Number(e.target.value);
                                                                                quoteForm.setValue(`items.${index}.total`, Math.round((newPrice * quantity) * 100) / 100, { shouldDirty: true });
                                                                            }} />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )} />
                                                            </td>
                                                            <td className="p-1">
                                                                <FormField control={quoteForm.control} name={`items.${index}.total`} render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input type="number" {...field} readOnly disabled />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )} />
                                                            </td>
                                                            <td className="p-1">
                                                                <FormField control={quoteForm.control} name={`items.${index}.tooth_number`} render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input type="number" placeholder="-" {...field} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')} />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )} />
                                                            </td>
                                                            <td className="p-1 text-center">
                                                                <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveQuoteItem(index)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <FormMessage>{quoteForm.formState.errors.items?.root?.message}</FormMessage>
                                            <div className="text-right pt-2">
                                                <span className="font-semibold text-lg">{t('quoteDialog.total')}: {new Intl.NumberFormat('en-US', { style: 'currency', currency: quoteForm.watch('currency') || 'USD' }).format(quoteFormFields.reduce((sum, _, i) => sum + (Number(quoteForm.getValues(`items.${i}.total`)) || 0), 0))}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </DialogBody>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsQuoteDialogOpen(false)} disabled={isSubmittingQuote}>{t('quoteDialog.cancel')}</Button>
                                <Button type="submit" disabled={isSubmittingQuote}>
                                    {isSubmittingQuote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isSubmittingQuote ? t('quoteDialog.saving') : (editingQuote ? t('quoteDialog.editSave') : t('quoteDialog.save'))}
                                </Button>
                            </DialogFooter>
                        </form >
                    </Form >
                </DialogContent >
            </Dialog >
            <AlertDialog open={isDeleteQuoteDialogOpen} onOpenChange={setIsDeleteQuoteDialogOpen}>
                <AlertDialogContent className="max-w-md">
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
                <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
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
                                            <ServiceSelector
                                                isSales={true}
                                                value={field.value}
                                                onValueChange={(serviceId, service) => {
                                                    field.onChange(serviceId);
                                                    if (service) {
                                                        const quantity = quoteItemForm.getValues('quantity') || 1;
                                                        const servicePrice = Number(service.price);
                                                        quoteItemForm.setValue('unit_price', servicePrice);
                                                        quoteItemForm.setValue('total', servicePrice * quantity);
                                                    }
                                                }}
                                                placeholder={t('itemDialog.searchService')}
                                                noResultsText={t('itemDialog.noServiceFound')}
                                                triggerText={t('itemDialog.selectService')}
                                                disabled={!selectedQuote}
                                            />
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
                                                value={originalServicePrice !== null && !isNaN(Number(originalServicePrice)) ? Number(originalServicePrice).toFixed(2) : ''}
                                                readOnly
                                                disabled
                                            />
                                        </FormItem>

                                    </div>
                                )}
                                <FormField control={quoteItemForm.control} name="quantity" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('itemDialog.quantity')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="1"
                                                min="1"
                                                placeholder={t('placeholders.quantity')}
                                                {...field}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    field.onChange(value === '' ? '' : Math.round(Number(value)));
                                                }}
                                                onBlur={async (e) => {
                                                    field.onBlur();
                                                    const value = e.target.value;
                                                    if (value !== '') {
                                                        const quantity = Math.round(Number(value));
                                                        const unitPrice = quoteItemForm.getValues('unit_price') || 0;
                                                        const nameTotal = Math.round((unitPrice * quantity) * 100) / 100;
                                                        quoteItemForm.setValue('total', nameTotal);
                                                        quoteItemForm.setValue('quantity', quantity);
                                                    }
                                                    await quoteItemForm.trigger('quantity');
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={quoteItemForm.control} name="unit_price" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('itemDialog.unitPrice')} ({selectedQuote?.currency})</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder={t('placeholders.unitPrice')}
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
                                                        const rounded = Math.round(numValue * 100) / 100;
                                                        field.onChange(rounded);
                                                        // Recalculate total
                                                        const quantity = quoteItemForm.getValues('quantity') || 0;
                                                        const newTotal = Math.round((rounded * quantity) * 100) / 100;
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
                                        <FormControl><Input type="number" placeholder={t('placeholders.total')} readOnly disabled value={typeof field.value === 'number' && !isNaN(field.value) ? field.value.toFixed(2) : ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmittingQuoteItem}>
                                    {isSubmittingQuoteItem && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isSubmittingQuoteItem ? t('itemDialog.saving') : (editingQuoteItem ? t('itemDialog.editSave') : t('itemDialog.save'))}
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setIsQuoteItemDialogOpen(false)} disabled={isSubmittingQuoteItem}>{t('itemDialog.cancel')}</Button>
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
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={confirmDeleteQuoteItem} className="bg-destructive hover:bg-destructive/90">{t('deleteItemDialog.confirm')}</AlertDialogAction>
                        <AlertDialogCancel>{t('deleteItemDialog.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={isConfirmQuoteDialogOpen} onOpenChange={setIsConfirmQuoteDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{confirmingAction === 'confirm' ? t('confirmDialog.title') : t('confirmDialog.titleReject')}</DialogTitle>
                        <DialogDescription>{t('confirmDialog.description', { id: confirmingQuote?.doc_no || confirmingQuote?.id, action: confirmingAction === 'confirm' ? t('confirmDialog.confirm') : t('confirmDialog.reject') })}</DialogDescription>
                    </DialogHeader>
                    <div className="px-6 py-4">
                        <label htmlFor="confirm-notes" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('confirmDialog.notesLabel')}</label>
                        <Textarea
                            id="confirm-notes"
                            value={confirmNotes}
                            onChange={(e) => setConfirmNotes(e.target.value)}
                            placeholder={t('confirmDialog.notesPlaceholder')}
                            className="mt-2 min-h-[100px]"
                        />
                    </div>
                    <DialogFooter className="px-6 pb-4">
                        <Button variant="outline" onClick={() => setIsConfirmQuoteDialogOpen(false)}>{t('confirmDialog.cancel')}</Button>
                        <Button onClick={handleConfirmQuoteAction}>{confirmingAction === 'confirm' ? t('confirmDialog.confirm') : t('confirmDialog.reject')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
