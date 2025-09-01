'use client';

import * as React from 'react';
import { communicationChannels } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { CommunicationChannel } from '@/lib/types';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';


const columns: ColumnDef<CommunicationChannel>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: 'channel_type', header: ({column}) => <DataTableColumnHeader column={column} title="Type" /> },
    { accessorKey: 'is_active', header: ({column}) => <DataTableColumnHeader column={column} title="Active" />, cell: ({row}) => row.original.is_active ? "Yes" : "No" },
    {
        id: 'actions',
        cell: ({ row }) => {
        const channel = row.original;
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

export default function ChannelsPage() {
  const [data, setData] = React.useState<CommunicationChannel[]>(communicationChannels);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate fetching data
    setTimeout(() => {
        setData([...communicationChannels]);
        setIsRefreshing(false);
    }, 1000);
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Communication Channels</CardTitle>
        <CardDescription>Manage communication channels.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable 
            columns={columns} 
            data={data} 
            filterColumnId="name" 
            filterPlaceholder="Filter channels by name..."
            onCreate={() => setCreateOpen(true)}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>

    <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>Create New Channel</DialogTitle>
            <DialogDescription>
                Fill in the details below to add a new communication channel.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                    Name
                    </Label>
                    <Input id="name" placeholder="e.g., Support Email" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="channel_type" className="text-right">
                    Type
                    </Label>
                    <Select>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="chat">Chat</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center space-x-2 justify-end">
                    <Checkbox id="is_active" />
                    <Label htmlFor="is_active">Is Active</Label>
                </div>
            </div>
            <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit">Create Channel</Button>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
