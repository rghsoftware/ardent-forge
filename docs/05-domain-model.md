# Domain Model

## Overview

This document defines the conceptual model for Ardent Forge, including bounded contexts, entities, value objects, aggregates, and their relationships.

---

## Bounded Contexts

```mermaid
flowchart TB
    subgraph CoreDomain["Core Domain: Workout Logging"]
        LoggingCtx["Logging Context<br/>WorkoutLogs, LoggedSets, Exercises"]
    end

    subgraph SupportingDomains["Supporting Domains"]
        ProgramCtx["Program Context<br/>Programs, Blocks, Sessions, Templates"]
        ProgressionCtx["Progression Context<br/>1RM Tracking, Load Calculation"]
        AnalyticsCtx["Analytics Context<br/>Volume, PRs, Trends"]
    end

    subgraph GenericDomains["Generic Domains"]
        IdentityCtx["Identity Context<br/>Authentication, Accounts"]
        SyncCtx["Sync Context<br/>SQLite ↔ Supabase"]
        TimerCtx["Timer Context<br/>Rest Timers, Session Clock"]
    end

    LoggingCtx <--> ProgramCtx
    LoggingCtx <--> ProgressionCtx
    LoggingCtx <--> AnalyticsCtx

    IdentityCtx --> SyncCtx
    SyncCtx --> LoggingCtx
    SyncCtx --> ProgramCtx

    TimerCtx --> LoggingCtx
    ProgressionCtx --> ProgramCtx
```

### Context Definitions

| Context         | Type       | Responsibility                                    |
| --------------- | ---------- | ------------------------------------------------- |
| Workout Logging | Core       | Record training sessions and individual sets      |
| Program         | Supporting | Define and manage structured training programs    |
| Progression     | Supporting | Track 1RMs, calculate working weights, detect PRs |
| Analytics       | Supporting | Generate insights from workout history            |
| Identity        | Generic    | User authentication and profiles                  |
| Sync            | Generic    | SQLite ↔ Supabase bidirectional synchronization   |
| Timer           | Generic    | Rest countdown, session elapsed time              |

---

## Entity Hierarchy

```mermaid
classDiagram
    class SyncableEntity {
        <<interface>>
        +id: string
        +createdAt: string
        +updatedAt: string
    }

    class Exercise {
        +name: string
        +aliases: string[]
        +category: ExerciseCategory
        +movementPattern: MovementPattern
        +muscleGroups: MuscleGroup[]
        +isBilateral: boolean
        +supports1RM: boolean
        +equipmentRequired: Equipment[]
    }

    class Program {
        +name: string
        +description: string?
        +source: ProgramSource
        +durationWeeks: number?
        +isPublic: boolean
        +createdBy: string
    }

    class Block {
        +name: string
        +ordinal: number
        +durationWeeks: number
        +blockType: BlockType
    }

    class SessionTemplate {
        +name: string
        +category: SessionCategory
        +timeCap: Duration?
        +scoring: ScoringType
    }

    class ActivityGroup {
        +groupType: GroupType
        +rounds: number?
        +restBetweenRounds: Duration?
        +restBetweenActivities: Duration?
    }

    class Activity {
        +exerciseId: string
        +setScheme: SetScheme
        +ordinal: number
    }

    class WorkoutLog {
        +startedAt: string
        +completedAt: string?
        +sessionTemplateId: string?
        +programContext: ProgramContext?
        +perceivedDifficulty: number?
    }

    class LoggedSet {
        +setNumber: number
        +setType: SetType
        +prescribed: Prescription?
        +actualReps: number?
        +actualWeight: Weight?
        +actualDuration: Duration?
        +actualDistance: Distance?
        +completed: boolean
    }

    class UserProfile {
        +exerciseMaxes: Map
        +bodyweight: Weight?
        +maxReps: Map
        +preferredUnits: string
    }

    SyncableEntity <|.. Exercise
    SyncableEntity <|.. Program
    SyncableEntity <|.. WorkoutLog
    SyncableEntity <|.. UserProfile

    Program "1" --> "*" Block : contains
    Block "1" --> "*" SessionTemplate : schedules
    SessionTemplate "1" --> "*" ActivityGroup : contains
    ActivityGroup "1" --> "*" Activity : contains
    Activity "*" --> "1" Exercise : references

    WorkoutLog "1" --> "*" LoggedSet : records

    class EventItem {
        +name: string
        +category: string?
        +quantity: number
        +isPacked: boolean
        +sortOrder: number
        +notes: string?
    }

    SessionTemplate "1" --> "*" EventItem : "packing list (EVENT only)"
    WorkoutLog "1" --> "*" EventItem : "packing list (EVENT only)"
```

