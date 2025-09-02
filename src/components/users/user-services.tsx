'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Service } from '@/lib/types';

const columns: ColumnDef<Service>[] = [
    {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Service" />,
    },
    {
        accessorKey: 'category',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
    },
    {
        accessorKey: 'price',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue('price'));
            const formatted = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
            }).format(amount);
            return <div className="font-medium">{formatted}</div>;
        }
    }
];

async function getServicesForUser(userId: string): Promise<Service[]> {
  if (!userId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_services?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const userServicesData = Array.isArray(data) ? data : (data.user_services || data.data || data.result || []);

    return userServicesData.map((apiService: any) => ({
      id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
      name: apiService.name || 'Unknown Service',
      category: apiService.category || 'N/A',
      price: apiService.price || 0,
      duration_minutes: apiService.duration_minutes || 0,
    }));
  } catch (error) {
    console.error("Failed to fetch user services:", error);
    return [];
  }
}

interface UserServicesProps {
  userId: string;
}

export function UserServices({ userId }: UserServicesProps) {
  const [userServices, setUserServices] = React.useState<Service[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadServices() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedUserServices = await getServicesForUser(userId);
      setUserServices(fetchedUserServices);
      setIsLoading(false);
    }
    loadServices();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={userServices}
          filterColumnId='name'
          filterPlaceholder='Filter by service...'
        />
      </CardContent>
    </Card>
  );
}
