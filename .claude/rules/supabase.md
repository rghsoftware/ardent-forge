---
paths:
  - 'supabase/**'
  - '**/*.sql'
---

# Supabase Conventions

## Migrations

- All schema changes go through migration files in `supabase/migrations/`
- Migration naming: `YYYYMMDDHHMMSS_description.sql`
- Never modify production schema outside of migrations
- Each migration should be atomic and reversible where practical
- Test migrations locally with `npx supabase db push` before committing

## Row Level Security (RLS)

- RLS enabled on every table that stores user data
- Policies use `auth.uid()` for ownership checks
- Separate policies for SELECT, INSERT, UPDATE, DELETE
- Default deny -- only grant what is explicitly needed
- Test RLS policies with different user contexts

## SQL Style

- Use lowercase for SQL keywords (select, insert, update, etc.)
- Table and column names: snake_case
- Primary keys: `id uuid default gen_random_uuid()`
- Timestamps: `created_at timestamptz default now()`, `updated_at timestamptz`
- Foreign keys: `[table]_id` naming convention
- All queries parameterized -- no string concatenation for values

## Indices

- Create indices for columns used in WHERE clauses and JOINs
- Composite indices follow query pattern order
- Name indices descriptively: `idx_[table]_[columns]`

## Triggers

- Use triggers for `updated_at` auto-updates
- Trigger functions in a dedicated schema or clearly named
- Keep trigger logic simple -- complex business logic belongs in application code

### `auth.users` triggers (added by F018)

The codebase has one `security definer` trigger on `auth.users` insert (`trg_auth_user_default_gym`, installed by `20260407000001_create_gyms.sql`). When adding new triggers on `auth.users`, follow the same pattern: `security definer`, locked `search_path`, idempotent against retries (`on conflict do nothing` or equivalent), and an integration test that creates a user via `auth.admin.createUser` (or a direct `insert into auth.users` under superuser) and asserts the downstream side effect. `supabase/tests/018_trigger.sql` is the reference pattern.

## Seed Data

- Seed data in `supabase/seed.sql` for local development
- Seed data must be idempotent (safe to run multiple times)

## Client Usage (Frontend)

- Use typed Supabase client generated from schema
- Handle Supabase errors at the call site with meaningful messages
- Use `.single()` when expecting exactly one row
- Realtime subscriptions cleaned up on component unmount