---

## Aggregate Roots

```mermaid
flowchart TB
    subgraph ProgramAggregate["Program Aggregate"]
        Program["Program<br/>(Root)"]
        Block["Block"]
        BlockWeek["BlockWeek"]
        ScheduledSession["ScheduledSession"]

        Program --> Block
        Block --> BlockWeek
        BlockWeek --> ScheduledSession
    end

    subgraph SessionAggregate["Session Template Aggregate"]
        SessionTemplate["SessionTemplate<br/>(Root)"]
        ActivityGroup["ActivityGroup"]
        Activity["Activity"]

        SessionTemplate --> ActivityGroup
        ActivityGroup --> Activity
    end

    subgraph WorkoutAggregate["Workout Log Aggregate"]
        WorkoutLog["WorkoutLog<br/>(Root)"]
        LoggedActivityGroup["LoggedActivityGroup"]
        LoggedActivity["LoggedActivity"]
        LoggedSet["LoggedSet"]

        WorkoutLog --> LoggedActivityGroup
        LoggedActivityGroup --> LoggedActivity
        LoggedActivity --> LoggedSet
    end

    subgraph UserAggregate["User Aggregate"]
        User["UserProfile<br/>(Root)"]
        ExerciseMax["OneRepMax History"]

        User --> ExerciseMax
    end

    Activity -.-> |"references"| Exercise
    ScheduledSession -.-> |"references"| SessionTemplate
```

### Aggregate Rules

| Aggregate        | Root            | Owned Entities                                                                    | Notes                                              |
| ---------------- | --------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| Program          | Program         | Block, BlockWeek, ScheduledSession                                                | Full program hierarchy                             |
| Session Template | SessionTemplate | ActivityGroup, Activity, EventItem (when category = EVENT)                        | Reusable session definitions                       |
| Workout Log      | WorkoutLog      | LoggedActivityGroup, LoggedActivity, LoggedSet, EventItem (when category = EVENT) | Complete workout record                            |
| User             | UserProfile     | OneRepMax entries                                                                 | User settings and training maxes                   |
| Conversation     | Conversation    | ConversationParticipant, Message                                                  | Chat channel with participants and message history |

---

## Core Entities

### Exercise

The movement dictionary — the building block of all training.

```mermaid
erDiagram
    EXERCISE {
        string id PK
        string name "1-100 chars, required"
        json aliases "searchable alternate names"
        enum category "BARBELL, DUMBBELL, KETTLEBELL, BODYWEIGHT, MACHINE, CABLE, CARDIO, PLYOMETRIC, LOADED_CARRY"
        enum movement_pattern "SQUAT, HINGE, PUSH, PULL, CARRY, ROTATE, GAIT, ISOMETRIC"
        json muscle_groups "primary and secondary"
        boolean is_bilateral "true if works both sides"
        boolean supports_1rm "true if 1RM testable"
        json equipment_required "list of equipment"
        boolean is_custom "user-created vs seeded"
        timestamp created_at
        timestamp updated_at
    }
```

### SetScheme (Value Object)

The heart of the domain model. A discriminated union representing every way work can be prescribed.

