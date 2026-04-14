# AGENTS.md

This file contains guidelines and conventions for agentic coding agents working in this React frontend codebase.

## Build/Lint/Test Commands

### Development

- `npm run dev` - Start development server on 0.0.0.0:3000
- `npm run genkit:dev` - Start Genkit AI development server
- `npm run genkit:watch` - Start Genkit with file watching

### Production

- `npm run build` - Build for production
- `npm run start` - Start production server

### Code Quality

- `npm run lint` - Run ESLint for code linting (Next.js built-in)
- `npm run typecheck` - Run TypeScript type checking without emitting files

## Tech Stack & Architecture

**Framework:** Next.js 15 with App Router, TypeScript (strict mode), Tailwind CSS with Shadcn/ui
**Key Libraries:** React Hook Form + Zod, next-intl, Google Genkit, Recharts, Radix UI, next-themes

**Directory Structure:**

- `src/app/[locale]/` - Next.js App Router with i18n
- `src/components/ui/` - Shadcn/ui reusable components
- `src/components/[feature]/` - Feature-specific components
- `src/lib/types.ts` - Centralized type definitions
- `src/hooks/`, `src/services/`, `src/context/` - Custom hooks, API services, React contexts
- `src/ai/` - Google Genkit AI integration

## Code Style Guidelines

### TypeScript Conventions

- **Strict mode enabled** in tsconfig.json with no build errors ignored
- Use `interface` for object shapes, `type` for primitives/unions
- Export all types from `src/lib/types.ts` for centralized type management
- Use generic types for reusable components: `interface Props<T>`
- Always type function parameters and return values explicitly
- Use `const` assertions for literal types: `const colors = ['red', 'blue'] as const`
- Prefer union types over enums for better TypeScript performance
- Use `z.infer<typeof schema>` for form data types after Zod validation

### Component Patterns

Always use `'use client'` directive for interactive components in Next.js App Router:

```typescript
'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface ComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary'
}

export const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('base-styles', variant === 'secondary' && 'secondary-styles', className)}
        {...props}
      />
    )
  }
)

Component.displayName = 'Component'
```

### Import Organization

Follow this strict order with empty lines between groups:

1. React and external libraries
2. Internal UI components (@/components/ui/*)
3. Feature components (@/components/*)
4. Hooks, utilities, and services
5. Types, constants, and config

### Naming Conventions

- **Components:** PascalCase (`UserProfile`, `DataTable`)
- **Files:** kebab-case (`user-profile.tsx`, `data-table.tsx`)
- **Functions/Variables:** camelCase (`fetchUserData`, `isLoading`)
- **Constants:** SCREAMING_SNAKE_CASE (`API_ROUTES`, `MAX_ITEMS`)
- **Types/Interfaces:** PascalCase (`UserData`, `ApiResponse`)
- **Custom Hooks:** `use` prefix (`useAuth`, `useLocalStorage`)

### Path Aliases

- `@/components/*` - All components (ui/, feature/, auth/, etc.)
- `@/lib/*` - Utilities, types, helpers, and static data
- `@/hooks/*` - Custom React hooks
- `@/services/*` - API services and external integrations

### Form Handling

Always use React Hook Form with Zod validation. Define schemas and use `z.infer<typeof schema>` for type safety.

### API Integration

- Use `@/services/api` for all API calls
- Define API response types in `@/lib/types.ts`
- Implement proper error handling and loading states
- **CRITICAL:** Never hardcode API routes - use constants from config files

### Internationalization

- Use `useTranslations` from next-intl
- Translations in `src/messages/[locale].json`
- Locale-based routing with `[locale]` dynamic segments
- **MANDATORY:** Every time new text is added to the application, add the respective translations for all supported languages in ALL language files (`src/messages/[locale].json`)

## Development Workflow

### Before Making Changes

1. Run `npm run typecheck` to ensure type safety
2. Run `npm run lint` to check code style
3. Review existing components in similar feature directories
4. Check `@/lib/types.ts` for relevant type definitions

### After Making Changes

1. **CRITICAL:** Run `npm run typecheck && npm run lint` to verify code quality - never commit without this
2. Test functionality manually in development server
3. **MANDATORY:** Add i18n keys and translations for all supported languages for any new user-facing text
4. Verify responsive design across different screen sizes

## Security Considerations

- Never expose API keys, tokens, or sensitive data in client code
- Validate all user inputs with Zod schemas before API calls
- Use environment variables for configuration (NEXT_PUBLIC_ prefix for client)
- Implement proper authentication checks and role-based access
- Sanitize data before rendering to prevent XSS attacks
- Use HTTPS for all external API calls

## Performance Guidelines

- Use `React.memo` for expensive components with stable props
- Implement proper loading states to prevent layout shifts
- Optimize bundle size with dynamic imports for large components
- Use Next.js built-in Image component for optimized images
- Consider virtualization (react-window) for long lists
- Memoize expensive calculations with `useMemo`
- Use `useCallback` for event handlers passed to child components
- Implement proper dependency arrays in hooks

## Additional Guidelines

### Theming

- Use `next-themes` for dark/light mode support
- Theme provider wraps the app in `src/components/theme-provider.tsx`
- Use CSS custom properties for theme values
- Support both system preference and manual theme selection

### Charts and Data Visualization

- Use Recharts for consistent chart implementations
- Define chart data types in `@/lib/types.ts`
- Implement responsive chart containers
- Use consistent color schemes across all charts

### Date and Time Handling

**MANDATORY:** Load and follow the `date-formatting` skill whenever you read, display, or send a date or datetime value.

- **Never** use `new Date(isoString).toLocaleString/toLocaleTimeString/toLocaleDateString()` — they apply local timezone offset to UTC strings, producing wrong results.
- **Never** use `format(parseISO(isoString), '...')` directly with a UTC ISO string — same problem.
- **Never** use `date.toISOString()` when sending dates to the backend — it shifts to UTC.
- All date utilities live in `src/lib/utils.ts`. Quick reference:
  - Display date + time → `formatDateTime(value)`
  - Display date only (UI) → `formatDisplayDate(value)`
  - Date in `yyyy-MM-dd` format → `formatDate(value)`
  - Send date to backend → `toLocalISOString(dateObject)`

## Sistema de Permisos y Control de Acceso

**IMPORTANTE:** Este proyecto implementa un sistema de permisos basado en roles. Antes de agregar, modificar o eliminar cualquier funcionalidad que involucre control de acceso, **DEBES cargar y usar el skill `permissions-protection`**.

### Cuándo Usar Este Skill

Usa el skill `permissions-protection` cuando:

1. **Crear nuevas páginas o rutas** que necesiten protección de acceso
2. **Agregar botones, acciones o elementos de UI** que deban mostrarse/ocultarse según permisos
3. **Modificar formularios o tablas** que contengan acciones condicionadas
4. **Trabajar con menús de navegación** (`src/config/nav.ts`)

### Archivos del Sistema de Permisos

- `src/context/AuthContext.tsx` - Proveedor de autenticación con permisos
- `src/hooks/usePermissions.ts` - Hook para verificar permisos en componentes
- `src/components/auth/Can.tsx` - Componente para renderizado condicional
- `src/components/auth/PrivateRoute.tsx` - Protección de rutas
- `src/lib/permissions.ts` - Utilitarios para filtrar menú
- `src/config/nav.ts` - Configuración del menú con permisos

### Códigos de Permiso

Los permisos se definen en el backend con códigos como:

- `CATALOG_MEDICATIONS_CREATE`, `CATALOG_MEDICATIONS_READ`, etc.
- `USUARIOS_VIEW_LIST`, `USUARIOS_CREATE`, `USUARIOS_EDIT`, `USUARIOS_DELETE`
- `ROLES_VIEW_LIST`, `ROLES_CREATE`, etc.

Para agregar permisos al menú o proteger rutas, consulta los códigos disponibles en el endpoint `/auth/me`.

## Available Skills

Este proyecto cuenta con skills especializados que debes cargar cuando trabajes en tareas específicas. Usa el comando `/load-skill` o la herramienta `skill` para activarlos.

### Cuándo Usar Cada Skill

| Skill | Cuándo Usarlo |
|-------|---------------|
| **frontend-design** | Cuando necesites crear interfaces de usuario de alta calidad, nuevos componentes, páginas completas, o mejorar el diseño existente. Genera código creativo y pulido evitando estéticos genéricos de IA. |
| **interface-design** | Para diseñar dashboards, paneles de admin, aplicaciones y herramientas interactivas. Especialmente útil para crear pantallas desde cero o redesigns importantes. |
| **vercel-react-best-practices** | Al escribir, revisar o refactorizar código React/Next.js. Optimiza patrones de rendimiento, uso de hooks, data fetching, y bundle optimization. Úsalo PROACTIVAMENTE en cualquier tarea de componentes o páginas. |
| **tailwind-v4-shadcn** | Cuando tengas problemas con Tailwind v4, shadcn/ui, colores que no funcionan, errores de `@theme`, problemas de dark mode, o al inicial el proyecto con esta tecnología. Sigue el patrón de 4 pasos: CSS variables, Tailwind mapping, base styles, dark mode automático. |
| **permissions-protection** | Ya documentado en la sección anterior. **SIEMPRE** cuando trabajes con control de acceso, permisos de usuario, o elementos de UI condicionales. |
| **date-formatting** | **SIEMPRE** cuando leas, muestres o envíes una fecha o datetime. Evita conversiones incorrectas de timezone con strings ISO UTC que vienen de la API. |

### Cómo Cargar un Skill

Cuando necesites usar un skill, ejecútalo con la herramienta `skill`:

```
Usa el skill "frontend-design" para crear el componente de login
```

### Orden de Preferencia

1. Primero carga `vercel-react-best-practices` para cualquier tarea de React/Next.js
2. Para diseño UI, carga `frontend-design` o `interface-design`
3. Para problemas de Tailwind/shadcn, carga `tailwind-v4-shadcn`
4. Para permisos, siempre usa `permissions-protection`

---

This file should be updated as the codebase evolves and new patterns are established.
