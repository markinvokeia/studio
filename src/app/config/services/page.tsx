import { services } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { servicesColumns } from './columns';

export default function ServicesPage() {
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
