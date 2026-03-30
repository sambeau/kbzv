# Feature 6: File Watching + Git Status — Design Document

**Feature ID:** FEAT-01KMZA9PWFRJF (`file-watching-git-status`)
**Parent Plan:** P1-kbzv
**Depends on:** FEAT-01KMZA9CP9XEX (`data-layer`) — F2: Data Layer
**Status:** proposed
**Tags:** file-watching, git, live-updates

---

## 1. Purpose

KBZV is a read-only viewer for Kanbanzai-managed projects. Without live updating, the user would need to close and reopen a project every time kanbanzai writes new state. Feature 6 eliminates that friction: the app automatically detects file changes on disk and refreshes its in-memory model, giving the user a near-real-time view of project activity.

Additionally, an ambient Git status panel in the header bar provides at-a-glance context about the repository state — current branch, uncommitted changes, and drift from the remote — without any interactive git operations.

## 2. Scope

### In Scope

- Recursive file watching on `.kbz/state/` for entity YAML files
- File watching on configured document roots for Markdown drift detection
- Debounced event processing (~200ms) to batch rapid writes
- Incremental entity map updates (create, modify, delete) with derived data rebuild
- Watcher lifecycle tied to `openProject` / `closeProject`
- Git status panel: branch name, uncommitted change count, ahead/behind remote
- Graceful handling of non-git projects and missing upstream

### Out of Scope

- Git write operations (commit, push, pull, etc.) — strictly read-only
- Watching `.kbz/config.yaml` — config changes require reopening the project
- Watching for new entity subdirectories — the set of entity types is fixed
- Full git log / history display

---

## 3. File Watching

### 3.1 Watch Targets

Two independent watch scopes are established when a project opens:

| Watch Target | Scope | Purpose |
|---|---|---|
| `{projectPath}/.kbz/state/` | Recursive | Detect entity YAML create/modify/delete |
| Each `config.documents.roots[].path` | Recursive | Detect Markdown changes for drift badge updates |

The state watcher covers all entity subdirectories:

```
.kbz/state/
├── plans/
├── features/
├── tasks/
├── bugs/
├── decisions/
├── documents/
├── knowledge/
├── incidents/
└── checkpoints/
```

Document root watches cover paths like `work/design/`, `work/spec/`, etc., as declared in `.kbz/config.yaml` under `documents.roots`.

### 3.2 Watch API

Uses `@tauri-apps/plugin-fs` watch API (Tauri v2):

```typescript
import { watch } from '@tauri-apps/plugin-fs';

const stopWatching = await watch(
  targetPath,
  (event) => { /* handle event */ },
  { recursive: true }
);
```

The `watch()` call returns an unsubscribe function. Store these for cleanup on `closeProject`.

### 3.3 Watcher Lifecycle

```
openProject(path)
  ├── Load config, parse entities, build tree, compute metrics  (F2: Data Layer)
  ├── startStateWatcher(path)        ← watch .kbz/state/ recursively
  ├── startDocumentRootWatchers(path, config)  ← one per document root
  └── refreshGitStatus(path)         ← initial git info read

closeProject()
  ├── Stop all active watchers (call stored unsubscribe functions)
  ├── Clear git status state
  └── Clear entity maps and derived data
```

### 3.4 Watcher Error Handling

- **Watch setup failure:** Log the error. The app remains functional with a stale view. Display a subtle indicator (e.g., a warning icon near the project name) that live updates are unavailable.
- **Watch event error:** Log and continue. Do not let a single bad event kill the watcher.
- **Watcher death:** If the watcher stops delivering events unexpectedly, attempt one restart. If that fails, log and fall back to stale mode.

The app must never crash due to a watcher issue.

---

## 4. Event Processing

### 4.1 Debounce Strategy

Kanbanzai orchestration bursts can write dozens of files in rapid succession (e.g., creating a feature with multiple tasks). Processing each event individually would cause redundant tree rebuilds and visual flicker. A debounce window batches these into a single processing pass.

**Implementation:**

```typescript
// Pseudocode — watcher.ts

let pendingEvents: FileEvent[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const DEBOUNCE_MS = 200;

function onWatchEvent(event: FileEvent): void {
  pendingEvents.push(event);

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    const batch = [...pendingEvents];
    pendingEvents = [];
    debounceTimer = null;
    processBatch(batch);
  }, DEBOUNCE_MS);
}
```

