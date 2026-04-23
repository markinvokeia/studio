---
name: permissions-protection
description: >
  Protege componentes y rutas usando el sistema de permisos basado en roles. Úsalo cuando necesitas: (1) Ocultar elementos de UI según permisos del usuario, (2) Proteger rutas/páginas para que solo usuarios con permisos específicos puedan acceder, (3) Implementar control de acceso en formularios, tablas o botones.
---

# Protección de Componentes y Rutas con Permisos

Este skill proporciona las guías y patrones para implementar control de acceso basado en permisos en la aplicación Next.js.

## Sistema de Permisos

El proyecto usa un sistema de permisos donde:
- Los permisos se definen en el backend con códigos como `CATALOG_MEDICATIONS_CREATE`
- Cada permiso tiene: `action` (create/read/update/delete), `resource`, y `code`
- Los permisos se asignan a roles, y los usuarios tienen roles

### Hook `usePermissions`

```typescript
import { usePermissions } from '@/hooks/usePermissions';

const { 
  hasPermission,        // (code: string) => boolean
  hasAnyPermission,    // (codes: string[]) => boolean  
  hasAllPermissions,   // (codes: string[]) => boolean
  canAccess,           // (action, resource) => boolean
  permissions,         // string[] - todos los códigos
  roles,               // string[] - roles del usuario
  isLoading 
} = usePermissions();
```

## Protegiendo Rutas

### Con PrivateRoute

Cada página puede proteger su acceso con el componente `PrivateRoute`:

```typescript
// src/app/[locale]/system/users/page.tsx
import { PrivateRoute } from '@/components/auth/PrivateRoute';

export default function UsersPage() {
  return (
    <PrivateRoute requiredPermission="CODIGO_PERMISO">
      <PageContent />
    </PrivateRoute>
  );
}
```

**Props disponibles:**
- `requiredPermission`: Un código de permiso específico
- `requiredPermissions`: Array de códigos (todos requeridos - AND)
- `requiredAnyPermission`: Array de códigos (al menos uno requerido - OR)
- `fallback`: Componente a mostrar si no tiene acceso

### Ejemplos de Protección de Rutas

```typescript
// Un solo permiso
<PrivateRoute requiredPermission="USUARIOS_VIEW_LIST">

// Múltiples permisos (AND - necesita todos)
<PrivateRoute requiredPermissions={['USUARIOS_VIEW_LIST', 'USUARIOS_EDIT']}>

// Múltiples permisos (OR - necesita al menos uno)
<PrivateRoute requiredAnyPermission={['ADMIN_ACCESS', 'USUARIOS_ALL']}>

// Con fallback personalizado
<PrivateRoute 
  requiredPermission="USUARIOS_CREATE"
  fallback={<NoAccessMessage />}
>
```

## Protegiendo Componentes de UI

### Con el Componente `<Can>`

Usa el componente `Can` para mostrar/ocultar elementos según permisos:

```typescript
import { Can } from '@/components/auth/Can';
```

**Uso básico:**
```typescript
<Can permission="CODIGO_PERMISO">
  <Button>Eliminar</Button>
</Can>
```

**Con fallback:**
```typescript
<Can permission="USUARIOS_CREATE" fallback={null}>
  <Button>Crear Usuario</Button>
</Can>
```

**Múltiples permisos:**
```typescript
// AND - necesita todos
<Can permissions={['USUARIOS_EDIT', 'USUARIOS_DELETE']}>
  <ActionsMenu />
</Can>

// OR - necesita al menos uno
<Can anyPermissions={['ADMIN_ACCESS', 'GERENTE_ACCESS']}>
  <AdminPanel />
</Can>

// Por rol
<Can role="administrador">
  <AdminOnlySection />
</Can>
```

## Ejemplos Prácticos

### Tabla con acciones condicionales

