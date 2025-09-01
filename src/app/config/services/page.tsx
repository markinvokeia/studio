import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { servicesColumns } from './columns';
import { Service } from '@/lib/types';

async function getServices(): Promise<Service[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services', {
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
    const servicesData = Array.isArray(data) ? data : (data.services || data.data || data.result || []);

    return servicesData.map((apiService: any) => ({
      id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
      name: apiService.name || 'No Name',
      category: apiService.category || 'No Category',
      price: apiService.price || 0,
      duration_minutes: apiService.duration_minutes || 0,
    }));
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Catalog</CardTitle>
        <CardDescription>Manage business services.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={servicesColumns} data={services} filterColumnId="name" filterPlaceholder="Filter services..." />
      </CardContent>
    </Card>
  );
}
