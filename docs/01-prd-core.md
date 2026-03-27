# PRD: Core Workout Logging

## Overview

This document defines the requirements for Ardent Forge's core workout logging functionality — the foundation upon which program management and analytics build.

---

## Goals

### Primary Goals (P0)

| Goal | Success Criteria |
|------|------------------|
| Enable ad-hoc workout logging | User can walk in, add exercises, log sets |
| Support all set scheme types | 12+ distinct prescription models represented |
| Provide pre-filled sets from programs | Program-prescribed sets auto-populated |
| Maintain offline-first operation | All features work without network |

### Secondary Goals (P1)

| Goal | Success Criteria |
|------|------------------|
| Support rest timer between sets | Configurable countdown with background survival |
| Track session duration | Elapsed time from start to finish |
| Enable exercise search and filtering | Find exercises by name, category, or muscle group |
| Calculate working weights from %1RM | Auto-resolve percentages to plate-loadable weights |

### Tertiary Goals (P2)

| Goal | Success Criteria |
|------|------------------|
| GPS tracking for cardio activities | Distance and pace for runs and rucks |
| Heart rate integration from wearables | Record HR data alongside sets |
| Plate calculator | Visual plate loading guide for barbell exercises |
| PR detection and celebration | Identify new personal records automatically |

---

## User Personas

### Primary: Marcus (TB Operator User)

```mermaid
mindmap
  root((Marcus))
    Demographics
      32 years old
      Law enforcement
      Runs TB Operator + Black
    Training Style
      3x week barbell strength
      2-3x week conditioning
      Percentage-based loading
      Concurrent training
    Struggles
      Current app only does sets x reps
      Tracks strength and cardio in separate apps
      Cannot represent HIC sessions
      Manually calculates percentages
    Needs
      One app for everything
      Auto-calculate from 1RMs
      Log HICs and Fun Runs
      Follow TB templates
```

### Secondary: Sarah (General Strength Trainee)

```mermaid
mindmap
  root((Sarah))
    Demographics
      26 years old
      Software engineer
      Runs 5/3/1 program
    Training Style
      4x week barbell
      Occasional cardio
      Percentage-based with AMRAP sets
      Linear periodization
    Struggles
      Existing app cannot handle AMRAP last set
      No way to track prescribed vs actual
      Cannot represent deload weeks
    Needs
      Simple logging for structured program
      AMRAP set support
      Deload week awareness
      Progress charts for main lifts
```

### Tertiary: Jake (Selection Prep)

```mermaid
mindmap
  root((Jake))
    Demographics
      24 years old
      Military
      Running TB Green Protocol
    Training Style
      6x week mixed training
      Heavy rucking component
      SE circuits with timed rests
      Back-to-back long runs
    Struggles
      No app handles ruck logging well
      Cannot represent SE circuits
      Cannot track load progression for rucks
      Two-a-day sessions not supported
    Needs
      Ruck tracking with load and pace
      SE circuit mode with rest timers
      Speed ruck vs long ruck distinction
      Program with 16+ week structure
```

---

## Use Cases

### UC-1: Quick-Log a Workout (No Program)

**Actor**: User
**Precondition**: App is installed
**Trigger**: User opens app and taps "Start Workout"

```mermaid
sequenceDiagram
    actor User
    participant App
    participant DB as Local Database
    
    User->>App: Tap "Start Workout"
    App->>DB: Create WorkoutLog (startedAt = now)
    App->>User: Show empty workout with exercise search
    
    loop Add exercises
        User->>App: Search "bench press"
        App->>User: Show matching exercises
        User->>App: Select "Barbell Bench Press"
        App->>User: Show set entry (empty)
        
        loop Log sets
            User->>App: Enter weight and reps
            User->>App: Tap checkmark to confirm set
            App->>DB: Save LoggedSet
            App->>User: Show next set row (pre-filled from previous)
        end
    end
    
    User->>App: Tap "Finish Workout"
    App->>DB: Set completedAt = now
    App->>User: Show workout summary
```

**Postcondition**: WorkoutLog exists with all logged sets
**Notes**: Previous set values pre-fill the next set; rest timer starts automatically after confirming a set

