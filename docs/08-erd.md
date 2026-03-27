# Entity-Relationship Diagrams

## Overview

This document provides comprehensive entity-relationship diagrams for both the local SQLite database and the remote Supabase schema.

---

## Complete ERD

```mermaid
erDiagram
    USER_PROFILE ||--o{ WORKOUT_LOG : "logs"
    USER_PROFILE ||--o{ PROGRAM : "creates"
    USER_PROFILE ||--o{ ONE_REP_MAX_HISTORY : "tracks"
    
    EXERCISE ||--o{ ACTIVITY : "prescribed in"
    EXERCISE ||--o{ LOGGED_ACTIVITY : "logged as"
    EXERCISE ||--o{ ONE_REP_MAX_HISTORY : "max tracked"
    
    PROGRAM ||--o{ BLOCK : "contains"
    BLOCK ||--o{ BLOCK_WEEK : "contains"
    BLOCK_WEEK ||--o{ SCHEDULED_SESSION : "schedules"
    SCHEDULED_SESSION }o--|| SESSION_TEMPLATE : "uses"
    
    SESSION_TEMPLATE ||--o{ ACTIVITY_GROUP : "contains"
    ACTIVITY_GROUP ||--o{ ACTIVITY : "contains"
    
    WORKOUT_LOG ||--o{ LOGGED_ACTIVITY_GROUP : "contains"
    LOGGED_ACTIVITY_GROUP ||--o{ LOGGED_ACTIVITY : "contains"
    LOGGED_ACTIVITY ||--o{ LOGGED_SET : "records"

    USER_PROFILE {
        text id PK
        json exercise_maxes "Map of exerciseId to OneRepMax"
        json bodyweight "nullable Weight"
        json max_reps "Map of exerciseId to int"
        text preferred_units "IMPERIAL or METRIC"
        json training_age "nullable Duration"
        integer created_at "Unix timestamp"
        integer updated_at "Unix timestamp"
    }
    
    EXERCISE {
        text id PK
        text name "NOT NULL, 1-100 chars"
        text aliases "JSON array of search terms"
        text category "NOT NULL, enum"
        text movement_pattern "enum"
        text muscle_groups "JSON array"
        integer is_bilateral "boolean"
        integer supports_1rm "boolean"
        text equipment_required "JSON array"
        integer is_custom "boolean, default 0"
        integer created_at "Unix timestamp"
        integer updated_at "Unix timestamp"
    }
    
    PROGRAM {
        text id PK
        text user_id FK
        text name "NOT NULL"
        text description "nullable"
        text source "enum: TB1, TB2, GREEN, MASS, etc."
        integer duration_weeks "nullable for perpetual"
        integer is_public "boolean"
        integer created_at "Unix timestamp"
        integer updated_at "Unix timestamp"
    }
    
    BLOCK {
        text id PK
        text program_id FK "NOT NULL"
        text name "NOT NULL"
        integer ordinal "NOT NULL, sequential"
        integer duration_weeks "NOT NULL"
        text block_type "NOT NULL, enum"
        integer created_at "Unix timestamp"
        integer updated_at "Unix timestamp"
    }
    
    BLOCK_WEEK {
        text id PK
        text block_id FK "NOT NULL"
        integer week_number "NOT NULL"
        integer created_at "Unix timestamp"
    }
    
    SCHEDULED_SESSION {
        text id PK
        text block_week_id FK "NOT NULL"
        integer day_of_week "nullable for floating"
        text day_label "e.g. Day 1"
        text session_type "NOT NULL, enum"
        text session_template_id FK "NOT NULL"
        text notes "nullable"
    }
    
    SESSION_TEMPLATE {
        text id PK
        text user_id FK
        text name "NOT NULL"
        text description "nullable"
        text category "NOT NULL, enum"
        text rest_between_groups "nullable JSON Duration"
        text time_cap "nullable JSON Duration"
        text scoring "enum, default NONE"
        integer created_at "Unix timestamp"
        integer updated_at "Unix timestamp"
    }
    
    ACTIVITY_GROUP {
        text id PK
        text session_template_id FK "NOT NULL"
        text group_type "NOT NULL, enum"
        integer ordinal "NOT NULL"
        integer rounds "nullable"
        text rest_between_rounds "nullable JSON Duration"
        text rest_between_activities "nullable JSON Duration"
    }
    
    ACTIVITY {
        text id PK
        text activity_group_id FK "NOT NULL"
        text exercise_id FK "NOT NULL"
        integer ordinal "NOT NULL"
        text set_scheme "NOT NULL, JSON (discriminated union)"
        text notes "nullable"
    }
    
    WORKOUT_LOG {
        text id PK
        text user_id FK "NOT NULL"
        integer started_at "NOT NULL, Unix timestamp"
        integer completed_at "nullable, Unix timestamp"
        text session_template_id FK "nullable"
        text program_context "nullable JSON"
        text overall_notes "nullable"
        integer perceived_difficulty "nullable, 1-10"
        text bodyweight_at_session "nullable JSON Weight"
        integer created_at "Unix timestamp"
        integer updated_at "Unix timestamp"
    }
    
    LOGGED_ACTIVITY_GROUP {
        text id PK
        text workout_log_id FK "NOT NULL"
        text group_type "NOT NULL, enum"
        integer ordinal "NOT NULL"
        integer actual_rounds_completed "nullable"
        text completion_time "nullable JSON Duration"
    }
    
    LOGGED_ACTIVITY {
        text id PK
        text logged_group_id FK "NOT NULL"
        text exercise_id FK "NOT NULL"
        integer ordinal "NOT NULL"
        text notes "nullable"
    }
    
    LOGGED_SET {
        text id PK
        text logged_activity_id FK "NOT NULL"
        integer set_number "NOT NULL"
        text set_type "NOT NULL, enum"
        text prescribed "nullable JSON"
        integer actual_reps "nullable"
        text actual_weight "nullable JSON Weight"
        text actual_duration "nullable JSON Duration"
        text actual_distance "nullable JSON Distance"
        text actual_pace "nullable JSON Pace"
        integer actual_heart_rate "nullable"
        integer rpe "nullable, 1-10"
        integer completed "boolean"
        text notes "nullable"
        text ruck_load "nullable JSON Weight"
        text elevation_gain "nullable JSON Distance"
        integer created_at "Unix timestamp"
    }
    
    ONE_REP_MAX_HISTORY {
        text id PK
        text user_id FK "NOT NULL"
        text exercise_id FK "NOT NULL"
        text weight "NOT NULL, JSON Weight"
        integer estimated "boolean"
        integer recorded_at "NOT NULL, Unix timestamp"
    }
```

