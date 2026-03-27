# System Architecture

## Overview

Ardent Forge is a single React application that runs across all platforms via Tauri v2. The architecture follows a clean separation between UI, domain logic, and platform services, with a thin data adapter layer that switches between local SQLite (via Rust) and direct Supabase access depending on the runtime environment.

---

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Clients["Platform Targets"]
        Android["📱 Android<br/>Tauri v2 Shell"]
        iOS["📱 iOS<br/>Tauri v2 Shell"]
        Desktop["🖥️ Desktop<br/>Tauri v2 Shell"]
        Browser["🌐 Web Browser<br/>Direct Access"]
    end
    
    subgraph ReactApp["React Application"]
        subgraph Presentation["Presentation Layer"]
            Routes["TanStack Router"]
            Components["React Components"]
            Stores["Zustand Stores"]
        end
        
        subgraph DomainLayer["Domain Layer"]
            Types["TypeScript Types<br/>(canonical)"]
            Calculations["Calculations<br/>%RM, plates, volume"]
            Validation["Zod Schemas"]
        end
        
        subgraph DataLayer["Data Layer"]
            Adapter["Data Adapter"]
            TauriAdapter["Tauri Adapter<br/>invoke() commands"]
            SupabaseAdapter["Supabase Adapter<br/>Direct client"]
            QueryLayer["TanStack Query<br/>Cache + mutations"]
        end
    end
    
    subgraph RustBackend["Rust Backend (Tauri)"]
        Commands["Tauri Commands"]
        SQLite["SQLite<br/>(sqlx)"]
        SyncEngine["Sync Engine"]
        Background["Background Services<br/>Rest timer, notifications"]
    end
    
    subgraph Cloud["Cloud (Supabase)"]
        Auth["Supabase Auth"]
        Postgres["PostgreSQL"]
        RLS["Row Level Security"]
    end
    
    Android --> ReactApp
    iOS --> ReactApp
    Desktop --> ReactApp
    Browser --> ReactApp
    
    Routes --> Components
    Components --> Stores
    Components --> QueryLayer
    Stores --> DomainLayer
    QueryLayer --> Adapter
    
    Adapter --> TauriAdapter
    Adapter --> SupabaseAdapter
    
    TauriAdapter --> Commands
    Commands --> SQLite
    Commands --> SyncEngine
    SyncEngine --> Auth
    SyncEngine --> Postgres
    
    SupabaseAdapter --> Auth
    SupabaseAdapter --> Postgres
```

---

## Layer Responsibilities

### Presentation Layer

```mermaid
flowchart LR
    subgraph Presentation["Presentation Layer"]
        subgraph Routes["Routes"]
            Today["/ (Today)"]
            ActiveWorkout["/log/:workoutId"]
            Programs["/programs"]
            ProgramBuilder["/programs/builder"]
            History["/history"]
            Dashboard["/dashboard"]
            Profile["/profile"]
        end
        
        subgraph StateManagement["State"]
            TanStackQ["TanStack Query<br/>Server state"]
            Zustand["Zustand<br/>Active workout"]
        end
    end
```

| Component | Responsibility |
|-----------|----------------|
| Routes | File-based routing via TanStack Router |
| Components | React + shadcn/ui, responsive for mobile and desktop |
| TanStack Query | Fetching, caching, and mutating server/local data |
| Zustand | Active workout session state (ephemeral, in-memory) |

### Domain Layer

```mermaid
flowchart TB
    subgraph Domain["Domain Layer"]
        subgraph TypeDefs["Type Definitions (Canonical)"]
            ProgramTypes["Program, Block, BlockWeek"]
            SessionTypes["SessionTemplate, ActivityGroup, Activity"]
            SetSchemeTypes["SetScheme (12 variants)"]
            LogTypes["WorkoutLog, LoggedSet"]
            ExerciseTypes["Exercise, MuscleGroup"]
            UnitTypes["Weight, Distance, Duration, Pace"]
        end
        
        subgraph Calculations["Pure Functions"]
            PercentCalc["Percentage → Weight"]
            PlateCalc["Plate Calculator"]
            VolumeCalc["Volume Computation"]
            PRDetect["PR Detection"]
            ProgressionCalc["Progression Rules"]
        end
        
        subgraph ValidationSchemas["Zod Schemas"]
            ProgramSchema["Program validation"]
            SetSchemeSchema["SetScheme validation"]
            WorkoutSchema["WorkoutLog validation"]
        end
    end
