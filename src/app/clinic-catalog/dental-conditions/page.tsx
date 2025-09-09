
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DentalCondition } from '@/lib/types';
import { dentalConditionsColumns } from './columns';
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

async function getDentalConditions(): Promise<DentalCondition[]> {
    // This is a placeholder. In a real application, you would fetch this from your API.
    return [
        { id: '1', nombre: 'Caries', codigo_visual: 'CARIES', color_hex: '#FF0000' },
        { id: '2', nombre: 'Restauración Resina', codigo_visual: 'FILLED_RESIN', color_hex: '#0000FF' },
        { id: '3', nombre: 'Ausente', codigo_visual: 'MISSING', color_hex: '#808080' },
    ];
}

export default function DentalConditionsPage() {
    const [conditions, setConditions] = React.useState<DentalCondition[]>([]);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const loadConditions = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedConditions = await getDentalConditions();
        setConditions(fetchedConditions);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadConditions();
    }, [loadConditions]);

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Dental Conditions</CardTitle>
                <CardDescription>Manage possible findings in an odontogram.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={dentalConditionsColumns} 
                    data={conditions} 
                    filterColumnId="nombre" 
                    filterPlaceholder="Filter by name..."
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadConditions}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Dental Condition</DialogTitle>
                <DialogDescription>
                    Fill in the details below to add a new dental condition.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nombre" className="text-right">Name</Label>
                        <Input id="nombre" placeholder="e.g., Caries" className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="codigo_visual" className="text-right">Visual Code</Label>
                        <Input id="codigo_visual" placeholder="e.g., CARIES" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="color_hex" className="text-right">Color</Label>
                        <Input id="color_hex" type="color" className="col-span-3 p-1" />
                    </div>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Condition</Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