---

## Local Database Schema (SQLite)

### Core Tables

```mermaid
erDiagram
    exercises {
        TEXT id PK "UUID"
        TEXT name "NOT NULL"
        TEXT aliases "JSON array"
        TEXT category "NOT NULL, enum"
        TEXT movement_pattern "enum"
        TEXT muscle_groups "JSON array"
        INTEGER is_bilateral "BOOLEAN"
        INTEGER supports_1rm "BOOLEAN"
        TEXT equipment_required "JSON array"
        INTEGER is_custom "BOOLEAN, DEFAULT 0"
        INTEGER created_at "Unix timestamp"
        INTEGER updated_at "Unix timestamp"
    }
    
    workout_logs {
        TEXT id PK "UUID"
        TEXT user_id "UUID"
        INTEGER started_at "NOT NULL, Unix timestamp"
        INTEGER completed_at "nullable, Unix timestamp"
        TEXT session_template_id FK "nullable"
        TEXT program_context "nullable JSON"
        TEXT overall_notes "nullable"
        INTEGER perceived_difficulty "nullable, 1-10"
        TEXT bodyweight_at_session "nullable JSON"
        INTEGER created_at "Unix timestamp"
        INTEGER updated_at "Unix timestamp"
    }
    
    logged_activity_groups {
        TEXT id PK "UUID"
        TEXT workout_log_id FK "NOT NULL"
        TEXT group_type "NOT NULL, enum"
        INTEGER ordinal "NOT NULL"
        INTEGER actual_rounds_completed "nullable"
        TEXT completion_time "nullable JSON"
    }
    
    logged_activities {
        TEXT id PK "UUID"
        TEXT logged_group_id FK "NOT NULL"
        TEXT exercise_id FK "NOT NULL"
        INTEGER ordinal "NOT NULL"
        TEXT notes "nullable"
    }
    
    logged_sets {
        TEXT id PK "UUID"
        TEXT logged_activity_id FK "NOT NULL"
        INTEGER set_number "NOT NULL"
        TEXT set_type "NOT NULL, enum"
        TEXT prescribed "nullable JSON"
        INTEGER actual_reps "nullable"
        TEXT actual_weight "nullable JSON"
        TEXT actual_duration "nullable JSON"
        TEXT actual_distance "nullable JSON"
        TEXT actual_pace "nullable JSON"
        INTEGER actual_heart_rate "nullable"
        INTEGER rpe "nullable"
        INTEGER completed "BOOLEAN"
        TEXT notes "nullable"
        TEXT ruck_load "nullable JSON"
        TEXT elevation_gain "nullable JSON"
        INTEGER created_at "Unix timestamp"
    }
    
    workout_logs ||--o{ logged_activity_groups : "workout_log_id"
    logged_activity_groups ||--o{ logged_activities : "logged_group_id"
    logged_activities ||--o{ logged_sets : "logged_activity_id"
    logged_activities }o--|| exercises : "exercise_id"
```

