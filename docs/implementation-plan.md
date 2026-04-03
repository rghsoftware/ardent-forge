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
                            └───────────┘ └─────┬─────┘
                                                │
        ═════════════════════════════════╪═════════════════════
         Phase 3-4 Complete              │   Social + Analytics
        ═════════════════════════════════╪═════════════════════
                                         │
                                ┌────────┼────────┐
                                ▼                 ▼
                         ┌───────────┐     ┌───────────┐
                         │ STEP 19:  │     │ STEP 20:  │
                         │ Runtime   │     │ Docker &  │
                         │ Backend   │     │ Self-Host │
                         │ Config    │     │           │
                         └─────┬─────┘     └───────────┘
                               │
        ═══════════════════════╪═══════════════════════════════
         Phase 5 Complete       │   Ready for Play Store release
        ═══════════════════════╪═══════════════════════════════
                               │
              ┌────────────────┼───────────┐
              ▼                ▼           ▼
       ┌───────────┐  ┌───────────┐ ┌───────────┐
       │ STEP 21:  │  │ STEP 22:  │ │ STEP 26:  │
       │ Chat Data │  │ Supabase  │ │ Retention │
       │ Layer     │  │ Realtime  │ │ + Archive │
       │           │  │ (AFTER 21)│ │ (AFTER 21)│
       └─────┬─────┘  └─────┬─────┘ └─────┬─────┘
             │               │              │
             └───────┬────────┘             │
                     ▼                      │
           ┌──────────────┐                 │
           │ STEP 23:     │                 │
           │ Chat UI      │                 │
           │ (biggest)    │                 │
           └──────┬───────┘                 │
                  │                         │
         ┌────────┼────────┐                │
         ▼                 ▼                │
  ┌───────────┐     ┌───────────┐           │
  │ STEP 24:  │     │ STEP 25:  │           │
  │ Workout   │     │ Video +   │           │
  │ Sharing   │     │ Image     │           │
  │ in Chat   │     │ Sharing   │           │
  └───────────┘     └───────────┘           │
                                            │
  ══════════════════════════╪═══════════════╪════
   Phase 6 Complete         │   Chat & Media working
  ══════════════════════════════════════════════
