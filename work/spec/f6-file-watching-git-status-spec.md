# F6: File Watching + Git Status — Specification

**Feature ID:** FEAT-01KMZA9PWFRJF (`file-watching-git-status`)
**Parent Plan:** P1-kbzv
**Depends on:** FEAT-01KMZA9CP9XEX (`data-layer`) — F2: Data Layer
**Type:** Specification
**Status:** draft

---

## 1. File Manifest

Every file created or modified by this feature:

| File Path | Action | Purpose |
|---|---|---|
| `src/lib/reader/watcher.ts` | **Create** | File system watching, debounce, event processing, entity resolution |
| `src/lib/reader/git.ts` | **Create** | Git command execution, output parsing, `GitStatus` type |
| `src/components/layout/GitInfo.tsx` | **Create** | Read-only git status display component |
| `src/lib/store/project-store.ts` | **Modify** | Add `gitStatus` field, `refreshGitStatus`, `removeEntity`, `rebuildDerivedData` actions |
| `src-tauri/capabilities/default.json` | **Modify** | Add `shell:allow-execute` permission with scoped git commands |
| `src-tauri/Cargo.toml` | **Modify** | Add `tauri-plugin-shell` dependency |
| `src-tauri/src/lib.rs` | **Modify** | Register `tauri_plugin_shell` |

Total: 3 new files, 4 modified files.

---

## 2. File Watcher

### 2.1 watcher.ts — Exports and Interfaces

**File:** `src/lib/reader/watcher.ts`

```typescript
import { watch } from '@tauri-apps/plugin-fs';
import type { WatchEvent, UnwatchFn } from '@tauri-apps/plugin-fs';
import type { ProjectConfig, DocumentRoot } from '../types/config';
import type { EntityTypeName } from '../query/references';

// ── Public Interface ──────────────────────────────────────────────

export interface WatcherHandle {
  /** Unsubscribe function for the .kbz/state/ watcher */
  stateUnsubscribe: UnwatchFn;
  /** Unsubscribe functions for each document root watcher */
  documentUnsubscribes: UnwatchFn[];
}

export interface WatcherCallbacks {
  reloadEntity: (entityType: EntityTypeName, filePath: string) => Promise<void>;
  removeEntity: (entityType: EntityTypeName, entityId: string) => void;
  rebuildDerivedData: () => void;
  refreshGitStatus: () => Promise<void>;
  invalidateContentHash: (paths: string[]) => void;
}

/**
 * Start watching a project's .kbz/state/ directory and document roots.
 * Returns a handle that must be passed to stopWatching() on closeProject.
 */
export async function startWatching(
  projectPath: string,
  config: ProjectConfig,
  callbacks: WatcherCallbacks,
): Promise<WatcherHandle>;

/**
 * Stop all watchers. Safe to call multiple times.
 */
export function stopWatching(handle: WatcherHandle): void;
```

**Internal (non-exported) functions:**

| Function | Signature | Purpose |
|---|---|---|
| `onWatchEvent` | `(event: WatchEvent, projectPath: string, scope: 'state' \| 'document') => void` | Enqueue event and reset debounce timer |
| `processBatch` | `(events: ClassifiedEvent[], projectPath: string, callbacks: WatcherCallbacks) => Promise<void>` | Deduplicate, classify, process, rebuild |
| `classifyEvents` | `(events: ClassifiedEvent[]) => { stateEvents: ClassifiedEvent[]; documentEvents: ClassifiedEvent[] }` | Separate state from document events |
| `resolveEntityFromPath` | `(filePath: string, projectPath: string) => { entityType: EntityTypeName; entityId: string } \| null` | Path → entity type + ID |
| `extractEntityId` | `(directory: string, filename: string) => string` | Filename → entity ID |
| `deduplicateByPath` | `(events: ClassifiedEvent[]) => ClassifiedEvent[]` | Keep last event per path |

**Internal types:**

```typescript
interface ClassifiedEvent {
  path: string;
  kind: 'create' | 'modify' | 'delete';
  scope: 'state' | 'document';
}
```

### 2.2 Watch Targets — .kbz/state/ and Document Roots

Two independent watch scopes are established when `startWatching()` is called:

**Watch 1 — State directory (always created):**

```
{projectPath}/.kbz/state/
```

This single recursive watch covers all 9 entity subdirectories:

| Subdirectory | Entity Type |
|---|---|
| `state/plans/` | `plan` |
| `state/features/` | `feature` |
| `state/tasks/` | `task` |
| `state/bugs/` | `bug` |
| `state/decisions/` | `decision` |
| `state/documents/` | `document` |
| `state/knowledge/` | `knowledge` |
| `state/incidents/` | `incident` |
| `state/checkpoints/` | `checkpoint` |

**Watch 2..N — Document roots (zero or more, from config):**

One watcher per entry in `config.documents.roots[]`. Each root has a `path` field relative to the project root.

Example: if `config.documents.roots` contains `[{ path: "work/design", default_type: "design" }, { path: "work/spec", default_type: "specification" }]`, create two watchers:

```
{projectPath}/work/design/
{projectPath}/work/spec/
```

If a document root directory does not exist, skip that watcher and log an info-level message. Do not fail.

### 2.3 @tauri-apps/plugin-fs watch API — Exact Call Signature and Options

The `watch` function from `@tauri-apps/plugin-fs` has this signature:

```typescript
function watch(
  paths: string | string[],
  cb: (event: WatchEvent) => void,
  options?: { recursive?: boolean; delayMs?: number },
): Promise<UnwatchFn>;
```

**`WatchEvent` shape** (from the plugin):

```typescript
interface WatchEvent {
  type:
    | { create: { kind: string } }
    | { modify: { kind: string } }
    | { remove: { kind: string } }
    | { access: { kind: string } }
    | { other: null };
  paths: string[];
  attrs: Record<string, unknown>;
}
```

**Exact call for the state watcher:**

