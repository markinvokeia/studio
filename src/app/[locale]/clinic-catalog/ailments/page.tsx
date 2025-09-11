
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Ailment } from '@/lib/types';
import { ailmentsColumns } from './columns';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

async function getAilments(): Promise<Ailment[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogo_padecimientos', {
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
        const ailmentsData = Array.isArray(data) ? data : (data.catalogo_padecimientos || data.data || data.result || []);

        return ailmentsData.map((apiAilment: any) => ({
            id: apiAilment.id ? String(apiAilment.id) : `ail_${Math.random().toString(36).substr(2, 9)}`,
            nombre: apiAilment.nombre,
            categoria: apiAilment.categoria,
            nivel_alerta: Number(apiAilment.nivel_alerta)
        }));
    } catch (error) {
        console.error("Failed to fetch ailments:", error);
        return [];
    }
}

export default function AilmentsPage() {
    const [ailments, setAilments] = React.useState<Ailment[]>([]);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const loadAilments = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedAilments = await getAilments();
        setAilments(fetchedAilments);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadAilments();
    }, [loadAilments]);

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>Ailments</CardTitle>
                <CardDescription>Manage standardized medical conditions and diseases.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={ailmentsColumns} 
                    data={ailments} 
                    filterColumnId="nombre" 
                    filterPlaceholder="Filter by name..."
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadAilments}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Ailment</DialogTitle>
                <DialogDescription>
                    Fill in the details below to add a new ailment.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nombre" className="text-right">Name</Label>
                        <Input id="nombre" placeholder="e.g., Hipertensión Arterial" className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="categoria" className="text-right">Category</Label>
                        <Input id="categoria" placeholder="e.g., Cardiovascular" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nivel_alerta" className="text-right">Alert Level</Label>
                        <Select>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select a level" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1 (Normal)</SelectItem>
                                <SelectItem value="2">2 (Warning)</SelectItem>
                                <SelectItem value="3">3 (Critical)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Ailment</Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
