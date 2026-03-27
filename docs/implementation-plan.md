# Ardent Forge — Implementation Plan

**Purpose:** Step-by-step feature-based build order for spec-driven development with Claude Code. Each step references the relevant docs, lists its dependencies, and defines its "done" criteria.

**Key Constraint:** Solo developer using AI coding agents heavily. Steps are scoped so each is a self-contained prompt-friendly unit with clear inputs, outputs, and validation criteria.

**Stack:** Tauri v2 + React + TypeScript + Rust + Supabase. One React app serves all platforms (Android, iOS, desktop, web browser).

**Critical Architecture Decision:** Phase 0 builds a browser-only React app against Supabase. Phase 1 wraps it in Tauri and adds the Rust/SQLite backend. This means the React app must be designed from day one to work through a data adapter that can switch between Supabase (browser) and Tauri commands (native).

---

## Dependency Graph (Visual)

```
                        ┌──────────────────────────────────┐
                        │  STEP 1: Project Scaffold         │
                        │  React + Vite + TanStack          │
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
| Steps 1–2, 4–7               | Step 3 (< 1 day)  | Steps 8–9             |

Supabase setup (Track B) is a console-click + migration exercise. The real work is Track A (building the app) and Track C (wrapping it in Tauri with offline support).

**Critical path to browser MVP:** Steps 1 → 2 → 3 → 4 → 5 → 6 → 7 (~12 days)
**Critical path to Tauri GO/NO-GO:** Steps 1–7 → 8 → 9 (~16 days)
**Critical path to programmed workouts:** Steps 1–9 → 10 → 11 → 12 → 13 (~25 days)

---

## STEP 1: Project Scaffold

**Dependencies:** None
**Priority:** P0
**Docs:** `07-architecture.md` §High-Level Architecture

### What to build

- Vite + React + TypeScript project
- TanStack Router with file-based routing (empty shells)
- TanStack Query provider
- Zustand store skeleton
- shadcn/ui setup + Tailwind CSS
- ESLint + Prettier configuration
- Basic responsive layout shell (mobile bottom nav + desktop sidebar)
- Environment variable setup (Supabase URL, anon key)

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
│   │   ├── data-adapter.ts     # Interface (empty)
│   │   └── utils.ts
│   ├── domain/
│   │   └── types/              # Empty, built in Step 2
│   ├── hooks/
│   ├── stores/
│   │   └── active-workout.ts   # Zustand skeleton
│   └── main.tsx
├── src-tauri/                  # Created in Step 8 (not now)
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .env.local                  # VITE_SUPABASE_URL, VITE_SUPABASE_PUB_KEY
```

### Key dependency versions to pin

| Library         | Purpose                         |
| --------------- | ------------------------------- |
| React 19        | UI framework                    |
| Vite 6          | Build tool                      |
| TanStack Router | File-based routing              |
| TanStack Query  | Server state management         |
| Zustand         | Client state (active workout)   |
| shadcn/ui       | Component library               |
| Tailwind CSS 4  | Styling                         |
| Zod             | Runtime validation              |
| React Hook Form | Form handling                   |
| dnd-kit         | Drag and drop (used in Step 12) |
| Recharts        | Charts (used in Step 14)        |

### Done when

- [ ] `bun run dev` launches app in browser
- [ ] TanStack Router renders empty index route
- [ ] shadcn/ui Button component renders correctly
- [ ] Responsive layout: bottom nav on mobile, sidebar on desktop
- [ ] TanStack Query provider wraps app
- [ ] Zustand store creates and reads a test value
- [ ] Environment variables load correctly
- [ ] ESLint + Prettier pass on all files
- [ ] Production build succeeds (`bun run build`)

---

## STEP 2: Domain Types + Zod Schemas

**Dependencies:** Step 1 (project structure exists)
**Priority:** P0
**Docs:** `05-domain-model.md` (full entity definitions), `06-invariants.md` (constraints), `09-state-machines.md` (valid transitions)

### What to build

Canonical TypeScript types and Zod validation schemas in `src/domain/`. These are the source of truth for the entire application — Rust structs and Supabase schemas are derived from these.

### Type files to create

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

### Enumerations to define

