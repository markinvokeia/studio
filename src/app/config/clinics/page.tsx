import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { Clinic } from '@/lib/types';
import { clinicsColumns } from './columns';

async function getClinics(): Promise<Clinic[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/clinics', {
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
            location: apiClinic.location || 'No Location',
            contact_email: apiClinic.contact_email || 'no-email@example.com',
            phone_number: apiClinic.phone_number || '000-000-0000',
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
                <CardTitle>Clinics</CardTitle>
                <CardDescription>Manage clinic locations.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable columns={clinicsColumns} data={clinics} filterColumnId="name" filterPlaceholder="Filter clinics..." />
            </CardContent>
        </Card>
    );
}