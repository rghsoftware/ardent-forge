# Notification System Design

## Overview

The notification system in Forge is focused and minimal. Unlike a habit app that needs to remind users to act, a fitness app's notifications serve three specific purposes: rest timer alerts during workouts, workout reminders for scheduled sessions, and PR celebrations. Ardent Forge avoids notification overload.

---

## Notification Philosophy

```mermaid
mindmap
  root((Notification Philosophy))
    Minimal
      Only notify when actionable
      No daily nags
      No guilt for rest days
    During Workout
      Rest timer is primary
      Must survive background
      Clear audio and haptic
    Scheduled Sessions
      Optional reminders
      Never punitive
      Easy to dismiss
    Celebration
      PRs worth celebrating
      Brief and satisfying
      Not every workout
```

### Guiding Principles

| Principle | Implementation |
|-----------|----------------|
| Respect attention | Only 3 notification types total |
| No guilt | Never remind about missed workouts |
| During-workout priority | Rest timer is the only high-priority notification |
| User control | All reminders optional and configurable |
| Platform-appropriate | Tauri handles platform notification APIs |

---

## Notification Types

### Type 1: Rest Timer Alert

The most important notification in the system. Fires when the rest countdown between sets reaches zero.

```mermaid
flowchart LR
    subgraph RestAlert["Rest Timer Alert"]
        Icon["⏱️"]
        Title["Rest complete"]
        Body["Barbell Squat — Set 3 of 5"]
        
        subgraph Actions["Actions"]
            Open["Open Workout"]
            Dismiss["Dismiss"]
        end
    end
```

| Element | Content |
|---------|---------|
| Priority | High (heads-up display) |
| Sound | Short chime (configurable) |
| Vibration | Double tap pattern |
| Ongoing | No — fires once and clears |
| Auto-cancel | Yes — when user opens workout |
| Platform | Tauri notification plugin (Android, iOS, Desktop) |

**Behavior by platform**:

| Platform | Screen Locked | App Backgrounded |
|----------|--------------|-------------------|
| Android | Heads-up notification + sound | Full notification |
| iOS | Lock screen notification + sound | Full notification |
| Desktop | System notification | System notification |
| Browser | Web Notification API (if permitted) | Web Notification |

### Type 2: Session Reminder

Optional notification reminding the user they have a programmed workout today. Only sent if the user has enabled reminders and has an active program.

```mermaid
flowchart LR
    subgraph SessionReminder["Session Reminder"]
        Icon["🏋️"]
        Title["Operator Day 1"]
        Body["Squat • Bench • WPU — 3×5 @ 75%"]
        
        subgraph Actions["Actions"]
            Start["Start Workout"]
            Later["Later"]
        end
    end
```

| Element | Content |
|---------|---------|
| Priority | Default |
| Sound | Default system sound (optional) |
| Timing | User-configurable (default: 30 min before typical training time) |
| Sent when | Active program + session scheduled today + not yet completed |
| Not sent when | Rest day, workout already logged, reminders disabled |

**Scheduling logic**:

```mermaid
flowchart TB
    Check{"Is there a session<br/>scheduled today?"}
    Check -->|No| Skip["No notification"]
    Check -->|Yes| Done{"Already completed<br/>today's workout?"}
    Done -->|Yes| Skip
    Done -->|No| Enabled{"Reminders<br/>enabled?"}
    Enabled -->|No| Skip
    Enabled -->|Yes| Send["Send reminder<br/>at configured time"]
```

### Type 3: Personal Record Notification

Celebratory notification when a new PR is detected after completing a workout.

```mermaid
flowchart LR
    subgraph PRNotification["PR Notification"]
        Icon["🎉"]
        Title["New PR: Barbell Squat"]
        Body["245lb × 5 — your best 5RM!"]
        
        subgraph Actions["Actions"]
            View["View Details"]
            Dismiss["Dismiss"]
        end
    end
```