```typescript
const statePath = `${projectPath}/.kbz/state`;

const stateUnsubscribe = await watch(
  statePath,
  (event: WatchEvent) => {
    onWatchEvent(event, projectPath, 'state');
  },
  { recursive: true },
);
```

**Exact call for each document root watcher:**

```typescript
for (const root of config.documents?.roots ?? []) {
  const rootPath = `${projectPath}/${root.path}`;

  try {
    const unsub = await watch(
      rootPath,
      (event: WatchEvent) => {
        onWatchEvent(event, projectPath, 'document');
      },
      { recursive: true },
    );
    documentUnsubscribes.push(unsub);
  } catch (err) {
    console.info(`[watcher] Skipping document root "${root.path}": directory may not exist`, err);
  }
}
```

**Key points:**

- Do NOT use the `delayMs` option — we implement our own debounce to have control over batching
- `recursive: true` is required for both watchers
- The `watch()` function returns an `UnwatchFn` (a `() => void` function) to stop watching
- Pass a single path string, not an array — one watcher per scope

### 2.4 Debounce Implementation — Exact Timer Logic with Code

The debounce is implemented at the module level within `watcher.ts`. All watchers (state + document roots) feed into the same debounce queue so that a single `processBatch()` handles everything atomically.

```typescript
// ── Module-level debounce state ──────────────────────────────────

let pendingEvents: ClassifiedEvent[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isProcessing = false;

const DEBOUNCE_MS = 200;

// Stored reference to callbacks — set by startWatching(), cleared by stopWatching()
let activeCallbacks: WatcherCallbacks | null = null;
let activeProjectPath: string | null = null;

// ── Event handler called by all watchers ─────────────────────────

function onWatchEvent(
  event: WatchEvent,
  projectPath: string,
  scope: 'state' | 'document',
): void {
  // Determine the event kind
  const kind = getEventKind(event);
  if (kind === null) return; // Ignore access/other events

  // Process each path in the event
  for (const filePath of event.paths) {
    // Filter: only process .yaml files for state events
    if (scope === 'state' && !filePath.endsWith('.yaml')) continue;

    // Filter: only process .md files for document events
    if (scope === 'document' && !filePath.endsWith('.md')) continue;

    pendingEvents.push({ path: filePath, kind, scope });
  }

  // Reset the debounce timer
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    flushBatch();
  }, DEBOUNCE_MS);
}

function getEventKind(event: WatchEvent): 'create' | 'modify' | 'delete' | null {
  if ('create' in event.type) return 'create';
  if ('modify' in event.type) return 'modify';
  if ('remove' in event.type) return 'delete';
  // 'access' and 'other' events are ignored
  return null;
}

async function flushBatch(): Promise<void> {
  if (pendingEvents.length === 0) return;
  if (isProcessing) {
    // A batch is already being processed. Re-arm the timer so these
    // events are picked up after the current batch finishes.
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      flushBatch();
    }, DEBOUNCE_MS);
    return;
  }

  const batch = [...pendingEvents];
  pendingEvents = [];

  if (!activeCallbacks || !activeProjectPath) return;

  isProcessing = true;
  try {
    await processBatch(batch, activeProjectPath, activeCallbacks);
  } catch (err) {
    console.error('[watcher] Batch processing error:', err);
  } finally {
    isProcessing = false;
  }
}
```

**Timing characteristics:**

| Scenario | Latency |
|---|---|
| Single file edit | ~200–250ms (debounce + processing) |
| Burst of 30 files over 100ms | Single batch at ~300ms from first event |
| Sustained writes over 500ms | Waits until 200ms of quiet, then one batch |

### 2.5 Event Classification — Create, Modify, Delete Determination

The `WatchEvent.type` field is a discriminated union. Classification:

```typescript
function getEventKind(event: WatchEvent): 'create' | 'modify' | 'delete' | null {
  if ('create' in event.type) return 'create';
  if ('modify' in event.type) return 'modify';
  if ('remove' in event.type) return 'delete';
  return null; // ignore 'access' and 'other'
}
```

**Effective operation mapping (after considering store state):**

| Event Kind | Entity in Store? | Effective Operation |
|---|---|---|
| `create` | No | **Create** — new entity |
| `create` | Yes | **Modify** — atomic write (temp → rename) |
| `modify` | Yes | **Modify** — update entity |
| `modify` | No | **Create** — new entity written by another process |
| `delete` | Yes | **Delete** — remove entity |
| `delete` | No | **No-op** — file was never loaded |

For implementation simplicity, both `create` and `modify` events follow the same code path: call `reloadEntity()`, which reads the file and upserts into the store. The distinction only matters for `delete`.

### 2.6 File Path → Entity Resolution — Exact Regex Patterns and Directory Mapping

**`resolveEntityFromPath()`** — takes an absolute file path and the project path, returns the entity type and ID.

```typescript
/**
 * Directory name → EntityTypeName mapping.
 * Keys are the subdirectory names under .kbz/state/.
 */
const DIRECTORY_TO_ENTITY_TYPE: Record<string, EntityTypeName> = {
  plans: 'plan',
  features: 'feature',
  tasks: 'task',
  bugs: 'bug',
  decisions: 'decision',
  documents: 'document',
  knowledge: 'knowledge',
  incidents: 'incident',
  checkpoints: 'checkpoint',
};

function resolveEntityFromPath(
  filePath: string,
  projectPath: string,
): { entityType: EntityTypeName; entityId: string } | null {
  // Normalise path separators to forward slash
  const normalised = filePath.replace(/\\/g, '/');
  const prefix = `${projectPath.replace(/\\/g, '/')}/.kbz/state/`;

  if (!normalised.startsWith(prefix)) return null;

  // relativePath is e.g. "features/FEAT-01KMZA9PWFRJF-file-watching-git-status.yaml"
  const relativePath = normalised.slice(prefix.length);

  // Split into directory and filename
  const slashIndex = relativePath.indexOf('/');
  if (slashIndex === -1) return null; // file directly in state/ — ignore

  const directory = relativePath.slice(0, slashIndex);
  const filename = relativePath.slice(slashIndex + 1);

  // Must be a direct child of the entity directory (no deeper nesting)
  if (filename.includes('/')) return null;

  const entityType = DIRECTORY_TO_ENTITY_TYPE[directory];
  if (!entityType) return null;

  const entityId = extractEntityId(directory, filename);
  return { entityType, entityId };
}
```

