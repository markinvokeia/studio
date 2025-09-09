
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
    // This is a placeholder. In a real application, you would fetch this from your API.
    return [
        { id: '1', nombre_generico: 'Ibuprofeno', nombre_comercial: 'Advil' },
        { id: '2', nombre_generico: 'Paracetamol', nombre_comercial: 'Tylenol' },
        { id: '3', nombre_generico: 'Amoxicilina', nombre_comercial: 'Amoxil' },
    ];
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
