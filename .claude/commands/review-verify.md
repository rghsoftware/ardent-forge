---
description: Verify all review findings have been addressed
model: sonnet
---

# Review Verification

Verify that review feedback has been addressed and the implementation aligns with decisions made during review.

## When to use
- After implementing review feedback
- Before finalizing a feature
- User says "verify review", "check review feedback", "review passed?"
- After merging a PR/MR

## Model Routing

This command routes to the review category model:

| Environment | Model | Rationale |
|---|---|---|
| Claude Code (work) | sonnet | Review verification requires careful checking |
| OpenCode (home) | gemini-2.5-flash | Thorough review completion checking |

## Workflow

### Step 1: Load review-verify skill
This command is a thin wrapper around the review-verify agent. Load and follow the agent's workflow.

The review-verify agent handles:
1. Loading review capture files
2. Checking implementation against feedback
3. Verifying all items are addressed
4. Marking review as complete

### Step 2: Follow review-verify agent
See `core/agents/review-verify.md` for detailed workflow.

Briefly:
1. Find relevant review capture files in Context/Reviews/
2. For each review:
   - Extract feedback points
   - Check implementation files
   - Verify each item was addressed
3. Check for new issues introduced
4. Report on review compliance:
   - All feedback addressed ✓
   - Partially addressed (list remaining)
   - New issues found
5. Mark review as verified in capture file

### Step 3: Update review file on PASS
If the agent's verdict is **PASS** (or **WARNING** with only deferred items):
1. Open the review capture file
2. Check the box: `- [x] Review verified by review-verify agent`
3. This is the only edit -- do not modify any other content in the review file

If the verdict is **FAIL**, do not check the box.

### Step 4: Confirm review status
Present results:
- Which reviews were checked
- Status of each review
- Any remaining work
- Recommendation:
  - Ready to proceed (all verified)
  - More work needed (items remaining)
  - New issues to address
