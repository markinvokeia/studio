
'use client';

import * as React from 'react';
import { Invoice, InvoiceItem, Payment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { InvoicesTable, CreateInvoiceDialog } from '@/components/tables/invoices-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { RefreshCw, X, FileUp } from 'lucide-react';
import { RowSelectionState } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

async function getInvoices(): Promise<Invoice[]> {
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/all_invoices?is_sales=false`, {
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

    const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([]);
    const [payments, setPayments] = React.useState<Payment[]>([]);

    const [isLoadingInvoices, setIsLoadingInvoices] = React.useState(false);
    const [isLoadingInvoiceItems, setIsLoadingInvoiceItems] = React.useState(false);
    const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);

    const loadInvoices = React.useCallback(async () => {
        setIsLoadingInvoices(true);
        const fetchedInvoices = await getInvoices();
        setInvoices(fetchedInvoices);
        setIsLoadingInvoices(false);
    }, []);

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
                            onImport={() => setIsImportDialogOpen(true)}
                            isRefreshing={isLoadingInvoices}
                            rowSelection={rowSelection}
                            setRowSelection={setRowSelection}
                            columnTranslations={columnTranslations}
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
                            <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                                <X className="h-5 w-5" />
                                <span className="sr-only">Close details</span>
                            </Button>
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
                                        <Button variant="outline" size="icon" onClick={loadInvoiceItems} disabled={isLoadingInvoiceItems}>
                                            <RefreshCw className={`h-4 w-4 ${isLoadingInvoiceItems ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>
                                    <InvoiceItemsTable items={invoiceItems} isLoading={isLoadingInvoiceItems} />
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
                    <div className="py-4">
                        <div className="flex items-center justify-center w-full">
                            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/50">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <FileUp className="w-8 h-8 mb-4 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG or GIF (MAX. 10MB)</p>
                                </div>
                                <Input id="dropzone-file" type="file" className="hidden" />
                            </label>
                        </div> 
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
                        <Button>Create Invoice</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CreateInvoiceDialog
                isOpen={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onInvoiceCreated={loadInvoices}
                isSales={false}
            />
        </div>
    );
}
