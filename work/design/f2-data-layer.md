# Feature 2: Data Layer — Design Document

| Field | Value |
|-------|-------|
| **Feature** | FEAT-01KMZA9CP9XEX |
| **Parent Plan** | P1-kbzv |
| **Depends On** | FEAT-01KMZA96W1J98 (F1: App Scaffold + Theme) |
| **Status** | proposed |
| **Author** | sambeau |

## 1. Overview

This feature implements the pure data layer for KBZV — no UI changes. It delivers the ability to open a Kanbanzai project folder, parse all `.kbz/state/` YAML files into typed in-memory entity maps, parse the project configuration, build the Plan→Feature→Task hierarchy tree, compute progress metrics, resolve cross-references by ID prefix, and expose everything through a Zustand store for the UI to consume.

### 1.1 What This Feature Delivers

1. **TypeScript entity types** — interfaces for all 9 Kanbanzai entity types, derived from the architecture (§4.1)
2. **Project loader** — `openProject(path)` reads `.kbz/config.yaml`, walks `state/` subdirectories, parses YAML into typed maps
3. **Zustand store** — `ProjectState` holding entity maps, config, derived tree, and actions
4. **Entity hierarchy** — tree builder producing the Plan→Feature→Task nesting with standalone entity lists
5. **Query layer** — metrics (completion %, estimate rollups), reference resolution (ID prefix → entity type)
6. **Constants** — status colour palette, entity type metadata
7. **Error handling** — graceful degradation for missing directories, parse errors, unknown fields, broken references

### 1.2 What This Feature Does NOT Deliver

- No UI components or visual changes (consumed by F3–F5)
- No file watching (delivered in F6: File Watching & Git Status)
- No Markdown document content reading (delivered in F4: Documents View)
- No git status information (delivered in F6)

---

## 2. Project Structure

All data layer code lives under `src/lib/` — cleanly separated from UI components.

```
src/lib/
├── types/                    # Entity type definitions
│   ├── plan.ts
│   ├── feature.ts
│   ├── task.ts
│   ├── bug.ts
│   ├── decision.ts
│   ├── knowledge.ts
│   ├── document.ts
│   ├── incident.ts
│   ├── checkpoint.ts
│   ├── config.ts
│   └── index.ts              # Re-exports all types
│
├── store/                    # Zustand stores
│   └── project-store.ts      # Project state (entities, config, tree)
│
├── reader/                   # .kbz directory reading
│   └── loader.ts             # Walk dirs, parse YAML, build model
│
├── query/                    # Derived data computation
│   ├── tree.ts               # Entity hierarchy builder
│   ├── metrics.ts            # Progress, completion %, rollups
│   └── references.ts         # Cross-reference resolution
│
└── constants/
    ├── status-colours.ts     # Status → colour mapping
    └── entity-types.ts       # Entity type metadata (icon, label, directory)
```

---

## 3. TypeScript Entity Types

All interfaces use exact YAML field names. Optional fields use `?`. Timestamps are `string` (RFC 3339 UTC) — formatted for display, compared for sorting. Status fields are typed as `string` (not union types) to support unknown future values without breaking.

### 3.1 Plan

```typescript
// src/lib/types/plan.ts

export interface Plan {
  id: string;              // P{n}-{slug} e.g. "P1-kbzv"
  slug: string;
  title: string;
  status: string;          // proposed | designing | active | done | superseded | cancelled
  summary: string;
  design?: string;         // DocumentRecord ID
  tags?: string[];
  created: string;         // RFC 3339 UTC
  created_by: string;
  updated: string;
  supersedes?: string;     // Plan ID
  superseded_by?: string;  // Plan ID
}
```

**Lifecycle:** `proposed` → `designing` → `active` → `done`. From any non-terminal: → `superseded`, → `cancelled`.

### 3.2 Feature

```typescript
// src/lib/types/feature.ts

export interface Feature {
  id: string;              // FEAT-{TSID13}
  slug: string;
  parent: string;          // Plan ID
  status: string;          // proposed | designing | specifying | dev-planning | developing | done | superseded | cancelled
  estimate?: number;       // Modified Fibonacci scale
  summary: string;
  design?: string;         // DocumentRecord ID
  spec?: string;           // DocumentRecord ID
  dev_plan?: string;       // DocumentRecord ID
  tags?: string[];
  tasks?: string[];        // Denormalised child task IDs
  decisions?: string[];    // Decision IDs
  branch?: string;
  supersedes?: string;
  superseded_by?: string;
  created: string;
  created_by: string;
  updated: string;
}
```

**Lifecycle:** `proposed` → `designing` → `specifying` → `dev-planning` → `developing` → `done`. From any non-terminal: → `superseded`, → `cancelled`. Backward transitions triggered by document supersession.

### 3.3 Task