| Enum               | Values                                                                                      | Source Doc         |
| ------------------ | ------------------------------------------------------------------------------------------- | ------------------ |
| `ExerciseCategory` | BARBELL, DUMBBELL, KETTLEBELL, BODYWEIGHT, MACHINE, CABLE, CARDIO, PLYOMETRIC, LOADED_CARRY | 05-domain-model.md |
| `MovementPattern`  | PUSH, PULL, SQUAT, HINGE, CARRY, LUNGE, ROTATION, LOCOMOTION                                | 05-domain-model.md |
| `SetType`          | WORKING, WARMUP, DROP, AMRAP, PEAK, BACKOFF                                                 | 05-domain-model.md |
| `GroupType`        | STRAIGHT, SUPERSET, CIRCUIT, INTERVAL, EMOM, DESCENDING_LADDER, ASCENDING_LADDER            | 05-domain-model.md |
| `ScoringType`      | FOR_TIME, FOR_REPS, FOR_DISTANCE, NONE                                                      | 05-domain-model.md |
| `CardioModality`   | RUNNING, CYCLING, SWIMMING, ROWING, RUCKING, JUMP_ROPE, STAIR_CLIMBER, ELLIPTICAL           | 05-domain-model.md |
| `BlockType`        | STANDARD, DELOAD, PEAK, TEST, BRIDGE                                                        | 05-domain-model.md |
| `SessionType`      | STRENGTH, CONDITIONING, SE, MIXED                                                           | 05-domain-model.md |
| `ProgramSource`    | TB1, TB2, GREEN, MASS, AGELESS, CROSSFIT, CUSTOM                                            | 05-domain-model.md |
| `GroupRole`        | COACH, MEMBER                                                                               | 02-prd-sharing.md  |
| `ConnectionStatus` | PENDING, ACTIVE, DECLINED                                                                   | 02-prd-sharing.md  |

### Zod schemas with invariant enforcement

Each type gets a companion Zod schema. Key invariants to encode:

| Invariant                    | Zod Enforcement                                                  |
| ---------------------------- | ---------------------------------------------------------------- |
| SS-1: Type-field consistency | Discriminated union with `z.discriminatedUnion('type', [...])`   |
| SS-2: Percentage range       | `z.number().min(0.01).max(1.0)`                                  |
| SS-3: Rep ladder ordering    | `.refine(arr => arr.every((v, i) => i === 0 \|\| v < arr[i-1]))` |
| SS-4: NumberRange ordering   | `.refine(r => r.min <= r.max)`                                   |
| EX-1: Name required          | `z.string().min(1).max(100)`                                     |
| L-6: Perceived difficulty    | `z.number().int().min(1).max(10).optional()`                     |
| L-7: RPE range               | `z.number().int().min(1).max(10).optional()`                     |
| U-1: Weight unit             | `z.enum(['lb', 'kg'])`                                           |

### Data adapter interface

Define in `src/lib/data-adapter.ts` — the contract both adapters implement:

| Method              | Signature                         | Purpose             |
| ------------------- | --------------------------------- | ------------------- |
| `getExercises`      | `(filters?) → Exercise[]`         | Exercise dictionary |
| `getExercise`       | `(id) → Exercise`                 | Single exercise     |
| `createExercise`    | `(exercise) → Exercise`           | Custom exercise     |
| `getWorkoutLogs`    | `(userId, limit?) → WorkoutLog[]` | History list        |
| `getWorkoutLog`     | `(id) → WorkoutLog`               | Full workout detail |
| `saveWorkoutLog`    | `(log) → WorkoutLog`              | Create or update    |
| `deleteWorkoutLog`  | `(id) → void`                     | Delete workout      |
| `saveLoggedSet`     | `(set) → LoggedSet`               | Save individual set |
| `getUserProfile`    | `(userId) → UserProfile`          | Profile + 1RMs      |
| `updateUserProfile` | `(profile) → UserProfile`         | Update profile      |
| `saveOneRepMax`     | `(entry) → OneRepMaxHistory`      | Record new 1RM      |

### Done when

- [ ] All types compile with no errors
- [ ] SetScheme discriminated union covers all 12 variants
- [ ] LoadSpec discriminated union covers all 7 variants
- [ ] Zod schemas validate correct data and reject invalid data
- [ ] Unit tests for: SS-2 (percentage range), SS-3 (rep ladder), SS-4 (number range)
- [ ] Unit tests for SetScheme type-field consistency (SS-1): each variant rejects fields from other variants
- [ ] Data adapter interface defined with all methods
- [ ] `domain/` directory has zero React or framework dependencies (pure TypeScript)

