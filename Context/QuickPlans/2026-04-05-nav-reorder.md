# Quick Plan: Reorder Nav Items into Logical Groups

**Date:** 2026-04-05
**Source:** Context/Backlog/Ideas.md

## Task

Navigation items are in an arbitrary order. Reorder them so related sections are grouped together and the hierarchy reflects how features relate.

## Goal

Group nav items logically so users can find related features near each other.

## Current Order

**Sidebar** (`src/components/layout/sidebar-nav.tsx`):

1. Forge, 2. Tracker, 3. Builder, 4. Vault, 5. Comms, 6. Library, 7. Groups, 8. Connections

**Mobile** (`src/components/layout/mobile-nav.tsx`):

1. Forge, 2. Tracker, 3. Library, 4. Vault, 5. Comms

## Proposed Order

**Sidebar:**

1. Forge (home/dashboard -- always first)
2. Tracker (workout tracking)
3. Builder (workout creation)
4. Library (exercise reference)
5. Vault (personal records/data)
6. Groups (social)
7. Connections (social)
8. Comms (social/messaging)

Rationale: Core workout tools (Forge, Tracker, Builder) first, reference (Library, Vault) in the middle, social features (Groups, Connections, Comms) last.

**Mobile:**

1. Forge
2. Tracker
3. Library
4. Vault
5. Comms

Rationale: Same logical flow -- core first, reference, then social. Mobile already omits Builder/Groups/Connections.

## Approach

1. Reorder the `navItems` array in `sidebar-nav.tsx`
2. Reorder the `navItems` array in `mobile-nav.tsx`
3. No logic changes -- purely reordering array elements

## Verification

- Visual check: nav items appear in the new order
- No broken links or missing items
- `bun run build` passes

## Risks

- None -- purely cosmetic array reorder with no logic changes
