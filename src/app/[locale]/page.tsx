
'use client';

import { Stats } from '@/components/dashboard/stats';
import { SalesSummaryChart } from '@/components/charts/sales-summary-chart';
import { SalesByServiceChart } from '@/components/charts/sales-by-service-chart';
import { InvoiceStatusChart } from '@/components/charts/invoice-status-chart';
import { ReportFilters } from '@/components/dashboard/report-filters';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';
import { RecentOrdersTable } from '@/components/tables/recent-orders-table';
import { NewUsersTable } from '@/components/tables/new-users-table';
import { Quote, Order, User, Stat, SalesChartData, SalesByServiceChartData, InvoiceStatusData, AverageBilling, AppointmentAttendanceRate, PatientDemographics } from '@/lib/types';
import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { subMonths, format } from 'date-fns';
import { KpiRow } from '@/components/dashboard/kpi-row';
import { useTranslations } from 'next-intl';

type DashboardSummary = {
    stats: Stat[],
    salesTrend: number,
    averageBilling: AverageBilling | null,
    appointmentAttendance: AppointmentAttendanceRate | null,
}

const INVOICE_CHART_COLORS: { [key: string]: string } = {
  Paid: 'hsl(var(--chart-1))',
  Overdue: 'hsl(var(--destructive))',
  Draft: 'hsl(var(--muted-foreground))',
  Sent: 'hsl(var(--chart-2))',
  Pending: 'hsl(var(--chart-2))',
};

async function getDashboardData(dateRange: DateRange | undefined, t: (key: string) => string): Promise<DashboardSummary> {
    const defaultSummary: DashboardSummary = { stats: [], salesTrend: 0, averageBilling: null, appointmentAttendance: null };
    if (!dateRange || !dateRange.from || !dateRange.to) {
        return defaultSummary;
    }
    const params = new URLSearchParams({
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd'),
    });

    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/dashboard_summary?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return defaultSummary;
        }

        const data = await response.json();
        const summaryData = (Array.isArray(data) && data.length > 0) ? data[0] : data;

        const formatCurrency = (value: number) => {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
        }
        
        const formatPercentage = (value: number) => {
            const sign = value > 0 ? '+' : '';
            return `${sign}${value.toFixed(1)}% ${t('fromLastMonth')}`;
        }
        
        const getChangeType = (value: number): 'positive' | 'negative' | 'neutral' => {
            if (value > 0) return 'positive';
            if (value < 0) return 'negative';
            return 'neutral';
        }

        const avgRevenueChange = Number(summaryData.avg_revenue_change_vs_previous || 0);
        const showRateChange = Number(summaryData.show_rate_change_vs_previous || 0);

        return {
            stats: [
                {
                    title: t('totalRevenue'),
                    value: formatCurrency(Number(summaryData.current_period_revenue || 0)),
                    change: formatPercentage(Number(summaryData.revenue_growth_percentage || 0)),
                    changeType: getChangeType(Number(summaryData.revenue_growth_percentage || 0)),
                    icon: 'currency-dollar',
                },
                {
                    title: t('newPatients'),
                    value: `+${summaryData.current_period_new_patients || 0}`,
                    change: `+${Number(summaryData.new_patients_growth_percentage || 0).toFixed(1)}% ${t('fromLastMonth')}`,
                    changeType: getChangeType(Number(summaryData.new_patients_growth_percentage || 0)),
                    icon: 'user-plus',
                },
                {
                    title: t('sales'),
                    value: `+${summaryData.current_period_sales || 0}`,
                    change: formatPercentage(Number(summaryData.sales_growth_percentage || 0)),
                    changeType: getChangeType(Number(summaryData.sales_growth_percentage) || 0),
                    icon: 'arrow-trending-up',
                },
                {
                    title: t('quoteConversionRate'),
                    value: `${(Number(summaryData.quote_conversion_rate) || 0).toFixed(1)}%`,
                    change: formatPercentage(Number(summaryData.quote_conversion_rate_growth) || 0),
                    changeType: getChangeType(Number(summaryData.quote_conversion_rate_growth) || 0),
                    icon: 'chart-pie',
                },
            ],
            salesTrend: summaryData.sales_trend_percentage || 0,
            averageBilling: {
                value: Number(summaryData.average_revenue_per_patient || 0),
                change: avgRevenueChange,
                changeType: getChangeType(avgRevenueChange),
            },
            appointmentAttendance: {
                value: Number(summaryData.show_rate_percentage || 0),
                change: showRateChange,
                changeType: getChangeType(showRateChange),
            }
        };

    } catch (error) {
        console.error("Failed to fetch dashboard summary:", error);
        return defaultSummary;
    }
}


