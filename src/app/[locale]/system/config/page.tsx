
'use client';

import * as React from 'react';
import { systemConfigurations } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { SystemConfiguration } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';


const columns: ColumnDef<SystemConfiguration>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'key', header: ({column}) => <DataTableColumnHeader column={column} title="Key" /> },
    { accessorKey: 'value', header: ({column}) => <DataTableColumnHeader column={column} title="Value" /> },
    { accessorKey: 'data_type', header: ({column}) => <DataTableColumnHeader column={column} title="Type" /> },
    { accessorKey: 'updated_by', header: ({column}) => <DataTableColumnHeader column={column} title="Updated By" /> },
    {
        id: 'actions',
        cell: ({ row }) => {
        const config = row.original;
        return (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        );
        },
    },
];

export default function SystemConfigPage() {
    const [data, setData] = React.useState<SystemConfiguration[]>(systemConfigurations);
    const [isCreateOpen, setCreateOpen] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setData([...systemConfigurations]);
            setIsRefreshing(false);
        }, 1000);
    };

    return (
        <>
        <Card>
        <CardHeader>
            <CardTitle>System Configurations</CardTitle>
            <CardDescription>Manage system-wide settings.</CardDescription>
        </CardHeader>
        <CardContent>
            <DataTable 
                columns={columns} 
                data={data} 
                filterColumnId="key" 
                filterPlaceholder="Filter configurations by key..."
                onCreate={() => setCreateOpen(true)}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
            />
        </CardContent>
        </Card>

        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Create New Configuration</DialogTitle>
                <DialogDescription>
                    Fill in the details below to add a new system configuration.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="key" className="text-right">
                        Key
                        </Label>
                        <Input id="key" placeholder="e.g., API_ENDPOINT" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="value" className="text-right">
                        Value
                        </Label>
                        <Input id="value" placeholder="e.g., https://api.example.com" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="data_type" className="text-right">
                        Data Type
                        </Label>
                         <Select>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select a data type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                                <SelectItem value="json">JSON</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Configuration</Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