### Program Tables

```mermaid
erDiagram
    programs {
        TEXT id PK "UUID"
        TEXT user_id "UUID"
        TEXT name "NOT NULL"
        TEXT description "nullable"
        TEXT source "enum"
        INTEGER duration_weeks "nullable"
        INTEGER is_public "BOOLEAN, DEFAULT 0"
        INTEGER created_at "Unix timestamp"
        INTEGER updated_at "Unix timestamp"
    }
    
    blocks {
        TEXT id PK "UUID"
        TEXT program_id FK "NOT NULL"
        TEXT name "NOT NULL"
        INTEGER ordinal "NOT NULL"
        INTEGER duration_weeks "NOT NULL"
        TEXT block_type "NOT NULL, enum"
        INTEGER created_at "Unix timestamp"
        INTEGER updated_at "Unix timestamp"
    }
    
    block_weeks {
        TEXT id PK "UUID"
        TEXT block_id FK "NOT NULL"
        INTEGER week_number "NOT NULL"
        INTEGER created_at "Unix timestamp"
    }
    
    scheduled_sessions {
        TEXT id PK "UUID"
        TEXT block_week_id FK "NOT NULL"
        INTEGER day_of_week "nullable"
        TEXT day_label "nullable"
        TEXT session_type "NOT NULL, enum"
        TEXT session_template_id FK "NOT NULL"
        TEXT notes "nullable"
    }
    
    session_templates {
        TEXT id PK "UUID"
        TEXT user_id "UUID"
        TEXT name "NOT NULL"
        TEXT description "nullable"
        TEXT category "NOT NULL, enum"
        TEXT rest_between_groups "nullable JSON"
        TEXT time_cap "nullable JSON"
        TEXT scoring "enum, DEFAULT NONE"
        INTEGER created_at "Unix timestamp"
        INTEGER updated_at "Unix timestamp"
    }
    
    activity_groups {
        TEXT id PK "UUID"
        TEXT session_template_id FK "NOT NULL"
        TEXT group_type "NOT NULL, enum"
        INTEGER ordinal "NOT NULL"
        INTEGER rounds "nullable"
        TEXT rest_between_rounds "nullable JSON"
        TEXT rest_between_activities "nullable JSON"
    }
    
    activities {
        TEXT id PK "UUID"
        TEXT activity_group_id FK "NOT NULL"
        TEXT exercise_id FK "NOT NULL"
        INTEGER ordinal "NOT NULL"
        TEXT set_scheme "NOT NULL, JSON"
        TEXT notes "nullable"
    }
    
    programs ||--o{ blocks : "program_id"
    blocks ||--o{ block_weeks : "block_id"
    block_weeks ||--o{ scheduled_sessions : "block_week_id"
    scheduled_sessions }o--|| session_templates : "session_template_id"
    session_templates ||--o{ activity_groups : "session_template_id"
    activity_groups ||--o{ activities : "activity_group_id"
    activities }o--|| exercises : "exercise_id"
```

