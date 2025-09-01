'use client';

import * as React from 'react';
import { Role, UserRole } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { KeyRound } from 'lucide-react';

async function getUserRoles(userId: string): Promise<UserRole[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_roles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const userRolesData = Array.isArray(data) ? data : (data.user_roles || data.data || data.result || []);

    return userRolesData.map((apiRole: any) => ({
      user_id: apiRole.user_id,
      role_id: apiRole.role_id,
      is_active: apiRole.is_active,
    }));
  } catch (error) {
    console.error("Failed to fetch user roles:", error);
    return [];
  }
}

async function getAllRoles(): Promise<Role[]> {
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
    console.error("Failed to fetch all roles:", error);
    return [];
  }
}

interface UserRolesProps {
  userId: string;
}

export function UserRoles({ userId }: UserRolesProps) {
  const [userRoles, setUserRoles] = React.useState<UserRole[]>([]);
  const [allRoles, setAllRoles] = React.useState<Role[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadRoles() {
      setIsLoading(true);
      const [fetchedUserRoles, fetchedAllRoles] = await Promise.all([
        getUserRoles(userId),
        getAllRoles(),
      ]);
      setUserRoles(fetchedUserRoles);
      setAllRoles(fetchedAllRoles);
      setIsLoading(false);
    }
    loadRoles();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const roleMap = new Map(allRoles.map(role => [role.id, role.name]));
  const rolesToDisplay = userRoles.map(userRole => ({
    ...userRole,
    name: roleMap.get(userRole.role_id) || 'Unknown Role',
  }));

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        {rolesToDisplay.length > 0 ? (
          rolesToDisplay.map((role) => (
            <div key={role.role_id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{role.name}</span>
              </div>
              <Badge variant={role.is_active ? 'success' : 'outline'}>
                {role.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-center p-4">No roles assigned to this user.</p>
        )}
      </CardContent>
    </Card>
  );
}
