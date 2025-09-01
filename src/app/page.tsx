import { Stats } from '@/components/dashboard/stats';
import { SalesSummaryChart } from '@/components/charts/sales-summary-chart';
import { SalesByServiceChart } from '@/components/charts/sales-by-service-chart';
import { InvoiceStatusChart } from '@/components/charts/invoice-status-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportFilters } from '@/components/dashboard/report-filters';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';
import { Quote } from '@/lib/types';

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

export default async function DashboardPage() {
  const quotes = await getQuotes();

  return (
    <>
      <div className="space-y-4">
        <ReportFilters />
        <Stats />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
          <SalesSummaryChart />
          <div className="grid grid-cols-1 gap-4 lg:col-span-3 lg:grid-cols-2">
             <SalesByServiceChart />
             <InvoiceStatusChart />
          </div>
        </div>
        <RecentQuotesTable quotes={quotes} />
      </div>
    </>
  );
}
