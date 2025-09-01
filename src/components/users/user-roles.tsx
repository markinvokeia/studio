'use client';

import * as React from 'react';
import { Role, UserRole } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { KeyRound } from 'lucide-react';

async function getRolesForUser(userId: string): Promise<{name: string, is_active: boolean, role_id: string}[]> {
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
      role_id: apiRole.role_id,
      name: apiRole.name || 'Unknown Role',
      is_active: apiRole.is_active,
    }));
  } catch (error) {
    console.error("Failed to fetch user roles:", error);
    return [];
  }
}

interface UserRolesProps {
  userId: string;
}

export function UserRoles({ userId }: UserRolesProps) {
  const [userRoles, setUserRoles] = React.useState<{name: string, is_active: boolean, role_id: string}[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadRoles() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedUserRoles = await getRolesForUser(userId);
      setUserRoles(fetchedUserRoles);
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

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        {userRoles.length > 0 ? (
          userRoles.map((role) => (
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
