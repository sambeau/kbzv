# F6: File Watching + Git Status — Development Plan

**Feature ID:** FEAT-01KMZA9PWFRJF (`file-watching-git-status`)
**Parent Plan:** P1-kbzv
**Depends on:** FEAT-01KMZA9CP9XEX (`data-layer`) — F2: Data Layer
**Type:** dev-plan
**Status:** draft

---

## Overview

This plan breaks Feature 6 into 10 implementable tasks. F6 adds two capabilities to KBZV:

1. **File watching** — the app automatically detects changes to `.kbz/state/` YAML files and document root Markdown files, debounces them, resolves which entities changed, and updates the Zustand store incrementally.
2. **Git status** — a read-only header panel showing current branch, uncommitted changes count, and ahead/behind remote via scoped Tauri shell commands.

All code is strictly read-only — no git write operations, no file mutations.

### File Manifest

| File Path | Action | Task(s) |
|---|---|---|
| `src-tauri/Cargo.toml` | **Modify** | T1 |
| `src-tauri/src/lib.rs` | **Modify** | T1 |
| `src-tauri/capabilities/default.json` | **Modify** | T1 |
| `src/lib/reader/watcher.ts` | **Create** | T2, T3, T4, T6 |
| `src/lib/store/project-store.ts` | **Modify** | T5, T6, T9 |
| `src/lib/reader/git.ts` | **Create** | T7 |
| `src/components/layout/GitInfo.tsx` | **Create** | T8 |

Total: 3 new files, 4 modified files.

---

## Task Dependency Graph

```
T1: Tauri Capability Updates
 └── T7: Git Status Data Retrieval
      └── T5: Store Extensions ←───────── T2: File Watcher Core
           ├── T8: GitInfo Component       └── T3: Debounce + Event Batching
           └── T6: Watcher-Store Integration    └── T4: File Path → Entity Resolution
                └── T9: Git Refresh Integration
                     └── T10: Error Handling + Edge Cases
```

**Critical path:** T1 → T7 → T5 → T6 → T9 → T10

**Parallel tracks:**

- Track A (git): T1 → T7 → T5 → T8 (git panel visible)
- Track B (watcher): T2 → T3 → T4 (watcher logic complete)
- Merge: T5 + T4 → T6 → T9 → T10

Tasks T2, T3, and T4 can be developed in parallel with T1 and T7 since they don't depend on the shell plugin. T8 can be developed as soon as T5 is complete.

---

## Task 1: Tauri Capability Updates

**Estimated effort:** 1 point

### What to Do

Add the Tauri v2 shell plugin to the Rust backend so the TypeScript frontend can execute scoped `git` commands. Three files need modification: `Cargo.toml` for the crate dependency, `lib.rs` for plugin registration, and `capabilities/default.json` for the permission grant scoped to `git` only.

### Implementation

**File: `src-tauri/Cargo.toml`** — add dependency:

```toml
[dependencies]
# ... existing dependencies ...
tauri-plugin-shell = "2"
```

**File: `src-tauri/src/lib.rs`** — register plugin:

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

**File: `src-tauri/capabilities/default.json`** — add scoped shell permission:

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

- **Allows** execution of the `git` command with any arguments (needed for varying args across the 3 git commands)
- **Denies** execution of all other commands (`bash`, `sh`, `node`, etc.)
- The `"name": "git"` is the command name used in `Command.create('git', args)` on the TypeScript side
- The `"cmd": "git"` is the actual binary resolved from `PATH`

### Files Touched

| File | Action |
|---|---|
| `src-tauri/Cargo.toml` | Modify — add `tauri-plugin-shell = "2"` |
| `src-tauri/src/lib.rs` | Modify — register `.plugin(tauri_plugin_shell::init())` |
| `src-tauri/capabilities/default.json` | Modify — add scoped `shell:allow-execute` permission |

### Dependencies

- F1 scaffold must exist (Tauri project structure already in place)

### Verification

1. `cargo check` in `src-tauri/` succeeds with the new dependency
2. `cargo build` compiles without errors
3. From the frontend console, confirm that `Command.create('git', ['--version'])` returns a result (success path)
4. Confirm that `Command.create('bash', ['-c', 'echo hello'])` is blocked by capability scoping

### Estimated Effort

1 point — three small edits, no logic.

---

## Task 2: File Watcher Core

**Estimated effort:** 3 points

### What to Do

Create `src/lib/reader/watcher.ts` with the public `startWatching()` / `stopWatching()` API using the `@tauri-apps/plugin-fs` watch function. This task covers only the watch setup and teardown — debounce logic (T3) and entity resolution (T4) are separate tasks. Use stub callbacks for now.

### Implementation

**File: `src/lib/reader/watcher.ts`**