```mermaid
flowchart TB
    subgraph SetScheme["SetScheme — Discriminated Union"]
        FS["FixedSets<br/>3×5 @ 225lb"]
        PS["PercentageSets<br/>3×5 @ 75% 1RM"]
        WTM["WorkToMax<br/>Heavy 2-3RM"]
        TH["TimedHold<br/>Plank 60s × 3"]
        FR["ForReps<br/>30 push-ups (SE)"]
        CSS["CardioSteadyState<br/>60min run @ zone 2"]
        CI["CardioInterval<br/>600m sprint × 6"]
        RM["RuckMarch<br/>90min / 50lb"]
        EM["EMOM<br/>5 cleans every minute × 10"]
        AT["AMRAPTimed<br/>Max rounds in 20 min"]
        DR["DescendingReps<br/>21-15-9"]
        PMR["PercentageOfMaxReps<br/>65% of max reps"]
    end
```

#### SetScheme Type Details

| Type                | Use Case                   | Key Fields                                       |
| ------------------- | -------------------------- | ------------------------------------------------ |
| FixedSets           | Starting Strength 5×5      | sets, reps, absolute weight, last set AMRAP flag |
| PercentageSets      | TB Operator 3×5 @ 75%      | sets, reps, %1RM, AMRAP flag                     |
| WorkToMax           | TB Peaking / Op Pro        | warmup scheme, target rep range (2-3RM)          |
| TimedHold           | Planks, wall sits          | duration, sets, rest                             |
| ForReps             | SE circuits (30 push-ups)  | target reps, optional load                       |
| CardioSteadyState   | LSS run, ruck, swim        | duration or distance, intensity, modality        |
| CardioInterval      | 600m resets, hill sprints  | work duration/distance, rest, rounds             |
| RuckMarch           | Standard and speed rucks   | duration or distance, load, pace target          |
| EMOM                | Every minute on the minute | reps per minute, total minutes                   |
| AMRAPTimed          | CrossFit-style AMRAP       | time cap                                         |
| DescendingReps      | Fran 21-15-9               | rep ladder array                                 |
| PercentageOfMaxReps | TB SE training             | percentage of tested max reps                    |

### LoadSpec (Value Object)

How load or weight is specified.

```mermaid
flowchart LR
    subgraph LoadSpec["LoadSpec — Discriminated Union"]
        ABS["Absolute<br/>225lb"]
        PCT["Percentage1RM<br/>75% of 1RM"]
        RPE["RPE<br/>Target RPE 8"]
        PMR["PercentMaxReps<br/>65% of max reps"]
        BW["Bodyweight<br/>No external load"]
        BWP["BodyweightPlus<br/>BW + 45lb"]
        UNS["Unspecified<br/>Go by feel"]
    end
```

### WorkoutLog

A completed or in-progress training session.

```mermaid
erDiagram
    WORKOUT_LOG {
        string id PK
        string user_id FK
        timestamp started_at "required"
        timestamp completed_at "null if in progress"
        string session_template_id FK "null for ad-hoc"
        json program_context "program, block, week, day"
        string overall_notes "optional"
        int perceived_difficulty "1-10, optional"
        json bodyweight_at_session "optional Weight"
    }

    LOGGED_ACTIVITY_GROUP {
        string id PK
        string workout_log_id FK
        enum group_type "STRAIGHT_SETS, SUPERSET, CIRCUIT, COMPLEX, EMOM, AMRAP, COUPLET"
        int ordinal
        int actual_rounds_completed "for circuits"
        json completion_time "for timed WODs"
    }

    LOGGED_ACTIVITY {
        string id PK
        string logged_group_id FK
        string exercise_id FK
        int ordinal
        string notes "optional"
    }

    LOGGED_SET {
        string id PK
        string logged_activity_id FK
        int set_number
        enum set_type "WORKING, WARMUP, DROP, AMRAP, PEAK, BACKOFF"
        json prescribed "what program said"
        int actual_reps "nullable"
        json actual_weight "nullable Weight"
        json actual_duration "nullable Duration"
        json actual_distance "nullable Distance"
        json actual_pace "nullable Pace"
        int actual_heart_rate "nullable"
        int rpe "nullable"
        boolean completed
        string notes "nullable"
        json ruck_load "nullable Weight"
        json elevation_gain "nullable Distance"
    }

    WORKOUT_LOG ||--o{ LOGGED_ACTIVITY_GROUP : "contains"
    LOGGED_ACTIVITY_GROUP ||--o{ LOGGED_ACTIVITY : "contains"
    LOGGED_ACTIVITY ||--o{ LOGGED_SET : "records"
```