**`extractEntityId()`** — extracts the canonical entity ID from a YAML filename.

```typescript
/**
 * Extract entity ID from a YAML filename.
 *
 * Filename patterns by entity type:
 *
 *   plans/       → {id}.yaml                    → "P1-kbzv"
 *   knowledge/   → {id}.yaml                    → "KE-01JX..."
 *   checkpoints/ → {id}.yaml                    → "CHK-01JX..."
 *   documents/   → {id with / replaced by --}.yaml → "work/design--arch" (restore /)
 *   features/    → {id}-{slug}.yaml             → "FEAT-01KMZA..."
 *   tasks/       → {id}-{slug}.yaml             → "TASK-01KMZA..."
 *   bugs/        → {id}-{slug}.yaml             → "BUG-01KMZA..."
 *   decisions/   → {id}-{slug}.yaml             → "DEC-01KMZA..."
 *   incidents/   → {id}-{slug}.yaml             → "INC-01KMZA..."
 */
function extractEntityId(directory: string, filename: string): string {
  // Strip .yaml extension
  const base = filename.replace(/\.yaml$/, '');

  // Documents: restore / from --
  if (directory === 'documents') {
    return base.replace(/--/g, '/');
  }

  // Simple-ID types: the full base IS the ID
  if (directory === 'plans' || directory === 'knowledge' || directory === 'checkpoints') {
    return base;
  }

  // Slug-bearing types: extract PREFIX-ULID from PREFIX-ULID-slug
  // ULID is exactly 13 uppercase alphanumeric characters (Kanbanzai TSID13)
  //
  // Regex explanation:
  //   ^                 — start of string
  //   ([A-Z]+-          — prefix like "FEAT-", "TASK-", "BUG-", "DEC-", "INC-"
  //    [0-9A-Z]{13,26}) — ULID (13 chars for TSID13, up to 26 for full ULID)
  //   (?:-.*)?$         — optional -slug at end
  //
  const match = base.match(/^([A-Z]+-[0-9A-Z]{13,26})(?:-.*)?$/);
  if (match) {
    return match[1];
  }

  // Fallback: return the full base (handles unexpected patterns gracefully)
  return base;
}
```

**Test cases for `extractEntityId`:**

| Directory | Filename | Expected ID |
|---|---|---|
| `plans` | `P1-kbzv.yaml` | `P1-kbzv` |
| `features` | `FEAT-01KMZA9PWFRJF-file-watching-git-status.yaml` | `FEAT-01KMZA9PWFRJF` |
| `tasks` | `TASK-01KMZA9Q1ABCD-implement-watcher.yaml` | `TASK-01KMZA9Q1ABCD` |
| `bugs` | `BUG-01KMZB1234567-null-pointer.yaml` | `BUG-01KMZB1234567` |
| `decisions` | `DEC-01KMZA9123456-use-zustand.yaml` | `DEC-01KMZA9123456` |
| `knowledge` | `KE-01JX1234567AB.yaml` | `KE-01JX1234567AB` |
| `documents` | `DOC-01JX--design--arch.yaml` | `DOC-01JX/design/arch` |
| `incidents` | `INC-01KMZC7654321-prod-outage.yaml` | `INC-01KMZC7654321` |
| `checkpoints` | `CHK-01JX9876543FG.yaml` | `CHK-01JX9876543FG` |

### 2.7 Batch Processing Pipeline — Exact Algorithm

```typescript
async function processBatch(
  events: ClassifiedEvent[],
  projectPath: string,
  callbacks: WatcherCallbacks,
): Promise<void> {
  // Step 1: Deduplicate — keep only the latest event per unique file path
  const uniqueEvents = deduplicateByPath(events);

  // Step 2: Separate state events from document events
  const stateEvents: ClassifiedEvent[] = [];
  const documentEvents: ClassifiedEvent[] = [];

  for (const event of uniqueEvents) {
    if (event.scope === 'state') {
      stateEvents.push(event);
    } else {
      documentEvents.push(event);
    }
  }

  // Step 3: Process state events (entity create/modify/delete)
  let entitiesChanged = false;

  for (const event of stateEvents) {
    const resolved = resolveEntityFromPath(event.path, projectPath);
    if (!resolved) {
      // File is not in a recognised entity directory — skip
      continue;
    }

    const { entityType, entityId } = resolved;

    if (event.kind === 'delete') {
      callbacks.removeEntity(entityType, entityId);
      entitiesChanged = true;
    } else {
      // 'create' or 'modify' — read and upsert
      try {
        await callbacks.reloadEntity(entityType, event.path);
        entitiesChanged = true;
      } catch (err) {
        if (event.kind === 'create') {
          // File may have been deleted between event and read (race condition)
          // Treat as delete
          console.warn(`[watcher] File gone on read, treating as no-op: ${event.path}`);
        } else {
          // Modify failed — leave previous version in store
          console.warn(`[watcher] Failed to reload entity, keeping stale: ${event.path}`, err);
        }
      }
    }
  }

  // Step 4: Process document events (Markdown drift invalidation)
  if (documentEvents.length > 0) {
    callbacks.invalidateContentHash(documentEvents.map((e) => e.path));
  }

  // Step 5: Rebuild derived data ONCE for the entire batch
  if (entitiesChanged) {
    callbacks.rebuildDerivedData();
  }

  // Step 6: Refresh git status (file changes likely mean git status changed)
  try {
    await callbacks.refreshGitStatus();
  } catch (err) {
    console.warn('[watcher] Git status refresh failed:', err);
  }
}
```

**Deduplication implementation:**

