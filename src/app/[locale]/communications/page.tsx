'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { conversations } from '@/lib/data';
import { Conversation } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import * as React from 'react';


const columns: ColumnDef<Conversation>[] = [
    { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'subject', header: ({ column }) => <DataTableColumnHeader column={column} title="Subject" /> },
    { accessorKey: 'user_id', header: ({ column }) => <DataTableColumnHeader column={column} title="User ID" /> },
    { accessorKey: 'channel_id', header: ({ column }) => <DataTableColumnHeader column={column} title="Channel ID" /> },
    { accessorKey: 'status', header: ({ column }) => <DataTableColumnHeader column={column} title="Status" /> },
    {
        id: 'actions',
        cell: ({ row }) => {
            const conversation = row.original;
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
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button type="submit">Create Conversation</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