### Program

A structured training plan with blocks, weeks, and sessions.

```mermaid
erDiagram
    PROGRAM {
        string id PK
        string name "required"
        string description "optional"
        enum source "CUSTOM, IMPORTED, SHARED, MARKETPLACE, AI_GENERATED, COACH_ASSIGNED, TEMPLATE"
        int duration_weeks "null for perpetual"
        boolean is_public "shareable"
        string created_by FK
        timestamp created_at
        timestamp updated_at
    }

    BLOCK {
        string id PK
        string program_id FK
        string name "required"
        int ordinal
        int duration_weeks
        enum block_type "ACCUMULATION, INTENSIFICATION, REALIZATION, DELOAD, TEST"
    }

    BLOCK_WEEK {
        string id PK
        string block_id FK
        int week_number
    }

    SCHEDULED_SESSION {
        string id PK
        string block_week_id FK
        int day_of_week "nullable for floating"
        string day_label "Day 1, Day 3, etc."
        enum session_type "STRENGTH, CONDITIONING, SE, MIXED, EVENT"
        string session_template_id FK
        string notes "optional"
    }

    PROGRAM ||--o{ BLOCK : "contains"
    BLOCK ||--o{ BLOCK_WEEK : "contains"
    BLOCK_WEEK ||--o{ SCHEDULED_SESSION : "schedules"
```

### UserProfile

User settings and training data.

```mermaid
erDiagram
    USER_PROFILE {
        string id PK
        json exercise_maxes "Map of exerciseId to OneRepMax"
        json bodyweight "optional Weight"
        json max_reps "Map of exerciseId to int"
        enum preferred_units "IMPERIAL, METRIC"
        json training_age "optional Duration"
        timestamp created_at
        timestamp updated_at
    }

    ONE_REP_MAX_HISTORY {
        string id PK
        string user_id FK
        string exercise_id FK
        json weight "Weight value"
        boolean estimated "tested or calculated"
        timestamp recorded_at
    }

    USER_PROFILE ||--o{ ONE_REP_MAX_HISTORY : "tracks"
```

---

## Value Objects

Value objects are immutable and compared by value, not identity.

```mermaid
classDiagram
    class Weight {
        +value: number
        +unit: lb | kg
        +convertTo(unit): Weight
    }

    class Distance {
        +value: number
        +unit: mi | km | m | yd
        +convertTo(unit): Distance
    }

    class Duration {
        +seconds: number
        +toMinutes(): number
        +format(): string
    }

    class Pace {
        +minutesPerUnit: number
        +unit: mi | km
        +format(): string
    }

    class NumberRange {
        +min: number
        +max: number
        +contains(n): boolean
    }

    class OneRepMax {
        +weight: Weight
        +testedAt: string
        +estimated: boolean
    }

    class ProgramContext {
        +programId: string
        +blockId: string
        +weekNumber: number
        +dayLabel: string
    }
```

### Value Object Definitions

| Value Object   | Fields                                   | Purpose                             |
| -------------- | ---------------------------------------- | ----------------------------------- |
| Weight         | value, unit (lb/kg)                      | Represent load with unit conversion |
| Distance       | value, unit (mi/km/m/yd)                 | Represent distances                 |
| Duration       | seconds                                  | Represent time periods              |
| Pace           | minutesPerUnit, unit                     | Running/rucking pace                |
| NumberRange    | min, max                                 | Flexible set/rep ranges (3-5 sets)  |
| OneRepMax      | weight, testedAt, estimated              | 1RM with provenance                 |
| ProgramContext | programId, blockId, weekNumber, dayLabel | Link workout to program position    |

---

## Enumerations

### Exercise Enums