---

## STEP 3: Supabase Project Setup

**Dependencies:** Step 2 (types for schema alignment). Can be done in parallel with Step 2.
**Priority:** P0
**Docs:** `08-erd.md` §Remote Schema, `06-invariants.md` §Sync Invariants

### What to build

Supabase project configuration and database schema. Primarily console/migration work.

### 3a. Supabase project + Auth

- Create Supabase project
- Enable email/password auth
- Optional: enable Google OAuth provider
- Copy project URL and anon key to `.env.local`
- Install `@supabase/supabase-js` client

### 3b. Database schema via migrations

Create tables matching `08-erd.md` using Supabase migrations. Core tables first, program tables can wait for Step 10.

**Phase 0 tables (create now):**

| Table                    | Priority | Source                 |
| ------------------------ | -------- | ---------------------- |
| `exercises`              | P0       | 08-erd.md §Core Tables |
| `workout_logs`           | P0       | 08-erd.md §Core Tables |
| `logged_activity_groups` | P0       | 08-erd.md §Core Tables |
| `logged_activities`      | P0       | 08-erd.md §Core Tables |
| `logged_sets`            | P0       | 08-erd.md §Core Tables |
| `user_profiles`          | P0       | 08-erd.md §User Tables |
| `one_rep_max_history`    | P0       | 08-erd.md §User Tables |

**Phase 2 tables (create in Step 10):**

| Table                | Priority |
| -------------------- | -------- |
| `programs`           | Step 10  |
| `blocks`             | Step 10  |
| `block_weeks`        | Step 10  |
| `scheduled_sessions` | Step 10  |
| `session_templates`  | Step 10  |
| `activity_groups`    | Step 10  |
| `activities`         | Step 10  |

**Phase 3-4 tables (create in Steps 16-18):**

| Table                   | Priority |
| ----------------------- | -------- |
| `accountability_groups` | Step 17  |
| `group_members`         | Step 17  |
| `group_invites`         | Step 17  |
| `direct_connections`    | Step 17  |
| `share_links`           | Step 16  |

### 3c. Row Level Security policies

**Phase 0 policies (simple user isolation):**

```sql
-- Pattern for all Phase 0 tables
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own data"
    ON workout_logs FOR ALL
    USING (user_id = auth.uid());
```

Apply to all tables. Group/connection-aware policies added in Steps 17-18.

### 3d. Indices

Create indices from `08-erd.md` §Indices for Phase 0 tables:

```sql
CREATE INDEX idx_workout_logs_user_started ON workout_logs(user_id, started_at DESC);
CREATE INDEX idx_logged_sets_activity ON logged_sets(logged_activity_id);
CREATE INDEX idx_logged_activities_exercise ON logged_activities(exercise_id);
CREATE INDEX idx_1rm_history ON one_rep_max_history(user_id, exercise_id, recorded_at DESC);
```

### 3e. Seed exercise dictionary

Insert default exercises (barbell, bodyweight, cardio, kettlebell basics). ~50-80 common exercises to start.

### Done when

- [ ] Supabase project exists with Auth enabled
- [ ] `.env.local` has correct project URL and anon key
- [ ] All Phase 0 tables created via migrations
- [ ] RLS enabled and tested — authenticated user can only access own data
- [ ] Unauthenticated requests rejected
- [ ] Exercise dictionary seeded with 50+ common exercises
- [ ] Indices created for key queries
- [ ] Supabase client connects from React app

---

## STEP 4: Supabase Data Adapter + Auth UI

**Dependencies:** Step 2 (types), Step 3 (Supabase schema)
**Priority:** P0
**Docs:** `07-architecture.md` §Data Layer, `10-user-flows.md` §Flow 9

### What to build

Supabase adapter implementing the data adapter interface, plus basic auth screens. This is the browser-mode data layer — Tauri adapter comes in Step 8.

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

| Screen          | Components                                 |
| --------------- | ------------------------------------------ |
| Sign In         | Email + password form, Google OAuth button |
| Sign Up         | Email + password form                      |
| Forgot Password | Email input, send reset                    |

