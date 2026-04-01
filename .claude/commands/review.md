---
description: Capture review findings with 4-category triage
model: sonnet
---

# Review Capture

Capture review feedback and link it to the feature or PR being reviewed. Documents what was reviewed, feedback provided, and any decisions made.

## When to use
- After code review, capturing the feedback
- User says "review this PR", "capture review", "document review feedback"
- Starting a review workflow
- After formal code review process

## Model Routing

This command routes to the review category model:

| Environment | Model | Rationale |
|---|---|---|
| Claude Code (work) | sonnet | Review capture requires understanding context |
| OpenCode (home) | gemini-2.5-flash | Balanced review summarization |

## Workflow

### Step 1: Determine review context
1. If $ARGUMENTS provided, check if it's:
   - A PR/MR link to the review
   - A feature reference (e.g., "005")
   - File paths for the review
2. Otherwise, identify what's being reviewed:
   - Feature implementation (Context/Features/NNN/)
   - Pull request or merge request
   - Code change (ask user for details)

### Step 2: Determine capture format
1. **Feature review:** Create Context/Reviews/NNNN-feature-review.md
2. **PR review:** Create Context/Reviews/NNNN-pr-review.md
3. **Ad-hoc review:** Create Context/Reviews/NNNN-review.md

### Step 3: Gather review information
1. **Review scope:** What files/components were reviewed
2. **Feedback provided:** List specific feedback points
   - Issues found (errors, warnings, suggestions)
   - Files affected
   - Actions recommended
3. **Decisions:** What was decided in the review
   - Approve with changes
   - Request changes
   - Approve as-is
   - Other decisions

### Step 4: Write review capture file
1. Create review markdown file with:
   - Review date
   - Reviewer (if known)
   - What was reviewed
   - Feedback summary
   - Actions/decisions
   - Links to related artifacts (feature, PR, ADRs)
2. Save to Context/Reviews/

### Step 5: Follow-up recommendations
Suggest next steps based on review outcome:
- If changes requested: Use `/impl` to create tasks
- If approved: Consider committing with review reference
- If PR/MR: Use `/review-verify` after merging
- Archive review when work is complete