async function getSalesSummaryChartData(dateRange: DateRange | undefined): Promise<SalesChartData[]> {
    if (!dateRange || !dateRange.from) {
        return [];
    }
    const params = new URLSearchParams({
        target_date: format(dateRange.from, 'yyyy-MM-dd'),
    });

    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/dashboard_sales_summary?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const salesData = Array.isArray(data) ? data : (data.sales_summary || data.data || []);
        
        return salesData.map((item: any) => ({
            month: item.month,
            revenue: Number(item.revenue) || 0,
        }));

    } catch (error) {
        console.error("Failed to fetch sales summary chart data:", error);
        return [];
    }
}

const CHART_COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
];

async function getSalesByServiceChartData(dateRange: DateRange | undefined): Promise<SalesByServiceChartData[]> {
    if (!dateRange || !dateRange.from || !dateRange.to) {
        return [];
    }
    const params = new URLSearchParams({
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd'),
    });

    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/dashboard_sales_by_service?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const serviceSalesData = Array.isArray(data) ? data : (data.sales_by_service || data.data || []);
        
        const totalSales = serviceSalesData.reduce((acc: number, item: any) => acc + (Number(item.sales) || 0), 0);
        
        if (totalSales === 0) {
            return serviceSalesData.map((item: any, index: number) => ({
                name: item.name,
                sales: 0,
                percentage: 0,
                color: CHART_COLORS[index % CHART_COLORS.length],
            }));
        }

        return serviceSalesData.map((item: any, index: number) => ({
            name: item.name,
            sales: Number(item.sales) || 0,
            percentage: (Number(item.sales) / totalSales) * 100,
            color: CHART_COLORS[index % CHART_COLORS.length],
        }));

    } catch (error) {
        console.error("Failed to fetch sales by service chart data:", error);
        return [];
    }
}