### User Tables

```mermaid
erDiagram
    user_profiles {
        TEXT id PK "UUID"
        TEXT exercise_maxes "JSON map"
        TEXT bodyweight "nullable JSON"
        TEXT max_reps "JSON map"
        TEXT preferred_units "enum, DEFAULT IMPERIAL"
        TEXT training_age "nullable JSON"
        INTEGER created_at "Unix timestamp"
        INTEGER updated_at "Unix timestamp"
    }
    
    one_rep_max_history {
        TEXT id PK "UUID"
        TEXT user_id FK "NOT NULL"
        TEXT exercise_id FK "NOT NULL"
        TEXT weight "NOT NULL, JSON"
        INTEGER estimated "BOOLEAN"
        INTEGER recorded_at "NOT NULL, Unix timestamp"
    }
    
    user_profiles ||--o{ one_rep_max_history : "user_id"
```

---

## Indices

### Exercise Indices

```sql
-- Exercise search
CREATE INDEX idx_exercises_name ON exercises(name);
CREATE INDEX idx_exercises_category ON exercises(category);
CREATE INDEX idx_exercises_custom ON exercises(is_custom);
```

### Workout Log Indices

```sql
-- History list (most recent first)
CREATE INDEX idx_workout_logs_user_started 
    ON workout_logs(user_id, started_at DESC);

-- Active workout check
CREATE INDEX idx_workout_logs_user_active 
    ON workout_logs(user_id, completed_at)
    WHERE completed_at IS NULL;

-- Program context lookup
CREATE INDEX idx_workout_logs_session_template 
    ON workout_logs(session_template_id);
```

### Logged Set Indices

```sql
-- Reconstruct a workout
CREATE INDEX idx_logged_sets_activity 
    ON logged_sets(logged_activity_id);

-- Exercise history across workouts
CREATE INDEX idx_logged_activities_exercise 
    ON logged_activities(exercise_id);
```

### Program Indices

```sql
-- Block ordering
CREATE UNIQUE INDEX idx_blocks_program_ordinal 
    ON blocks(program_id, ordinal);

-- Week lookup
CREATE INDEX idx_block_weeks_block 
    ON block_weeks(block_id);

-- Session scheduling
CREATE INDEX idx_scheduled_sessions_week 
    ON scheduled_sessions(block_week_id);

-- Activity ordering
CREATE UNIQUE INDEX idx_activities_group_ordinal 
    ON activities(activity_group_id, ordinal);
```

### 1RM Indices

```sql
-- 1RM timeline for an exercise
CREATE INDEX idx_1rm_history_user_exercise 
    ON one_rep_max_history(user_id, exercise_id, recorded_at DESC);
```

---

## Remote Schema (Supabase/PostgreSQL)

### Table Structure

The Supabase schema mirrors the SQLite schema with the following differences:

| Difference | SQLite | Supabase |
|-----------|--------|----------|
| Timestamps | INTEGER (Unix) | TIMESTAMPTZ |
| Booleans | INTEGER (0/1) | BOOLEAN |
| JSON fields | TEXT (JSON string) | JSONB |
| User ID | TEXT (nullable) | UUID (NOT NULL, references auth.users) |
| RLS | Not applicable | Enabled on all tables |

### Row Level Security

All tables enforce user data isolation:

```sql
-- Pattern applied to every table
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own data"
    ON workout_logs
    FOR ALL
    USING (user_id = auth.uid());
```

### Supabase Collection Structure

```mermaid
flowchart TB
    subgraph Supabase["Supabase Tables"]
        Exercises["exercises<br/>(shared + user custom)"]
        Programs["programs"]
        Blocks["blocks"]
        BlockWeeks["block_weeks"]
        ScheduledSessions["scheduled_sessions"]
        SessionTemplates["session_templates"]
        ActivityGroups["activity_groups"]
        Activities["activities"]
        WorkoutLogs["workout_logs"]
        LoggedActivityGroups["logged_activity_groups"]
        LoggedActivities["logged_activities"]
        LoggedSets["logged_sets"]
        UserProfiles["user_profiles"]
        OneRepMaxHistory["one_rep_max_history"]
    end
```

---

## Data Type Mappings

### Local to Remote Type Mapping

| Local (SQLite) | Remote (Supabase) | Notes |
|----------------|-------------------|-------|
| TEXT (UUID) | UUID | Same format |
| INTEGER (Unix timestamp) | TIMESTAMPTZ | Convert on sync |
| TEXT (JSON string) | JSONB | Parse/stringify on sync |
| INTEGER (boolean 0/1) | BOOLEAN | Convert on sync |
| TEXT (enum) | TEXT | Same format (uppercase) |

---

## Query Examples

### Get Today's Programmed Session

```sql
SELECT 
    st.*,
    ss.day_label,
    ss.session_type,
    ss.notes
FROM scheduled_sessions ss
JOIN session_templates st ON ss.session_template_id = st.id
JOIN block_weeks bw ON ss.block_week_id = bw.id
JOIN blocks b ON bw.block_id = b.id
JOIN programs p ON b.program_id = p.id
WHERE p.user_id = :userId
    AND bw.week_number = :currentWeek
    AND (ss.day_of_week = :todayDow OR ss.day_of_week IS NULL)
ORDER BY ss.day_label
```

### Get Exercise History (Last 10 Sessions)

```sql
SELECT 
    wl.started_at,
    ls.set_number,
    ls.set_type,
    ls.actual_reps,
    ls.actual_weight,
    ls.rpe,
    ls.prescribed
FROM logged_sets ls
JOIN logged_activities la ON ls.logged_activity_id = la.id
JOIN logged_activity_groups lag ON la.logged_group_id = lag.id
JOIN workout_logs wl ON lag.workout_log_id = wl.id
WHERE la.exercise_id = :exerciseId
    AND wl.user_id = :userId
    AND wl.completed_at IS NOT NULL
ORDER BY wl.started_at DESC, ls.set_number ASC
LIMIT 100
```

### Calculate Weekly Volume for Exercise

```sql
SELECT 
    SUM(ls.actual_reps * CAST(json_extract(ls.actual_weight, '$.value') AS REAL)) as tonnage,
    COUNT(ls.id) as total_sets,
    SUM(ls.actual_reps) as total_reps
FROM logged_sets ls
JOIN logged_activities la ON ls.logged_activity_id = la.id
JOIN logged_activity_groups lag ON la.logged_group_id = lag.id
JOIN workout_logs wl ON lag.workout_log_id = wl.id
WHERE la.exercise_id = :exerciseId
    AND wl.user_id = :userId
    AND wl.started_at >= :weekStart
    AND wl.started_at < :weekEnd
    AND ls.completed = 1
    AND ls.actual_weight IS NOT NULL
```
