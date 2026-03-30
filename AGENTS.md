# Agent Instructions

This project uses **Kanbanzai** for workflow management. All workflow state is
managed through the kanbanzai MCP server — do not modify `.kbz/` files directly.

## Before You Do Anything

1. Call `status` to see the current project state
2. Call `next` to see what work is ready
3. Read `.agents/skills/kanbanzai-getting-started/SKILL.md` for full orientation

## Rules

- **Use kanbanzai MCP tools** (`status`, `next`, `entity`, `doc`, `finish`) for
  all workflow operations. Do not create or modify entities or documents by
  writing files directly — this bypasses lifecycle enforcement and health checks.
- **Follow the stage gates.** Work progresses through:
  Planning → Design → Features → Specification → Dev plan → Implementation.
  Each stage has a gate that must pass before proceeding. Skipping forward is
  not allowed. See `.agents/skills/kanbanzai-workflow/SKILL.md`.
- **Human approval is required** to pass stage gates. When in doubt, ask.

## Skills Reference

Detailed procedures are in `.agents/skills/kanbanzai-*/SKILL.md`:

| Skill | When to read |
|---|---|
| `kanbanzai-getting-started` | Start of every session |
| `kanbanzai-workflow` | Before any stage transition or entity creation |
| `kanbanzai-design` | During design work |
| `kanbanzai-documents` | When creating or registering any document |
| `kanbanzai-agents` | During implementation (task dispatch, commits, knowledge) |
| `kanbanzai-planning` | During planning conversations |

## Codebase Knowledge Graph (`codebase-memory-mcp`)

This project is indexed in `codebase-memory-mcp` under the project name **`Users-samphillips-Dev-kbzv`** with root path `/Users/samphillips/Dev/kbzv`.

The graph is the preferred way to explore code structure. Use it **instead of** `grep` or `find_path` whenever you need to understand definitions, relationships, callers, callees, dependencies, or architecture.

### When to use graph tools (preferred)

| Question | Tool | Example |
|----------|------|---------|
| What does a function/type look like? | `get_code_snippet` | `get_code_snippet(qualified_name="EntityService.Get", project="Users-samphillips-Dev-kbzv")` |
| Who calls this function? | `trace_call_path` | `trace_call_path(function_name="loadEntities", direction="inbound", project="Users-samphillips-Dev-kbzv")` |
| What does this function call? | `trace_call_path` | `trace_call_path(function_name="loadEntities", direction="outbound", project="Users-samphillips-Dev-kbzv")` |
| Find a function/class/type by name | `search_graph` | `search_graph(name_pattern="Entity", project="Users-samphillips-Dev-kbzv")` |
| Understand package structure | `get_architecture` | `get_architecture(project="Users-samphillips-Dev-kbzv")` |
| Complex cross-package queries | `query_graph` | Cypher queries for multi-hop analysis |

### When to use text search (fallback)

Use `grep` only for content that is not structural:

- String literals and error messages
- Config values and magic constants
- YAML field names in test fixtures
- Comments and documentation text
- Broad "does this string appear anywhere?" sweeps

Use `find_path` only when searching by filename pattern, not by code content.

### Keeping the graph current

The graph auto-syncs after the initial index. If results seem stale or the project is missing from `list_projects`, force a refresh:

```
index_repository(repo_path="/Users/samphillips/Dev/kbzv")
```

### Fallback policy

1. Use graph queries first for structural questions.
2. Use `search_graph` to discover exact qualified names before `trace_call_path` or `get_code_snippet`.
3. Fall back to `grep` only for non-structural content searches.
4. Fall back to `read_file` only when you need to see exact file content that the graph doesn't cover (e.g., full test bodies, YAML fixtures).

---

## Delegating to Sub-Agents

When you spawn sub-agents (via `spawn_agent`), those agents do **not** see this file. They only know what you tell them. This means critical project context — tool preferences, conventions, the knowledge graph — is lost unless you explicitly propagate it.

### Required context for every sub-agent

Include the following in every `spawn_agent` message:

1. **Codebase knowledge graph availability:**

   > This project is indexed in `codebase-memory-mcp` as project `Users-samphillips-Dev-kbzv`. Prefer graph tools over grep/find for structural code questions:
   > - `search_graph(name_pattern="...", project="Users-samphillips-Dev-kbzv")` to find functions, types, classes
   > - `get_code_snippet(qualified_name="...", project="Users-samphillips-Dev-kbzv")` to read a specific symbol
   > - `trace_call_path(function_name="...", project="Users-samphillips-Dev-kbzv")` to find callers/callees
   > - `get_architecture(project="Users-samphillips-Dev-kbzv")` for package structure
   > Use `grep` only for string literals, error messages, and non-structural content.

2. **File scope boundaries** — which files the agent should and should not modify (to avoid conflicts with parallel agents).

3. **Any relevant project conventions** — e.g., commit message format, test conventions, Go style rules — if the agent will be committing or writing tests.

### Propagation rule

If a sub-agent may itself spawn further sub-agents, include this instruction:

> When you delegate work to sub-agents, include the codebase-memory-mcp context (project name, tool preferences) in your delegation message. Sub-agents do not see project instructions automatically.

This ensures the context propagates through any depth of delegation, not just one level.

### Why this matters

Without this context, sub-agents will default to `grep` and `read_file` for everything — scanning files line by line instead of using the indexed graph. This is slower, noisier, and misses structural relationships that the graph captures directly.

## Before Any Task

1. Run `git status` — if there are uncommitted changes from previous work, commit or stash before starting new work.
2. Read this file (`AGENTS.md`).
3. If the task involves understanding the system design, follow the reading order below.
## Git Rules

- AI commits to feature/bug branches.
- AI merges to main.
- AI can push to remote when delegated by human.
- Human creates release tags.

For commit message format, types, and examples, see the `kanbanzai-agents` skill.

## Preserving Work Through Commits

### Before starting new work

Run `git status`. If there are uncommitted changes from previous work:
- If the changes are coherent and complete → commit with an appropriate message.
- If the changes are incomplete or risky → stash and inform the human.
- Never start new work on top of uncommitted changes from a different task.

### During work

- Commit at logical checkpoints: after completing a coherent change, before starting a risky edit.
- A change isn't done until it's committed.
- This applies equally to design documents, decision records, and planning changes — not just code. A drafted decision or a renamed term across multiple files is a coherent change that should be committed.

### Commit granularity for documents

During the current design/planning phase, most work produces document changes. Commit these the same way you would commit code:

- A new or updated decision record → commit when the decision is complete.
- A new document (e.g., bootstrap-workflow.md) → commit when it's coherent and reviewed.
- A cross-cutting rename or terminology change → commit as a single coherent change covering all affected files.
- Multiple unrelated document changes in one session → split into separate commits by topic.

Do not let document changes accumulate uncommitted across long sessions.