### UC-2: Log a Programmed Workout

**Actor**: User
**Precondition**: User has an active program with today's session defined
**Trigger**: User taps "Today's Workout" on home screen

```mermaid
sequenceDiagram
    actor User
    participant App
    participant Calc as Calculator
    participant DB as Local Database
    
    User->>App: Tap "Today's Workout"
    App->>DB: Load SessionTemplate for today
    App->>DB: Load user's exercise maxes
    App->>Calc: Resolve percentages to weights
    Calc-->>App: Working weights (plate-rounded)
    App->>User: Show pre-filled workout
    Note over App: All sets populated with prescribed reps and weights
    
    loop For each exercise
        loop For each prescribed set
            User->>App: Tap checkmark (confirms pre-filled values)
            App->>DB: Save LoggedSet (prescribed + actual)
            App->>User: Start rest timer
        end
    end
    
    User->>App: Tap "Finish Workout"
    App->>DB: Set completedAt, link to program context
    App->>User: Show summary with prescribed vs actual
```

**Postcondition**: WorkoutLog exists with program context and prescribed vs actual data
**Notes**: User can edit any pre-filled value before confirming; AMRAP sets show "5+" instead of "5"

### UC-3: Log a Cardio Session

**Actor**: User
**Precondition**: App is installed
**Trigger**: User starts a cardio workout

```mermaid
sequenceDiagram
    actor User
    participant App
    participant Timer as Session Timer
    participant DB as Local Database
    
    User->>App: Start workout, select "LSS Run"
    App->>Timer: Start elapsed timer
    App->>User: Show running timer with distance entry
    
    alt Manual entry
        User->>App: Enter distance after completion
        User->>App: Enter average heart rate (optional)
    else GPS tracking
        App->>App: Track distance and pace in background
    end
    
    User->>App: Tap "Finish"
    App->>DB: Save LoggedSet with duration, distance, pace
    App->>User: Show session summary
```

**Postcondition**: WorkoutLog exists with cardio data
**Notes**: For programmed cardio, prescription (e.g., "60 min @ conversational pace") is shown alongside actual

### UC-4: Log an SE Circuit

**Actor**: User
**Precondition**: SE circuit session exists (programmed or ad-hoc)
**Trigger**: User starts SE circuit session

```mermaid
sequenceDiagram
    actor User
    participant App
    participant Timer as Rest Timer
    participant DB as Local Database
    
    User->>App: Start SE circuit session
    App->>User: Show circuit overview (exercises, target reps)
    User->>App: Tap "Start Circuit"
    
    loop For each round
        loop For each exercise in circuit
            App->>User: Show current exercise + target reps
            User->>App: Tap "Done" (or enter actual reps)
            App->>DB: Save reps for this exercise
            App->>Timer: Start inter-exercise rest (e.g., 90s)
            Timer->>User: Countdown display
            Timer-->>App: Rest complete
        end
        App->>Timer: Start inter-round rest (e.g., 3 min)
        Timer->>User: Countdown display
    end
    
    App->>User: Show circuit summary
```

**Postcondition**: WorkoutLog exists with circuit rounds and per-exercise reps

### UC-5: Log a Ruck

**Actor**: User
**Precondition**: App is installed
**Trigger**: User starts a ruck session

```mermaid
sequenceDiagram
    actor User
    participant App
    participant DB as Local Database
    
    User->>App: Start workout, select "Ruck"
    App->>User: Show ruck setup (load weight, target)
    User->>App: Enter ruck load (e.g., 45lb)
    User->>App: Set target (distance or duration)
    App->>App: Start elapsed timer
    
    User->>App: Complete ruck
    User->>App: Enter actual distance
    User->>App: Enter elevation gain (optional)
    App->>DB: Save LoggedSet with ruck-specific data
    App->>User: Show summary with pace calculation
```

**Postcondition**: WorkoutLog with ruck load, distance, duration, pace, and elevation

---

## Functional Requirements