```

| Component | Responsibility |
|-----------|----------------|
| Type Definitions | Canonical TypeScript types shared by all layers |
| Calculations | Pure functions for weight math, volume, PR detection |
| Zod Schemas | Runtime validation for all domain entities |

### Data Layer

```mermaid
flowchart TB
    subgraph Data["Data Layer"]
        subgraph Adapter["Data Adapter (Interface)"]
            GetExercises["getExercises()"]
            SaveWorkout["saveWorkout()"]
            GetHistory["getWorkoutHistory()"]
            GetProgram["getActiveProgram()"]
            Save1RM["saveOneRepMax()"]
        end
        
        subgraph TauriImpl["Tauri Implementation"]
            InvokeCmd["invoke('save_workout', payload)"]
            InvokeQuery["invoke('get_exercises', filters)"]
        end
        
        subgraph SupabaseImpl["Supabase Implementation"]
            SupaQuery["supabase.from('exercises').select()"]
            SupaInsert["supabase.from('workout_logs').insert()"]
        end
    end
    
    Adapter --> TauriImpl
    Adapter --> SupabaseImpl
```

| Component | Responsibility |
|-----------|----------------|
| Data Adapter | Unified interface for data operations |
| Tauri Adapter | Invokes Rust commands for SQLite access |
| Supabase Adapter | Direct Supabase client for browser mode |

---

## Rust Backend Responsibilities

The Rust layer is a local SDK, not an API server. It provides platform capabilities that the browser cannot.

```mermaid
flowchart TB
    subgraph Rust["Rust Backend (Tauri)"]
        subgraph TauriCommands["Tauri Commands"]
            WorkoutCmd["Workout CRUD"]
            ProgramCmd["Program CRUD"]
            ExerciseCmd["Exercise queries"]
            SyncCmd["Sync operations"]
            CalcCmd["Heavy calculations"]
        end
        
        subgraph Database["SQLite (sqlx)"]
            Migrations["Schema migrations"]
            Queries["Prepared queries"]
            Transactions["Atomic transactions"]
        end
        
        subgraph Sync["Sync Engine"]
            PushSync["Push local → Supabase"]
            PullSync["Pull Supabase → local"]
            ConflictRes["Last-write-wins resolution"]
            OfflineQueue["Offline mutation queue"]
        end
        
        subgraph Services["Background Services"]
            RestTimer["Rest timer (background)"]
            Notifications["Push notifications"]
            FileExport["Data export"]
        end
    end
    
    TauriCommands --> Database
    TauriCommands --> Sync
    TauriCommands --> Services
