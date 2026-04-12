# Quick Plan: Group Ordinal Badge Color

**Task:** Validate that `bg-surface-steel` (not ember) is the correct color for the group ordinal badge in `activity-group-editor.tsx`.

**Goal:** Confirm the design decision -- ordinal badges convey sequence, not importance. Position already communicates order. Ember is reserved for primary CTAs and active states (Iron & Ember principle: "molten sparingly").

**Current State:** Already implemented as `bg-surface-steel` at `activity-group-editor.tsx:169`. No code change needed.

**Design Reasoning:**
- The ordinal ("1", "2", "3") tells the user *which* group -- but position on screen already does that redundantly.
- Ember on every ordinal would make every group feel like a primary action, diluting the accent's signal strength.
- `surface-steel` reads as a label or index chip, not a call to action. That is the right semantic.
- The reorder arrows (up/down) beside the ordinal are the interactive affordance -- they don't need the ordinal to be ember to draw attention.

**Verification:** No action needed -- the implementation already matches the decision. If reviewed: `activity-group-editor.tsx:169` shows `bg-surface-steel`, not `bg-ember` or `text-ember`.

**Risks:** None. This is design confirmation, not a change.

**Recommendation:** Close as validated. Optionally add a comment in the component or a note in DESIGN.md documenting *why* ordinals are steel (positional redundancy + ember conservation), so future contributors don't "fix" it back to ember.
