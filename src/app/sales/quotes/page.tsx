'use client';

import * as React from 'react';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';
import { Quote, QuoteItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuoteItemsTable } from '@/components/tables/quote-items-table';

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
      userName: apiQuote.userName || 'No Name',
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


export default function QuotesPage() {
    const [quotes, setQuotes] = React.useState<Quote[]>([]);
    const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
    const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = React.useState(false);


    React.useEffect(() => {
        async function loadQuotes() {
            const fetchedQuotes = await getQuotes();
            setQuotes(fetchedQuotes);
        }
        loadQuotes();
    }, []);

    React.useEffect(() => {
        if (selectedQuote) {
            async function loadQuoteItems() {
                setIsLoadingItems(true);
                const items = await getQuoteItems(selectedQuote!.id);
                setQuoteItems(items);
                setIsLoadingItems(false);
            }
            loadQuoteItems();
        } else {
            setQuoteItems([]);
        }
    }, [selectedQuote]);

    const handleRowSelectionChange = (selectedRows: Quote[]) => {
        const quote = selectedRows.length > 0 ? selectedRows[0] : null;
        if (quote?.id !== selectedQuote?.id) {
            setSelectedQuote(quote);
        } else if (!quote && selectedQuote) {
            setSelectedQuote(null);
        }
    };
    
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className={cn("transition-all duration-300", selectedQuote ? "lg:col-span-2" : "lg:col-span-3")}>
                 <RecentQuotesTable quotes={quotes} onRowSelectionChange={handleRowSelectionChange} />
            </div>

            {selectedQuote && (
                <div className="lg:col-span-1">
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
                                    <Card>
                                        <CardContent className="p-6">
                                            <p>Orders content for Quote ID: {selectedQuote.id}.</p>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                                <TabsContent value="invoices">
                                    <Card>
                                        <CardContent className="p-6">
                                            <p>Invoices content for Quote ID: {selectedQuote.id}.</p>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                                <TabsContent value="payments">
                                    <Card>
                                        <CardContent className="p-6">
                                            <p>Payments content for Quote ID: {selectedQuote.id}.</p>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
