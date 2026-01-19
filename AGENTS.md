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

### Testing

**Note:** No testing framework is currently configured. When adding tests:

1. Set up Jest or Vitest with React Testing Library
2. Add test scripts to package.json:
   - `npm run test` - Run all tests
   - `npm run test:watch` - Run tests in watch mode
   - `npm run test:coverage` - Run tests with coverage report
3. For running a single test file: `npm run test -- path/to/test.spec.ts`
4. For running a specific test pattern: `npm run test -- --testNamePattern="test name"`
5. For running tests in a directory: `npm run test -- src/components/ui/`
6. Test files should be named `*.test.ts`, `*.spec.ts`, or `*.test.tsx` and placed next to the component they test

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

- Use `date-fns` for date manipulation and formatting
- Store dates as ISO strings in API communications
- Use consistent date formats across the application
- Handle timezone considerations for international users

This file should be updated as the codebase evolves and new patterns are established.
