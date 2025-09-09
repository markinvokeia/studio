
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DentalSurface } from '@/lib/types';
import { dentalSurfacesColumns } from './columns';
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

async function getDentalSurfaces(): Promise<DentalSurface[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogo_superficies_dentales', {
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
        const surfacesData = Array.isArray(data) ? data : (data.catalogo_superficies_dentales || data.data || data.result || []);

        return surfacesData.map((apiSurface: any) => ({
            id: apiSurface.id ? String(apiSurface.id) : `surf_${Math.random().toString(36).substr(2, 9)}`,
            nombre: apiSurface.nombre,
            codigo: apiSurface.codigo,
        }));
    } catch (error) {
        console.error("Failed to fetch dental surfaces:", error);
        return [];
    }
}

export default function DentalSurfacesPage() {
    const [surfaces, setSurfaces] = React.useState<DentalSurface[]>([]);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const loadSurfaces = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedSurfaces = await getDentalSurfaces();
        setSurfaces(fetchedSurfaces);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadSurfaces();
    }, [loadSurfaces]);

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Dental Surfaces</CardTitle>
                <CardDescription>Manage the surfaces of a tooth.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={dentalSurfacesColumns} 
                    data={surfaces} 
                    filterColumnId="nombre" 
                    filterPlaceholder="Filter by name..."
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadSurfaces}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Dental Surface</DialogTitle>
                <DialogDescription>
                    Fill in the details below to add a new dental surface.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nombre" className="text-right">Name</Label>
                        <Input id="nombre" placeholder="e.g., Oclusal" className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="codigo" className="text-right">Code</Label>
                        <Input id="codigo" placeholder="e.g., O" className="col-span-3" />
                    </div>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Surface</Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
