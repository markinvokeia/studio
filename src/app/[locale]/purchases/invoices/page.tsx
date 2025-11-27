
'use client';

import * as React from 'react';
import { Invoice, InvoiceItem, Payment, Service } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { InvoicesTable, CreateInvoiceDialog } from '@/components/tables/invoices-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { RefreshCw, X, FileUp, File, Loader2, PlusCircle, CheckCircle } from 'lucide-react';
import { RowSelectionState } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const invoiceItemSchema = z.object({
  id: z.string().optional(),
  service_id: z.string().min(1, 'Service name is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unit_price: z.coerce.number().min(0, 'Unit price cannot be negative'),
});
type InvoiceItemFormValues = z.infer<typeof invoiceItemSchema>;

async function getServices(): Promise<Service[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services?is_sales=false', {
      method: 'GET',
      mode: 'cors',
      headers: { 'Accept': 'application/json' },
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

async function getInvoices(type: string = 'all'): Promise<Invoice[]> {
    try {
        const params = new URLSearchParams({
            is_sales: 'false',
            type: type,
        });
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/all_invoices?${params.toString()}`, {
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
            userEmail: apiInvoice.user_email || '',
            total: apiInvoice.total || 0,
            status: apiInvoice.status || 'draft',
            payment_status: apiInvoice.payment_status || 'unpaid',
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

async function getPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
    if (!invoiceId) return [];
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/invoice_payments?invoice_id=${invoiceId}&is_sales=false`, {
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
            currency: apiPayment.currency || 'USD',
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
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [importFile, setImportFile] = React.useState<File | null>(null);
    const [isProcessingImport, setIsProcessingImport] = React.useState(false);

    const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([]);
    const [payments, setPayments] = React.useState<Payment[]>([]);

    const [isLoadingInvoices, setIsLoadingInvoices] = React.useState(false);
    const [isLoadingInvoiceItems, setIsLoadingInvoiceItems] = React.useState(false);
    const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);
    
    const [editingItem, setEditingItem] = React.useState<InvoiceItem | null>(null);
    const [isCreateItemDialogOpen, setIsCreateItemDialogOpen] = React.useState(false);
    const [isEditItemDialogOpen, setIsEditItemDialogOpen] = React.useState(false);
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
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/invoice/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId: invoice.id }),
            });

            if (response.status >= 400) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to generate PDF.' }));
                throw new Error(errorData.message);
            }

            if (!response.ok) {
                throw new Error('An unexpected error occurred while generating the PDF.');
            }

            const blob = await response.blob();
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
            const token = localStorage.getItem('token');
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/invoice/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ invoiceId: selectedInvoiceForEmail.id, emails }),
            });

            if (!response.ok) {
                throw new Error('Failed to send email.');
            }

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
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/invoice/import', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ message: 'Failed to import invoice.' }));
                throw new Error(errorData.message || 'An error occurred during import.');
            }

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

    const handleCreateItem = async () => {
        setEditingItem(null);
        itemForm.reset({ service_id: '', quantity: 1, unit_price: 0 });
        const fetchedServices = await getServices();
        setServices(fetchedServices);
        setIsCreateItemDialogOpen(true);
    };

    const handleEditItem = async (item: InvoiceItem) => {
      setEditingItem(item);
      itemForm.reset({
        id: item.id,
        service_id: item.service_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      });
      const fetchedServices = await getServices();
      setServices(fetchedServices);
      setIsEditItemDialogOpen(true);
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
        

        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/invoices/items/upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (response.status !== 200) {
            const responseData = await response.json();
            throw new Error(responseData.message || `Failed to ${editingItem ? 'update' : 'create'} invoice item.`);
        }
        toast({ title: 'Success', description: `Invoice item ${editingItem ? 'updated' : 'created'} successfully.`});
        loadInvoiceItems();
        setIsEditItemDialogOpen(false);
        setIsCreateItemDialogOpen(false);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : `Failed to ${editingItem ? 'update' : 'create'} invoice item.`});
      }
    };
    
    const confirmDeleteItem = async () => {
      if (!deletingItem) return;
      try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/invoices/items/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(deletingItem.id, 10) }),
        });
        if (response.status >= 400) {
            const responseData = await response.json();
            throw new Error(responseData.message || 'Failed to delete invoice item.');
        }
        const responseData = await response.json();
        toast({ title: 'Success', description: responseData.message || 'Invoice item deleted successfully.'});
        loadInvoiceItems();
        setIsDeleteItemDialogOpen(false);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete invoice item.'});
      }
    };
    
    const handleConfirmInvoiceClick = (invoice: Invoice) => {
        setConfirmingInvoice(invoice);
        setIsConfirmDialogOpen(true);
    };

    const handleConfirmInvoice = async () => {
        if (!confirmingInvoice) return;
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/invoices/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(confirmingInvoice.id, 10) }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to confirm the invoice.');
            }
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
        id: t('columns.invoiceId'),
        user_name: t('columns.provider'),
        order_id: t('columns.orderId'),
        quote_id: t('columns.quoteId'),
        total: t('columns.total'),
        status: t('columns.status'),
        payment_status: t('columns.payment'),
        createdAt: t('columns.createdAt'),
    };
    
    const canEditItems = selectedInvoice?.status.toLowerCase() === 'draft';

     const ItemFormDialog = ({
        isOpen,
        onOpenChange,
        title,
        onSubmit,
    }: {
        isOpen: boolean;
        onOpenChange: (open: boolean) => void;
        title: string;
        onSubmit: (data: InvoiceItemFormValues) => void;
    }) => (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <Form {...itemForm}>
                    <form onSubmit={itemForm.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={itemForm.control}
                            name="service_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Service</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a service" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {services.map((service) => (
                                                <SelectItem key={service.id} value={service.id}>
                                                    {service.name}
                                                </SelectItem>
                                            ))}
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
                                    <FormLabel>Quantity</FormLabel>
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
                                    <FormLabel>Unit Price</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );

    return (
        <div className="relative">
            <div className={cn("transition-all duration-300 w-full")}>
                 <Card>
                    <CardHeader>
                        <CardTitle>{t('title')}</CardTitle>
                        <CardDescription>{t('description')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <InvoicesTable 
                            invoices={invoices}
                            isLoading={isLoadingInvoices}
                            onRowSelectionChange={handleRowSelectionChange}
                            onRefresh={loadInvoices}
                            onPrint={handlePrintInvoice}
                            onSendEmail={handleSendEmailClick}
                            onCreate={() => setIsCreateDialogOpen(true)}
                            onImport={() => {
                                setImportFile(null);
                                setIsProcessingImport(false);
                                setIsImportDialogOpen(true);
                            }}
                            isRefreshing={isLoadingInvoices}
                            rowSelection={rowSelection}
                            setRowSelection={setRowSelection}
                            columnTranslations={columnTranslations}
                            extraButtons={
                                <Select value={invoiceType} onValueChange={setInvoiceType}>
                                    <SelectTrigger className="h-8 w-[150px]">
                                        <SelectValue placeholder="Filter by type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="invoice">Invoice</SelectItem>
                                        <SelectItem value="credit_note">Credit Note</SelectItem>
                                    </SelectContent>
                                </Select>
                            }
                        />
                    </CardContent>
                </Card>
            </div>

            <div 
                className={cn(
                    "absolute top-0 right-0 h-full w-[75%] bg-background/95 backdrop-blur-sm border-l transition-transform duration-300 ease-in-out",
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
                                        Confirm Invoice
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                    <X className="h-5 w-5" />
                                    <span className="sr-only">Close details</span>
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
                                        <h4 className="text-md font-semibold">{t('InvoiceItemsTable.title', {id: selectedInvoice.id})}</h4>
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
            <CreateInvoiceDialog
                isOpen={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onInvoiceCreated={loadInvoices}
                isSales={false}
            />

            <ItemFormDialog 
                isOpen={isCreateItemDialogOpen}
                onOpenChange={setIsCreateItemDialogOpen}
                title="Create Invoice Item"
                onSubmit={onItemSubmit}
            />
            
            <ItemFormDialog 
                isOpen={isEditItemDialogOpen}
                onOpenChange={setIsEditItemDialogOpen}
                title="Edit Invoice Item"
                onSubmit={onItemSubmit}
            />

            <AlertDialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete the invoice item. This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteItem} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
             <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Invoice</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to confirm invoice #{confirmingInvoice?.id}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmInvoice}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

    

    


    

    

    