```

> **Note on ordering:** Step 19 and Step 20 are shown after Phase 3-4 for dependency graph clarity, but Step 19 can be executed at any point after Phase 1 (Step 9). It modifies the Supabase client initialization and adds a settings screen — both of which exist by Step 9. Step 20 (Docker) can be done at any point after Step 3 (Supabase schema exists). Neither step depends on Steps 10-18. The only hard requirement is that Step 19 must be complete before any Play Store or public distribution.

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

| File             | Contents                                                                                           | Source Doc                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `units.ts`       | Weight, Distance, Duration, Pace, NumberRange, OneRepMax                                           | 05-domain-model.md §Value Objects                                |
| `exercise.ts`    | Exercise, ExerciseCategory, MovementPattern, MuscleGroup, Equipment                                | 05-domain-model.md §Exercise                                     |
| `set-scheme.ts`  | SetScheme (12-variant union), LoadSpec (7-variant union)                                           | 05-domain-model.md §SetScheme                                    |
| `session.ts`     | SessionTemplate, ActivityGroup, Activity, GroupType, ScoringType, SessionCategory (includes EVENT) | 05-domain-model.md §Session Template                             |
| `program.ts`     | Program, Block, BlockWeek, ScheduledSession, ProgramSource, BlockType                              | 05-domain-model.md §Program                                      |
| `workout-log.ts` | WorkoutLog, LoggedActivityGroup, LoggedActivity, LoggedSet, SetType                                | 05-domain-model.md §WorkoutLog                                   |
| `user.ts`        | UserProfile, OneRepMaxHistory                                                                      | 05-domain-model.md §UserProfile                                  |
| `sharing.ts`     | AccountabilityGroup, GroupMember, GroupInvite, DirectConnection, ShareLink                         | 02-prd-sharing.md §Data Model                                    |
| `event.ts`       | EventMetadata, EventRequirement, EventItem, Zod schemas                                            | 04-prd-events.md §Data Model, 05-domain-model.md §Event Entities |

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

> **Note:** The `event_items` table and `event_metadata` columns on `session_templates`/`workout_logs` are added as a Phase 2 migration in Step 13.5a, not in the initial Phase 0 schema.

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

## STEP 5: Exercise Dictionary + 1RM Management ✅ COMPLETE

**Dependencies:** Step 4 (data adapter working)
**Priority:** P0
**Docs:** `01-prd-core.md` §FR-5, `05-domain-model.md` §Exercise + §UserProfile, `DESIGN.md` §4 Data Tables

### What was built

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

### Done ✅

- [x] Exercise search returns results within 200ms
- [x] Search by name and aliases works (e.g., "bench" finds "Barbell Bench Press")
- [x] Filters by category and muscle group work
- [x] Recently used exercises appear first
- [x] Custom exercise creation works
- [x] 1RM entry saves to `one_rep_max_history`
- [x] 1RM history displayed as line chart with `arc` color
- [x] Profile screen shows all current 1RMs in `text-readout` scale
- [x] Exercise detail shows per-exercise workout history

---

## STEP 6: Active Workout Logging ✅ COMPLETE

**Dependencies:** Step 5 (exercise dictionary for adding exercises)
**Priority:** P0
**Docs:** `01-prd-core.md` §UC-1 + §UC-3 + §UC-4 + §UC-5 + §FR-1 + §FR-2 + §FR-3, `09-state-machines.md` §Active Workout + §Set Logging + §Circuit Execution, `10-user-flows.md` §Flow 3 + §Flow 4 + §Flow 5 + §Flow 6, `DESIGN.md` §4 Data Tables + §5 Layout

### What was built

The most important screen in the app. Active workout logging for all workout types: barbell sets, cardio, rucking, SE circuits. This screen is data-dense per the density philosophy -- uses `body-small` and `label-medium` Inter.

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

### Done ✅

- [x] User can start an empty workout, add exercises, log sets, finish
- [x] Weight × reps logging works with checkmark confirmation
- [x] Previous set values pre-fill next set row
- [x] Rest timer starts after set confirmation with countdown display
- [x] Rest timer can be skipped or adjusted mid-countdown
- [x] Undo available for 10 seconds after confirming a set
- [x] Cardio logging: duration + distance entry with pace calculation
- [x] Ruck logging: load weight + duration + distance + optional elevation
- [x] SE circuit mode: step through exercises with rest timers between
- [x] Elapsed session timer runs in `text-readout` Space Grotesk
- [x] "FINISH" shows summary with duration, exercises, volume
- [x] Set type classification works (working, warmup, drop, backoff)
- [x] Only one active workout at a time (L-8)
- [x] Crash recovery prompt on relaunch with incomplete workout
- [x] All data persists to Supabase on every set confirmation
- [x] UI matches Iron & Ember: tonal layering, no borders, industrial vocabulary

---

## STEP 7: Workout History ✅ COMPLETE

**Dependencies:** Step 6 (workouts exist to view)
**Priority:** P0
**Docs:** `01-prd-core.md` §FR-6, `DESIGN.md` §4 Data Tables + §5 Layout

### What was built

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

### Done ✅

- [x] History list shows all completed workouts in reverse chronological order
- [x] Workout detail shows full set-by-set breakdown
- [x] Per-exercise history shows last 10+ sessions
- [x] Volume trend renders as horizontal load bars (not circular)
- [x] Virtualized list performs well with 100+ workouts
- [x] Delete workout available with confirmation dialog
- [x] All UI uses Iron & Ember tonal layering and typography

---

## ═══ PHASE 0 COMPLETE ═══

**Checkpoint:** The React app runs in the browser with Iron & Ember design system. Users can sign up, search exercises, set 1RMs, log any workout type (barbell, cardio, ruck, circuit), view history, and see per-exercise trends. Data is stored in Supabase. Take your phone to the gym and log a workout in the mobile browser.

---

## STEP 8: Tauri Shell + Rust/SQLite Backend ⚠️ PARTIALLY COMPLETE

**Dependencies:** Step 7 (browser app is functional)
**Priority:** P0
**Docs:** `07-architecture.md` §Rust Backend Responsibilities

### What was built

Tauri v2 shell wrapping the React app, Rust backend with SQLite for offline-first operation, and the Tauri data adapter. Core CRUD commands, adapter switching, and SQLite migrations are all in place. Remaining gaps: no integration test suite comparing Tauri vs Supabase adapter parity, Android APK build/install not verified, offline-first behavior not validated end-to-end.

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

### Done

- [x] React app renders inside Tauri WebView (desktop and Android)
- [x] Iron & Ember styling renders correctly in WebView (fonts, colors, heat-blur)
- [x] SQLite database creates all tables on first launch
- [x] All Tauri commands work: CRUD for workouts, exercises, profile
- [ ] Tauri adapter passes the same functional tests as Supabase adapter
- [x] Adapter switching works: Tauri mode uses SQLite, browser uses Supabase
- [ ] Android APK builds and installs
- [x] Existing workout logging flow works identically in Tauri mode
- [x] Data persists across app restarts (SQLite)
- [ ] App works with airplane mode (offline-first validated)
- [x] Fonts bundled locally (no Google Fonts dependency in native builds)

---

## STEP 9: Sync Engine + Rest Timer (Rust) ⚠️ PARTIALLY COMPLETE

**Dependencies:** Step 8 (Tauri shell with SQLite working)
**Priority:** P0
**Docs:** `07-architecture.md` §Sync Data Flow, `09-state-machines.md` §Sync State Machine, `06-invariants.md` §Sync Invariants

### What was built

Rest timer fully implemented in Rust with notification support. Sync architecture present with push queue, pull subscription, and last-write-wins conflict resolution. **Critical gap:** the pull/upsert path is stubbed -- remote changes from Supabase are detected and conflict-resolved but not written to local SQLite (`sync/pull.rs`). Force-pull command also returns an error. Push (local to remote) works.

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

### Done

- [x] Workout logged offline (airplane mode) → go online → data appears in Supabase
- [ ] Workout logged on web (Supabase) → appears on Tauri app via sync (**pull upsert stubbed**)
- [x] Conflict: same workout edited on both → last-write-wins correctly (logic wired, untestable without upsert)
- [x] Sync state indicator uses correct Iron & Ember icons and colors
- [x] Rest timer runs in Rust, counts down in React UI (Space Grotesk)
- [ ] Rest timer survives screen lock on Android (**not verified**)
- [x] Timer expiry triggers notification with sound/vibration
- [x] Timer can be skipped or adjusted from React UI

---

## ═══ PHASE 1 COMPLETE ═══

**GO / NO-GO Checkpoint:** The app works on Android with offline support. Rest timer survives screen lock. Sync works bidirectionally. If the mobile experience is acceptable → continue. If not → pivot (React app becomes web-only, rebuild mobile in native framework).

---

## STEP 10: Session Templates + SetScheme Editor ✅ COMPLETE

**Dependencies:** Step 9 (Tauri + sync working)
**Priority:** P0
**Docs:** `05-domain-model.md` §SessionTemplate + §SetScheme, `10-user-flows.md` §Flow 7 §SetScheme Editor, `DESIGN.md` §4

### What was built

Session template creation and editing with the full SetScheme system (all 12 types). SetScheme editor dynamically renders correct fields per type with Zod validation. Templates save with nested activity groups and activities.

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

### Done ✅

- [x] SetScheme editor renders correct fields for all 12 types
- [x] Switching type clears irrelevant fields
- [x] Zod validation runs on save, shows inline errors in `error` color
- [x] Session template saves with nested activity groups and activities
- [x] Session template loads and displays correctly
- [x] Edit existing template works
- [x] Templates sync via Supabase
- [x] All form inputs use Iron & Ember underline style

---

## STEP 11: Program Structure (Blocks / Weeks / Scheduling) ✅ COMPLETE

**Dependencies:** Step 10 (session templates exist to schedule)
**Priority:** P0
**Docs:** `05-domain-model.md` §Program, `06-invariants.md` §Program Invariants

### What was built

Program hierarchy: Program → Blocks → Weeks → Scheduled Sessions. Full CRUD, ordinal integrity, TB seed data, and single-active-program activation.

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

### Done ✅

- [x] Program creates with blocks and weeks
- [x] Block ordinal integrity enforced (P-1)
- [x] Sessions scheduled to days within weeks
- [x] TB Operator template loads correctly from seed data
- [x] Program activation tracks current position
- [x] Only one active program at a time
- [x] All program data syncs correctly

---

## STEP 12: Program Builder (Drag-and-Drop UI) ✅ COMPLETE

**Dependencies:** Step 11 (program data structure exists)
**Priority:** P1
**Docs:** `10-user-flows.md` §Flow 7, `DESIGN.md` §5 Layout (Desktop)

### What was built

Visual drag-and-drop program builder using dnd-kit. Desktop multi-column layout with sidebar block list. Mobile fallback with simplified list-based editor. Copy-week, session picker, and program preview with calculated weights.

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

### Done ✅

- [x] Drag-and-drop reordering of blocks works
- [x] Drag session templates onto week days
- [x] Copy week fills block quickly
- [x] Program preview shows full structure with calculated weights
- [x] Mobile: simplified list-based editor (no drag-drop)
- [x] Saved programs appear in library
- [x] Desktop layout uses sidebar + multi-column grid per DESIGN.md

---

## STEP 13: Programmed Workout Logging ✅ COMPLETE

**Dependencies:** Step 11 (programs exist), Step 6 (logging infrastructure)
**Priority:** P0
**Docs:** `01-prd-core.md` §UC-2, `10-user-flows.md` §Flow 3, `DESIGN.md` §4 Data Tables

### What was built

The "Today's Workout" flow: load prescribed session, calculate weights from 1RMs, pre-fill all sets, log with prescribed-vs-actual tracking. Program position advancement on completion.

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

### Done ✅

- [x] Today screen shows "TODAY'S SESSION" when program is active
- [x] Percentage calculations resolve to plate-rounded weights
- [x] All sets pre-filled with prescribed values
- [x] Confirming a pre-filled set takes 1 tap (checkmark)
- [x] Deviations recorded as actual ≠ prescribed
- [x] AMRAP sets handled with "5+" and actual reps logged
- [x] Workout links to program context (block, week, day)
- [x] Program position advances after workout completion
- [x] Plate calculator available (visual plate loading guide)
- [x] SET / PRESCRIBED / ACTUAL / VARIANCE table matches Iron & Ember spec

---

## STEP 13.5: Events & Packing Lists

**Dependencies:** Step 10 (session templates exist), Step 6 (workout logging exists)
**Priority:** P1
**Docs:** `04-prd-events.md`, `05-domain-model.md` §Event Entities, `06-invariants.md` §Event Invariants, `08-erd.md` §Event Tables

### What to build

Event session type with packing lists and freeform requirements. Events are sessions with `category: EVENT` that display event metadata and a checkable packing list instead of exercises and sets.

### 13.5a. Database migration

Add `event_metadata` nullable JSON column to `session_templates` and `workout_logs` tables. Create `event_items` table with polymorphic FK (session_template_id XOR workout_log_id), CHECK constraints per `08-erd.md` §Event Tables.

Migration includes:

- `event_metadata` column on `session_templates` (TEXT, nullable)
- `event_metadata` column on `workout_logs` (TEXT, nullable)
- `event_items` table with CHECK constraint for FK exclusivity
- Partial indices on `event_items(session_template_id)` and `event_items(workout_log_id)`
- RLS policies for `event_items` (user_id = auth.uid())

### 13.5b. Domain types + Zod schemas

Add to `src/domain/`:

| Type          | File       | Contents                                                     |
| ------------- | ---------- | ------------------------------------------------------------ |
| EventMetadata | `event.ts` | EventMetadata value object, EventRequirement value object    |
| EventItem     | `event.ts` | EventItem entity type                                        |
| Zod schemas   | `event.ts` | eventMetadataSchema, eventRequirementSchema, eventItemSchema |

Update `session.ts`: Add `EVENT` to the SessionCategory enum and update the SessionTemplate type to include optional `eventMetadata` field.

Update `workout-log.ts`: Add optional `eventMetadata` field to WorkoutLog type.

### 13.5c. Data adapter methods

Add to the data adapter interface:

| Method                                | Purpose                                  |
| ------------------------------------- | ---------------------------------------- |
| `getEventItems(parentId, parentType)` | Fetch packing list for a template or log |
| `saveEventItem(item)`                 | Create or update a packing list item     |
| `deleteEventItem(itemId)`             | Remove an item from the list             |
| `toggleEventItemPacked(itemId)`       | Toggle isPacked on a single item         |
| `reorderEventItems(items)`            | Batch update sort_order values           |

Implement in both Supabase adapter (browser mode) and Tauri adapter (native mode, when Step 8 is complete).

### 13.5d. Event creation UI

Event creation form accessible from:

- Program builder (Step 12) -- adding an event session to a block week
- Quick-log -- creating a standalone event workout log
- Clone -- duplicating an event template with isPacked reset

Form sections per `10-user-flows.md` §Flow 10:

- Event name (required, underline input)
- Date/time (optional, date + time pickers)
- Location (optional, underline input + coordinates toggle)
- Event URL (optional, underline input)
- Requirements (expandable section, key-value-unit-notes form)
- Packing list (expandable section, name-category-quantity-notes form)

All text uses industrial vocabulary: "ADD REQUIREMENT", "ADD ITEM", "SAVE EVENT"

### 13.5e. Event detail + packing check-off UI

Event detail screen per `10-user-flows.md` §Flow 11:

- Event header with name, date, location, countdown badge
- Location as tappable map link (when coordinates present, opens platform maps)
- Event URL as tappable external link
- Requirements displayed as key-value list in `surface-steel` card
- Packing list as categorized checklist with:
  - Items grouped by `category` value
  - Collapsible category sections
  - Single-tap toggle for isPacked (< 100ms feedback)
  - Progress bar per category and overall (`ember` on `surface-steel` track)
  - Drag-and-drop reorder within categories (dnd-kit)

### 13.5f. Event in program timeline

- Events display with distinct visual treatment in program timeline (⚑ icon, `surface-steel` card with `ember` accent)
- Event date shown alongside the program week/day label
- Countdown badge visible on Today screen when next event is within 30 days

### 13.5g. Event countdown notification

Per `11-notification-design.md` §Type 4:

- New `event_reminders` notification channel (Android)
- Configurable reminder intervals (default: 7 days, 3 days, 1 day before)
- Notification includes packing progress when items exist
- Respects quiet hours
- "VIEW EVENT" action navigates to event detail

### Done when

- [ ] `EVENT` is a valid SessionCategory in domain types
- [ ] event_metadata column exists on session_templates and workout_logs
- [ ] event_items table exists with CHECK constraints and indices
- [ ] Zod schemas validate EventMetadata, EventRequirement, EventItem
- [ ] Data adapter supports getEventItems, saveEventItem, deleteEventItem, toggleEventItemPacked, reorderEventItems
- [ ] Event creation form renders with all fields (name, date, location, URL, requirements, packing list)
- [ ] Event detail screen displays metadata, requirements, and packing list
- [ ] Single-tap packing toggle works with < 100ms feedback
- [ ] Progress indicator updates on pack/unpack
- [ ] Drag-and-drop reorder works for packing list items
- [ ] Events display correctly in program timeline with ⚑ icon
- [ ] Clone operation resets isPacked to false on all items
- [ ] Event countdown notification fires at configured intervals
- [ ] Location renders as tappable map link when coordinates present
- [ ] RLS policies enforce user_id isolation on event_items
- [ ] All text uses industrial vocabulary (no emoji, no exclamation marks)

---

## ═══ PHASE 2 COMPLETE ═══

**Checkpoint:** Users can create programs, build session templates with all 12 SetScheme types, follow structured multi-week periodized programs with percentage-based loading, and log workouts with prescribed-vs-actual tracking. The TB template library provides ready-made programs. All UI follows Iron & Ember design system.

---

## STEP 14: Progress Analytics + PR Detection ✅ COMPLETE

**Dependencies:** Step 7 (workout history exists)
**Priority:** P1
**Docs:** `05-domain-model.md` §Domain Events (PersonalRecordSet), `11-notification-design.md` §Type 3, `DESIGN.md` §4 Progress & Metrics

### What was built

The VAULT screen with progress charts (Recharts), horizontal volume tracking bars, large metric readouts, and automatic PR detection with in-app molten gradient celebration banner and platform notifications.

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

### Done ✅

- [x] 1RM trend chart renders with `arc` / `ember` / `steel-blue` palette
- [x] Volume tracking shows weekly tonnage as horizontal load bars
- [x] Large metrics in Space Grotesk `text-readout`
- [x] PR detection runs after every workout completion
- [x] PR notification fires for new bests
- [x] PR history visible in exercise detail
- [x] VAULT screen renders well on both mobile and desktop viewports
- [x] No circular progress rings -- horizontal bars only

---

## STEP 15: Notification System ✅ COMPLETE

**Dependencies:** Step 9 (Rust backend for background delivery)
**Priority:** P1
**Docs:** `11-notification-design.md` (complete spec)

### What was built

Three notification types: rest timer alerts, session reminders (configurable, disabled by default), and PR celebrations. Notification settings UI with per-type toggles and quiet hours. Android notification channels registered. Industrial vocabulary throughout.

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

### Done ✅

- [x] Session reminder fires at configured time when workout is due
- [x] "EXECUTE" action opens pre-filled workout
- [x] Quiet hours prevent non-timer notifications
- [x] All notification text passes shame-free review
- [x] All notification text uses industrial vocabulary (no exclamation points, no emoji)
- [x] Notification settings screen with per-type toggles and quiet hours

---

## STEP 16: Share Links (Read-Only) ✅ COMPLETE

**Dependencies:** Step 7 (workouts exist to share), Step 11 (programs exist to share)
**Priority:** P1
**Docs:** `02-prd-sharing.md` §Feature 1

### What was built

Share link generation with 12-character cryptographic tokens. Public `/s/$token` route for unauthenticated viewing of programs and workout logs. Clone-to-library for authenticated users. Revocation support (deactivated links return 404).

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

### Done ✅

- [x] "SHARE" button generates a working link
- [x] Shared program viewable without authentication
- [x] Shared workout log viewable without authentication
- [x] "CLONE" copies program to authenticated user's account
- [x] Author can revoke share links
- [x] Revoked links return 404
- [x] Shared view renders with Iron & Ember styling

---

## STEP 17: Accountability Groups + Direct Connections ✅ COMPLETE

**Dependencies:** Step 16 (sharing infrastructure), Step 9 (sync for cross-user data)
**Priority:** P2
**Docs:** `02-prd-sharing.md` §Feature 2 + §Feature 3, `06-invariants.md` §Sharing Invariants

### What was built

Accountability groups with role-based visibility (coach/member), invite codes (AF-XXXXXXXX format), activity feeds, and direct peer connections with per-direction write access. Full RLS policy expansion. Group size limits enforced (max 20 members, 3 coaches, 5 groups per user). Data retention settings per group.

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

### Done ✅

- [x] Group creation with invite code works
- [x] Joining via code adds user as MEMBER
- [x] Coach sees all members' workout logs
- [x] Members see each other's logs but not coach's logs
- [x] Activity feed shows group workouts chronologically
- [x] Private fields (difficulty, bodyweight, notes) excluded from group view
- [x] Direct connection request/accept flow works
- [x] Connection provides mutual log visibility
- [x] RLS policies correctly enforce all access rules
- [x] Group size limits enforced (SH-4)
- [x] Leave group works, data retained per retention setting

---

## STEP 18: Coach Write Access ✅ COMPLETE

**Dependencies:** Step 17 (groups exist with role-based access)
**Priority:** P2
**Docs:** `02-prd-sharing.md` §Feature 2 (Coach Workflow), `06-invariants.md` SH-1 through SH-3

### What was built

Coach write access via RLS policies: create/edit programs and sessions for group members, update member 1RMs. SH-3 enforced (coach cannot modify workout logs). Per-direction write access on direct connections. Member override preserved (SH-2).

### 18a. Coach program creation

- Coach opens group → selects member → "CREATE PROGRAM"
- Standard program builder (from Step 12) with `user_id = member` and `created_by = coach`
- Member receives notification: "COACH ASSIGNED PROGRAM: [name]"

### 18a-ii. Assign existing program to member

A coach can assign a program they already own to a group member. This covers the common workflow where the coach builds a program before the member has signed up -- the program lives under the coach's account until the member joins the group, at which point the coach reassigns it.

The operation is a cascade update of `user_id` on the program and all child records (program blocks, program weeks, session templates, scheduled sessions) from the coach's ID to the member's ID. The `created_by` field remains unchanged (still the coach). After assignment, standard coach write permissions from Step 18a-18e apply -- the coach continues to edit the program, the member logs against it, and the member-always-wins rule (SH-2) governs conflicts.

**UI surface:** In the coach's group member view, alongside "CREATE PROGRAM" add "ASSIGN EXISTING PROGRAM." Coach selects from their own programs, confirms the target member, and the reassignment executes. Member receives notification: "COACH ASSIGNED PROGRAM: [name]."

**RLS requirement:** The acting user must be a coach in a group containing the target member. This is the same permission boundary used by 18a for new program creation -- no new RLS policy needed, just an additional allowed operation under the existing coach write policy.

**Adapter method:**

| Method | Params | Behavior |
|--------|--------|----------|
| `assignProgramToMember` | `programId`, `targetUserId` | Update `user_id` on program and all child records (blocks, weeks, session templates, scheduled sessions) from coach to member. Validate coach role in shared group before executing. |

**Tauri command:**

| Command | Params | Behavior |
|---------|--------|----------|
| `assign_program_to_member` | `program_id`, `target_user_id` | Cascade update `user_id` within a single SQLite transaction. Validate group membership locally. |

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

### Done ✅

- [x] Coach can create program owned by member
- [ ] Coach can assign an existing program they own to a group member (cascade updates user_id on program + children)
- [x] Coach can edit member's upcoming sessions
- [x] Coach can update member's 1RMs
- [x] Member receives notification on coach changes
- [x] Member can modify/delete coach-created programs
- [x] Coach CANNOT modify member's workout logs (SH-3)
- [x] Connection write access works per-direction
- [x] RLS policies correctly scope coach write to programs/templates/sessions only

---

## STEP 19: Runtime Backend Configuration ✅ COMPLETE

**Dependencies:** Step 4 (Supabase adapter + auth), Step 8 (Tauri shell + SQLite). Can be done in parallel with Steps 10-18.
**Priority:** P0 (required before Play Store release)
**Docs:** `03-prd-hosting.md`, `07-architecture.md` §Configuration Layer, `06-invariants.md` §Configuration Invariants

### What was built

Runtime configuration system with lazy Supabase client initialization. Config store (browser: localStorage, Tauri: SQLite `app_config` table). Setup screen at `/setup` for first launch. Connection validator with three-state status. Backend change in Settings with data wipe confirmation for Tauri. Comprehensive test suite (16 cases).

### 19a. Config store interface + implementations

Define a `ConfigStore` interface with methods: `getConfig`, `setConfig`, `clearConfig`, `hasConfig`. Two implementations follow the existing adapter pattern.

| Implementation | Storage                                           | Read Timing                          |
| -------------- | ------------------------------------------------- | ------------------------------------ |
| Browser        | `localStorage` key `ardentforge:config`           | Synchronous                          |
| Tauri          | SQLite `app_config` table (key-value, local-only) | Async via `invoke('get_app_config')` |

The `app_config` table is created in the existing SQLite migration set but is excluded from the sync engine's table list. It has two columns: `key` (TEXT PRIMARY KEY) and `value` (TEXT, JSON string).

New Tauri commands for Step 8's Rust backend:

| Command            | Purpose                                                  |
| ------------------ | -------------------------------------------------------- |
| `get_app_config`   | Read a config key from `app_config`                      |
| `set_app_config`   | Write a config key to `app_config`                       |
| `clear_app_config` | Delete a config key                                      |
| `wipe_synced_data` | Drop and recreate all synced tables (for backend change) |

### 19b. Supabase client lazy initialization

Refactor `src/lib/supabase.ts` from eager module-level initialization to a lazy factory.

Current behavior: `createClient(import.meta.env.VITE_SUPABASE_URL, ...)` runs at import time.

New behavior: A `getSupabaseClient()` function reads from the config store on first call, constructs the client, and caches it. Returns `null` if no config exists. On config change, the cached client is discarded.

The Supabase adapter and all TanStack Query hooks that reference the client are updated to use the factory. The sync engine (Rust) also reads the config store for its Supabase connection.

### 19c. Connection validator

A validation function that takes a URL and publishable key, attempts a lightweight request against the target Supabase instance, and returns a result indicating success, connection failure, or missing schema.

Validation steps: first, hit the REST API root to confirm the instance is reachable and the key is accepted. Second, attempt a simple query against a known table (e.g., `SELECT 1 FROM exercises LIMIT 1`) to confirm the schema is present. The second step distinguishes between "valid Supabase but no Ardent Forge schema" and "fully configured."

### 19d. Backend setup screen

A new route at `/setup` with the Iron & Ember design system. This screen is shown only when no valid configuration exists (first launch with failed defaults, or after config is cleared).

| Element         | Design                                                                |
| --------------- | --------------------------------------------------------------------- |
| Heading         | "CONFIGURE BACKEND" in `text-industrial`                              |
| URL field       | Underline input, placeholder "Supabase URL"                           |
| Key field       | Underline input, placeholder "Publishable Key"                        |
| Validate button | `forge` CTA: "CONNECT"                                                |
| Status          | Inline feedback: connecting spinner, success checkmark, error message |
| Help link       | "Self-hosting? See the setup guide" → links to GitHub docs            |

### 19e. Settings UI: Backend section

Add a "Backend" section to the existing Settings route. Shows current Supabase URL (truncated, with copy button). "CHANGE BACKEND" button opens an edit form identical to the setup screen, but with a confirmation dialog warning about data reset (Tauri only, per CF-3).

| Platform | Change Behavior                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Browser  | Clear auth session → re-validate → persist → redirect to sign-in                                      |
| Tauri    | Confirm dialog → wipe synced SQLite tables → clear auth → re-validate → persist → redirect to sign-in |

### 19f. Root route guard

Add a config check to the TanStack Router root layout. Before the existing auth guard runs, check `configStore.hasConfig()`. If false, redirect to `/setup`. This ensures no part of the app attempts to use a Supabase client before one can be constructed.

### Done ✅

- [x] Config store reads and writes correctly (browser: localStorage, Tauri: SQLite)
- [x] Supabase client initializes lazily from config store
- [x] App with no env vars and no stored config shows setup screen on launch
- [x] App with valid bundled defaults skips setup screen (smart default flow)
- [x] Connection validator distinguishes: reachable + schema present, reachable + no schema, unreachable
- [x] Setup screen validates and persists config, then proceeds to auth
- [x] Settings page shows current backend URL
- [x] Changing backend in browser mode: clears auth, re-validates, persists, redirects to sign-in
- [x] Changing backend in Tauri mode: shows confirmation, wipes synced tables, clears auth, persists
- [x] `app_config` table is never included in sync operations
- [x] Existing workout logging flow works identically after refactor
- [x] All existing tests pass (client initialization change is transparent to consumers)

---

## STEP 20: Docker & Self-Hosting ✅ COMPLETE

**Dependencies:** Step 3 (Supabase migrations exist), Step 19 (runtime config for mobile users connecting to self-hosted instances). Can be done in parallel with Steps 10-18.
**Priority:** P1
**Docs:** `03-prd-hosting.md` §Docker Composition

### What was built

Full Docker Compose stack (9 containers: Postgres, Kong, GoTrue, PostgREST, Realtime, Studio, migration runner, web app via nginx, Caddy for TLS). Key generation script, `.env.example`, Caddyfile, multi-stage web app Dockerfile, idempotent migration runner, and comprehensive self-hosting documentation covering both Docker and Supabase Cloud paths.

Docker Compose configuration for one-command self-hosted deployment, plus self-hosting documentation.

### 20a. Docker Compose file

A `docker-compose.yml` at the repository root that provisions the full stack. Based on Supabase's official self-hosted Compose file with two additions: a migration init container and a web app container.

| Container        | Source                                     | Notes                                                                               |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Supabase stack   | Official `supabase/docker`                 | Postgres, Kong, GoTrue, PostgREST, Realtime, Studio                                 |
| Migration runner | `supabase/cli`                             | Runs `supabase db push` against local Postgres using `service_role` key, then exits |
| Web app          | Multi-stage Dockerfile (Bun build → nginx) | Serves Vite production build, build-time env vars from Compose `.env`               |
| Caddy            | `caddy:alpine`                             | Reverse proxy, automatic TLS via Let's Encrypt                                      |

### 20b. Environment configuration

Create `.env.example` with all required variables, default values where safe, and comments explaining each. Include a shell script (`scripts/generate-keys.sh`) that generates the JWT secret and derives the anon and service_role keys using the Supabase key generation algorithm.

### 20c. Web app Dockerfile

Multi-stage build:

| Stage | Base              | Purpose                                                                |
| ----- | ----------------- | ---------------------------------------------------------------------- |
| Build | `oven/bun:latest` | `bun install` + `bun run build` with env vars                          |
| Serve | `nginx:alpine`    | Copy build output to nginx html dir, custom nginx.conf for SPA routing |

The nginx config handles SPA fallback (all routes → `index.html`) and sets appropriate cache headers (hashed assets: immutable, `index.html`: no-cache).

### 20d. Migration init container

A lightweight container that waits for Postgres to be healthy (via `pg_isready`), then applies all migrations from `supabase/migrations/`. Uses the `service_role` key from the Compose `.env`. Exits with code 0 on success, allowing dependent containers to start.

On subsequent runs, already-applied migrations are skipped (Supabase CLI tracks applied migrations in a `schema_migrations` table).

### 20e. Caddy configuration

A `Caddyfile` that routes traffic:

| Path                                         | Target                      |
| -------------------------------------------- | --------------------------- |
| `/` and static assets                        | Web app container (nginx)   |
| `/rest/v1/*`, `/auth/v1/*`, `/realtime/v1/*` | Kong (Supabase API gateway) |
| `/studio/*` (optional)                       | Supabase Studio             |

Caddy handles TLS automatically via Let's Encrypt using the `SITE_URL` from `.env`.

### 20f. Self-hosting documentation

A `docs/self-hosting.md` file (or a section in the main README) covering both deployment paths.

**Docker path:** Prerequisites, clone, configure `.env`, generate keys, `docker compose up -d`, verify. Includes a troubleshooting section for common issues (port conflicts, DNS, TLS).

**Supabase Cloud path:** Prerequisites, create project, link, push schema, deploy web app, configure mobile app. Shorter since Supabase handles infrastructure.

Both paths end with: "To connect the Play Store app, open Settings → Backend and enter your instance URL and publishable key."

### 20g. Health check and monitoring

Add health check endpoints to the Docker containers so `docker compose ps` shows meaningful status. The web app container health check is a simple HTTP GET to `/`. The migration runner has no health check (it exits).

### Done ✅

- [x] `docker compose up -d` starts all containers from a clean state
- [x] Migration runner applies schema and exits cleanly
- [x] Web app loads at `SITE_URL` with Iron & Ember design
- [x] User can register, sign in, and log a workout via the web interface
- [x] Play Store app connects to Docker-hosted instance after configuring URL in Settings
- [x] Supabase Studio accessible at `SITE_URL/studio` (when enabled)
- [x] `docker compose down && docker compose up -d` is idempotent (data persists, migrations don't re-run)
- [x] `.env.example` documents all variables with comments
- [x] `scripts/generate-keys.sh` produces valid JWT secret and derived keys
- [x] Self-hosting docs cover both Docker and Supabase Cloud paths
- [x] Caddy handles TLS automatically

---

## STEP 21: Chat Data Layer

**Dependencies:** Step 4 (data adapter pattern), Step 9 (sync engine for offline message queueing), Step 17 (accountability groups + direct connections for relationship checks)
**Priority:** P2
**Docs:** `12-prd-chat.md` §Data Model + §Social Model Integration, `06-invariants.md` §Chat Invariants, `08-erd.md`

### What to build

Database tables, RLS policies, data adapter extension, and Zod schemas for the chat domain. No UI in this step -- this is pure data plumbing.

### 21a. Supabase schema additions

Create four new tables via migrations: `conversations`, `conversation_participants`, `messages`, `media_attachments`. All column definitions per `12-prd-chat.md` §Data Model.

Key constraints:

| Table                       | Constraint                                                        | Invariant |
| --------------------------- | ----------------------------------------------------------------- | --------- |
| `conversations`             | CHECK (type IN ('direct', 'group'))                               | --        |
| `conversation_participants` | UNIQUE (conversation_id, user_id)                                 | CH-2      |
| `conversation_participants` | Unique partial index on participant pair for direct conversations | CH-2      |
| `messages`                  | CHECK (message_type IN ('text', 'workout', 'media', 'system'))    | --        |
| `messages`                  | INDEX on (conversation_id, created_at)                            | CH-5      |
| `media_attachments`         | CHECK (provider IN ('cloudflare_stream', 'supabase_storage'))     | --        |
| `media_attachments`         | CHECK (status IN ('processing', 'ready', 'failed'))               | --        |

### 21b. RLS policies

All four tables get Row Level Security enabled. Policies enforce CH-1 (conversation access requires participation):

| Table                       | Operation | Policy                                                                      |
| --------------------------- | --------- | --------------------------------------------------------------------------- |
| `conversations`             | SELECT    | User has active (non-departed) row in `conversation_participants`           |
| `conversation_participants` | SELECT    | User is a participant in the same conversation                              |
| `conversation_participants` | INSERT    | User is adding themselves, or is a participant adding to a group they're in |
| `messages`                  | SELECT    | User participates in the message's conversation                             |
| `messages`                  | INSERT    | User participates in conversation AND `left_at` IS NULL                     |
| `media_attachments`         | SELECT    | Inherits from parent message's conversation participation check             |
| `media_attachments`         | INSERT    | User participates in the parent message's conversation                      |

### 21c. SQLite schema additions (Tauri)

Create matching tables in the SQLite migration set. The `messages` table gains an additional `sync_status` column (TEXT, default 'synced', CHECK IN ('pending', 'synced', 'failed')) that exists only in SQLite, not in Postgres. This column drives the offline message queueing state machine.

New Tauri commands:

| Command                 | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `create_conversation`   | Insert conversation + initial participants        |
| `get_conversations`     | Query user's conversations, ordered by updated_at |
| `get_conversation`      | Get single conversation with participants         |
| `send_message`          | Insert message to SQLite with sync_status pending |
| `get_messages`          | Query messages for a conversation, paginated      |
| `update_last_read`      | Set last_read_at for a participant                |
| `get_unread_counts`     | Count unread messages per conversation            |
| `leave_conversation`    | Set left_at on participant record                 |
| `save_media_attachment` | Insert or update media attachment metadata        |
| `toggle_archive`        | Set is_archived on participant record             |

### 21d. Chat adapter interface

Extend the data adapter interface with a `ChatAdapter` facet. This follows the same pattern as the existing data adapter -- interface definition in `src/domain/`, Supabase and Tauri implementations in their respective adapter directories.

| Method                   | Return Type               | Description                                   |
| ------------------------ | ------------------------- | --------------------------------------------- |
| `createConversation`     | `Conversation`            | Create direct or group conversation           |
| `getConversations`       | `Conversation[]`          | All user's conversations, sorted by recency   |
| `getConversation`        | `Conversation`            | Single conversation with participants         |
| `findDirectConversation` | `Conversation \| null`    | Find existing direct conversation with a user |
| `sendMessage`            | `Message`                 | Persist a new message                         |
| `getMessages`            | `Message[]`               | Paginated messages for a conversation         |
| `getMessagesSince`       | `Message[]`               | Messages newer than a timestamp (catch-up)    |
| `updateLastRead`         | `void`                    | Update read cursor for current user           |
| `getUnreadCounts`        | `Map<string, number>`     | Unread counts per conversation                |
| `addParticipant`         | `ConversationParticipant` | Add user to group conversation                |
| `leaveConversation`      | `void`                    | Set left_at on current user's participation   |
| `toggleArchive`          | `void`                    | Toggle is_archived flag                       |
| `saveMediaAttachment`    | `MediaAttachment`         | Create or update media attachment record      |

### 21e. Zod schemas

New schema files in `src/domain/`:

| File              | Contents                                                                      | Source Doc                 |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------- |
| `conversation.ts` | Conversation, ConversationType, ConversationParticipant                       | 12-prd-chat.md §Data Model |
| `message.ts`      | Message, MessageType, WorkoutSnapshot (value object), SyncStatus (local-only) | 12-prd-chat.md §Messaging  |
| `media.ts`        | MediaAttachment, MediaProvider, MediaType, MediaStatus                        | 12-prd-chat.md §Data Model |

The `WorkoutSnapshot` schema reuses existing exercise, set scheme, and logged set schemas but wraps them in a self-contained structure suitable for JSON serialization into the message content field.

### 21f. Sync engine extension

Extend the Rust sync engine to include the four chat tables in the sync boundary. Messages use the `sync_status` column for offline queueing:

- On send while offline: insert to SQLite with `sync_status = 'pending'`
- On connectivity restored: push pending messages to Supabase, set `sync_status = 'synced'` with server-assigned timestamp
- On push failure after retries: set `sync_status = 'failed'`

The sync engine treats messages as append-only (CH-7). No update or delete sync needed for messages in the initial release.

Media attachment records sync metadata only (URLs, status, thumbnail URL). Binary files are never synced to SQLite (CH-6).

### Done when

- [ ] All four tables created via Supabase migration
- [ ] RLS policies enforce conversation membership on all operations
- [ ] Unauthenticated requests to chat tables rejected
- [ ] User can only read messages in conversations they participate in
- [ ] Direct conversation uniqueness constraint prevents duplicates
- [ ] SQLite tables mirror Postgres schema (plus `sync_status` on messages)
- [ ] All Tauri commands work: CRUD for conversations, messages, participants
- [ ] Chat adapter interface defined with all methods
- [ ] Supabase adapter implements all chat methods
- [ ] Tauri adapter implements all chat methods via Tauri commands
- [ ] Zod schemas validate conversation, message, and media attachment types
- [ ] WorkoutSnapshot schema serializes/deserializes from existing workout types
- [ ] Sync engine pushes pending messages on reconnect
- [ ] Sync engine pulls new messages on reconnect (catch-up query)
- [ ] `domain/` chat types have zero React or framework dependencies

---

## STEP 22: Supabase Realtime Integration

**Dependencies:** Step 21 (chat tables and adapter exist)
**Priority:** P2
**Docs:** `12-prd-chat.md` §Message Ordering and Delivery, `07-architecture.md` §Supabase Realtime Integration

### What to build

Real-time message delivery via Supabase Realtime Broadcast. Typing indicators. Catch-up-then-subscribe reconnection pattern.

### 22a. Broadcast channel management

Each conversation maps to a private Supabase Realtime Broadcast channel. The channel topic is the conversation ID. The app subscribes to channels for all active conversations when the chat feature is entered, and unsubscribes when the user leaves chat.

Channel lifecycle:

| Event                     | Action                                                                     |
| ------------------------- | -------------------------------------------------------------------------- |
| User opens chat list      | Subscribe to channels for all conversations with unread or recent activity |
| User opens a conversation | Subscribe to that conversation's channel (if not already subscribed)       |
| User leaves chat          | Unsubscribe from all channels (conserve connections)                       |
| App backgrounds           | Unsubscribe from all channels                                              |
| App foregrounds           | Run catch-up query, then re-subscribe                                      |
| New conversation created  | Subscribe to the new channel                                               |
| User leaves conversation  | Unsubscribe from that channel                                              |

### 22b. Message delivery events

When a user sends a message, two things happen simultaneously:

1. The message is inserted into the `messages` table via the chat adapter (persistence).
2. A Broadcast event is sent on the conversation's channel with the message payload (real-time notification).

Connected participants receive the Broadcast event and append the message to their local conversation view. The Broadcast event is a lightweight notification -- recipients verify the message exists in their local store (or fetch it) rather than relying solely on the Broadcast payload.

Event payload:

| Field             | Type   | Description                                         |
| ----------------- | ------ | --------------------------------------------------- |
| `type`            | string | `'message'`                                         |
| `message_id`      | string | UUID of the new message                             |
| `conversation_id` | string | UUID of the conversation                            |
| `sender_id`       | string | UUID of the sender                                  |
| `message_type`    | string | `'text'`, `'workout'`, `'media'`, `'system'`        |
| `preview`         | string | First 100 characters of content (for notifications) |
| `created_at`      | string | Server timestamp (ISO 8601)                         |

### 22c. Typing indicators

Typing indicators are ephemeral Broadcast events on the same channel. They are never persisted.

| Field       | Type   | Description                |
| ----------- | ------ | -------------------------- |
| `type`      | string | `'typing'`                 |
| `user_id`   | string | UUID of the typing user    |
| `user_name` | string | Display name for rendering |

The sender emits a typing event on each keystroke, debounced to at most once per 2 seconds. Recipients display the typing indicator for 3 seconds after the last received typing event, then clear it. No typing indicator is shown for the user's own input.

### 22d. Catch-up-then-subscribe pattern

On app foreground or reconnection:

1. For each conversation the user participates in, query `getMessagesSince(conversation_id, last_read_at)`.
2. Insert any missed messages into the local store.
3. Update unread counts.
4. Subscribe to Broadcast channels for live updates.

This ordering ensures no messages are missed during the gap between offline and subscription. The catch-up query uses the `last_read_at` cursor from `conversation_participants` to avoid re-fetching already-seen messages.

### 22e. TanStack Query integration

| Hook                  | Query Key                                    | Adapter Method / Realtime                               |
| --------------------- | -------------------------------------------- | ------------------------------------------------------- |
| `useConversations`    | `['conversations']`                          | `getConversations`                                      |
| `useConversation`     | `['conversation', id]`                       | `getConversation`                                       |
| `useMessages`         | `['messages', conversationId, cursor]`       | `getMessages` (infinite query)                          |
| `useUnreadCounts`     | `['unread-counts']`                          | `getUnreadCounts`                                       |
| `useSendMessage`      | mutation, invalidates `['messages', convId]` | `sendMessage` + Broadcast                               |
| `useRealtimeMessages` | -- (side effect)                             | Broadcast subscription, appends to `['messages']` cache |

The `useMessages` hook uses TanStack Query's infinite query pattern for cursor-based pagination (load older messages on scroll-up). New messages from Realtime are appended to the newest page.

### 22f. Tauri-specific considerations

In Tauri mode, the Realtime subscription can run either in the WebView (via the Supabase JS client, same as browser mode) or in the Rust backend via a native WebSocket client. The simpler approach -- using the WebView's Supabase client -- is recommended for the initial release. The Rust-native approach is only needed if WebView backgrounding kills the WebSocket connection on Android; if so, the Rust backend can maintain the connection and forward events to the WebView via Tauri events.

Test the WebView approach first. If WebSocket connections drop on Android background, add a Rust-side keepalive as a follow-up.

### Done when

- [ ] Broadcast channel subscribes per conversation on chat entry
- [ ] Sending a message triggers both DB insert and Broadcast event
- [ ] Remote messages appear in < 500ms for connected participants
- [ ] Typing indicator shows when remote user is composing
- [ ] Typing indicator clears after 3 seconds of inactivity
- [ ] Catch-up query fetches missed messages on reconnect
- [ ] No duplicate messages after catch-up + subscription overlap
- [ ] Channel subscriptions cleaned up on chat exit and app background
- [ ] Unread counts update in real time when messages arrive
- [ ] TanStack Query infinite query loads older messages on scroll-up
- [ ] Works in both browser mode and Tauri WebView

---

## STEP 23: Chat UI

**Dependencies:** Step 22 (Realtime working), Step 1.5 (Iron & Ember design system)
**Priority:** P2
**Docs:** `12-prd-chat.md` §Conversation Types + §Messaging + §Blocking, `10-user-flows.md` §Chat Flows, `DESIGN.md`

### What to build

The most time-intensive chat step. Conversation list, conversation detail with virtualized message list, compose bar, system messages, unread indicators, and blocking. All UI follows Iron & Ember: dark-only, zero border-radius, tonal surface layering.

### 23a. Navigation: COMMS tab

Add a fifth tab to the bottom navigation (mobile) and sidebar (desktop):

| Icon                     | Label | Route    |
| ------------------------ | ----- | -------- |
| `chat` (Material Symbol) | COMMS | `/comms` |

Update the nav from 4 items to 5. Mobile bottom nav touch targets remain >= 48px. Desktop sidebar adds the item below VAULT.

### 23b. Conversation list screen (`/comms`)

Displays all conversations the user participates in, sorted by most recent activity (`updated_at` descending).

| Element              | Design                                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| Conversation row     | `surface-iron` card, zero border-radius                                        |
| Avatar / group icon  | 40px circle on `surface-steel` -- initials for direct, group icon for group    |
| Title                | Space Grotesk `text-label-large` -- other user's name or group title           |
| Last message preview | Inter `body-small`, truncated to one line, `text-secondary` color              |
| Timestamp            | Inter `label-small`, right-aligned, relative time ("3m", "2h", "Yesterday")    |
| Unread indicator     | `ember` dot (8px circle) next to timestamp, title rendered bold                |
| Empty state          | "NO ACTIVE CHANNELS" centered, `text-secondary`, with "START CONVERSATION" CTA |

### 23c. New conversation flow

- "NEW" button (top-right, `forge` CTA) opens a contact picker
- Contact picker shows friends and group members from existing connections
- Single selection → create direct conversation (or navigate to existing per CH-2)
- Multi-selection (3+ users) → create ad-hoc group with title prompt
- Group conversations linked to a group entity are created from the group detail screen, not from the contact picker

### 23d. Conversation detail screen (`/comms/:id`)

The core chat view. A virtualized message list with a compose bar at the bottom.

**Header:**

| Element           | Design                                                            |
| ----------------- | ----------------------------------------------------------------- |
| Back button       | `arrow_back` icon, navigates to conversation list                 |
| Title             | Space Grotesk `text-label-large` -- conversation name             |
| Participant count | Inter `label-small`, `text-secondary` -- "(4 members)" for groups |
| Menu              | `more_vert` icon → actions (leave, archive, block for direct)     |

**Message list:**

| Element           | Design                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Own messages      | Right-aligned bubbles on `surface-steel` background                                         |
| Other messages    | Left-aligned bubbles on `surface-iron` background                                           |
| Sender name       | Inter `label-small` in `ember` above the bubble (group conversations only)                  |
| Timestamp         | Inter `label-small`, `text-secondary`, shown on first message of a time cluster (5-min gap) |
| System messages   | Centered, no bubble, Inter `body-small` in `text-secondary`                                 |
| Pending indicator | `schedule` Material Symbol next to own pending messages                                     |
| Date separator    | Centered date label on `surface-charcoal` -- "TODAY", "YESTERDAY", or formatted date        |

The message list uses virtualization (e.g., `@tanstack/react-virtual`) for performance with large conversation histories. Scroll position anchors to the bottom on new messages. Scrolling up loads older messages via the infinite query (Step 22e).

**Compose bar:**

| Element           | Design                                                        |
| ----------------- | ------------------------------------------------------------- |
| Container         | Sticky bottom, `surface-anvil` background, zero border-radius |
| Text input        | Underline input, placeholder "Message..." in `text-secondary` |
| Send button       | `send` Material Symbol, `ember` color when input has content  |
| Attachment button | `attach_file` Material Symbol, opens attachment picker        |
| Typing indicator  | Above compose bar: "[Name] is typing..." animated dots        |

### 23e. Attachment picker

Triggered by the attachment button in the compose bar. Presents options relevant to the current conversation:

| Option  | Icon             | Action                                                 |
| ------- | ---------------- | ------------------------------------------------------ |
| Video   | `videocam`       | Opens device camera/gallery for video (<=60s, <=50 MB) |
| Photo   | `photo_camera`   | Opens device camera/gallery for image (<=10 MB)        |
| Workout | `fitness_center` | Opens workout picker (from Step 24)                    |
| File    | `description`    | Opens file picker for documents (<= 25 MB)             |

The picker is a bottom sheet (mobile) or dropdown (desktop), styled with `surface-steel` cards.

### 23f. Blocking UI

- Block action available from conversation header menu (direct conversations) or from a user's profile
- Block confirmation dialog: "Block [Name]? Their messages will be hidden in all conversations."
- Blocked user's messages filtered client-side (not deleted from DB)
- Blocked indicator in direct conversation: "This conversation is blocked. Unblock to resume."
- Unblock available from Settings or from the blocked conversation

### 23g. Group conversation management

- Participant list viewable from conversation header (tap participant count or from menu)
- Add participant: "ADD MEMBER" button (group conversations only), opens contact picker filtered to friends not already in the conversation
- Leave confirmation dialog: "Leave this conversation? You won't receive new messages."
- System messages generated for join/leave events

### Done when

- [ ] COMMS tab appears in bottom nav (mobile) and sidebar (desktop) with `chat` icon
- [ ] Conversation list shows all conversations sorted by recency
- [ ] Unread indicator (ember dot + bold) shows for conversations with new messages
- [ ] Empty state renders when user has no conversations
- [ ] New direct conversation creates or navigates to existing (CH-2)
- [ ] New ad-hoc group conversation creates with title prompt
- [ ] Message bubbles render: own (right, `surface-steel`), other (left, `surface-iron`)
- [ ] System messages render centered without bubble
- [ ] Sender names shown in group conversations, hidden in direct
- [ ] Timestamps cluster correctly (5-minute gap rule)
- [ ] Date separators show between day boundaries
- [ ] Pending messages show clock icon, re-sort on sync
- [ ] Compose bar: send button, attachment button, underline input
- [ ] Typing indicator appears and clears correctly
- [ ] Message list virtualized -- smooth scrolling with 500+ messages
- [ ] Scroll-up loads older messages (infinite query)
- [ ] Block/unblock works, blocked messages hidden
- [ ] Group participant list viewable
- [ ] Add participant and leave conversation work
- [ ] Touch targets >= 48px on all interactive elements
- [ ] All UI follows Iron & Ember: zero border-radius, tonal layering, industrial vocabulary

---

## STEP 24: Workout Sharing in Chat

**Dependencies:** Step 23 (chat UI exists), Step 6 (workout log display components)
**Priority:** P2
**Docs:** `12-prd-chat.md` §Workout Sharing, `10-user-flows.md` §Flow: Share a Workout to Chat

### What to build

Share workout logs, programs, and templates into conversations as frozen snapshots. Render shared workouts as cards within chat bubbles.

### 24a. Workout snapshot serializer

A function that takes a WorkoutLog, Program, or SessionTemplate and produces a self-contained `WorkoutSnapshot` JSON payload. The snapshot includes all data needed to render the workout card without any database lookups: exercise names, sets with reps/weight/percentage, rest periods, notes, and duration.

| Source Entity   | Snapshot Contents                                                      |
| --------------- | ---------------------------------------------------------------------- |
| WorkoutLog      | Date, duration, exercises with logged sets (actual values), notes      |
| Program         | Name, block/week structure, session names, exercise lists              |
| SessionTemplate | Name, activity groups, exercises, set schemes with resolved parameters |

The snapshot never includes the source entity's ID or user ID. It is a value object with no identity or foreign key references.

### 24b. Workout picker (from chat attachment)

When the user taps the "Workout" option in the attachment picker:

- Show a list of recent workout logs (last 20), programs, and templates
- Segmented control: "LOGS" / "PROGRAMS" / "TEMPLATES" -- flat `surface-steel` badges
- Each item shows: name/date, exercise summary, duration (for logs)
- Tap to select → confirmation → message created with `message_type = 'workout'`

### 24c. Share-from-detail flow

A "SHARE" button on workout log detail, program detail, and session template detail screens. Tapping opens a conversation picker (list of user's conversations). Select conversation → snapshot created → message sent.

### 24d. Workout card message rendering

Workout-type messages render as a card within the chat bubble:

| Element        | Design                                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| Card container | `surface-charcoal` inside the message bubble, zero border-radius              |
| Header         | Space Grotesk `text-label-large`: "WORKOUT LOG" / "PROGRAM" / "TEMPLATE"      |
| Title / date   | Exercise names or program name, date if workout log                           |
| Summary        | Inter `body-small`: set count, volume, duration                               |
| Expand action  | "VIEW DETAILS" text button in `ember` -- expands to full set-by-set breakdown |

The expanded view reuses existing workout display components from Step 6, rendered inline within the chat conversation. The card collapses on a second tap.

### Done when

- [ ] Workout snapshot serializes WorkoutLog, Program, and SessionTemplate
- [ ] Snapshot contains all rendering data -- no DB lookups needed to display
- [ ] Workout picker shows recent logs, programs, and templates
- [ ] Selecting a workout creates a message with `message_type = 'workout'`
- [ ] Share-from-detail flow works on workout log, program, and template screens
- [ ] Workout card renders inside chat bubble with correct Iron & Ember styling
- [ ] "VIEW DETAILS" expands to full set-by-set breakdown
- [ ] Workout cards display correctly offline (snapshot is self-contained)
- [ ] Snapshot does not include source entity ID or user ID (privacy)

---

## STEP 25: Video + Image Sharing

**Dependencies:** Step 23 (chat UI with attachment picker exists)
**Priority:** P2
**Docs:** `12-prd-chat.md` §Media Sharing + §Video Platform Integration, `07-architecture.md` §Media Provider Interface + §Edge Functions

### What to build

Cloudflare Stream integration for video, Supabase Storage for images. Client-side upload with progress, inline playback, and signed URL access control.

### 25a. Cloudflare Stream account setup

- Create Cloudflare Stream account
- Generate API token with Stream write permissions
- Store API token as a Supabase Vault secret (accessible from Edge Functions)
- Configure webhook URL pointing to the `chat-media-webhook` Edge Function

### 25b. Media provider interface

Define a `MediaProvider` interface in `src/domain/` that abstracts the video platform:

| Method                       | Return Type        | Description                                    |
| ---------------------------- | ------------------ | ---------------------------------------------- |
| `getUploadUrl(metadata)`     | `{ url, assetId }` | Get a direct creator upload URL for the client |
| `getPlaybackUrl(assetId)`    | `string`           | Get the HLS manifest URL for playback          |
| `getSignedUrl(assetId, ttl)` | `string`           | Get a time-limited signed playback URL         |
| `deleteAsset(assetId)`       | `void`             | Delete a video asset from the provider         |

The initial implementation is `CloudflareStreamProvider`. The interface allows swapping to Mux later without changing the chat layer.

### 25c. Edge Function: `chat-media-upload-url`

An authenticated Supabase Edge Function that:

1. Verifies the caller is authenticated
2. Validates upload parameters (max duration: 60s, max size: 50 MB)
3. Calls the Cloudflare Stream API to create a direct creator upload URL (TUS endpoint)
4. Returns the upload URL and asset ID to the client

The function reads the Stream API token from Supabase Vault. The client never sees the API token.

### 25d. Edge Function: `chat-media-webhook`

A webhook receiver for Cloudflare Stream transcoding events:

| Stream Event      | Action                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| `ready.to.stream` | Update `media_attachments` record: status → 'ready', set thumbnail URL |
| `encoding.failed` | Update `media_attachments` record: status → 'failed'                   |

The webhook validates the incoming request using a shared secret. On status update, a Broadcast event is sent on the conversation's channel to notify connected participants that the video is playable.

### 25e. Client-side video upload flow

1. User selects or records a video via the attachment picker (Step 23e)
2. Client validates constraints: duration <= 60s, size <= 50 MB, format is MP4/MOV/WebM
3. Client calls `chat-media-upload-url` Edge Function → receives TUS upload URL + asset ID
4. Client creates a `messages` record with `message_type = 'media'` and a `media_attachments` record with `status = 'processing'`
5. Client uploads video to Cloudflare Stream via TUS protocol (resumable, shows progress)
6. Upload progress displayed as a horizontal progress bar in `ember` on `surface-steel` track inside the message bubble
7. When transcoding completes (webhook → DB update → Broadcast event), the message bubble updates to show a playable thumbnail

Upload error handling:

| Error               | Behavior                                                            |
| ------------------- | ------------------------------------------------------------------- |
| File too large      | Reject before upload with inline error: "Video exceeds 50 MB limit" |
| Duration too long   | Reject before upload: "Video exceeds 60 second limit"               |
| Upload fails midway | Retry up to 3 times (TUS is resumable); show "RETRY" button         |
| Transcoding fails   | Show `error` icon: "Processing failed. Tap to retry."               |
| Transcoding timeout | After 5 minutes with no webhook, set status to 'failed'             |

### 25f. Client-side image upload flow

1. User selects or captures an image via attachment picker
2. Client validates: size <= 10 MB, format is JPEG/PNG/WebP/HEIC
3. Client uploads to Supabase Storage bucket `chat-images` using the Supabase client
4. On upload complete, create message with `message_type = 'media'` and `media_attachments` record with `status = 'ready'` (no transcoding needed)

Supabase Storage RLS on the `chat-images` bucket: authenticated users can upload; download is allowed for users who participate in the message's conversation (enforced via signed URLs).

### 25g. Client-side file upload flow

1. User selects a file via the attachment picker (Step 23e)
2. Client validates constraints: size <= 25 MB, extension is in the allowed list (PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, ZIP), blocked extensions (exe, bat, sh, cmd, ps1, msi, app, dmg, jar, com, scr, vbs, wsf) are rejected
3. Client uploads to Supabase Storage bucket `chat-files` using the Supabase client
4. On upload complete, create message with `message_type = 'file'` and a `media_attachments` record with `status = 'ready'`, `original_filename`, and `mime_type` populated
5. File card renders immediately in the conversation on success

Upload error handling:

| Error                   | Behavior                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| File too large          | Reject before upload with inline error: "File exceeds 25 MB limit" |
| Blocked extension       | Reject before upload: "File type not allowed"                      |
| Format not in allowlist | Reject before upload: "Unsupported file type"                      |
| Upload fails            | Retry up to 3 times; show "RETRY" button on persistent failure     |

Supabase Storage RLS on the `chat-files` bucket: authenticated users can upload; download requires participation in the message's conversation (enforced via signed URLs).

### 25h. Media message rendering

| Media Status  | Rendering                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------- |
| Processing    | Pulsing placeholder rectangle on `surface-charcoal`, "PROCESSING..." label                |
| Ready (video) | Thumbnail image with `play_circle` overlay icon in `ember`, tap to play                   |
| Ready (image) | Inline image preview (max-width 280px), tap to expand full-screen                         |
| Ready (file)  | File card: document-type icon, original filename, file size, "DOWNLOAD" button in `ember` |
| Failed        | `error` icon with "FAILED" label, "RETRY" text button in `ember`                          |

Video playback: open in an inline player within the conversation. The player uses Cloudflare Stream's embedded player or hls.js with the HLS manifest URL. Player controls match Iron & Ember palette. Full-screen toggle available.

### 25i. Signed URL access control

When a participant taps to play a video, the client requests a signed playback URL from a Supabase Edge Function. The Edge Function:

1. Verifies the caller participates in the message's conversation
2. Calls Cloudflare Stream to generate a signed URL with 1-hour TTL
3. Returns the signed URL to the client

The signed URL is cached client-side for its TTL to avoid redundant Edge Function calls on repeated playback.

### Done when

- [ ] Cloudflare Stream account configured with API token in Supabase Vault
- [ ] `chat-media-upload-url` Edge Function returns valid TUS upload URL
- [ ] `chat-media-webhook` Edge Function processes transcoding events
- [ ] Video upload from mobile: select/record → progress bar → playable thumbnail
- [ ] Video upload constraints enforced (60s, 50 MB)
- [ ] Image upload to Supabase Storage works
- [ ] Image constraints enforced (10 MB)
- [ ] Processing state renders pulsing placeholder
- [ ] Ready state renders playable thumbnail (video) or inline preview (image)
- [ ] Failed state renders with retry option
- [ ] Video plays inline with hls.js or Cloudflare player
- [ ] Signed URL access control prevents unauthorized playback
- [ ] Media uploads only work online -- offline attempt shows clear message
- [ ] Thumbnails cached locally for offline display
- [ ] Media provider interface defined; Cloudflare implementation is swappable
- [ ] All media UI follows Iron & Ember palette
- [ ] File upload to Supabase Storage `chat-files` bucket works
- [ ] File constraints enforced (25 MB, allowed formats, blocked extensions)
- [ ] File card renders with document-type icon, original filename, size, and download button
- [ ] File upload only works online -- offline attempt shows clear message
- [ ] `original_filename` and `mime_type` stored in `media_attachments` record
- [ ] File messages render with `message_type = 'file'`

---

## STEP 26: Message Retention + Archiving

**Dependencies:** Step 21 (chat tables exist)
**Priority:** P3
**Docs:** `12-prd-chat.md` §Message Retention

### What to build

Automated 90-day message cleanup with per-conversation opt-in archiving. Can be built in parallel with Steps 22-25 since it only depends on the data layer.

### 26a. Retention cleanup function

A Supabase Edge Function (`chat-retention-cleanup`) or pg_cron job that runs daily and:

1. Identifies messages older than 90 days
2. For each candidate message, checks whether any participant in the message's conversation has `is_archived = true`
3. If no participant has archived → delete the message and its `media_attachments`
4. For deleted media attachments with `provider = 'cloudflare_stream'`, call the Cloudflare Stream API to delete the video asset
5. For deleted media attachments with `provider = 'supabase_storage'`, delete the file from the appropriate bucket (`chat-images` for images, `chat-files` for document files)

The function runs with `service_role` permissions (bypasses RLS). It processes messages in batches (100 per iteration) to avoid long-running transactions.

### 26b. Orphan media cleanup

A secondary check for media attachments whose parent message no longer exists (edge case from race conditions or manual deletion):

1. Query `media_attachments` where no matching `messages` row exists
2. Delete from Cloudflare Stream / Supabase Storage
3. Delete the orphan `media_attachments` record

### 26c. Archive toggle UI

In the conversation header menu (the `more_vert` dropdown from Step 23d):

| Action    | Label                  | Behavior                                                       |
| --------- | ---------------------- | -------------------------------------------------------------- |
| Archive   | "ARCHIVE CONVERSATION" | Sets `is_archived = true`, toast: "Messages will be preserved" |
| Unarchive | "REMOVE ARCHIVE"       | Sets `is_archived = false`, toast: "90-day retention applies"  |

The archive state is per-user, per-conversation. One user archiving does not affect another user's retention. The archive toggle is a simple boolean flip on the `conversation_participants` record.

Archived conversations display an `archive` Material Symbol badge next to the title in the conversation list.

### 26d. Retention info in settings

Add a brief explanation in Settings → Data section: "Chat messages are automatically deleted after 90 days. Archive a conversation to keep its messages indefinitely."

### Done when

- [ ] Retention cleanup runs daily (Edge Function or pg_cron)
- [ ] Messages older than 90 days are deleted when no participant has archived
- [ ] Archived conversations are exempt from retention cleanup
- [ ] Cloudflare Stream assets deleted when their message is deleted
- [ ] Supabase Storage images deleted when their message is deleted
- [ ] Supabase Storage document files deleted when their message is deleted
- [ ] Orphan media attachments cleaned up
- [ ] Archive toggle works from conversation menu
- [ ] Archive badge shows in conversation list
- [ ] Retention explanation in Settings → Data
- [ ] Retention function is idempotent (safe to run multiple times)

---

## ═══ PHASE 6 COMPLETE ═══

**Checkpoint:** Users can send text messages in direct and group conversations. Workouts can be shared as frozen snapshots with inline card rendering. Videos (<= 60s lift critique clips) and images can be shared with inline playback. Messages auto-delete after 90 days unless archived. All chat respects the existing social model: friend connections, group membership, and coach/member relationships. Chat visibility is independent of group member list visibility.

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
- Coach builds program under own account → member signs up and joins group → coach assigns program to member → member sees program in their library → member logs workout → coach sees completion

### Milestone 6: First Chat Message (after Step 23)

- User A sends text message to User B → B sees it in < 1 second
- User A sends message while offline → clock icon shown → message delivers on reconnect
- Verify Iron & Ember chat bubble styling on actual mobile device

### Milestone 7: Workout Shared in Chat (after Step 24)

- User A logs a workout → shares to conversation with User B → B sees workout card → B taps "VIEW DETAILS" → full set-by-set breakdown renders inline

### Milestone 8: Lift Critique Video (after Step 25)

- User A records a 30-second squat video → shares to group chat → video uploads with progress bar → transcoding completes → all group members can play the video inline

---

## Timeline Mapping

| Step                                  | Priority | Est. Effort    | Can Parallel With                             |
| ------------------------------------- | -------- | -------------- | --------------------------------------------- |
| 1. Project Scaffold                   | P0       | 0.5 day        | —                                             |
| **1.5. Design System (Iron & Ember)** | **P0**   | **1 day**      | —                                             |
| 2. Domain Types + Zod                 | P0       | 1.5 days       | 3 (Supabase setup)                            |
| 3. Supabase Setup                     | P0       | 0.5 day        | Step 2                                        |
| 4. Data Adapter + Auth                | P0       | 2 days         | —                                             |
| 5. Exercise Dictionary + 1RMs         | P0       | 2 days         | —                                             |
| 6. Active Workout Logging             | P0       | 4 days         | —                                             |
| 7. Workout History                    | P0       | 1.5 days       | —                                             |
| **Phase 0 subtotal**                  |          | **~13 days**   |                                               |
| 8. Tauri Shell + Rust/SQLite          | P0       | 3 days         | —                                             |
| 9. Sync Engine + Rest Timer           | P0       | 2.5 days       | —                                             |
| **Phase 1 subtotal**                  |          | **~5.5 days**  |                                               |
| 10. Session Templates + SetScheme     | P0       | 3 days         | —                                             |
| 11. Program Structure                 | P0       | 2 days         | —                                             |
| 12. Program Builder (DnD)             | P1       | 3 days         | —                                             |
| 13. Programmed Workout Logging        | P0       | 2.5 days       | —                                             |
| 13.5. Events & Packing Lists          | P1       | 2 days         | —                                             |
| **Phase 2 subtotal**                  |          | **~12.5 days** |                                               |
| 14. Progress Analytics + PR           | P1       | 2.5 days       | 15                                            |
| 15. Notification System               | P1       | 1.5 days       | 14                                            |
| 16. Share Links                       | P1       | 1.5 days       | 14, 15                                        |
| 17. Accountability Groups             | P2       | 3 days         | —                                             |
| 18. Coach Write Access                | P2       | 2 days         | —                                             |
| **Phase 3-4 subtotal**                |          | **~11 days**   |                                               |
| 19. Runtime Backend Config            | P0       | 2 days         | Steps 10-18                                   |
| 20. Docker & Self-Hosting             | P1       | 2 days         | Steps 10-18 (after Step 19 for mobile config) |
| **Phase 5 subtotal**                  |          | **~4 days**    |                                               |
| 21. Chat Data Layer                   | P2       | 3 days         | --                                            |
| 22. Supabase Realtime Integration     | P2       | 2 days         | --                                            |
| 23. Chat UI                           | P2       | 5 days         | --                                            |
| 24. Workout Sharing in Chat           | P2       | 2 days         | 25                                            |
| 25. Video + Image Sharing             | P2       | 4 days         | 24                                            |
| 26. Message Retention + Archiving     | P3       | 1 day          | 22, 23, 24, 25                                |
| **Phase 6 subtotal**                  |          | **~17 days**   |                                               |
| **Total**                             |          | **~63 days**   |                                               |

> **Critical path to browser MVP:** Steps 1 → 1.5 → 2/3 → 4 → 5 → 6 → 7 = ~13 days
> **Critical path to Tauri GO/NO-GO:** + Steps 8 → 9 = ~18.5 days
> **Critical path to programmed workouts:** + Steps 10 → 11 → 13 = ~26 days
> **Critical path to Play Store release:** All phases + Step 19 = minimum viable for distribution.
> **Critical path to text chat MVP:** + Steps 21 → 22 → 23 = ~36 days
> **Critical path to full chat with video:** + Steps 24 + 25 = ~42 days (24 and 25 can parallel)
> **Retention can ship any time after Step 21.**

---

## Supabase-Specific Considerations

### Cost

At community scale (< 50 users), Ardent Forge stays well within Supabase's free tier:

| Resource       | Free Tier        | Ardent Forge Est. Usage (with chat)                    |
| -------------- | ---------------- | ------------------------------------------------------ |
| Database       | 500 MB           | < 100 MB (messages add ~50 MB/year at 10 active users) |
| Auth           | 50K MAU          | < 50 users                                             |
| Realtime       | 200 concurrent   | < 20 (chat subscriptions)                              |
| Edge Functions | 500K invocations | < 1K/month (media upload URLs + webhooks)              |
| Storage        | 1 GB             | < 500 MB (chat images and files; video on Cloudflare)  |

> **Video note:** Video storage and delivery is handled by Cloudflare Stream, not Supabase Storage. At 10 active users sharing ~20 clips per week, Cloudflare Stream costs are under $5/month on the Starter Bundle.

### API Keys

Ardent Forge uses the new Supabase publishable key (`sb_publishable_...`) instead of the legacy `anon` JWT key. The publishable key is sent in the `apikey` header by the Supabase client library. Benefits: independently rotatable, no JWT secret coupling, shorter and easier to manage. Legacy `anon` key still works but is deprecated.

### Self-Hosted Supabase

Self-hosted Supabase uses the same API surface as Supabase Cloud. The Ardent Forge app does not distinguish between them -- both are accessed via the same Supabase JS client with the same URL and publishable key pattern.

The main operational difference is that self-hosted Supabase uses a locally-derived JWT secret and key pair rather than Supabase Cloud's managed keys. The migration runner and key generation script handle this automatically.

### Key Generation

Supabase derives the `anon` (publishable) and `service_role` keys from a JWT secret. The `scripts/generate-keys.sh` helper generates a random JWT secret and produces both keys using the standard Supabase algorithm (HS256-signed JWTs with role claims). This matches what Supabase Cloud does internally when you create a project.

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

| #   | Decision                                              | Rationale                                                                                                                      |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Phase 0 is browser-only against Supabase              | Validates data model and UX before committing to Tauri                                                                         |
| 2   | Data adapter pattern from day one                     | Switching between Supabase and Tauri/SQLite is transparent                                                                     |
| 3   | SetScheme as discriminated union, not generic schema  | Each workout type gets first-class field validation                                                                            |
| 4   | JSON columns for complex nested types                 | Avoids explosion of junction tables for SetScheme variants                                                                     |
| 5   | 1RM history is insert-only                            | Audit trail for progression, never lose historical data                                                                        |
| 6   | Pre-fill + confirm pattern for programmed logging     | Minimizes taps (2 per set) while allowing deviation                                                                            |
| 7   | Rest timer in Rust, not JavaScript                    | Survives WebView backgrounding on mobile                                                                                       |
| 8   | RLS expansion deferred to Steps 17-18                 | Simple `user_id = auth.uid()` for Phases 0-2, complexity only when needed                                                      |
| 9   | Coach creates programs owned by member                | Member always controls their data, coach access is revocable                                                                   |
| 10  | Same React app for all platforms                      | Eliminates duplication between web and native                                                                                  |
| 11  | Iron & Ember design system before feature work        | Full shadcn overrides upfront prevent style debt across 14 feature steps                                                       |
| 12  | Publishable key over legacy anon key                  | Independently rotatable, no JWT secret coupling, Supabase recommended                                                          |
| 13  | Bun over npm                                          | Faster installs, native TypeScript, simpler toolchain                                                                          |
| 14  | TanStack Router (not Start) for Tauri compatibility   | Start requires a server for SSR; Tauri runs in a serverless WebView                                                            |
| 15  | Material Symbols + Lucide dual icon strategy          | Material Symbols for app icons (fitness-specific), Lucide for shadcn internals                                                 |
| 16  | Fonts bundled locally in Tauri builds                 | No Google Fonts network dependency in native offline-first builds                                                              |
| 17  | Runtime config over build-time config                 | Single APK works against any Supabase instance; self-hosters don't need to build from source                                   |
| 18  | Config in localStorage / SQLite, not Supabase         | Config must be readable before Supabase client exists; chicken-and-egg                                                         |
| 19  | Backend change wipes local SQLite                     | Cross-instance data in one SQLite database corrupts sync invariants                                                            |
| 20  | Docker uses Supabase official self-hosted stack       | Maintained upstream, well-documented, matches the Supabase Cloud API surface                                                   |
| 21  | Migration runner as init container                    | `service_role` key stays inside Docker network; client app never has DDL permissions                                           |
| 22  | Caddy over nginx for reverse proxy                    | Automatic TLS with zero config; simpler for self-hosters who aren't sysadmins                                                  |
| 23  | Multi-stage web app build                             | No Node/Bun runtime in production; smaller image; nginx is battle-tested for static serving                                    |
| 24  | Supabase Realtime Broadcast for chat delivery         | Aligns with existing stack; avoids new vendor; sufficient for expected scale                                                   |
| 25  | Cloudflare Stream for video hosting                   | Simpler pricing than Mux; free encoding; swappable via MediaProvider interface                                                 |
| 26  | 90-day message retention with opt-in archiving        | Balances storage cost and privacy; archive flag is per-participant per-conversation                                            |
| 27  | Frozen workout snapshots for chat sharing             | Avoids permission edge cases; self-contained for offline display; no live reference needed                                     |
| 28  | Chat participation supersedes group member_visibility | Cannot hide identity within a conversation; joining is voluntary consent                                                       |
| 29  | Push notifications deferred                           | Platform complexity (APNs/FCM) not justified for friends-and-family scale                                                      |
| 30  | Messages are append-only (no edit/delete)             | Simplifies sync to append-only replication with no conflict resolution for mutations                                           |
| 31  | Cloudflare Stream signed URLs for access control      | Server-side signing via Edge Function; client never sees API token; 1-hour TTL                                                 |
| 32  | Images on Supabase Storage, video on Cloudflare       | Images are small static files (no transcoding); avoids a second external provider for images                                   |
| 33  | WebView Realtime over Rust-native WebSocket           | Simpler; reuses existing Supabase JS client; only move to Rust if Android background kills WS                                  |
| 34  | TUS protocol for video uploads                        | Resumable; handles mobile network interruptions gracefully; Cloudflare Stream native support                                   |
| 35  | Supabase Storage for generic file sharing             | Avoids a third external provider; document types are low-risk; 25 MB cap and allowlist enforce safety; inline preview deferred |
