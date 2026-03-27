# Ardent Forge — Implementation Plan

**Purpose:** Step-by-step feature-based build order for spec-driven development with Claude Code. Each step references the relevant docs, lists its dependencies, and defines its "done" criteria.

**Key Constraint:** Solo developer using AI coding agents heavily. Steps are scoped so each is a self-contained prompt-friendly unit with clear inputs, outputs, and validation criteria.

**Stack:** Tauri v2 + React + TypeScript + Rust + Supabase. One React app serves all platforms (Android, iOS, desktop, web browser). Bun as package manager and runtime.

**Critical Architecture Decision:** Phase 0 builds a browser-only React app against Supabase. Phase 1 wraps it in Tauri and adds the Rust/SQLite backend. This means the React app must be designed from day one to work through a data adapter that can switch between Supabase (browser) and Tauri commands (native).

**Design System:** "Iron & Ember" — Industrial Brutalism aesthetic. Dark-only, zero border-radius, tonal depth via surface layering, dual-font (Space Grotesk + Inter). Full spec in `DESIGN.md`.

---

## Dependency Graph (Visual)

```
                        ┌──────────────────────────────────┐
                        │  STEP 1: Project Scaffold         │
                        │  React + Vite + TanStack          │
                        └──────────┬───────────────────────┘
                                   │
                        ┌──────────┴───────────────────────┐
                        │  STEP 1.5: Design System          │
                        │  "Iron & Ember" + shadcn overrides│
                        └──────────┬───────────────────────┘
                                   │
                          ┌────────┴────────┐
                          ▼                 ▼
                 ┌──────────────┐   ┌──────────────────┐
                 │ STEP 2:      │   │ STEP 3:          │
                 │ Domain Types │   │ Supabase Setup   │
                 │ + Zod        │   │ (PARALLEL)       │
                 │              │   │                  │
                 └──────┬───────┘   │ 3a. Project +    │
                        │           │     Auth         │
                        │           │ 3b. Schema +     │
                        │           │     Migrations   │
                        │           │ 3c. RLS Policies │
                        │           └────────┬─────────┘
                        │                    │
                        └────────┬───────────┘
                                 ▼
                        ┌──────────────┐
                        │ STEP 4:      │
                        │ Data Adapter │
                        │ + Supabase   │
                        │ Adapter      │
                        └──────┬───────┘
                               │
                      ┌────────┼────────┐
                      ▼                 ▼
               ┌───────────┐     ┌───────────┐
               │ STEP 5:   │     │ STEP 6:   │
               │ Exercise  │     │ Active    │
               │ Dictionary│     │ Workout   │
               │ + 1RMs    │     │ Logging   │
               └─────┬─────┘     └─────┬─────┘
                     │                  │
                     └────────┬─────────┘
                              ▼
                     ┌──────────────┐
                     │ STEP 7:      │
                     │ Workout      │
                     │ History      │
                     └──────┬───────┘
                            │
      ══════════════════════╪═══════════════════════
       Phase 0 Complete     │   Browser MVP working
      ══════════════════════╪═══════════════════════
                            │
                     ┌──────────────┐
                     │ STEP 8:      │
                     │ Tauri Shell  │
                     │ + Rust/SQLite│
                     │ + Tauri      │
                     │   Adapter    │
                     └──────┬───────┘
                            │
                     ┌──────────────┐
                     │ STEP 9:      │
                     │ Sync Engine  │
                     │ + Rest Timer │
                     │ (Rust)       │
                     └──────┬───────┘
                            │
      ══════════════════════╪═══════════════════════
       Phase 1 Complete     │   GO / NO-GO on Tauri
      ══════════════════════╪═══════════════════════
                            │
               ┌────────────┼───────────┐
               ▼            ▼           ▼
        ┌───────────┐ ┌───────────┐ ┌───────────┐
        │ STEP 10:  │ │ STEP 11:  │ │ STEP 12:  │
        │ Session   │ │ Program   │ │ Program   │
        │ Templates │ │ Structure │ │ Builder   │
        │ + SetSchm │ │ Blocks/   │ │ (DnD UI)  │
        │           │ │ Weeks     │ │           │
        └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                      ┌───────────┐
                      │ STEP 13:  │
                      │ Programmed│
                      │ Workout   │
                      │ Logging   │
                      └─────┬─────┘
                            │
      ══════════════════════╪═══════════════════════
       Phase 2 Complete     │   Programs + Templates
      ══════════════════════╪═══════════════════════
                            │
               ┌────────────┼───────────┐
               ▼            ▼           ▼
        ┌───────────┐ ┌───────────┐ ┌───────────┐
        │ STEP 14:  │ │ STEP 15:  │ │ STEP 16:  │
        │ Progress  │ │ Notif.    │ │ Share     │
        │ + PR      │ │ System    │ │ Links     │
        │ Analytics │ │           │ │           │
        └───────────┘ └───────────┘ └─────┬─────┘
                                          │
                                   ┌──────┴──────┐
                                   ▼             ▼
                            ┌───────────┐ ┌───────────┐
                            │ STEP 17:  │ │ STEP 18:  │
                            │ Account-  │ │ Coach     │
                            │ ability   │ │ Write     │
                            │ Groups    │ │ Access    │
                            └───────────┘ └───────────┘
```

---

## Parallel Tracks

| Track A: React App (browser) | Track B: Supabase | Track C: Tauri + Rust |
| ---------------------------- | ----------------- | --------------------- |
| Steps 1–1.5–2, 4–7           | Step 3 (< 1 day)  | Steps 8–9             |

Supabase setup (Track B) is a console-click + migration exercise. The real work is Track A (building the app) and Track C (wrapping it in Tauri with offline support).

**Critical path to browser MVP:** Steps 1 → 1.5 → 2/3 → 4 → 5 → 6 → 7 (~13 days)
**Critical path to Tauri GO/NO-GO:** Steps 1–7 → 8 → 9 (~18.5 days)
**Critical path to programmed workouts:** Steps 1–9 → 10 → 11 → 12 → 13 (~27 days)

---

## STEP 1: Project Scaffold ✅ COMPLETE

**Dependencies:** None
**Priority:** P0
**Docs:** `07-architecture.md` §High-Level Architecture

### What was built

- Vite + React 19 + TypeScript project (scaffolded with `bun create vite`)
- TanStack Router with file-based routing via `@tanstack/router-plugin` Vite plugin
- TanStack Query provider
- Zustand store skeleton
- shadcn/ui setup (Radix + Vega preset) + Tailwind CSS 4 (CSS-first, no `tailwind.config.ts`)
- ESLint + Prettier configuration
- Environment variable setup (Supabase URL, publishable key)

### Project skeleton

```
ardent-forge/
├── src/
│   ├── routes/
│   │   ├── __root.tsx          # Root layout
│   │   └── index.tsx           # Today screen (empty shell)
│   ├── components/
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── data-adapter.ts     # Interface (empty)
│   │   └── utils.ts
│   ├── domain/
│   │   └── types/              # Built in Step 2
│   ├── hooks/
│   ├── stores/
│   │   └── active-workout.ts   # Zustand skeleton
│   ├── main.tsx
│   └── index.css               # Tailwind v4 + theme tokens
├── src-tauri/                  # Created in Step 8 (not now)
├── supabase/                   # CLI + migrations
├── package.json
├── vite.config.ts
├── tsconfig.json
├── components.json             # shadcn/ui config
└── .env.local                  # VITE_SUPABASE_URL, VITE_SUPABASE_PUB_KEY
```

### Key dependency versions (as installed)

