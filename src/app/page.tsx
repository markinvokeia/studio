
'use client';

import { Stats } from '@/components/dashboard/stats';
import { SalesSummaryChart } from '@/components/charts/sales-summary-chart';
import { SalesByServiceChart } from '@/components/charts/sales-by-service-chart';
import { InvoiceStatusChart } from '@/components/charts/invoice-status-chart';
import { ReportFilters } from '@/components/dashboard/report-filters';
import { RecentQuotesTable } from '@/components/tables/recent-quotes-table';
import { RecentOrdersTable } from '@/components/tables/recent-orders-table';
import { NewUsersTable } from '@/components/tables/new-users-table';
import { Quote, Order, User, Stat } from '@/lib/types';
import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { subMonths, format } from 'date-fns';
import { DollarSign, Users as UsersIcon, CreditCard, Activity } from 'lucide-react';


async function getDashboardSummary(dateRange: DateRange | undefined): Promise<Stat[]> {
    if (!dateRange || !dateRange.from || !dateRange.to) {
        return [];
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
            return [];
        }

        const data = await response.json();
        const summaryData = (Array.isArray(data) && data.length > 0) ? data[0] : data;

        const formatCurrency = (value: number) => {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
        }
        
        const formatPercentage = (value: number) => {
            return `${value.toFixed(1)}% from last month`;
        }

        return [
            {
                title: 'Total Revenue',
                value: formatCurrency(summaryData.current_period_revenue || 0),
                change: formatPercentage(summaryData.revenue_growth_percentage || 0),
                icon: 'dollar-sign',
            },
            {
                title: 'Subscriptions',
                value: `+${summaryData.new_subscriptions || 0}`,
                change: `+${summaryData.subscriptions_growth_percentage || 0}% from last month`,
                icon: 'users',
            },
            {
                title: 'Sales',
                value: `+${summaryData.total_sales || 0}`,
                change: `+${summaryData.sales_growth_percentage || 0}% from last month`,
                icon: 'credit-card',
            },
            {
                title: 'Active Now',
                value: `+${summaryData.active_users || 0}`,
                change: `+${summaryData.active_users_change || 0} since last hour`,
                icon: 'activity',
            },
        ];

    } catch (error) {
        console.error("Failed to fetch dashboard summary:", error);
        return [];
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
  const [stats, setStats] = React.useState<Stat[]>([]);
  const [quotes, setQuotes] = React.useState<Quote[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: subMonths(new Date(), 1),
    to: new Date(),
  });

  React.useEffect(() => {
    getDashboardSummary(date).then(setStats);
  }, [date]);

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
          <SalesSummaryChart />
          <div className="grid grid-cols-1 gap-4 lg:col-span-3 lg:grid-cols-2">
             <SalesByServiceChart />
             <InvoiceStatusChart />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RecentQuotesTable quotes={quotes} />
            <RecentOrdersTable orders={orders} />
        </div>
        <NewUsersTable users={users} />
      </div>
    </>
  );
}