The 200ms window means:
- Single file edits are reflected in ~200–250ms (well under the 500ms acceptance target)
- A burst of 30 files written over 100ms is processed as one batch
- The timer resets on each new event, so a sustained burst waits until 200ms of quiet before processing

### 4.2 File Path → Entity Resolution

Each incoming event carries a file path. The processing pipeline must resolve it to an entity type and identity.

**Step 1: Map directory to entity type**

| Directory Segment | Entity Type | ID Source |
|---|---|---|
| `state/plans/` | `Plan` | filename |
| `state/features/` | `Feature` | filename |
| `state/tasks/` | `Task` | filename |
| `state/bugs/` | `Bug` | filename |
| `state/decisions/` | `Decision` | filename |
| `state/documents/` | `DocumentRecord` | filename (with `--` → `/` reversal) |
| `state/knowledge/` | `KnowledgeEntry` | filename |
| `state/incidents/` | `Incident` | filename |
| `state/checkpoints/` | `HumanCheckpoint` | filename |

**Step 2: Extract entity ID from filename**

Filename patterns vary by entity type:

- **Simple ID:** `{id}.yaml` — Plans (`P1-kbzv.yaml`), Knowledge (`KE-01JX....yaml`), Checkpoints (`CHK-01JX....yaml`)
- **ID with slug:** `{id}-{slug}.yaml` — Features, Tasks, Bugs, Decisions, Incidents (e.g., `FEAT-01KMZA9PWFRJF-file-watching-git-status.yaml`)
- **Documents:** `{id with / replaced by --}.yaml` — (e.g., `DOC-01JX--design--arch.yaml`)

Extraction logic:

```typescript
function extractEntityId(entityType: string, filename: string): string {
  const base = filename.replace(/\.yaml$/, '');

  if (entityType === 'documents') {
    // Document IDs use -- as path separator in filenames
    // The full base (with -- intact) is the encoded ID
    return base.replace(/--/g, '/');
  }

  // For slug-bearing types, the ID is the prefix up to and including the ULID
  // Pattern: PREFIX-ULID-slug → extract PREFIX-ULID
  // For simple types (plans, knowledge, checkpoints), the full base is the ID
  return base;
}
```

**Step 3: Determine operation**

| Condition | Operation |
|---|---|
| File created + entity not in store | **Create** — new entity |
| File modified + entity already in store | **Modify** — update entity |
| File deleted | **Delete** — remove entity |
| File created + entity already in store | **Modify** — treat as update (atomic write: new temp file renamed over existing) |

### 4.3 Batch Processing Pipeline

```typescript
async function processBatch(events: FileEvent[]): Promise<void> {
  // 1. Deduplicate: keep only the latest event per unique file path
  const uniqueFiles = deduplicateByPath(events);

  // 2. Separate state events from document root events
  const { stateEvents, documentEvents } = classifyEvents(uniqueFiles);

  // 3. Process state events (entity changes)
  for (const event of stateEvents) {
    const { entityType, entityId } = resolveEntity(event.path);

    if (event.kind === 'delete' || event.kind === 'remove') {
      // Remove entity from store
      removeEntity(entityType, entityId);
    } else {
      // Create or modify: re-parse the YAML file
      await reloadEntity(entityType, event.path);
    }
  }

  // 4. Process document events (Markdown drift)
  if (documentEvents.length > 0) {
    invalidateContentHashCache(documentEvents.map(e => e.path));
  }

  // 5. Rebuild derived data ONCE for the entire batch
  rebuildDerivedData();

  // 6. Refresh git status (file changes likely mean new uncommitted changes)
  await refreshGitStatus();
}
```

**Key design decision:** Derived data (tree hierarchy, metrics, pending checkpoints list) is rebuilt once per batch, not once per file. This is critical for performance during orchestration bursts.

### 4.4 Deduplication

Within a debounce window, the same file may generate multiple events (e.g., a temp file creation followed by a rename, or rapid successive writes). Deduplication keeps only the final event per file path:

```typescript
function deduplicateByPath(events: FileEvent[]): FileEvent[] {
  const latest = new Map<string, FileEvent>();
  for (const event of events) {
    latest.set(event.path, event); // last event wins
  }
  return Array.from(latest.values());
}
```

### 4.5 Concurrency Safety

Kanbanzai uses **atomic writes**: it writes to a temp file, then renames it over the target. This means:

- **Individual files are always consistent.** We never read a half-written YAML file.
- **Cross-file inconsistency is transient.** During a burst, a new task might reference a feature that hasn't been written yet. This resolves on the next event within the same burst or the next burst.
- **The viewer tolerates transient inconsistency.** A broken cross-reference displays a "not found" indicator (per the error handling design), which self-corrects within milliseconds as remaining files arrive.

No locking or transaction semantics are needed.

---

## 5. Integration with Data Layer (F2)

### 5.1 Store Actions

The watcher calls into the Zustand project store defined in F2. The following actions are used:

| Store Action | Trigger | Behaviour |
|---|---|---|
| `reloadEntity(entityType, filePath)` | File create or modify | Read and parse the YAML file at `filePath`, upsert the entity into the appropriate typed map |
| `removeEntity(entityType, entityId)` | File delete | Delete the entity from the appropriate typed map by ID |
| `rebuildDerivedData()` | After all entity changes in a batch | Recompute `tree` (hierarchy), `pendingCheckpoints` (filtered list), and any metrics that components are subscribed to |

### 5.2 Derived Data Rebuild

After entity map mutations, the following are recomputed:

1. **Tree hierarchy** (`tree.ts`): Walk plans → features → tasks, rebuild `TreeNode[]`
2. **Pending checkpoints** (`checkpoints` map filtered to `status === 'pending'`)
3. **Metrics** are computed lazily by components via selectors, but the tree rebuild triggers re-renders of subscribed components

### 5.3 Document Drift Invalidation

When a Markdown file changes in a document root:

1. The `DriftBadge` component compares the file's current content hash against the `content_hash` stored in the corresponding `DocumentRecord` entity.
2. The watcher invalidates any cached hash for the changed file path.
3. On next render, the badge recomputes the hash from the (now-changed) file content and compares against the stored approved hash.
4. If they differ, the badge shows "modified" instead of "approved".

---

## 6. Git Status Panel

### 6.1 Visual Design

The git info panel sits in the header bar, right-aligned. It is a compact, read-only display:

```
┌──────────────────────────────────────────────────────────────────┐
│  KBZV              [Workflows] [Documents]       GitInfo panel   │
│                                                                  │
│                                           ⎇ kbzv / main         │
│                                           46 changes  ↑16 | ↓0  │
└──────────────────────────────────────────────────────────────────┘
```

Rendered as a single horizontal row:

```
⎇ kbzv / main    46 changes    ↑16 | ↓0
```

| Element | Icon | Source | Fallback |
|---|---|---|---|
| Branch | `GitBranch` (Lucide) | `git rev-parse` | — |
| Repo name | — | directory name of project root | — |
| Changes count | — | `git status --porcelain` line count | "0 changes" |
| Ahead count | `ArrowUp` (Lucide) | `git rev-list --left-right` | Hidden if no upstream |
| Behind count | `ArrowDown` (Lucide) | `git rev-list --left-right` | Hidden if no upstream |

**Styling:**
- Muted text colour (`text-muted-foreground`) — ambient, not attention-grabbing
- No interactive elements — no click handlers, no hover states beyond default cursor
- Monospace or tabular-nums for the counts to prevent layout shift

### 6.2 Git Data Retrieval

Git data is retrieved by executing shell commands via the Tauri shell plugin (`@tauri-apps/plugin-shell`) or a Tauri command.

**Command 1: Current branch name**

```bash
git rev-parse --abbrev-ref HEAD
```

- Returns: branch name string (e.g., `main`, `feat/file-watching`)
- Detached HEAD: returns `HEAD` — display as-is
- Non-git directory: command fails — hide the entire panel

**Command 2: Uncommitted changes count**

```bash
git status --porcelain
```

- Returns: one line per changed file
- Count: number of non-empty lines in output
- Includes staged and unstaged changes, untracked files

**Command 3: Ahead/behind remote**