```typescript
import { watch } from '@tauri-apps/plugin-fs';
import type { WatchEvent, UnwatchFn } from '@tauri-apps/plugin-fs';
import type { ProjectConfig } from '../types/config';
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

export interface ClassifiedEvent {
  path: string;
  kind: 'create' | 'modify' | 'delete';
  scope: 'state' | 'document';
}

// ── Module-level state ────────────────────────────────────────────

let activeCallbacks: WatcherCallbacks | null = null;
let activeProjectPath: string | null = null;

// ── Public API ────────────────────────────────────────────────────

/**
 * Start watching a project's .kbz/state/ directory and document roots.
 * Returns a handle that must be passed to stopWatching() on closeProject.
 */
export async function startWatching(
  projectPath: string,
  config: ProjectConfig,
  callbacks: WatcherCallbacks,
): Promise<WatcherHandle> {
  // Store module-level references for the debounce callback
  activeCallbacks = callbacks;
  activeProjectPath = projectPath;

  // Reset debounce state (implemented in T3)
  resetDebounceState();

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

/**
 * Stop all watchers. Safe to call multiple times.
 */
export function stopWatching(handle: WatcherHandle): void {
  // Clear module-level debounce state
  resetDebounceState();
  activeCallbacks = null;
  activeProjectPath = null;

  // Stop the state watcher
  handle.stateUnsubscribe();

  // Stop all document root watchers
  for (const unsub of handle.documentUnsubscribes) {
    unsub();
  }
}

// ── Event Classification ──────────────────────────────────────────

export function getEventKind(event: WatchEvent): 'create' | 'modify' | 'delete' | null {
  if ('create' in event.type) return 'create';
  if ('modify' in event.type) return 'modify';
  if ('remove' in event.type) return 'delete';
  // 'access' and 'other' events are ignored
  return null;
}

// ── Stubs for T3 (debounce) ───────────────────────────────────────

// These will be replaced with real implementations in T3.
function resetDebounceState(): void {
  // T3 implements: clear pendingEvents, debounceTimer, isProcessing
}

function onWatchEvent(
  _event: WatchEvent,
  _projectPath: string,
  _scope: 'state' | 'document',
): void {
  // T3 implements: event enqueue + debounce timer
}
```

**Key design decisions:**

- Do NOT use the `delayMs` option on `watch()` — we implement our own debounce (T3) for batching control
- `recursive: true` is required for both watcher scopes
- Pass a single path string per watcher, not an array
- If a document root directory does not exist, `watch()` throws — we catch and skip that root
- Module-level `activeCallbacks` / `activeProjectPath` are set by `startWatching()` and cleared by `stopWatching()`

### Files Touched

| File | Action |
|---|---|
| `src/lib/reader/watcher.ts` | Create |

### Dependencies

- F2 data layer must exist (provides `ProjectConfig`, `EntityTypeName` types)

### Verification

1. TypeScript compiles without errors
2. Import `startWatching` and `stopWatching` from watcher — types resolve correctly
3. Call `startWatching` with a real `.kbz/state/` directory — returns a `WatcherHandle` without throwing
4. Call `stopWatching(handle)` — no errors, no lingering watchers
5. Confirm skipping a nonexistent document root logs an info message and does not throw

### Estimated Effort

3 points — new module creation, Tauri plugin API integration, error handling for missing directories.

---

## Task 3: Debounce + Event Batching

**Estimated effort:** 3 points

### What to Do

Replace the stub `onWatchEvent`, `resetDebounceState`, and add the `flushBatch` function in `watcher.ts`. The debounce window is 200ms. All watchers (state + document roots) feed into a single shared queue. When the timer fires, events are flushed to `processBatch()` (implemented in T4/T6). A concurrency guard (`isProcessing`) prevents overlapping batch processing — if a batch is in progress, the timer re-arms.

### Implementation

**File: `src/lib/reader/watcher.ts`** — replace stubs with:

```typescript
// ── Module-level debounce state ──────────────────────────────────

let pendingEvents: ClassifiedEvent[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isProcessing = false;

const DEBOUNCE_MS = 200;

// ── Reset (called by startWatching and stopWatching) ─────────────

function resetDebounceState(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingEvents = [];
  isProcessing = false;
}

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

// ── Flush logic ──────────────────────────────────────────────────

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

**Filtering rules applied in `onWatchEvent`:**

| Scope | Extension Filter | Rationale |
|---|---|---|
| `state` | `.yaml` only | Entity state is always YAML |
| `document` | `.md` only | Document roots contain Markdown |

Events for other file types (`.txt`, `.tmp`, etc.) are silently dropped before enqueue.

### Files Touched

| File | Action |
|---|---|
| `src/lib/reader/watcher.ts` | Modify — replace debounce stubs with real implementation |

### Dependencies

- T2 (file watcher core must exist with stubs)

### Verification

1. Add a `console.log` in `flushBatch` to confirm batching — rapidly create 5 `.yaml` files and confirm a single flush occurs
2. Confirm non-`.yaml` files in `state/` are filtered out (create a `.txt` file — no event in queue)
3. Confirm non-`.md` files in document roots are filtered out
4. Confirm that `access` and `other` event types return `null` from `getEventKind` and are not enqueued
5. Verify the concurrency guard: if a long-running `processBatch` is simulated, new events queue up and flush after it completes
6. Confirm `resetDebounceState()` clears all module-level state and cancels any pending timer

### Estimated Effort

3 points — timer logic, concurrency guard, event filtering, edge cases around re-arming.

---

## Task 4: File Path → Entity Resolution

**Estimated effort:** 3 points

### What to Do

Implement `resolveEntityFromPath()`, `extractEntityId()`, and `deduplicateByPath()` in `watcher.ts`. These functions map absolute file paths from watch events to entity type + ID pairs, handling the varied filename conventions for each entity type.

### Implementation

**File: `src/lib/reader/watcher.ts`** — add the following internal functions:

```typescript
// ── Directory → Entity Type Mapping ──────────────────────────────

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

