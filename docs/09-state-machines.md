# State Machines

## Overview

This document defines all state machines in the Ardent Forge system, including valid states, transitions, guards, and actions.

---

## Active Workout State Machine

The core state machine governing a workout session from start to finish.

```mermaid
stateDiagram-v2
    [*] --> Idle: App open

    Idle --> Active: User starts workout

    state Active {
        [*] --> LoggingSets
        LoggingSets --> RestPeriod: Set confirmed
        RestPeriod --> LoggingSets: Rest complete or skipped
        LoggingSets --> AddingExercise: User adds exercise
        AddingExercise --> LoggingSets: Exercise selected
    }

    Active --> Completed: User finishes workout
    Active --> Abandoned: User discards workout
    Active --> Interrupted: App killed / crash

    Interrupted --> Active: App restored (state recovered from SQLite)

    Completed --> [*]
    Abandoned --> [*]
```

### Workout State Details

| State       | Timer                | Persistence                   | Recovery                     |
| ----------- | -------------------- | ----------------------------- | ---------------------------- |
| IDLE        | None                 | N/A                           | N/A                          |
| ACTIVE      | Elapsed time running | Every set saved to SQLite     | Full recovery from SQLite    |
| REST_PERIOD | Countdown running    | Timer state in Zustand + Rust | Timer restored on app return |
| COMPLETED   | Stopped              | Full workout saved            | N/A                          |
| ABANDONED   | Stopped              | Deleted or marked abandoned   | N/A                          |
| INTERRUPTED | Frozen               | Last confirmed set in SQLite  | Resume from last saved state |

### Workout Transition Table

| From        | Event          | Guard                                 | To               | Actions                          |
| ----------- | -------------- | ------------------------------------- | ---------------- | -------------------------------- |
| IDLE        | StartWorkout   | -                                     | ACTIVE           | Create WorkoutLog, start timer   |
| ACTIVE      | ConfirmSet     | -                                     | ACTIVE (REST)    | Save LoggedSet, start rest timer |
| ACTIVE      | SkipRest       | -                                     | ACTIVE (LOGGING) | Cancel rest timer                |
| ACTIVE      | RestComplete   | -                                     | ACTIVE (LOGGING) | Clear rest timer, audio alert    |
| ACTIVE      | AddExercise    | -                                     | ACTIVE (ADDING)  | Show exercise search             |
| ACTIVE      | FinishWorkout  | ≥ 1 set logged                        | COMPLETED        | Set completedAt, trigger sync    |
| ACTIVE      | DiscardWorkout | Confirm dialog                        | ABANDONED        | Delete or mark abandoned         |
| ACTIVE      | AppCrash       | -                                     | INTERRUPTED      | State in SQLite                  |
| INTERRUPTED | AppRestore     | WorkoutLog exists with no completedAt | ACTIVE           | Restore from SQLite              |

---

## Rest Timer State Machine

```mermaid
stateDiagram-v2
    [*] --> Inactive: No timer

    Inactive --> Running: Set confirmed

    Running --> Expired: Countdown reaches 0
    Running --> Skipped: User taps skip
    Running --> Adjusted: User changes duration

    Adjusted --> Running: New countdown starts

    Expired --> Inactive: Alert delivered
    Skipped --> Inactive: Timer cleared

    note right of Running
        Survives screen lock
        Survives app background
        Rust-side timer
    end note
```

### Timer Behavior by Platform

| Platform        | Screen Lock                      | App Background           | App Kill                         |
| --------------- | -------------------------------- | ------------------------ | -------------------------------- |
| Android (Tauri) | Timer survives (Rust service)    | Timer survives           | Timer lost, restored on relaunch |
| iOS (Tauri)     | Timer survives (background task) | Timer survives (limited) | Timer lost                       |
| Mobile (Tauri)  | Timer survives (Rust service)    | Timer survives           | Timer lost                       |
| Browser         | Timer survives (Web Worker)      | Timer survives           | Timer lost                       |

---

## Set Logging State Machine

Tracks the lifecycle of an individual set row in the active workout.

```mermaid
stateDiagram-v2
    [*] --> Empty: Ad-hoc workout
    [*] --> PreFilled: Program-linked workout

    state Pending {
        Empty --> Editing: User taps
        PreFilled --> Editing: User taps to modify
        PreFilled --> Confirmed: User taps confirm (accepts pre-fill)
    }

    Editing --> Confirmed: User confirms values

    Confirmed --> Undoable: 10-second window
    Undoable --> Confirmed: Window expires
    Undoable --> Editing: User taps undo

    Confirmed --> [*]
```

### Set State Details

| State     | UI                                         | Data                    |
| --------- | ------------------------------------------ | ----------------------- |
| Empty     | Blank weight/reps inputs                   | No values               |
| PreFilled | Filled from prescription, editable         | Prescribed values shown |
| Editing   | Input fields active, keyboard shown        | User entering values    |
| Confirmed | Checkmark, values locked, subtle highlight | Saved to SQLite         |
| Undoable  | Undo button visible (10s countdown)        | Saved but reversible    |

---

## Program Position State Machine

Tracks where the user is within their active program.

