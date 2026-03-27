# Repository Primer

## What This Repo Is

Ardent Forge is a universal workout logging and programming application that supports the full spectrum of training methodologies -- from percentage-based barbell periodization to CrossFit-style WODs, rucking, running, and everything in between. The core differentiator is a first-class **prescription model** (a discriminated union of 12+ distinct set scheme types) that can faithfully represent any training methodology without forcing one paradigm onto another. The app targets tactical athletes, concurrent training practitioners, and general strength trainees who need one app for all modalities.

The project is in early development (single initial commit) with routing, UI primitives, and styling infrastructure scaffolded. Product features have not yet been implemented.

## Product / Feature Structure

Planned routes and features per the architecture docs:

| Feature / Module    | Route / Entry Point | Description                                              |
| ------------------- | ------------------- | -------------------------------------------------------- |
| **Today**           | `/`                 | Today's programmed session or quick-start workout        |
| **Active Workout**  | `/log/:workoutId`   | Live workout logging with pre-filled sets and rest timer |
| **Programs**        | `/programs`         | Browse and manage structured training programs           |
| **Program Builder** | `/programs/builder` | Drag-drop editor for blocks, weeks, and sessions         |
| **History**         | `/history`          | Past workout list with per-exercise drill-down           |
| **Dashboard**       | `/dashboard`        | Analytics: volume, PRs, 1RM progression charts           |
| **Profile**         | `/profile`          | User settings, 1RMs, bodyweight, unit preferences        |

### Key Domain Concepts

- **SetScheme** (discriminated union): FixedSets, PercentageSets, WorkToMax, TimedHold, ForReps, CardioSteadyState, CardioInterval, RuckMarch, EMOM, AMRAPTimed, DescendingReps, PercentageOfMaxReps
- **Program hierarchy**: Program > Block > BlockWeek > ScheduledSession > SessionTemplate > ActivityGroup > Activity
- **Workout hierarchy**: WorkoutLog > LoggedActivityGroup > LoggedActivity > LoggedSet
- **Prescribed vs Actual**: Every LoggedSet stores what the program prescribed alongside what the user actually did

## Tech Stack

### Core Framework

- **React 19** with JSX transform (`react-jsx`)
- **TypeScript ~5.9** in strict mode (ES2023 target)
- **Vite 8** dev server and bundler
- **TanStack Router** with file-based routing and auto code-splitting
- **TanStack Query** for server/local data fetching, caching, and mutations
- **Bun** package manager (`bun.lock`)

### Project Structure

```
src/
  components/ui/    # shadcn/ui primitives (Button, Card)
  lib/              # Utilities (cn helper)
  routes/           # TanStack file-based routes (__root.tsx, index.tsx)
  routeTree.gen.ts  # Auto-generated route tree (do not edit)
  main.tsx          # App entry point
  index.css         # Tailwind + shadcn theme tokens
  App.tsx           # Vite starter page (likely to be replaced)
docs/               # Product specs, domain model, architecture docs
```

### Database

- **SQLite** (via Rust/sqlx) as local offline-first source of truth in Tauri mode
- **Supabase PostgreSQL** as cloud database with Row Level Security
- Bidirectional sync engine: SQLite <> Supabase with last-write-wins conflict resolution
- In browser-only mode, the app talks directly to Supabase (no SQLite)

### Authentication

- **Supabase Auth** -- JWT-based sessions with email and OAuth providers
- RLS policies enforce `user_id = auth.uid()` on all tables
- Group/coach access via RLS joins on `group_members` and `direct_connections` tables

### Payments / Billing

None planned in current specs.

### Analytics / Monitoring

None configured yet. The app will surface training analytics (volume, PRs, 1RM progression) to the user, but no external analytics or error tracking tools are specified.

### Styling

- **Tailwind CSS 4** via `@tailwindcss/vite` plugin
- **shadcn/ui** components in `src/components/ui/` (using Radix UI primitives)
- **tw-animate-css** for animation utilities
- **Inter Variable** as the default sans-serif font
- Design tokens defined as CSS custom properties in `src/index.css` with oklch colors
- Light and dark theme support via `.dark` class variant
- Responsive layout: bottom tab nav on mobile (< 768px), sidebar nav on desktop (>= 1024px)
- Touch targets >= 48px for gym use with sweaty/gloved hands

### Key Architectural Decisions

- **Offline-first** -- all features must work without network connectivity; SQLite is the source of truth in Tauri mode, sync happens async
- **Tauri v2 cross-platform** -- one React app wrapped by Tauri for Android, iOS, and desktop; same app runs standalone in browser against Supabase
- **Data adapter pattern** -- unified data interface with Tauri adapter (invoke() to Rust) and Supabase adapter (direct client); switches based on runtime environment
- **TanStack Router over React Router** -- file-based routing with `@tanstack/router-plugin/vite`; route tree is auto-generated into `src/routeTree.gen.ts`
- **Zustand for active workout state** -- ephemeral in-memory state for the live workout session; TanStack Query for all persisted server state
- **Domain layer as pure TypeScript** -- canonical types, Zod schemas, and pure calculation functions (% to weight, plate calculator, PR detection) shared by all layers
- **Rust as local SDK, not API server** -- handles SQLite, sync engine, background rest timer, push notifications, and file export
- **Path alias** -- `@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.json`)
- **React Hook Form + Zod** -- form handling with schema validation via `@hookform/resolvers`
- **Recharts** -- charting library for analytics dashboard
- **dnd-kit** -- drag-and-drop for the program builder (`@dnd-kit/core` + `@dnd-kit/sortable`)