### FR-1: Workout Session Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | User can start a new workout session | P0 |
| FR-1.2 | Session records start time automatically | P0 |
| FR-1.3 | User can finish a workout session | P0 |
| FR-1.4 | Session records end time on finish | P0 |
| FR-1.5 | User can add exercises to an active session | P0 |
| FR-1.6 | User can remove exercises from an active session | P0 |
| FR-1.7 | User can reorder exercises within a session | P1 |
| FR-1.8 | User can add notes to the overall session | P1 |
| FR-1.9 | User can record perceived difficulty (1-10) | P2 |
| FR-1.10 | User can record bodyweight at session time | P2 |
| FR-1.11 | Session persists across app backgrounding | P0 |
| FR-1.12 | Session recoverable after app crash | P0 |

### FR-2: Set Logging

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | User can log weight × reps for a set | P0 |
| FR-2.2 | User can log bodyweight-only reps | P0 |
| FR-2.3 | User can log a timed set (duration) | P0 |
| FR-2.4 | User can log cardio (distance, duration, pace) | P0 |
| FR-2.5 | User can mark a set as AMRAP | P0 |
| FR-2.6 | User can classify set type (working, warmup, drop, backoff) | P1 |
| FR-2.7 | User can log RPE per set | P1 |
| FR-2.8 | User can add notes to individual sets | P2 |
| FR-2.9 | User can log ruck-specific data (load, elevation) | P0 |
| FR-2.10 | User can log heart rate per set or session | P2 |
| FR-2.11 | Previous set values pre-fill next set | P0 |
| FR-2.12 | User can undo the last logged set within 10 seconds | P1 |

### FR-3: Program-Linked Logging

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Today screen shows prescribed session from active program | P0 |
| FR-3.2 | All prescribed sets pre-filled with calculated weights | P0 |
| FR-3.3 | Percentage-based loads resolved from user's 1RMs | P0 |
| FR-3.4 | Weights rounded to nearest plate-loadable value | P1 |
| FR-3.5 | Prescribed values stored alongside actual values | P0 |
| FR-3.6 | AMRAP sets indicated with "+" notation | P0 |
| FR-3.7 | User can deviate from prescription without friction | P0 |
| FR-3.8 | Workout linked to program context (block, week, day) | P0 |

### FR-4: Rest Timer

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Rest timer starts after confirming a set | P0 |
| FR-4.2 | Default rest time configurable per exercise | P1 |
| FR-4.3 | Timer survives screen lock and app backgrounding | P0 |
| FR-4.4 | Audio and/or vibration alert when rest complete | P1 |
| FR-4.5 | User can adjust timer duration mid-countdown | P1 |
| FR-4.6 | User can skip timer to proceed immediately | P0 |

### FR-5: Exercise Dictionary

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | App ships with seeded exercise dictionary | P0 |
| FR-5.2 | Exercises searchable by name and aliases | P0 |
| FR-5.3 | Exercises filterable by category and muscle group | P1 |
| FR-5.4 | User can create custom exercises | P0 |
| FR-5.5 | Exercises have movement pattern classification | P1 |
| FR-5.6 | Exercises track whether they support 1RM testing | P0 |
| FR-5.7 | User can set and update 1RM for any exercise | P0 |
| FR-5.8 | 1RM history preserved with timestamps | P1 |

### FR-6: Workout History

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | User can view list of past workouts | P0 |
| FR-6.2 | Past workouts show date, duration, exercises | P0 |
| FR-6.3 | User can view full detail of any past workout | P0 |
| FR-6.4 | User can view per-exercise history across workouts | P1 |
| FR-6.5 | History filterable by exercise, date range | P1 |
| FR-6.6 | User can delete a past workout | P2 |

---

## Non-Functional Requirements

### Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-P1 | Today screen load time | < 500ms |
| NFR-P2 | Set confirmation to feedback | < 100ms |
| NFR-P3 | Exercise search results | < 200ms |
| NFR-P4 | Workout summary generation | < 300ms |
| NFR-P5 | Percentage-to-weight calculation | < 50ms |

### Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-R1 | No data loss on app crash mid-workout | 100% |
| NFR-R2 | Offline functionality | 100% feature parity |
| NFR-R3 | Rest timer accuracy | ± 1 second |
| NFR-R4 | Data persistence across app updates | 100% |