```typescript
function deduplicateByPath(events: ClassifiedEvent[]): ClassifiedEvent[] {
  const latest = new Map<string, ClassifiedEvent>();
  for (const event of events) {
    latest.set(event.path, event); // last event per path wins
  }
  return Array.from(latest.values());
}
```

### 2.8 Store Integration — Which Store Actions to Call

The watcher does **not** import or call the Zustand store directly. Instead, it receives a `WatcherCallbacks` object from the caller (the `openProject` action). This keeps the watcher testable and decoupled.

The `openProject` action in `project-store.ts` wires the callbacks:

```typescript
// Inside openProject, after initial load:
const handle = await startWatching(path, config, {
  reloadEntity: (entityType, filePath) => get().reloadEntity(entityType, filePath),
  removeEntity: (entityType, entityId) => get().removeEntity(entityType, entityId),
  rebuildDerivedData: () => get().rebuildDerivedData(),
  refreshGitStatus: () => get().refreshGitStatus(),
  invalidateContentHash: (paths) => {
    // Trigger re-render of DriftBadge components for affected paths.
    // Implementation: set a monotonically increasing counter or timestamp
    // that DriftBadge components use as a cache-busting key.
    set((state) => ({ contentHashVersion: state.contentHashVersion + 1 }));
  },
});
```

### 2.9 Lifecycle — Start on openProject, Stop on closeProject

**`startWatching()` implementation:**

```typescript
export async function startWatching(
  projectPath: string,
  config: ProjectConfig,
  callbacks: WatcherCallbacks,
): Promise<WatcherHandle> {
  // Store module-level references for the debounce callback
  activeCallbacks = callbacks;
  activeProjectPath = projectPath;

  // Reset debounce state
  pendingEvents = [];
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  isProcessing = false;

  // 1. Watch .kbz/state/ recursively
  const statePath = `${projectPath}/.kbz/state`;
  const stateUnsubscribe = await watch(
    statePath,
    (event: WatchEvent) => onWatchEvent(event, projectPath, 'state'),
    { recursive: true },
  );

  // 2. Watch each document root
  const documentUnsubscribes: UnwatchFn[] = [];
  const roots = config.documents?.roots ?? [];

  for (const root of roots) {
    const rootPath = `${projectPath}/${root.path}`;
    try {
      const unsub = await watch(
        rootPath,
        (event: WatchEvent) => onWatchEvent(event, projectPath, 'document'),
        { recursive: true },
      );
      documentUnsubscribes.push(unsub);
    } catch (err) {
      console.info(
        `[watcher] Skipping document root "${root.path}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { stateUnsubscribe, documentUnsubscribes };
}
```

**`stopWatching()` implementation:**

```typescript
export function stopWatching(handle: WatcherHandle): void {
  // Clear module-level debounce state
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingEvents = [];
  isProcessing = false;
  activeCallbacks = null;
  activeProjectPath = null;

  // Stop the state watcher
  handle.stateUnsubscribe();

  // Stop all document root watchers
  for (const unsub of handle.documentUnsubscribes) {
    unsub();
  }
}
```

**Integration in `project-store.ts`:**

```typescript
// Module-level variable to hold the watcher handle
let watcherHandle: WatcherHandle | null = null;

// Inside openProject action, after initial load succeeds:
try {
  watcherHandle = await startWatching(path, result.config, {
    reloadEntity: (et, fp) => get().reloadEntity(et, fp),
    removeEntity: (et, eid) => get().removeEntity(et, eid),
    rebuildDerivedData: () => get().rebuildDerivedData(),
    refreshGitStatus: () => get().refreshGitStatus(),
    invalidateContentHash: (paths) => {
      set((s) => ({ contentHashVersion: s.contentHashVersion + 1 }));
    },
  });
} catch (err) {
  console.error('[watcher] Failed to start file watching:', err);
  // App continues with stale data — no crash
}

// Inside closeProject action:
if (watcherHandle) {
  stopWatching(watcherHandle);
  watcherHandle = null;
}
```

### 2.10 Error Handling — Watcher Errors, Parse Errors, Restart Logic

| Scenario | Behaviour | Code Location |
|---|---|---|
| `watch()` call throws | Log error with `console.error`. App continues without live updates. No retry — the project is functional with stale data. | `startWatching()` |
| Document root directory does not exist | `watch()` throws. Catch, log with `console.info`, skip that root. Other watchers still start. | `startWatching()` loop |
| Watch event for non-`.yaml` file in `state/` | Filtered out in `onWatchEvent()` before enqueue. | `onWatchEvent()` |
| Watch event for non-`.md` file in document root | Filtered out in `onWatchEvent()` before enqueue. | `onWatchEvent()` |
| `resolveEntityFromPath()` returns `null` | Event skipped in `processBatch()`. Logged only at debug level (not warn). | `processBatch()` |
| YAML parse error during `reloadEntity()` | Error caught in `processBatch()`. Previous version of entity stays in store. Warning logged. | `processBatch()` |
| File exists in event but is gone when read | `reloadEntity()` throws. Caught in `processBatch()`. For `create` events, treated as no-op. For `modify` events, stale version stays. | `processBatch()` |
| `processBatch()` throws unexpectedly | Caught in `flushBatch()`. Error logged. Watcher continues. | `flushBatch()` |
| Watcher stops delivering events | **No automatic restart.** Detection of "watcher death" is not reliably possible with the Tauri FS plugin. The user can close and reopen the project to re-establish watchers. | n/a |

**Invariant:** The app must never crash due to a watcher issue. All errors are caught and logged.

---

## 3. Git Status

### 3.1 GitStatus Interface — Exact Fields

**File:** `src/lib/reader/git.ts`

```typescript
/**
 * Read-only snapshot of the project's git repository state.
 * All fields are immutable once created — a new object is produced on each refresh.
 */
export interface GitStatus {
  /** Basename of the project directory (e.g. "kbzv") */
  repoName: string;

  /** Current branch name (e.g. "main", "feat/file-watching"). "HEAD" if detached. */
  branch: string;

