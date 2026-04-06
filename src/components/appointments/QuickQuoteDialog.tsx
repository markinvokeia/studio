'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ServiceSelector } from '@/components/ui/service-selector';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Quote, Service, User } from '@/lib/types';
import { api } from '@/services/api';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface QuoteItem {
  id: string;
  service_id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  tooth_number?: number;
}

interface QuickQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onQuoteCreated: (quote: Quote) => void;
}

export function QuickQuoteDialog({ open, onOpenChange, user, onQuoteCreated }: QuickQuoteDialogProps) {
  const t = useTranslations();
  const { toast } = useToast();

  const [items, setItems] = React.useState<QuoteItem[]>([]);
  const [currency, setCurrency] = React.useState<'USD' | 'UYU'>('USD');
  const [exchangeRate, setExchangeRate] = React.useState<number>(1);
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset form on open
  React.useEffect(() => {
    if (open) {
      setItems([]);
      setCurrency('USD');
      setExchangeRate(1);
      setNotes('');
    }
  }, [open]);

  const handleAddItem = () => {
    const newItem: QuoteItem = {
      id: `temp_${Date.now()}`,
      service_id: '',
      service_name: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof QuoteItem, value: any, service?: Service) => {
    const updatedItems = [...items];
    const item = updatedItems[index];

    if (field === 'service_id') {
      item.service_id = value;
      item.service_name = service?.name || '';
      item.unit_price = service ? Number(service.price) : 0;
      item.total = item.quantity * item.unit_price;
    } else if (field === 'quantity') {
      item.quantity = parseInt(value) || 0;
      item.total = item.quantity * item.unit_price;
    } else if (field === 'unit_price') {
      item.unit_price = parseFloat(value) || 0;
      item.total = item.quantity * item.unit_price;
    } else if (field === 'tooth_number') {
      item.tooth_number = value ? parseInt(value) : undefined;
    }

    setItems(updatedItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: t('QuotesPage.errors.noUser') });
      return;
    }

    if (items.length === 0) {
      toast({ variant: 'destructive', title: t('QuotesPage.errors.noItems') });
      return;
    }

    const invalidItems = items.filter(item => !item.service_id);
    if (invalidItems.length > 0) {
      toast({ variant: 'destructive', title: t('QuotesPage.errors.invalidItems') });
      return;
    }

    setIsSubmitting(true);

    try {
      const total = calculateTotal();
      const payload = {
        user_id: user.id,
        currency,
        exchange_rate: currency === 'UYU' ? 1 : exchangeRate,
        notes: notes || '',
        total,
        status: 'draft',
        payment_status: 'unpaid',
        billing_status: 'not invoiced',
        items: items.map(item => ({
          service_id: item.service_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          tooth_number: item.tooth_number || null,
        })),
        is_sales: true,
      };

      const response = await api.post(API_ROUTES.SALES.QUOTES_UPSERT, payload);
      
      if (Array.isArray(response) && response[0]?.code >= 400) {
        throw new Error(response[0]?.message || 'Error creating quote');
      }

      // Access quote data from response[0].data (new backend format)
      const quoteData = Array.isArray(response) ? response[0].data : response.data;

      const newQuote: Quote = {
        id: String(quoteData.id),
        doc_no: quoteData.doc_no || 'N/A',
        user_id: quoteData.user_id,
        total: parseFloat(quoteData.total) || 0,
        status: quoteData.status || 'draft',
        payment_status: quoteData.payment_status || 'unpaid',
        billing_status: quoteData.billing_status || 'not invoiced',
        currency: quoteData.currency || 'USD',
        exchange_rate: parseFloat(quoteData.exchange_rate) || 1,
        notes: quoteData.notes || '',
        createdAt: quoteData.created_at || new Date().toISOString(),
      };

      toast({ title: t('QuotesPage.success.created') });
      onQuoteCreated(newQuote);
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: error?.message || t('QuotesPage.errors.createFailed') 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="3xl">
        <DialogHeader>
          <DialogTitle>{t('QuotesPage.quickQuote.title')}</DialogTitle>
          <DialogDescription>
            {user ? t('QuotesPage.quickQuote.description', { userName: user.name }) : t('QuotesPage.quickQuote.selectUserFirst')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="px-6 py-4">
          <div className="space-y-6">
            {/* Currency, Exchange Rate and Total */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('QuotesPage.quoteDialog.currency')}</Label>
                <Select value={currency} onValueChange={(val: 'USD' | 'UYU') => {
                  setCurrency(val);
                  if (val === 'UYU') setExchangeRate(1);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="UYU">UYU</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('QuotesPage.quoteDialog.exchangeRate')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.0001"
                  value={currency === 'UYU' ? '1.00' : exchangeRate}
                  disabled={currency === 'UYU'}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                  className={currency === 'UYU' ? 'bg-muted' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('QuotesPage.quoteDialog.total')}</Label>
                <Input
                  value={formatCurrency(calculateTotal())}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed font-semibold"
                />
              </div>
            </div>

            {/* Items */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{t('QuotesPage.quoteDialog.items.title')}</CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddItem}
                    disabled={!user}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('QuotesPage.quoteDialog.addItem')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="bg-card">
                <div className="space-y-4">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-center">
                        <th className="text-left font-semibold p-2">{t('QuotesPage.quoteDialog.items.service')}</th>
                        <th className="font-semibold p-2 w-24">{t('QuotesPage.quoteDialog.items.quantity')}</th>
                        <th className="font-semibold p-2 w-28">{t('QuotesPage.quoteDialog.items.unitPrice')}</th>
                        <th className="font-semibold p-2 w-28">{t('QuotesPage.quoteDialog.items.total')}</th>
                        <th className="font-semibold p-2 w-24">{t('QuotesPage.quoteDialog.items.toothNumber')}</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-muted-foreground">
                            {t('QuotesPage.quickQuote.noItems')}
                          </td>
                        </tr>
                      ) : (
                        items.map((item, index) => (
                          <tr key={item.id} className="align-top">
                            <td className="p-1 max-w-0">
                              <ServiceSelector
                                isSales={true}
                                value={item.service_id}
                                onValueChange={(serviceId, service) => handleUpdateItem(index, 'service_id', serviceId, service)}
                                placeholder={t('QuotesPage.quickQuote.selectService')}
                                noResultsText={t('General.noResults')}
                                triggerText={t('QuotesPage.quickQuote.selectService')}
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unit_price}
                                onChange={(e) => handleUpdateItem(index, 'unit_price', e.target.value)}
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                value={formatCurrency(item.total)}
                                readOnly
                                disabled
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                min="11"
                                max="85"
                                placeholder="—"
                                value={item.tooth_number || ''}
                                onChange={(e) => handleUpdateItem(index, 'tooth_number', e.target.value)}
                              />
                            </td>
                            <td className="p-1 text-center">
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => handleRemoveItem(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t('QuotesPage.quoteDialog.notes')}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('QuotesPage.quickQuote.notesPlaceholder')}
                rows={2}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('General.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || items.length === 0 || !user}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('QuotesPage.quickQuote.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
