# Skill: Technical Research & Architecture

## Purpose
Research and document **how** to build a feature — architecture decisions, technology choices, risk assessment. This is Phase 2 of the 4-phase planning workflow. Produces Tech.md.

## When to use
- After Spec.md is approved (Phase 1 complete)
- User says "research how to build this", "plan the architecture", "tech plan"

## Prerequisites
- `Context/Features/NNN-FeatureName/Spec.md` exists and is approved
- Project CLAUDE.md is available for architecture context

## Workflow

### Step 1: Load context
1. Read the feature's `Spec.md` — especially Requirements and Testable Assertions
2. Read `CLAUDE.md` for project architecture, existing patterns, and conventions
3. Read all accepted ADRs in `Context/Decisions/` that relate to the feature area
4. Read active `.claude/rules/` files for stacks this feature touches
5. Check existing `Tech.md` files in other features for established patterns

### Step 2: Research and analyze
1. Identify the key technical decisions this feature requires
2. For each decision, evaluate options with trade-offs
3. Check if any decision conflicts with or builds on existing ADRs
4. Identify risks and unknowns that need resolution
5. Map the feature to specific stacks — which rules/conventions apply

### Step 3: Write Tech.md
1. Write `Context/Features/NNN-FeatureName/Tech.md` using the template below
2. Reference specific ADRs and rules where relevant
3. Be explicit about what's decided vs. what needs further investigation

### Step 4: Review with user
1. Present key decisions and their trade-offs
2. Flag any decisions that conflict with existing ADRs (user must resolve)
3. Iterate until user approves the technical approach

## Tech.md Template

```markdown
# Tech Plan: [Feature Name]

**Spec:** Context/Features/NNN-FeatureName/Spec.md
**Stacks involved:** [Python/FastAPI, Vue.js, Rust/Tauri, Embedded C, Kotlin — whichever apply]

## Architecture Overview
[High-level description of how this feature fits into the existing system]
[Diagram if helpful — describe in text, not image]

## Key Decisions

### Decision 1: [Topic]
**Options considered:**
- Option A: [description] — [trade-offs]
- Option B: [description] — [trade-offs]

**Chosen:** Option [X]
**Rationale:** [Why this option wins given the project context]
**Related ADRs:** [ADR-NNNN if this builds on or relates to existing decisions]

### Decision 2: [Topic]
[Same structure]

## Stack-Specific Details

### [Stack Name] (e.g., Python/FastAPI)
- **Files to create/modify:** [list]
- **Patterns to follow:** [reference to rule file or existing code]
- **Dependencies:** [new packages/crates/modules needed]

### [Stack Name] (repeat for each stack involved)

## Integration Points
[How different stacks connect for this feature — API contracts, IPC messages,
shared state, database schemas]

## Risks & Unknowns
- **Risk:** [What could go wrong]
  - **Mitigation:** [How to reduce the risk]
- **Unknown:** [What we don't know yet]
  - **Resolution plan:** [How and when to resolve it]

## Testing Strategy
[High-level approach — which stacks need tests, what kind, any special
test infrastructure needed. Detailed test tasks go in Steps.md]
```

## Rules
- Every decision must reference existing ADRs if they touch the same area
- If a decision contradicts an existing ADR, flag it — the user must resolve by creating a new ADR
- Do NOT break down implementation tasks — that's Phase 3 (Steps.md)
- Stack-specific details should reference the project's `.claude/rules/` files
- Testing strategy here is high-level — specific test tasks are generated in Phase 3
- If the feature spans multiple stacks, document the integration contract explicitly
