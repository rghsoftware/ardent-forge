---
description: Scan Cortex and Claude Code configuration for security issues
model: sonnet
---

# Security Scan: Configuration Audit

Audit the project's Claude Code configuration for security risks.

## Scan Categories

### 1. Secrets in Configuration
Scan these files for API keys, tokens, passwords:
- `CLAUDE.md`
- `.claude/settings.json`
- `.mcp.json`
- All files in `.claude/hooks/`
- All files in `.claude/agents/`
- All files in `.claude/skills/`
- All files in `.claude/commands/`
- All files in `.claude/rules/`

Patterns to detect: `sk-`, `ghp_`, `AKIA`, `glpat-`, `xoxb-`, inline passwords,
base64-encoded secrets, private key material (`-----BEGIN`).

### 2. Hook Injection Analysis
For each hook script in `.claude/settings.json`:
- Check for shell injection risks (unescaped `${}` in command strings)
- Check for dynamic code execution patterns (dynamic `Function` construction, string-to-code execution)
- Check for network calls (`fetch`, `http`, `net`) that could exfiltrate data
- Verify hooks read from stdin only (not from env vars that could be spoofed)

### 3. Permission Audit
Review `.claude/settings.json` permissions:
- Flag overly broad `Bash(*)` allows
- Flag missing deny rules for destructive commands (`rm -rf`, `format`)
- Flag if `deny` list is empty (should explicitly deny dangerous patterns)

### 4. MCP Server Risk Profile
For each MCP server in `.mcp.json` and `.claude/settings.json`:
- Identify server source (npm package, URL, local path)
- Flag servers from unknown or unverified sources
- Flag servers with broad tool permissions
- Check for `ANTHROPIC_API_KEY` or other secrets passed as env vars to servers

### 5. Agent Definition Review
For each agent in `.claude/agents/`:
- Check for prompt injection vectors (instructions that could be overridden)
- Verify tool restrictions are appropriate for the agent's role
- Flag agents with unrestricted tool access

## Output Format

### Security Scan Results

**Overall Grade: A-F**

| Category | Grade | Findings |
|----------|-------|----------|
| Secrets | A-F | N issues |
| Hook safety | A-F | N issues |
| Permissions | A-F | N issues |
| MCP servers | A-F | N issues |
| Agent defs | A-F | N issues |

### Critical Findings (fix immediately)
[List with file, line, and remediation]

### Warnings (fix soon)
[List with file and recommendation]

### Info (best practices)
[List of improvement suggestions]
