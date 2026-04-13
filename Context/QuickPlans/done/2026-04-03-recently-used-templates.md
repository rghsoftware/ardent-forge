# Quick Plan: Recently Used Section in Session Picker

**Task:** Add a "Recently Used" section to `SessionPickerSheet` that shows the last 3-5 assigned templates pinned above the full list.

**Goal:** Reduce picker friction when users have 20+ templates by surfacing the most recently assigned ones at the top without requiring any user action.

---

## Approach

### 1. Domain type + schema (`src/domain/types/session.ts`)
Add optional `lastAssignedAt: z.string().datetime().optional()` to `sessionTemplateSchema`. Inherits from `syncableEntitySchema` — this is purely additive.

### 2. SQLite migration (`src-tauri/migrations/`)
New file `004_session_template_last_assigned.sql`:
```sql
ALTER TABLE session_templates ADD COLUMN last_assigned_at INTEGER;
```

### 3. SQLite adapter update (`src-tauri/src/`)
In the template repository's assign/update path, set `last_assigned_at = unixepoch()` when a template is assigned to a session slot. The Tauri command that fires when `onSelect` is called in the builder needs to touch this column.

> Need to confirm the exact command name — likely in `src-tauri/src/commands/` or similar.

### 4. Supabase migration (`supabase/migrations/`)
New migration adding column to `session_templates`:
```sql
ALTER TABLE session_templates ADD COLUMN last_assigned_at TIMESTAMPTZ;
```

### 5. Hook update (`src/hooks/use-session-templates.ts`)
Expose a `recentTemplates` derived value: filter templates where `lastAssignedAt` is set, sort by `lastAssignedAt DESC`, slice to top 5.

Alternatively, add a `useRecentSessionTemplates(userId, limit)` hook that queries SQLite directly with `ORDER BY last_assigned_at DESC LIMIT 5` to keep it efficient at scale.

### 6. Picker update (`src/components/program-builder/session-picker-sheet.tsx`)
- If `recentTemplates.length > 0` and search is empty and filter is `ALL`: render a "Recent" section header + up to 5 recent template buttons above the full list.
- Hide the recent section when the user is actively searching or filtering (it would be redundant and confusing).
- Reuse the same `handleSelect` callback -- no behavior change on selection.
- No new state needed.

### 7. Trigger `last_assigned_at` update
In `builder.tsx` (or wherever `onSelect` lands), after assigning the template to the draft, call a new Tauri command `touch_template_last_assigned(templateId)` or piggyback on an existing upsert.

---

## File Checklist

| File | Change |
|---|---|
| `src/domain/types/session.ts` | Add `lastAssignedAt` field |
| `src-tauri/migrations/004_*.sql` | New migration |
| `supabase/migrations/YYYYMMDD_*.sql` | New migration |
| `src-tauri/src/...` | Update assign path to set `last_assigned_at` |
| `src/hooks/use-session-templates.ts` | Expose recent templates |
| `src/components/program-builder/session-picker-sheet.tsx` | Render "Recent" section |
| `src/routes/_authenticated/builder.tsx` | Trigger timestamp update on select |

---

## Verification

- Assign a template to a slot; reopen the picker -- it appears in "Recent" at the top.
- After assigning 6+ different templates, only the 5 most recent appear.
- Typing in the search box hides the Recent section.
- Changing the category filter (non-ALL) hides the Recent section.
- Fresh install with no assignments: Recent section is absent (no empty header).
- Existing templates with no `last_assigned_at` degrade gracefully (no crash, no entry in Recent).

---

## Risks

- **Tauri command location:** Need to confirm where template assignment is persisted in the Rust layer before adding the timestamp update. Incorrect placement could miss updates or double-count.
- **Sync conflict:** If `last_assigned_at` is synced to Supabase, a multi-device user's recent list would reflect the last device used -- acceptable behavior, but worth being aware of.
- **Migration ordering:** SQLite migrations run at app launch via Tauri; Supabase migrations run via `npx supabase db push`. Both must be present before testing end-to-end.