async function getInvoiceStatusChartData(): Promise<InvoiceStatusData[]> {
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/dashboard_invoice_status`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const statusData = Array.isArray(data) ? data : (data.invoice_status || data.data || []);

        return statusData.map((item: any) => ({
            name: item.name,
            value: Number(item.value) || 0,
            fill: item.fill || INVOICE_CHART_COLORS[item.name] || 'hsl(var(--muted-foreground))',
        }));

    } catch (error) {
        console.error("Failed to fetch invoice status chart data:", error);
        return [];
    }
}

async function getPatientDemographicsData(dateRange: DateRange | undefined, t: (key: string) => string): Promise<PatientDemographics | null> {
    if (!dateRange || !dateRange.from || !dateRange.to) {
        return null;
    }
    const params = new URLSearchParams({
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd'),
    });

    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/dashboard_new_vs_recurring_patients?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const apiData = Array.isArray(data) && data.length > 0 ? data[0] : data;

        const newPatients = Number(apiData.new_patients) || 0;
        const recurringPatients = Number(apiData.recurring_patients) || 0;
        
        return {
            total: newPatients + recurringPatients,
            data: [
                { type: t('new'), count: newPatients, fill: 'hsl(var(--chart-1))' },
                { type: t('recurrent'), count: recurringPatients, fill: 'hsl(var(--chart-2))' },
            ]
        };
    } catch (error) {
        console.error("Failed to fetch patient demographics data:", error);
        return null;
    }
}


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
      billing_status: apiQuote.billing_status || 'not invoiced',
      userName: apiQuote.user_name || 'No Name',
      userEmail: apiQuote.userEmail || 'no-email@example.com',
      createdAt: apiQuote.createdAt || new Date().toISOString().split('T')[0],
    }));
  } catch (error) {
    console.error("Failed to fetch quotes:", error);
    return [];
  }
}

async function getOrders(): Promise<Order[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/orders', {
             method: 'GET',
             mode: 'cors',
             headers: { 'Accept': 'application/json' },
             cache: 'no-store',
        });
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return [];
        }
        const data = await response.json();
        const ordersData = Array.isArray(data) ? data : (data.orders || data.data || []);
        return ordersData.map((apiOrder: any) => ({
            id: apiOrder.id ? String(apiOrder.id) : `ord_${Math.random().toString(36).substr(2, 9)}`,
            user_id: apiOrder.user_id,
            status: apiOrder.status,
            createdAt: apiOrder.createdAt || new Date().toISOString().split('T')[0],
        }));
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return [];
    }
}

async function getUsers(): Promise<User[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return [];
    }

    const responseData = await response.json();
    const data = (Array.isArray(responseData) && responseData.length > 0) ? responseData[0] : { data: [], total: 0 };
    
    const usersData = Array.isArray(data.data) ? data.data : [];

    return usersData.map((apiUser: any) => ({
      id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
      name: apiUser.name || 'No Name',
      email: apiUser.email || 'no-email@example.com',
      phone_number: apiUser.phone_number || '000-000-0000',
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
    }));
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return [];
  }
}

export default function DashboardPage() {
  const tStats = useTranslations('Stats');
  const tKpi = useTranslations('KpiRow');

  const [stats, setStats] = React.useState<Stat[]>([]);
  const [salesTrend, setSalesTrend] = React.useState(0);
  const [averageBilling, setAverageBilling] = React.useState<AverageBilling | null>(null);
  const [appointmentAttendance, setAppointmentAttendance] = React.useState<AppointmentAttendanceRate | null>(null);
  const [patientDemographics, setPatientDemographics] = React.useState<PatientDemographics | null>(null);
  const [isKpiLoading, setIsKpiLoading] = React.useState(true);
  
  const [salesChartData, setSalesChartData] = React.useState<SalesChartData[]>([]);
  const [isChartLoading, setIsChartLoading] = React.useState(true);
  const [salesByServiceData, setSalesByServiceData] = React.useState<SalesByServiceChartData[]>([]);
  const [isSalesByServiceLoading, setIsSalesByServiceLoading] = React.useState(true);
  const [invoiceStatusData, setInvoiceStatusData] = React.useState<InvoiceStatusData[]>([]);
  const [isInvoiceStatusLoading, setIsInvoiceStatusLoading] = React.useState(true);
  
  const [quotes, setQuotes] = React.useState<Quote[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: subMonths(new Date(), 1),
    to: new Date(),
  });

  React.useEffect(() => {
    setIsKpiLoading(true);
    getDashboardData(date, tStats).then(({stats, salesTrend, averageBilling, appointmentAttendance}) => {
        setStats(stats);
        setSalesTrend(salesTrend);
        setAverageBilling(averageBilling);
        setAppointmentAttendance(appointmentAttendance);
        setIsKpiLoading(false);
    });
    
    getPatientDemographicsData(date, tKpi).then(data => {
        setPatientDemographics(data);
    });
    
    setIsChartLoading(true);
    getSalesSummaryChartData(date).then(data => {
        setSalesChartData(data);
        setIsChartLoading(false);
    });

    setIsSalesByServiceLoading(true);
    getSalesByServiceChartData(date).then(data => {
        setSalesByServiceData(data);
        setIsSalesByServiceLoading(false);
    });
    
    setIsInvoiceStatusLoading(true);
    getInvoiceStatusChartData().then(data => {
        setInvoiceStatusData(data);
        setIsInvoiceStatusLoading(false);
    });

  }, [date, tStats, tKpi]);

  React.useEffect(() => {
    getQuotes().then(setQuotes);
    getOrders().then(setOrders);
    getUsers().then(setUsers);
  }, []);

  return (
    <>
      <div className="space-y-4">
        <ReportFilters date={date} setDate={setDate} />
        <Stats data={stats} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SalesSummaryChart 
                salesTrend={salesTrend} 
                date={date} 
                chartData={salesChartData}
                isLoading={isChartLoading}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SalesByServiceChart chartData={salesByServiceData} isLoading={isSalesByServiceLoading}/>
                <InvoiceStatusChart chartData={invoiceStatusData} isLoading={isInvoiceStatusLoading} />
            </div>
        </div>
        <KpiRow 
            averageBillingData={averageBilling}
            appointmentAttendanceData={appointmentAttendance}
            patientDemographicsData={patientDemographics}
            isLoading={isKpiLoading}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RecentQuotesTable quotes={quotes} />
            <RecentOrdersTable orders={orders} />
        </div>
        <NewUsersTable users={users} />
      </div>
    </>
  );
}
