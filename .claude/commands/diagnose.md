---
description: Check project structure and Cortex health
model: sonnet
---

# Doctor: Context Engine Configuration

Display effective Context Engine configuration, showing model resolution and feature flags.

## Output

### Configuration Hierarchy

Show the config resolution order:

1. **Adapter defaults** — Built-in defaults from the adapter
2. **User config** — `~/.config/opencode/context-engine.jsonc` (OpenCode)
3. **Project config** — `.opencode/context-engine.jsonc` (current project)

Each level overrides the previous. The output should show which values come from which level.

### Model Routing

Show effective model assignment for all agents:

| Agent | Model | Source |
|---|---|---|
| build | `provider/model` | project/user/adapter |
| plan | `provider/model` | project/user/adapter |
| qa-python | `provider/model` | project/user/adapter |
| ... | ... | ... |

And categories:

| Category | Model | Source |
|---|---|---|
| quick | `provider/model` | project/user/adapter |
| planning | `provider/model` | project/user/adapter |
| ... | ... | ... |

### Feature Flags

| Feature | State | Source |
|---|---|---|
| parallel_qa | true/false | project/user/adapter |
| context_aware_compaction | true/false | project/user/adapter |
| notifications | true/false | project/user/adapter |

### Background Task Concurrency

```
Default concurrency: N
Provider limits:
  - provider-name: M
```

### Disabled Components

```
Disabled agents: [list or "none"]
Disabled skills: [list or "none"]
```

## Implementation

1. Read and merge configs in priority order: adapter → user → project
2. For each agent and category, show the resolved value and its source
3. For each feature flag, show state and source
4. Display background task concurrency settings
5. Show any disabled agents/skills

Use the same config loading logic as the OpenCode plugin (`adapters/opencode/config.ts`).
