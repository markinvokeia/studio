import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClinicSchedule } from '@/lib/types';
import { schedulesColumns } from './columns';

async function getSchedules(): Promise<ClinicSchedule[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/schedules', {
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
        const schedulesData = Array.isArray(data) ? data : (data.schedules || data.data || data.result || []);

        return schedulesData.map((apiSchedule: any) => ({
            id: apiSchedule.id ? String(apiSchedule.id) : `sch_${Math.random().toString(36).substr(2, 9)}`,
            day_of_week: apiSchedule.day_of_week,
            start_time: apiSchedule.start_time,
            end_time: apiSchedule.end_time,
        }));
    } catch (error) {
        console.error("Failed to fetch schedules:", error);
        return [];
    }
}

export default async function SchedulesPage() {
    const schedules = await getSchedules();
    return (
        <Card>
            <CardHeader>
                <CardTitle>Clinic Schedules</CardTitle>
                <CardDescription>Manage regular weekly schedules for the clinic.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable columns={schedulesColumns} data={schedules} filterColumnId="day_of_week" filterPlaceholder="Filter by day..." />
            </CardContent>
        </Card>
    );
}