```mermaid
flowchart LR
    subgraph ExerciseCategory
        EC1["BARBELL"]
        EC2["DUMBBELL"]
        EC3["KETTLEBELL"]
        EC4["BODYWEIGHT"]
        EC5["MACHINE"]
        EC6["CABLE"]
        EC7["CARDIO"]
        EC8["PLYOMETRIC"]
        EC9["LOADED_CARRY"]
    end

    subgraph MovementPattern
        MP1["SQUAT"]
        MP2["HINGE"]
        MP3["PUSH"]
        MP4["PULL"]
        MP5["CARRY"]
        MP6["ROTATE"]
        MP7["GAIT"]
        MP8["ISOMETRIC"]
    end
```

### Program Enums

```mermaid
flowchart LR
    subgraph ProgramSource
        PS1["CUSTOM"]
        PS2["IMPORTED"]
        PS3["SHARED"]
        PS4["MARKETPLACE"]
        PS5["AI_GENERATED"]
        PS6["COACH_ASSIGNED"]
        PS7["TEMPLATE"]
    end

    subgraph BlockType
        BT1["ACCUMULATION"]
        BT2["INTENSIFICATION"]
        BT3["REALIZATION"]
        BT4["DELOAD"]
        BT5["TEST"]
    end

    subgraph SessionType
        ST1["STRENGTH"]
        ST2["CONDITIONING"]
        ST3["SE"]
        ST4["MIXED"]
        ST5["EVENT"]
    end
```

### Logging Enums

```mermaid
flowchart LR
    subgraph SetType
        WT1["WORKING"]
        WT2["WARMUP"]
        WT3["DROP"]
        WT4["AMRAP"]
        WT5["PEAK"]
        WT6["BACKOFF"]
    end

    subgraph GroupType
        GT1["STRAIGHT_SETS"]
        GT2["SUPERSET"]
        GT3["CIRCUIT"]
        GT4["COMPLEX"]
        GT5["EMOM"]
        GT6["AMRAP"]
        GT7["COUPLET"]
    end

    subgraph ScoringType
        SC1["NONE"]
        SC2["FOR_TIME"]
        SC3["TIME"]
        SC4["FOR_REPS"]
        SC5["ROUNDS_PLUS_REPS"]
        SC6["FOR_DISTANCE"]
        SC7["LOAD"]
    end

    subgraph CardioModality
        CM1["RUNNING"]
        CM2["CYCLING"]
        CM3["SWIMMING"]
        CM4["ROWING"]
        CM5["RUCKING"]
        CM6["JUMP_ROPE"]
        CM7["STAIR_CLIMBER"]
        CM8["ELLIPTICAL"]
    end
```

---

## Domain Events

Events that represent significant occurrences in the domain.

```mermaid
flowchart TB
    subgraph WorkoutEvents["Workout Events"]
        WE1["WorkoutStarted"]
        WE2["SetLogged"]
        WE3["SetUndone"]
        WE4["ExerciseAdded"]
        WE5["ExerciseRemoved"]
        WE6["WorkoutCompleted"]
        WE7["WorkoutAbandoned"]
    end

    subgraph ProgramEvents["Program Events"]
        PE1["ProgramCreated"]
        PE2["ProgramUpdated"]
        PE3["BlockCompleted"]
        PE4["WeekCompleted"]
        PE5["ProgramCompleted"]
    end

    subgraph ProgressEvents["Progress Events"]
        PRE1["OneRepMaxUpdated"]
        PRE2["PersonalRecordSet"]
        PRE3["VolumeRecordSet"]
        PRE4["ProgressionTriggered"]
    end

    subgraph SyncEvents["Sync Events"]
        SE1["SyncStarted"]
        SE2["SyncCompleted"]
        SE3["SyncFailed"]
        SE4["ConflictDetected"]
    end
```

### Event Details

