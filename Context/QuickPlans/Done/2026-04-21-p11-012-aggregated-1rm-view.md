# Quick Plan: Aggregated 1RM View (P11-012)

**Date:** 2026-04-21
**Backlog Source:** `Context/Backlog/Ideas.md` -- P11-012

---

## Task

Surface the aggregated cross-exercise 1RM view that was removed from the profile page during the PR #76 responsiveness overhaul.

## Goal

The Vault's 1RM TRENDS tab already shows per-exercise historical charts (`VaultOneRmTab`). Add the aggregated current-max summary (`OneRmManagement`) above the trend selector so athletes can see all their 1RMs at a glance and drill into a trend by clicking an exercise.

## Current State

| Component | Location | Status |
|---|---|---|
| `OneRmManagement` | `src/components/profile/one-rm-management.tsx` | Exists, not surfaced anywhere |
| `VaultOneRmTab` | `src/components/vault/vault-one-rm-tab.tsx` | Live in Vault "1RM TRENDS" tab |
| `VaultOneRmTab` | `src/routes/_authenticated/vault.tsx` | Wired as `value="one-rm"` tab |

## Approach

Enhance `VaultOneRmTab` to show two sections:

1. **Aggregated summary** (top) -- wire `OneRmManagement` using profile data. Clicking an exercise row pre-selects it in the trend selector (optional UX improvement).
2. **Trend chart** (below) -- existing exercise selector + `OneRmChart` (unchanged).

**Data requirement:** `OneRmManagement` needs `exerciseMaxes: Record<string, OneRepMax>` and `preferredUnits` from user profile. Add `useUserProfile(userId)` to `VaultOneRmTab` to supply these props.

**Files to touch:**
- `src/components/vault/vault-one-rm-tab.tsx` -- add `useUserProfile`, render `OneRmManagement` above trend section

No other files need to change. `OneRmManagement` is already a complete component.

## Verification

- Vault > 1RM TRENDS tab shows list of all exercises with current 1RM values
- "Update" button in aggregated list opens the edit dialog (inherited from `OneRmManagement`)
- Selecting an exercise in the trend selector still shows the chart below
- Empty states work: no maxes recorded, no exercises with `supports1RM`
- Loading skeleton covers both sections

## Risks

- `useUserProfile` may return `exerciseMaxes` as `undefined` before load -- need null-safe default (`exerciseMaxes ?? {}`)
- If user has no 1RM data, `OneRmManagement` renders its own `EmptyState` -- the double empty state (one from `VaultOneRmTab`, one from `OneRmManagement`) must be reconciled: let `OneRmManagement` own the empty state and suppress the outer one
