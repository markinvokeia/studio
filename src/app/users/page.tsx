import { userColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User } from '@/lib/types';

async function getUsers(): Promise<User[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store', // Asegura que los datos se obtengan en cada solicitud
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const usersData = Array.isArray(data) ? data : (data.users || data.data || data.result || []);

    // Mapear los datos de la API al tipo User, proporcionando valores predeterminados
    return usersData.map((apiUser: any) => ({
      id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
      name: apiUser.name || 'No Name',
      email: apiUser.email || 'no-email@example.com',
      phone_number: apiUser.phone || '000-000-0000',
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
    }));
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return []; // Devuelve un array vacío en caso de error
  }
}

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Manage all users in the system.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={userColumns} data={users} filterColumnId="email" filterPlaceholder="Filter by email..." />
      </CardContent>
    </Card>
  );
}
