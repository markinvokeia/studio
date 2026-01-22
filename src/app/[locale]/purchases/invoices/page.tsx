
'use client';

import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { InvoicesTable } from '@/components/tables/invoices-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Invoice, InvoiceItem, Payment, Service } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { RowSelectionState } from '@tanstack/react-table';
import { CheckCircle, File, FileUp, Loader2, PlusCircle, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const invoiceItemSchema = z.object({
    id: z.string().optional(),
    service_id: z.string().min(1, 'Service name is required'),
    quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
    unit_price: z.coerce.number().min(0, 'Unit price cannot be negative'),
});
type InvoiceItemFormValues = z.infer<typeof invoiceItemSchema>;

async function getServices(): Promise<Service[]> {
    try {
        const data = await api.get(API_ROUTES.SERVICES, { is_sales: 'false' });
        const servicesData = Array.isArray(data) ? data : (data.services || data.data || data.result || []);
        return servicesData.map((s: any) => {
            const id = s.id || s.product_id;
            return {
                ...s,
                id: String(Array.isArray(id) ? id[0] : id),
                name: s.name || s.display_name || (Array.isArray(id) ? id[1] : 'N/A')
            };
        });
    } catch (error) {
        console.error("Failed to fetch services:", error);
        return [];
    }
}

async function getInvoices(type: string = 'all'): Promise<Invoice[]> {
    try {
        const query: Record<string, string> = { is_sales: 'false' };
        if (type !== 'all') {
            query.type = type;
        }
        const data = await api.get(API_ROUTES.PURCHASES.INVOICES_ALL, query);
        const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);
        return invoicesData.map((apiInvoice: any) => ({
            id: apiInvoice.id ? String(apiInvoice.id) : 'N/A',
            doc_no: apiInvoice.doc_no || 'N/A',
            invoice_ref: apiInvoice.invoice_ref || 'N/A',
            order_id: apiInvoice.order_id,
            order_doc_no: apiInvoice.order_doc_no || 'N/A',
            quote_id: apiInvoice.quote_id,
            quote_doc_no: apiInvoice.quote_doc_no || 'N/A',
            user_name: apiInvoice.user_name || 'N/A',
            userEmail: apiInvoice.user_email || '',
            user_id: apiInvoice.user_id,
            total: apiInvoice.total || 0,
            status: apiInvoice.status || 'draft',
            payment_status: apiInvoice.payment_state || 'unpaid',
            paid_amount: apiInvoice.paid_amount || 0,
            createdAt: apiInvoice.created_at || new Date().toISOString().split('T')[0],
            updatedAt: apiInvoice.updatedAt || new Date().toISOString().split('T')[0],
            currency: apiInvoice.currency || 'USD',
        }));
    } catch (error) {
        console.error("Failed to fetch invoices:", error);
        return [];
    }
}

async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    if (!invoiceId) return [];
    try {
        const data = await api.get(API_ROUTES.PURCHASES.INVOICE_ITEMS, { invoice_id: invoiceId, is_sales: 'false' });
        const itemsData = Array.isArray(data) ? data : (data.invoice_items || data.data || data.result || []);
        return itemsData.map((apiItem: any) => {
            const rawServiceId = apiItem.service_id || apiItem.product_id;
            const serviceId = Array.isArray(rawServiceId) ? String(rawServiceId[0]) : String(rawServiceId || '');

            return {
                id: apiItem.id ? String(apiItem.id) : `ii_${Math.random().toString(36).substr(2, 9)}`,
                service_id: serviceId,
                service_name: apiItem.service_name || apiItem.product_name || apiItem.name || apiItem.display_name || (Array.isArray(rawServiceId) ? rawServiceId[1] : 'N/A'),
                quantity: apiItem.quantity || apiItem.product_uom_qty || 1,
                unit_price: apiItem.unit_price || apiItem.price_unit || 0,
                total: apiItem.total || apiItem.price_total || 0,
            };
        });
    } catch (error) {
        console.error("Failed to fetch invoice items:", error);
        return [];
    }
}