// ── Path Resolution ──────────────────────────────────────────────

/**
 * Resolve an absolute file path to an entity type and ID.
 * Returns null if the path is not in a recognised entity directory.
 */
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

// ── Entity ID Extraction ─────────────────────────────────────────

/**
 * Extract entity ID from a YAML filename.
 *
 * Filename patterns by entity type:
 *   plans/       → {id}.yaml                        → "P1-kbzv"
 *   knowledge/   → {id}.yaml                        → "KE-01JX..."
 *   checkpoints/ → {id}.yaml                        → "CHK-01JX..."
 *   documents/   → {id with / replaced by --}.yaml  → restore / from --
 *   features/    → {id}-{slug}.yaml                 → "FEAT-01KMZA..."
 *   tasks/       → {id}-{slug}.yaml                 → "TASK-01KMZA..."
 *   bugs/        → {id}-{slug}.yaml                 → "BUG-01KMZA..."
 *   decisions/   → {id}-{slug}.yaml                 → "DEC-01KMZA..."
 *   incidents/   → {id}-{slug}.yaml                 → "INC-01KMZA..."
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
  // ULID is exactly 13–26 uppercase alphanumeric characters (Kanbanzai TSID13 or full ULID)
  const match = base.match(/^([A-Z]+-[0-9A-Z]{13,26})(?:-.*)?$/);
  if (match) {
    return match[1];
  }

  // Fallback: return the full base (handles unexpected patterns gracefully)
  return base;
}

// ── Deduplication ────────────────────────────────────────────────

/**
 * Keep only the latest event per unique file path.
 * When multiple events arrive for the same file within a debounce window,
 * the last one wins (e.g., create then modify → modify).
 */
