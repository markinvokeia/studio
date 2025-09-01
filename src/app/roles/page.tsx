'use client';

import * as React from 'react';
import { roleColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

async function getRoles(): Promise<Role[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/roles', {
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
    const rolesData = Array.isArray(data) ? data : (data.roles || data.data || data.result || []);

    return rolesData.map((apiRole: any) => ({
      id: apiRole.id ? String(apiRole.id) : `rol_${Math.random().toString(36).substr(2, 9)}`,
      name: apiRole.name || 'No Name',
    }));
  } catch (error) {
    console.error("Failed to fetch roles:", error);
    return [];
  }
}


export default function RolesPage() {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);

  React.useEffect(() => {
    async function loadRoles() {
      const fetchedRoles = await getRoles();
      setRoles(fetchedRoles);
    }
    loadRoles();
  }, []);

  const handleRowSelectionChange = (selectedRows: Role[]) => {
    const role = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedRole(role);
  };
  
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={cn("transition-all duration-300", selectedRole ? "lg:col-span-2" : "lg:col-span-3")}>
            <Card>
                <CardHeader>
                    <CardTitle>Roles</CardTitle>
                    <CardDescription>Manage user roles and their permissions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable 
                    columns={roleColumns} 
                    data={roles} 
                    filterColumnId="name" 
                    filterPlaceholder="Filter roles by name..."
                    onRowSelectionChange={handleRowSelectionChange}
                    enableSingleRowSelection={true}
                    />
                </CardContent>
            </Card>
        </div>
        {selectedRole && (
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Details for {selectedRole.name}</CardTitle>
                        <CardDescription>Role ID: {selectedRole.id}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Details for the selected role will be displayed here.</p>
                    </CardContent>
                </Card>
            </div>
        )}
    </div>
  );
}