### 4d. Auth state management

- Supabase auth listener wraps app
- Unauthenticated → show auth screen
- Authenticated → show main app
- Sign out clears session

### Done when

- [ ] User can sign up, sign in, sign out
- [ ] Supabase adapter implements all data adapter methods
- [ ] TanStack Query hooks fetch and cache data correctly
- [ ] Exercises query returns seeded exercises
- [ ] Saving a workout log persists to Supabase and is retrievable
- [ ] RLS prevents accessing other users' data
- [ ] Optimistic updates work for set logging mutations
- [ ] Error states handled (network error, auth error)

---

## STEP 5: Exercise Dictionary + 1RM Management

**Dependencies:** Step 4 (data adapter working)
**Priority:** P0
**Docs:** `01-prd-core.md` §FR-5, `05-domain-model.md` §Exercise + §UserProfile

### What to build

Exercise search, filtering, custom exercise creation, and 1RM tracking.

### 5a. Exercise search screen

- Search by name and aliases (debounced, 200ms)
- Filter by category, muscle group, movement pattern
- "Recently used" exercises shown first (query by `logged_activities`)
- Create custom exercise option at bottom of results

### 5b. Exercise detail screen

- Exercise metadata (category, muscles, equipment)
- 1RM history chart (line chart over time)
- "Update 1RM" button
- Per-exercise workout history (last N sessions with this exercise)

### 5c. 1RM management

- Profile screen section showing current 1RMs for all tested exercises
- Update 1RM: enter weight, mark tested vs estimated
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
- [ ] 1RM history displayed as line chart (Recharts)
- [ ] Profile screen shows all current 1RMs
- [ ] Exercise detail shows per-exercise workout history

---

## STEP 6: Active Workout Logging

**Dependencies:** Step 5 (exercise dictionary for adding exercises)
**Priority:** P0
**Docs:** `01-prd-core.md` §UC-1 + §UC-3 + §UC-4 + §UC-5 + §FR-1 + §FR-2 + §FR-3, `09-state-machines.md` §Active Workout + §Set Logging + §Circuit Execution, `10-user-flows.md` §Flow 3 + §Flow 4 + §Flow 5 + §Flow 6

### What to build

The most important screen in the app. Active workout logging for all workout types: barbell sets, cardio, rucking, SE circuits.

### 6a. Zustand store: active workout state

| State Field      | Type                                           | Purpose                                    |
| ---------------- | ---------------------------------------------- | ------------------------------------------ |
| `workoutLog`     | `WorkoutLog \| null`                           | Current workout (null = no active workout) |
| `loggedGroups`   | `LoggedActivityGroup[]`                        | All activity groups                        |
| `elapsedSeconds` | `number`                                       | Session timer                              |
| `restTimer`      | `{ remaining: number, total: number } \| null` | Rest countdown                             |
| `undoAction`     | `{ setId: string, expiresAt: number } \| null` | 10-second undo                             |

### 6b. Start workout flow

- "Start Workout" button on Today screen
- Creates `WorkoutLog` with `startedAt = now()`
- Saves to database immediately (crash recovery)
- Navigates to active workout screen
- Starts elapsed timer

### 6c. Add exercise + log sets (barbell/dumbbell/bodyweight)

- Tap "+ Add Exercise" → exercise search (from Step 5)
- First set row appears empty for ad-hoc
- Enter weight and reps, tap checkmark to confirm
- Set saved to database immediately
- Next set row pre-fills from previous set values
- Rest timer starts automatically (default: 2 min, configurable)

### 6d. Log cardio session

- Select cardio modality (run, cycle, swim, row)
- Running timer display
- Manual entry: distance and/or duration after completion
- Optional: heart rate, intensity level

### 6e. Log ruck

- Enter ruck load weight
- Running timer
- After completion: distance, optional elevation gain
- Pace auto-calculated from duration and distance

### 6f. Log SE circuit

Circuit execution mode per `09-state-machines.md` §Circuit Execution:

- Show circuit overview (exercises, target reps, rounds)
- Step through: exercise → confirm reps → inter-exercise rest → next exercise
- Between rounds: inter-round rest with countdown
- Summary after all rounds complete

### 6g. Finish workout