function deduplicateByPath(events: ClassifiedEvent[]): ClassifiedEvent[] {
  const latest = new Map<string, ClassifiedEvent>();
  for (const event of events) {
    latest.set(event.path, event); // last event per path wins
  }
  return Array.from(latest.values());
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

**Test cases for `resolveEntityFromPath`:**

| Input Path | Expected Result |
|---|---|
| `/projects/kbzv/.kbz/state/features/FEAT-01KMZA9PWFRJF-file-watching.yaml` | `{ entityType: 'feature', entityId: 'FEAT-01KMZA9PWFRJF' }` |
| `/projects/kbzv/.kbz/state/plans/P1-kbzv.yaml` | `{ entityType: 'plan', entityId: 'P1-kbzv' }` |
| `/projects/kbzv/.kbz/state/config.yaml` | `null` (no subdirectory) |
| `/projects/kbzv/.kbz/state/unknown/foo.yaml` | `null` (unknown directory) |
| `/projects/kbzv/.kbz/state/tasks/nested/deep.yaml` | `null` (nested too deep) |
| `/projects/kbzv/work/design/doc.md` | `null` (not in state/) |

### Files Touched

| File | Action |
|---|---|
| `src/lib/reader/watcher.ts` | Modify — add resolution and deduplication functions |

### Dependencies

- T2 (watcher module and types must exist)

### Verification

1. Unit test `extractEntityId` with all 9 entity types from the table above
2. Unit test `resolveEntityFromPath` with valid paths, invalid paths, nested paths, and unknown directories
3. Unit test `deduplicateByPath` — feed 3 events for the same path, confirm only the last survives
4. Confirm `resolveEntityFromPath` returns `null` for files directly in `state/` (no subdirectory)
5. Confirm Windows-style backslash paths are normalised correctly

### Estimated Effort

3 points — regex pattern matching, multiple entity type conventions, comprehensive edge cases.

---

## Task 5: Store Extensions

**Estimated effort:** 5 points

### What to Do

Extend `project-store.ts` with new state fields (`gitStatus`, `contentHashVersion`) and new actions (`reloadEntity`, `removeEntity`, `rebuildDerivedData`, `refreshGitStatus`). These actions are the store-side contract that the watcher calls via its `WatcherCallbacks` interface.

### Implementation

**File: `src/lib/store/project-store.ts`** — additions to the state interface:

```typescript
import type { GitStatus } from '../reader/git';

// ── New fields in ProjectState interface ─────────────────────────

interface ProjectState {
  // ... existing F2 fields ...

  /** Current git status. null = no project or not a git repo. */
  gitStatus: GitStatus | null;

  /**
   * Monotonically increasing counter. Incremented when document root files
   * change. DriftBadge components use this as a cache-busting dependency.
   */
  contentHashVersion: number;

  // ── F6 action additions ──────────────────────────────────────

  /** Re-read a single YAML entity file and upsert into the store. */
  reloadEntity: (entityType: EntityTypeName, filePath: string) => Promise<void>;

  /** Remove an entity from its typed map by type and ID. */
  removeEntity: (entityType: EntityTypeName, entityId: string) => void;

  /** Rebuild tree hierarchy and derived state after entity map mutations. */
  rebuildDerivedData: () => void;

  /** Refresh git status by re-running git commands. */
  refreshGitStatus: () => Promise<void>;
}
```

**Initial state values:**

```typescript
// In the create() call:
gitStatus: null,
contentHashVersion: 0,
```

**Entity type → map key constant** (module level):

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

**`reloadEntity` action:**

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

  const mapKey = ENTITY_TYPE_TO_MAP_KEY[entityType];
  if (!mapKey) return;

  const currentMap = state[mapKey] as Map<string, unknown>;
  const newMap = new Map(currentMap);
  newMap.set(entity.id, entity);

  set({ [mapKey]: newMap } as Partial<ProjectState>);
},
```

**`removeEntity` action:**

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

**`rebuildDerivedData` action:**

```typescript
rebuildDerivedData: () => {
  const state = get();

  // 1. Rebuild tree hierarchy
  const tree = buildTree(state.plans, state.features, state.tasks);

  // 2. Recompute pending checkpoints
  const pendingCheckpoints = [...state.checkpoints.values()].filter(
    (c: any) => c.status === 'pending',
  );

  set({ tree, pendingCheckpoints });
},
```

**`refreshGitStatus` action:**

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

**Updated `closeProject` action** — clear F6 state:

```typescript
closeProject: () => {
  // Stop file watchers (handled in T6)
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

### Files Touched

| File | Action |
|---|---|
| `src/lib/store/project-store.ts` | Modify — add `gitStatus`, `contentHashVersion` fields; add `reloadEntity`, `removeEntity`, `rebuildDerivedData`, `refreshGitStatus` actions; update `closeProject` |

### Dependencies

- F2 data layer (store exists with entity maps, `buildTree`, `get`/`set`)
- T7 (provides `fetchGitStatus` import — can be stubbed initially with `async () => null`)

### Verification

1. TypeScript compiles with all new fields and actions
2. Initial state has `gitStatus: null` and `contentHashVersion: 0`
3. Call `reloadEntity('task', '/path/to/task.yaml')` with a valid YAML file → entity appears in `tasks` map
4. Call `reloadEntity` with empty file → no crash, logs warning
5. Call `reloadEntity` with YAML missing `id` field → no crash, logs warning
6. Call `removeEntity('task', 'TASK-01KMZA...')` → entity removed from map
7. Call `removeEntity` with nonexistent ID → no crash (no-op)
8. Call `rebuildDerivedData()` → `tree` and `pendingCheckpoints` are recomputed from current maps
9. Call `refreshGitStatus()` with a git project → `gitStatus` is populated
10. Call `closeProject()` → all state reset including `gitStatus` and `contentHashVersion`

### Estimated Effort

5 points — four new store actions with YAML parsing, error handling, map cloning, and derived data rebuild logic. Touches the central store module.

---

## Task 6: Watcher-Store Integration

**Estimated effort:** 3 points

### What to Do

Implement the `processBatch()` function in `watcher.ts` that ties watch events to store actions. Wire `startWatching` / `stopWatching` into the `openProject` / `closeProject` actions in `project-store.ts`. This is the glue that makes file changes flow into the UI.

### Implementation

**File: `src/lib/reader/watcher.ts`** — add `processBatch`:

```typescript
/**
 * Process a batch of debounced file events.
 *
 * Pipeline:
 *   1. Deduplicate by path (keep last event per file)
 *   2. Separate state events from document events
 *   3. Process state events (reload or remove entities)
 *   4. Process document events (invalidate content hashes)
 *   5. Rebuild derived data ONCE for the entire batch
 *   6. Refresh git status
 */
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
          console.warn(`[watcher] File gone on read, treating as no-op: ${event.path}`);
        } else {
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

**File: `src/lib/store/project-store.ts`** — wire lifecycle:

```typescript
import { startWatching, stopWatching } from '../reader/watcher';
import type { WatcherHandle } from '../reader/watcher';

// Module-level variable to hold the watcher handle
let watcherHandle: WatcherHandle | null = null;

// Inside openProject action, AFTER initial load succeeds:
openProject: async (path: string) => {
  // ... existing F2 load logic ...

  // Start file watchers
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

  // Initial git status fetch
  await get().refreshGitStatus();
},

// Inside closeProject action:
closeProject: () => {
  if (watcherHandle) {
    stopWatching(watcherHandle);
    watcherHandle = null;
  }
  // ... existing F2 state reset + F6 state reset ...
},
```

**Key design decision:** The watcher does NOT import the Zustand store directly. It receives a `WatcherCallbacks` object. This keeps `watcher.ts` testable in isolation — tests can pass mock callbacks without instantiating a real store.

### Files Touched

| File | Action |
|---|---|
| `src/lib/reader/watcher.ts` | Modify — add `processBatch` |
| `src/lib/store/project-store.ts` | Modify — wire `startWatching`/`stopWatching` into `openProject`/`closeProject` |

### Dependencies

- T2 (watcher core — `startWatching`, `stopWatching`)
- T3 (debounce — `flushBatch` calls `processBatch`)
- T4 (entity resolution — `resolveEntityFromPath`, `deduplicateByPath`)
- T5 (store extensions — `reloadEntity`, `removeEntity`, `rebuildDerivedData`, `refreshGitStatus`)

### Verification

1. Open a project → watchers start (confirm via console log in `startWatching`)
2. Close a project → watchers stop (confirm via console log in `stopWatching`)
3. Edit a `.kbz/state/tasks/TASK-*.yaml` file externally → entity updates in UI within ~500ms
4. Create a new `.yaml` file in `state/tasks/` → new entity appears in tree
5. Delete a `.yaml` file from `state/tasks/` → entity disappears from tree
6. Edit a `.md` file in a document root → `contentHashVersion` increments
7. Open project A, then open project B → watchers for A are stopped before B's start
8. Verify derived data (tree) rebuilds once per batch, not once per file event

### Estimated Effort

3 points — glue code connecting two existing modules, lifecycle management, callback wiring.

---

## Task 7: Git Status Data Retrieval

**Estimated effort:** 3 points

### What to Do

Create `src/lib/reader/git.ts` with the `GitStatus` interface, `runGitCommand()` helper, and `fetchGitStatus()` function. This module executes three git commands via the Tauri shell plugin and parses their output into a typed data object.

### Implementation

**File: `src/lib/reader/git.ts`**

```typescript
import { Command } from '@tauri-apps/plugin-shell';

// ── Types ─────────────────────────────────────────────────────────

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

// ── Git Command Execution ─────────────────────────────────────────

/**
 * Execute a git command in the given directory.
 * Returns { success, stdout, stderr }.
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

// ── Public API ────────────────────────────────────────────────────

/**
 * Fetch current git status for a project directory.
 * Returns null if the directory is not a git repository or git is not available.
 */
export async function fetchGitStatus(projectPath: string): Promise<GitStatus | null> {
  // Extract repo name from path
  const repoName = projectPath.replace(/\\/g, '/').split('/').pop() ?? 'unknown';

  // ── Command 1: Branch name ──────────────────────────────────
  //
  // git rev-parse --abbrev-ref HEAD
  //   Success:  prints branch name, e.g. "main\n"
  //   Detached: prints "HEAD\n"
  //   Non-git:  exits non-zero
  //
  const branchResult = await runGitCommand(projectPath, [
    'rev-parse',
    '--abbrev-ref',
    'HEAD',
  ]);

  if (!branchResult.success) {
    // Not a git repo, or git is not installed
    return null;
  }

  const branch = branchResult.stdout.trim();

  // ── Command 2: Uncommitted changes count ────────────────────
  //
  // git status --porcelain
  //   Output: one line per changed/untracked file
  //   Count:  number of non-empty lines
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

  // ── Command 3: Ahead/behind remote ──────────────────────────
  //
  // git rev-list --left-right --count HEAD...@{upstream}
  //   Output:   "<ahead>\t<behind>\n", e.g. "16\t0\n"
  //   No upstream: exits non-zero
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

**Git command output parsing — no regex needed:**

| Command | Parsing | Example |
|---|---|---|
| `rev-parse --abbrev-ref HEAD` | `stdout.trim()` | `"main\n"` → `"main"` |
| `status --porcelain` | `split('\n').filter(Boolean).length` | `" M file.ts\n?? new.txt\n"` → `2` |
| `rev-list --left-right --count` | `trim().split('\t')` → `parseInt` | `"16\t0\n"` → `{ ahead: 16, behind: 0 }` |

### Files Touched

| File | Action |
|---|---|
| `src/lib/reader/git.ts` | Create |

### Dependencies

- T1 (Tauri shell plugin must be registered and scoped)

### Verification

1. Call `fetchGitStatus` on a git repo → returns valid `GitStatus` with correct branch
2. Call `fetchGitStatus` on a non-git directory → returns `null`
3. Test on a repo with no upstream → `ahead` and `behind` are `null`
4. Test on a repo with uncommitted changes → `changesCount` matches `git status --porcelain | wc -l`
5. Test detached HEAD → `branch` is `"HEAD"`
6. Test with malformed rev-list output → `isNaN` guard prevents bad data
7. Test with git not installed (mock `Command.create` to throw) → returns `null`

### Estimated Effort

3 points — new module with shell execution, output parsing, and robust error handling for 3 commands.

---

## Task 8: GitInfo Component

**Estimated effort:** 2 points

### What to Do

Create the `GitInfo.tsx` React component that renders the read-only git status panel in the header bar. The component subscribes to `gitStatus` from the Zustand store and renders branch, changes count, and ahead/behind with Lucide icons. It renders nothing if `gitStatus` is `null`.

### Implementation

**File: `src/components/layout/GitInfo.tsx`**

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
      <span className="text-muted-foreground/30">&middot;</span>

      {/* Changes count */}
      <span className="tabular-nums whitespace-nowrap">
        {gitStatus.changesCount} {gitStatus.changesCount === 1 ? 'change' : 'changes'}
      </span>

      {/* Ahead/behind — only shown when upstream exists */}
      {gitStatus.ahead !== null && gitStatus.behind !== null && (
        <>
          <span className="text-muted-foreground/30">&middot;</span>
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

**Rendering states:**

| State | Condition | Rendered Output |
|---|---|---|
| No git | `gitStatus === null` | Nothing (`null`) |
| No upstream | `ahead === null && behind === null` | `⎇ kbzv / main · 3 changes` |
| Full | All fields present | `⎇ kbzv / main · 3 changes · ↑16 \| ↓0` |

**Placement in `HeaderBar.tsx`:**

```tsx
// In HeaderBar.tsx — right side of header:
<div className="flex items-center justify-between h-12 px-4 border-b">
  {/* Left: View switcher */}
  <div>...</div>

  {/* Right: Git info */}
  <GitInfo />
</div>
```

**Layout properties:**

| Property | Value | Rationale |
|---|---|---|
| Font size | `text-sm` | Ambient, not attention-grabbing |
| Text colour | `text-muted-foreground` | Muted — design spec |
| Repo name max width | `max-w-[120px]` | Prevent overflow |
| Branch max width | `max-w-[160px]` | Prevent overflow |
| Overflow | `truncate` | Ellipsis |
| Numbers | `tabular-nums` | Fixed-width digits prevent layout shift |
| Interaction | None | No click handlers, no hover states |

### Files Touched

| File | Action |
|---|---|
| `src/components/layout/GitInfo.tsx` | Create |
| `src/components/layout/HeaderBar.tsx` | Modify — add `<GitInfo />` to right side |

### Dependencies

- T5 (store must have `gitStatus` field)
- `lucide-react` icons (`GitBranch`, `ArrowUp`, `ArrowDown`) — already in project deps

### Verification

1. Component renders nothing when `gitStatus` is `null`
2. Component renders branch + changes when there is no upstream (ahead/behind hidden)
3. Component renders full display when all fields are present
4. Long repo/branch names truncate with ellipsis (not overflow)
5. Changes count uses singular "change" for 1 and plural "changes" for 0, 2+
6. `tabular-nums` class is applied to prevent layout shift when numbers change
7. No interactive elements — no onClick, no cursor-pointer, no hover states

### Estimated Effort

2 points — single presentational component with conditional rendering and Tailwind styling.

---

## Task 9: Git Refresh Integration

**Estimated effort:** 1 point

### What to Do

Ensure git status is refreshed at exactly two trigger points: (1) on project open (initial read), and (2) after each debounced file watch batch. Verify there is no periodic timer and no other trigger.

This task is mostly about confirming the wiring is correct and adding the git refresh call to the right places. Most of the work was already done in T5 (`refreshGitStatus` action) and T6 (`processBatch` step 6). This task verifies the integration end-to-end.

### Implementation

**Trigger 1 — Project open** (in `project-store.ts`, `openProject` action):

```typescript
// After initial load + watcher start:
await get().refreshGitStatus();
```

This is already wired in T6. Confirm it runs after the initial entity load so the user sees git info immediately.

**Trigger 2 — After debounced batch** (in `watcher.ts`, `processBatch` step 6):

```typescript
// Step 6 in processBatch:
try {
  await callbacks.refreshGitStatus();
} catch (err) {
  console.warn('[watcher] Git status refresh failed:', err);
}
```

This is already implemented in T6. Confirm the git refresh runs after entity processing so it doesn't delay UI updates for entity changes.

**What is NOT a trigger:**

| Non-trigger | Reason |
|---|---|
| `setInterval` | File watching already provides the trigger |
| UI interactions (tab switch, selection) | Would add unnecessary git command overhead |
| Window focus/blur | File watcher handles this |

### Files Touched

| File | Action |
|---|---|
| `src/lib/store/project-store.ts` | Verify — confirm `refreshGitStatus()` call in `openProject` |
| `src/lib/reader/watcher.ts` | Verify — confirm `callbacks.refreshGitStatus()` call in `processBatch` |

### Dependencies

- T5 (`refreshGitStatus` action exists)
- T6 (`processBatch` calls `refreshGitStatus`)
- T7 (`fetchGitStatus` is implemented)

### Verification

1. Open a project → `GitInfo` shows correct branch and changes immediately
2. Edit a tracked file externally → after ~200ms debounce, changes count updates
3. Switch git branches in terminal → edit a file → branch name updates in panel
4. Confirm no `setInterval` or periodic timer exists for git refresh
5. Confirm git refresh happens after entity processing (not before — don't delay entity UI updates)

### Estimated Effort

1 point — verification and minor adjustments to existing wiring.

---

## Task 10: Error Handling + Edge Cases

**Estimated effort:** 2 points

### What to Do

Audit all error paths across the watcher and git modules. Ensure every failure is caught, logged, and handled gracefully without crashing the app. Add any missing error handling identified during integration. Test edge cases: non-git repos, watcher failures, empty files, race conditions.

### Implementation

**Error handling matrix — verify each row is covered:**

| Scenario | Detection | Behaviour | Code Location |
|---|---|---|---|
| `watch()` call throws | try/catch in `startWatching` | Log error, app continues without live updates | `watcher.ts` `startWatching` |
| Document root doesn't exist | `watch()` throws | Catch, log info, skip that root, other watchers start | `watcher.ts` `startWatching` loop |
| Non-`.yaml` file in `state/` | Extension check in `onWatchEvent` | Filtered out before enqueue | `watcher.ts` `onWatchEvent` |
| Non-`.md` file in document root | Extension check in `onWatchEvent` | Filtered out before enqueue | `watcher.ts` `onWatchEvent` |
| `resolveEntityFromPath` returns null | null check in `processBatch` | Event skipped, no log (expected for non-entity files) | `watcher.ts` `processBatch` |
| YAML parse error | try/catch in `reloadEntity` | Warning logged, previous entity stays in store | `project-store.ts` `reloadEntity` |
| Empty YAML file | Content length check in `reloadEntity` | Warning logged, skip | `project-store.ts` `reloadEntity` |
| YAML missing `id` field | Object check in `reloadEntity` | Warning logged, skip | `project-store.ts` `reloadEntity` |
| File gone when read (race) | `readTextFile` throws in `reloadEntity` | Caught in `processBatch`, treated as no-op for creates | `watcher.ts` `processBatch` |
| `processBatch` unexpected throw | try/catch in `flushBatch` | Error logged, watcher continues | `watcher.ts` `flushBatch` |
| Not a git repo | `rev-parse` exits non-zero | `fetchGitStatus` returns `null`, panel hidden | `git.ts` `fetchGitStatus` |
| Git not installed | `Command.create` throws | Caught, returns `null` | `git.ts` `runGitCommand` |
| Detached HEAD | `rev-parse` returns `"HEAD"` | Displayed as branch name | `git.ts` `fetchGitStatus` |
| No upstream configured | `rev-list` exits non-zero | `ahead`/`behind` remain `null`, UI hides section | `git.ts` `fetchGitStatus` |
| Malformed rev-list output | `parseInt` returns `NaN` | `isNaN` check prevents bad data, stays `null` | `git.ts` `fetchGitStatus` |
| Git command timeout | `execute()` eventually returns | Caller has try/catch, stale data stays | `git.ts` `runGitCommand` |
| Watcher stops delivering events | Not detectable | User closes and reopens project | n/a |

**Additional defensive code to add/verify:**

```typescript
// In startWatching — wrap the entire state watcher setup:
try {
  const stateUnsubscribe = await watch(/* ... */);
  // ...
} catch (err) {
  console.error('[watcher] Failed to watch .kbz/state/:', err);
  // Return a no-op handle so stopWatching doesn't throw
  return {
    stateUnsubscribe: () => {},
    documentUnsubscribes: [],
  };
}
```

```typescript
// In stopWatching — guard each unsubscribe call:
export function stopWatching(handle: WatcherHandle): void {
  resetDebounceState();
  activeCallbacks = null;
  activeProjectPath = null;

  try {
    handle.stateUnsubscribe();
  } catch (err) {
    console.warn('[watcher] Error stopping state watcher:', err);
  }

  for (const unsub of handle.documentUnsubscribes) {
    try {
      unsub();
    } catch (err) {
      console.warn('[watcher] Error stopping document watcher:', err);
    }
  }
}
```

**Invariant:** The app must never crash due to a watcher or git issue. All errors are caught and logged.

### Files Touched

| File | Action |
|---|---|
| `src/lib/reader/watcher.ts` | Modify — harden error paths, add defensive try/catch in `stopWatching` |
| `src/lib/reader/git.ts` | Verify — all error paths covered |
| `src/lib/store/project-store.ts` | Verify — `reloadEntity` handles all parse failures |

### Dependencies

- All previous tasks (T1–T9)

### Verification

1. **Non-git repo:** Open a project not in a git repo → no git panel, no console errors
2. **Missing document root:** Configure a nonexistent document root → info log, other watchers still work
3. **Empty YAML file:** Create an empty `.yaml` in `state/tasks/` → warning logged, no crash
4. **Malformed YAML:** Create a `.yaml` with invalid YAML → warning logged, no crash
5. **Rapid delete-then-create:** Delete and immediately recreate a YAML file → entity ends up in correct final state
6. **Non-YAML in state:** Create `state/tasks/notes.txt` → no event processed, no error
7. **Non-Markdown in document root:** Create `work/design/image.png` → no event processed
8. **Watcher failure simulation:** Delete `.kbz/state/` while project is open → error logged, app continues
9. **Double `stopWatching`:** Call `stopWatching` twice → no error
10. **Confirm no unhandled promise rejections** in the console during any error scenario

### Estimated Effort

2 points — auditing, defensive coding, edge case testing. No new features, but critical for production quality.

---

## Effort Summary

| Task | Description | Points | Depends On |
|---|---|---|---|
| T1 | Tauri capability updates | 1 | F1 |
| T2 | File watcher core | 3 | F2 |
| T3 | Debounce + event batching | 3 | T2 |
| T4 | File path → entity resolution | 3 | T2 |
| T5 | Store extensions | 5 | F2, T7 |
| T6 | Watcher-store integration | 3 | T2, T3, T4, T5 |
| T7 | Git status data retrieval | 3 | T1 |
| T8 | GitInfo component | 2 | T5 |
| T9 | Git refresh integration | 1 | T5, T6, T7 |
| T10 | Error handling + edge cases | 2 | T1–T9 |
| | **Total** | **26** | |

---

## Testing Strategy

### Unit Tests

| Module | What to Test | Approach |
|---|---|---|
| `extractEntityId` | All 9 entity types, edge cases | Pure function — pass directory + filename, assert ID |
| `resolveEntityFromPath` | Valid paths, invalid paths, nesting, unknown dirs | Pure function — pass path + project root, assert result |
| `deduplicateByPath` | Single event, multiple events same path, mixed paths | Pure function — pass array, assert output |
| `getEventKind` | create, modify, remove, access, other | Pure function — pass mock `WatchEvent`, assert kind |
| `fetchGitStatus` | All 3 commands succeed, partial failures, non-git | Mock `Command.create` — assert returned `GitStatus` |
| `reloadEntity` | Valid YAML, empty file, missing id, parse error | Mock `readTextFile` — assert store state |
| `removeEntity` | Existing entity, nonexistent entity | Set up store, call remove, assert state |

### Integration Tests

| Scenario | What to Test | Approach |
|---|---|---|
| File create | New YAML file appears in entity tree | Write file to fixture `.kbz/state/tasks/`, wait 500ms, assert tree contains entity |
| File modify | Entity updates after external edit | Modify fixture YAML, wait 500ms, assert field changed |
| File delete | Entity disappears from tree | Delete fixture YAML, wait 500ms, assert entity gone |
| Batch processing | 20 rapid writes → single batch | Script writes 20 files in 100ms, count `rebuildDerivedData` calls (should be 1) |
| Git status | Panel shows correct data | Open fixture project in git repo, assert branch/changes/ahead/behind |
| Non-git project | Panel is absent | Open fixture project outside git repo, assert no GitInfo rendered |
| Lifecycle | Watchers start/stop correctly | Open project A, open project B, verify no cross-contamination |

### Component Tests

| Component | What to Test | Approach |
|---|---|---|
| `GitInfo` | Null state, no upstream, full state | Render with mock store providing each state variant |
| `GitInfo` | Truncation | Render with long repo/branch names, assert `truncate` classes applied |
| `GitInfo` | Singular/plural "change(s)" | Render with 0, 1, 2 changes — assert correct text |

### Manual Testing Checklist

- [ ] Open a kbzv project → git info appears in header
- [ ] Edit a task YAML in an external editor → entity updates within ~500ms
- [ ] Create a new task YAML → appears in tree without reopening
- [ ] Delete a task YAML → disappears from tree
- [ ] Run kbzv CLI to create a feature with tasks (burst) → single smooth update, no flicker
- [ ] Open a project not in a git repo → no git panel, no errors
- [ ] Open a project with no remote upstream → branch + changes shown, no ahead/behind
- [ ] Switch git branches in terminal, then edit a file → branch name updates
- [ ] Edit a Markdown file in a document root → drift badge updates
- [ ] Open project A, then project B → no events from A leak into B
- [ ] Check browser console for any unhandled errors during all scenarios

---

## Risk Areas

### 1. Tauri FS Watch API Reliability

**Risk:** The `@tauri-apps/plugin-fs` `watch()` function wraps the Rust `notify` crate. On macOS, this uses `FSEvents`; on Linux, `inotify`; on Windows, `ReadDirectoryChanges`. Each platform has quirks — macOS may batch events differently, Linux has inotify watch limits.

**Mitigation:** We use defensive error handling (all watch setup in try/catch) and accept stale data as the fallback. The app is fully functional without watchers — it loaded data on project open. Watchers are a UX enhancement, not a correctness requirement.

### 2. Atomic Write Race Conditions

**Risk:** Kanbanzai uses atomic writes (write to temp file, then rename). The FS watcher may deliver a `create` event for the temp file followed by a `modify`/`rename` event for the target. Our debounce window (200ms) should absorb both events into one batch, and deduplication keeps only the final event per path.

**Mitigation:** The debounce + deduplication pipeline handles this. If a rare race causes a `reloadEntity` to fail (file gone between event and read), we catch the error and log it — previous entity version stays in store.

### 3. Shell Plugin Security

**Risk:** The Tauri shell plugin gives the frontend the ability to execute arbitrary commands if not properly scoped. A misconfiguration could be a security issue.

**Mitigation:** The capability configuration explicitly scopes execution to the `git` command only. No other binary can be invoked from the frontend. This is verified in T1 and tested by attempting to execute a non-git command.

### 4. Git Command Performance

**Risk:** Running 3 git commands on every file change event could be slow for very large repositories.

**Mitigation:** Git commands are fast for status queries (<50ms typically). They run after entity processing (step 6 of `processBatch`), so they don't delay entity UI updates. If performance becomes an issue, we could add a separate debounce for git refresh or skip refresh for document-only events.

### 5. Watcher Death Detection

**Risk:** If the OS-level watcher stops delivering events (e.g., after sleep/wake, inotify limit reached), there is no reliable way to detect this with the Tauri FS plugin.

**Mitigation:** Accepted limitation for v1. The user can close and reopen the project to re-establish watchers. The spec explicitly states "no automatic restart" — detection of watcher death is not reliably possible.

---

## References

- **Specification:** `work/spec/f6-file-watching-git-status-spec.md` — source of truth for all implementation details
- **Design:** `work/design/f6-file-watching-git-status.md` — rationale and architectural decisions
- **Architecture:** `work/design/kbzv-architecture.md` §5.3 (File Watching), §5.4 (Concurrency Safety), §6.9 (Git Info Panel)
- **Parent Plan:** `work/plan/kbzv-v1-dev-plan.md` — F6 section
- **F2 Data Layer Spec:** `work/spec/f2-data-layer-spec.md` — store interface this feature extends
- **Tauri FS Plugin:** https://v2.tauri.app/plugin/file-system/
- **Tauri Shell Plugin:** https://v2.tauri.app/plugin/shell/