```mermaid
stateDiagram-v2
    [*] --> NoProgramActive: No program selected

    NoProgramActive --> ProgramActive: User activates program

    state ProgramActive {
        [*] --> InBlock

        state InBlock {
            [*] --> InWeek

            state InWeek {
                [*] --> SessionAvailable
                SessionAvailable --> SessionCompleted: User completes workout
                SessionCompleted --> SessionAvailable: Next session day
            }

            InWeek --> WeekComplete: All sessions done
        }

        WeekComplete --> InBlock: Next week begins
        InBlock --> BlockComplete: All weeks done
        BlockComplete --> InBlock: Next block begins
    }

    ProgramActive --> DeloadWeek: Deload block reached
    DeloadWeek --> ProgramActive: Deload complete

    ProgramActive --> ProgramComplete: All blocks done
    ProgramActive --> NoProgramActive: User deactivates

    ProgramComplete --> NoProgramActive: Program ends
    ProgramComplete --> ProgramActive: User repeats program
```

### Position Tracking

| Field               | Purpose                 | Updated When                |
| ------------------- | ----------------------- | --------------------------- |
| activeProgramId     | Which program is active | User activates/deactivates  |
| currentBlockIndex   | Which block             | Block completed → advance   |
| currentWeekNumber   | Which week within block | Week completed → advance    |
| nextSessionDayLabel | Which session is next   | Session completed → advance |

---

## Exercise Search State Machine

```mermaid
stateDiagram-v2
    [*] --> Closed: Search not active

    Closed --> Open: User taps "Add Exercise"

    state Open {
        [*] --> Idle
        Idle --> Searching: User types
        Searching --> Results: Results returned
        Searching --> NoResults: No matches
        Results --> Searching: User modifies query
        NoResults --> Searching: User modifies query
        Results --> Selected: User taps exercise
    }

    Selected --> Closed: Exercise added to workout
    Open --> Closed: User cancels
```

---

## Sync State Machine

Manages synchronization between local SQLite and Supabase.

```mermaid
stateDiagram-v2
    [*] --> Offline: No auth or no network

    Offline --> Syncing: Auth + network available

    state Syncing {
        [*] --> Pushing
        Pushing --> Pulling: Push complete
        Pulling --> Idle: Pull complete
        Idle --> Pushing: Local change detected
        Idle --> Pulling: Remote change detected
    }

    Syncing --> Offline: Network lost
    Syncing --> AuthRequired: Auth expired
    Syncing --> Error: Sync failure

    AuthRequired --> Syncing: User re-authenticates
    Error --> Syncing: Retry (manual or automatic)
    Error --> Offline: Give up (data safe locally)

    note right of Offline
        App fully functional
        All data in SQLite
        Changes queued
    end note

    note right of Error
        Local data safe
        Changes preserved
        User notified
    end note
```

### Sync State Details

| State         | Local Operations | Remote Operations     | User Impact                    |
| ------------- | ---------------- | --------------------- | ------------------------------ |
| OFFLINE       | Full read/write  | None                  | No impact — app works normally |
| PUSHING       | Full read/write  | Uploading changes     | No impact — async              |
| PULLING       | Full read/write  | Downloading changes   | New data appears               |
| IDLE          | Full read/write  | Listening for changes | Synced state                   |
| ERROR         | Full read/write  | None                  | Toast notification             |
| AUTH_REQUIRED | Full read/write  | None                  | Sign-in prompt                 |

---

## Circuit Execution State Machine

Tracks progress through an SE circuit or similar grouped workout.

```mermaid
stateDiagram-v2
    [*] --> NotStarted: Circuit defined

    NotStarted --> InProgress: User starts circuit

    state InProgress {
        [*] --> ExerciseActive

        ExerciseActive --> ExerciseComplete: User confirms reps
        ExerciseActive --> ExerciseSkipped: User skips

        ExerciseComplete --> InterExerciseRest: More exercises in round
        ExerciseSkipped --> InterExerciseRest: More exercises in round

        InterExerciseRest --> ExerciseActive: Rest complete

        ExerciseComplete --> InterRoundRest: Round complete, more rounds
        ExerciseSkipped --> InterRoundRest: Round complete, more rounds

        InterRoundRest --> ExerciseActive: Next round begins

        ExerciseComplete --> [*]: Last exercise of last round
        ExerciseSkipped --> [*]: Last exercise of last round
    }

    InProgress --> Completed: All rounds done
    InProgress --> Abandoned: User quits early

    Completed --> [*]
    Abandoned --> [*]
```

### Circuit State Details

| State               | Display                                              | Timer         |
| ------------------- | ---------------------------------------------------- | ------------- |
| NOT_STARTED         | Overview of circuit (exercises, target reps, rounds) | None          |
| EXERCISE_ACTIVE     | Current exercise name + target reps + confirm button | None          |
| INTER_EXERCISE_REST | Rest countdown + next exercise preview               | Counting down |
| INTER_ROUND_REST    | Round summary + rest countdown                       | Counting down |
| COMPLETED           | Circuit summary (rounds completed, total reps)       | Stopped       |
| ABANDONED           | Partial completion recorded                          | Stopped       |

