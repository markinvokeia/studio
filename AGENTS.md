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
4. Test files should be named `*.test.ts` or `*.spec.ts` and placed next to the component they test

## Project Architecture

### Tech Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript (strict mode enabled)
- **Styling:** Tailwind CSS with Shadcn/ui components
- **State Management:** React Context, useState, useReducer
- **Forms:** React Hook Form with Zod validation
- **Internationalization:** next-intl
- **AI Integration:** Google Genkit
- **UI Components:** Radix UI primitives with custom variants
- **Theming:** next-themes for dark/light mode support
- **Charts:** Recharts for data visualization

### Directory Structure

```
src/
├── app/[locale]/              # Next.js App Router with i18n routing
│   ├── (auth)/                # Auth route groups
│   ├── (dashboard)/           # Dashboard route groups
│   └── globals.css            # Global styles
├── components/
│   ├── ui/                   # Shadcn/ui reusable components
│   ├── [feature]/            # Feature-specific components
│   ├── auth/                 # Authentication components
│   ├── dashboard/            # Dashboard components
│   ├── users/                # User management components
│   ├── calendar/             # Calendar components
│   └── charts/               # Chart components
├── lib/
│   ├── types.ts              # Comprehensive type definitions (690+ lines)
│   ├── utils.ts              # Utility functions (cn helper)
│   ├── countries.ts          # Country data utilities
│   └── data.ts               # Static data and constants
├── hooks/                    # Custom React hooks
├── services/                 # API service layer
├── context/                  # React context providers
├── ai/                       # Google Genkit AI integration
│   ├── flows/                # AI workflow implementations
│   └── genkit.ts             # AI configuration
├── constants/                # Configuration constants
├── config/                   # Application configuration
├── messages/                 # i18n translation files (en.json, es.json)
├── middleware.ts             # Next.js middleware
└── i18n.ts                   # Internationalization configuration
```

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
        className={cn(
          'base-styles',
          variant === 'secondary' && 'secondary-styles',
          className
        )}
        {...props}
      />
    )
  }
)

Component.displayName = 'Component'
```

### Import Organization

Follow this strict order with empty lines between groups:

```typescript
// 1. React and external libraries
import * as React from 'react'
import { useState, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// 2. Internal UI components (@/components/ui/*)
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// 3. Feature components (@/components/*)
import { UserProfile } from '@/components/users/user-profile'

// 4. Hooks, utilities, and services
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { api } from '@/services/api'

// 5. Types, constants, and config
import { User, UserRole } from '@/lib/types'
import { API_ROUTES } from '@/constants/routes'
import { siteConfig } from '@/config/site'
```

### Naming Conventions

- **Components:** PascalCase (`UserProfile`, `DataTable`)
- **Files:** kebab-case (`user-profile.tsx`, `data-table.tsx`)
- **Functions/Variables:** camelCase (`fetchUserData`, `isLoading`)
- **Constants:** SCREAMING_SNAKE_CASE (`API_ROUTES`, `MAX_ITEMS`)
- **Types/Interfaces:** PascalCase (`UserData`, `ApiResponse`)
- **Custom Hooks:** `use` prefix (`useAuth`, `useLocalStorage`)
- **Context:** PascalCase with `Context` suffix (`AuthContext`)
- **Providers:** PascalCase with `Provider` suffix (`ThemeProvider`)

### Path Aliases

- `@/components/*` - All components (ui/, feature/, auth/, etc.)
- `@/lib/*` - Utilities, types, helpers, and static data
- `@/hooks/*` - Custom React hooks
- `@/services/*` - API services and external integrations
- `@/context/*` - React context providers
- `@/constants/*` - Configuration constants and routes
- `@/config/*` - Application configuration files
- `@/messages/*` - Internationalization files

### UI Component Guidelines

- **Base Components:** Always use Shadcn/ui components from `@/components/ui/*`
- **Variants:** Extend with Class Variance Authority (CVA) for consistent styling
- **Accessibility:** Follow Radix UI patterns with proper ARIA attributes
- **Styling:** Use `cn()` utility for conditional class merging
- **Forward Refs:** Implement for interactive components to support ref forwarding
- **Compound Components:** Use Radix patterns for complex component relationships

### Form Handling

Always use React Hook Form with Zod validation:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export const UserForm = () => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      // Handle form submission
    } catch (error) {
      // Handle error
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  )
}
```

### API Integration

- **Centralized Service:** Use `@/services/api` for all API calls
- **Error Handling:** Implement try-catch with proper error types
- **Loading States:** Use React state or SWR/React Query for async operations
- **Response Types:** Define API response types in `@/lib/types.ts`
- **Authentication:** Include auth tokens automatically via interceptors

### Internationalization

- **Hook Usage:** Always use `useTranslations` from next-intl
- **Key Organization:** Feature-based keys (`users.title`, `dashboard.stats.revenue`)
- **File Structure:** Translations in `src/messages/[locale].json`
- **Routing:** Locale-based routing with `[locale]` dynamic segments
- **Fallback:** Provide fallback text for missing translations

### Error Handling

- **Boundaries:** Implement `ErrorBoundary` components for crash recovery
- **User Feedback:** Use `@/hooks/use-toast` for notifications
- **Logging:** Log errors without exposing sensitive data
- **Fallback UI:** Provide meaningful fallback states for failed operations
- **Type Safety:** Define custom error types extending Error

### AI Integration

- **Location:** AI logic in `src/ai/` directory
- **Framework:** Google Genkit for AI processing
- **Architecture:** Keep AI logic server-side when possible
- **Error Handling:** Implement proper error handling for AI responses
- **Flows:** Modular flow implementations in `src/ai/flows/`

## Development Workflow

### Before Making Changes

1. Run `npm run typecheck` to ensure type safety
2. Run `npm run lint` to check code style
3. Review existing components in similar feature directories
4. Check `@/lib/types.ts` for relevant type definitions

### After Making Changes

1. Run `npm run typecheck && npm run lint` to verify code quality
2. Test functionality manually in development server
3. Ensure i18n keys are added for new user-facing text
4. Verify responsive design across different screen sizes

### Code Review Checklist

- [ ] TypeScript types are properly defined and exported from `@/lib/types.ts`
- [ ] Import organization follows the established order
- [ ] Component follows established patterns with proper forward refs
- [ ] Error handling is implemented with user-friendly feedback
- [ ] Internationalization keys are added for user-facing text
- [ ] Accessibility follows Radix UI patterns
- [ ] Code follows naming conventions consistently
- [ ] Responsive design is considered for mobile/tablet/desktop
- [ ] Dark mode support is implemented where applicable

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
