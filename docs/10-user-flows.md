# User Flows & Experience Design

## Overview

This document maps the key user journeys through Ardent Forge, detailing screens, interactions, and decision points.

---

## Flow Index

```mermaid
mindmap
  root((User Flows))
    First Launch
      Welcome
      Create account or skip
      First workout
    Daily Usage
      View today's session
      Log programmed workout
      Quick-log ad-hoc workout
      Log cardio or ruck
    Program Management
      Browse template library
      Build custom program
      Activate program
      Track program position
    Exercise Management
      Search exercises
      View exercise history
      Create custom exercise
      Update 1RM
    Analytics
      View progress charts
      Check weekly volume
      Review PR history
    Settings
      Profile and 1RMs
      Sync setup
      Unit preferences
```

---

## Flow 1: First Launch

```mermaid
flowchart TB
    subgraph FirstLaunch["First Launch Flow"]
        Start["App Opens"] --> Welcome["Welcome Screen<br/>'Ardent Forge: One app for<br/>all your training'"]
        Welcome --> Signup{"Create account<br/>or use locally?"}
        Signup -->|Sign up| Auth["Supabase Auth<br/>Email or OAuth"]
        Signup -->|Skip| Local["Local-only mode"]
        Auth --> Profile["Set Up Profile<br/>Preferred units"]
        Local --> Profile
        Profile --> Choice{"Start with a<br/>program or just log?"}
        Choice -->|Browse programs| Programs["Template Library"]
        Choice -->|Just log| Today["Today Screen"]
        Programs --> Today
    end
```

### Welcome Screen

| Element | Content |
|---------|---------|
| Headline | "Ardent Forge" |
| Subhead | "Strength. Conditioning. Everything in between." |
| Features | "Percentage-based programs • Cardio & rucking • Offline-first" |
| Primary CTA | "Create Account" |
| Secondary CTA | "Continue Without Account" |

### Profile Setup

| Element | Content |
|---------|---------|
| Unit selection | Imperial (lb/mi) or Metric (kg/km) |
| Optional | Bodyweight, training experience level |
| Skip available | Everything optional except unit preference |

---

## Flow 2: Today Screen

```mermaid
flowchart TB
    subgraph TodayScreen["Today Screen"]
        Header["Header<br/>Date + greeting"]
        
        subgraph ProgramMode["Active Program"]
            ProgramName["Program: TB Operator + Black<br/>Block 1, Week 2"]
            TodaySession["Today: Operator Day 1<br/>Squat • Bench • WPU<br/>3×5 @ 75% 1RM"]
            StartBtn["Start Today's Workout"]
        end
        
        subgraph QuickActions["Quick Actions"]
            QuickStart["Start Empty Workout"]
            LastWorkout["Repeat Last Workout"]
        end
        
        RecentHistory["Recent Workouts<br/>List of last 5"]
    end
```

### Today Screen States

```mermaid
stateDiagram-v2
    [*] --> NoProgramNoHistory: Brand new user
    [*] --> NoProgramWithHistory: Has workout history
    [*] --> ProgramActive: Following a program
    [*] --> WorkoutInProgress: Unfinished workout
    
    state NoProgramNoHistory {
        [*] --> EmptyState
        EmptyState: Illustration
        EmptyState: "Log your first workout"
        EmptyState: Start Workout button
    }
    
    state ProgramActive {
        [*] --> SessionAvailable
        SessionAvailable: Today's prescribed session
        SessionAvailable: Pre-filled workout ready
        SessionAvailable --> RestDay: No session today
    }
    
    state WorkoutInProgress {
        [*] --> ResumePrompt
        ResumePrompt: "You have an unfinished workout"
        ResumePrompt: Resume or Discard
    }
```

---

## Flow 3: Log Programmed Workout

