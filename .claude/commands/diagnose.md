---
description: Check project structure and Cortex health
model: sonnet
---

# Diagnose: Cortex Project Health Check

Run a structured health check on the current project's Cortex configuration.

## Checks

### 1. Directory Structure
Verify required directories exist:
- [ ] `Context/Features/`
- [ ] `Context/Decisions/`
- [ ] `Context/Reviews/`
- [ ] `Context/Backlog/`
- [ ] `.cortex/`
- [ ] `.claude/hooks/`
- [ ] `.claude/agents/`
- [ ] `.claude/commands/`
- [ ] `.claude/skills/`

### 2. Configuration Files
Verify required files exist and are valid JSON/markdown:
- [ ] `CLAUDE.md` exists and has `## Active Work` section
- [ ] `.claude/settings.json` exists and has hooks configured
- [ ] `.claude/hooks/skill-activation/skill-rules.json` exists
- [ ] `.claude/hooks/skill-activation/agent-rules.json` exists

### 3. Hook Health
For each hook in `.claude/settings.json`:
- [ ] Script file exists at the declared path
- [ ] Script is valid TypeScript (run `bun check` or parse for syntax errors)
- [ ] No hardcoded secrets (scan for `sk-`, `ghp_`, `AKIA`, password patterns)

### 4. MCP Context Budget
Check MCP server count and tool count:
- Count enabled MCP servers in `.claude/settings.json` and `.mcp.json`
- Count total tools across all servers
- **WARN** if >10 servers enabled
- **WARN** if >80 tools active
- Display estimated context consumption

### 5. Session State
- [ ] `.cortex/session.md` -- report if active session exists
- [ ] `.cortex/backups/` -- report backup count and most recent
- [ ] `.cortex/patterns.md` -- report if pattern log exists and entry count

### 6. Active Work Consistency
- If CLAUDE.md lists an active feature, verify the corresponding
  `Context/Features/NNN-Name/` directory exists
- Check for orphaned Steps.md files without matching Spec.md

## Output Format

| Check | Status | Details |
|-------|--------|---------|
| Directory structure | PASS/WARN/FAIL | Missing: [...] |
| Config files | PASS/WARN/FAIL | Invalid: [...] |
| Hook health | PASS/WARN/FAIL | Issues: [...] |
| MCP budget | PASS/WARN | Servers: N, Tools: N |
| Session state | INFO | Active/None, N backups |
| Active work | PASS/WARN | Consistency issues: [...] |