```

| Component | Responsibility |
|-----------|----------------|
| Tauri Commands | Typed functions invokable from React via `invoke()` |
| SQLite | Local data persistence, offline-first source of truth |
| Sync Engine | Bidirectional sync with Supabase when online |
| Background Services | Rest timer, notifications, file export |

### What Rust Handles

- SQLite read/write (all local data access in Tauri mode)
- Sync engine (SQLite ↔ Supabase reconciliation)
- Background rest timer (survives screen lock)
- Push notifications (rest timer done, PR detected)
- File system access (export workout data)

### What Rust Does NOT Handle

- Routing, UI state, form validation (React's job)
- Authentication (Supabase handles this)
- Business logic for workout types (TypeScript domain layer)
- UI rendering (React + Tauri WebView)

---

## Data Flow

### Set Logging Flow (Tauri Mode)

```mermaid
sequenceDiagram
    participant UI as Active Workout Screen
    participant Store as Zustand Store
    participant Query as TanStack Query
    participant Adapter as Data Adapter
    participant Rust as Tauri Commands
    participant DB as SQLite
    participant Sync as Sync Engine
    participant Cloud as Supabase
    
    UI->>Store: onConfirmSet(setData)
    Store->>Store: Update active workout state
    Store->>Query: Trigger mutation
    Query->>Adapter: saveLoggedSet(set)
    Adapter->>Rust: invoke('save_logged_set', set)
    Rust->>DB: INSERT logged_set
    DB-->>Rust: Success
    Rust-->>Adapter: OK
    Adapter-->>Query: Success
    Query-->>UI: Invalidate + refetch
    
    UI->>UI: Start rest timer
    UI->>UI: Show checkmark animation
    
    Note over Sync,Cloud: Async — does not block UI
    Sync->>Cloud: Upsert logged_set
    Cloud-->>Sync: Ack (or queued if offline)
```

### Set Logging Flow (Browser Mode)

```mermaid
sequenceDiagram
    participant UI as Active Workout Screen
    participant Store as Zustand Store
    participant Query as TanStack Query
    participant Adapter as Data Adapter
    participant Cloud as Supabase
    
    UI->>Store: onConfirmSet(setData)
    Store->>Store: Update active workout state
    Store->>Query: Trigger mutation
    Query->>Adapter: saveLoggedSet(set)
    Adapter->>Cloud: supabase.from('logged_sets').insert(set)
    Cloud-->>Adapter: Success
    Adapter-->>Query: Success
    Query-->>UI: Invalidate + refetch
    
    UI->>UI: Start rest timer
    UI->>UI: Show checkmark animation
```

### Sync Data Flow

```mermaid
sequenceDiagram
    participant App as React App
    participant Rust as Rust Backend
    participant DB as SQLite
    participant Cloud as Supabase
    
    Note over App,Cloud: Push Flow (Local → Cloud)
    
    App->>Rust: invoke('save_workout', data)
    Rust->>DB: INSERT/UPDATE
    DB-->>Rust: Success
    Rust-->>App: OK (immediate)
    
    Rust->>Cloud: Upsert to Supabase
    Note over Cloud: Queued if offline
    Note over Cloud: Flushed on reconnect
    
    Note over App,Cloud: Pull Flow (Cloud → Local)
    
    Cloud->>Rust: Realtime subscription update
    Rust->>DB: INSERT/UPDATE with conflict check
    Rust->>App: Notify data changed
    App->>App: TanStack Query invalidation
```

---

## Responsive Design Architecture

The same React app adapts its layout based on viewport width.

```mermaid
flowchart TB
    subgraph Mobile["Mobile Layout (< 768px)"]
        MNav["Bottom tab navigation"]
        MContent["Single column content"]
        MLargeTargets["Large touch targets (≥ 48px)"]
        MSimpleNav["Simplified navigation"]
    end
    
    subgraph Desktop["Desktop Layout (≥ 1024px)"]
        DNav["Sidebar navigation"]
        DContent["Multi-panel layout"]
        DDnD["Drag-drop program builder"]
        DCharts["Full-width analytics dashboard"]
    end
    
    subgraph Shared["Shared"]
        SComponents["Same React components"]
        SLogic["Same domain logic"]
        SAdapter["Same data adapter"]
    end
    
    Mobile --> Shared
    Desktop --> Shared
```

---

## Error Handling Strategy

```mermaid
flowchart TB
    subgraph Errors["Error Types"]
        Validation["ValidationError<br/>Invalid input data"]
        NotFound["NotFoundError<br/>Entity missing"]
        Network["NetworkError<br/>Connectivity issues"]
        Auth["AuthError<br/>Session expired"]
        Sync["SyncError<br/>Conflict or failure"]
    end
    
    subgraph Handling["Handling Strategy"]
        DomainH["Domain Layer<br/>Zod validation, throw"]
        AdapterH["Adapter Layer<br/>Catch, return Result"]
        QueryH["TanStack Query<br/>onError callbacks"]
        UIH["UI Layer<br/>Toast or inline message"]
    end
    
    subgraph Recovery["Recovery Actions"]
        Retry["Retry operation"]
        Redirect["Navigate to auth"]
        Toast["Show toast message"]
        Inline["Show inline error"]
        Queue["Queue for later sync"]
    end
    
    Validation --> Inline
    NotFound --> Toast
    Network --> Queue
    Auth --> Redirect
    Sync --> Retry