async function getPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
    if (!invoiceId) return [];
    try {
        const data = await api.get(API_ROUTES.PURCHASES.INVOICE_PAYMENTS, { invoice_id: invoiceId, is_sales: 'false' });
        const paymentsData = Array.isArray(data) ? data : (data.payments || data.data || []);
        return paymentsData.map((apiPayment: any) => ({
            id: apiPayment.transaction_id ? String(apiPayment.transaction_id) : 'N/A',
            doc_no: apiPayment.doc_no || 'N/A',
            order_id: apiPayment.order_id,
            order_doc_no: apiPayment.order_doc_no || 'N/A',
            invoice_id: apiPayment.invoice_id,
            invoice_doc_no: apiPayment.invoice_doc_no || 'N/A',
            quote_id: apiPayment.quote_id,
            quote_doc_no: apiPayment.quote_doc_no || 'N/A',
            user_name: apiPayment.user_name || 'N/A',
            amount: apiPayment.amount_applied || 0,
            method: apiPayment.payment_method || 'credit_card',
            status: apiPayment.status || 'pending',
            createdAt: apiPayment.created_at || new Date().toISOString().split('T')[0],
            updatedAt: apiPayment.updatedAt || new Date().toISOString().split('T')[0],
            currency: apiPayment.source_currency || 'USD',
            payment_date: apiPayment.payment_date,
            amount_applied: apiPayment.amount_applied,
            source_amount: apiPayment.source_amount,
            source_currency: apiPayment.source_currency,
            exchange_rate: apiPayment.exchange_rate ? parseFloat(String(apiPayment.exchange_rate)) : 1,
            payment_method: apiPayment.payment_method,
            transaction_type: apiPayment.transaction_type,
            transaction_id: apiPayment.transaction_id,
            reference_doc_id: apiPayment.reference_doc_id
        }));
    } catch (error) {
        console.error("Failed to fetch payments for invoice:", error);
        return [];
    }
}

