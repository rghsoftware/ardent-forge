---
description: Create or review Architecture Decision Records
model: sonnet
---

# Architecture Decision Record

Create or update an Architecture Decision Record (ADR) documenting a technical decision, its rationale, and compatibility with existing decisions.

## When to use
- Implementation deviates from the spec
- A significant technical decision is made that affects future work
- User says "create an ADR", "document this decision", "we're changing approach"
- Detected at a milestone checkpoint during impl-start

## Model Routing

This command routes to the architecture category model:

| Environment | Model | Rationale |
|---|---|---|
| Claude Code (work) | sonnet | ADRs require careful reasoning about compatibility |
| OpenCode (home) | gemini-2.5-flash | Architecture decisions need structured analysis |

## Workflow

**CRITICAL:** If $ARGUMENTS is empty, STOP here and ask user: "What decision would you like to document as an ADR?" Do NOT read any files until a description is provided.

### Step 1: Load context
1. If $ARGUMENTS is NOT empty, user has described the ADR topic: "$ARGUMENTS"
2. If $ARGUMENTS is empty, ask: "What technical decision would you like to document as an ADR?"
3. Do NOT read Spec.md or other files until description is obtained
4. Once you have a description, then check if working within a feature and read its Spec.md
5. Check if this ADR documents a spec deviation
6. Load relevant ADRs in Context/Decisions/

### Step 2: Determine ADR type
1. **New decision:** No existing ADR covers this area
2. **Supersed:** Replacing a previous ADR (document why)
3. **Refinement:** Updating an existing decision while preserving original

### Step 3: Determine ADR number
1. Find highest NNNN in existing ADR filenames
2. Assign NNNN+1

### Step 4: Draft ADR content
1. **Context:** What problem or situation motivated this decision
2. **Decision:** What was decided (1-2 sentences, then details)
3. **Consequences:** Benefits, trade-offs, and risks. For non-trivial ADRs, consult the Advisor tool before writing this section:

   ```bash
   cat > /tmp/cortex-adr-consequences-<NNNN>.md <<'EOF'
   Decision being documented:
   [1-2 sentence summary of the decision]

   Known context and constraints:
   [paste Context section of the draft ADR]

   Question: what are the two most load-bearing consequences (one benefit,
   one risk) that this ADR must name to be honest about the trade-off?
   Respond as enumerated bullets.
   EOF

   bun run .claude/hooks/advisor/advisor-cli.ts --question-file /tmp/cortex-adr-consequences-<NNNN>.md
   ```

   Exit 0: fold the Advisor's response into the Consequences section. Exit 2: draft in-thread without the consult.
4. **Compatibility:** Check against overlapping ADRs
   - Same files affected
   - Same feature area
   - Same architectural concern
5. **Related:** Link to feature, files affected, spec section

### Step 5: Contradiction detection
This is critical. Compare new ADR against all accepted (non-superseded) ADRs:

**For each overlapping ADR:**
- Present the overlap to user
- Require resolution:
  - "Compatible because [reason]" — decisions coexist
  - "Supersedes ADR-XXXX" — new replaces old
  - "Need to rethink" — reconsider the decision

**If no overlaps:** Document "No overlapping accepted ADRs found"

### Step 6: Write ADR file
1. Create `Context/Decisions/NNNN-decision-title.md` (kebab-case)
2. Fill all sections including completed Compatibility section
3. Set status to "Proposed" or "Accepted" based on context

### Step 7: Update related artifacts
If documenting a spec deviation, update the feature's Spec.md:
- Add entry to Revision History table
- Update affected Testable Assertions status to "Superseded by ADR-NNNN"
- Note ADR number for commit message