- "Finish Workout" button sets `completedAt`
- Show workout summary (duration, exercises, total sets, volume)
- Navigate back to Today screen

### 6h. Crash recovery

- Active workout with no `completedAt` detected on app launch
- Prompt: "Resume your workout?" with Resume/Discard options
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
- [ ] Elapsed session timer runs throughout
- [ ] "Finish Workout" shows summary with duration, exercises, volume
- [ ] Set type classification works (working, warmup, drop, backoff)
- [ ] Only one active workout at a time (L-8)
- [ ] Crash recovery prompt on relaunch with incomplete workout
- [ ] All data persists to Supabase on every set confirmation

---

## STEP 7: Workout History

**Dependencies:** Step 6 (workouts exist to view)
**Priority:** P0
**Docs:** `01-prd-core.md` §FR-6

### What to build

History list, workout detail view, and per-exercise history.

### 7a. History list

- Reverse chronological list of completed workouts
- Each entry: date, duration, exercise names, set count
- Virtualized list for performance (large histories)
- Tap to view full detail

### 7b. Workout detail view

- Full workout reconstruction: exercises → sets → reps/weight
- Program context shown if applicable (block, week, day)
- Notes and perceived difficulty
- Duration and volume totals

### 7c. Per-exercise history

- Navigate from exercise detail screen
- Last N sessions with this exercise
- Set-by-set comparison across sessions
- Volume trend (tonnage per session over time)

### Done when

- [ ] History list shows all completed workouts in reverse chronological order
- [ ] Workout detail shows full set-by-set breakdown
- [ ] Per-exercise history shows last 10+ sessions
- [ ] Volume trend chart renders correctly
- [ ] Virtualized list performs well with 100+ workouts
- [ ] Delete workout available with confirmation dialog

---

## ═══ PHASE 0 COMPLETE ═══

**Checkpoint:** The React app runs in the browser. Users can sign up, search exercises, set 1RMs, log any workout type (barbell, cardio, ruck, circuit), view history, and see per-exercise trends. Data is stored in Supabase. Take your phone to the gym and log a workout in the mobile browser.

---

## STEP 8: Tauri Shell + Rust/SQLite Backend

**Dependencies:** Step 7 (browser app is functional)
**Priority:** P0
**Docs:** `07-architecture.md` §Rust Backend Responsibilities

### What to build

Wrap the React app in Tauri v2. Add Rust backend with SQLite for offline-first operation. Create the Tauri data adapter.

### 8a. Tauri project initialization

- `bun create tauri-app` in existing project
- Tauri v2 configuration (`tauri.conf.json`)
- Android target initialization (`tauri android init`)
- Verify React app renders inside Tauri WebView

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

Implements the same data adapter interface as the Supabase adapter, but calls Tauri commands:

```typescript
// Pseudocode
const tauriAdapter: DataAdapter = {
  async getExercises(filters) {
    return await invoke('get_exercises', { filters })
  },
  async saveLoggedSet(set) {
    return await invoke('save_logged_set', { set })
  },
  // ...
}
```

### 8e. Adapter switching

```typescript
import { isTauri } from '@tauri-apps/api/core'

export const adapter = isTauri()
  ? tauriAdapter // SQLite via Rust
  : supabaseAdapter // Direct Supabase
```

All existing TanStack Query hooks use the adapter — switching is transparent.

### 8f. Android build + gym test

- Build Android APK (`tauri android build`)
- Sideload on personal device
- **GO / NO-GO: Log a workout at the gym.** Does it feel right?

### Done when

- [ ] React app renders inside Tauri WebView (desktop and Android)
- [ ] SQLite database creates all tables on first launch
- [ ] All Tauri commands work: CRUD for workouts, exercises, profile
- [ ] Tauri adapter passes the same functional tests as Supabase adapter
- [ ] Adapter switching works: Tauri mode uses SQLite, browser uses Supabase
- [ ] Android APK builds and installs
- [ ] Existing workout logging flow works identically in Tauri mode
- [ ] Data persists across app restarts (SQLite)
- [ ] App works with airplane mode (offline-first validated)

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

