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
- `npm run lint` - Run ESLint for code linting
- `npm run typecheck` - Run TypeScript type checking without emitting files

### Testing
**Note:** No testing framework is currently configured. When adding tests, set up Jest or Vitest and add corresponding scripts.

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

### Directory Structure
```
src/
├── app/[locale]/          # Next.js App Router with i18n
├── components/
│   ├── ui/               # Reusable UI components (shadcn/ui)
│   └── [feature]/        # Feature-specific components
├── lib/
│   ├── types.ts          # Comprehensive type definitions
│   └── utils.ts          # Utility functions
├── hooks/                # Custom React hooks
├── services/             # API service layer
├── context/              # React context providers
├── ai/                   # AI integration with Genkit
├── constants/            # Configuration constants
├── config/               # Application configuration
└── messages/             # i18n translation files
```

## Code Style Guidelines

### TypeScript Conventions
- Use interfaces for object shapes and types for primitives/unions
- Export types from `src/lib/types.ts` for reusable domain types
- Use generic types for component props: `interface Props<T> { data: T }`
- Always type function parameters and return values
- Use `const` for type assertions when appropriate

### Component Patterns
```typescript
'use client' // Required for interactive components

import * as React from 'react'
import { cn } from '@/lib/utils'

interface ComponentProps {
  className?: string
  children?: React.ReactNode
}

export const Component: React.FC<ComponentProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn('default-classes', className)} {...props}>
      {children}
    </div>
  )
}
```

### Import Organization
```typescript
// 1. External libraries (React, third-party)
import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'

// 2. Internal UI components
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// 3. Hooks and utilities
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { api } from '@/services/api'

// 4. Types and constants
import { User, UserRole } from '@/lib/types'
import { API_ROUTES } from '@/constants/routes'
```

### Naming Conventions
- **Components:** PascalCase (`UserProfile`, `DataTable`)
- **Files:** kebab-case (`user-profile.tsx`, `data-table.tsx`)
- **Functions/Variables:** camelCase (`fetchUserData`, `isLoading`)
- **Constants:** SCREAMING_SNAKE_CASE (`API_ROUTES`, `MAX_ITEMS`)
- **Types/Interfaces:** PascalCase (`UserData`, `ApiResponse`)

### Path Aliases
- `@/components/*` - UI and feature components
- `@/lib/*` - Utilities, types, and helpers
- `@/hooks/*` - Custom React hooks
- `@/services/*` - API and external services
- `@/context/*` - React context providers
- `@/constants/*` - Configuration constants

### UI Component Guidelines
- Use Shadcn/ui components as base (`@/components/ui/*`)
- Extend components with Class Variance Authority (CVA) for variants
- Follow Radix UI patterns for accessibility
- Use `cn()` utility for conditional class merging
- Implement forward refs for interactive components

### Form Handling
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

type FormData = z.infer<typeof schema>

export const MyForm = () => {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  })
}
```

### API Integration
- Use centralized API service from `@/services/api`
- Implement proper error handling with try-catch blocks
- Use async/await patterns consistently
- Handle loading states and error boundaries

### Internationalization
- Use `useTranslations` from next-intl for all user-facing text
- Organize translation keys by feature: `users.title`, `users.actions.create`
- Store translations in `src/messages/[locale].json`
- Use locale-based routing with `[locale]` dynamic segments

### Error Handling
- Implement error boundaries for component-level error handling
- Use toast notifications for user feedback (`@/hooks/use-toast`)
- Log errors appropriately without exposing sensitive data
- Provide fallback UIs for error states

### AI Integration
- AI flows are implemented in `src/ai/` directory
- Use Google Genkit for AI processing
- Keep AI logic server-side when possible
- Implement proper error handling for AI responses

## Development Workflow

### Before Making Changes
1. Run `npm run typecheck` to ensure type safety
2. Run `npm run lint` to check code style
3. Understand existing patterns in similar components

### After Making Changes
1. Run typecheck and lint to verify code quality
2. Test functionality manually in development
3. Ensure i18n keys are added for new user-facing text

### Code Review Checklist
- [ ] TypeScript types are properly defined
- [ ] Import organization follows conventions
- [ ] Component uses established patterns
- [ ] Error handling is implemented
- [ ] Internationalization is considered
- [ ] Accessibility follows Radix UI patterns
- [ ] Code follows existing naming conventions

## Security Considerations
- Never expose API keys or sensitive data
- Validate all user inputs with Zod schemas
- Use environment variables for configuration
- Implement proper authentication checks
- Sanitize data before rendering

## Performance Guidelines
- Use React.memo for expensive components
- Implement proper loading states
- Optimize bundle size with dynamic imports
- Use Next.js built-in optimizations
- Consider virtualization for long lists

This file should be updated as the codebase evolves and new patterns are established.