```typescript
// src/lib/types/task.ts

export interface Task {
  id: string;              // TASK-{TSID13}
  parent_feature: string;  // Feature ID
  slug: string;
  summary: string;
  status: string;          // queued | ready | active | done | blocked | needs-review | needs-rework | not-planned | duplicate
  estimate?: number;
  assignee?: string;
  depends_on?: string[];   // Task IDs
  files_planned?: string[];
  started?: string;
  completed?: string;
  claimed_at?: string;
  dispatched_to?: string;
  dispatched_at?: string;
  dispatched_by?: string;
  completion_summary?: string;
  rework_reason?: string;
  verification?: string;
  tags?: string[];
}
```

**Lifecycle:** `queued` → `ready` → `active` → `done`. Also: `blocked`, `needs-review`, `needs-rework`. Terminal: `done`, `not-planned`, `duplicate`.

### 3.4 Bug

```typescript
// src/lib/types/bug.ts

export interface Bug {
  id: string;              // BUG-{TSID13}
  slug: string;
  title: string;
  status: string;          // reported | triaged | reproduced | planned | in-progress | needs-review | verified | closed | cannot-reproduce | needs-rework | duplicate | not-planned
  estimate?: number;
  severity: string;        // low | medium | high | critical
  priority: string;        // low | medium | high | critical
  type: string;            // implementation-defect | specification-defect | design-problem
  reported_by: string;
  reported?: string;       // RFC 3339 timestamp
  observed: string;
  expected: string;
  affects?: string[];      // Entity IDs
  origin_feature?: string; // Feature ID
  origin_task?: string;    // Task ID
  environment?: string;
  reproduction?: string;
  duplicate_of?: string;   // Bug ID
  fixed_by?: string;
  verified_by?: string;
  release_target?: string;
  tags?: string[];
}
```

**Lifecycle:** `reported` → `triaged` → `reproduced` → `planned` → `in-progress` → `needs-review` → `verified` → `closed`. Also: `cannot-reproduce`, `needs-rework`. Terminal: `closed`, `duplicate`, `not-planned`.

### 3.5 Decision

```typescript
// src/lib/types/decision.ts

export interface Decision {
  id: string;              // DEC-{TSID13}
  slug: string;
  summary: string;
  rationale: string;
  decided_by: string;
  date?: string;           // RFC 3339 timestamp
  status: string;          // proposed | accepted | rejected | superseded
  affects?: string[];      // Entity IDs
  supersedes?: string;
  superseded_by?: string;
  tags?: string[];
}
```

**Lifecycle:** `proposed` → `accepted`. Terminal: `rejected`, `superseded`.

### 3.6 Knowledge Entry

```typescript
// src/lib/types/knowledge.ts

export interface KnowledgeEntry {
  id: string;              // KE-{TSID13}
  tier: number;            // 2 (project-level) or 3 (session-level)
  topic: string;           // normalised, lowercase, hyphenated
  scope: string;           // profile name or "project"
  content: string;
  learned_from?: string;   // provenance (task ID etc.)
  status: string;          // contributed | confirmed | disputed | retired
  use_count?: number;
  miss_count?: number;
  confidence?: number;     // 0.0–1.0
  ttl_days?: number;       // 30 (tier 3), 90 (tier 2), 0 (exempt)
  git_anchors?: string[];
  tags?: string[];
  created: string;
  created_by: string;
  updated: string;
}
```

**Lifecycle:** `contributed` → `confirmed` (auto: use_count ≥ 3, miss_count = 0) or → `disputed`. Terminal: `retired`.

### 3.7 Document Record

```typescript
// src/lib/types/document.ts

export interface DocumentRecord {
  id: string;              // {owner}/{type}-{slug} or PROJECT/{type}-{slug}
  path: string;            // relative to repo root
  type: string;            // design | specification | dev-plan | research | report | policy | rca
  title: string;
  status: string;          // draft | approved | superseded
  owner?: string;          // Plan or Feature ID
  approved_by?: string;
  approved_at?: string;
  content_hash?: string;   // SHA-256
  supersedes?: string;
  superseded_by?: string;
  created: string;
  created_by: string;
  updated: string;
}
```

**Filename encoding:** slashes in ID become `--` in the YAML filename. For example, `FEAT-01ABC/design-my-feature` is stored as `FEAT-01ABC--design-my-feature.yaml`.

### 3.8 Incident

```typescript
// src/lib/types/incident.ts

export interface Incident {
  id: string;              // INC-{TSID13}
  slug: string;
  title: string;
  status: string;          // reported | triaged | investigating | root-cause-identified | mitigated | resolved | closed
  severity: string;        // critical | high | medium | low
  reported_by: string;
  detected_at?: string;
  triaged_at?: string;
  mitigated_at?: string;
  resolved_at?: string;
  affected_features?: string[];  // Feature IDs
  linked_bugs?: string[];        // Bug IDs
  linked_rca?: string;           // DocumentRecord ID
  summary: string;
  created: string;
  created_by: string;
  updated: string;
}
```

