'use client';

import * as React from 'react';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';
import { Quote, QuoteItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuoteItemsTable } from '@/components/tables/quote-items-table';

// Mock data for quote items, as no endpoint is provided.
const quoteItems: QuoteItem[] = [
    { id: 'qi_1', service_id: 'srv_1', unit_price: 150, quantity: 1, total: 150 },
    { id: 'qi_2', service_id: 'srv_2', unit_price: 1200, quantity: 1, total: 1200 },
    { id: 'qi_3', service_id: 'srv_4', unit_price: 500, quantity: 1, total: 500 },
];

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


export default function QuotesPage() {
    const [quotes, setQuotes] = React.useState<Quote[]>([]);
    const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);

    React.useEffect(() => {
        async function loadQuotes() {
            const fetchedQuotes = await getQuotes();
            setQuotes(fetchedQuotes);
        }
        loadQuotes();
    }, []);

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
                                   <QuoteItemsTable items={quoteItems} />
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