```bash
git rev-list --left-right --count HEAD...@{upstream}
```

- Returns: `<ahead>\t<behind>` (tab-separated)
- Example: `16\t0` means 16 commits ahead, 0 behind
- No upstream configured: command fails — hide ahead/behind, show branch only

### 6.3 Git Status Data Model

```typescript
interface GitStatus {
  repoName: string;       // basename of project path
  branch: string;         // current branch name
  changesCount: number;   // uncommitted changes
  ahead: number | null;   // commits ahead of upstream (null = no upstream)
  behind: number | null;  // commits behind upstream (null = no upstream)
}
```

Stored in the Zustand project store as `gitStatus: GitStatus | null`. A `null` value means either no project is open or the project is not a git repository.

### 6.4 Git Command Execution

```typescript
async function fetchGitStatus(projectPath: string): Promise<GitStatus | null> {
  const repoName = basename(projectPath);

  // 1. Branch name (also validates this is a git repo)
  const branchResult = await runGitCommand(projectPath, [
    'rev-parse', '--abbrev-ref', 'HEAD'
  ]);

  if (!branchResult.success) {
    // Not a git repo or git not installed
    return null;
  }

  const branch = branchResult.stdout.trim();

  // 2. Changes count
  const statusResult = await runGitCommand(projectPath, [
    'status', '--porcelain'
  ]);

  const changesCount = statusResult.success
    ? statusResult.stdout.split('\n').filter(line => line.length > 0).length
    : 0;

  // 3. Ahead/behind
  let ahead: number | null = null;
  let behind: number | null = null;

  const revListResult = await runGitCommand(projectPath, [
    'rev-list', '--left-right', '--count', 'HEAD...@{upstream}'
  ]);

  if (revListResult.success) {
    const parts = revListResult.stdout.trim().split('\t');
    ahead = parseInt(parts[0], 10);
    behind = parseInt(parts[1], 10);
  }
  // If no upstream, ahead/behind remain null → UI hides those elements

  return { repoName, branch, changesCount, ahead, behind };
}
```

### 6.5 Refresh Timing

Git status is refreshed:

1. **On project open** — initial read
2. **After each debounced batch** — file changes likely mean git status changed
3. **Not on a timer** — file watching already provides the trigger

The git commands are fast (<50ms typically) and run after entity processing, so they don't delay the UI update for entity changes.

### 6.6 Non-Git Projects

If the project directory is not inside a git repository:
- `git rev-parse --abbrev-ref HEAD` fails
- `fetchGitStatus` returns `null`
- `GitInfo` component renders nothing (returns `null`)
- No error shown — graceful absence

---

## 7. Component Design

### 7.1 File Layout

```
src/lib/reader/
└── watcher.ts          # File system watching, debounce, event processing

src/components/layout/
└── GitInfo.tsx          # Read-only git status display component
```

### 7.2 watcher.ts

**Responsibilities:**
- Start/stop file system watchers
- Debounce incoming file events
- Resolve file paths to entity types and IDs
- Dispatch entity mutations to the project store
- Trigger derived data rebuild
- Trigger git status refresh

**Exports:**

```typescript
// Start watching a project's .kbz/state/ and document roots
export function startWatching(
  projectPath: string,
  config: ProjectConfig,
  store: ProjectStoreActions
): Promise<WatcherHandle>;

// Stop all watchers for the current project
export function stopWatching(handle: WatcherHandle): void;

interface WatcherHandle {
  stateUnsubscribe: () => void;
  documentUnsubscribes: Array<() => void>;
}
```

**Internal structure:**
- `onWatchEvent(event)` — enqueue and debounce
- `processBatch(events)` — deduplicate, classify, process, rebuild
- `resolveEntity(filePath)` — path → `{ entityType, entityId }`
- `deduplicateByPath(events)` — last event per path wins

### 7.3 GitInfo.tsx

**Responsibilities:**
- Subscribe to `gitStatus` from the project store
- Render the status line with Lucide icons
- Handle null/partial state gracefully

**Component structure:**