**Lifecycle:** `reported` → `triaged` → `investigating` → `root-cause-identified` → `mitigated` → `resolved` → `closed`. Back-transitions allowed.

### 3.9 Human Checkpoint

```typescript
// src/lib/types/checkpoint.ts

export interface HumanCheckpoint {
  id: string;              // CHK-{TSID13}
  question: string;
  context: string;
  orchestration_summary: string;
  created_by: string;
  status: string;          // pending | responded
  response?: string;
  created: string;
  responded_at?: string;
}
```

### 3.10 Type Index

```typescript
// src/lib/types/index.ts

export type { Plan } from './plan';
export type { Feature } from './feature';
export type { Task } from './task';
export type { Bug } from './bug';
export type { Decision } from './decision';
export type { KnowledgeEntry } from './knowledge';
export type { DocumentRecord } from './document';
export type { Incident } from './incident';
export type { HumanCheckpoint } from './checkpoint';
export type { ProjectConfig, PrefixEntry, DocumentRoot } from './config';
```

---

## 4. Configuration Types

```typescript
// src/lib/types/config.ts

export interface ProjectConfig {
  version: string;           // Schema version (currently "2")
  schema_version?: string;   // Semver (from 1.0 onwards; absent = pre-1.0)
  prefixes: PrefixEntry[];
  documents?: {
    roots: DocumentRoot[];
  };
}

export interface PrefixEntry {
  prefix: string;            // Single character, e.g. "P"
  name: string;              // Human name, e.g. "Plan"
  retired?: boolean;
}

export interface DocumentRoot {
  path: string;              // e.g. "work/design"
  default_type: string;      // e.g. "design"
}
```

Parsing notes:
- `version` is always present and is a string (not a number)
- `schema_version` is absent in pre-1.0 projects — treat absence as pre-1.0 and parse best-effort
- `prefixes` may be empty on a fresh project
- `documents.roots` may be absent — default to no document roots

---

## 5. Zustand Store

### 5.1 ProjectState Interface

```typescript
// src/lib/store/project-store.ts

import { create } from 'zustand';

interface ProjectState {
  // Project root
  projectPath: string | null;
  config: ProjectConfig | null;

  // Entity maps (ID → entity)
  plans: Map<string, Plan>;
  features: Map<string, Feature>;
  tasks: Map<string, Task>;
  bugs: Map<string, Bug>;
  decisions: Map<string, Decision>;
  knowledge: Map<string, KnowledgeEntry>;
  documents: Map<string, DocumentRecord>;
  incidents: Map<string, Incident>;
  checkpoints: Map<string, HumanCheckpoint>;

  // Derived state (recomputed on entity change)
  tree: TreeNode[];
  pendingCheckpoints: HumanCheckpoint[];

  // Loading state
  loading: boolean;
  error: string | null;

  // Actions
  openProject: (path: string) => Promise<void>;
  reloadEntity: (entityType: EntityTypeName, filePath: string) => Promise<void>;
  closeProject: () => void;
}
```

### 5.2 TreeNode Interface

```typescript
export interface TreeNode {
  entity: Plan | Feature | Task;
  entityType: 'plan' | 'feature' | 'task';
  id: string;
  children: TreeNode[];
}
```

### 5.3 Store Implementation Sketch

```typescript
export const useProjectStore = create<ProjectState>((set, get) => ({
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

  openProject: async (path: string) => {
    set({ loading: true, error: null });
    try {
      const result = await loadProject(path);
      const tree = buildTree(result.plans, result.features, result.tasks);
      const pendingCheckpoints = [...result.checkpoints.values()]
        .filter((c) => c.status === 'pending');
      set({
        projectPath: path,
        ...result,
        tree,
        pendingCheckpoints,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  reloadEntity: async (entityType: EntityTypeName, filePath: string) => {
    // Parse single YAML file, update the appropriate map,
    // recompute tree and pendingCheckpoints.
    // Used by file watcher (F6) — stubbed here.
  },

  closeProject: () => {
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
    });
  },
}));
```

### 5.4 Derived State Recomputation

The `tree` and `pendingCheckpoints` fields are recomputed whenever entity maps change:

- **tree**: Recomputed by calling `buildTree()` after any change to plans, features, or tasks maps
- **pendingCheckpoints**: Filtered from `checkpoints` map where `status === 'pending'`

These are stored as plain values in the store (not selectors) because they need to be recomputed as a batch after loading, and the computation is cheap for the expected data sizes (hundreds of entities, not thousands).

---

## 6. Directory Reading Strategy

### 6.1 Loader Overview

