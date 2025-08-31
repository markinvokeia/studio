import { Stats } from '@/components/dashboard/stats';
import { SalesSummaryChart } from '@/components/charts/sales-summary-chart';
import { SalesByServiceChart } from '@/components/charts/sales-by-service-chart';
import { InvoiceStatusChart } from '@/components/charts/invoice-status-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportFilters } from '@/components/dashboard/report-filters';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';

export default function DashboardPage() {
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
        <RecentQuotesTable />
      </div>
    </>
  );
}
