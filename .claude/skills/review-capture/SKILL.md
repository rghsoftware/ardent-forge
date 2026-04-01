# Skill: Capture Review Findings

## Purpose
Persist code review findings to disk in a structured, triaged format so they survive
context compaction and can be resolved in a fresh session.

## When to use
- After running any review agent (qa-python, qa-vue, qa-rust, qa-embedded, qa-kotlin)
- After running pr-review-toolkit agents
- After running check-task-completion or check-adr-consistency
- After receiving manual review feedback from a teammate
- User says "capture review", "save review findings", "write up the review"

## Workflow

### Step 1: Identify the review source
Determine what was reviewed and by whom:
- Which branch or feature?
- Which review agents ran (or was this manual feedback)?
- What files were in scope?

If this skill is invoked after review agents already ran in the same session, gather
their output from the conversation. If the user is providing external feedback (e.g.,
from a GitLab MR), ask them to paste or describe the findings.

### Step 2: Determine the feature context
1. Check `git branch --show-current` to identify the branch
2. Look for a matching feature in `Context/Features/` based on branch name
3. If no match, ask the user which feature this review belongs to
4. Load `Spec.md` and `Steps.md` from the feature directory for cross-referencing

### Step 3: Triage each finding

Categorize every finding into exactly one of four categories:

**[FIX] Fix-now** — Code quality issues, convention violations, missing error handling,
typos, formatting. These get fixed inline during the resolution pass. No planning
artifacts needed.

Signals: linter warnings, style violations, missing null checks, bare excepts,
unused imports, wrong function signatures, off-by-one errors.

**[TASK] Missing task** — Work that should have been in Steps.md but wasn't. Needs a
new S### task number so it gets tracked and verified. This includes missing tests,
undocumented endpoints, edge cases the plan didn't anticipate.

Signals: "no test for X", "this case isn't handled", "docs not updated for Y",
missing accessibility, missing validation on an input the spec didn't mention.

**[ADR] Architectural concern** — Design problems that require a decision. Wrong
abstraction, missing separation of concerns, security gaps, performance anti-patterns,
dependency issues. These warrant an ADR because they change the technical approach.

Signals: "this should be a separate service", "you're coupling X to Y", "this won't
scale past N", "this auth approach has a vulnerability", "the spec assumed X but
the implementation does Y".

**[RULE] Convention gap** — A pattern the reviewer flagged repeatedly that the current
rules don't catch. The finding should become a rule update so future code gets it
right automatically.

Signals: same issue in 3+ files, reviewer says "we should always do X", pattern not
mentioned in any `.claude/rules/*.md` file, the post-edit hook doesn't catch it.

### Step 4: Assign finding IDs

Each finding gets a unique ID within the review: `P{review-number}-{sequence}`.
The review number increments based on existing files in `Context/Reviews/`.

Example: First review in the project → P1-001, P1-002, P1-003...

### Step 5: Cross-reference with planning artifacts

For each finding:
- Check if it relates to a Testable Assertion in Spec.md (note the assertion ID)
- Check if it relates to an existing task in Steps.md (note the task number)
- Check if an existing ADR already covers the concern
- Note these references in the finding entry

### Step 6: Write the review file

Create `Context/Reviews/PR-{branch-short-name}-{YYYY-MM-DD}.md` with the
following structure:

```markdown
# PR Review: {source-branch} → {target-branch}

**Date:** {YYYY-MM-DD}
**Feature:** Context/Features/{NNN-Name}/
**Branch:** {full branch name}
**Reviewers:** {list of agents or "manual"}
**Status:** 🔴 Unresolved

## Summary
{2-3 sentence overview: N findings total, breakdown by category}

## Findings

### Fix-Now

#### [FIX] P{N}-001: {Short description}
- **File:** {path/to/file.py:line}
- **Severity:** {Critical | High | Medium | Low}
- **Detail:** {What's wrong and why it matters}
- **Status:** ⬜ Unresolved
- **Resolution:** —

### Missing Tasks

#### [TASK] P{N}-002: {Short description}
- **File:** {path/to/file.py or general area}
- **Severity:** {Critical | High | Medium | Low}
- **Detail:** {What's missing and why it should be tracked}
- **Relates to:** {A-### assertion or S### task if applicable}
- **Status:** ⬜ Unresolved
- **Resolution:** —

### Architectural Concerns

#### [ADR] P{N}-003: {Short description}
- **File:** {path/to/file.py or module}
- **Severity:** {Critical | High | Medium | Low}
- **Detail:** {What the design problem is and what it affects}
- **Relates to:** {Tech.md section, existing ADR, or assertion}
- **Status:** ⬜ Unresolved
- **Resolution:** —

### Convention Gaps

#### [RULE] P{N}-004: {Short description}
- **Files:** {list of files where pattern appears}
- **Severity:** {Medium | Low}
- **Detail:** {What convention is missing and how often it appeared}
- **Suggested rule:** {Which rule file and what to add}
- **Status:** ⬜ Unresolved
- **Resolution:** —

## Resolution Checklist
- [ ] All [FIX] findings resolved
- [ ] All [TASK] findings added to Steps.md
- [ ] All [ADR] findings have ADRs created or dismissed
- [ ] All [RULE] findings applied or dismissed
- [ ] Review verified by review-verify agent
```

### Step 7: Present summary to user

After writing the file, present:
- Total findings by category
- Critical/High items that need immediate attention
- The file path so they know where to find it
- Suggest: "Start a fresh session and run review-resolve to work through these"

## Rules
- ALWAYS write to disk before doing anything else — the whole point is persistence
- One review file per review pass — don't append to old review files
- If a finding is ambiguous between categories, prefer the more structured category
  ([TASK] over [FIX], [ADR] over [TASK]) — it's better to over-track than lose things
- Never auto-resolve findings during capture — capture is observation only
- Include exact file paths and line numbers wherever possible
- If the review session is running low on context, write what you have immediately
  rather than trying to complete a thorough analysis — partial capture beats total loss