| Element | Content |
|---------|---------|
| Priority | Default |
| Sound | Celebration sound (optional) |
| Timing | Immediately after workout completion + PR detection |
| Types detected | 1RM, 3RM, 5RM, max reps at weight, max distance, max duration |

**PR Detection logic**:

```mermaid
flowchart TB
    Complete["Workout completed"]
    
    Complete --> Analyze["Analyze each exercise<br/>in the workout"]
    
    Analyze --> Compare["Compare to historical bests"]
    
    Compare --> Check{"New best for<br/>any rep range?"}
    
    Check -->|Yes| Notify["Send PR notification"]
    Check -->|No| Skip["No notification"]
    
    Notify --> Record["Record PR in history"]
```

---

## What We Explicitly Don't Notify About

```mermaid
flowchart TB
    subgraph NeverNotify["Never Send Notifications For"]
        Missed["Missed workouts"]
        Streak["Workout streaks"]
        Guilt["Guilt reminders"]
        Social["Social activity"]
        Marketing["Tips or promotions"]
        Daily["Daily check-ins"]
    end
    
    Missed --> R1["Creates guilt — not our job"]
    Streak --> R2["We don't track streaks"]
    Guilt --> R3["'You haven't worked out in 3 days' is banned"]
    Social --> R4["Not a social app"]
    Marketing --> R5["Not a marketing channel"]
    Daily --> R6["Only notify when actionable"]
```

---

## Notification Channels (Android)

```mermaid
flowchart TB
    subgraph Channels["Notification Channels"]
        RestTimer["rest_timer<br/>Importance: High<br/>Sound: Chime"]
        Reminders["workout_reminders<br/>Importance: Default<br/>Sound: Optional"]
        PRs["personal_records<br/>Importance: Default<br/>Sound: Celebration"]
        System["system<br/>Importance: Low<br/>Sound: None"]
    end
```

### Channel Definitions

| Channel ID | Name | Importance | Sound | Vibrate | Description |
|------------|------|------------|-------|---------|-------------|
| `rest_timer` | Rest Timer | High | Short chime | Yes (double tap) | Between-set alerts |
| `workout_reminders` | Workout Reminders | Default | Optional | Optional | Scheduled session reminders |
| `personal_records` | Personal Records | Default | Celebration | Yes | PR celebrations |
| `system` | System | Low | None | No | Sync errors, updates |

---

## Notification Scheduling

### Architecture

```mermaid
flowchart TB
    subgraph Scheduling["Notification Sources"]
        subgraph InWorkout["During Workout"]
            RestTimerService["Rust Rest Timer<br/>Background service"]
        end
        
        subgraph Background["Background"]
            SessionCheck["Session reminder scheduler"]
            PRDetection["Post-workout PR analysis"]
        end
    end
    
    subgraph Delivery["Delivery"]
        TauriNotif["Tauri Notification Plugin"]
        Platform["Platform Notification API<br/>Android / iOS / Desktop"]
    end
    
    RestTimerService --> TauriNotif
    SessionCheck --> TauriNotif
    PRDetection --> TauriNotif
    TauriNotif --> Platform
```

### Timing Strategy

| Notification Type | Trigger | Precision |
|-------------------|---------|-----------|
| Rest timer alert | Rust timer countdown | Exact (± 100ms) |
| Session reminder | Scheduled check | Flexible (± 15 min window) |
| PR celebration | Post-workout analysis | Immediate after detection |
| Sync error | Sync failure event | Immediate |

---

## Quiet Hours

Rest timer notifications are always delivered (user is actively working out). All other notifications respect quiet hours.

**Default Quiet Hours**: 10 PM — 6 AM (user configurable)

**Behavior during quiet hours**:

| Notification Type | Quiet Hours Behavior |
|-------------------|---------------------|
| Rest timer alert | Always delivered (user-initiated workout) |
| Session reminder | Deferred to end of quiet hours |
| PR celebration | Deferred to end of quiet hours |
| Sync error | Deferred to end of quiet hours |

