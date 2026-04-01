---
paths:
  - "src/**"
  - "**/*.tsx"
  - "**/*.ts"
---

# React/TypeScript Conventions

## Language & Framework
- React 19 with functional components and hooks
- TypeScript strict mode enabled
- TanStack Router for routing (file-based routes in `src/routes/`)
- Zustand for global state management
- Zod 4 for schema validation
- React Hook Form for form handling

## Code Style
- Formatter: Prettier
- Linter: ESLint with react-hooks and react-refresh plugins
- File naming: lowercase-with-dashes (`exercise-filter-bar.tsx`)
- Component naming: PascalCase in code (`ExerciseFilterBar`)
- Composables/hooks: `use-[name].ts` files, `use[Name]` exports

## Component Patterns
- Props: TypeScript interfaces, destructured in function signature
- State: `useState` for local, Zustand stores for shared
- Side effects: `useEffect` with proper dependency arrays and cleanup
- Memoization: `useMemo`/`useCallback` only when profiling shows need
- No class components in new code

## UI & Styling
- Tailwind CSS 4 utility classes (no `@apply` unless extracting to component)
- shadcn/ui components via radix-ui primitives
- Lucide React + Material Symbols for icons
- class-variance-authority for component variants
- `cn()` helper (clsx + tailwind-merge) for conditional classes

## Data Fetching
- TanStack Query for server state (`useQuery`, `useMutation`)
- Supabase client via `@supabase/supabase-js`
- Query keys follow `[domain, action, params]` pattern
- Mutations invalidate relevant queries on success

## Testing
- Framework: Vitest + Testing Library + happy-dom
- Test files: colocated `__tests__/[name].test.tsx`
- MSW for API mocking
- Test behavior and user interactions, not implementation details
- `userEvent` over `fireEvent` for realistic interactions

## Accessibility
- All images need `alt` attributes
- Interactive elements must be keyboard accessible
- Icon-only buttons need `aria-label`
- Form inputs need associated labels
- Color is never the sole indicator of state