The loader is responsible for the initial full read of a Kanbanzai project.

```typescript
// src/lib/reader/loader.ts

export interface LoadResult {
  config: ProjectConfig;
  plans: Map<string, Plan>;
  features: Map<string, Feature>;
  tasks: Map<string, Task>;
  bugs: Map<string, Bug>;
  decisions: Map<string, Decision>;
  knowledge: Map<string, KnowledgeEntry>;
  documents: Map<string, DocumentRecord>;
  incidents: Map<string, Incident>;
  checkpoints: Map<string, HumanCheckpoint>;
}

export async function loadProject(projectPath: string): Promise<LoadResult> { ... }
```

### 6.2 Load Sequence

`openProject(path)` executes the following steps in order:

1. **Read config** — read `{path}/.kbz/config.yaml`
   - If the file does not exist → throw error: `"Not a Kanbanzai project: .kbz/config.yaml not found"`
   - Parse with the `yaml` npm package
   - Validate that it has a `version` field (string)
   - Map to `ProjectConfig` interface

2. **Walk entity directories** — for each of the 9 entity subdirectories under `.kbz/state/`:
   - Attempt to list directory contents via `@tauri-apps/plugin-fs`
   - If the directory does not exist → silently skip (empty map for that entity type)
   - For each `.yaml` file found:
     - Read file contents
     - Parse YAML
     - Map to the corresponding TypeScript interface
     - Store in the entity map keyed by the entity's `id` field
     - On YAML parse error → log warning to console, skip that file

3. **Build derived state** — after all maps are populated:
   - Call `buildTree()` to construct the hierarchy
   - Filter pending checkpoints

### 6.3 Filename → Entity Type Mapping

The loader maps directories to entity types. The filename pattern determines how the entity ID relates to the filename, but the **authoritative ID always comes from the `id` field inside the YAML file**, not from the filename.

| Directory | Entity Type | Filename Pattern | ID Source |
|-----------|------------|------------------|-----------|
| `state/plans/` | Plan | `{id}.yaml` | `id` field in YAML |
| `state/features/` | Feature | `{id}-{slug}.yaml` | `id` field in YAML |
| `state/tasks/` | Task | `{id}-{slug}.yaml` | `id` field in YAML |
| `state/bugs/` | Bug | `{id}-{slug}.yaml` | `id` field in YAML |
| `state/decisions/` | Decision | `{id}-{slug}.yaml` | `id` field in YAML |
| `state/documents/` | DocumentRecord | `{id with / → --}.yaml` | `id` field in YAML |
| `state/knowledge/` | KnowledgeEntry | `{id}.yaml` | `id` field in YAML |
| `state/incidents/` | Incident | `{id}-{slug}.yaml` | `id` field in YAML |
| `state/checkpoints/` | HumanCheckpoint | `{id}.yaml` | `id` field in YAML |

The filename is used only for directory listing — the entity ID is always read from the parsed YAML content. This avoids fragile filename parsing, especially for DocumentRecord IDs which contain encoded slashes.

### 6.4 Directory Mapping Constant

```typescript
// Used internally by the loader

const ENTITY_DIRECTORIES: Array<{
  dir: string;
  key: keyof Omit<LoadResult, 'config'>;
}> = [
  { dir: 'plans',       key: 'plans' },
  { dir: 'features',    key: 'features' },
  { dir: 'tasks',       key: 'tasks' },
  { dir: 'bugs',        key: 'bugs' },
  { dir: 'decisions',   key: 'decisions' },
  { dir: 'documents',   key: 'documents' },
  { dir: 'knowledge',   key: 'knowledge' },
  { dir: 'incidents',   key: 'incidents' },
  { dir: 'checkpoints', key: 'checkpoints' },
];
```

### 6.5 YAML Parsing Details

- **Library:** `yaml` npm package (full YAML 1.2 support, TypeScript types)
- **Unknown fields:** silently ignored. The parsed object is spread into the typed interface — extra fields are harmless and provide forward compatibility with newer Kanbanzai schema versions
- **Missing optional fields:** absent in the parsed object, which matches the `?` optional type declarations
- **Type coercion:** none. If a field that should be a number arrives as a string, store it as-is. The viewer is read-only and should not crash on unexpected types
- **Empty files:** skip with a warning (no entity to store)

### 6.6 Loader Pseudocode

