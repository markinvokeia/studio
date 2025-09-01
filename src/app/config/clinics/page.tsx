'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clinic } from '@/lib/types';
import { clinicsColumns } from './columns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

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


export default function ClinicsPage() {
    const [clinics, setClinics] = React.useState<Clinic[]>([]);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const loadClinics = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedClinics = await getClinics();
        setClinics(fetchedClinics);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadClinics();
    }, [loadClinics]);

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Clinic Details</CardTitle>
                <CardDescription>Manage clinic locations and contact information.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={clinicsColumns} 
                    data={clinics} 
                    filterColumnId="name" 
                    filterPlaceholder="Filter clinics by name..."
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadClinics}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>

        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Clinic</DialogTitle>
                <DialogDescription>
                    Fill in the details below to add a new clinic.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                    Name
                    </Label>
                    <Input id="name" placeholder="e.g., Downtown Branch" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="location" className="text-right">
                    Location
                    </Label>
                    <Input id="location" placeholder="e.g., 123 Main St, Anytown" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                    Email
                    </Label>
                    <Input id="email" type="email" placeholder="e.g., branch@clinic.com" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">
                    Phone
                    </Label>
                    <Input id="phone" placeholder="e.g., 111-222-3333" className="col-span-3" />
                </div>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Clinic</Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