```mermaid
flowchart TB
    subgraph ProgrammedWorkout["Programmed Workout Flow"]
        Start["Tap 'Start Today's Workout'"]
        
        subgraph Loading["Session Loading"]
            LoadTemplate["Load session template"]
            LoadMaxes["Load user's 1RMs"]
            Calculate["Calculate working weights<br/>Round to plates"]
            PreFill["Pre-fill all sets"]
        end
        
        subgraph ActiveLogging["Active Workout"]
            ExerciseView["Exercise: Barbell Squat<br/>Set 1: 236lb × 5 [✓]<br/>Set 2: 236lb × 5 [←]<br/>Set 3: 236lb × 5 [ ]"]
            ConfirmSet["Tap ✓ to confirm"]
            RestTimer["Rest timer: 2:30"]
            NextExercise["Next exercise"]
        end
        
        subgraph Finish["Finish"]
            Summary["Workout Summary<br/>Duration: 52 min<br/>Sets: 9/9 completed<br/>Volume: 6,372 lb"]
            ProgramAdvance["Program advances to next session"]
        end
    end
    
    Start --> Loading --> ActiveLogging --> Finish
```

### Set Confirmation Interaction

```mermaid
sequenceDiagram
    actor User
    participant Screen as Workout Screen
    participant Timer as Rest Timer
    participant DB as SQLite
    
    Note over Screen: Set row shows: 236lb × 5
    
    User->>Screen: Tap ✓ button
    Screen->>DB: Save LoggedSet (prescribed + actual)
    Screen->>Screen: Checkmark animation
    Screen->>Screen: Haptic feedback
    Screen->>Timer: Start 2:30 countdown
    
    Note over Timer: Timer runs in Rust backend
    Note over Timer: Survives screen lock
    
    Timer-->>Screen: Countdown display updates
    Timer->>Screen: Timer expired
    Screen->>Screen: Audio/vibration alert
    Screen->>Screen: Highlight next set
```

### Handling Deviations

```mermaid
flowchart TB
    subgraph Deviation["User Deviates from Prescription"]
        PreFilled["Prescribed: 236lb × 5"]
        
        subgraph Options["Deviation Options"]
            ChangeWeight["Tap weight → edit → 225lb"]
            ChangeReps["Tap reps → edit → 7"]
            MarkAMRAP["Last set → toggle AMRAP → 5+"]
            AddSet["Tap + → add extra set"]
            SkipSet["Swipe set → skip"]
        end
        
        Result["Logged: prescribed=236×5, actual=225×7"]
    end
    
    PreFilled --> Options --> Result
```

---

## Flow 4: Quick-Log Workout

```mermaid
flowchart TB
    subgraph QuickLog["Quick-Log Flow"]
        Start["Tap 'Start Empty Workout'"]
        Timer["Session timer starts"]
        
        subgraph AddExercises["Build Workout"]
            Search["Search exercise<br/>'bench press'"]
            Select["Select from results"]
            LogSets["Log sets manually"]
            AddMore["+ Add another exercise"]
        end
        
        Finish["Tap 'Finish Workout'"]
        Summary["Workout Summary"]
    end
    
    Start --> Timer --> AddExercises --> Finish --> Summary
```

### Exercise Search

```mermaid
flowchart TB
    subgraph ExerciseSearch["Exercise Search"]
        Input["Search input<br/>Auto-focus, debounced"]
        
        subgraph Results["Results"]
            Recent["Recently used<br/>(shown first)"]
            Matches["Name/alias matches"]
            Create["Create custom exercise"]
        end
        
        subgraph Filters["Optional Filters"]
            Category["Category: Barbell, Bodyweight..."]
            Muscle["Muscle: Chest, Back..."]
            Pattern["Pattern: Push, Pull..."]
        end
    end
    
    Input --> Results
    Filters --> Results
```

---

## Flow 5: Log Cardio Session

```mermaid
flowchart TB
    subgraph CardioFlow["Cardio Logging Flow"]
        Start["Start workout"]
        SelectType["Select cardio type<br/>Run, Ruck, Cycle, Swim, Row"]
        
        subgraph Setup["Session Setup"]
            Target["Set target (optional)<br/>Duration: 60 min<br/>or Distance: 5K"]
            Intensity["Set intensity (optional)<br/>Conversational, Tempo, Max"]
        end
        
        subgraph Active["Active Session"]
            RunningTimer["Elapsed timer running"]
            ManualEntry["Distance entry available<br/>at any time"]
        end
        
        subgraph Finish["Completion"]
            EnterDistance["Enter actual distance"]
            EnterHR["Enter avg HR (optional)"]
            Summary["Session summary<br/>Duration, distance, pace"]
        end
    end
    
    Start --> SelectType --> Setup --> Active --> Finish
```