  /** Number of uncommitted changes (staged + unstaged + untracked) */
  changesCount: number;

  /** Commits ahead of upstream. null if no upstream is configured. */
  ahead: number | null;

  /** Commits behind upstream. null if no upstream is configured. */
  behind: number | null;
}
```

### 3.2 fetchGitStatus() — Exact Implementation with All 3 Git Commands

```typescript
import { Command } from '@tauri-apps/plugin-shell';

/**
 * Execute a git command in the given directory.
 * Returns { success: boolean; stdout: string; stderr: string }.
 */
async function runGitCommand(
  cwd: string,
  args: string[],
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  try {
    const command = Command.create('git', args, { cwd });
    const output = await command.execute();

    return {
      success: output.code === 0,
      stdout: output.stdout,
      stderr: output.stderr,
    };
  } catch {
    // Command.create or execute threw — git not found or other OS-level error
    return { success: false, stdout: '', stderr: 'Command execution failed' };
  }
}

/**
 * Fetch current git status for a project directory.
 * Returns null if the directory is not a git repository or git is not available.
 */
export async function fetchGitStatus(projectPath: string): Promise<GitStatus | null> {
  // Extract repo name from path
  const repoName = projectPath.replace(/\\/g, '/').split('/').pop() ?? 'unknown';

  // ── Command 1: Branch name ────────────────────────────────────
  // Also serves as a "is this a git repo?" check.
  //
  // Command:  git rev-parse --abbrev-ref HEAD
  // Success:  prints branch name, e.g. "main\n"
  // Detached: prints "HEAD\n"
  // Non-git:  exits non-zero
  //
  const branchResult = await runGitCommand(projectPath, [
    'rev-parse',
    '--abbrev-ref',
    'HEAD',
  ]);

  if (!branchResult.success) {
    // Not a git repo, or git is not installed — return null
    return null;
  }

  const branch = branchResult.stdout.trim();

  // ── Command 2: Uncommitted changes count ──────────────────────
  //
  // Command:  git status --porcelain
  // Output:   one line per changed/untracked file, e.g.:
  //           " M src/lib/reader/watcher.ts\n"
  //           "?? new-file.txt\n"
  // Count:    number of non-empty lines
  //
  const statusResult = await runGitCommand(projectPath, [
    'status',
    '--porcelain',
  ]);

  const changesCount = statusResult.success
    ? statusResult.stdout
        .split('\n')
        .filter((line) => line.length > 0).length
    : 0;

  // ── Command 3: Ahead/behind remote ────────────────────────────
  //
  // Command:  git rev-list --left-right --count HEAD...@{upstream}
  // Output:   "<ahead>\t<behind>\n", e.g. "16\t0\n"
  // No upstream: exits non-zero (error: no upstream configured)
  //
  let ahead: number | null = null;
  let behind: number | null = null;

  const revListResult = await runGitCommand(projectPath, [
    'rev-list',
    '--left-right',
    '--count',
    'HEAD...@{upstream}',
  ]);

  if (revListResult.success) {
    const parts = revListResult.stdout.trim().split('\t');
    if (parts.length === 2) {
      const parsedAhead = parseInt(parts[0], 10);
      const parsedBehind = parseInt(parts[1], 10);

      if (!isNaN(parsedAhead) && !isNaN(parsedBehind)) {
        ahead = parsedAhead;
        behind = parsedBehind;
      }
    }
  }
  // If rev-list fails (no upstream), ahead/behind remain null → UI hides those elements

  return { repoName, branch, changesCount, ahead, behind };
}
```

### 3.3 Git Command Output Parsing — Exact Regex/String Operations

**Command 1 — `git rev-parse --abbrev-ref HEAD`:**

```typescript
// Parsing: trim whitespace. The output is a single line.
const branch = branchResult.stdout.trim();
// Examples:
//   "main\n"                    → "main"
//   "feat/file-watching\n"      → "feat/file-watching"
//   "HEAD\n"                    → "HEAD"  (detached HEAD)
```

No regex needed. Direct `trim()`.

**Command 2 — `git status --porcelain`:**

```typescript
// Parsing: split by newline, filter empty lines, count.
// Each non-empty line represents one changed/untracked file.
const changesCount = statusResult.stdout
  .split('\n')
  .filter((line) => line.length > 0)
  .length;

// Example output:
//   " M src/file.ts\n?? new.txt\nA  staged.txt\n"
//   → split: [" M src/file.ts", "?? new.txt", "A  staged.txt", ""]
//   → filter: [" M src/file.ts", "?? new.txt", "A  staged.txt"]
//   → count: 3
//
// Empty repo with no changes: "" → split: [""] → filter: [] → count: 0
```

No regex needed. Split + filter + length.

**Command 3 — `git rev-list --left-right --count HEAD...@{upstream}`:**

```typescript
// Parsing: split by tab character. Output is always "N\tM\n".
const parts = revListResult.stdout.trim().split('\t');
// parts[0] = ahead count string
// parts[1] = behind count string
//
// Example: "16\t0\n" → trim → "16\t0" → split('\t') → ["16", "0"]