```tsx
export function GitInfo() {
  const gitStatus = useProjectStore(state => state.gitStatus);

  if (!gitStatus) return null;

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-4 w-4" />
        <span>{gitStatus.repoName}</span>
        <span>/</span>
        <span className="font-medium">{gitStatus.branch}</span>
      </div>

      <span>{gitStatus.changesCount} changes</span>

      {gitStatus.ahead !== null && gitStatus.behind !== null && (
        <div className="flex items-center gap-1.5 tabular-nums">
          <ArrowUp className="h-3.5 w-3.5" />
          <span>{gitStatus.ahead}</span>
          <span className="text-muted-foreground/50">|</span>
          <ArrowDown className="h-3.5 w-3.5" />
          <span>{gitStatus.behind}</span>
        </div>
      )}
    </div>
  );
}
```

---

## 8. Store Extensions

Feature 6 adds the following to the Zustand `ProjectState` (defined in F2):

```typescript
// Additions to ProjectState interface
interface ProjectState {
  // ... existing F2 fields ...

  // Git status (F6)
  gitStatus: GitStatus | null;

  // Actions (F6)
  refreshGitStatus: () => Promise<void>;
}
```

The watcher itself is not stored in Zustand — it's managed as a side effect of `openProject` / `closeProject`. The `WatcherHandle` is held in module-level state within `watcher.ts` or as a ref in the component that manages the project lifecycle.

---

## 9. Error Handling

| Scenario | Behaviour |
|---|---|
| `watch()` call fails | Log error, continue without live updates, show stale indicator |
| Watch event for non-YAML file in state/ | Ignore (filter to `*.yaml` only) |
| YAML parse error on reload | Log warning, leave previous entity version in store (or skip if new) |
| File exists in event but gone when read | Treat as delete (race condition with rapid write-then-delete) |
| Git command not found (`git` not on PATH) | `fetchGitStatus` returns `null`, panel hidden |
| Git command timeout | Return stale data, log warning |
| Document root directory doesn't exist | Skip watcher for that root, log info |
| Watcher stops unexpectedly | Attempt one restart, then fall back to stale mode |

---

## 10. Acceptance Criteria

1. **Timely updates:** Editing a `.kbz/state/` YAML file externally updates the viewer within ~500ms.
2. **Entity creation:** Adding a new entity file (e.g., a new task YAML) appears in the tree/list without reopening the project.
3. **Entity deletion:** Deleting an entity file removes it from the tree/list without reopening.
4. **Batch stability:** Rapid sequential changes (e.g., 20 files in 100ms) are batched and processed without visual flicker.
5. **Git branch display:** Git info panel shows the correct current branch name.
6. **Git changes count:** Git info panel shows the correct uncommitted changes count.
7. **Git ahead/behind:** Git info panel shows correct ahead/behind counts when an upstream is configured.
8. **Non-git graceful:** Non-git projects show no git info panel (no error, no empty panel).
9. **No upstream graceful:** Projects without a remote upstream show branch and changes but hide ahead/behind.
10. **Document drift:** Markdown file changes in document roots trigger drift badge updates.
11. **Clean lifecycle:** Opening a second project stops watchers from the first. Closing a project stops all watchers.
12. **Error resilience:** Watcher errors are logged, not surfaced as crashes or blocking dialogs.

---

## 11. Dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| `@tauri-apps/plugin-fs` | `watch()` API for file system events | Already used by F2 for file reading |
| `@tauri-apps/plugin-shell` | Execute git commands | New plugin — must add to Tauri capabilities |
| `lucide-react` | `GitBranch`, `ArrowUp`, `ArrowDown` icons | Already in project deps |
| F2: Data Layer | Entity maps, store actions, derived data builders | Must be implemented first |

### Tauri Capability Additions

The `@tauri-apps/plugin-shell` requires explicit permission in `src-tauri/capabilities/`:

```json
{
  "permissions": [
    "shell:allow-execute"
  ]
}
```

Shell execution should be scoped to `git` commands only for security.

---

## 12. References

- Architecture document: `work/design/kbzv-architecture.md` §5.3 (File Watching), §5.4 (Concurrency Safety), §6.9 (Git Info Panel)
- Tauri FS plugin watch API: https://v2.tauri.app/plugin/file-system/
- Tauri Shell plugin: https://v2.tauri.app/plugin/shell/
- F2 Data Layer: FEAT-01KMZA9CP9XEX