```typescript
export async function loadProject(projectPath: string): Promise<LoadResult> {
  const kbzPath = `${projectPath}/.kbz`;
  const statePath = `${kbzPath}/state`;

  // 1. Read and parse config
  const configYaml = await readTextFile(`${kbzPath}/config.yaml`);
  // Throws if file doesn't exist — caller shows error dialog
  const config = parseYaml(configYaml) as ProjectConfig;

  // 2. Walk entity directories
  const result: LoadResult = {
    config,
    plans: new Map(),
    features: new Map(),
    tasks: new Map(),
    bugs: new Map(),
    decisions: new Map(),
    knowledge: new Map(),
    documents: new Map(),
    incidents: new Map(),
    checkpoints: new Map(),
  };

  for (const { dir, key } of ENTITY_DIRECTORIES) {
    const dirPath = `${statePath}/${dir}`;

    let entries: string[];
    try {
      entries = await readDir(dirPath);
    } catch {
      // Directory doesn't exist — silently skip
      continue;
    }

    const yamlFiles = entries.filter((e) => e.endsWith('.yaml'));

    for (const filename of yamlFiles) {
      try {
        const content = await readTextFile(`${dirPath}/${filename}`);
        const parsed = parseYaml(content);
        if (parsed && typeof parsed === 'object' && 'id' in parsed) {
          (result[key] as Map<string, unknown>).set(parsed.id, parsed);
        } else {
          console.warn(`Skipping ${dir}/${filename}: no 'id' field found`);
        }
      } catch (err) {
        console.warn(`Failed to parse ${dir}/${filename}:`, err);
        // Skip this file, continue with others
      }
    }
  }

  return result;
}
```

### 6.7 File Access

All filesystem access uses `@tauri-apps/plugin-fs`:

- `readTextFile(path)` — reads a file as UTF-8 string
- `readDir(path)` — lists directory contents

These are async and run in the Tauri webview context with the `fs:allow-read-text-file` and `fs:allow-read-dir` capabilities granted by F1's Tauri configuration.

---

## 7. Entity Hierarchy

### 7.1 Tree Structure

The hierarchy is a strict three-level nesting:

```
Plan (top-level organising unit)
 └── Feature (deliverable, document-driven lifecycle)
      └── Task (atomic unit of work)
```

The remaining entity types are **standalone** — they appear in flat lists, not in the tree:

- **Bug** — cross-linked via `origin_feature` / `origin_task`
- **Decision** — cross-linked via `affects[]`
- **Incident** — cross-linked via `affected_features[]` / `linked_bugs[]`
- **DocumentRecord** — linked from `Plan.design`, `Feature.design`/`spec`/`dev_plan`
- **KnowledgeEntry** — scoped to role or project
- **HumanCheckpoint** — blocking questions, shown prominently when pending

### 7.2 Tree Builder

```typescript
// src/lib/query/tree.ts

export interface TreeNode {
  entity: Plan | Feature | Task;
  entityType: 'plan' | 'feature' | 'task';
  id: string;
  children: TreeNode[];
}

export function buildTree(
  plans: Map<string, Plan>,
  features: Map<string, Feature>,
  tasks: Map<string, Task>,
): TreeNode[] {
  // 1. Group features by parent (plan ID)
  // 2. Group tasks by parent_feature (feature ID)
  // 3. For each plan (sorted), create a TreeNode with feature children
  // 4. For each feature, attach its task children
  // 5. Return the sorted array of plan TreeNodes
}
```

### 7.3 Sorting Rules

- **Plans** sort by prefix character + number: `P1-...` before `P2-...` before `P3-...`. Extraction: split on `-`, parse the leading `P{n}` to get the numeric key
- **Features** sort lexicographically by ID. Since IDs use TSID13 (time-sortable), this produces chronological (creation-time) order
- **Tasks** within a feature sort lexicographically by ID (creation order). Topological sort on `depends_on` is a future enhancement
- **Standalone entity lists** (Bugs, Decisions, etc.) sort lexicographically by ID

### 7.4 Plan Sort Key Extraction

```typescript
function planSortKey(plan: Plan): [string, number] {
  // Plan IDs are P{n}-{slug}, e.g. "P1-kbzv", "P12-infra"
  const match = plan.id.match(/^([A-Z])(\d+)-/);
  if (!match) return [plan.id, 0]; // fallback: sort by raw ID
  return [match[1], parseInt(match[2], 10)];
}
```

### 7.5 Orphan Handling

- **Feature with unknown parent plan:** include in the tree under a synthetic "Orphaned" group, or append at the end of the tree. Do not discard the feature — it should remain accessible
- **Task with unknown parent_feature:** same approach — include in a standalone "Orphaned Tasks" section
- These situations arise from cross-file inconsistency during write bursts and are transient

---

## 8. Query Layer

### 8.1 Metrics

```typescript
// src/lib/query/metrics.ts

/** Terminal statuses excluded from the denominator */
const TASK_EXCLUDED_STATUSES = ['not-planned', 'duplicate'];
const FEATURE_EXCLUDED_STATUSES = ['cancelled', 'superseded'];

export interface CompletionMetrics {
  done: number;
  total: number;       // excludes terminal-excluded statuses
  percentage: number;  // 0–100, NaN if total is 0
}

export interface EstimateRollup {
  totalPoints: number;
  estimatedCount: number;
  unestimatedCount: number;
}
```

