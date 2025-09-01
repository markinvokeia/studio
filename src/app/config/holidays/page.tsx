import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClinicException } from '@/lib/types';
import { holidaysColumns } from './columns';

async function getHolidays(): Promise<ClinicException[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/exceptions', {
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
        const holidaysData = Array.isArray(data) ? data : (data.exceptions || data.data || data.result || []);

        return holidaysData.map((apiHoliday: any) => ({
            id: apiHoliday.id ? String(apiHoliday.id) : `ex_${Math.random().toString(36).substr(2, 9)}`,
            date: apiHoliday.date,
            is_open: apiHoliday.is_open,
            start_time: apiHoliday.start_time,
            end_time: apiHoliday.end_time,
            notes: apiHoliday.notes || '',
        }));
    } catch (error) {
        console.error("Failed to fetch holidays:", error);
        return [];
    }
}


export default async function HolidaysPage() {
    const holidays = await getHolidays();
    return (
        <Card>
            <CardHeader>
                <CardTitle>Holidays & Exceptions</CardTitle>
                <CardDescription>Manage exceptions to the regular clinic schedule.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable columns={holidaysColumns} data={holidays} filterColumnId="date" filterPlaceholder="Filter holidays by date..." />
            </CardContent>
        </Card>
    );
}