| Library              | Purpose                         |
| -------------------- | ------------------------------- |
| React 19             | UI framework                    |
| Vite (latest stable) | Build tool                      |
| TanStack Router      | File-based routing              |
| TanStack Query       | Server state management         |
| Zustand              | Client state (active workout)   |
| shadcn/ui (Radix)    | Component library               |
| Tailwind CSS 4       | Styling (CSS-first config)      |
| Zod                  | Runtime validation              |
| React Hook Form      | Form handling                   |
| dnd-kit              | Drag and drop (used in Step 12) |
| Recharts             | Charts (used in Step 14)        |
| Bun                  | Package manager + runtime       |

### Done ✅

- [x] `bun run dev` launches app in browser
- [x] TanStack Router renders empty index route
- [x] shadcn/ui Button component renders correctly
- [x] TanStack Query provider wraps app
- [x] Zustand store creates and reads a test value
- [x] Environment variables load correctly
- [x] ESLint + Prettier pass on all files
- [x] Production build succeeds (`bun run build`)

---

## STEP 1.5: Design System Integration — "Iron & Ember" ✅ COMPLETE

**Dependencies:** Step 1 (project scaffold with shadcn/ui installed), `DESIGN.md`
**Priority:** P0
**Docs:** `DESIGN.md` (full design system spec)
**Estimated effort:** 1 day

> **Why this step exists:** The DESIGN.md spec requires full overrides of shadcn/ui defaults — zero border-radius, no shadows, underline inputs, custom color tokens, dual-font system, and a dark-only theme. Doing this before any feature UI work prevents compounding style debt across Steps 4–18.

### What to build

- Tailwind CSS 4 theme tokens mapped from DESIGN.md color palette
- Dual-font setup: Space Grotesk (headlines) + Inter (body)
- Material Symbols Outlined icon setup (alongside Lucide for shadcn internals)
- Global style overrides: scrollbar, no-line rule, frosted glass utilities
- shadcn component overrides: buttons, cards, inputs, badges, dialogs, navigation
- Responsive layout shell: mobile bottom nav + desktop sidebar
- All route shells for navigation targets

### 1.5a. Tailwind CSS 4 Theme Tokens

Map every token from DESIGN.md §2 into CSS custom properties and register them with Tailwind's `@theme inline` directive in `src/index.css`.

**Surface Hierarchy — "The Milled Block":**

| Token              | Hex       | Role                                     |
| ------------------ | --------- | ---------------------------------------- |
| `surface-pit`      | `#0E0E0E` | Deepest recess. Nav trays, sidebar bg.   |
| `surface-anvil`    | `#131313` | Primary canvas. Default page background. |
| `surface-charcoal` | `#1C1B1B` | Alternating row stripes in data tables.  |
| `surface-iron`     | `#201F1F` | Card backgrounds, content sections.      |
| `surface-gunmetal` | `#2A2A2A` | Active form fields, elevated modules.    |
| `surface-steel`    | `#353534` | Timers, active set cards, scrollbar.     |
| `surface-slag`     | `#393939` | Floating overlays, surface highlights.   |

**Primary — "Molten" Accent:**

| Token      | Hex       | Role                                    |
| ---------- | --------- | --------------------------------------- |
| `ember`    | `#FFB59C` | Text accents, active underlines, icons. |
| `forge`    | `#FB5C1C` | High-impact CTA backgrounds.            |
| `on-ember` | `#5C1900` | Text on primary surfaces.               |
| `on-forge` | `#511500` | Text on CTA backgrounds.                |

**Secondary, Tertiary, Error, Text:** Full mapping in `DESIGN.md` §2. All tokens mapped to both Iron & Ember names and shadcn compatibility variables (`--background`, `--primary`, `--card`, etc.).

**Critical overrides:**

| Property     | Value         | Rationale                               |
| ------------ | ------------- | --------------------------------------- |
| `--radius`   | `0px`         | The Hard Edge Rule — no rounded corners |
| `--border`   | Ghost         | 15% opacity `outline-variant` only      |
| Font display | Space Grotesk | Headlines, numbers, readouts            |
| Font body    | Inter         | Body text, labels, data tables          |

### 1.5b. Font Setup

Fonts loaded via Google Fonts `@import` in CSS. Tailwind tokens: `--font-display` (Space Grotesk), `--font-body` (Inter).

Usage: `font-display` for headlines/numbers/readouts, `font-body` for body/labels/data.

Custom utility classes for typography scale: `.text-readout` (3.5rem Space Grotesk), `.text-industrial` (uppercase, 5% letter-spacing).

### 1.5c. Material Symbols Setup

```bash
bun add material-symbols
```

Material Symbols Outlined for app-level icons. Lucide remains for shadcn component internals only.

Create `src/components/icon.tsx` — wrapper component with `name`, `size`, `fill` props and correct `fontVariationSettings`.

Key icons from DESIGN.md: `fitness_center`, `timer`, `menu_book`, `inventory_2`, `cloud_done`, `precision_manufacturing`, `grid_view`, `construction`, `monitoring`, `library_books`, `settings`, `check_circle`, `open_with`, `drag_indicator`, `add`.

### 1.5d. shadcn Component Overrides

Override every shadcn component in `src/components/ui/` to match DESIGN.md spec:

**Button variants:**

| Variant       | Background               | Text      | Notes                  |
| ------------- | ------------------------ | --------- | ---------------------- |
| `default`     | `#FB5C1C` (forge)        | `#511500` | High-contrast CTA      |
| `molten`      | Molten gradient (135deg) | `#511500` | New variant — hero CTA |
| `secondary`   | `#334A55` (deep-slate)   | `#A0B9C5` | Supporting actions     |
| `ghost`       | Transparent              | `#FFB59C` | ALL-CAPS text-only     |
| `destructive` | `#93000A`                | `#FFDAD6` | Destructive actions    |

All: 0px radius, no shadows, no transitions. Active: `filter: brightness(1.25)`.

**Input fields:** Convert to underline-only (no boxed borders). Default: no border, `surface-gunmetal` bg. Focus: 2px bottom bar in `ember`. Error: `error` text with `surface-steel` bg.

**Cards:** 0px radius, `surface-iron` bg, no borders (no-line rule), no shadows. Optional `.milled-edge` for top-edge definition.

**Badges:** Flat rectangles, 0px radius, ALL-CAPS. COMPLETE: `forge` bg. PENDING: `surface-steel` bg.

**Dialogs/Sheets:** 0px radius, `surface-iron` or `surface-gunmetal` bg, heat-blur overlay.

**Tables:** ALL-CAPS headers in `label-medium` Inter. Alternating rows `surface-charcoal`/`surface-anvil`. Ghost borders only for accessibility. Header vocabulary: SET, PRESCRIBED, ACTUAL, VARIANCE, STATUS.

### 1.5e. Layout Shell

**Mobile (< 768px) — Bottom navigation:**

| Tab     | Icon            | Route      |
| ------- | --------------- | ---------- |
| FORGE   | `construction`  | `/`        |
| TRACKER | `timer`         | `/tracker` |
| LIBRARY | `library_books` | `/library` |
| VAULT   | `monitoring`    | `/vault`   |

Background: `surface-pit`. Active: `ember`. Touch targets ≥ 48px. Fixed bottom with heat-blur. Labels: ALL-CAPS `label-small`.

**Desktop (≥ 1024px) — Left sidebar:**

| Item            | Icon                      | Route       |
| --------------- | ------------------------- | ----------- |
| DASHBOARD       | `grid_view`               | `/`         |
| PROGRAM BUILDER | `precision_manufacturing` | `/builder`  |
| ANALYTICS       | `monitoring`              | `/vault`    |
| LIBRARY         | `library_books`           | `/library`  |
| SETTINGS        | `settings`                | `/settings` |

Background: `surface-pit`. Collapsed: 64px icon-only. Expanded: 240px icon+text.

### 1.5f. Route Shells

Create empty route files for all navigation targets:

```
src/routes/
├── __root.tsx          # Root layout with responsive nav
├── index.tsx           # FORGE / Dashboard
├── tracker.tsx         # Active workout (empty shell)
├── library.tsx         # Program library (empty shell)
├── vault.tsx           # Analytics / 1RM (empty shell)
├── builder.tsx         # Program builder — desktop (empty shell)
└── settings.tsx        # Settings (empty shell)
```

### 1.5g. Global Styles

- Scrollbar: 4px narrow, `surface-steel` thumb, `forge` hover
- Heat-blur: `rgba(19,19,19,0.8)` + `backdrop-filter: blur(20px)` utility class
- Molten gradient: `linear-gradient(135deg, #FFB59C 0%, #FB5C1C 100%)` utility class
- Industrial grid: `radial-gradient(circle, #201f1f 1px, transparent 1px)` at 30px for desktop backgrounds
- Milled edge: `box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.05)` utility class
- Hard tap: `button:active { filter: brightness(1.25) }` — no transitions

### Done ✅

- [x] `bun run dev` renders app with Iron & Ember color scheme
- [x] Space Grotesk renders on headlines, Inter on body text
- [x] Material Symbols icons render (test: `<Icon name="fitness_center" />`)
- [x] All `border-radius` is 0px across shadcn components
- [x] Button variants match spec: default (forge), molten (gradient), secondary (slate), ghost (text-only)
- [x] Input fields use underline-only style (no boxed borders)
- [x] Cards use tonal layering (no shadows, no line borders)
- [x] Mobile: bottom nav renders with 4 tabs, active state highlights in ember
- [x] Desktop: sidebar renders with 5 items, collapse/expand works
- [x] Responsive breakpoint switches nav correctly (< 768px bottom, ≥ 1024px sidebar)
- [x] Touch targets ≥ 48px on mobile nav
- [x] Scrollbar styled (narrow, molten hover)
- [x] No light mode — dark only
- [x] Frosted glass (heat-blur) effect works on sticky elements
- [x] Production build succeeds

---

## STEP 2: Domain Types + Zod Schemas ✅ COMPLETE

**Dependencies:** Step 1 (project structure exists)
**Priority:** P0
**Docs:** `05-domain-model.md` (full entity definitions), `06-invariants.md` (constraints), `09-state-machines.md` (valid transitions)

### What was built

Canonical TypeScript types and Zod validation schemas in `src/domain/`. These are the source of truth for the entire application — Rust structs and Supabase schemas are derived from these.

### Type files created

| File             | Contents                                                                   | Source Doc                           |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| `units.ts`       | Weight, Distance, Duration, Pace, NumberRange, OneRepMax                   | 05-domain-model.md §Value Objects    |
| `exercise.ts`    | Exercise, ExerciseCategory, MovementPattern, MuscleGroup, Equipment        | 05-domain-model.md §Exercise         |
| `set-scheme.ts`  | SetScheme (12-variant union), LoadSpec (7-variant union)                   | 05-domain-model.md §SetScheme        |
| `session.ts`     | SessionTemplate, ActivityGroup, Activity, GroupType, ScoringType           | 05-domain-model.md §Session Template |
| `program.ts`     | Program, Block, BlockWeek, ScheduledSession, ProgramSource, BlockType      | 05-domain-model.md §Program          |
| `workout-log.ts` | WorkoutLog, LoggedActivityGroup, LoggedActivity, LoggedSet, SetType        | 05-domain-model.md §WorkoutLog       |
| `user.ts`        | UserProfile, OneRepMaxHistory                                              | 05-domain-model.md §UserProfile      |
| `sharing.ts`     | AccountabilityGroup, GroupMember, GroupInvite, DirectConnection, ShareLink | 02-prd-sharing.md §Data Model        |

### Done ✅

- [x] All types compile with no errors
- [x] SetScheme discriminated union covers all 12 variants
- [x] LoadSpec discriminated union covers all 7 variants
- [x] Zod schemas validate correct data and reject invalid data
- [x] Unit tests for: SS-2 (percentage range), SS-3 (rep ladder), SS-4 (number range)
- [x] Unit tests for SetScheme type-field consistency (SS-1)
- [x] Data adapter interface defined with all methods
- [x] `domain/` directory has zero React or framework dependencies

---

## STEP 3: Supabase Project Setup ✅ COMPLETE

**Dependencies:** Step 2 (types for schema alignment). Can be done in parallel with Step 2.
**Priority:** P0
**Docs:** `08-erd.md` §Remote Schema, `06-invariants.md` §Sync Invariants

### What was built

Supabase project configuration and database schema. Uses the new publishable key (`sb_publishable_...`) instead of legacy `anon` JWT key.

### 3a. Supabase project + Auth

- Supabase project created
- Email/password auth enabled
- Project URL and publishable key in `.env.local`
- `@supabase/supabase-js` client installed and connected
- Supabase CLI initialized and linked for migration management

### 3b–3e. Schema, RLS, Indices, Seed Data

Phase 0 tables created via migrations: `exercises`, `workout_logs`, `logged_activity_groups`, `logged_activities`, `logged_sets`, `user_profiles`, `one_rep_max_history`.

RLS enabled with simple user isolation: `user_id = auth.uid()`. Indices for key query patterns. Exercise dictionary seeded with 50+ common exercises.

### Done ✅

- [x] Supabase project exists with Auth enabled
- [x] `.env.local` has correct project URL and publishable key
- [x] All Phase 0 tables created via migrations
- [x] RLS enabled and tested
- [x] Unauthenticated requests rejected
- [x] Exercise dictionary seeded with 50+ common exercises
- [x] Indices created for key queries
- [x] Supabase client connects from React app

---

## STEP 4: Supabase Data Adapter + Auth UI ✅ COMPLETE

**Dependencies:** Step 2 (types), Step 3 (Supabase schema), Step 1.5 (design system for auth screens)
**Priority:** P0
**Docs:** `07-architecture.md` §Data Layer, `10-user-flows.md` §Flow 9, `DESIGN.md`

### What to build

Supabase adapter implementing the data adapter interface, plus basic auth screens styled with Iron & Ember.

### 4a. Supabase adapter

Implements every method from the data adapter interface using `@supabase/supabase-js`:

| Method           | Supabase Call                                                       |
| ---------------- | ------------------------------------------------------------------- |
| `getExercises`   | `supabase.from('exercises').select().order('name')`                 |
| `saveWorkoutLog` | `supabase.from('workout_logs').upsert(log)`                         |
| `saveLoggedSet`  | `supabase.from('logged_sets').upsert(set)`                          |
| `getUserProfile` | `supabase.from('user_profiles').select().eq('id', userId).single()` |

### 4b. TanStack Query integration

Wrap adapter calls in TanStack Query hooks:

| Hook                | Query Key                | Adapter Method   |
| ------------------- | ------------------------ | ---------------- |
| `useExercises`      | `['exercises', filters]` | `getExercises`   |
| `useWorkoutHistory` | `['workouts', userId]`   | `getWorkoutLogs` |
| `useWorkoutLog`     | `['workout', id]`        | `getWorkoutLog`  |
| `useUserProfile`    | `['profile', userId]`    | `getUserProfile` |
| `useSaveSet`        | mutation                 | `saveLoggedSet`  |
| `useSaveWorkout`    | mutation                 | `saveWorkoutLog` |

### 4c. Auth screens

| Screen          | Components                                 | Design Notes (Iron & Ember)          |
| --------------- | ------------------------------------------ | ------------------------------------ |
| Sign In         | Email + password form, Google OAuth button | Underline inputs, `forge` CTA button |
| Sign Up         | Email + password form                      | `surface-iron` card, 0px radius      |
| Forgot Password | Email input, send reset                    | Minimal, `surface-anvil` background  |

Auth screens use the industrial vocabulary: "AUTHENTICATE", "ACCESS FORGE", not "Welcome back!"

### 4d. Auth state management