| Event                | Payload                   | Triggers                                  |
| -------------------- | ------------------------- | ----------------------------------------- |
| WorkoutStarted       | WorkoutLog                | Start session timer                       |
| SetLogged            | LoggedSet, Exercise       | Update volume, check PR, start rest timer |
| WorkoutCompleted     | WorkoutLog                | Sync, analytics update, PR check          |
| OneRepMaxUpdated     | Exercise, new 1RM         | Recalculate all dependent programs        |
| PersonalRecordSet    | Exercise, LoggedSet       | Celebration notification                  |
| ProgressionTriggered | Exercise, ProgressionRule | Prompt user to increase weights           |

---

## Sharing & Coaching Entities

Entities supporting read-only sharing, accountability groups, and peer/coach relationships.

```mermaid
classDiagram
    class AccountabilityGroup {
        +name: string
        +description: string?
        +createdBy: string
        +dataRetentionDays: number
    }

    class GroupMember {
        +groupId: string
        +userId: string
        +role: GroupRole
        +shareHistoryBeforeJoin: boolean
        +joinedAt: string
    }

    class GroupInvite {
        +groupId: string
        +code: string
        +createdBy: string
        +expiresAt: string
        +isActive: boolean
    }

    class DirectConnection {
        +requesterId: string
        +recipientId: string
        +status: ConnectionStatus
        +requesterGrantsWrite: boolean
        +recipientGrantsWrite: boolean
        +acceptedAt: string?
    }

    class ShareLink {
        +token: string
        +entityType: ShareableEntityType
        +entityId: string
        +createdBy: string
        +isActive: boolean
    }

    AccountabilityGroup "1" --> "*" GroupMember : has
    AccountabilityGroup "1" --> "*" GroupInvite : has
```

### Sharing Enums

```mermaid
flowchart LR
    subgraph GroupRole
        GR1["COACH"]
        GR2["MEMBER"]
    end

    subgraph ConnectionStatus
        CS1["PENDING"]
        CS2["ACTIVE"]
        CS3["DECLINED"]
    end

    subgraph ShareableEntityType
        SE1["PROGRAM"]
        SE2["WORKOUT_LOG"]
    end
```

### Sharing Domain Events

| Event               | Payload               | Triggers                       |
| ------------------- | --------------------- | ------------------------------ |
| GroupCreated        | AccountabilityGroup   | Set up default invite          |
| MemberJoined        | GroupMember           | Notify coach                   |
| MemberLeft          | GroupMember, Group    | Start data retention countdown |
| ConnectionRequested | DirectConnection      | Notify recipient               |
| ConnectionAccepted  | DirectConnection      | Enable mutual visibility       |
| CoachCreatedProgram | Program, targetUserId | Notify member                  |
| CoachUpdatedProgram | Program, changes      | Notify member                  |

---

## Chat Domain

Four new entities supporting in-app messaging.

**Conversation** — Represents a messaging channel. Has a type discriminator (direct or group), an optional title (for group conversations), and an optional reference to a Group entity (for group-linked conversations). `updated_at` is bumped on each new message to support sorting by recency. A Conversation has many ConversationParticipants and many Messages.

**ConversationParticipant** — Junction entity linking a UserProfile to a Conversation. Tracks `last_read_at` (read position cursor), `is_archived` (retention preference), and `left_at` (departure timestamp, nullable). A UserProfile participates in many Conversations; a Conversation has many Participants.

**Message** — A single message within a Conversation. Has a `message_type` discriminator (text, workout, media, system), a `content` field (text body or JSON WorkoutSnapshot for workout-type messages), and a sender reference (nullable for system messages). Messages are append-only in the initial release. A Message may have zero or one MediaAttachment.

**MediaAttachment** — Reference to an externally hosted media asset (Cloudflare Stream for video, Supabase Storage for images and files). Stores provider name, provider asset ID, media type (video, image, or file), thumbnail URL, duration (for video), file size, original filename, MIME type, and processing status. No binary data stored. Belongs to exactly one Message.

**WorkoutSnapshot** is a value object serialized from existing Workout, Program, or Template entities at share time. It has no identity of its own and is stored as JSON in the `content` field of a Message with `message_type = 'workout'`. The snapshot captures all fields necessary to render a workout card (exercise names, sets, reps, weights, percentages, rest periods, notes) and is frozen at the moment of sharing -- it does not reference the source entity and remains viewable even if the original is deleted or made private.