| State     | Meaning                  | UI                                |
| --------- | ------------------------ | --------------------------------- |
| `offline` | No auth or no network    | No indicator (app works normally) |
| `syncing` | Push or pull in progress | Subtle sync icon                  |
| `synced`  | All caught up            | Green dot (optional)              |
| `error`   | Sync failed              | Toast with retry                  |

### 9c. Rest timer in Rust

The rest timer must survive screen lock and WebView backgrounding:

- React calls `invoke('start_rest_timer', { seconds: 150 })`
- Rust starts async timer
- Rust emits `timer_tick` event every second
- Rust emits `timer_expired` event + triggers platform notification
- React subscribes to events for UI countdown display

### 9d. Notification for timer expiry

- Use `tauri-plugin-notification` for cross-platform alerts
- Short chime + vibration when rest timer expires
- Notification channel: `rest_timer` (high importance on Android)

### Done when

- [ ] Workout logged offline (airplane mode) → go online → data appears in Supabase
- [ ] Workout logged on web (Supabase) → appears on Tauri app via sync
- [ ] Conflict: same workout edited on both → last-write-wins correctly
- [ ] Sync state indicator reflects actual state
- [ ] Rest timer runs in Rust, counts down in React UI
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
**Docs:** `05-domain-model.md` §SessionTemplate + §SetScheme, `10-user-flows.md` §Flow 7 §SetScheme Editor

### What to build

Create and edit session templates with the full SetScheme system. This is the foundation for the program builder.

### 10a. Supabase schema additions

Create program-related tables: `session_templates`, `activity_groups`, `activities`. Add corresponding SQLite tables and Tauri commands.

### 10b. SetScheme editor component

The most complex form in the app. A type selector (12 options) that dynamically shows the correct fields:

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

- Name the session
- Add activity groups (straight, circuit, superset, interval)
- Within each group: add exercises, configure set scheme per exercise
- Configure group-level settings (rounds, rest between activities)
- Save template

### Done when

- [ ] SetScheme editor renders correct fields for all 12 types
- [ ] Switching type clears irrelevant fields
- [ ] Zod validation runs on save, shows inline errors
- [ ] Session template saves with nested activity groups and activities
- [ ] Session template loads and displays correctly
- [ ] Edit existing template works
- [ ] Templates sync via Supabase

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

- User selects "Activate" on a program
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
**Docs:** `10-user-flows.md` §Flow 7

### What to build

Visual drag-and-drop program builder. This is primarily a desktop/web experience — the wide viewport is needed for the complexity.

### 12a. Block editor

- Add/remove/reorder blocks (dnd-kit)
- Set block type (standard, deload, peak)
- Set duration (weeks)

### 12b. Week editor

- Visual week grid showing days
- Drag session templates onto days
- Copy week to fill a block quickly

### 12c. Session assignment

- Assign existing session templates to days
- Create new session template inline
- Preview session content (exercises, set schemes)

### 12d. Program preview

- Read-only view of entire program structure
- Week-by-week, session-by-session breakdown
- Working weights shown based on current 1RMs

### Done when

- [ ] Drag-and-drop reordering of blocks works
- [ ] Drag session templates onto week days
- [ ] Copy week fills block quickly
- [ ] Program preview shows full structure with calculated weights
- [ ] Mobile: simplified list-based editor (no drag-drop)
- [ ] Saved programs appear in library

---

## STEP 13: Programmed Workout Logging

**Dependencies:** Step 11 (programs exist), Step 6 (logging infrastructure)
**Priority:** P0
**Docs:** `01-prd-core.md` §UC-2, `10-user-flows.md` §Flow 3

### What to build

The "Today's Workout" flow: load prescribed session, calculate weights from 1RMs, pre-fill all sets, log with prescribed-vs-actual tracking.

### 13a. Today screen: program context

- If active program → show "Today's Session" card
- Display: session name, exercise list, set/rep/weight summary
- "Start Today's Workout" button

### 13b. Percentage → weight calculation

- Load user's 1RMs for all exercises in the session
- Apply percentage: `weight = floor(1RM * percentage)`
- Round to nearest plate-loadable weight (per PR-3: within 5lb/2.5kg)
- Pre-fill all set rows with calculated weights and prescribed reps

### 13c. Pre-filled workout experience

- All sets appear pre-populated
- User taps checkmark to confirm (2-tap logging)
- User can edit any value before confirming (deviation from prescription)
- AMRAP sets show "5+" notation
- Prescribed values stored alongside actual values in LoggedSet