- Supabase auth listener wraps app
- Unauthenticated → show auth screen
- Authenticated → show main app with Iron & Ember layout
- Sign out clears session

### Done ✅

- [x] User can sign up, sign in, sign out
- [x] Auth screens match Iron & Ember design (underline inputs, forge buttons, industrial copy)
- [x] Supabase adapter implements all data adapter methods
- [x] TanStack Query hooks fetch and cache data correctly
- [x] Exercises query returns seeded exercises
- [x] Saving a workout log persists to Supabase and is retrievable
- [x] RLS prevents accessing other users' data
- [x] Optimistic updates work for set logging mutations
- [x] Error states handled (network error, auth error)

---

## STEP 5: Exercise Dictionary + 1RM Management

**Dependencies:** Step 4 (data adapter working)
**Priority:** P0
**Docs:** `01-prd-core.md` §FR-5, `05-domain-model.md` §Exercise + §UserProfile, `DESIGN.md` §4 Data Tables

### What to build

Exercise search, filtering, custom exercise creation, and 1RM tracking. All UI uses Iron & Ember design tokens.

### 5a. Exercise search screen

- Search by name and aliases (debounced, 200ms)
- Filter by category, muscle group, movement pattern — use flat `surface-steel` badges for filter chips
- "Recently used" exercises shown first (query by `logged_activities`)
- Create custom exercise option at bottom of results

### 5b. Exercise detail screen

