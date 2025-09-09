
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Medication } from '@/lib/types';
import { medicationsColumns } from './columns';
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

async function getMedications(): Promise<Medication[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogo_medicamentos', {
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
        const medicationsData = Array.isArray(data) ? data : (data.catalogo_medicamentos || data.data || data.result || []);

        return medicationsData.map((apiMedication: any) => ({
            id: apiMedication.id ? String(apiMedication.id) : `med_${Math.random().toString(36).substr(2, 9)}`,
            nombre_generico: apiMedication.nombre_generico,
            nombre_comercial: apiMedication.nombre_comercial,
        }));
    } catch (error) {
        console.error("Failed to fetch medications:", error);
        return [];
    }
}

export default function MedicationsPage() {
    const [medications, setMedications] = React.useState<Medication[]>([]);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const loadMedications = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedMedications = await getMedications();
        setMedications(fetchedMedications);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadMedications();
    }, [loadMedications]);

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Medications</CardTitle>
                <CardDescription>Manage the catalog of medications for auto-completion.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={medicationsColumns} 
                    data={medications} 
                    filterColumnId="nombre_generico" 
                    filterPlaceholder="Filter by generic name..."
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadMedications}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Medication</DialogTitle>
                <DialogDescription>
                    Fill in the details below to add a new medication.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nombre_generico" className="text-right">Generic Name</Label>
                        <Input id="nombre_generico" placeholder="e.g., Ibuprofeno" className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nombre_comercial" className="text-right">Commercial Name</Label>
                        <Input id="nombre_comercial" placeholder="e.g., Advil" className="col-span-3" />
                    </div>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Medication</Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