### 13d. Program position advancement

- After completing the workout, advance to next session
- Track: current block, current week, next session day label
- Deload week awareness (visual indicator)

### Done when

- [ ] Today screen shows "Today's Session" when program is active
- [ ] Percentage calculations resolve to plate-rounded weights
- [ ] All sets pre-filled with prescribed values
- [ ] Confirming a pre-filled set takes 1 tap (checkmark)
- [ ] Deviations recorded as actual ≠ prescribed
- [ ] AMRAP sets handled with "5+" and actual reps logged
- [ ] Workout links to program context (block, week, day)
- [ ] Program position advances after workout completion
- [ ] Plate calculator available (visual plate loading guide)

---

## ═══ PHASE 2 COMPLETE ═══

**Checkpoint:** Users can create programs, build session templates with all 12 SetScheme types, follow structured multi-week periodized programs with percentage-based loading, and log workouts with prescribed-vs-actual tracking. The TB template library provides ready-made programs.

---

## STEP 14: Progress Analytics + PR Detection

**Dependencies:** Step 7 (workout history exists)
**Priority:** P1
**Docs:** `05-domain-model.md` §Domain Events (PersonalRecordSet), `11-notification-design.md` §Type 3

### What to build

Dashboard with progress charts, volume tracking, and automatic PR detection.

### 14a. 1RM trends

- Line chart: 1RM over time per exercise (Recharts)
- Filter by exercise, date range
- Show tested vs estimated markers

### 14b. Volume tracking

- Weekly tonnage by exercise or muscle group
- Bar chart: volume per week over time
- Sets per muscle group distribution (radar/pie chart)

### 14c. PR detection

After workout completion, scan logged sets for new bests:

- New 1RM (heaviest single)
- New 3RM, 5RM (heaviest set at rep count)
- New max reps at a given weight
- Distance/duration PRs for cardio

### 14d. PR celebration

- In-app celebration animation when PR detected
- Notification (from `11-notification-design.md` §Type 3): "New PR: Squat — 275lb × 5"
- PR history list in exercise detail

### Done when

- [ ] 1RM trend chart renders correctly
- [ ] Volume tracking shows weekly tonnage
- [ ] PR detection runs after every workout completion
- [ ] PR notification fires for new bests
- [ ] PR history visible in exercise detail
- [ ] Dashboard renders well on both mobile and desktop viewports

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
- Actions: "Start Workout" / "Later"

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
- Always: neutral, actionable, informational

### Done when

- [ ] Session reminder fires at configured time when workout is due
- [ ] "Start Workout" action opens pre-filled workout
- [ ] Quiet hours prevent non-timer notifications
- [ ] All notification text passes shame-free review
- [ ] Notification settings screen with per-type toggles and quiet hours

---

## STEP 16: Share Links (Read-Only)

**Dependencies:** Step 7 (workouts exist to share), Step 11 (programs exist to share)
**Priority:** P1
**Docs:** `02-prd-sharing.md` §Feature 1

### What to build

Generate share links for programs and workout logs. No RLS changes needed — uses a separate `share_links` table with token-based access.

### 16a. Share link generation

- "Share" button on program detail and workout detail screens
- Generate random 12-character alphanumeric token
- Store in `share_links` table with entity type and entity ID
- Display copyable URL: `https://ardentforge.app/s/{token}`

### 16b. Share link viewing

- Public route `/s/:token` — no auth required to view
- Fetch shared entity via token lookup (bypasses RLS)
- Read-only display of program structure or workout log

### 16c. Clone shared program

- "Clone to My Programs" button (requires auth)
- Deep copy: program + blocks + weeks + sessions + templates
- Owned by the cloning user (`user_id` = their ID)

### 16d. Share link management

- Author can view active share links
- Author can revoke (deactivate) any link

### Done when

- [ ] "Share" button generates a working link
- [ ] Shared program viewable without authentication
- [ ] Shared workout log viewable without authentication
- [ ] "Clone" copies program to authenticated user's account
- [ ] Author can revoke share links
- [ ] Revoked links return 404

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
- Entry: member name, date, session name, exercise summary
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