```

---

## Security Architecture

```mermaid
flowchart TB
    subgraph Client["Client Security"]
        LocalDB["SQLite<br/>On-device only"]
        NoSecrets["No secrets in JS bundle"]
    end
    
    subgraph Transport["Transport Security"]
        TLS["TLS<br/>All Supabase connections"]
    end
    
    subgraph Backend["Supabase Security"]
        Auth["Supabase Auth<br/>JWT-based sessions"]
        RLS["Row Level Security<br/>user_id = auth.uid()"]
        Isolation["Per-user data isolation"]
    end
    
    Client --> Transport --> Backend
```

### Security Rules

| Rule | Implementation |
|------|----------------|
| Authentication | Supabase Auth (email, OAuth) |
| Authorization | Supabase RLS on all tables |
| Own data | `user_id = auth.uid()` for full read/write |
| Group read access | RLS joins on `group_members` table for peer visibility |
| Coach write access | RLS check: auth.uid() is COACH in same group, limited to programs/templates/sessions |
| Connection access | RLS joins on `direct_connections` for mutual read, optional write |
| Share links | Token-based read access, no auth required to view |
| Transport | TLS enforced by Supabase |
| Local data | SQLite on device, no encryption needed (personal device) |
| Secrets | Supabase anon key (safe to expose, RLS protects data) |
| Private fields | Perceived difficulty, bodyweight, notes excluded from group/connection queries |

---

## Performance Considerations

### Database Optimization

| Optimization | Purpose |
|--------------|---------|
| Indices on query columns | Fast exercise/workout lookup |
| Composite indices | Today's session resolution |
| Prepared statements | Consistent query performance |
| Transaction batching | Atomic workout saves |

### UI Optimization

| Optimization | Purpose |
|--------------|---------|
| React.memo on set rows | Prevent re-render during active workout |
| Virtual list for history | Memory efficiency for long lists |
| Optimistic updates | Instant UI feedback on set confirmation |
| Debounced search | Smooth exercise search experience |

### Sync Optimization

| Optimization | Purpose |
|--------------|---------|
| Batch sync on workout complete | One sync event per workout, not per set |
| Realtime subscription | Instant cross-device updates |
| Incremental sync | Only changed entities since last sync |
| Offline queue | Reliable delivery when connectivity returns |

---

## Deployment Architecture

```mermaid
flowchart LR
    subgraph Development["Development"]
        Local["Local dev server<br/>Vite + Tauri dev"]
        Emulator["Android/iOS emulator"]
        SupaLocal["Supabase local<br/>(optional)"]
    end
    
    subgraph CI["CI/CD"]
        GitHub["GitHub Actions"]
        Build["Build + Test"]
        Sign["Sign mobile builds"]
    end
    
    subgraph Distribution["Distribution"]
        PlayStore["Google Play Store"]
        AppStore["Apple App Store"]
        Web["Web deployment<br/>(Vercel/Netlify)"]
        GitHubRel["GitHub Releases<br/>(desktop)"]
    end
    
    Development --> CI --> Distribution
```

### Build Targets

| Target | Build Command | Output |
|--------|--------------|--------|
| Android | `tauri android build` | APK/AAB |
| iOS | `tauri ios build` | IPA |
| Desktop (macOS) | `tauri build` | .dmg |
| Desktop (Windows) | `tauri build` | .msi |
| Desktop (Linux) | `tauri build` | .deb/.AppImage |
| Web | `vite build` | Static files |