const ahead = parseInt(parts[0], 10);   // 16
const behind = parseInt(parts[1], 10);  // 0
```

No regex needed. Trim + split on `\t` + parseInt.

### 3.4 Error Handling — Non-Git Repos, Missing Upstream, Command Failures

| Scenario | Detection | Behaviour |
|---|---|---|
| **Not a git repo** | `git rev-parse` exits non-zero | `fetchGitStatus()` returns `null`. GitInfo renders nothing. |
| **Git not installed** | `Command.create('git', ...)` throws or `execute()` returns non-zero | Same as above — returns `null`. |
| **Detached HEAD** | `git rev-parse --abbrev-ref HEAD` returns `"HEAD"` | Display `"HEAD"` as the branch name. |
| **No upstream configured** | `git rev-list ... @{upstream}` exits non-zero | `ahead` and `behind` remain `null`. UI hides the ahead/behind section. |
| **Empty repo (no commits)** | `git rev-parse` may return `"HEAD"` or fail depending on git version | If rev-parse fails, return `null`. If it returns `"HEAD"`, display as detached. |
| **git status timeout** | Not explicitly handled — `Command.execute()` will eventually return | Caller (`refreshGitStatus`) has a try/catch. Stale `gitStatus` remains in store. |
| **Malformed rev-list output** | `parseInt` returns `NaN` | `isNaN` check prevents setting `ahead`/`behind` — they stay `null`. |

### 3.5 Refresh Triggers — When to Re-Fetch

Git status is refreshed in exactly these situations:

| Trigger | Location | Mechanism |
|---|---|---|
| **Project open** | `openProject()` in `project-store.ts` | Calls `refreshGitStatus()` after initial load |
| **After each debounced batch** | `processBatch()` step 6 in `watcher.ts` | Calls `callbacks.refreshGitStatus()` |
| **No periodic timer** | — | File watching already provides the trigger; no `setInterval` needed |

Git is NOT refreshed on:
- UI interactions (tab switches, selection changes)
- Window focus/blur events
- A fixed timer interval

---

## 4. GitInfo Component

### 4.1 GitInfo.tsx — Props, Rendering, Tailwind Classes

**File:** `src/components/layout/GitInfo.tsx`

```tsx
import { GitBranch, ArrowUp, ArrowDown } from 'lucide-react';
import { useProjectStore } from '@/lib/store/project-store';

/**
 * Read-only git status display for the header bar.
 * Renders nothing if no project is open or project is not a git repo.
 * No props — reads from the project store directly.
 */
export function GitInfo() {
  const gitStatus = useProjectStore((state) => state.gitStatus);

  if (!gitStatus) return null;

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      {/* Branch section: icon + repo / branch */}
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-4 w-4 shrink-0" />
        <span className="truncate max-w-[120px]">{gitStatus.repoName}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="truncate max-w-[160px] font-medium">
          {gitStatus.branch}
        </span>
      </div>

      {/* Separator */}
      <span className="text-muted-foreground/30">·</span>

      {/* Changes count */}
      <span className="tabular-nums whitespace-nowrap">
        {gitStatus.changesCount} {gitStatus.changesCount === 1 ? 'change' : 'changes'}
      </span>

      {/* Ahead/behind — only shown when upstream exists */}
      {gitStatus.ahead !== null && gitStatus.behind !== null && (
        <>
          <span className="text-muted-foreground/30">·</span>
          <div className="flex items-center gap-1.5 tabular-nums">
            <ArrowUp className="h-3.5 w-3.5" />
            <span>{gitStatus.ahead}</span>
            <span className="text-muted-foreground/50">|</span>
            <ArrowDown className="h-3.5 w-3.5" />
            <span>{gitStatus.behind}</span>
          </div>
        </>
      )}
    </div>
  );
}
```

### 4.2 Conditional Rendering — Non-Git, No Upstream, Normal

Three rendering states:

**State 1: No git status (`gitStatus === null`)**

Conditions: no project open, project is not a git repo, or git is not installed.

```tsx
// Component returns null — nothing rendered.
// No empty container, no placeholder text, no error.
if (!gitStatus) return null;
```

**State 2: Git repo without upstream (`ahead === null && behind === null`)**

The ahead/behind section is hidden. Only branch and changes are shown:

```
  ⎇ kbzv / main · 3 changes
```

The `{gitStatus.ahead !== null && gitStatus.behind !== null && (...)}` conditional excludes the entire ahead/behind block and its preceding separator.

**State 3: Full display (upstream configured)**

All elements are shown:

```
  ⎇ kbzv / main · 3 changes · ↑16 | ↓0
```

### 4.3 Lucide Icons — Exact Icon Names

| Element | Lucide Icon Name | Import | Size Class |
|---|---|---|---|
| Branch indicator | `GitBranch` | `import { GitBranch } from 'lucide-react'` | `h-4 w-4` |
| Ahead arrow | `ArrowUp` | `import { ArrowUp } from 'lucide-react'` | `h-3.5 w-3.5` |
| Behind arrow | `ArrowDown` | `import { ArrowDown } from 'lucide-react'` | `h-3.5 w-3.5` |

### 4.4 Layout — Exact Dimensions and Spacing

| Property | Value | Rationale |
|---|---|---|
| Container `display` | `flex` (`flex items-center`) | Horizontal row |
| Container `gap` | `gap-3` (12px) | Comfortable spacing between major sections |
| Font size | `text-sm` (14px) | Ambient, not attention-grabbing |
| Text colour | `text-muted-foreground` | Muted — matches design spec |
| Branch section inner gap | `gap-1.5` (6px) | Tight grouping of icon + text |
| Ahead/behind inner gap | `gap-1.5` (6px) | Tight grouping of arrows + counts |
| Repo name max width | `max-w-[120px]` | Prevent long repo names from dominating |
| Branch name max width | `max-w-[160px]` | Prevent long branch names from overflowing |
| Overflow behaviour | `truncate` on repo + branch names | Ellipsis on overflow |
| Number rendering | `tabular-nums` | Fixed-width digits prevent layout shift |
| Separator | `·` with `text-muted-foreground/30` | Subtle visual break between sections |
| No click handlers | — | Purely informational, no interaction |
| No hover states | — | Default cursor |

**Placement in header:** The `GitInfo` component is placed in the `HeaderBar.tsx` component, right-aligned. The header bar already reserves space for this (see F1 spec §7.2):

```tsx
// In HeaderBar.tsx:
<div className="flex items-center justify-between h-12 px-4 border-b">
  {/* Left: View switcher */}
  <div>...</div>

  {/* Right: Git info */}
  <GitInfo />
</div>
```

---

## 5. Store Extensions

### 5.1 project-store.ts Additions — New Fields and New Actions

**New fields added to `ProjectState` interface:**

```typescript
interface ProjectState {
  // ... existing F2 fields (projectPath, config, entity maps, tree, etc.) ...

  // ── F6 additions ──────────────────────────────────────────────