#### Task Completion by Feature

```typescript
export function taskCompletionForFeature(
  featureId: string,
  tasks: Map<string, Task>,
): CompletionMetrics {
  let done = 0;
  let total = 0;

  for (const task of tasks.values()) {
    if (task.parent_feature !== featureId) continue;
    if (TASK_EXCLUDED_STATUSES.includes(task.status)) continue;
    total++;
    if (task.status === 'done') done++;
  }

  return { done, total, percentage: total > 0 ? (done / total) * 100 : NaN };
}
```

#### Feature Completion by Plan

```typescript
export function featureCompletionForPlan(
  planId: string,
  features: Map<string, Feature>,
): CompletionMetrics {
  let done = 0;
  let total = 0;

  for (const feature of features.values()) {
    if (feature.parent !== planId) continue;
    if (FEATURE_EXCLUDED_STATUSES.includes(feature.status)) continue;
    total++;
    if (feature.status === 'done') done++;
  }

  return { done, total, percentage: total > 0 ? (done / total) * 100 : NaN };
}
```

#### Estimate Rollups

```typescript
export function estimateRollupForFeature(
  featureId: string,
  tasks: Map<string, Task>,
): EstimateRollup {
  let totalPoints = 0;
  let estimatedCount = 0;
  let unestimatedCount = 0;

  for (const task of tasks.values()) {
    if (task.parent_feature !== featureId) continue;
    if (TASK_EXCLUDED_STATUSES.includes(task.status)) continue;
    if (task.estimate != null) {
      totalPoints += task.estimate;
      estimatedCount++;
    } else {
      unestimatedCount++;
    }
  }

  return { totalPoints, estimatedCount, unestimatedCount };
}

export function estimateRollupForPlan(
  planId: string,
  features: Map<string, Feature>,
): EstimateRollup {
  let totalPoints = 0;
  let estimatedCount = 0;
  let unestimatedCount = 0;

  for (const feature of features.values()) {
    if (feature.parent !== planId) continue;
    if (FEATURE_EXCLUDED_STATUSES.includes(feature.status)) continue;
    if (feature.estimate != null) {
      totalPoints += feature.estimate;
      estimatedCount++;
    } else {
      unestimatedCount++;
    }
  }

  return { totalPoints, estimatedCount, unestimatedCount };
}
```

Key design rule: **entities without an estimate are shown as "unestimated" — they are never counted as zero.**

### 8.2 Reference Resolution

```typescript
// src/lib/query/references.ts

export type EntityTypeName =
  | 'plan'
  | 'feature'
  | 'task'
  | 'bug'
  | 'decision'
  | 'knowledge'
  | 'document'
  | 'incident'
  | 'checkpoint';

/**
 * Determines entity type from an ID string by examining its prefix.
 *
 * Prefix patterns:
 *   FEAT-   → feature
 *   TASK-   → task
 *   BUG-    → bug
 *   DEC-    → decision
 *   KE-     → knowledge
 *   INC-    → incident
 *   CHK-    → checkpoint
 *   {Letter}{Digit}+- → plan  (e.g. P1-, P12-)
 *   Contains "/"      → document (composite ID e.g. "FEAT-01ABC/design-my-feature")
 *
 * Returns null if the pattern doesn't match any known type.
 */
export function resolveEntityType(id: string): EntityTypeName | null {
  if (id.startsWith('FEAT-')) return 'feature';
  if (id.startsWith('TASK-')) return 'task';
  if (id.startsWith('BUG-'))  return 'bug';
  if (id.startsWith('DEC-'))  return 'decision';
  if (id.startsWith('KE-'))   return 'knowledge';
  if (id.startsWith('INC-'))  return 'incident';
  if (id.startsWith('CHK-'))  return 'checkpoint';
  if (id.includes('/'))        return 'document';
  if (/^[A-Z]\d+-/.test(id))  return 'plan';
  return null;
}
```

#### Entity Lookup

```typescript
/**
 * Look up an entity by ID across all maps.
 * Returns { entityType, entity } or null if not found.
 */
export function resolveEntity(
  id: string,
  state: ProjectState,
): { entityType: EntityTypeName; entity: unknown } | null {
  const type = resolveEntityType(id);
  if (!type) return null;

  const mapKey: Record<EntityTypeName, keyof ProjectState> = {
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

  const map = state[mapKey[type]] as Map<string, unknown>;
  const entity = map.get(id);
  return entity ? { entityType: type, entity } : null;
}
```

**Important:** `resolveEntityType` must check `id.includes('/')` for documents **before** the plan pattern match, because document IDs like `FEAT-01ABC/design-my-feature` would otherwise partially match the plan regex. The order in the implementation above is already correct — prefix-based patterns are checked first, then `/` for documents, then the plan fallback pattern.

