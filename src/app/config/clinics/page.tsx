import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { Clinic } from '@/lib/types';
import { clinicsColumns } from './columns';

async function getClinics(): Promise<Clinic[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/clinic', {
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
        const clinicsData = Array.isArray(data) ? data : (data.clinics || data.data || data.result || []);

        return clinicsData.map((apiClinic: any) => ({
            id: apiClinic.id ? String(apiClinic.id) : `cli_${Math.random().toString(36).substr(2, 9)}`,
            name: apiClinic.name || 'No Name',
            location: apiClinic.address || 'No Location',
            contact_email: apiClinic.email || 'no-email@example.com',
            phone_number: apiClinic.phone || '000-000-0000',
        }));
    } catch (error) {
        console.error("Failed to fetch clinics:", error);
        return [];
    }
}


export default async function ClinicsPage() {
    const clinics = await getClinics();
    return (
        <Card>
            <CardHeader>
                <CardTitle>Clinic Details</CardTitle>
                <CardDescription>Manage clinic locations and contact information.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable columns={clinicsColumns} data={clinics} filterColumnId="name" filterPlaceholder="Filter clinics..." />
            </CardContent>
        </Card>
    );
}
