---
description: Initialize spec-driven design templates for the project
model: sonnet
effort: low
---

# Initialize Spec Templates

Generate the Spec-Driven Design template set for this project. Scans existing code and documentation, then produces structured spec docs in `docs/specs/` that integrate with the Cortex planning workflow.

## When to use
- First time setting up spec-driven development in a project
- Converting existing docs (PRDs, architecture docs, Cortex specs) into the template format
- User says "init specs", "create spec templates", "set up specs", "convert my docs"

## Workflow

**CRITICAL:** This command reads project context before generating anything. Do NOT write files until Step 4.

### Step 1: Gather project context
1. Read `CLAUDE.md` for project name, tech stack, architecture, conventions
2. Scan project structure for existing documentation:
   - `docs/` -- any existing spec or design docs
   - `README.md` -- project description
   - `Context/Features/` -- existing Cortex feature specs (Spec.md, Tech.md, Steps.md)
   - `Context/Decisions/` -- existing ADRs
3. Scan source code structure for domain hints:
   - Model/entity class definitions
   - Enum/sealed class definitions
   - Database migration files
   - Route/endpoint definitions
4. Check if `docs/specs/` already exists

### Step 2: Present findings and choose mode
Present what was found and offer three modes:

```
Project: {name}
Stacks: {detected stacks}
Existing docs found: {list}
Cortex specs found: {count} features in Context/Features/

Modes:
  [G] Greenfield -- blank templates pre-filled from project context
  [B] Backfill -- convert existing docs into template format
  [S] Selective -- pick which templates to generate

Which mode? [G/B/S]:
```

Wait for user choice before proceeding.

### Step 3: Determine template set
For greenfield and backfill, confirm which templates to generate:

**Always generate (singletons):**
- `00-project-overview.md`
- `02-domain-model.md`
- `03-invariants.md`
- `04-architecture.md`
- `05-erd.md`
- `06-state-machines.md`
- `07-user-flows.md`

**Ask the user (multi-instance):**
- How many PRDs? What are they named? (suggest based on existing docs/features)
- Any subsystem deep-dives needed? (suggest: notifications, auth, sync if detected)
- Any secondary platform docs? (suggest based on detected platforms)
- How many implementation plans? (suggest: one per major feature area)

### Step 4: Generate templates
Use the `spec-init` skill (see `core/skills/spec-init/SKILL.md`) to generate each template file.

For each file:
1. Create the file in `docs/specs/` with correct naming convention
2. In greenfield mode: fill project-specific placeholders, keep guidance comments
3. In backfill mode: map existing doc content to template sections, flag inferred content
4. Show progress as files are generated

### Step 5: Validate and report
1. Run cross-reference validation (assertions, invariants, entities, states)
2. Generate `docs/specs/GAPS.md` with sections needing attention
3. Present summary:

```
Spec Init Complete
  Mode: {greenfield/backfill/selective}
  Files generated: {count}
    - 00-project-overview.md
    - 01-PRD-001-core.md
    - 01-PRD-002-sync.md
    - 02-domain-model.md
    - ...

  Cross-references:
    [PASS] 12/12 P0 requirements have assertions
    [WARN] 2 invariants need assertion mappings
  
  Gaps: docs/specs/GAPS.md (3 sections need attention)

Next steps:
  1. Review GAPS.md and fill empty sections
  2. Run /blueprint for your first feature
  3. plan-from-specs will auto-detect these docs
```

## Rules
- Always run Step 1 (context gathering) before generating anything
- Never overwrite existing files in `docs/specs/` without asking
- In backfill mode, preserve original docs -- copy content, don't move/delete
- Show progress as files are generated (don't go silent for 30 seconds)
- If the project has no CLAUDE.md, suggest running `/setup` first
- Cross-reference validation is not optional -- always run it
- GAPS.md is always generated, even when no gaps are found
- For backfill mode, prefer doc content over source code inference
- Flag all inferred content with `<!-- INFERRED: verify this -->` comments
- If `docs/specs/` already has files, ask before proceeding (merge vs overwrite vs abort)