---

## Interval Session State Machine

For HIC-style interval workouts (e.g., 600m Resets).

```mermaid
stateDiagram-v2
    [*] --> Ready: Interval session loaded

    Ready --> Working: User starts

    state Working {
        [*] --> WorkInterval

        WorkInterval --> RestInterval: Work complete
        RestInterval --> WorkInterval: Rest complete

        WorkInterval --> [*]: Last interval done
    }

    Working --> Completed: All intervals done
    Working --> Abandoned: User stops early

    Completed --> [*]
    Abandoned --> [*]
```

---

## Combined State: Full Workout Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Planning

    state Planning {
        [*] --> ChooseMode
        ChooseMode --> ProgramSession: Follow program
        ChooseMode --> QuickLog: Ad-hoc workout
        ProgramSession --> WorkoutReady: Session loaded + pre-filled
        QuickLog --> WorkoutReady: Empty workout created
    }

    state Executing {
        WorkoutReady --> Logging: First exercise selected
        Logging --> Resting: Set confirmed
        Resting --> Logging: Rest done
        Logging --> SearchingExercise: Add exercise
        SearchingExercise --> Logging: Exercise added
    }

    state Finishing {
        Logging --> Summary: User finishes
        Summary --> Syncing: Data saved
        Syncing --> Done: Sync complete or queued
    }

    Done --> [*]
```

---

## Transition Summary Table

### Workout Transitions

| Current     | Event          | Guard                 | Next        | Action               |
| ----------- | -------------- | --------------------- | ----------- | -------------------- |
| IDLE        | StartWorkout   | -                     | ACTIVE      | Create WorkoutLog    |
| ACTIVE      | ConfirmSet     | Values valid          | ACTIVE      | Save set, start rest |
| ACTIVE      | FinishWorkout  | ≥ 1 set               | COMPLETED   | Set completedAt      |
| ACTIVE      | DiscardWorkout | Confirmed             | ABANDONED   | Delete/mark          |
| ACTIVE      | AppCrash       | -                     | INTERRUPTED | State in SQLite      |
| INTERRUPTED | AppRestore     | Incomplete log exists | ACTIVE      | Restore state        |

### Rest Timer Transitions

| Current  | Event          | Guard | Next     | Action          |
| -------- | -------------- | ----- | -------- | --------------- |
| INACTIVE | SetConfirmed   | -     | RUNNING  | Start countdown |
| RUNNING  | CountdownZero  | -     | EXPIRED  | Alert user      |
| RUNNING  | UserSkips      | -     | INACTIVE | Cancel timer    |
| RUNNING  | UserAdjusts    | -     | RUNNING  | Reset countdown |
| EXPIRED  | AlertDelivered | -     | INACTIVE | Clear           |

### Sync Transitions

| Current | Event          | Guard          | Next          | Action          |
| ------- | -------------- | -------------- | ------------- | --------------- |
| OFFLINE | AuthAndNetwork | Both available | SYNCING       | Begin push      |
| SYNCING | NetworkLost    | -              | OFFLINE       | Queue remaining |
| SYNCING | AuthExpired    | -              | AUTH_REQUIRED | Prompt sign-in  |
| SYNCING | SyncFailed     | -              | ERROR         | Notify user     |
| ERROR   | Retry          | -              | SYNCING       | Retry sync      |

---

## Media Attachment Lifecycle

State machine for media attachments (videos and images shared in chat).

```mermaid
stateDiagram-v2
    [*] --> processing : Upload initiated
    processing --> ready : Transcoding complete\n(webhook received)
    processing --> failed : Transcoding failure\nor 5-min timeout
    failed --> processing : User retries upload
    ready --> [*] : Message deleted\n(retention cleanup)
```

| State        | Description                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------- |
| `processing` | Upload has started; Cloudflare Stream is transcoding (video) or upload is in progress (image) |
| `ready`      | Asset is available for playback/display                                                       |
| `failed`     | Transcoding or upload failed; user can retry                                                  |

Transitions are triggered by external events (Cloudflare Stream webhooks) and user actions (retry). Images skip the `processing` → `ready` webhook path and transition directly to `ready` on upload completion.

---

## Message Sync Lifecycle (Tauri Mode)

Offline message queueing state machine. This state machine exists only in the local SQLite schema via the `sync_status` column; messages in Postgres are always in the "synced" state.

```mermaid
stateDiagram-v2
    [*] --> pending : Message composed\n(offline or sending)
    pending --> synced : Server acknowledges insert\n(server timestamp assigned)
    pending --> failed : Sync error after\nretries exhausted
    failed --> pending : User retries or\nconnectivity restored
```

| State     | Visual                | Description                                                    |
| --------- | --------------------- | -------------------------------------------------------------- |
| `pending` | Clock icon on message | Written to SQLite; not yet confirmed by server                 |
| `synced`  | Timestamp on message  | Server-assigned timestamp; message re-sorted to final position |
| `failed`  | Error icon on message | Failed after retries; user can retry manually                  |

When a pending message syncs successfully, its `created_at` is updated to the server-assigned timestamp and the message re-sorts to its authoritative position in the conversation.