---

## 9. Constants

### 9.1 Status Colours

```typescript
// src/lib/constants/status-colours.ts

export const STATUS_COLOURS = {
  grey:   '#9CA3AF',
  blue:   '#3B82F6',
  yellow: '#EAB308',
  orange: '#F97316',
  green:  '#22C55E',
  red:    '#EF4444',
  purple: '#A855F7',
} as const;

export type StatusColourName = keyof typeof STATUS_COLOURS;

const STATUS_TO_COLOUR: Record<string, StatusColourName> = {
  // Grey — initial / waiting
  proposed:          'grey',
  queued:            'grey',
  draft:             'grey',

  // Blue — planning / preparation
  designing:         'blue',
  specifying:        'blue',
  'dev-planning':    'blue',
  ready:             'blue',
  planned:           'blue',
  contributed:       'blue',

  // Yellow — active work
  active:            'yellow',
  'in-progress':     'yellow',
  investigating:     'yellow',
  developing:        'yellow',

  // Orange — blocked / needs attention
  blocked:           'orange',
  'needs-review':    'orange',
  'needs-rework':    'orange',
  disputed:          'orange',
  pending:           'orange',

  // Green — done / success
  done:              'green',
  closed:            'green',
  verified:          'green',
  approved:          'green',
  accepted:          'green',
  confirmed:         'green',
  resolved:          'green',

  // Red — cancelled / terminal-negative
  cancelled:         'red',
  'not-planned':     'red',
  rejected:          'red',
  duplicate:         'red',
  retired:           'red',
  'cannot-reproduce':'red',

  // Purple — superseded
  superseded:        'purple',
};

/**
 * Returns the colour name for a given status string.
 * Unknown statuses return 'grey' — the viewer never fails on
 * unrecognised status values.
 */
export function getStatusColour(status: string): StatusColourName {
  return STATUS_TO_COLOUR[status] ?? 'grey';
}

/**
 * Returns the hex colour code for a given status string.
 */
export function getStatusHex(status: string): string {
  return STATUS_COLOURS[getStatusColour(status)];
}
```

### 9.2 Entity Type Metadata

```typescript
// src/lib/constants/entity-types.ts

export interface EntityTypeInfo {
  type: EntityTypeName;
  label: string;          // Human-readable, e.g. "Feature"
  labelPlural: string;    // e.g. "Features"
  directory: string;      // state/ subdirectory name
  icon: string;           // Lucide icon name
}

export const ENTITY_TYPES: Record<EntityTypeName, EntityTypeInfo> = {
  plan: {
    type: 'plan',
    label: 'Plan',
    labelPlural: 'Plans',
    directory: 'plans',
    icon: 'Map',
  },
  feature: {
    type: 'feature',
    label: 'Feature',
    labelPlural: 'Features',
    directory: 'features',
    icon: 'Layers',
  },
  task: {
    type: 'task',
    label: 'Task',
    labelPlural: 'Tasks',
    directory: 'tasks',
    icon: 'CheckSquare',
  },
  bug: {
    type: 'bug',
    label: 'Bug',
    labelPlural: 'Bugs',
    directory: 'bugs',
    icon: 'Bug',
  },
  decision: {
    type: 'decision',
    label: 'Decision',
    labelPlural: 'Decisions',
    directory: 'decisions',
    icon: 'Scale',
  },
  knowledge: {
    type: 'knowledge',
    label: 'Knowledge Entry',
    labelPlural: 'Knowledge Entries',
    directory: 'knowledge',
    icon: 'BookOpen',
  },
  document: {
    type: 'document',
    label: 'Document',
    labelPlural: 'Documents',
    directory: 'documents',
    icon: 'FileText',
  },
  incident: {
    type: 'incident',
    label: 'Incident',
    labelPlural: 'Incidents',
    directory: 'incidents',
    icon: 'AlertTriangle',
  },
  checkpoint: {
    type: 'checkpoint',
    label: 'Checkpoint',
    labelPlural: 'Checkpoints',
    directory: 'checkpoints',
    icon: 'HelpCircle',
  },
};
```

---

## 10. Error Handling

### 10.1 Principles

The viewer must be resilient. It reads data produced by another tool and must handle every flavour of incomplete, evolving, or broken state:

1. **Never fail on unknown enum values** — display the raw string with grey colour
2. **Handle missing fields** — absent means "not set", render as empty/hidden
3. **Handle broken references** — a reference to a non-existent entity is not an error
4. **Handle missing files** — `DocumentRecord.path` may point to a deleted file
5. **Handle missing directories** — a project may not have bugs, incidents, etc.
6. **Never crash** — every error is catchable; the worst case is a console warning and a skipped entity