- Coach opens group → selects member → "Create Program"
- Standard program builder (from Step 12) with `user_id = member` and `created_by = coach`
- Member receives notification: "Coach created a program for you"

### 18b. Coach session editing

- Coach can modify upcoming scheduled sessions for a member
- Changes reflected when member opens "Today's Workout"
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

### Milestone 2: First Workout in Tauri (after Step 8)

- Log same workout in Tauri Android APK → data in local SQLite
- Verify offline → go online → data appears in Supabase

### Milestone 3: Programmed Workout Round-Trip (after Step 13)

- Create TB Operator program → activate → log Day 1 with pre-filled sets
- Verify prescribed vs actual tracking works

### Milestone 4: Cross-User Visibility (after Step 17)

- User A logs workout → User B (in same group) sees it in activity feed within 5s

### Milestone 5: Coach Programs Athlete (after Step 18)

- Coach creates program for member → member activates → logs workout → coach sees completion

---

## Timeline Mapping

| Step                              | Priority | Est. Effort    | Can Parallel With  |
| --------------------------------- | -------- | -------------- | ------------------ |
| 1. Project Scaffold               | P0       | 0.5 day        | —                  |
| 2. Domain Types + Zod             | P0       | 1.5 days       | 3 (Supabase setup) |
| 3. Supabase Setup                 | P0       | 0.5 day        | Step 2             |
| 4. Data Adapter + Auth            | P0       | 2 days         | —                  |
| 5. Exercise Dictionary + 1RMs     | P0       | 2 days         | —                  |
| 6. Active Workout Logging         | P0       | 4 days         | —                  |
| 7. Workout History                | P0       | 1.5 days       | —                  |
| **Phase 0 subtotal**              |          | **~12 days**   |                    |
| 8. Tauri Shell + Rust/SQLite      | P0       | 3 days         | —                  |
| 9. Sync Engine + Rest Timer       | P0       | 2.5 days       | —                  |
| **Phase 1 subtotal**              |          | **~5.5 days**  |                    |
| 10. Session Templates + SetScheme | P0       | 3 days         | —                  |
| 11. Program Structure             | P0       | 2 days         | —                  |
| 12. Program Builder (DnD)         | P1       | 3 days         | —                  |
| 13. Programmed Workout Logging    | P0       | 2.5 days       | —                  |
| **Phase 2 subtotal**              |          | **~10.5 days** |                    |
| 14. Progress Analytics + PR       | P1       | 2.5 days       | 15                 |
| 15. Notification System           | P1       | 1.5 days       | 14                 |
| 16. Share Links                   | P1       | 1.5 days       | 14, 15             |
| 17. Accountability Groups         | P2       | 3 days         | —                  |
| 18. Coach Write Access            | P2       | 2 days         | —                  |
| **Phase 3-4 subtotal**            |          | **~11 days**   |                    |
| **Total**                         |          | **~39 days**   |                    |

> **Critical path to browser MVP:** Steps 1 → 2/3 → 4 → 5 → 6 → 7 = ~12 days
> **Critical path to Tauri GO/NO-GO:** + Steps 8 → 9 = ~17.5 days
> **Critical path to programmed workouts:** + Steps 10 → 11 → 13 = ~25 days

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

| #   | Decision                                             | Rationale                                                                 |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Phase 0 is browser-only against Supabase             | Validates data model and UX before committing to Tauri                    |
| 2   | Data adapter pattern from day one                    | Switching between Supabase and Tauri/SQLite is transparent                |
| 3   | SetScheme as discriminated union, not generic schema | Each workout type gets first-class field validation                       |
| 4   | JSON columns for complex nested types                | Avoids explosion of junction tables for SetScheme variants                |
| 5   | 1RM history is insert-only                           | Audit trail for progression, never lose historical data                   |
| 6   | Pre-fill + confirm pattern for programmed logging    | Minimizes taps (2 per set) while allowing deviation                       |
| 7   | Rest timer in Rust, not JavaScript                   | Survives WebView backgrounding on mobile                                  |
| 8   | RLS expansion deferred to Steps 17-18                | Simple `user_id = auth.uid()` for Phases 0-2, complexity only when needed |
| 9   | Coach creates programs owned by member               | Member always controls their data, coach access is revocable              |
| 10  | Same React app for all platforms                     | Eliminates duplication between web and native                             |