## Important Paths

| Path                             | Purpose                                                |
| -------------------------------- | ------------------------------------------------------ |
| `src/main.tsx`                   | App entry point, creates router and renders to DOM     |
| `src/routes/`                    | TanStack file-based route definitions                  |
| `src/routeTree.gen.ts`           | Auto-generated route tree (never edit manually)        |
| `src/components/ui/`             | shadcn/ui component primitives                         |
| `src/lib/utils.ts`               | `cn()` classname merge utility                         |
| `src/index.css`                  | Tailwind config, theme tokens, base styles             |
| `vite.config.ts`                 | Vite + TanStack Router + Tailwind plugin config        |
| `eslint.config.js`               | ESLint flat config with TS + React rules               |
| `.prettierrc`                    | Prettier config (no semi, single quotes, 100 width)    |
| `docs/00-project-overview.md`    | Product philosophy, design principles, target users    |
| `docs/01-prd-core.md`            | Core workout logging requirements and use cases        |
| `docs/02-prd-sharing.md`         | Sharing, accountability groups, coaching features      |
| `docs/05-domain-model.md`        | Domain entities, aggregates, value objects, enums      |
| `docs/06-invariants.md`          | Business rules and constraints                         |
| `docs/07-architecture.md`        | System architecture, data flow, layer responsibilities |
| `docs/08-erd.md`                 | Entity-relationship diagrams                           |
| `docs/09-state-machines.md`      | Lifecycle and state diagrams                           |
| `docs/10-user-flows.md`          | User journey and interaction flows                     |
| `docs/11-notification-design.md` | Notification system design                             |
| `docs/implementation-plan.md`    | Implementation roadmap                                 |

## Build Commands

```bash
# Development
bun run dev               # Start Vite dev server with HMR

# Linting
bun run lint              # ESLint across the project

# Production
bun run build             # TypeScript check + Vite production build
bun run preview           # Preview the production build locally

# Future (Tauri -- not yet configured)
# tauri dev                 # Dev server with Tauri shell
# tauri android build       # Android APK/AAB
# tauri ios build           # iOS IPA
# tauri build               # Desktop binary
```

## Environment Variables

**Required for build:**

None -- the app builds without any environment variables.

**Required for full functionality:**

- Supabase project URL and anon key (once Supabase integration is added)

**Optional:**

- Check `.env.local` for any local overrides.

## Common Gotchas

1. **Route tree is generated** -- `src/routeTree.gen.ts` is auto-generated by the TanStack Router Vite plugin. Never edit it manually; add/remove files in `src/routes/` instead.
2. **Plugin order matters** -- In `vite.config.ts`, `tanstackRouter()` must come before `react()`.
3. **Import alias** -- Use `@/` for `src/` imports. Both Vite and TypeScript are configured for this.
4. **App.tsx is the Vite starter** -- `src/App.tsx` is the default Vite+React template page and is not currently used by the router. The actual UI entry flows through `src/routes/__root.tsx`.
5. **SetScheme is a discriminated union** -- when implementing set scheme types, each variant has its own distinct schema. Never shoehorn one type into another's fields.
6. **Prescribed vs Actual separation** -- every LoggedSet must maintain both what was prescribed and what actually happened. Never conflate these.
7. **Offline-first constraint** -- all logging features must function without network. Design data flows to write locally first, sync async.

## Workflows

Project is in early scaffolding phase. No CI/CD, testing, or branching conventions established yet.

The planned implementation phases from the docs:

1. **Phase 1** -- Core workout logging (ad-hoc sessions, set logging, exercise dictionary, rest timer)
2. **Phase 2** -- Program management (program builder, block/week/session structure, pre-filled sets from programs)
3. **Phase 3** -- Analytics and progress tracking (1RM progression, volume charts, PR detection)
4. **Sharing** -- Accountability groups, direct connections, coach write access, share links

## Notes

- The project uses Bun as its package manager but Vite as its bundler (not Bun's built-in bundler).
- shadcn CLI (`shadcn`) is included as a dependency for adding new UI components: `bunx shadcn add <component>`.
- Tauri v2 integration is planned but not yet configured in the repo. The current codebase is browser-only React.
- The Rust backend (SQLite, sync engine, background services) will be added when Tauri is integrated.
- The `docs/` folder contains comprehensive product specs -- always consult these before implementing features to ensure domain model fidelity.
