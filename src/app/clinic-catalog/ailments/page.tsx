
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
    // This is a placeholder. In a real application, you would fetch this from your API.
    return [
        { id: '1', nombre: 'Hipertensión Arterial', categoria: 'Cardiovascular', nivel_alerta: 2 },
        { id: '2', nombre: 'Diabetes Tipo 2', categoria: 'Endocrino', nivel_alerta: 2 },
        { id: '3', nombre: 'Alergia a Penicilina', categoria: 'Alergia', nivel_alerta: 3 },
    ];
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