```mermaid
classDiagram
    class Conversation {
        +id: string
        +type: direct | group
        +title: string?
        +groupId: string?
        +createdAt: string
        +updatedAt: string
    }

    class ConversationParticipant {
        +id: string
        +conversationId: string
        +userId: string
        +joinedAt: string
        +lastReadAt: string
        +isArchived: boolean
        +leftAt: string?
    }

    class Message {
        +id: string
        +conversationId: string
        +senderId: string?
        +messageType: text | workout | media | system
        +content: string?
        +createdAt: string
        +syncStatus: pending | synced | failed
    }

    class MediaAttachment {
        +id: string
        +messageId: string
        +provider: cloudflare_stream | supabase_storage
        +providerAssetId: string
        +mediaType: video | image | file
        +thumbnailUrl: string?
        +durationSeconds: number?
        +fileSizeBytes: number?
        +originalFilename: string?
        +mimeType: string?
        +status: processing | ready | failed
        +createdAt: string
    }

    class WorkoutSnapshot {
        <<value object>>
        +exerciseName: string
        +sets: number?
        +reps: number?
        +weight: Weight?
        +percentage: number?
        +restPeriod: Duration?
        +notes: string?
    }

    class AccountabilityGroup {
    }

    class UserProfile {
    }

    Conversation "1" --> "*" ConversationParticipant : has
    Conversation "1" --> "*" Message : contains
    Conversation "*" --> "0..1" AccountabilityGroup : references
    ConversationParticipant "*" --> "1" UserProfile : links
    Message "*" --> "0..1" UserProfile : sender
    Message "1" --> "0..1" MediaAttachment : has
    Message ..> WorkoutSnapshot : "content (workout type)"
```

---

## Event Entities

Entities supporting event tracking and packing lists within the program model. An event is a session with `category: EVENT` that uses a parallel data structure instead of activity groups, activities, and exercises.

```mermaid
classDiagram
    class EventMetadata {
        <<value object>>
        +eventDate: string?
        +location: string?
        +latitude: number?
        +longitude: number?
        +eventUrl: string?
        +requirements: EventRequirement[]
    }

    class EventRequirement {
        <<value object>>
        +key: string
        +value: string
        +unit: string?
        +notes: string?
    }

    class EventItem {
        +id: string
        +name: string
        +category: string?
        +quantity: number
        +isPacked: boolean
        +sortOrder: number
        +notes: string?
    }

    SessionTemplate "1" --> "0..1" EventMetadata : "when category = EVENT"
    SessionTemplate "1" --> "*" EventItem : "when category = EVENT"
    WorkoutLog "1" --> "0..1" EventMetadata : "when category = EVENT"
    WorkoutLog "1" --> "*" EventItem : "when category = EVENT"
    EventMetadata "1" --> "*" EventRequirement : "contains"
```

`EventMetadata` is a value object stored as a JSON column on `session_templates` and `workout_logs`. It is only populated when `category = 'EVENT'`. It contains the event date, location (with optional coordinates for map linking), a URL to the event's external page, and an array of freeform requirements.

`EventRequirement` is a value object within `EventMetadata`. Requirements are freeform key-value pairs representing event-specific constraints such as ruck weight, distance, cutoff time, or corral assignment. Values are untyped strings for human reference -- the app does not perform arithmetic on them.

`EventItem` is an entity (has its own ID) representing a single item on an event's packing list. Items have a free-text category for UI grouping, a quantity, a packed/not-packed boolean, and a sort order for positioning within a category. Items are stored in a dedicated `event_items` table with a polymorphic foreign key to either `session_templates` or `workout_logs`.

---

## Relationships Summary