---

## User Preferences

### Notification Settings

```mermaid
flowchart TB
    subgraph NotifSettings["Notification Settings Screen"]
        Master["Notifications<br/>Master toggle"]
        
        subgraph PerType["Per-Type Settings"]
            Rest["Rest Timer Alerts<br/>Sound selection<br/>Vibration pattern"]
            Reminders["Session Reminders<br/>Toggle + default time"]
            PRNotifs["PR Celebrations<br/>Toggle"]
        end
        
        subgraph Timing["Timing"]
            Quiet["Quiet Hours<br/>Start + end time"]
            ReminderTime["Default Reminder Time<br/>Minutes before training"]
        end
    end
```

### Default Settings

| Setting | Default Value |
|---------|--------------|
| Notifications enabled | Yes |
| Rest timer sound | System chime |
| Rest timer vibration | Double tap |
| Session reminders | Off (opt-in) |
| PR celebrations | On |
| Quiet hours start | 10:00 PM |
| Quiet hours end | 6:00 AM |
| Reminder advance | 30 minutes before |

---

## Action Handling

### Notification Actions

```mermaid
sequenceDiagram
    participant Notif as Notification
    participant App as React App
    participant Router as TanStack Router
    
    alt Rest Timer Alert
        Notif->>App: Tap "Open Workout"
        App->>Router: Navigate to /log/:workoutId
    else Session Reminder - Start
        Notif->>App: Tap "Start Workout"
        App->>App: Create WorkoutLog from template
        App->>Router: Navigate to /log/:workoutId
    else Session Reminder - Later
        Notif->>App: Dismiss notification
    else PR Notification
        Notif->>App: Tap "View Details"
        App->>Router: Navigate to /exercises/:exerciseId
    end
```

---

## Message Guidelines

### Approved Messages

| Context | Message |
|---------|---------|
| Rest complete | "Rest complete" / "Time for set [N]" |
| Session reminder | "[Session name] — [exercise list summary]" |
| PR detected | "New PR: [Exercise] — [weight] × [reps]" |
| Sync error | "Changes saved locally. Tap to retry sync." |

### Forbidden Messages

| Never Use | Why |
|-----------|-----|
| "You missed your workout" | Guilt-inducing |
| "Don't skip leg day" | Judgmental |
| "Your streak is at risk" | We don't track streaks |
| "Time to work out!" | Unsolicited nag |
| "You haven't logged in X days" | Shaming for rest |

---

## Notification IDs

| Type | ID Strategy | Example |
|------|-------------|---------|
| Rest timer alert | Fixed ID | 1001 |
| Session reminder | Hash of session template ID | templateId.hashCode() |
| PR celebration | Hash of exercise ID + date | exerciseId.hashCode() + dateHash |
| Sync error | Fixed ID | 9001 |

Using fixed IDs for rest timer ensures new alerts replace previous ones rather than stacking.

---

## Technical Implementation Notes

### Tauri Notification Plugin

Ardent Forge uses the `tauri-plugin-notification` for cross-platform notification delivery. The plugin handles:
- Android notification channels
- iOS notification categories
- Desktop native notifications
- Permission requests

### Rest Timer in Rust

The rest timer runs in the Rust backend (not in JavaScript) to survive WebView backgrounding. The flow:

```mermaid
sequenceDiagram
    participant UI as React UI
    participant Rust as Rust Backend
    participant OS as Platform Notification
    
    UI->>Rust: invoke('start_rest_timer', { seconds: 150 })
    Rust->>Rust: Start async timer
    
    Note over Rust: Timer runs independently<br/>of WebView lifecycle
    
    loop Every second
        Rust->>UI: emit('timer_tick', { remaining: N })
    end
    
    Rust->>OS: Send notification (timer expired)
    Rust->>UI: emit('timer_expired')
```

This ensures the timer fires even if:
- The screen is locked
- The user switches to another app
- The WebView is suspended by the OS