```typescript
import { Can } from '@/components/auth/Can';

<DataTable>
  <DataTable.Column key="actions" header="Acciones">
    {(row) => (
      <div className="flex gap-2">
        <Can permission="USUARIOS_VIEW">
          <Button variant="ghost" onClick={() => view(row)}>
            Ver
          </Button>
        </Can>
        <Can permission="USUARIOS_EDIT">
          <Button variant="ghost" onClick={() => edit(row)}>
            Editar
          </Button>
        </Can>
        <Can permission="USUARIOS_DELETE">
          <Button variant="ghost" onClick={() => delete(row)}>
            Eliminar
          </Button>
        </Can>
      </div>
    )}
  </DataTable.Column>
</DataTable>
```

### Formulario con campos condicionados

```typescript
import { Can } from '@/components/auth/Can';

<Form>
  <FormField name="name" />
  <FormField name="email" />
  
  <Can permission="USUARIOS_ADMIN_ACCESS">
    <FormField name="role" />
    <FormField name="is_active" />
  </Can>
</Form>
```

### Botones en toolbar

```typescript
<div className="flex justify-end gap-2">
  <Can permission="REPORTS_EXPORT">
    <Button variant="outline">
      <Download className="mr-2" />
      Exportar
    </Button>
  </Can>
  
  <Can permission="REPORTS_CREATE">
    <Button>
      <Plus className="mr-2" />
      Nuevo Reporte
    </Button>
  </Can>
</div>
```

### Verificación programática

```typescript
const { hasPermission } = usePermissions();

// En handlers
const handleDelete = async () => {
  if (!hasPermission('USUARIOS_DELETE')) {
    toast.error('No tienes permiso para eliminar');
    return;
  }
  // lógica de eliminación
};

// Condicionalmente deshabilitar
<Button disabled={!hasPermission('USUARIOS_EDIT')}>
  Guardar
</Button>
```

## Definiendo Códigos de Permiso

Los códigos de permiso siguen el patrón: `MODULO_ACCION`

Ejemplos del backend:
- `CATALOG_MEDICATIONS_CREATE`
- `CATALOG_MEDICATIONS_READ`
- `CATALOG_MEDICATIONS_UPDATE`
- `CATALOG_MEDICATIONS_DELETE`
- `CATALOG_DENTAL_COND_VIEW_MENU`

Para el menú, los códigos típicos son:
- `_VIEW_MENU` - Para ver el submenú
- `VIEW_LIST` - Para ver listados
- `CREATE` - Para crear
- `UPDATE` - Para editar
- `DELETE` - Para eliminar

## Agregar Permisos al Menú

Edita `src/config/nav.ts` para agregar `requiredPermission` a cada NavItem:

```typescript
{
  title: 'System',
  href: '/system/users',
  icon: Shield,
  requiredPermission: 'SYSTEM_VIEW_MENU',
  items: [
    { title: 'SystemUsers', href: '/system/users', requiredPermission: 'USUARIOS_VIEW_LIST', ... },
    { title: 'Roles', href: '/roles', requiredPermission: 'ROLES_VIEW_LIST', ... },
  ],
}
```

## Errores Comunes

1. **Usar códigos incorrectos**: Verifica que el código exista en la respuesta del endpoint `/auth/me`

2. **No manejar isLoading**: Siempre considerar el estado de carga:
```typescript
const { hasPermission, isLoading } = usePermissions();

if (isLoading) return <Skeleton />;
```

3. **Olvidar el fallback**: Siempre define qué mostrar cuando no hay permiso

## Archivos Clave

- `src/context/AuthContext.tsx` - Proveedor de autenticación
- `src/hooks/usePermissions.ts` - Hook para verificar permisos
- `src/components/auth/Can.tsx` - Componente condicional
- `src/components/auth/PrivateRoute.tsx` - Protección de rutas
- `src/lib/permissions.ts` - Utilitarios de filtrado
- `src/config/nav.ts` - Configuración del menú