```mermaid
erDiagram
    USER_PROFILE ||--o{ WORKOUT_LOG : "logs"
    USER_PROFILE ||--o{ ONE_REP_MAX_HISTORY : "tracks"
    USER_PROFILE ||--o{ PROGRAM : "creates"
    USER_PROFILE ||--o{ GROUP_MEMBER : "belongs to"
    USER_PROFILE ||--o{ DIRECT_CONNECTION : "connects"

    EXERCISE ||--o{ ACTIVITY : "prescribed in"
    EXERCISE ||--o{ LOGGED_ACTIVITY : "logged as"
    EXERCISE ||--o{ ONE_REP_MAX_HISTORY : "max tracked"

    PROGRAM ||--o{ BLOCK : "contains"
    PROGRAM ||--o{ SHARE_LINK : "shared via"
    BLOCK ||--o{ BLOCK_WEEK : "contains"
    BLOCK_WEEK ||--o{ SCHEDULED_SESSION : "schedules"
    SCHEDULED_SESSION }o--|| SESSION_TEMPLATE : "uses"

    SESSION_TEMPLATE ||--o{ ACTIVITY_GROUP : "contains"
    ACTIVITY_GROUP ||--o{ ACTIVITY : "contains"
    SESSION_TEMPLATE ||--o{ EVENT_ITEM : "packing list"

    WORKOUT_LOG ||--o{ LOGGED_ACTIVITY_GROUP : "contains"
    WORKOUT_LOG ||--o{ EVENT_ITEM : "packing list"
    WORKOUT_LOG ||--o{ SHARE_LINK : "shared via"
    LOGGED_ACTIVITY_GROUP ||--o{ LOGGED_ACTIVITY : "contains"
    LOGGED_ACTIVITY ||--o{ LOGGED_SET : "records"

    ACCOUNTABILITY_GROUP ||--o{ GROUP_MEMBER : "has"
    ACCOUNTABILITY_GROUP ||--o{ GROUP_INVITE : "has"
```

---

## Query Patterns

### Common Queries

| Query                                  | Entities                                                     | Frequency                   |
| -------------------------------------- | ------------------------------------------------------------ | --------------------------- |
| Today's programmed session             | Program, Block, BlockWeek, ScheduledSession, SessionTemplate | High                        |
| User's exercise maxes                  | UserProfile, OneRepMaxHistory                                | High                        |
| Active workout data                    | WorkoutLog, LoggedSet                                        | Very High (during workout)  |
| Exercise history (last N sessions)     | LoggedActivity, LoggedSet                                    | Medium                      |
| Weekly volume by muscle group          | LoggedSet, Exercise                                          | Low (dashboard)             |
| PR detection for exercise              | LoggedSet, OneRepMaxHistory                                  | Medium (post-workout)       |
| Group activity feed                    | GroupMember, WorkoutLog                                      | Medium (when viewing group) |
| Coach's member list with last activity | GroupMember, WorkoutLog                                      | Low                         |
| Resolve share link                     | ShareLink, Program or WorkoutLog                             | Low                         |
| Event packing list                     | EventItem (via session_template or workout_log)              | Medium (event detail view)  |
| Next upcoming event                    | SessionTemplate, ScheduledSession                            | Medium (Today screen)       |
| Toggle packing item                    | EventItem                                                    | High (during event prep)    |
| Conversation list                      | Conversation, ConversationParticipant                        | High (chat list screen)     |
| Message history                        | Message, ConversationParticipant                             | High (conversation detail)  |
| Unread counts                          | Message, ConversationParticipant                             | High (unread indicators)    |

### Query Optimization Notes

- Index on `LoggedSet(logged_activity_id)` for workout reconstruction
- Index on `LoggedActivity(exercise_id)` for exercise history
- Index on `WorkoutLog(user_id, started_at)` for history list
- Index on `ScheduledSession(block_week_id)` for today's session lookup
- Index on `OneRepMaxHistory(user_id, exercise_id, recorded_at)` for 1RM timeline
- Index on `GroupMember(group_id, user_id)` for membership lookup
- Index on `GroupMember(user_id)` for "my groups" query
- Index on `DirectConnection(requester_id)` and `(recipient_id)` for connection lookup
- Unique index on `ShareLink(token)` for share link resolution
- Index on `event_items(session_template_id)` for template packing list lookup
- Index on `event_items(workout_log_id)` for logged event packing list lookup