### 10.2 Specific Error Cases

| Scenario | Behaviour |
|----------|-----------|
| `.kbz/config.yaml` missing | `openProject` throws → store sets `error` → UI shows error dialog: "Not a Kanbanzai project" |
| `.kbz/config.yaml` unparseable | Same as above: throw with descriptive message |
| `state/` directory missing | Treat as empty project — all entity maps remain empty. This is valid for a newly initialised project |
| Entity subdirectory missing (e.g. no `state/bugs/`) | Silently skip — that entity map stays empty |
| YAML parse error in a single entity file | `console.warn` with filename and error, skip that file, continue loading all others |
| YAML file has no `id` field | `console.warn`, skip file |
| Unknown fields in YAML (e.g. new schema adds a field) | Silently ignored — spread into the typed interface, extra fields are harmless. This provides forward compatibility |
| Unknown status value (e.g. future lifecycle state) | Store as-is (it's a `string`). `getStatusColour()` returns `'grey'`. UI displays the raw string |
| Broken cross-reference (e.g. `parent` points to non-existent plan) | `resolveEntity()` returns `null` — caller renders a "not found" indicator |
| `schema_version` field absent in config | Treat as pre-1.0 project — parse best-effort with no special handling |
| Empty YAML file (0 bytes or whitespace only) | `console.warn`, skip file |
| Circular references (e.g. mutual `supersedes`) | Not detected or prevented — the viewer renders links as-is. No infinite recursion risk because the tree is built from the hierarchy (Plan→Feature→Task), not from arbitrary reference chains |

### 10.3 Error Logging

All non-fatal errors are logged via `console.warn` with a structured format:

```
[kbzv] Skipping state/bugs/BUG-01ABC-broken.yaml: YAML parse error at line 5
[kbzv] Skipping state/tasks/TASK-01XYZ-empty.yaml: no 'id' field found
```

The `[kbzv]` prefix makes it easy to filter in the Tauri devtools console.

---

## 11. Acceptance Criteria

1. **Entity map population** — Opening a project populates all 9 entity maps with correctly typed data. Each entity is keyed by its `id` field. All fields from the YAML are preserved in the TypeScript objects.

2. **Tree hierarchy** — `buildTree()` correctly nests Features under their parent Plan and Tasks under their parent Feature. Plans are sorted by prefix+number. Features and Tasks are sorted lexicographically by ID.

3. **Standalone lists** — Bugs, Decisions, Incidents, DocumentRecords, KnowledgeEntries, and HumanCheckpoints are accessible as flat maps from the store.

4. **Pending checkpoints** — Checkpoints with `status === 'pending'` are surfaced in the `pendingCheckpoints` derived array.

5. **Metrics correctness** — Task completion % correctly counts `done` tasks against total (excluding `not-planned` and `duplicate`). Feature completion % correctly counts `done` features against total (excluding `cancelled` and `superseded`). Estimate rollups sum only entities that have an `estimate` value and correctly report unestimated count.

6. **Reference resolution** — `resolveEntityType()` correctly identifies entity type from ID prefix for all 9 types. `resolveEntity()` returns the entity from the correct map, or `null` for unknown IDs.

7. **Config parsing** — `ProjectConfig` correctly reads `version`, `schema_version`, `prefixes`, and `documents.roots` from `.kbz/config.yaml`.

8. **Missing directory resilience** — Missing entity directories are silently skipped with no error.

9. **Parse error resilience** — An unparseable YAML file logs a warning and is skipped; all other files in the same directory are still loaded.

10. **Unknown field resilience** — YAML files with fields not in the TypeScript interface are parsed without error; extra fields are silently ignored.

11. **Unknown status resilience** — Unrecognised status strings are stored and rendered with grey colour; the app does not crash.

12. **Status colours** — `getStatusColour()` returns the correct colour for all mapped statuses and `'grey'` for any unknown status.

---

## 12. Dependencies

This feature uses the following packages (all established in F1: App Scaffold):

| Package | Purpose |
|---------|---------|
| `zustand` | State management — entity maps, derived state, actions |
| `yaml` | YAML 1.2 parsing — all `.kbz/state/` entity files and config |
| `@tauri-apps/plugin-fs` | File system access — `readTextFile`, `readDir` |

No new dependencies are introduced by this feature.

---

## References

- [KBZV Architecture Design](kbzv-architecture.md) — §3 Architecture, §4 Data Model, §5 Directory Reading, §6.5 Status Colours, §6.10 Progress Metrics, §7.1 Cross-Reference Links, §8 Error Handling
- Feature entity: `FEAT-01KMZA9CP9XEX` (data-layer)
- Parent plan: `P1-kbzv`
- Depends on: `FEAT-01KMZA96W1J98` (F1: App Scaffold + Theme)