- Exercise metadata (category, muscles, equipment) in `label-medium` Inter, ALL-CAPS
- 1RM history chart — line chart using `arc` (#86CFFF) for primary data line, `ember` for secondary (Recharts with Iron & Ember palette)
- "UPDATE 1RM" button in `forge` CTA style
- Per-exercise workout history (last N sessions with this exercise)

### 5c. 1RM management

- Profile screen section showing current 1RMs — large numbers in `text-readout` (Space Grotesk 3.5rem)
- Update 1RM: underline input for weight, mark tested vs estimated
- Historical entries preserved (insert-only, never modified per PR-2)
- 1RM changes cascade to all percentage-based calculations

### 5d. Custom exercise creation

- Name (required), category, movement pattern, muscle groups, equipment
- Marked as `is_custom = true`
- Available in search immediately after creation

### Done when

- [ ] Exercise search returns results within 200ms
- [ ] Search by name and aliases works (e.g., "bench" finds "Barbell Bench Press")
- [ ] Filters by category and muscle group work
- [ ] Recently used exercises appear first
- [ ] Custom exercise creation works
- [ ] 1RM entry saves to `one_rep_max_history`
- [ ] 1RM history displayed as line chart with `arc` color
- [ ] Profile screen shows all current 1RMs in `text-readout` scale
- [ ] Exercise detail shows per-exercise workout history

---

## STEP 6: Active Workout Logging

**Dependencies:** Step 5 (exercise dictionary for adding exercises)
**Priority:** P0
**Docs:** `01-prd-core.md` §UC-1 + §UC-3 + §UC-4 + §UC-5 + §FR-1 + §FR-2 + §FR-3, `09-state-machines.md` §Active Workout + §Set Logging + §Circuit Execution, `10-user-flows.md` §Flow 3 + §Flow 4 + §Flow 5 + §Flow 6, `DESIGN.md` §4 Data Tables + §5 Layout

### What to build

The most important screen in the app. Active workout logging for all workout types: barbell sets, cardio, rucking, SE circuits. This screen is data-dense per the density philosophy — use `body-small` and `label-medium` Inter.

### 6a. Zustand store: active workout state

| State Field      | Type                                           | Purpose                                    |
| ---------------- | ---------------------------------------------- | ------------------------------------------ |
| `workoutLog`     | `WorkoutLog \| null`                           | Current workout (null = no active workout) |
| `loggedGroups`   | `LoggedActivityGroup[]`                        | All activity groups                        |
| `elapsedSeconds` | `number`                                       | Session timer                              |
| `restTimer`      | `{ remaining: number, total: number } \| null` | Rest countdown                             |
| `undoAction`     | `{ setId: string, expiresAt: number } \| null` | 10-second undo                             |

### 6b. Start workout flow

- "EXECUTE WORKOUT" button on Today screen (molten gradient CTA)
- Creates `WorkoutLog` with `startedAt = now()`
- Saves to database immediately (crash recovery)
- Navigates to active workout screen
- Starts elapsed timer — displayed in `text-readout` Space Grotesk

### 6c. Add exercise + log sets (barbell/dumbbell/bodyweight)

- Tap "+ ADD EXERCISE" → exercise search (from Step 5)
- Set logging table with ALL-CAPS column headers: SET, PRESCRIBED, ACTUAL, STATUS
- Enter weight and reps, tap `check_circle` icon to confirm
- Set saved to database immediately
- Next set row pre-fills from previous set values
- Rest timer starts automatically (default: 2 min, configurable)
- Rest timer displayed in `surface-steel` card with countdown in Space Grotesk
- COMPLETE status badge: flat `forge` rectangle

### 6d. Log cardio session

- Select cardio modality (run, cycle, swim, row) — icon chips
- Running timer display in `text-readout`
- Manual entry: distance and/or duration after completion (underline inputs)
- Optional: heart rate, intensity level

### 6e. Log ruck

- Enter ruck load weight (underline input)
- Running timer
- After completion: distance, optional elevation gain
- Pace auto-calculated from duration and distance

### 6f. Log SE circuit

Circuit execution mode per `09-state-machines.md` §Circuit Execution:

- Show circuit overview (exercises, target reps, rounds) — data table format
- Step through: exercise → confirm reps → inter-exercise rest → next exercise
- Between rounds: inter-round rest with countdown in `surface-steel` card
- Summary after all rounds complete

### 6g. Finish workout

- "FINISH" button sets `completedAt`
- Show workout summary — duration in `text-readout`, exercises, total sets, volume
- Navigate back to Today screen

### 6h. Crash recovery

- Active workout with no `completedAt` detected on app launch
- Prompt: "RESUME SESSION?" with RESUME/DISCARD options
- Resume restores full state from database

### Non-functional targets (from 01-prd-core.md)

| Metric                              | Target  |
| ----------------------------------- | ------- |
| Set confirmation to visual feedback | < 100ms |
| Touch targets                       | ≥ 48px  |
| Taps to confirm a pre-filled set    | ≤ 2     |
| Taps to log an ad-hoc set           | ≤ 4     |

### Done when

- [ ] User can start an empty workout, add exercises, log sets, finish
- [ ] Weight × reps logging works with checkmark confirmation
- [ ] Previous set values pre-fill next set row
- [ ] Rest timer starts after set confirmation with countdown display
- [ ] Rest timer can be skipped or adjusted mid-countdown
- [ ] Undo available for 10 seconds after confirming a set
- [ ] Cardio logging: duration + distance entry with pace calculation
- [ ] Ruck logging: load weight + duration + distance + optional elevation
- [ ] SE circuit mode: step through exercises with rest timers between
- [ ] Elapsed session timer runs in `text-readout` Space Grotesk
- [ ] "FINISH" shows summary with duration, exercises, volume
- [ ] Set type classification works (working, warmup, drop, backoff)
- [ ] Only one active workout at a time (L-8)
- [ ] Crash recovery prompt on relaunch with incomplete workout
- [ ] All data persists to Supabase on every set confirmation
- [ ] UI matches Iron & Ember: tonal layering, no borders, industrial vocabulary

---

## STEP 7: Workout History

**Dependencies:** Step 6 (workouts exist to view)
**Priority:** P0
**Docs:** `01-prd-core.md` §FR-6, `DESIGN.md` §4 Data Tables + §5 Layout

### What to build

History list, workout detail view, and per-exercise history. The VAULT screen houses analytics in later steps, but history is accessible from FORGE (dashboard).

### 7a. History list

- Reverse chronological list of completed workouts
- Each entry on `surface-iron` card: date, duration, exercise names, set count
- Alternating rows with `surface-charcoal` for density
- Virtualized list for performance (large histories)
- Tap to view full detail

### 7b. Workout detail view

- Full workout reconstruction: exercises → sets → reps/weight
- Data table with SET / ACTUAL / STATUS columns (ALL-CAPS headers)
- Program context shown if applicable (block, week, day)
- Notes and perceived difficulty
- Duration and volume totals in `text-readout` scale

### 7c. Per-exercise history

- Navigate from exercise detail screen
- Last N sessions with this exercise
- Set-by-set comparison across sessions — alternating row stripes
- Volume trend: horizontal load bars (`ember` on `surface-steel` track), not circular charts

### Done when

- [ ] History list shows all completed workouts in reverse chronological order
- [ ] Workout detail shows full set-by-set breakdown
- [ ] Per-exercise history shows last 10+ sessions
- [ ] Volume trend renders as horizontal load bars (not circular)
- [ ] Virtualized list performs well with 100+ workouts
- [ ] Delete workout available with confirmation dialog
- [ ] All UI uses Iron & Ember tonal layering and typography

---

## ═══ PHASE 0 COMPLETE ═══

**Checkpoint:** The React app runs in the browser with Iron & Ember design system. Users can sign up, search exercises, set 1RMs, log any workout type (barbell, cardio, ruck, circuit), view history, and see per-exercise trends. Data is stored in Supabase. Take your phone to the gym and log a workout in the mobile browser.

---

## STEP 8: Tauri Shell + Rust/SQLite Backend

**Dependencies:** Step 7 (browser app is functional)
**Priority:** P0
**Docs:** `07-architecture.md` §Rust Backend Responsibilities

### What to build

Wrap the React app in Tauri v2. Add Rust backend with SQLite for offline-first operation. Create the Tauri data adapter.

**Design note:** Bundle Space Grotesk, Inter, and Material Symbols font files locally for Tauri builds to avoid Google Fonts network dependency. The heat-blur frosted glass effect may need testing in Tauri WebView — `backdrop-filter` support varies.

### 8a. Tauri project initialization

- `bun create tauri-app` in existing project
- Tauri v2 configuration (`tauri.conf.json`)
- Android target initialization (`tauri android init`)
- Verify React app renders inside Tauri WebView with Iron & Ember styling intact

### 8b. Rust SQLite setup

- Add `sqlx` with SQLite feature to Cargo dependencies
- Create SQLite database file in Tauri app data directory
- Migration system for schema creation
- Create all Phase 0 tables (mirroring Supabase schema from `08-erd.md`)

### 8c. Tauri commands

Typed Rust functions invokable from React via `invoke()`:

| Command              | Purpose                          |
| -------------------- | -------------------------------- |
| `save_workout_log`   | Insert/update workout to SQLite  |
| `get_workout_logs`   | Query workout history            |
| `get_workout_log`    | Get single workout with all sets |
| `save_logged_set`    | Save individual set              |
| `get_exercises`      | Query exercise dictionary        |
| `create_exercise`    | Insert custom exercise           |
| `get_user_profile`   | Get profile + 1RMs               |
| `save_one_rep_max`   | Record new 1RM                   |
| `delete_workout_log` | Remove workout                   |

### 8d. Tauri data adapter

Implements the same data adapter interface as the Supabase adapter, but calls Tauri commands.

### 8e. Adapter switching

```typescript
import { isTauri } from '@tauri-apps/api/core'
export const adapter = isTauri() ? tauriAdapter : supabaseAdapter
```

All existing TanStack Query hooks use the adapter — switching is transparent.

### 8f. Android build + gym test

- Build Android APK (`tauri android build`)
- Sideload on personal device
- **GO / NO-GO: Log a workout at the gym.** Does it feel right?

### Done when

- [ ] React app renders inside Tauri WebView (desktop and Android)
- [ ] Iron & Ember styling renders correctly in WebView (fonts, colors, heat-blur)
- [ ] SQLite database creates all tables on first launch
- [ ] All Tauri commands work: CRUD for workouts, exercises, profile
- [ ] Tauri adapter passes the same functional tests as Supabase adapter
- [ ] Adapter switching works: Tauri mode uses SQLite, browser uses Supabase
- [ ] Android APK builds and installs
- [ ] Existing workout logging flow works identically in Tauri mode
- [ ] Data persists across app restarts (SQLite)
- [ ] App works with airplane mode (offline-first validated)
- [ ] Fonts bundled locally (no Google Fonts dependency in native builds)

---

## STEP 9: Sync Engine + Rest Timer (Rust)

**Dependencies:** Step 8 (Tauri shell with SQLite working)
**Priority:** P0
**Docs:** `07-architecture.md` §Sync Data Flow, `09-state-machines.md` §Sync State Machine, `06-invariants.md` §Sync Invariants

### What to build

Bidirectional sync between local SQLite and Supabase, plus background rest timer in Rust.

### 9a. Sync engine (Rust)

- Push: local SQLite changes → Supabase (on workout complete or periodic)
- Pull: Supabase realtime subscription → local SQLite
- Conflict resolution: last-write-wins by `updated_at`
- Offline queue: changes queued when offline, flushed on reconnect
- Auth awareness: sync only when authenticated

### 9b. Sync state exposed to React

| State     | Meaning                  | UI Indicator (Iron & Ember)                     |
| --------- | ------------------------ | ----------------------------------------------- |
| `offline` | No auth or no network    | No indicator (app works normally)               |
| `syncing` | Push or pull in progress | `cloud_done` icon pulsing in `ember`            |
| `synced`  | All caught up            | `cloud_done` icon solid in `steel-blue`         |
| `error`   | Sync failed              | `error` icon in `error` color, toast with retry |

### 9c. Rest timer in Rust

The rest timer must survive screen lock and WebView backgrounding:

- React calls `invoke('start_rest_timer', { seconds: 150 })`
- Rust starts async timer
- Rust emits `timer_tick` event every second
- Rust emits `timer_expired` event + triggers platform notification
- React subscribes to events for UI countdown display in `surface-steel` card, Space Grotesk

### 9d. Notification for timer expiry

- Use `tauri-plugin-notification` for cross-platform alerts
- Short chime + vibration when rest timer expires
- Notification channel: `rest_timer` (high importance on Android)

### Done when

- [ ] Workout logged offline (airplane mode) → go online → data appears in Supabase
- [ ] Workout logged on web (Supabase) → appears on Tauri app via sync
- [ ] Conflict: same workout edited on both → last-write-wins correctly
- [ ] Sync state indicator uses correct Iron & Ember icons and colors
- [ ] Rest timer runs in Rust, counts down in React UI (Space Grotesk)
- [ ] Rest timer survives screen lock on Android
- [ ] Timer expiry triggers notification with sound/vibration
- [ ] Timer can be skipped or adjusted from React UI

---

## ═══ PHASE 1 COMPLETE ═══

**GO / NO-GO Checkpoint:** The app works on Android with offline support. Rest timer survives screen lock. Sync works bidirectionally. If the mobile experience is acceptable → continue. If not → pivot (React app becomes web-only, rebuild mobile in native framework).

---

## STEP 10: Session Templates + SetScheme Editor

**Dependencies:** Step 9 (Tauri + sync working)
**Priority:** P0
**Docs:** `05-domain-model.md` §SessionTemplate + §SetScheme, `10-user-flows.md` §Flow 7 §SetScheme Editor, `DESIGN.md` §4

### What to build

Create and edit session templates with the full SetScheme system. This is the foundation for the program builder.

### 10a. Supabase schema additions

Create program-related tables: `session_templates`, `activity_groups`, `activities`. Add corresponding SQLite tables and Tauri commands.

### 10b. SetScheme editor component

The most complex form in the app. A type selector (12 options) that dynamically shows the correct fields. All form fields use underline-only inputs per Iron & Ember spec.

| SetScheme Type      | Fields Shown                                   |
| ------------------- | ---------------------------------------------- |
| FixedSets           | Sets, reps, weight, rest, AMRAP toggle         |
| PercentageSets      | Sets, reps, %1RM, rest, AMRAP toggle           |
| WorkToMax           | Target rep range, optional warmup scheme       |
| CardioSteadyState   | Duration or distance, intensity, modality      |
| CardioInterval      | Work duration/distance, rest, rounds, modality |
| RuckMarch           | Duration or distance, load, pace target        |
| EMOM                | Reps per minute, total minutes                 |
| AMRAPTimed          | Time cap                                       |
| DescendingReps      | Rep ladder input (e.g., 21, 15, 9)             |
| ForReps             | Target reps, optional load                     |
| TimedHold           | Duration, sets, rest                           |
| PercentageOfMaxReps | Percentage slider                              |

### 10c. Session template builder

- Name the session (underline input, Space Grotesk)
- Add activity groups (straight, circuit, superset, interval) — `secondary` buttons
- Within each group: add exercises, configure set scheme per exercise
- Configure group-level settings (rounds, rest between activities)
- Save template — `forge` CTA

### Done when

- [ ] SetScheme editor renders correct fields for all 12 types
- [ ] Switching type clears irrelevant fields
- [ ] Zod validation runs on save, shows inline errors in `error` color
- [ ] Session template saves with nested activity groups and activities
- [ ] Session template loads and displays correctly
- [ ] Edit existing template works
- [ ] Templates sync via Supabase
- [ ] All form inputs use Iron & Ember underline style

---

## STEP 11: Program Structure (Blocks / Weeks / Scheduling)

**Dependencies:** Step 10 (session templates exist to schedule)
**Priority:** P0
**Docs:** `05-domain-model.md` §Program, `06-invariants.md` §Program Invariants

### What to build

Program hierarchy: Program → Blocks → Weeks → Scheduled Sessions. This is the data structure; the visual builder is Step 12.

### 11a. Supabase schema additions

Create `programs`, `blocks`, `block_weeks`, `scheduled_sessions` tables. Add SQLite equivalents and Tauri commands.

### 11b. Program CRUD

- Create program with name, source, duration
- Add blocks with ordinal ordering (P-1)
- Add weeks to blocks (P-2)
- Schedule sessions to days within weeks (P-3)
- `created_by` field for coach-created programs

### 11c. TB template library (seed data)

Pre-build session templates and program structures for common TB programs:

| Program                  | Blocks                        | Sessions                                |
| ------------------------ | ----------------------------- | --------------------------------------- |
| TB Operator (3-week)     | 1 block, 3 weeks              | 3×/week: squat, bench, WPU at 70/80/90% |
| TB Operator I/A          | Perpetual (no fixed duration) | Floating sessions with self-regulation  |
| TB Fighter               | 1 block, 3 weeks              | 2×/week: bench, squat, DL               |
| Base Building (SE)       | 1 block, 5 weeks              | SE circuits + LSS                       |
| Base Building (Strength) | 1 block, 5 weeks              | Strength + LSS                          |

### 11d. Program activation

- User selects "ACTIVATE" on a program (forge CTA)
- System tracks current position (block index, week number, next session)
- Only one active program at a time

### Done when

- [ ] Program creates with blocks and weeks
- [ ] Block ordinal integrity enforced (P-1)
- [ ] Sessions scheduled to days within weeks
- [ ] TB Operator template loads correctly from seed data
- [ ] Program activation tracks current position
- [ ] Only one active program at a time
- [ ] All program data syncs correctly

---

## STEP 12: Program Builder (Drag-and-Drop UI)

**Dependencies:** Step 11 (program data structure exists)
**Priority:** P1
**Docs:** `10-user-flows.md` §Flow 7, `DESIGN.md` §5 Layout (Desktop)

### What to build

Visual drag-and-drop program builder. Primarily a desktop/web experience — uses the multi-column layout from the desktop sidebar. Uses `drag_indicator` Material Symbol for drag handles.

### 12a. Block editor

- Add/remove/reorder blocks (dnd-kit) — `drag_indicator` icon for handles
- Set block type (standard, deload, peak) — flat `surface-steel` badges
- Set duration (weeks)

### 12b. Week editor

- Visual week grid showing days on `surface-iron` cards
- Drag session templates onto days
- Copy week to fill a block quickly

### 12c. Session assignment

- Assign existing session templates to days
- Create new session template inline
- Preview session content (exercises, set schemes) in `surface-charcoal` panel

### 12d. Program preview

- Read-only view of entire program structure
- Week-by-week, session-by-session breakdown in data table format
- Working weights shown based on current 1RMs — Space Grotesk numbers

### Done when

- [ ] Drag-and-drop reordering of blocks works
- [ ] Drag session templates onto week days
- [ ] Copy week fills block quickly
- [ ] Program preview shows full structure with calculated weights
- [ ] Mobile: simplified list-based editor (no drag-drop)
- [ ] Saved programs appear in library
- [ ] Desktop layout uses sidebar + multi-column grid per DESIGN.md

---

## STEP 13: Programmed Workout Logging

**Dependencies:** Step 11 (programs exist), Step 6 (logging infrastructure)
**Priority:** P0
**Docs:** `01-prd-core.md` §UC-2, `10-user-flows.md` §Flow 3, `DESIGN.md` §4 Data Tables

### What to build

The "Today's Workout" flow: load prescribed session, calculate weights from 1RMs, pre-fill all sets, log with prescribed-vs-actual tracking.

### 13a. Today screen: program context

- If active program → show "TODAY'S SESSION" card on `surface-iron`
- Display: session name in Space Grotesk, exercise list, set/rep/weight summary
- "EXECUTE SESSION" button (molten gradient CTA)

### 13b. Percentage → weight calculation

- Load user's 1RMs for all exercises in the session
- Apply percentage: `weight = floor(1RM * percentage)`
- Round to nearest plate-loadable weight (per PR-3: within 5lb/2.5kg)
- Pre-fill all set rows with calculated weights and prescribed reps

### 13c. Pre-filled workout experience

- All sets appear pre-populated in data table: SET / PRESCRIBED / ACTUAL columns
- User taps `check_circle` to confirm (2-tap logging)
- User can edit any value before confirming (deviation from prescription)
- AMRAP sets show "5+" notation
- Prescribed values stored alongside actual values in LoggedSet
- VARIANCE column shows deviation: green (`arc`) if matched/exceeded, `error` color if under

### 13d. Program position advancement

- After completing the workout, advance to next session
- Track: current block, current week, next session day label
- Deload week awareness — visual indicator using `steel-blue` badge

### Done when

- [ ] Today screen shows "TODAY'S SESSION" when program is active
- [ ] Percentage calculations resolve to plate-rounded weights
- [ ] All sets pre-filled with prescribed values
- [ ] Confirming a pre-filled set takes 1 tap (checkmark)
- [ ] Deviations recorded as actual ≠ prescribed
- [ ] AMRAP sets handled with "5+" and actual reps logged
- [ ] Workout links to program context (block, week, day)
- [ ] Program position advances after workout completion
- [ ] Plate calculator available (visual plate loading guide)
- [ ] SET / PRESCRIBED / ACTUAL / VARIANCE table matches Iron & Ember spec

---

## ═══ PHASE 2 COMPLETE ═══

**Checkpoint:** Users can create programs, build session templates with all 12 SetScheme types, follow structured multi-week periodized programs with percentage-based loading, and log workouts with prescribed-vs-actual tracking. The TB template library provides ready-made programs. All UI follows Iron & Ember design system.

---

## STEP 14: Progress Analytics + PR Detection

**Dependencies:** Step 7 (workout history exists)
**Priority:** P1
**Docs:** `05-domain-model.md` §Domain Events (PersonalRecordSet), `11-notification-design.md` §Type 3, `DESIGN.md` §4 Progress & Metrics

### What to build

The VAULT screen: progress charts, volume tracking, and automatic PR detection.

### 14a. 1RM trends

- Line chart: 1RM over time per exercise (Recharts)
- Chart palette per DESIGN.md: `arc` (#86CFFF) primary data line, `ember` (#FFB59C) secondary, `steel-blue` (#B1CAD7) tertiary
- Filter by exercise, date range
- Show tested vs estimated markers

### 14b. Volume tracking

- Weekly tonnage by exercise or muscle group
- **Horizontal load bars** (`ember` on `surface-steel` track) — no circular progress rings per DESIGN.md
- Large metric readouts (12.4T volume, 94% adherence) in Space Grotesk `text-readout` scale

### 14c. PR detection

After workout completion, scan logged sets for new bests:

- New 1RM (heaviest single)
- New 3RM, 5RM (heaviest set at rep count)
- New max reps at a given weight
- Distance/duration PRs for cardio

### 14d. PR celebration

- PR notification styled with molten gradient banner
- Notification: "NEW PR: SQUAT — 275LB × 5" (industrial vocabulary)
- PR history list in exercise detail

### Done when

- [ ] 1RM trend chart renders with `arc` / `ember` / `steel-blue` palette
- [ ] Volume tracking shows weekly tonnage as horizontal load bars
- [ ] Large metrics in Space Grotesk `text-readout`
- [ ] PR detection runs after every workout completion
- [ ] PR notification fires for new bests
- [ ] PR history visible in exercise detail
- [ ] VAULT screen renders well on both mobile and desktop viewports
- [ ] No circular progress rings — horizontal bars only

---

## STEP 15: Notification System

**Dependencies:** Step 9 (Rust backend for background delivery)
**Priority:** P1
**Docs:** `11-notification-design.md` (complete spec)

### What to build

Three notification types only: rest timer alerts (already done in Step 9), session reminders, and PR celebrations.

### 15a. Session reminders

- Optional, per-program
- Configurable time (default: 30 min before typical training time)
- Only fires when: active program + session today + not yet completed
- Content: session name + exercise summary
- Actions: "EXECUTE" / "LATER" (industrial vocabulary)

### 15b. Notification channels (Android)

| Channel           | ID                  | Importance                        |
| ----------------- | ------------------- | --------------------------------- |
| Rest Timer        | `rest_timer`        | High (already exists from Step 9) |
| Workout Reminders | `workout_reminders` | Default                           |
| Personal Records  | `personal_records`  | Default                           |

### 15c. Quiet hours

- Default: 10 PM – 6 AM
- Rest timer exempt (user is actively working out)

### 15d. Forbidden messaging (from 06-invariants.md)

- Never: "You missed your workout", "Don't skip leg day", streaks
- Always: neutral, actionable, informational — commands, not conversations

### Done when

- [ ] Session reminder fires at configured time when workout is due
- [ ] "EXECUTE" action opens pre-filled workout
- [ ] Quiet hours prevent non-timer notifications
- [ ] All notification text passes shame-free review
- [ ] All notification text uses industrial vocabulary (no exclamation points, no emoji)
- [ ] Notification settings screen with per-type toggles and quiet hours

---

## STEP 16: Share Links (Read-Only)

**Dependencies:** Step 7 (workouts exist to share), Step 11 (programs exist to share)
**Priority:** P1
**Docs:** `02-prd-sharing.md` §Feature 1

### What to build

Generate share links for programs and workout logs. No RLS changes needed — uses a separate `share_links` table with token-based access.

### 16a. Share link generation

- "SHARE" button (`secondary` style) on program detail and workout detail screens
- Generate random 12-character alphanumeric token
- Store in `share_links` table with entity type and entity ID
- Display copyable URL: `https://ardentforge.app/s/{token}`

### 16b. Share link viewing

- Public route `/s/:token` — no auth required to view
- Fetch shared entity via token lookup (bypasses RLS)
- Read-only display of program structure or workout log, styled with Iron & Ember

### 16c. Clone shared program

- "CLONE TO LIBRARY" button (forge CTA, requires auth)
- Deep copy: program + blocks + weeks + sessions + templates
- Owned by the cloning user (`user_id` = their ID)

### 16d. Share link management

- Author can view active share links
- Author can revoke (deactivate) any link

### Done when

- [ ] "SHARE" button generates a working link
- [ ] Shared program viewable without authentication
- [ ] Shared workout log viewable without authentication
- [ ] "CLONE" copies program to authenticated user's account
- [ ] Author can revoke share links
- [ ] Revoked links return 404
- [ ] Shared view renders with Iron & Ember styling

---

## STEP 17: Accountability Groups + Direct Connections

**Dependencies:** Step 16 (sharing infrastructure), Step 9 (sync for cross-user data)
**Priority:** P2
**Docs:** `02-prd-sharing.md` §Feature 2 + §Feature 3, `06-invariants.md` §Sharing Invariants

### What to build

Accountability groups with role-based visibility and direct peer connections. Requires RLS policy expansion.

### 17a. Supabase schema additions

Create `accountability_groups`, `group_members`, `group_invites`, `direct_connections` tables.

### 17b. RLS policy expansion

Update RLS policies from simple `user_id = auth.uid()` to include group membership and connection checks. Key policy changes per `02-prd-sharing.md` §RLS Policy Changes:

- Workout logs: readable by group peers and connections
- Exercise maxes: readable by group peers (coach needs this)
- Programs: readable by group members
- Workout logs: writable ONLY by owner (never by coach)

### 17c. Group CRUD

- Create group (creator becomes coach)
- Generate invite code (`AF-{8 alphanumeric}`)
- Join group via code or link
- Leave group
- Coach: remove member, revoke invite

### 17d. Group activity feed

- Chronological list of group members' recent workouts
- Entry: member name, date, session name, exercise summary — data table on `surface-iron` cards
- Tap to expand full set-by-set detail
- Private fields excluded: perceived difficulty, bodyweight, notes

### 17e. Direct connections

- Search by email or username
- Send connection request → notification → accept/decline
- Symmetric read access when active
- Optional write access (per-direction toggle)

### Done when

- [ ] Group creation with invite code works
- [ ] Joining via code adds user as MEMBER
- [ ] Coach sees all members' workout logs
- [ ] Members see each other's logs but not coach's logs
- [ ] Activity feed shows group workouts chronologically
- [ ] Private fields (difficulty, bodyweight, notes) excluded from group view
- [ ] Direct connection request/accept flow works
- [ ] Connection provides mutual log visibility
- [ ] RLS policies correctly enforce all access rules
- [ ] Group size limits enforced (SH-4)
- [ ] Leave group works, data retained per retention setting

---

## STEP 18: Coach Write Access

**Dependencies:** Step 17 (groups exist with role-based access)
**Priority:** P2
**Docs:** `02-prd-sharing.md` §Feature 2 (Coach Workflow), `06-invariants.md` SH-1 through SH-3

### What to build

Coach can create/edit programs for group members and update their 1RMs.

### 18a. Coach program creation

- Coach opens group → selects member → "CREATE PROGRAM"
- Standard program builder (from Step 12) with `user_id = member` and `created_by = coach`
- Member receives notification: "COACH ASSIGNED PROGRAM: [name]"

### 18b. Coach session editing

- Coach can modify upcoming scheduled sessions for a member
- Changes reflected when member opens "TODAY'S SESSION"
- Member notification on changes

### 18c. Coach 1RM updates

- Coach can view and update member's 1RMs
- Needed to calibrate percentage-based programs

### 18d. Member override

- Member can always modify or delete coach-created programs
- Member's edits take precedence (SH-2: member always wins)

### 18e. Connection write access

- Optional write access on direct connections
- Per-direction: User A can grant write to User B independently
- Same permissions as coach write (programs/templates/sessions/1RMs)

### Done when

- [ ] Coach can create program owned by member
- [ ] Coach can edit member's upcoming sessions
- [ ] Coach can update member's 1RMs
- [ ] Member receives notification on coach changes
- [ ] Member can modify/delete coach-created programs
- [ ] Coach CANNOT modify member's workout logs (SH-3)
- [ ] Connection write access works per-direction
- [ ] RLS policies correctly scope coach write to programs/templates/sessions only

---

## Integration Testing Milestones

### Milestone 1: First Workout in Browser (after Steps 5 + 6)

- Log a barbell workout in mobile browser → data persists in Supabase
- **This validates the end-to-end pipeline. Do it ASAP.**
- Verify Iron & Ember design renders correctly on actual mobile device

### Milestone 2: First Workout in Tauri (after Step 8)

- Log same workout in Tauri Android APK → data in local SQLite
- Verify offline → go online → data appears in Supabase
- Verify fonts load from local bundle (no network dependency)

### Milestone 3: Programmed Workout Round-Trip (after Step 13)

- Create TB Operator program → activate → log Day 1 with pre-filled sets
- Verify prescribed vs actual tracking works
- Verify PRESCRIBED / ACTUAL / VARIANCE columns display correctly

### Milestone 4: Cross-User Visibility (after Step 17)

- User A logs workout → User B (in same group) sees it in activity feed within 5s

### Milestone 5: Coach Programs Athlete (after Step 18)

- Coach creates program for member → member activates → logs workout → coach sees completion

---

## Timeline Mapping

| Step                                  | Priority | Est. Effort    | Can Parallel With  |
| ------------------------------------- | -------- | -------------- | ------------------ |
| 1. Project Scaffold                   | P0       | 0.5 day        | —                  |
| **1.5. Design System (Iron & Ember)** | **P0**   | **1 day**      | —                  |
| 2. Domain Types + Zod                 | P0       | 1.5 days       | 3 (Supabase setup) |
| 3. Supabase Setup                     | P0       | 0.5 day        | Step 2             |
| 4. Data Adapter + Auth                | P0       | 2 days         | —                  |
| 5. Exercise Dictionary + 1RMs         | P0       | 2 days         | —                  |
| 6. Active Workout Logging             | P0       | 4 days         | —                  |
| 7. Workout History                    | P0       | 1.5 days       | —                  |
| **Phase 0 subtotal**                  |          | **~13 days**   |                    |
| 8. Tauri Shell + Rust/SQLite          | P0       | 3 days         | —                  |
| 9. Sync Engine + Rest Timer           | P0       | 2.5 days       | —                  |
| **Phase 1 subtotal**                  |          | **~5.5 days**  |                    |
| 10. Session Templates + SetScheme     | P0       | 3 days         | —                  |
| 11. Program Structure                 | P0       | 2 days         | —                  |
| 12. Program Builder (DnD)             | P1       | 3 days         | —                  |
| 13. Programmed Workout Logging        | P0       | 2.5 days       | —                  |
| **Phase 2 subtotal**                  |          | **~10.5 days** |                    |
| 14. Progress Analytics + PR           | P1       | 2.5 days       | 15                 |
| 15. Notification System               | P1       | 1.5 days       | 14                 |
| 16. Share Links                       | P1       | 1.5 days       | 14, 15             |
| 17. Accountability Groups             | P2       | 3 days         | —                  |
| 18. Coach Write Access                | P2       | 2 days         | —                  |
| **Phase 3-4 subtotal**                |          | **~11 days**   |                    |
| **Total**                             |          | **~40 days**   |                    |

> **Critical path to browser MVP:** Steps 1 → 1.5 → 2/3 → 4 → 5 → 6 → 7 = ~13 days
> **Critical path to Tauri GO/NO-GO:** + Steps 8 → 9 = ~18.5 days
> **Critical path to programmed workouts:** + Steps 10 → 11 → 13 = ~26 days

---

## Supabase-Specific Considerations

### Cost

At community scale (< 50 users), Ardent Forge stays well within Supabase's free tier:

| Resource       | Free Tier        | Ardent Forge Est. Usage |
| -------------- | ---------------- | ----------------------- |
| Database       | 500 MB           | < 50 MB                 |
| Auth           | 50K MAU          | < 50 users              |
| Realtime       | 200 concurrent   | < 10                    |
| Edge Functions | 500K invocations | 0 (not used)            |
| Storage        | 1 GB             | 0 (no file uploads)     |

### API Keys

Ardent Forge uses the new Supabase publishable key (`sb_publishable_...`) instead of the legacy `anon` JWT key. The publishable key is sent in the `apikey` header by the Supabase client library. Benefits: independently rotatable, no JWT secret coupling, shorter and easier to manage. Legacy `anon` key still works but is deprecated.

### JSON Columns

Complex types (SetScheme, LoadSpec, Weight, prescribed values) are stored as JSONB in Postgres / JSON text in SQLite. This means:

- No JOINs needed for nested structures within a single entity
- Validation happens at the application layer (Zod schemas), not database
- Migration-friendly: adding a new SetScheme variant is a code change, not a schema migration

### SQLite ↔ Postgres Type Mapping

| SQLite                   | Postgres    | Conversion              |
| ------------------------ | ----------- | ----------------------- |
| TEXT (UUID)              | UUID        | Same format             |
| INTEGER (Unix timestamp) | TIMESTAMPTZ | Convert on sync         |
| TEXT (JSON string)       | JSONB       | Parse/stringify on sync |
| INTEGER (0/1)            | BOOLEAN     | Convert on sync         |
| TEXT (enum)              | TEXT        | Same format             |

---

## Design Decisions Summary

| #   | Decision                                             | Rationale                                                                      |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Phase 0 is browser-only against Supabase             | Validates data model and UX before committing to Tauri                         |
| 2   | Data adapter pattern from day one                    | Switching between Supabase and Tauri/SQLite is transparent                     |
| 3   | SetScheme as discriminated union, not generic schema | Each workout type gets first-class field validation                            |
| 4   | JSON columns for complex nested types                | Avoids explosion of junction tables for SetScheme variants                     |
| 5   | 1RM history is insert-only                           | Audit trail for progression, never lose historical data                        |
| 6   | Pre-fill + confirm pattern for programmed logging    | Minimizes taps (2 per set) while allowing deviation                            |
| 7   | Rest timer in Rust, not JavaScript                   | Survives WebView backgrounding on mobile                                       |
| 8   | RLS expansion deferred to Steps 17-18                | Simple `user_id = auth.uid()` for Phases 0-2, complexity only when needed      |
| 9   | Coach creates programs owned by member               | Member always controls their data, coach access is revocable                   |
| 10  | Same React app for all platforms                     | Eliminates duplication between web and native                                  |
| 11  | Iron & Ember design system before feature work       | Full shadcn overrides upfront prevent style debt across 14 feature steps       |
| 12  | Publishable key over legacy anon key                 | Independently rotatable, no JWT secret coupling, Supabase recommended          |
| 13  | Bun over npm                                         | Faster installs, native TypeScript, simpler toolchain                          |
| 14  | TanStack Router (not Start) for Tauri compatibility  | Start requires a server for SSR; Tauri runs in a serverless WebView            |
| 15  | Material Symbols + Lucide dual icon strategy         | Material Symbols for app icons (fitness-specific), Lucide for shadcn internals |
| 16  | Fonts bundled locally in Tauri builds                | No Google Fonts network dependency in native offline-first builds              |
