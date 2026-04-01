# Skill: Create Feature Specification

## Purpose
Generate a comprehensive feature specification (Spec.md) that captures **what** to build and **why**, without prescribing technical implementation. This is Phase 1 of the 4-phase planning workflow.

## When to use
- Starting a new feature or significant change
- User describes a feature they want to build
- User says "spec this out", "plan this feature", "write a spec"

## Prerequisites
- User has described the feature, problem, or goal
- Project CLAUDE.md exists with architecture context

## Workflow

### Step 1: Gather context
1. Read the root `CLAUDE.md` for project architecture and conventions
2. Read any existing feature specs in `Context/Features/` to avoid overlap
3. If the feature area is unclear, ask the user for clarification before proceeding

### Step 2: Determine feature number
1. List existing directories and files in `Context/Features/`
2. Find the highest existing number (NNN prefix)
3. Assign the next number: `NNN+1`

### Step 3: Create the spec
1. Create directory `Context/Features/NNN-FeatureName/`
2. Write `Spec.md` using the template below
3. Fill all sections based on the user's description and project context

### Step 4: Review with user
1. Present the spec summary to the user
2. Ask if anything is missing, wrong, or out of scope
3. Iterate until the user approves

## Spec.md Template

```markdown
# Feature NNN: [Feature Name]

## Overview
[2-3 sentence summary of what this feature does and why it matters]

## Problem Statement
[What problem does this solve? What's the current pain point?]

## User Stories
- As a [role], I want [capability] so that [benefit]
- As a [role], I want [capability] so that [benefit]

## Requirements

### Must Have
- [Requirement with enough detail to be unambiguous]
- [Requirement with enough detail to be unambiguous]

### Should Have
- [Requirement — important but not blocking]

### Won't Have (this iteration)
- [Explicitly excluded to prevent scope creep]

## Testable Assertions

Concrete, verifiable statements about expected behavior. Each assertion should
be unambiguous enough that comparing it against the implementation produces a
clear yes/no answer.

| ID    | Assertion                                               | Verification    |
|-------|---------------------------------------------------------|-----------------|
| A-001 | [Specific verifiable behavior statement]                | [How to verify] |
| A-002 | [Specific verifiable behavior statement]                | [How to verify] |

## Open Questions
- [ ] [Anything uncertain that needs resolution before or during implementation]

## Revision History

| Date       | Change         | ADR  |
|------------|----------------|------|
| YYYY-MM-DD | Initial spec   | —    |
```

## Rules
- Do NOT include technical implementation details — that's Phase 2 (Tech.md)
- Do NOT include task breakdown — that's Phase 3 (Steps.md)
- Testable Assertions must be specific enough for yes/no verification
- Every "Must Have" requirement should map to at least one Testable Assertion
- Open Questions should be genuine unknowns, not lazy placeholders
- If the feature overlaps with an existing spec, note the relationship explicitly