### Ruck-Specific Flow

```mermaid
flowchart TB
    subgraph RuckFlow["Ruck Logging"]
        LoadEntry["Enter ruck load<br/>45 lb"]
        TargetEntry["Target: 8 miles<br/>or 90 minutes"]
        GoalPace["Goal pace: 15 min/mi<br/>(optional)"]
        
        ActiveRuck["Timer running<br/>Load displayed"]
        
        Complete["Enter actual distance"]
        Elevation["Enter elevation gain<br/>(optional)"]
        
        Summary["Summary<br/>8.2 mi • 2:01:15 • 45 lb<br/>Pace: 14:49/mi • Elev: 342 ft"]
    end
    
    LoadEntry --> TargetEntry --> GoalPace --> ActiveRuck --> Complete --> Elevation --> Summary
```

---

## Flow 6: Log SE Circuit

```mermaid
flowchart TB
    subgraph CircuitFlow["SE Circuit Flow"]
        Start["Start SE circuit"]
        Overview["Circuit overview<br/>5 exercises × 3 rounds × 30 reps<br/>90s rest between exercises<br/>3 min rest between rounds"]
        
        subgraph Execution["Circuit Execution"]
            ExName["Push-ups × 30"]
            Confirm["Tap Done (or enter actual reps)"]
            ExRest["Rest: 0:87 → next exercise"]
            
            RoundEnd["Round 1 complete"]
            RoundRest["Rest: 2:45 → next round"]
        end
        
        Summary["Circuit summary<br/>3/3 rounds complete<br/>Total reps: 450"]
    end
    
    Start --> Overview --> Execution --> Summary
```

---

## Flow 7: Program Builder (Web/Desktop)

```mermaid
flowchart TB
    subgraph ProgramBuilder["Program Builder"]
        Start["Create New Program<br/>or Edit Existing"]
        
        subgraph Structure["Define Structure"]
            Name["Program name + source"]
            AddBlock["Add blocks<br/>(drag to reorder)"]
            AddWeeks["Define weeks per block"]
            AssignSessions["Assign sessions to days"]
        end
        
        subgraph SessionEditor["Session Template Editor"]
            AddGroups["Add activity groups<br/>(straight, circuit, interval)"]
            AddExercises["Add exercises to groups"]
            ConfigScheme["Configure set scheme<br/>(the complex part)"]
        end
        
        subgraph SetSchemeEditor["SetScheme Editor"]
            PickType["Select scheme type<br/>(12 options)"]
            ConfigFields["Configure type-specific fields<br/>PercentageSets: sets, reps, %"]
            Preview["Preview: 3×5 @ 75% 1RM"]
        end
        
        Save["Save program"]
    end
    
    Start --> Structure --> SessionEditor --> SetSchemeEditor --> Save
```

### SetScheme Editor UX

```mermaid
flowchart TB
    subgraph SchemeSelector["SetScheme Type Selection"]
        subgraph Strength["Strength"]
            S1["Fixed Sets<br/>5×5 @ 225lb"]
            S2["Percentage Sets<br/>3×5 @ 75%"]
            S3["Work to Max<br/>Heavy 2-3RM"]
        end
        
        subgraph Endurance["Endurance"]
            E1["For Reps<br/>30 push-ups"]
            E2["Timed Hold<br/>60s plank"]
            E3["% of Max Reps<br/>65% of max"]
        end
        
        subgraph Cardio["Cardio"]
            C1["Steady State<br/>60 min run"]
            C2["Intervals<br/>600m × 6"]
            C3["Ruck March<br/>90 min / 50lb"]
        end
        
        subgraph MetCon["MetCon"]
            M1["EMOM<br/>5/min × 10"]
            M2["AMRAP Timed<br/>20 min cap"]
            M3["Descending<br/>21-15-9"]
        end
    end
```

---

## Flow 8: Update 1RM

```mermaid
flowchart TB
    subgraph UpdateRM["Update 1RM Flow"]
        Access["Access via Profile → Exercise Maxes<br/>or Exercise Detail → Update Max"]
        
        subgraph Entry["1RM Entry"]
            Exercise["Select exercise"]
            Weight["Enter 1RM weight<br/>315 lb"]
            Tested["Tested or estimated?"]
        end
        
        subgraph Impact["Impact"]
            Recalculate["All programs using this exercise<br/>recalculate working weights"]
            History["Previous 1RM preserved<br/>in history"]
            Chart["1RM trend chart updates"]
        end
    end
    
    Access --> Entry --> Impact
```

