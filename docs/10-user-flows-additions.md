# User Flows Additions: Backend Configuration

These flows should be added to `10-user-flows.md` in a new section "Backend Configuration Flows" and referenced from the Flow Index mindmap.

---

## Flow Index Mindmap Addition

Add a new branch to the existing mindmap:

```
    Backend Configuration
      First launch (smart default)
      Manual backend setup
      Change backend
```

---

## Flow 12: First Launch (Smart Default)

The first-launch flow for a user installing the Play Store app who is connecting to the maintainer's hosted instance. The bundled defaults succeed, and the user never sees a configuration screen.

```mermaid
sequenceDiagram
    participant User
    participant App as React App
    participant Config as Config Store
    participant Supa as Supabase (Maintainer's)

    User->>App: Opens app for first time
    App->>Config: hasConfig()?
    Config-->>App: false

    App->>App: Read bundled env var defaults
    App->>Supa: Health check (GET /rest/v1/)
    Supa-->>App: 200 OK

    App->>Config: setConfig(url, key)
    App->>App: Initialize Supabase client
    App->>App: Route to sign-in screen
    User->>App: Signs up or signs in
    App->>App: Route to main app
```

### Screen States

| State | What User Sees |
|-------|---------------|
| App loading | Splash / loading indicator (< 1 second) |
| Health check passing | Nothing — transparent |
| Auth screen | Standard Iron & Ember sign-in screen |

---

## Flow 13: First Launch (Self-Hosted / No Defaults)

The first-launch flow for a user installing the app without bundled defaults, or when bundled defaults fail to connect (e.g., maintainer's instance is down or the app was built without env vars).

```mermaid
sequenceDiagram
    participant User
    participant App as React App
    participant Config as Config Store
    participant Supa as Target Supabase

    User->>App: Opens app for first time
    App->>Config: hasConfig()?
    Config-->>App: false

    App->>App: Read bundled env var defaults
    
    alt No env vars present
        App->>App: Route to setup screen
    else Env vars present but connection fails
        App->>Supa: Health check
        Supa-->>App: Error / timeout
        App->>App: Route to setup screen
    end

    App->>User: Setup screen: "CONFIGURE BACKEND"
    User->>App: Enters Supabase URL + publishable key
    App->>Supa: Validate connection
    Supa-->>App: 200 OK + schema detected

    App->>Config: setConfig(url, key)
    App->>App: Initialize Supabase client
    App->>App: Route to sign-in screen
```

### Setup Screen States

| State | What User Sees |
|-------|---------------|
| Empty form | URL and key fields, "CONNECT" button, help link |
| Validating | Spinner on "CONNECT" button, fields disabled |
| Connection failed | Inline error: "Cannot reach server. Check URL and key." |
| Connected, no schema | Inline warning: "Connected, but database schema not found. See setup guide." with link |
| Success | Brief checkmark, then automatic navigation to sign-in |

---

## Flow 14: Change Backend (Browser)

User changes the backend from Settings. Browser mode is simpler — no local data to wipe.

```mermaid
sequenceDiagram
    participant User
    participant Settings as Settings Screen
    participant Config as Config Store
    participant Auth as Supabase Auth
    participant Supa as New Supabase

    User->>Settings: Navigates to Settings → Backend
    Settings->>Settings: Shows current URL (truncated)
    User->>Settings: Taps "CHANGE BACKEND"
    Settings->>Settings: Shows edit form with current values

    User->>Settings: Enters new URL + key
    Settings->>Supa: Validate connection
    Supa-->>Settings: 200 OK

    Settings->>Auth: Sign out current session
    Settings->>Config: setConfig(newUrl, newKey)
    Settings->>Settings: Discard cached Supabase client
    Settings->>Settings: Route to sign-in screen
```

---

## Flow 15: Change Backend (Tauri)

User changes the backend from Settings in Tauri mode. Requires data wipe confirmation per CF-3.

```mermaid
sequenceDiagram
    participant User
    participant Settings as Settings Screen
    participant Config as Config Store
    participant Rust as Rust Backend
    participant Auth as Supabase Auth
    participant Supa as New Supabase

    User->>Settings: Navigates to Settings → Backend
    Settings->>Settings: Shows current URL (truncated)
    User->>Settings: Taps "CHANGE BACKEND"
    Settings->>Settings: Shows edit form with current values

    User->>Settings: Enters new URL + key
    Settings->>Supa: Validate connection
    Supa-->>Settings: 200 OK

    Settings->>User: Confirmation dialog
    Note over User,Settings: "Changing the backend will sign you out<br/>and delete all locally cached data.<br/>Your data on the previous server is not affected."

    alt User confirms
        User->>Settings: Taps "CONFIRM"
        Settings->>Auth: Sign out
        Settings->>Rust: invoke('wipe_synced_data')
        Rust->>Rust: Drop + recreate synced tables
        Rust-->>Settings: Done
        Settings->>Config: setConfig(newUrl, newKey)
        Settings->>Settings: Discard cached Supabase client
        Settings->>Settings: Route to sign-in screen
    else User cancels
        User->>Settings: Taps "CANCEL"
        Settings->>Settings: Return to settings (no changes)
    end
```

---

## Settings Screen Addition

The existing Settings route gains a new section. The section ordering in Settings becomes:

| Section | Contents |
|---------|----------|
| Profile | Display name, bodyweight, training age, preferred units |
| 1RM Management | Current 1RMs, update buttons |
| Backend | Current Supabase URL, "CHANGE BACKEND" button |
| Notifications | Notification preferences (from Step 15) |
| Data | Export, clear local data |
| About | Version, licenses, links |