export default function InvoicesPage() {
    const t = useTranslations('InvoicesPage');
    const { toast } = useToast();
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
    const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = React.useState<Invoice | null>(null);
    const [emailRecipients, setEmailRecipients] = React.useState('');
    const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
    const [importFile, setImportFile] = React.useState<File | null>(null);
    const [isProcessingImport, setIsProcessingImport] = React.useState(false);

    const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([]);
    const [payments, setPayments] = React.useState<Payment[]>([]);

    const [isLoadingInvoices, setIsLoadingInvoices] = React.useState(false);
    const [isLoadingInvoiceItems, setIsLoadingInvoiceItems] = React.useState(false);
    const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);

    const [editingItem, setEditingItem] = React.useState<InvoiceItem | null>(null);
    const [isItemDialogOpen, setIsItemDialogOpen] = React.useState(false);
    const [deletingItem, setDeletingItem] = React.useState<InvoiceItem | null>(null);
    const [isDeleteItemDialogOpen, setIsDeleteItemDialogOpen] = React.useState(false);
    const [services, setServices] = React.useState<Service[]>([]);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false);
    const [confirmingInvoice, setConfirmingInvoice] = React.useState<Invoice | null>(null);
    const [invoiceType, setInvoiceType] = React.useState('all');

    const itemForm = useForm<InvoiceItemFormValues>({
        resolver: zodResolver(invoiceItemSchema),
    });

    const watchedServiceId = itemForm.watch('service_id');
    const watchedQuantity = itemForm.watch('quantity');

    React.useEffect(() => {
        if (watchedServiceId) {
            const service = services.find(s => s.id === watchedServiceId);
            if (service) {
                const quantity = Number(itemForm.getValues('quantity')) || 1;
                itemForm.setValue('unit_price', service.price);
            }
        }
    }, [watchedServiceId, itemForm, services]);

    const loadInvoices = React.useCallback(async () => {
        setIsLoadingInvoices(true);
        const fetchedInvoices = await getInvoices(invoiceType);
        setInvoices(fetchedInvoices);
        setIsLoadingInvoices(false);
    }, [invoiceType]);

    React.useEffect(() => {
        loadInvoices();
        getServices().then(setServices);
    }, [loadInvoices]);

    const loadInvoiceItems = React.useCallback(async () => {
        if (!selectedInvoice) return;
        setIsLoadingInvoiceItems(true);
        setInvoiceItems(await getInvoiceItems(selectedInvoice.id));
        setIsLoadingInvoiceItems(false);
    }, [selectedInvoice]);

    const loadPayments = React.useCallback(async () => {
        if (!selectedInvoice) return;
        setIsLoadingPayments(true);
        setPayments(await getPaymentsForInvoice(selectedInvoice.id));
        setIsLoadingPayments(false);
    }, [selectedInvoice]);

    React.useEffect(() => {
        if (selectedInvoice) {
            loadInvoiceItems();
            loadPayments();
        } else {
            setInvoiceItems([]);
            setPayments([]);
        }
    }, [selectedInvoice, loadInvoiceItems, loadPayments]);

    const handleRowSelectionChange = (selectedRows: Invoice[]) => {
        const invoice = selectedRows.length > 0 ? selectedRows[0] : null;
        setSelectedInvoice(invoice);
    };

    const handleCloseDetails = () => {
        setSelectedInvoice(null);
        setRowSelection({});
    };

    const handlePrintInvoice = async (invoice: Invoice) => {
        toast({
            title: "Generating PDF",
            description: `Preparing PDF for Invoice #${invoice.id}...`,
        });

        try {
            const blob = await api.getBlob(API_ROUTES.PURCHASES.API_INVOICE_PRINT, { id: invoice.id });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Invoice-${invoice.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            toast({
                title: "Download Started",
                description: `Your PDF for Invoice #${invoice.id} is downloading.`,
            });

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Print Error',
                description: error instanceof Error ? error.message : 'Could not print the invoice.',
            });
        }
    };

    const handleSendEmailClick = (invoice: Invoice) => {
        setSelectedInvoiceForEmail(invoice);
        setEmailRecipients(invoice.userEmail || '');
        setIsSendEmailDialogOpen(true);
    };

    const handleConfirmSendEmail = async () => {
        if (!selectedInvoiceForEmail) return;

        const emails = emailRecipients.split(',').map(email => email.trim()).filter(email => email);
        if (emails.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter at least one recipient email.' });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = emails.filter(email => !emailRegex.test(email));

        if (invalidEmails.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Invalid Email Address',
                description: `The following emails are invalid: ${invalidEmails.join(', ')}`,
            });
            return;
        }

        try {
            await api.post(API_ROUTES.PURCHASES.API_INVOICE_SEND, { invoiceId: selectedInvoiceForEmail.id, emails });

            toast({
                title: 'Email Sent',
                description: `The invoice has been successfully sent to ${emails.join(', ')}.`,
            });

            setIsSendEmailDialogOpen(false);

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
            });
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImportFile(file);
        }
    };

    const handleImportSubmit = async () => {
        if (!importFile) {
            toast({ variant: 'destructive', title: 'No file selected', description: 'Please select a file to import.' });
            return;
        }
        setIsProcessingImport(true);

        const formData = new FormData();
        formData.append('file', importFile);
        formData.append('is_sales', 'false');

        try {
            await api.post(API_ROUTES.PURCHASES.API_INVOICE_IMPORT, formData);

            toast({ title: 'Import Successful', description: 'The invoice has been created from the imported file.' });
            loadInvoices();
            setIsImportDialogOpen(false);

        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Import Failed',
                description: error instanceof Error ? error.message : 'Could not import the invoice.',
            });
        } finally {
            setIsProcessingImport(false);
            setImportFile(null);
        }
    };

    const handleCreateItem = () => {
        setEditingItem(null);
        itemForm.reset({
            id: undefined,
            service_id: '',
            quantity: 1,
            unit_price: 0
        });
        setIsItemDialogOpen(true);
    };

    const handleEditItem = (item: InvoiceItem) => {
        setEditingItem(item);
        setIsItemDialogOpen(true);
    };

    const handleDeleteItem = (item: InvoiceItem) => {
        setDeletingItem(item);
        setIsDeleteItemDialogOpen(true);
    };

    const onItemSubmit = async (data: InvoiceItemFormValues) => {
        if (!selectedInvoice) return;
        try {
            const payload = {
                ...data,
                id: editingItem?.id ? parseInt(editingItem.id, 10) : undefined,
                invoice_id: parseInt(selectedInvoice.id, 10),
                service_id: parseInt(data.service_id, 10),
                order_item_id: selectedInvoice.order_id,
                quantity: Number(data.quantity),
                unit_price: Number(data.unit_price),
            };


            await api.post(API_ROUTES.PURCHASES.INVOICES_ITEMS_UPSERT, payload);
            toast({ title: 'Success', description: `Invoice item ${editingItem ? 'updated' : 'created'} successfully.` });
            loadInvoiceItems();
            setIsItemDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : `Failed to ${editingItem ? 'update' : 'create'} invoice item.` });
        }
    };

    const confirmDeleteItem = async () => {
        if (!deletingItem) return;
        try {
            const responseData = await api.post(API_ROUTES.PURCHASES.INVOICES_ITEMS_DELETE, { id: parseInt(deletingItem.id, 10) });
            toast({ title: 'Success', description: responseData.message || 'Invoice item deleted successfully.' });
            loadInvoiceItems();
            setIsDeleteItemDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete invoice item.' });
        }
    };

    const handleConfirmInvoiceClick = (invoice: Invoice) => {
        setConfirmingInvoice(invoice);
        setIsConfirmDialogOpen(true);
    };

    const handleConfirmInvoice = async () => {
        if (!confirmingInvoice) return;
        try {
            await api.post(API_ROUTES.PURCHASES.INVOICES_CONFIRM, { id: parseInt(confirmingInvoice.id, 10) });
            toast({
                title: 'Invoice Confirmed',
                description: `Invoice #${confirmingInvoice.id} has been confirmed.`,
            });
            setIsConfirmDialogOpen(false);
            setConfirmingInvoice(null);
            loadInvoices(); // Refresh the invoice list
            handleCloseDetails(); // Close the side panel
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.',
            });
        }
    };


    const columnTranslations = {
        doc_no: t('columns.docNo'),
        user_name: t('columns.provider'),
        order_doc_no: t('columns.orderDocNo'),
        quote_doc_no: t('columns.quoteDocNo'),
        total: t('columns.total'),
        status: t('columns.status'),
        payment_status: t('columns.payment'),
        paid_amount: t('columns.paidAmount'),
        createdAt: t('columns.createdAt'),
    };

    const canEditItems = selectedInvoice?.status.toLowerCase() === 'draft';


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
                            <InvoicesTable
                                invoices={invoices}
                                isLoading={isLoadingInvoices}
                                onRowSelectionChange={handleRowSelectionChange}
                                onRefresh={loadInvoices}
                                onPrint={handlePrintInvoice}
                                onSendEmail={handleSendEmailClick}
                                onImport={() => {
                                    setImportFile(null);
                                    setIsProcessingImport(false);
                                    setIsImportDialogOpen(true);
                                }}
                                onConfirm={handleConfirmInvoiceClick}
                                isRefreshing={isLoadingInvoices}
                                rowSelection={rowSelection}
                                setRowSelection={setRowSelection}
                                columnTranslations={columnTranslations}
                                filterValue={invoiceType}
                                onFilterChange={setInvoiceType}
                                filterOptions={[
                                    { label: "Invoice", value: "invoice" },
                                    { label: "Credit Note", value: "credit_note" },
                                ]}
                                isSales={false}
                            />
                        </div>

                        <div
                            className={cn(
                                "absolute top-0 right-0 h-full w-[75%] bg-background/95 backdrop-blur-sm border-l z-20 transition-transform duration-300 ease-in-out",
                                selectedInvoice ? 'translate-x-0' : 'translate-x-full'
                            )}
                        >
                            {selectedInvoice && (
                                <Card className="h-full shadow-lg rounded-none">
                                    <CardHeader className="flex flex-row items-start justify-between">
                                        <div>
                                            <CardTitle>{t('detailsFor')}</CardTitle>
                                            <CardDescription>{t('invoiceId')}: {selectedInvoice.id}</CardDescription>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {selectedInvoice.status.toLowerCase() === 'draft' && (
                                                <Button variant="outline" size="sm" onClick={() => handleConfirmInvoiceClick(selectedInvoice)}>
                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                    {t('confirmInvoice')}
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                                <X className="h-5 w-5" />
                                                <span className="sr-only">{t('close')}</span>
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <Tabs defaultValue="items" className="w-full">
                                            <TabsList className="h-auto items-center justify-start flex-wrap">
                                                <TabsTrigger value="items">{t('tabs.items')}</TabsTrigger>
                                                <TabsTrigger value="payments">{t('tabs.payments')}</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="items">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-md font-semibold">{t('InvoiceItemsTable.title', { id: selectedInvoice.id })}</h4>
                                                    <div className="flex items-center gap-2">
                                                        {canEditItems && (
                                                            <Button variant="outline" size="icon" onClick={handleCreateItem}>
                                                                <PlusCircle className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button variant="outline" size="icon" onClick={loadInvoiceItems} disabled={isLoadingInvoiceItems}>
                                                            <RefreshCw className={`h-4 w-4 ${isLoadingInvoiceItems ? 'animate-spin' : ''}`} />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <InvoiceItemsTable items={invoiceItems} isLoading={isLoadingInvoiceItems} canEdit={canEditItems} onEdit={handleEditItem} onDelete={handleDeleteItem} />
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

                        <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Send Invoice by Email</DialogTitle>
                                    <DialogDescription>Enter the recipient emails for invoice #{selectedInvoiceForEmail?.id}.</DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="email-recipients">Recipients</Label>
                                    <Input
                                        id="email-recipients"
                                        value={emailRecipients}
                                        onChange={(e) => setEmailRecipients(e.target.value)}
                                        placeholder="email1@example.com, email2@example.com"
                                    />
                                    <p className="text-sm text-muted-foreground mt-1">Separate multiple emails with commas.</p>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)}>Cancel</Button>
                                    <Button onClick={handleConfirmSendEmail}>Send Email</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Import Invoice</DialogTitle>
                                    <DialogDescription>
                                        Upload a PDF or image file to automatically create an invoice.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4 space-y-4">
                                    <div className="flex items-center justify-center w-full">
                                        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/50">
                                            {importFile ? (
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <File className="w-8 h-8 mb-4 text-primary" />
                                                    <p className="font-semibold text-foreground">{importFile.name}</p>
                                                    <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(2)} KB</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <FileUp className="w-8 h-8 mb-4 text-muted-foreground" />
                                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG or GIF (MAX. 10MB)</p>
                                                </div>
                                            )}
                                            <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} />
                                        </label>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={isProcessingImport}>Cancel</Button>
                                    <Button onClick={handleImportSubmit} disabled={!importFile || isProcessingImport}>
                                        {isProcessingImport ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            'Create Invoice'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <ItemFormDialog
                            isOpen={isItemDialogOpen}
                            onOpenChange={setIsItemDialogOpen}
                            editingItem={editingItem}
                            onSubmit={onItemSubmit}
                            itemForm={itemForm}
                            services={services}
                            t={t}
                        />

                        <AlertDialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('deleteItemDialog.title')}</AlertDialogTitle>
                                    <AlertDialogDescription>{t('deleteItemDialog.description')}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('deleteItemDialog.cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={confirmDeleteItem} className="bg-destructive hover:bg-destructive/90">{t('deleteItemDialog.confirm')}</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('confirmInvoiceDialog.title')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('confirmInvoiceDialog.description', { id: confirmingInvoice?.id })}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('confirmInvoiceDialog.cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleConfirmInvoice}>{t('confirmInvoiceDialog.confirm')}</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

const ItemFormDialog = ({
    isOpen,
    onOpenChange,
    editingItem,
    onSubmit,
    itemForm,
    services,
    t
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editingItem: InvoiceItem | null;
    onSubmit: (data: InvoiceItemFormValues) => void;
    itemForm: any;
    services: Service[];
    t: any;
}) => {
    const title = editingItem ? t('InvoiceItemsTable.editTitle') : t('InvoiceItemsTable.createTitle');
    const isLoading = services.length === 0;

    React.useEffect(() => {
        if (isOpen) {
            if (editingItem) {
                itemForm.reset({
                    id: String(editingItem.id),
                    service_id: String(editingItem.service_id),
                    quantity: editingItem.quantity,
                    unit_price: editingItem.unit_price,
                });
            } else {
                itemForm.reset({
                    id: undefined,
                    service_id: '',
                    quantity: 1,
                    unit_price: 0
                });
            }
        }
    }, [isOpen, editingItem, itemForm]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <Form {...itemForm}>
                        <form onSubmit={itemForm.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={itemForm.control}
                                name="service_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('InvoiceItemsTable.form.service')}</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value || ""}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('InvoiceItemsTable.form.selectService')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {services.map((service) => (
                                                    <SelectItem key={service.id} value={String(service.id)}>
                                                        {service.name}
                                                    </SelectItem>
                                                ))}
                                                {field.value && !services.find(s => String(s.id) === String(field.value)) && (
                                                    <SelectItem value={String(field.value)}>
                                                        [ID: {field.value}] - {t('InvoiceItemsTable.form.notInList') || 'No en la lista'}
                                                    </SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={itemForm.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('InvoiceItemsTable.form.quantity')}</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={itemForm.control}
                                name="unit_price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('InvoiceItemsTable.form.unitPrice')}</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                    {t('createDialog.cancel')}
                                </Button>
                                <Button type="submit">{t('createDialog.save')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
};
