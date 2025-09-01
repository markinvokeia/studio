'use client';

import * as React from 'react';
import { conversations } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { Conversation } from '@/lib/types';
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

const columns: ColumnDef<Conversation>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'subject', header: ({column}) => <DataTableColumnHeader column={column} title="Subject" /> },
    { accessorKey: 'user_id', header: ({column}) => <DataTableColumnHeader column={column} title="User ID" /> },
    { accessorKey: 'channel_id', header: ({column}) => <DataTableColumnHeader column={column} title="Channel ID" /> },
    { accessorKey: 'status', header: ({column}) => <DataTableColumnHeader column={column} title="Status" /> },
];

export default function CommunicationsPage() {
  const [data, setData] = React.useState<Conversation[]>(conversations);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate fetching data
    setTimeout(() => {
        setData([...conversations]);
        setIsRefreshing(false);
    }, 1000);
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Conversations</CardTitle>
        <CardDescription>Manage user conversations.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable 
            columns={columns} 
            data={data} 
            filterColumnId="subject" 
            filterPlaceholder="Filter conversations by subject..."
            onCreate={() => setCreateOpen(true)}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>

    <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>Create New Conversation</DialogTitle>
            <DialogDescription>
                Fill in the details below to start a new conversation.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="subject" className="text-right">
                    Subject
                    </Label>
                    <Input id="subject" placeholder="e.g., Billing question" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="user_id" className="text-right">
                    User ID
                    </Label>
                    <Input id="user_id" placeholder="usr_..." className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="channel_id" className="text-right">
                    Channel ID
                    </Label>
                    <Input id="channel_id" placeholder="chan_..." className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">
                    Status
                    </Label>
                    <Select>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit">Create Conversation</Button>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}