### Usability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-U1 | Taps to confirm a pre-filled set | ≤ 2 |
| NFR-U2 | Taps to log an ad-hoc set | ≤ 4 |
| NFR-U3 | Touch target size | ≥ 48px |
| NFR-U4 | Color contrast ratio | ≥ 4.5:1 |
| NFR-U5 | Readable with sweaty/gloved hands | Yes |

---

## UI Requirements

### Today Screen

```mermaid
flowchart TB
    subgraph TodayScreen["Today Screen Layout"]
        Header["Header<br/>Date + Program Context"]
        
        subgraph ProgramMode["If Following a Program"]
            PSession["Today's Session<br/>Template name + exercises"]
            PStart["Start Workout button"]
        end
        
        subgraph QuickMode["Quick Actions"]
            QStart["Start Empty Workout"]
            QRecent["Recent Exercises"]
        end
        
        History["Recent Workouts"]
    end
```

### Active Workout Screen

```mermaid
flowchart TB
    subgraph ActiveWorkout["Active Workout Layout"]
        Timer["Elapsed Timer<br/>00:45:23"]
        
        subgraph ExerciseBlock["Exercise Block"]
            ExName["Barbell Squat"]
            
            subgraph Sets["Set Rows"]
                Set1["Set 1: 225lb × 5 ✓"]
                Set2["Set 2: 225lb × 5 ← active"]
                Set3["Set 3: 225lb × 5"]
            end
            
            RestTimer["Rest Timer: 2:15"]
        end
        
        AddExercise["+ Add Exercise"]
        Finish["Finish Workout"]
    end
```

### Set Row States

```mermaid
stateDiagram-v2
    [*] --> Pending: Set exists (pre-filled or empty)
    
    Pending --> Active: User taps to edit
    Active --> Completed: User confirms
    Completed --> Pending: User undoes (within 10s)
    
    state Pending {
        [*] --> PreFilled: From program
        [*] --> Empty: Ad-hoc workout
        PreFilled --> Editable: User taps value
    }
    
    state Completed {
        [*] --> Confirmed
        Confirmed --> UndoAvailable: 10s window
    }
```

### Set Row Information

| State | Visual Elements |
|-------|-----------------|
| Pending (pre-filled) | Weight, reps, set type badge, confirm button |
| Pending (empty) | Weight input, reps input, confirm button |
| Active | Editable fields highlighted, keyboard shown |
| Completed | Checkmark, values locked, subtle green tint |
| Rest period | Countdown timer overlay, skip button |

---

## Data Requirements

Detailed data requirements are defined in `05-domain-model.md` and `08-erd.md`. Key entities for core logging:

| Entity | Purpose |
|--------|---------|
| Exercise | Movement dictionary with metadata |
| WorkoutLog | A completed or in-progress training session |
| LoggedActivityGroup | A group of activities (straight sets, circuit, interval) |
| LoggedActivity | A single exercise within a group |
| LoggedSet | The atomic unit of recorded work |
| UserProfile | 1RMs, bodyweight, preferences |

---

## Constraints

1. **Offline First**: All logging operations must work without network connectivity
2. **No Prescription Lock**: Users can always deviate from the program without friction
3. **Crash Recovery**: Active workout state persisted to SQLite on every set confirmation
4. **Unit Flexibility**: Users can switch between imperial and metric at any time
5. **Rest Timer Background**: Timer must survive screen lock on mobile platforms

---

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| SQLite (via Rust/sqlx) | Internal | Local data persistence |
| Tauri commands | Internal | Bridge between React UI and Rust backend |
| Supabase | External | Cloud sync and authentication |
| TanStack Query | Internal | Data fetching and cache management |
| Zustand | Internal | Active workout session state |

---

## Open Questions

1. Should the rest timer have customizable audio tones or use system default?
2. How to handle timezone changes during a workout (travel)?
3. Should warmup sets be auto-generated based on working weight?
4. What is the maximum number of exercises per session before UX degrades?
5. Should AMRAP results influence future 1RM estimates automatically?
