# Feature 016: Public Visibility

## Overview

Allow users to publish their custom exercises, session templates, and programs so
any authenticated user on the instance can discover, browse, and clone them into
their own library. This creates a community layer where athletes share training
knowledge without requiring direct connections or share links.

## Problem Statement

Today, the only way to share a program is via a token-based share link (Feature
003 share links). This requires the author to generate a link and distribute it
out-of-band. There is no way for a user to browse what others have created.
Custom exercises are entirely invisible outside the author's account, and session
templates have no sharing mechanism at all. The `is_public` flag on programs
exists in the schema but is inert -- no RLS policy, UI toggle, or discovery
endpoint uses it.

Athletes want to discover proven programs and exercises from other serious
lifters on the platform. Authors want recognition and the ability to contribute
to a shared knowledge base. This feature bridges that gap by turning the
existing `is_public` placeholder into a full publish/discover/clone workflow.

## User Stories

- As an athlete, I want to browse publicly shared programs so I can find proven
  training plans without needing a direct link.
- As an athlete, I want to browse publicly shared exercises so I can discover
  movement variations I have not considered.
- As a program author, I want to publish my program so other athletes on the
  platform can benefit from it.
- As a template author, I want to publish individual session templates so others
  can use my workout designs without adopting my full program.
- As an athlete, I want to clone a public program or template into my library so
  I can customize it for my own training.
- As an author, I want to unpublish my content at any time so I retain control
  over my work.
- As an athlete viewing a public program, I want to see the author's display
  name so I can gauge credibility.

## Requirements

### Must Have

- **PV-M1**: Toggle `is_public` on programs via UI (existing column, new toggle)
- **PV-M2**: Add `is_public` column to `session_templates` table with default
  `false`; add UI toggle
- **PV-M3**: Add `is_public` column to `exercises` table (custom exercises only)
  with default `false`; add UI toggle
- **PV-M4**: RLS SELECT policies on `programs`, `session_templates`,
  `exercises`, and all child tables granting read access to any authenticated
  user when the parent entity has `is_public = true`
- **PV-M5**: Publishing a program cascades -- a single confirmation tells the
  author "publishing this program will also make all its templates and exercises
  public" and sets `is_public = true` on the program, its referenced session
  templates, and their referenced custom exercises in one operation
- **PV-M6**: Unpublishing a program sets `is_public = false` on the program only
  (templates and exercises remain independently publishable); removes it from
  browse results; does not affect existing clones
- **PV-M7**: Add search and filtering to the programs list (name search,
  category filter) -- prerequisite infrastructure that does not exist today
- **PV-M8**: Add search and filtering to the session templates list (name
  search, category filter) -- prerequisite infrastructure that does not exist
  today
- **PV-M9**: Add a scope filter ("Mine" / "Public") to programs, templates, and
  exercises lists. "Public" queries `is_public = true` content from all users;
  "Mine" shows the user's own content (current behavior). No separate pages or
  tabs -- same list view, different query
- **PV-M10**: Clone-to-library action for public programs (reuse existing
  `useCloneProgram` hook; set `source: 'MARKETPLACE'`)
- **PV-M11**: Clone-to-library action for public session templates (new hook;
  deep-copies template + activity groups + activities)
- **PV-M12**: Read-only detail view for a public program (reuse/adapt
  `SharedProgramView`)
- **PV-M13**: Read-only detail view for a public session template
- **PV-M14**: Author attribution -- display the author's display name on public
  content

### Should Have

- **PV-S1**: Sort options on list views (newest, alphabetical)

### Won't Have (this iteration)

- **PV-W1**: Ratings, reviews, or comments on public content
- **PV-W2**: Following/subscribing to authors
- **PV-W3**: Featured/curated collections
- **PV-W4**: Revenue sharing or paid programs
- **PV-W5**: Versioning of public content (edits apply immediately)
- **PV-W6**: Anonymous/unauthenticated browse (share links already cover that)
- **PV-W7**: Public workout logs or training history
- **PV-W8**: Clone/usage counts
- **PV-W9**: Author profile pages
- **PV-W10**: Account age or verification gating for publishing

## Testable Assertions

| ID    | Assertion                                                                                                    | Verification           |
| ----- | ------------------------------------------------------------------------------------------------------------ | ---------------------- |
| A-001 | An authenticated user can set `is_public = true` on a program they own                                       | UI toggle + DB check   |
| A-002 | An authenticated user can set `is_public = true` on a session template they own                              | UI toggle + DB check   |
| A-003 | An authenticated user can set `is_public = true` on a custom exercise they own                               | UI toggle + DB check   |
| A-004 | A non-owner authenticated user can SELECT a program where `is_public = true`                                 | RLS policy test        |
| A-005 | A non-owner authenticated user can SELECT child rows (blocks, weeks, scheduled sessions) of a public program | RLS policy test        |
| A-006 | A non-owner authenticated user can SELECT a session template where `is_public = true`                        | RLS policy test        |
| A-007 | A non-owner authenticated user can SELECT child rows (activity groups, activities) of a public template      | RLS policy test        |
| A-008 | A non-owner authenticated user can SELECT a custom exercise where `is_public = true`                         | RLS policy test        |
| A-009 | A non-owner authenticated user CANNOT SELECT a private program, template, or exercise they do not own        | RLS policy test        |
| A-010 | Publishing a program cascades: sets `is_public = true` on the program, its templates, and their exercises    | DB transaction test    |
| A-011 | The publish confirmation message tells the author all content will become public                             | UI test                |
| A-012 | Programs list supports search by name and filtering by category                                              | UI test                |
| A-013 | Session templates list supports search by name and filtering by category                                     | UI test                |
| A-014 | Programs, templates, and exercises lists have a scope filter ("Mine" / "Public")                             | UI test                |
| A-015 | "Public" scope shows `is_public = true` content from all users; "Mine" shows only the user's own             | Query + UI test        |
| A-016 | Cloning a public program creates a new program with `source = 'MARKETPLACE'` and `is_public = false`         | Clone action + DB test |
| A-017 | Cloning a public template creates a deep copy (template + groups + activities) owned by the cloning user     | Clone action + DB test |
| A-018 | Unpublishing a program sets `is_public = false` and removes it from public results                           | UI toggle + query test |
| A-019 | Unpublishing does not affect previously cloned copies                                                        | DB integrity test      |
| A-020 | Public content displays the author's display name                                                            | UI rendering test      |
| A-021 | Setting `is_public = true` on a system exercise (`is_custom = false`) is not possible                        | Constraint test        |
| A-022 | The `exercises_custom_user_check` constraint still holds: `is_public = true` requires `is_custom = true`     | DB constraint test     |

## Resolved Questions

- [x] Clone model: snapshot at clone time. Clones are fully independent copies.
      No lineage tracking or update notifications.

## Dependencies

- Existing `is_public` column on `programs` table (migration 20260328000002)
- Existing share link clone infrastructure (`useCloneProgram`,
  `CloneProgramButton`, `share-rpc-mapper`)
- Existing `SharedProgramView` component for read-only rendering
- User profiles with `display_name` (for author attribution)

## Relationships

- **Feature 003 (Coach Program Assignment)**: Orthogonal. Coach assignment is
  1:1 ownership transfer within groups; public visibility is 1:many read-only
  discovery.
- **Share Links**: Complementary. Share links provide anonymous token-based
  access; public visibility provides authenticated browse-based discovery.
  Both can coexist on the same entity.

## Revision History

| Date       | Change       | ADR |
| ---------- | ------------ | --- |
| 2026-04-05 | Initial spec | --  |