  /** Current git status. null = no project or not a git repo. */
  gitStatus: GitStatus | null;

  /**
   * Monotonically increasing counter. Incremented when document root files
   * change. DriftBadge components use this as a cache-busting dependency.
   */
  contentHashVersion: number;

  // ── F6 action additions ───────────────────────────────────────

  /** Refresh git status by re-running git commands. */
  refreshGitStatus: () => Promise<void>;

  /** Remove an entity from its typed map by type and ID. */
  removeEntity: (entityType: EntityTypeName, entityId: string) => void;

  /** Rebuild tree hierarchy and derived state after entity map mutations. */
  rebuildDerivedData: () => void;
}
```

**New initial state values:**

```typescript
// In the create() call:
gitStatus: null,
contentHashVersion: 0,
```

**Updated `closeProject` action — clear F6 state:**

```typescript
closeProject: () => {
  // Stop file watchers (module-level handle)
  if (watcherHandle) {
    stopWatching(watcherHandle);
    watcherHandle = null;
  }

  set({
    projectPath: null,
    config: null,
    plans: new Map(),
    features: new Map(),
    tasks: new Map(),
    bugs: new Map(),
    decisions: new Map(),
    knowledge: new Map(),
    documents: new Map(),
    incidents: new Map(),
    checkpoints: new Map(),
    tree: [],
    pendingCheckpoints: [],
    loading: false,
    error: null,
    // F6 additions:
    gitStatus: null,
    contentHashVersion: 0,
  });
},
```

### 5.2 reloadEntity() Implementation

The `reloadEntity` action reads a single YAML file and upserts the parsed entity into the appropriate typed map. This action already exists as a stub from F2.

```typescript
reloadEntity: async (entityType: EntityTypeName, filePath: string) => {
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const { parse as parseYaml } = await import('yaml');

  const content = await readTextFile(filePath);
  if (!content || content.trim().length === 0) {
    console.warn(`[store] Empty file, skipping: ${filePath}`);
    return;
  }

  const parsed = parseYaml(content);
  if (!parsed || typeof parsed !== 'object' || !('id' in parsed)) {
    console.warn(`[store] No 'id' field in: ${filePath}`);
    return;
  }

  const entity = parsed as { id: string };
  const state = get();

  // Determine which map to update
  const mapKey = ENTITY_TYPE_TO_MAP_KEY[entityType];
  if (!mapKey) return;

  // Clone the map, upsert the entity, and set state
  const currentMap = state[mapKey] as Map<string, unknown>;
  const newMap = new Map(currentMap);
  newMap.set(entity.id, entity);

  set({ [mapKey]: newMap } as Partial<ProjectState>);
},
```

**`ENTITY_TYPE_TO_MAP_KEY` constant** (defined at module level in `project-store.ts`):

```typescript
const ENTITY_TYPE_TO_MAP_KEY: Record<EntityTypeName, keyof ProjectState> = {
  plan: 'plans',
  feature: 'features',
  task: 'tasks',
  bug: 'bugs',
  decision: 'decisions',
  knowledge: 'knowledge',
  document: 'documents',
  incident: 'incidents',
  checkpoint: 'checkpoints',
};
```

### 5.3 removeEntity() Implementation

```typescript
removeEntity: (entityType: EntityTypeName, entityId: string) => {
  const state = get();
  const mapKey = ENTITY_TYPE_TO_MAP_KEY[entityType];
  if (!mapKey) return;

  const currentMap = state[mapKey] as Map<string, unknown>;
  if (!currentMap.has(entityId)) return; // Already absent — no-op

  const newMap = new Map(currentMap);
  newMap.delete(entityId);

  set({ [mapKey]: newMap } as Partial<ProjectState>);
},
```

### 5.4 rebuildDerivedData() Implementation

```typescript
rebuildDerivedData: () => {
  const state = get();

  // 1. Rebuild tree hierarchy
  const tree = buildTree(state.plans, state.features, state.tasks);

  // 2. Recompute pending checkpoints
  const pendingCheckpoints = [...state.checkpoints.values()].filter(
    (c) => c.status === 'pending',
  );

  set({ tree, pendingCheckpoints });
},
```

This is the same logic that runs during `openProject`, extracted into a standalone action so the watcher can trigger it after a batch.

### 5.5 refreshGitStatus() Implementation

```typescript
refreshGitStatus: async () => {
  const projectPath = get().projectPath;
  if (!projectPath) return;

  try {
    const gitStatus = await fetchGitStatus(projectPath);
    set({ gitStatus });
  } catch (err) {
    console.warn('[store] Git status refresh failed:', err);
    // Leave previous gitStatus in place — stale data is better than no data
  }
},
```

---

## 6. Tauri Configuration

### 6.1 Capability Additions for Shell Plugin

**File:** `src-tauri/capabilities/default.json`

The shell plugin must be added to the existing capabilities file. The updated `permissions` array:

```json
{
  "identifier": "default",
  "description": "Default capabilities for KBZV",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "dialog:default",
    "shell:allow-execute"
  ]
}
```

**Rust-side plugin registration** — `src-tauri/src/lib.rs`:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())   // ← F6 addition
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Cargo.toml addition:**

```toml
[dependencies]
# ... existing dependencies ...
tauri-plugin-shell = "2"
```

### 6.2 Shell Command Scoping (Security)

The Tauri v2 shell plugin supports scoped command execution to limit which programs the frontend can invoke. For KBZV, we scope to `git` only.

**Scoped shell configuration** in `src-tauri/capabilities/default.json`:

```json
{
  "identifier": "default",
  "description": "Default capabilities for KBZV",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "dialog:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "git",
          "cmd": "git",
          "args": true
        }
      ]
    }
  ]
}
```

This configuration:

- **Allows** execution of the `git` command with any arguments
- **Denies** execution of any other command (no `bash`, `sh`, `node`, etc.)
- The `"name": "git"` is the sidecar/command name used in `Command.create('git', args)`
- The `"cmd": "git"` is the actual binary resolved from `PATH`
- `"args": true` allows any argument list (needed because we pass varying args for the 3 commands)

**TypeScript usage with the scoped command:**

```typescript
// In git.ts — this is the ONLY way to invoke shell commands:
const command = Command.create('git', args, { cwd: projectPath });
const output = await command.execute();
```

The `cwd` option sets the working directory for the git command, ensuring it runs inside the project. This is not part of the security scope — it is a process-level option.

**What is NOT allowed:**

- `Command.create('bash', [...])` — blocked
- `Command.create('sh', ['-c', '...'])` — blocked
- `Command.create('node', [...])` — blocked
- Any command name other than `git` — blocked

---

## 7. Implementation Order

Tasks should be implemented in this order due to dependencies:

| Order | Task | Description | Depends On |
|---|---|---|---|
| 1 | **Tauri shell plugin setup** | Add `tauri-plugin-shell` to Cargo.toml, register in `lib.rs`, update capabilities | F1 (scaffold exists) |
| 2 | **Git module** (`git.ts`) | `GitStatus` interface, `runGitCommand()`, `fetchGitStatus()` | Task 1 (shell plugin available) |
| 3 | **Store extensions** | Add `gitStatus`, `contentHashVersion`, `removeEntity`, `rebuildDerivedData`, `refreshGitStatus` to `project-store.ts` | F2 (store exists), Task 2 (fetchGitStatus importable) |
| 4 | **GitInfo component** | Create `GitInfo.tsx`, integrate into `HeaderBar.tsx` | Task 3 (gitStatus in store) |
| 5 | **File watcher** (`watcher.ts`) | Full watcher implementation: watch setup, debounce, event processing, entity resolution | Task 3 (store actions exist) |
| 6 | **Lifecycle integration** | Wire `startWatching` / `stopWatching` into `openProject` / `closeProject` | Task 5 (watcher exists) |
| 7 | **Integration testing** | End-to-end: open project, edit files externally, verify updates | All above |

---

## 8. Acceptance Criteria

Each criterion is testable and maps to a specific implementation component.

| # | Criterion | Verification Method |
|---|---|---|
| AC-1 | Editing a `.kbz/state/` YAML file externally updates the viewer within ~500ms. | Open project → edit a task YAML in an external editor → observe entity detail panel updates without manual refresh. |
| AC-2 | Adding a new entity file (e.g., a new task YAML) appears in the tree/list without reopening the project. | Create a new YAML file in `.kbz/state/tasks/` → observe it appears in the entity tree. |
| AC-3 | Deleting an entity file removes it from the tree/list without reopening the project. | Delete a task YAML → observe it disappears from the tree. |
| AC-4 | Rapid sequential changes (e.g., 20 files in 100ms) are batched and processed without visual flicker or multiple intermediate renders. | Script that writes 20 files rapidly → observe a single smooth update. |
| AC-5 | Git info panel shows the correct current branch name. | Open a project on branch `main` → panel shows `main`. Switch branch externally → after a file change, panel updates. |
| AC-6 | Git info panel shows the correct uncommitted changes count. | Modify a tracked file → after debounce, changes count increments. |
| AC-7 | Git info panel shows correct ahead/behind counts when an upstream is configured. | Push/pull to create drift → panel shows correct ↑ and ↓ values. |
| AC-8 | Non-git projects show no git info panel — no error, no empty container. | Open a project that is not in a git repo → GitInfo renders nothing, no errors in console. |
| AC-9 | Projects without a remote upstream show branch and changes but hide ahead/behind. | Open a project with no upstream → panel shows `⎇ repo / branch · N changes` only. |
| AC-10 | Markdown file changes in document roots trigger drift badge updates. | Modify a Markdown file in a document root → DriftBadge for the corresponding DocumentRecord shows "modified". |
| AC-11 | Opening a second project stops watchers from the first. Closing a project stops all watchers. | Open project A → open project B → verify no events from project A leak into project B. |
| AC-12 | Watcher errors are logged, not surfaced as crashes or blocking dialogs. | Simulate watcher failure (e.g., delete watched directory) → app continues, error in console. |
| AC-13 | Only `git` commands can be executed via the shell plugin — no other binaries. | Verify `capabilities/default.json` scopes shell execution to `git` only. |
| AC-14 | The watcher correctly ignores non-YAML files in `.kbz/state/` and non-Markdown files in document roots. | Create a `.txt` file in `state/tasks/` → no crash, no entity created. |

### Checklist

- [ ] Implement `watcher.ts` with `startWatching()` / `stopWatching()` lifecycle tied to `openProject` / `closeProject`
- [ ] Watch `.kbz/state/` recursively using `@tauri-apps/plugin-fs` watch API
- [ ] Watch each document root from `config.documents.roots` recursively
- [ ] Implement 200ms debounce that batches events before processing
- [ ] Classify events as create / modify / delete using `getEventKind()`
- [ ] Resolve file paths to entity type and ID using directory-to-entity mapping
- [ ] Call `reloadEntity()` on create/modify, `removeEntity()` on delete, then `rebuildDerivedData()`
- [ ] Call `invalidateContentHash()` for document root file changes to trigger drift re-check
- [ ] Implement `fetchGitStatus()` using three `git` shell commands (branch, status, rev-list)
- [ ] Parse branch name, uncommitted changes count, ahead/behind counts from command output
- [ ] Implement `GitInfo` component in header showing branch, changes, ahead/behind
- [ ] Hide `GitInfo` entirely when project is not a git repository
- [ ] Hide ahead/behind section when no upstream is configured
- [ ] Call `refreshGitStatus()` after each debounce flush
- [ ] Add `reloadEntity()`, `removeEntity()`, `rebuildDerivedData()`, `refreshGitStatus()`, `invalidateContentHash()` actions to project store
- [ ] Scope Tauri shell capability to `git` binary only
- [ ] Opening a second project stops all watchers from the previous project
- [ ] Watcher errors are caught and logged without crashing or showing blocking dialogs