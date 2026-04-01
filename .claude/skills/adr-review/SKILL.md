# Skill: ADR & Drift Review

## Purpose
Run a comprehensive project-level review of architectural decisions and spec alignment. Combines ADR consistency checking with drift detection across all active features.

## When to use
- Before a major PR or merge request
- At sprint/iteration boundaries
- User says "review ADRs", "check for drift", "are we still on track"
- When >5 ADRs exist and it's been a while since the last review

## Workflow

### Step 1: ADR consistency check
Run the logic from the `check-adr-consistency` agent:

1. Load all ADRs from `Context/Decisions/`
2. Build the supersedes graph
3. Check for:
   - Two accepted ADRs affecting the same files with conflicting decisions
   - Broken supersedes chains (A supersedes B, but C also supersedes B independently)
   - ADRs referencing files that no longer exist in the project
   - Proposed ADRs that were never accepted (stale proposals)

### Step 2: Spec drift detection
For each active feature in `Context/Features/`:

1. Load `Spec.md` Testable Assertions
2. Load all ADRs that reference this feature
3. Check:
   - Are there assertions with status "Active" that have been contradicted by ADRs?
   - Are there ADRs documenting deviations that don't have corresponding Spec.md revision history entries?
   - Has >30% of assertions been superseded? (Signal: spec is stale, consider rewriting)

### Step 3: Coverage gaps
1. Identify features with Steps.md tasks marked complete but no associated ADRs for changes that differ from the original spec
2. Identify significant code changes (new files, new modules) that lack any planning artifact

### Step 4: Report
Present findings organized by severity:

```
## ADR & Drift Review Report

### 🔴 Issues (require action)
- [Contradicting ADRs, broken chains, stale specs]

### 🟡 Warnings (review recommended)
- [Potential drift, stale proposals, coverage gaps]

### 🟢 Healthy
- [Features and ADRs that are consistent and current]

### Summary
- Total active ADRs: X
- Total active features: X
- Features with potential drift: X
- Recommended actions: [list]
```

## Rules
- This is a read-only review — it does not modify any files
- Flag issues but don't auto-fix — the user decides what to do
- If no issues found, say so clearly — don't manufacture concerns
- This review complements but does not replace the pr-review-toolkit agents
