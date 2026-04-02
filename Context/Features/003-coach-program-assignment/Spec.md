# Feature Spec: Coach Program Assignment (18a-ii)

**Feature:** 003-coach-program-assignment
**Step:** 18a-ii of implementation-plan.md
**Status:** Draft
**Date:** 2025-04-02

---

## Overview

Allow a coach to assign an existing program they own to a group member. The program was built under the coach's account while the member hadn't yet signed up. Once the member joins the group, the coach transfers it via a cascade `UPDATE ... SET user_id = $member` on the program and all child records. The `created_by` field stays unchanged -- it already captures the coach authorship. After transfer, standard Step 18a-18e coach write permissions apply.

---

## Problem Statement

Coaches frequently build training programs before their athletes sign up. The only current workflow is "CREATE PROGRAM," which starts from scratch with `userId = member`. There is no path for a coach to take an existing program they already built and hand it to a member when they arrive.

---

## User Stories

1. **As a coach**, I want to assign an existing program I built to a group member, so the athlete gets it immediately without me rebuilding it.
2. **As a member**, I want to see the assigned program in my library with full edit rights, so I can customize it (SH-2: member always wins).
3. **As a coach**, I want to continue editing the assigned program's sessions and structure for my athlete after handoff (18b-18e permissions).

---

## Requirements

### Must Have

- **M1**: Coach can select from their own programs and assign one to a group member
- **M2**: Assignment is two UPDATE statements: `programs SET user_id = $member WHERE id = $program_id`, and `session_templates SET user_id = $member WHERE id IN (SELECT session_template_id FROM scheduled_sessions -> block_weeks -> blocks WHERE program_id = $program_id)`. All other child tables (blocks, block_weeks, scheduled_sessions, activity_groups, activities) have no `user_id` -- they inherit ownership through FK chains.
- **M3**: `created_by` field is unchanged -- remains the coach's ID
- **M4**: Tauri path executes all updates in a single SQLite transaction; partial failure rolls back
- **M5**: Supabase path executes all updates atomically (Postgres transaction or RPC)
- **M6**: Operation validates coach role in shared group before executing (RLS on Supabase path; explicit validation on Tauri path)
- **M7**: Member sees the assigned program in their program list after the operation

### Should Have

- **S1**: Member receives a notification: "COACH ASSIGNED PROGRAM: [name]"
- **S2**: UI program picker shows only programs the coach owns (not programs previously assigned to them)
- **S3**: Confirmation step before assignment executes

### Won't Have (this iteration)

- **W1**: Coach retaining a copy after assignment -- use template/share links (Step 16) for reusability
- **W2**: Bulk assignment to multiple members
- **W3**: Partial program assignment (specific blocks only)

---

## Testable Assertions

| ID | Assertion | Category |
|----|-----------|----------|
| TA-1 | Coach assigns program -> member's program list contains the program with `userId = member`, `createdBy = coach` | Functional |
| TA-2 | Coach's program list no longer contains the program after assignment | Functional |
| TA-3 | All session_templates referenced by the program's scheduled sessions have `userId = member`; blocks, block_weeks, scheduled_sessions carry no `user_id` and are unchanged | Data integrity |
| TA-4 | Non-coach user cannot invoke assign (rejected) | Security |
| TA-5 | Coach not sharing a group with target member cannot assign (rejected) | Security |
| TA-6 | Member can edit/delete the assigned program (SH-2) | Invariant |
| TA-7 | Coach can edit the assigned program's sessions and structure post-handoff (18b-18e) | Invariant |
| TA-8 | Tauri path: partial failure (e.g. session_templates update fails) rolls back all updates | Reliability |
| TA-9 | Member receives notification after successful assignment | UX |
| TA-10 | Program picker shows only programs where `userId = coach` (not COACH_ASSIGNED programs received by the coach) | UX |

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Step 17 (Groups with roles) | Complete | Coach/member roles, group membership |
| Step 18a (Coach program creation) | Complete | RLS policies already cover coach write to program tree |
| Step 12 (Program builder) | Complete | Program data model, CRUD operations |