---

## Flow 9: Settings & Sync

```mermaid
flowchart TB
    subgraph Settings["Settings"]
        Main["Settings Main"]
        
        subgraph Sections["Setting Sections"]
            Profile["Profile<br/>Units, bodyweight, 1RMs"]
            SyncSettings["Sync & Backup<br/>Account, sync status"]
            Timer["Timer Defaults<br/>Rest times per exercise type"]
            Data["Data<br/>Export, import"]
            About["About<br/>Version, feedback"]
        end
    end
    
    Main --> Sections
```

### Sync Setup Flow

```mermaid
sequenceDiagram
    actor User
    participant Settings
    participant Auth as Supabase Auth
    participant Cloud as Supabase
    participant DB as SQLite
    
    User->>Settings: Tap "Sign In"
    Settings->>Auth: Launch auth UI
    
    alt Email/Password
        Auth->>User: Email + password form
        User->>Auth: Enter credentials
    else Google OAuth
        Auth->>User: Google account picker
        User->>Auth: Select account
    end
    
    Auth-->>Settings: Authenticated (JWT)
    
    Settings->>Cloud: Check for existing user data
    
    alt Cloud empty (new user)
        Settings->>DB: Read all local data
        Settings->>Cloud: Push local data
    else Cloud has data (returning user)
        Settings->>Cloud: Pull data into SQLite
    end
    
    Settings->>Cloud: Start realtime subscription
    Settings->>User: "You're all set!"
```

---

## Error States & Empty States

### Error Handling Flows

```mermaid
flowchart TB
    subgraph Errors["Error States"]
        SyncError["Sync failed<br/>'Changes saved locally'<br/>Retry button"]
        NetworkError["Offline<br/>No indicator needed<br/>App works normally"]
        AuthError["Session expired<br/>'Please sign in again'<br/>Sign in button"]
        CrashRecovery["Unfinished workout found<br/>'Resume your workout?'<br/>Resume or Discard"]
    end
```

### Empty States

| Screen | Empty State | CTA |
|--------|-------------|-----|
| Today (new user) | "Log your first workout" | Start Workout |
| Today (program, rest day) | "Rest day — enjoy the recovery" | Quick-log option |
| History | "Your training history will appear here" | None |
| Exercise history | "No data for this exercise yet" | None |
| Programs | "No programs yet" | Browse Templates / Create |
| Dashboard | "Need more data for charts" | Keep logging! |

---

## Interaction Specifications

### Tap Targets

| Element | Minimum Size | Recommended Size |
|---------|--------------|------------------|
| Set confirm button | 48px | 64px |
| Exercise row | 48px height | 56px height |
| Navigation items | 48px | 48px |
| Timer controls | 48px | 56px |
| Weight/rep inputs | 48px height | 48px height |

### Animations

| Action | Animation | Duration |
|--------|-----------|----------|
| Set confirmed | Checkmark draw + row highlight | 300ms |
| Rest timer start | Timer slide-in | 200ms |
| Workout complete | Summary card scale-up | 400ms |
| Exercise added | Row slide-in | 200ms |
| PR detected | Celebration burst | 500ms |

### Haptic Feedback

| Action | Haptic Type |
|--------|-------------|
| Set confirmed | Success tick |
| Timer expired | Double tap |
| PR achieved | Heavy impact |
| Button tap | Light click |
| Error | Error pattern |

---

## Accessibility

### Screen Reader Support

| Element | Content Description |
|---------|---------------------|
| Set row | "[Exercise], set [N], [weight] for [reps], [status]" |
| Rest timer | "[time] remaining, tap to skip" |
| Progress | "[N] of [total] sets completed" |
| Exercise search | "Search exercises, [N] results" |

### Motion Reduction

| Animation | Reduced Motion Alternative |
|-----------|---------------------------|
| Set confirmation | Instant checkmark, no draw animation |
| Timer transitions | Instant display change |
| PR celebration | Static badge, no burst |
