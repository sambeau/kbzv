# F2: Data Layer — Development Plan

| Field | Value |
|-------|-------|
| **Feature** | FEAT-01KMZA9CP9XEX |
| **Parent Plan** | P1-kbzv |
| **Depends On** | FEAT-01KMZA96W1J98 (F1: App Scaffold + Theme) |
| **Type** | Development Plan |
| **Author** | sambeau |

---

## Overview

Feature 2 delivers the complete data layer for KBZV — no UI changes. After this feature, the application can open a Kanbanzai project directory, parse all `.kbz/state/` YAML files into typed in-memory entity maps, build the Plan→Feature→Task hierarchy tree, compute progress metrics, resolve cross-references by ID prefix, and expose everything through a Zustand store.

The work is split into **9 tasks** ordered by dependency. Tasks 1–2 are pure type/constant definitions. Tasks 3–7 build runtime modules (loader, store, queries). Task 8 wires the data layer to the F1 UI shell. Task 9 creates integration tests with fixture data. Each task is independently verifiable.

**Source documents:**
- [F2 Specification](../spec/f2-data-layer-spec.md) — requirements and complete code
- [F2 Design Document](../design/f2-data-layer.md) — background context and rationale

---

## Task Dependency Graph

```
T1: Entity Type Definitions ──┐
                               ├── T3: YAML Loader ──┐
T2: Constants ─────────────────┤                      ├── T4: Zustand Project Store ── T8: Wire to UI
                               ├── T5: Tree Builder ──┘
                               ├── T6: Metrics
                               └── T7: Reference Resolution
                                                                                       T9: Integration Testing
                                                                                       (depends on T1–T8)
```

| Task | Depends On | Estimated Effort |
|------|-----------|-----------------|
| T1: Entity Type Definitions | — | 2 pts |
| T2: Constants | T1 | 1 pt |
| T3: YAML Loader | T1 | 3 pts |
| T4: Zustand Project Store | T1, T3, T5 | 3 pts |
| T5: Tree Builder | T1 | 3 pts |
| T6: Metrics | T1 | 2 pts |
| T7: Reference Resolution | T1, T4 | 2 pts |
| T8: Wire to UI | T4 | 2 pts |
| T9: Integration Testing | T1–T8 | 3 pts |
| **Total** | | **21 pts** |

**Parallelism opportunities:** After T1 completes, T2/T3/T5/T6 can all proceed in parallel. T7 needs T4's interface but not its runtime. T8 and T9 are sequential at the end.

---

## Tasks

### Task 1: Entity Type Definitions

**What to do:** Create all 9 entity type interfaces, the config types, and the barrel index with union types. These are pure TypeScript declarations — no runtime code, no external dependencies.

**Files created (11 files):**

| # | Path | Contents |
|---|------|----------|
| 1 | `src/lib/types/plan.ts` | `Plan` interface |
| 2 | `src/lib/types/feature.ts` | `Feature` interface |
| 3 | `src/lib/types/task.ts` | `Task` interface |
| 4 | `src/lib/types/bug.ts` | `Bug` interface |
| 5 | `src/lib/types/decision.ts` | `Decision` interface |
| 6 | `src/lib/types/knowledge.ts` | `KnowledgeEntry` interface |
| 7 | `src/lib/types/document.ts` | `DocumentRecord` interface |
| 8 | `src/lib/types/incident.ts` | `Incident` interface |
| 9 | `src/lib/types/checkpoint.ts` | `HumanCheckpoint` interface |
| 10 | `src/lib/types/config.ts` | `ProjectConfig`, `PrefixEntry`, `DocumentRoot` interfaces |
| 11 | `src/lib/types/index.ts` | Barrel re-exports + `TreeEntity`, `TreeEntityTypeName`, `EntityTypeName`, `AnyEntity` union types |

**Dependencies:** None.

**Implementation:**

```typescript
// src/lib/types/plan.ts

/**
 * A Plan is the top-level organising unit in a Kanbanzai project.
 * Plans own Features, which in turn own Tasks.
 *
 * ID format: P{n}-{slug} — e.g. "P1-kbzv", "P12-infra"
 *
 * Lifecycle: proposed → designing → active → done
 * From any non-terminal state: → superseded, → cancelled
 */
export interface Plan {
  /** Plan identifier. Format: P{n}-{slug}. Example: "P1-kbzv" */
  id: string;

  /** URL-friendly identifier. Example: "kbzv" */
  slug: string;

  /** Human-readable title. Example: "Kanbanzai Viewer" */
  title: string;

  /** Lifecycle status. Known values: proposed, designing, active, done, superseded, cancelled */
  status: string;

  /** Brief description of the plan's purpose */
  summary: string;

  /** DocumentRecord ID referencing the plan's design document */
  design?: string;

  /** Classification tags */
  tags?: string[];

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Identity of the creator */
  created_by: string;

  /** Last-modified timestamp, RFC 3339 UTC */
  updated: string;

  /** ID of the plan this one replaces */
  supersedes?: string;

  /** ID of the plan that replaced this one */
  superseded_by?: string;
}
```

```typescript
// src/lib/types/feature.ts

/**
 * A Feature is a deliverable unit of work within a Plan.
 * Features own Tasks and follow a document-driven lifecycle.
 *
 * ID format: FEAT-{TSID13} — e.g. "FEAT-01KMZA9CP9XEX"
 *
 * Lifecycle: proposed → designing → specifying → dev-planning → developing → done
 * From any non-terminal state: → superseded, → cancelled
 */
export interface Feature {
  /** Feature identifier. Format: FEAT-{TSID13} */
  id: string;

  /** URL-friendly identifier */
  slug: string;

  /** Parent Plan ID. Example: "P1-kbzv" */
  parent: string;

  /** Lifecycle status. Known values: proposed, designing, specifying, dev-planning, developing, done, superseded, cancelled */
  status: string;

  /** Story point estimate on Modified Fibonacci scale (0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100) */
  estimate?: number;

  /** Brief description of the feature */
  summary: string;

  /** DocumentRecord ID — design document */
  design?: string;

  /** DocumentRecord ID — specification document */
  spec?: string;

  /** DocumentRecord ID — development plan document */
  dev_plan?: string;

  /** Classification tags */
  tags?: string[];

  /** Denormalised list of child Task IDs */
  tasks?: string[];

  /** Decision IDs linked to this feature */
  decisions?: string[];

  /** Git branch name for this feature's work */
  branch?: string;

  /** ID of the feature this one replaces */
  supersedes?: string;

  /** ID of the feature that replaced this one */
  superseded_by?: string;

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Identity of the creator */
  created_by: string;

  /** Last-modified timestamp, RFC 3339 UTC */
  updated: string;
}
```

```typescript
// src/lib/types/task.ts

/**
 * A Task is an atomic unit of work within a Feature.
 *
 * ID format: TASK-{TSID13} — e.g. "TASK-01KMZA9XXXYYY"
 *
 * Lifecycle: queued → ready → active → done
 * Also: blocked, needs-review, needs-rework
 * Terminal: done, not-planned, duplicate
 */
export interface Task {
  /** Task identifier. Format: TASK-{TSID13} */
  id: string;

  /** Parent Feature ID. Format: FEAT-{TSID13} */
  parent_feature: string;

  /** URL-friendly identifier */
  slug: string;

  /** Brief description of the task */
  summary: string;

  /** Lifecycle status. Known values: queued, ready, active, done, blocked, needs-review, needs-rework, not-planned, duplicate */
  status: string;

  /** Story point estimate on Modified Fibonacci scale */
  estimate?: number;

  /** Who is assigned to this task */
  assignee?: string;

  /** Task IDs this task depends on */
  depends_on?: string[];

  /** Files expected to be modified */
  files_planned?: string[];

  /** Timestamp when work started, RFC 3339 UTC */
  started?: string;

  /** Timestamp when work completed, RFC 3339 UTC */
  completed?: string;

  /** Timestamp when the task was claimed, RFC 3339 UTC */
  claimed_at?: string;

  /** Identity of the agent the task was dispatched to */
  dispatched_to?: string;

  /** Timestamp when the task was dispatched, RFC 3339 UTC */
  dispatched_at?: string;

  /** Identity of who dispatched the task */
  dispatched_by?: string;

  /** Summary of what was accomplished on completion */
  completion_summary?: string;

  /** Reason the task needs rework */
  rework_reason?: string;

  /** Description of testing/verification performed */
  verification?: string;

  /** Classification tags */
  tags?: string[];
}
```

```typescript
// src/lib/types/bug.ts

/**
 * A Bug tracks a defect discovered in the project.
 * Standalone entity — cross-linked via origin_feature / origin_task / affects.
 *
 * ID format: BUG-{TSID13}
 *
 * Lifecycle: reported → triaged → reproduced → planned → in-progress → needs-review → verified → closed
 * Also: cannot-reproduce, needs-rework
 * Terminal: closed, duplicate, not-planned
 */
export interface Bug {
  /** Bug identifier. Format: BUG-{TSID13} */
  id: string;

  /** URL-friendly identifier */
  slug: string;

  /** Human-readable title */
  title: string;

  /** Lifecycle status */
  status: string;

  /** Story point estimate on Modified Fibonacci scale */
  estimate?: number;

  /** Severity level. Known values: low, medium, high, critical */
  severity: string;

  /** Priority level. Known values: low, medium, high, critical */
  priority: string;

  /** Bug classification. Known values: implementation-defect, specification-defect, design-problem */
  type: string;

  /** Identity of who reported the bug */
  reported_by: string;

  /** Timestamp when the bug was reported, RFC 3339 UTC */
  reported?: string;

  /** Description of the observed (incorrect) behaviour */
  observed: string;

  /** Description of the expected (correct) behaviour */
  expected: string;

  /** Entity IDs affected by this bug */
  affects?: string[];

  /** Feature ID where the bug originated */
  origin_feature?: string;

  /** Task ID where the bug originated */
  origin_task?: string;

  /** Environment description (OS, version, etc.) */
  environment?: string;

  /** Steps to reproduce the bug */
  reproduction?: string;

  /** Bug ID this is a duplicate of */
  duplicate_of?: string;

  /** Reference to the fix (e.g. commit, PR) */
  fixed_by?: string;

  /** Identity of who verified the fix */
  verified_by?: string;

  /** Target release for the fix */
  release_target?: string;

  /** Classification tags */
  tags?: string[];
}
```

```typescript
// src/lib/types/decision.ts

/**
 * A Decision records an architectural or design choice.
 * Standalone entity — cross-linked via affects[].
 *
 * ID format: DEC-{TSID13}
 *
 * Lifecycle: proposed → accepted
 * Terminal: rejected, superseded
 */
export interface Decision {
  /** Decision identifier. Format: DEC-{TSID13} */
  id: string;

  /** URL-friendly identifier */
  slug: string;

  /** Brief description of the decision */
  summary: string;

  /** Explanation of why this decision was made */
  rationale: string;

  /** Identity of the decision maker */
  decided_by: string;

  /** Date the decision was made, RFC 3339 UTC */
  date?: string;

  /** Lifecycle status. Known values: proposed, accepted, rejected, superseded */
  status: string;

  /** Entity IDs affected by this decision */
  affects?: string[];

  /** ID of the decision this one replaces */
  supersedes?: string;

  /** ID of the decision that replaced this one */
  superseded_by?: string;

  /** Classification tags */
  tags?: string[];
}
```

```typescript
// src/lib/types/knowledge.ts

/**
 * A KnowledgeEntry captures a learned fact or convention.
 * Standalone entity — scoped to a role profile or "project".
 *
 * ID format: KE-{TSID13}
 *
 * Lifecycle: contributed → confirmed (auto: use_count ≥ 3, miss_count = 0) or → disputed
 * Terminal: retired
 */
export interface KnowledgeEntry {
  /** Knowledge entry identifier. Format: KE-{TSID13} */
  id: string;

  /** Knowledge tier. 2 = project-level, 3 = session-level */
  tier: number;

  /** Topic identifier — normalised, lowercase, hyphenated */
  topic: string;

  /** Scope — a role profile name (e.g. "backend") or "project" */
  scope: string;

  /** The knowledge content — concise, actionable statement */
  content: string;

  /** Provenance — Task ID or other reference where this was learned */
  learned_from?: string;

  /** Lifecycle status. Known values: contributed, confirmed, disputed, retired */
  status: string;

  /** Number of times this knowledge entry was used */
  use_count?: number;

  /** Number of times this knowledge entry was missed */
  miss_count?: number;

  /** Confidence score, 0.0–1.0 */
  confidence?: number;

  /** Time-to-live in days. 30 (tier 3), 90 (tier 2), 0 (exempt) */
  ttl_days?: number;

  /** Git file paths anchoring this knowledge to source code */
  git_anchors?: string[];

  /** Classification tags */
  tags?: string[];

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Identity of the creator */
  created_by: string;

  /** Last-modified timestamp, RFC 3339 UTC */
  updated: string;
}
```

```typescript
// src/lib/types/document.ts

/**
 * A DocumentRecord tracks a managed document (design, spec, plan, etc.).
 * Linked from Plan.design, Feature.design / spec / dev_plan.
 *
 * ID format: {owner}/{type}-{slug} or PROJECT/{type}-{slug}
 * Example: "FEAT-01ABC/design-my-feature"
 *
 * Filename encoding: slashes in ID become "--" in the YAML filename.
 *
 * Lifecycle: draft → approved
 * Terminal: superseded
 */
export interface DocumentRecord {
  /** Document record identifier. Format: {owner}/{type}-{slug} */
  id: string;

  /** Path to the document file, relative to the repository root */
  path: string;

  /** Document type. Known values: design, specification, dev-plan, research, report, policy, rca */
  type: string;

  /** Human-readable title */
  title: string;

  /** Lifecycle status. Known values: draft, approved, superseded */
  status: string;

  /** Owning entity — Plan ID or Feature ID */
  owner?: string;

  /** Identity of who approved this document */
  approved_by?: string;

  /** Timestamp when the document was approved, RFC 3339 UTC */
  approved_at?: string;

  /** SHA-256 hash of the document content */
  content_hash?: string;

  /** ID of the document this one replaces */
  supersedes?: string;

  /** ID of the document that replaced this one */
  superseded_by?: string;

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Identity of the creator */
  created_by: string;

  /** Last-modified timestamp, RFC 3339 UTC */
  updated: string;
}
```

```typescript
// src/lib/types/incident.ts

/**
 * An Incident tracks a production or development incident.
 * Standalone entity — cross-linked via affected_features[] and linked_bugs[].
 *
 * ID format: INC-{TSID13}
 *
 * Lifecycle: reported → triaged → investigating → root-cause-identified → mitigated → resolved → closed
 */
export interface Incident {
  /** Incident identifier. Format: INC-{TSID13} */
  id: string;

  /** URL-friendly identifier */
  slug: string;

  /** Human-readable title */
  title: string;

  /** Lifecycle status */
  status: string;

  /** Severity level. Known values: critical, high, medium, low */
  severity: string;

  /** Identity of who reported the incident */
  reported_by: string;

  /** Timestamp when the incident was detected, RFC 3339 UTC */
  detected_at?: string;

  /** Timestamp when the incident was triaged, RFC 3339 UTC */
  triaged_at?: string;

  /** Timestamp when the incident was mitigated, RFC 3339 UTC */
  mitigated_at?: string;

  /** Timestamp when the incident was resolved, RFC 3339 UTC */
  resolved_at?: string;

  /** Feature IDs affected by this incident */
  affected_features?: string[];

  /** Bug IDs linked to this incident */
  linked_bugs?: string[];

  /** DocumentRecord ID of the root cause analysis */
  linked_rca?: string;

  /** Brief description of the incident */
  summary: string;

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Identity of the creator */
  created_by: string;

  /** Last-modified timestamp, RFC 3339 UTC */
  updated: string;
}
```

```typescript
// src/lib/types/checkpoint.ts

/**
 * A HumanCheckpoint records a decision point that required human input.
 * Standalone entity — shown prominently in the UI when status is "pending".
 *
 * ID format: CHK-{TSID13}
 *
 * Lifecycle: pending → responded (terminal)
 */
export interface HumanCheckpoint {
  /** Checkpoint identifier. Format: CHK-{TSID13} */
  id: string;

  /** The question or decision requiring human input */
  question: string;

  /** Background information to help the human answer */
  context: string;

  /** Brief state of the orchestration session at checkpoint time */
  orchestration_summary: string;

  /** Identity of the orchestrating agent that created this checkpoint */
  created_by: string;

  /** Lifecycle status. Known values: pending, responded */
  status: string;

  /** The human's answer or decision (present only when status is "responded") */
  response?: string;

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Timestamp when the human responded, RFC 3339 UTC */
  responded_at?: string;
}
```

```typescript
// src/lib/types/config.ts

/**
 * Project configuration, parsed from .kbz/config.yaml.
 *
 * Parsing rules:
 * - `version` is always present and is a string (not a number), currently "2"
 * - `schema_version` is absent in pre-1.0 projects — treat absence as pre-1.0, parse best-effort
 * - `prefixes` may be empty on a fresh project
 * - `documents.roots` may be absent — default to no document roots
 */
export interface ProjectConfig {
  /** Schema version string. Currently "2". Always present. */
  version: string;

  /**
   * Semver schema version. Present from kanbanzai 1.0 onwards.
   * Absent in pre-1.0 projects — treat absence as pre-1.0.
   */
  schema_version?: string;

  /** Plan prefix registry. May be empty on a fresh project. */
  prefixes: PrefixEntry[];

  /** Document root configuration. May be absent. */
  documents?: {
    roots: DocumentRoot[];
  };
}

/**
 * A single plan prefix entry from the config.
 */
export interface PrefixEntry {
  /** Single uppercase character used as the plan prefix, e.g. "P" */
  prefix: string;

  /** Human-readable name for this prefix, e.g. "Plan" */
  name: string;

  /** Whether this prefix is retired and should not be used for new plans */
  retired?: boolean;
}

/**
 * A document root directory configured for the project.
 */
export interface DocumentRoot {
  /** Directory path relative to the repository root, e.g. "work/design" */
  path: string;

  /** Default document type for files in this root, e.g. "design" */
  default_type: string;
}
```

```typescript
// src/lib/types/index.ts

// ── Entity type re-exports ──────────────────────────────────────────
export type { Plan } from './plan';
export type { Feature } from './feature';
export type { Task } from './task';
export type { Bug } from './bug';
export type { Decision } from './decision';
export type { KnowledgeEntry } from './knowledge';
export type { DocumentRecord } from './document';
export type { Incident } from './incident';
export type { HumanCheckpoint } from './checkpoint';

// ── Config re-exports ───────────────────────────────────────────────
export type { ProjectConfig, PrefixEntry, DocumentRoot } from './config';

// ── Union types ─────────────────────────────────────────────────────

import type { Plan } from './plan';
import type { Feature } from './feature';
import type { Task } from './task';
import type { Bug } from './bug';
import type { Decision } from './decision';
import type { KnowledgeEntry } from './knowledge';
import type { DocumentRecord } from './document';
import type { Incident } from './incident';
import type { HumanCheckpoint } from './checkpoint';

/**
 * Discriminated union of all entity types that appear in the Plan→Feature→Task tree.
 */
export type TreeEntity = Plan | Feature | Task;

/**
 * The type name for the 'entityType' field in TreeNode.
 */
export type TreeEntityTypeName = 'plan' | 'feature' | 'task';

/**
 * All nine entity type names used throughout the application.
 */
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
 * Union of all entity interfaces. Useful for generic entity rendering.
 */
export type AnyEntity =
  | Plan
  | Feature
  | Task
  | Bug
  | Decision
  | KnowledgeEntry
  | DocumentRecord
  | Incident
  | HumanCheckpoint;
```

**Verification:**

1. Run `pnpm tsc --noEmit` — all 11 files must compile with zero errors
2. Confirm every interface has an `id: string` field
3. Confirm all optional fields use `?`
4. Confirm `EntityTypeName` has exactly 9 members
5. Confirm `index.ts` re-exports all 9 entity types + 3 config types

**Estimated effort:** 2 points

---

### Task 2: Constants

**What to do:** Create the status colour palette/mapping and the entity type metadata constant. These are pure runtime data with no side effects.

**Files created (2 files):**

| # | Path | Contents |
|---|------|----------|
| 1 | `src/lib/constants/status-colours.ts` | `STATUS_COLOURS`, `STATUS_TO_COLOUR`, `getStatusColour()`, `getStatusHex()` |
| 2 | `src/lib/constants/entity-types.ts` | `EntityTypeInfo` interface, `ENTITY_TYPES` record |

**Dependencies:** T1 (imports `EntityTypeName` from types index).

**Implementation:**

```typescript
// src/lib/constants/status-colours.ts

// ── Colour Palette ──────────────────────────────────────────────────

/**
 * The seven named colours used for status display.
 * Values are Tailwind CSS 500 shades.
 */
export const STATUS_COLOURS = {
  grey:   '#9CA3AF',  // Gray-400 — initial / waiting
  blue:   '#3B82F6',  // Blue-500 — planning / preparation
  yellow: '#EAB308',  // Yellow-500 — active work
  orange: '#F97316',  // Orange-500 — blocked / needs attention
  green:  '#22C55E',  // Green-500 — done / success
  red:    '#EF4444',  // Red-500 — cancelled / terminal-negative
  purple: '#A855F7',  // Purple-500 — superseded
} as const;

/**
 * The name of a colour in the STATUS_COLOURS palette.
 */
export type StatusColourName = keyof typeof STATUS_COLOURS;

// ── Status → Colour Mapping ─────────────────────────────────────────

/**
 * Complete mapping of every known status string to its colour name.
 * Typed as Record<string, StatusColourName> so that new statuses can be added
 * without a type error. Unknown statuses are handled by the fallback in
 * getStatusColour().
 */
const STATUS_TO_COLOUR: Record<string, StatusColourName> = {
  // ── Grey — initial / waiting ──────────────────────────────────────
  'proposed':           'grey',
  'queued':             'grey',
  'draft':              'grey',
  'reported':           'grey',

  // ── Blue — planning / preparation ─────────────────────────────────
  'designing':          'blue',
  'specifying':         'blue',
  'dev-planning':       'blue',
  'ready':              'blue',
  'planned':            'blue',
  'contributed':        'blue',
  'triaged':            'blue',
  'reproduced':         'blue',

  // ── Yellow — active work ──────────────────────────────────────────
  'active':             'yellow',
  'in-progress':        'yellow',
  'investigating':      'yellow',
  'developing':         'yellow',
  'root-cause-identified': 'yellow',

  // ── Orange — blocked / needs attention ────────────────────────────
  'blocked':            'orange',
  'needs-review':       'orange',
  'needs-rework':       'orange',
  'disputed':           'orange',
  'pending':            'orange',
  'mitigated':          'orange',

  // ── Green — done / success ────────────────────────────────────────
  'done':               'green',
  'closed':             'green',
  'verified':           'green',
  'approved':           'green',
  'accepted':           'green',
  'confirmed':          'green',
  'resolved':           'green',
  'responded':          'green',

  // ── Red — cancelled / terminal-negative ───────────────────────────
  'cancelled':          'red',
  'not-planned':        'red',
  'rejected':           'red',
  'duplicate':          'red',
  'retired':            'red',
  'cannot-reproduce':   'red',

  // ── Purple — superseded ───────────────────────────────────────────
  'superseded':         'purple',
};

// ── Lookup Functions ────────────────────────────────────────────────

/**
 * Returns the colour name for a given status string.
 * Returns 'grey' for unknown/unrecognised statuses.
 */
export function getStatusColour(status: string): StatusColourName {
  return STATUS_TO_COLOUR[status] ?? 'grey';
}

/**
 * Returns the hex colour code for a given status string.
 * Returns '#9CA3AF' (grey) for unknown statuses.
 */
export function getStatusHex(status: string): string {
  return STATUS_COLOURS[getStatusColour(status)];
}
```

```typescript
// src/lib/constants/entity-types.ts

import type { EntityTypeName } from '../types';

/**
 * Metadata for an entity type — used for UI rendering (labels, icons)
 * and for the directory reader (mapping subdirectories to types).
 */
export interface EntityTypeInfo {
  /** Machine identifier, matches EntityTypeName */
  type: EntityTypeName;

  /** Singular human-readable label, e.g. "Feature" */
  label: string;

  /** Plural human-readable label, e.g. "Features" */
  labelPlural: string;

  /** Subdirectory name under .kbz/state/, e.g. "features" */
  directory: string;

  /**
   * Lucide icon component name (PascalCase).
   * Import from lucide-react at the usage site.
   */
  icon: string;
}

/**
 * Complete metadata record for all nine entity types.
 * Keyed by EntityTypeName for O(1) lookup.
 */
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

**Verification:**

1. `pnpm tsc --noEmit` — zero errors
2. Spot-check: `getStatusColour('active')` returns `'yellow'`, `getStatusColour('xyz')` returns `'grey'`
3. Spot-check: `getStatusHex('done')` returns `'#22C55E'`
4. Confirm `ENTITY_TYPES` has exactly 9 entries
5. Confirm each entry's `directory` matches the `.kbz/state/` subdirectory name

**Estimated effort:** 1 point

---

### Task 3: YAML Loader

**What to do:** Create `loadProject()` which reads `.kbz/config.yaml`, walks all 9 entity subdirectories, parses YAML into typed Maps, and handles errors gracefully. Also create the `readDocumentContent()` stub.

**Files created (2 files):**

| # | Path | Contents |
|---|------|----------|
| 1 | `src/lib/reader/loader.ts` | `LoadResult` interface, `ENTITY_DIRECTORIES` constant, `loadProject()` function |
| 2 | `src/lib/reader/document.ts` | `readDocumentContent()` stub (returns null) |

**Dependencies:** T1 (imports all entity type interfaces).

**Implementation:**

```typescript
// src/lib/reader/loader.ts

import { readTextFile, readDir } from '@tauri-apps/plugin-fs';
import { parse as parseYaml } from 'yaml';
import type {
  ProjectConfig,
  Plan,
  Feature,
  Task,
  Bug,
  Decision,
  KnowledgeEntry,
  DocumentRecord,
  Incident,
  HumanCheckpoint,
} from '../types';

// ── Types ───────────────────────────────────────────────────────────

/**
 * The result of loading all data from a Kanbanzai project directory.
 * Contains the parsed config and all nine entity maps.
 */
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

// ── Constants ───────────────────────────────────────────────────────

/**
 * Mapping from .kbz/state/ subdirectory names to LoadResult keys.
 * Iterated in order during loadProject().
 */
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

/** Log prefix for all console output from this module. */
const LOG_PREFIX = '[kbzv]';

// ── Main Loader ─────────────────────────────────────────────────────

/**
 * Loads a Kanbanzai project from the filesystem.
 *
 * @param projectPath - Absolute path to the project root directory
 *   (the directory containing `.kbz/`).
 *
 * @returns A LoadResult containing the parsed config and all entity maps.
 *
 * @throws Error with message "Not a Kanbanzai project: .kbz/config.yaml not found"
 *   if the config file does not exist.
 * @throws Error with message "Failed to parse .kbz/config.yaml: {details}"
 *   if the config file cannot be parsed as YAML.
 * @throws Error with message ".kbz/config.yaml is missing required 'version' field"
 *   if the config file does not contain a `version` field.
 *
 * Individual entity files that fail to parse are logged as warnings
 * and skipped — they do not cause loadProject to throw.
 */
export async function loadProject(projectPath: string): Promise<LoadResult> {
  const kbzPath = `${projectPath}/.kbz`;
  const statePath = `${kbzPath}/state`;

  // ── Step 1: Read and parse config ───────────────────────────────

  let configYaml: string;
  try {
    configYaml = await readTextFile(`${kbzPath}/config.yaml`);
  } catch {
    throw new Error('Not a Kanbanzai project: .kbz/config.yaml not found');
  }

  let config: ProjectConfig;
  try {
    config = parseYaml(configYaml) as ProjectConfig;
  } catch (err) {
    throw new Error(`Failed to parse .kbz/config.yaml: ${String(err)}`);
  }

  if (!config || typeof config !== 'object' || !('version' in config)) {
    throw new Error(".kbz/config.yaml is missing required 'version' field");
  }

  // Normalise optional fields
  if (!config.prefixes) {
    config.prefixes = [];
  }

  // ── Step 2: Walk entity directories ─────────────────────────────

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

    // List directory entries; skip silently if directory does not exist
    let entries: Array<{ name: string }>;
    try {
      entries = await readDir(dirPath);
    } catch {
      // Directory doesn't exist — this is normal for entity types
      // the project hasn't used yet (e.g. no bugs, no incidents)
      continue;
    }

    // Filter to .yaml files only
    const yamlFiles = entries
      .map((e) => e.name)
      .filter(
        (name): name is string =>
          typeof name === 'string' && name.endsWith('.yaml'),
      );

    for (const filename of yamlFiles) {
      try {
        const content = await readTextFile(`${dirPath}/${filename}`);

        // Skip empty files
        if (!content || content.trim().length === 0) {
          console.warn(
            `${LOG_PREFIX} Skipping ${dir}/${filename}: empty file`,
          );
          continue;
        }

        const parsed = parseYaml(content);

        // Validate that the parsed result is an object with an 'id' field
        if (parsed && typeof parsed === 'object' && 'id' in parsed) {
          (result[key] as Map<string, unknown>).set(
            (parsed as { id: string }).id,
            parsed,
          );
        } else {
          console.warn(
            `${LOG_PREFIX} Skipping ${dir}/${filename}: no 'id' field found`,
          );
        }
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} Skipping ${dir}/${filename}: ${String(err)}`,
        );
        // Continue with remaining files
      }
    }
  }

  return result;
}
```

```typescript
// src/lib/reader/document.ts

/**
 * Reads the content of a document file referenced by a DocumentRecord.
 *
 * STUB: This function is a placeholder for F4 (Documents View).
 * In F2, it returns null for all calls. F4 will implement the full
 * logic including Markdown reading and content hash verification.
 *
 * @param _projectPath - Absolute path to the project root
 * @param _documentPath - Relative path from DocumentRecord.path
 * @returns null (stub). F4 will return the file content as a string, or null on error.
 */
export async function readDocumentContent(
  _projectPath: string,
  _documentPath: string,
): Promise<string | null> {
  // F4 will implement: read file at `${_projectPath}/${_documentPath}`, return content string
  return null;
}
```

**Key design decisions in the loader:**

1. **Entity ID from YAML, not filename** — The `id` field inside parsed YAML is always the map key. Filenames are used only for directory listing. This is especially important for DocumentRecord IDs which encode slashes as `--` in filenames.
2. **Silent skip on missing directory** — A project may have no bugs, no incidents, etc. This is normal.
3. **Warn-and-skip on parse errors** — A single broken file doesn't abort the entire load.
4. **No type coercion** — If a YAML field has the wrong type, store as-is. The viewer is read-only.
5. **Forward compatibility** — Unknown fields in YAML are silently stored on the object.

**Verification:**

1. `pnpm tsc --noEmit` — zero errors
2. Manual test: open the KBZV project itself (it has a `.kbz/` directory). Verify `loadProject()` returns a `LoadResult` with populated maps.
3. Test missing directory: temporarily rename `.kbz/state/bugs/` → verify bugs map is empty, no error thrown.
4. Test broken YAML: create a malformed `.yaml` file in `state/tasks/` → verify it's skipped with a console warning, other tasks still load.
5. Test missing config: point at a directory without `.kbz/config.yaml` → verify it throws the expected error.

**Estimated effort:** 3 points

---

### Task 4: Zustand Project Store

**What to do:** Create the central `useProjectStore` that holds all project data, actions (`openProject`, `reloadEntity` stub, `closeProject`), and derived state (`tree`, `pendingCheckpoints`).

**Files created (1 file):**

| # | Path | Contents |
|---|------|----------|
| 1 | `src/lib/store/project-store.ts` | `ProjectState` interface, `useProjectStore` Zustand store |

**Dependencies:** T1 (types), T3 (loader), T5 (tree builder).

**Implementation:**

```typescript
// src/lib/store/project-store.ts

import { create } from 'zustand';
import type {
  Plan,
  Feature,
  Task,
  Bug,
  Decision,
  KnowledgeEntry,
  DocumentRecord,
  Incident,
  HumanCheckpoint,
  ProjectConfig,
  EntityTypeName,
} from '../types';
import { loadProject } from '../reader/loader';
import type { LoadResult } from '../reader/loader';
import { buildTree } from '../query/tree';
import type { TreeNode } from '../query/tree';

// ── State Interface ─────────────────────────────────────────────────

export interface ProjectState {
  // ── Project root ────────────────────────────────────────────────
  /** Absolute path to the project directory, or null if no project is open */
  projectPath: string | null;

  /** Parsed .kbz/config.yaml, or null if no project is open */
  config: ProjectConfig | null;

  // ── Entity maps (ID → entity) ──────────────────────────────────
  plans: Map<string, Plan>;
  features: Map<string, Feature>;
  tasks: Map<string, Task>;
  bugs: Map<string, Bug>;
  decisions: Map<string, Decision>;
  knowledge: Map<string, KnowledgeEntry>;
  documents: Map<string, DocumentRecord>;
  incidents: Map<string, Incident>;
  checkpoints: Map<string, HumanCheckpoint>;

  // ── Derived state ──────────────────────────────────────────────
  /**
   * Plan→Feature→Task hierarchy.
   * Recomputed by calling buildTree() after any change to plans, features, or tasks.
   */
  tree: TreeNode[];

  /**
   * Checkpoints with status === 'pending'.
   * Recomputed by filtering the checkpoints map after any change.
   */
  pendingCheckpoints: HumanCheckpoint[];

  // ── Loading state ──────────────────────────────────────────────
  /** True while loadProject() is in progress */
  loading: boolean;

  /** Error message from the last failed openProject() call, or null */
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────
  /**
   * Open a Kanbanzai project directory.
   * Reads config, walks state directories, parses all YAML, builds tree.
   */
  openProject: (path: string) => Promise<void>;

  /**
   * Re-parse a single entity file and update the appropriate map.
   * Stub in F2 — fully implemented in F6 (File Watching & Git Status).
   */
  reloadEntity: (entityType: EntityTypeName, filePath: string) => Promise<void>;

  /**
   * Close the current project and reset all state to initial values.
   */
  closeProject: () => void;
}

// ── Store Creation ──────────────────────────────────────────────────

/**
 * The primary application store. Holds all project data.
 *
 * Usage in React components:
 *   const plans = useProjectStore((s) => s.plans);
 *   const openProject = useProjectStore((s) => s.openProject);
 */
export const useProjectStore = create<ProjectState>((set, get) => ({
  // ── Initial state ─────────────────────────────────────────────
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

  // ── openProject ───────────────────────────────────────────────
  openProject: async (path: string) => {
    set({ loading: true, error: null });
    try {
      const result: LoadResult = await loadProject(path);

      // Build derived state
      const tree = buildTree(result.plans, result.features, result.tasks);
      const pendingCheckpoints = [...result.checkpoints.values()].filter(
        (c) => c.status === 'pending',
      );

      set({
        projectPath: path,
        config: result.config,
        plans: result.plans,
        features: result.features,
        tasks: result.tasks,
        bugs: result.bugs,
        decisions: result.decisions,
        knowledge: result.knowledge,
        documents: result.documents,
        incidents: result.incidents,
        checkpoints: result.checkpoints,
        tree,
        pendingCheckpoints,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // ── reloadEntity (stub for F6) ────────────────────────────────
  reloadEntity: async (_entityType: EntityTypeName, _filePath: string) => {
    // F6 will implement:
    // 1. Parse the single YAML file at _filePath
    // 2. Update the entity in the appropriate map
    // 3. If _entityType is 'plan', 'feature', or 'task': rebuild tree
    // 4. If _entityType is 'checkpoint': refilter pendingCheckpoints
    // 5. Call set() with updated maps and derived state
  },

  // ── closeProject ──────────────────────────────────────────────
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

**Derived state recomputation rules:**

| Derived field | Recomputed when | Algorithm |
|---------------|----------------|-----------|
| `tree` | `plans`, `features`, or `tasks` maps change | `buildTree(plans, features, tasks)` |
| `pendingCheckpoints` | `checkpoints` map changes | `[...checkpoints.values()].filter(c => c.status === 'pending')` |

**Verification:**

1. `pnpm tsc --noEmit` — zero errors
2. Manual test: in the Tauri dev console, run:
   ```
   const store = useProjectStore.getState();
   await store.openProject('/path/to/kbzv');
   console.log(store.plans.size);    // should be > 0
   console.log(store.tree.length);   // should be > 0
   console.log(store.loading);       // should be false
   console.log(store.error);         // should be null
   ```
3. Test error path: call `openProject('/nonexistent')` → verify `error` is set, `loading` is `false`
4. Test `closeProject()`: open a project, then close → verify all maps are empty, `projectPath` is null

**Estimated effort:** 3 points

---

### Task 5: Tree Builder

**What to do:** Create `buildTree()` which assembles the Plan→Feature→Task hierarchy from flat Maps, with sorting, orphan handling, and synthetic nodes for unmatched parents.

**Files created (1 file):**

| # | Path | Contents |
|---|------|----------|
| 1 | `src/lib/query/tree.ts` | `TreeNode` interface, `planSortKey()`, `comparePlans()`, `compareById()`, `buildTree()` |

**Dependencies:** T1 (imports `Plan`, `Feature`, `Task` from types).

**Implementation:**

```typescript
// src/lib/query/tree.ts

import type { Plan, Feature, Task } from '../types';

// ── TreeNode ────────────────────────────────────────────────────────

/**
 * A node in the Plan→Feature→Task hierarchy tree.
 * Each node wraps an entity and may have child nodes.
 */
export interface TreeNode {
  /** The entity at this tree level */
  entity: Plan | Feature | Task;

  /** Discriminator for the entity type */
  entityType: 'plan' | 'feature' | 'task';

  /** The entity's ID (duplicated from entity.id for convenience) */
  id: string;

  /**
   * Child nodes.
   * - Plan nodes have Feature children.
   * - Feature nodes have Task children.
   * - Task nodes always have an empty array.
   */
  children: TreeNode[];
}

// ── Sort Helpers ────────────────────────────────────────────────────

/**
 * Extracts the sort key from a Plan ID for ordering.
 *
 * Plan IDs have the format P{n}-{slug}, e.g. "P1-kbzv", "P12-infra".
 * The sort key is a [prefix_letter, number] tuple so that:
 *   P1 < P2 < P12 (numeric, not lexicographic)
 *
 * If the ID does not match the expected pattern, falls back to
 * sorting by the raw ID string with number 0.
 */
function planSortKey(plan: Plan): [string, number] {
  const match = plan.id.match(/^([A-Z])(\d+)-/);
  if (!match) return [plan.id, 0];
  return [match[1], parseInt(match[2], 10)];
}

/**
 * Comparator for sorting Plans by their prefix letter and numeric index.
 *
 * Sort order:
 * 1. First by prefix letter (alphabetical): A < B < P < Z
 * 2. Then by numeric index (ascending): P1 < P2 < P12
 * 3. Fallback to raw ID comparison for malformed IDs
 */
function comparePlans(a: Plan, b: Plan): number {
  const [aLetter, aNum] = planSortKey(a);
  const [bLetter, bNum] = planSortKey(b);

  // Compare prefix letter first
  if (aLetter < bLetter) return -1;
  if (aLetter > bLetter) return 1;

  // Same prefix letter — compare numeric index
  return aNum - bNum;
}

/**
 * Comparator for sorting entities by ID (lexicographic).
 *
 * Since TSID13-based IDs are time-sortable, lexicographic order
 * produces chronological (creation-time) order.
 */
function compareById(a: { id: string }, b: { id: string }): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

// ── Tree Builder ────────────────────────────────────────────────────

/**
 * Builds the Plan→Feature→Task hierarchy tree from entity maps.
 *
 * Algorithm:
 * 1. Group features by parent plan ID into a Map<planId, Feature[]>.
 * 2. Group tasks by parent_feature ID into a Map<featureId, Task[]>.
 * 3. Sort plans using comparePlans (prefix letter + numeric index).
 * 4. For each plan, sort its features by ID (lexicographic = chronological).
 * 5. For each feature, sort its tasks by ID (lexicographic = chronological).
 * 6. Assemble TreeNode objects at each level.
 * 7. Features whose parent plan does not exist → "Orphaned" synthetic plan.
 * 8. Tasks whose parent_feature does not exist → "Orphaned Tasks" synthetic feature.
 *
 * @param plans - All Plan entities, keyed by ID
 * @param features - All Feature entities, keyed by ID
 * @param tasks - All Task entities, keyed by ID
 * @returns Sorted array of plan-level TreeNodes
 */
export function buildTree(
  plans: Map<string, Plan>,
  features: Map<string, Feature>,
  tasks: Map<string, Task>,
): TreeNode[] {
  // ── Step 1: Group features by parent plan ID ──────────────────
  const featuresByPlan = new Map<string, Feature[]>();
  const orphanedFeatures: Feature[] = [];

  for (const feature of features.values()) {
    if (plans.has(feature.parent)) {
      const list = featuresByPlan.get(feature.parent);
      if (list) {
        list.push(feature);
      } else {
        featuresByPlan.set(feature.parent, [feature]);
      }
    } else {
      orphanedFeatures.push(feature);
    }
  }

  // ── Step 2: Group tasks by parent feature ID ──────────────────
  const tasksByFeature = new Map<string, Task[]>();
  const orphanedTasks: Task[] = [];

  for (const task of tasks.values()) {
    if (features.has(task.parent_feature)) {
      const list = tasksByFeature.get(task.parent_feature);
      if (list) {
        list.push(task);
      } else {
        tasksByFeature.set(task.parent_feature, [task]);
      }
    } else {
      orphanedTasks.push(task);
    }
  }

  // ── Step 3: Build task nodes for a feature ────────────────────
  function buildTaskNodes(featureId: string): TreeNode[] {
    const featureTasks = tasksByFeature.get(featureId) ?? [];
    return featureTasks.sort(compareById).map((task) => ({
      entity: task,
      entityType: 'task' as const,
      id: task.id,
      children: [],
    }));
  }

  // ── Step 4: Build feature nodes for a plan ────────────────────
  function buildFeatureNodes(planId: string): TreeNode[] {
    const planFeatures = featuresByPlan.get(planId) ?? [];
    return planFeatures.sort(compareById).map((feature) => ({
      entity: feature,
      entityType: 'feature' as const,
      id: feature.id,
      children: buildTaskNodes(feature.id),
    }));
  }

  // ── Step 5: Build plan nodes ──────────────────────────────────
  const sortedPlans = [...plans.values()].sort(comparePlans);

  const tree: TreeNode[] = sortedPlans.map((plan) => ({
    entity: plan,
    entityType: 'plan' as const,
    id: plan.id,
    children: buildFeatureNodes(plan.id),
  }));

  // ── Step 6: Handle orphaned features and tasks ────────────────
  if (orphanedFeatures.length > 0 || orphanedTasks.length > 0) {
    const orphanFeatureNodes: TreeNode[] = orphanedFeatures
      .sort(compareById)
      .map((feature) => ({
        entity: feature,
        entityType: 'feature' as const,
        id: feature.id,
        children: buildTaskNodes(feature.id),
      }));

    // Orphaned tasks go under a synthetic feature
    if (orphanedTasks.length > 0) {
      const syntheticFeature: Feature = {
        id: '__orphaned-tasks__',
        slug: 'orphaned-tasks',
        parent: '__orphaned__',
        status: 'active',
        summary: 'Tasks with no matching parent feature',
        created: '',
        created_by: '',
        updated: '',
      };

      const orphanTaskNodes: TreeNode[] = orphanedTasks
        .sort(compareById)
        .map((task) => ({
          entity: task,
          entityType: 'task' as const,
          id: task.id,
          children: [],
        }));

      orphanFeatureNodes.push({
        entity: syntheticFeature,
        entityType: 'feature' as const,
        id: syntheticFeature.id,
        children: orphanTaskNodes,
      });
    }

    const syntheticPlan: Plan = {
      id: '__orphaned__',
      slug: 'orphaned',
      title: 'Orphaned',
      status: 'active',
      summary: 'Entities with no matching parent',
      created: '',
      created_by: '',
      updated: '',
    };

    tree.push({
      entity: syntheticPlan,
      entityType: 'plan' as const,
      id: syntheticPlan.id,
      children: orphanFeatureNodes,
    });
  }

  return tree;
}
```

**Synthetic IDs for orphan handling:**

| Synthetic Entity | ID | Purpose |
|------------------|----|---------|
| Orphan plan | `__orphaned__` | Groups features whose `parent` plan doesn't exist |
| Orphan feature | `__orphaned-tasks__` | Groups tasks whose `parent_feature` doesn't exist |

**Verification:**

1. `pnpm tsc --noEmit` — zero errors
2. Unit test: create 3 plans (P2, P1, P10) with features and tasks. Verify sort order: `tree[0].id === 'P1-...'`, `tree[1].id === 'P2-...'`, `tree[2].id === 'P10-...'`
3. Unit test: create a feature referencing a non-existent plan → verify it ends up under `__orphaned__`
4. Unit test: create a task referencing a non-existent feature → verify it ends up under `__orphaned-tasks__` inside `__orphaned__`
5. Unit test: empty maps → verify `buildTree(new Map(), new Map(), new Map())` returns `[]`
6. Unit test: features and tasks within each parent are sorted lexicographically by ID

**Estimated effort:** 3 points

---

### Task 6: Metrics

**What to do:** Create all four metric functions: task completion per feature, feature completion per plan, estimate rollup per feature, and estimate rollup per plan.

**Files created (1 file):**

| # | Path | Contents |
|---|------|----------|
| 1 | `src/lib/query/metrics.ts` | `CompletionMetrics`, `EstimateRollup` interfaces + 4 functions |

**Dependencies:** T1 (imports `Plan`, `Feature`, `Task` from types).

**Implementation:**

```typescript
// src/lib/query/metrics.ts

import type { Feature, Task } from '../types';

// ── Constants ───────────────────────────────────────────────────────

/**
 * Task statuses excluded from completion metric denominators.
 * Terminal-negative: task was removed from scope, not completed.
 */
const TASK_EXCLUDED_STATUSES: readonly string[] = ['not-planned', 'duplicate'];

/**
 * Feature statuses excluded from completion metric denominators.
 * Terminal-negative: feature was removed from scope, not completed.
 */
const FEATURE_EXCLUDED_STATUSES: readonly string[] = [
  'cancelled',
  'superseded',
];

// ── Metric Interfaces ───────────────────────────────────────────────

/**
 * Completion metrics for a set of entities.
 *
 * Edge cases:
 * - When total is 0 (no entities, or all excluded): percentage is NaN.
 *   UI consumers must check for NaN and display "—" or "N/A".
 * - done is never greater than total.
 * - percentage is in the range [0, 100] when total > 0.
 */
export interface CompletionMetrics {
  /** Count of entities with status 'done' */
  done: number;

  /** Count of all entities, excluding terminal-negative statuses */
  total: number;

  /**
   * Completion percentage: (done / total) * 100.
   * NaN when total is 0.
   */
  percentage: number;
}

/**
 * Estimate rollup for a set of entities.
 *
 * Edge cases:
 * - When all entities are unestimated: totalPoints = 0, estimatedCount = 0.
 * - Entities without an estimate field are counted as unestimated — never as 0.
 */
export interface EstimateRollup {
  /** Sum of estimate values for all estimated entities */
  totalPoints: number;

  /** Count of entities that have an estimate value (estimate != null) */
  estimatedCount: number;

  /** Count of entities that do NOT have an estimate value */
  unestimatedCount: number;
}

// ── Task Completion by Feature ──────────────────────────────────────

/**
 * Computes task completion metrics for a single feature.
 *
 * Iterates all tasks, selects those belonging to the given feature,
 * excludes terminal-negative statuses, counts done.
 *
 * @example
 * // Feature has 3 tasks: done, active, not-planned
 * // → { done: 1, total: 2, percentage: 50 }
 */
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

  return {
    done,
    total,
    percentage: total > 0 ? (done / total) * 100 : NaN,
  };
}

// ── Feature Completion by Plan ──────────────────────────────────────

/**
 * Computes feature completion metrics for a single plan.
 *
 * @example
 * // Plan has 5 features: 2 done, 2 developing, 1 cancelled
 * // → { done: 2, total: 4, percentage: 50 }
 */
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

  return {
    done,
    total,
    percentage: total > 0 ? (done / total) * 100 : NaN,
  };
}

// ── Estimate Rollup for Feature ─────────────────────────────────────

/**
 * Computes estimate rollup for all tasks within a feature.
 *
 * Sums estimate values for tasks that have one, and counts those that don't.
 * Tasks with terminal-negative statuses are excluded entirely.
 *
 * @example
 * // 3 tasks: estimate=5, estimate=3, no estimate
 * // → { totalPoints: 8, estimatedCount: 2, unestimatedCount: 1 }
 */
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

// ── Estimate Rollup for Plan ────────────────────────────────────────

/**
 * Computes estimate rollup for all features within a plan.
 *
 * @example
 * // 4 features: estimate=8, estimate=13, no estimate, cancelled (estimate=5)
 * // → { totalPoints: 21, estimatedCount: 2, unestimatedCount: 1 }
 * // (cancelled is excluded entirely — its estimate is not counted)
 */
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

**Critical note:** The `estimate != null` check uses loose inequality (`!=` not `!==`) to catch both `undefined` and `null`. Entities without an `estimate` field are counted as "unestimated" — they are **never** treated as having an estimate of zero.

**Verification:**

1. `pnpm tsc --noEmit` — zero errors
2. Unit test `taskCompletionForFeature`:
   - 3 tasks (done, active, not-planned) → `{ done: 1, total: 2, percentage: 50 }`
   - 0 tasks → `{ done: 0, total: 0, percentage: NaN }`
   - 2 tasks (not-planned, duplicate) → `{ done: 0, total: 0, percentage: NaN }`
   - 3 tasks (done, done, done) → `{ done: 3, total: 3, percentage: 100 }`
3. Unit test `featureCompletionForPlan`:
   - 5 features (2 done, 2 developing, 1 cancelled) → `{ done: 2, total: 4, percentage: 50 }`
   - 0 features → `{ done: 0, total: 0, percentage: NaN }`
4. Unit test `estimateRollupForFeature`:
   - Tasks with estimates [5, 3, null] → `{ totalPoints: 8, estimatedCount: 2, unestimatedCount: 1 }`
   - All unestimated [null, null] → `{ totalPoints: 0, estimatedCount: 0, unestimatedCount: 2 }`
   - Empty → `{ totalPoints: 0, estimatedCount: 0, unestimatedCount: 0 }`
5. Unit test `estimateRollupForPlan`: mirror of feature rollup but at plan level

**Estimated effort:** 2 points

---

### Task 7: Reference Resolution

**What to do:** Create `resolveEntityType()` (ID prefix → entity type) and `resolveEntity()` (ID → entity from store). These are pure functions used by the cross-reference rendering in F3–F5.

**Files created (1 file):**

| # | Path | Contents |
|---|------|----------|
| 1 | `src/lib/query/references.ts` | `resolveEntityType()`, `ENTITY_TYPE_TO_STATE_KEY`, `ResolvedEntity` interface, `resolveEntity()` |

**Dependencies:** T1 (types), T4 (imports `ProjectState` type — only the interface, not runtime).

**Implementation:**

```typescript
// src/lib/query/references.ts

import type { EntityTypeName } from '../types';
import type { ProjectState } from '../store/project-store';

// ── resolveEntityType ───────────────────────────────────────────────

/**
 * Determines entity type from an ID string by examining its prefix.
 *
 * The order of checks is significant:
 * 1. Exact prefix matches (FEAT-, TASK-, BUG-, DEC-, KE-, INC-, CHK-) — first
 * 2. Document detection (contains "/") — before plan regex because
 *    document IDs like "FEAT-01ABC/design-my-feature" would otherwise
 *    partially match the plan pattern
 * 3. Plan pattern ({Letter}{Digit}+-) — last as fallback
 *
 * Prefix → Type mapping:
 * | Prefix pattern      | Returns       |
 * |---------------------|---------------|
 * | FEAT-               | 'feature'     |
 * | TASK-               | 'task'        |
 * | BUG-                | 'bug'         |
 * | DEC-                | 'decision'    |
 * | KE-                 | 'knowledge'   |
 * | INC-                | 'incident'    |
 * | CHK-                | 'checkpoint'  |
 * | contains "/"        | 'document'    |
 * | /^[A-Z]\d+-/        | 'plan'        |
 * | (none of the above) | null          |
 */
export function resolveEntityType(id: string): EntityTypeName | null {
  // 1. Exact prefix matches (most specific first)
  if (id.startsWith('FEAT-')) return 'feature';
  if (id.startsWith('TASK-')) return 'task';
  if (id.startsWith('BUG-'))  return 'bug';
  if (id.startsWith('DEC-'))  return 'decision';
  if (id.startsWith('KE-'))   return 'knowledge';
  if (id.startsWith('INC-'))  return 'incident';
  if (id.startsWith('CHK-'))  return 'checkpoint';

  // 2. Document IDs contain a "/" (e.g. "FEAT-01ABC/design-my-feature")
  // Must be checked BEFORE plan pattern because document IDs can start
  // with entity prefixes followed by a slash.
  if (id.includes('/')) return 'document';

  // 3. Plan IDs match {UppercaseLetter}{Digits}- (e.g. "P1-", "P12-")
  if (/^[A-Z]\d+-/.test(id)) return 'plan';

  // 4. No match
  return null;
}

// ── resolveEntity ───────────────────────────────────────────────────

/**
 * Mapping from EntityTypeName to the corresponding property key on ProjectState.
 */
const ENTITY_TYPE_TO_STATE_KEY: Record<EntityTypeName, keyof ProjectState> = {
  plan:       'plans',
  feature:    'features',
  task:       'tasks',
  bug:        'bugs',
  decision:   'decisions',
  knowledge:  'knowledge',
  document:   'documents',
  incident:   'incidents',
  checkpoint: 'checkpoints',
};

/**
 * Result of resolving an entity reference.
 */
export interface ResolvedEntity {
  /** The type of the resolved entity */
  entityType: EntityTypeName;

  /** The entity object itself. Typed as unknown — callers should narrow based on entityType. */
  entity: unknown;
}

/**
 * Look up an entity by ID across all entity maps in the store.
 *
 * Steps:
 * 1. Call resolveEntityType(id) to determine which map to search
 * 2. If the type is unknown (null), return null
 * 3. Look up the entity in the appropriate map
 * 4. If found, return { entityType, entity }; otherwise return null
 *
 * @param id - The entity ID to resolve
 * @param state - The current ProjectState (pass from store or selector)
 * @returns { entityType, entity } if found, null otherwise
 *
 * @example
 * const result = resolveEntity('FEAT-01KMZA9CP9XEX', state);
 * if (result) {
 *   console.log(result.entityType); // 'feature'
 *   const feature = result.entity as Feature;
 * }
 */
export function resolveEntity(
  id: string,
  state: ProjectState,
): ResolvedEntity | null {
  const type = resolveEntityType(id);
  if (!type) return null;

  const stateKey = ENTITY_TYPE_TO_STATE_KEY[type];
  const map = state[stateKey] as Map<string, unknown>;
  const entity = map.get(id);

  return entity ? { entityType: type, entity } : null;
}
```

**Verification:**

1. `pnpm tsc --noEmit` — zero errors
2. Unit test `resolveEntityType()` — full table:
   | Input | Expected |
   |-------|----------|
   | `'FEAT-01KMZA9CP9XEX'` | `'feature'` |
   | `'TASK-01ABC123'` | `'task'` |
   | `'BUG-01XYZ789'` | `'bug'` |
   | `'DEC-01AAA111'` | `'decision'` |
   | `'KE-01BBB222'` | `'knowledge'` |
   | `'INC-01CCC333'` | `'incident'` |
   | `'CHK-01DDD444'` | `'checkpoint'` |
   | `'FEAT-01ABC/design-my-feature'` | `'document'` |
   | `'PROJECT/policy-security'` | `'document'` |
   | `'P1-kbzv'` | `'plan'` |
   | `'P12-infra'` | `'plan'` |
   | `'unknown-thing'` | `null` |
3. Unit test `resolveEntity()`: load a project, verify `resolveEntity('P1-kbzv', state)` returns `{ entityType: 'plan', entity: <Plan> }`. Verify `resolveEntity('nonexistent', state)` returns `null`.

**Estimated effort:** 2 points

---

### Task 8: Wire to UI

**What to do:** Connect the F2 data store to the F1 UI shell. When the user picks a folder via the existing native dialog, call `useProjectStore.openProject()` instead of just storing the path. Show a loading state while data loads and handle errors.

**Files modified (1 file):**

| # | Path | Change |
|---|------|--------|
| 1 | `src/components/layout/MainPanel.tsx` | Replace `handleOpenProject` to call `useProjectStore.openProject()`, add loading/error UI states |

**Dependencies:** T4 (project store must be functional).

**Implementation:**

The existing `MainPanel.tsx` from F1 uses `useUIStore` to store the `projectPath` and validates the folder by checking if `.kbz/config.yaml` exists. In F2, we replace this with the full `openProject()` flow which already performs that validation (and more) during `loadProject()`.

```typescript
// src/components/layout/MainPanel.tsx
//
// Changes from F1:
// 1. Import useProjectStore
// 2. Replace handleOpenProject to call projectStore.openProject()
// 3. Add loading spinner state
// 4. Add error display state
// 5. Keep useUIStore for activeView (it remains the UI-level store)

import { FileText, FolderOpen, GitBranch, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { useUIStore } from '@/lib/store/ui-store';
import { useProjectStore } from '@/lib/store/project-store';
import { open } from '@tauri-apps/plugin-dialog';
import { message } from '@tauri-apps/plugin-dialog';

/**
 * Opens a native folder picker, then calls the project store's openProject()
 * to load all data. On failure, shows a native error dialog.
 */
async function handleOpenProject(
  openProject: (path: string) => Promise<void>,
  setProjectPath: (path: string | null) => void,
) {
  // 1. Open native folder picker
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Open Kanbanzai Project',
  });

  // 2. User cancelled
  if (selected === null) {
    return;
  }

  // 3. Attempt to load the project (loadProject validates config etc.)
  await openProject(selected);

  // 4. Check if the project store has an error
  const error = useProjectStore.getState().error;
  if (error) {
    // Show native error dialog with the specific error message
    await message(error, {
      title: 'Failed to Open Project',
      kind: 'error',
    });
  } else {
    // Success — update the UI store's projectPath too, so header/views know
    setProjectPath(selected);
  }
}

function MainPanel() {
  const activeView = useUIStore((s) => s.activeView);
  const projectPath = useUIStore((s) => s.projectPath);
  const setProjectPath = useUIStore((s) => s.setProjectPath);
  const openProject = useProjectStore((s) => s.openProject);
  const loading = useProjectStore((s) => s.loading);

  // ── Loading state ───────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading project…</p>
        </div>
      </main>
    );
  }

  // ── No project open — show open prompt ──────────────────────────
  if (!projectPath) {
    return (
      <main className="flex-1 overflow-auto">
        <EmptyState
          icon={FolderOpen}
          title="No project open"
          description="Select a Kanbanzai project folder to get started"
          action={{
            label: 'Open Project',
            onClick: () => handleOpenProject(openProject, setProjectPath),
          }}
        />
      </main>
    );
  }

  // ── Project open — render active view ───────────────────────────
  // (F3/F4 will replace these placeholders with real views)
  if (activeView === 'documents') {
    return (
      <main className="flex-1 overflow-auto">
        <EmptyState
          icon={FileText}
          title="Documents"
          description={`Project loaded: ${projectPath}`}
        />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto">
      <EmptyState
        icon={GitBranch}
        title="Workflows"
        description={`Project loaded: ${projectPath}`}
      />
    </main>
  );
}

export { MainPanel };
```

**Key integration points:**

1. **Two stores work together:** `useUIStore` holds UI concerns (`activeView`, `projectPath` for display). `useProjectStore` holds all data. The `projectPath` in `useUIStore` is set only after `openProject()` succeeds.
2. **Loading state:** While `loadProject()` runs (typically < 1 second for projects with hundreds of entities), a spinner is shown. This prevents the user from interacting with stale/empty data.
3. **Error handling:** If `openProject()` fails (e.g. not a Kanbanzai project, broken config), the error is shown via a native dialog. The `projectPath` is not set, so the user stays on the "open project" screen.

**Verification:**

1. `pnpm tsc --noEmit` — zero errors
2. `pnpm tauri dev` — launches the app
3. Click "Open Project" → select a valid Kanbanzai project → verify loading spinner appears briefly, then empty state shows "Project loaded: /path/to/project"
4. Open the Tauri devtools console → verify `useProjectStore.getState().plans.size > 0`
5. Click "Open Project" → select a non-Kanbanzai folder → verify native error dialog appears with "Not a Kanbanzai project: .kbz/config.yaml not found"
6. Click "Open Project" → cancel the picker → verify nothing changes

**Estimated effort:** 2 points

---

### Task 9: Integration Testing

**What to do:** Create a test fixture `.kbz/` directory with representative data and a test script that exercises the full load cycle. Verify all acceptance criteria from the spec.

**Files created:**

| # | Path | Contents |
|---|------|----------|
| 1 | `test/fixtures/sample-project/.kbz/config.yaml` | Minimal project config |
| 2 | `test/fixtures/sample-project/.kbz/state/plans/P1-test.yaml` | Test plan |
| 3 | `test/fixtures/sample-project/.kbz/state/plans/P2-other.yaml` | Second plan for sort testing |
| 4 | `test/fixtures/sample-project/.kbz/state/features/FEAT-01AAA-alpha.yaml` | Feature under P1 |
| 5 | `test/fixtures/sample-project/.kbz/state/features/FEAT-01BBB-beta.yaml` | Feature under P1, done |
| 6 | `test/fixtures/sample-project/.kbz/state/features/FEAT-01CCC-orphan.yaml` | Feature with non-existent parent (orphan test) |
| 7 | `test/fixtures/sample-project/.kbz/state/tasks/TASK-01DDD-task-a.yaml` | Task under FEAT-01AAA, done |
| 8 | `test/fixtures/sample-project/.kbz/state/tasks/TASK-01EEE-task-b.yaml` | Task under FEAT-01AAA, active |
| 9 | `test/fixtures/sample-project/.kbz/state/tasks/TASK-01FFF-task-c.yaml` | Task under FEAT-01AAA, not-planned |
| 10 | `test/fixtures/sample-project/.kbz/state/tasks/TASK-01GGG-orphan.yaml` | Task with non-existent parent (orphan test) |
| 11 | `test/fixtures/sample-project/.kbz/state/bugs/BUG-01HHH-crash.yaml` | Sample bug |
| 12 | `test/fixtures/sample-project/.kbz/state/decisions/DEC-01III-arch.yaml` | Sample decision |
| 13 | `test/fixtures/sample-project/.kbz/state/knowledge/KE-01JJJ.yaml` | Sample knowledge entry |
| 14 | `test/fixtures/sample-project/.kbz/state/documents/PROJECT--design-test.yaml` | Sample document |
| 15 | `test/fixtures/sample-project/.kbz/state/incidents/INC-01KKK-outage.yaml` | Sample incident |
| 16 | `test/fixtures/sample-project/.kbz/state/checkpoints/CHK-01LLL.yaml` | Pending checkpoint |
| 17 | `test/fixtures/sample-project/.kbz/state/checkpoints/CHK-01MMM.yaml` | Responded checkpoint |
| 18 | `test/fixtures/sample-project/.kbz/state/tasks/broken.yaml` | Invalid YAML (parse error test) |
| 19 | `test/data-layer.test.ts` | Integration test file |

**Dependencies:** T1–T8 (all previous tasks).

**Implementation — Fixture files:**

```yaml
# test/fixtures/sample-project/.kbz/config.yaml
version: "2"
schema_version: "1.0.0"
prefixes:
  - prefix: P
    name: Plan
documents:
  roots:
    - path: work/design
      default_type: design
```

```yaml
# test/fixtures/sample-project/.kbz/state/plans/P1-test.yaml
id: P1-test
slug: test
title: Test Plan
status: active
summary: A test plan for integration testing
created: "2025-01-01T00:00:00Z"
created_by: test
updated: "2025-01-01T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/plans/P2-other.yaml
id: P2-other
slug: other
title: Other Plan
status: proposed
summary: A second plan for sort-order testing
created: "2025-01-02T00:00:00Z"
created_by: test
updated: "2025-01-02T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/features/FEAT-01AAA-alpha.yaml
id: FEAT-01AAA
slug: alpha
parent: P1-test
status: developing
summary: Alpha feature
estimate: 8
created: "2025-01-01T00:00:00Z"
created_by: test
updated: "2025-01-01T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/features/FEAT-01BBB-beta.yaml
id: FEAT-01BBB
slug: beta
parent: P1-test
status: done
summary: Beta feature (complete)
estimate: 5
created: "2025-01-02T00:00:00Z"
created_by: test
updated: "2025-01-02T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/features/FEAT-01CCC-orphan.yaml
id: FEAT-01CCC
slug: orphan-feature
parent: P99-nonexistent
status: proposed
summary: Feature whose parent plan does not exist
created: "2025-01-03T00:00:00Z"
created_by: test
updated: "2025-01-03T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/tasks/TASK-01DDD-task-a.yaml
id: TASK-01DDD
slug: task-a
parent_feature: FEAT-01AAA
status: done
summary: Completed task
estimate: 3
created: "2025-01-01T00:00:00Z"
created_by: test
updated: "2025-01-01T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/tasks/TASK-01EEE-task-b.yaml
id: TASK-01EEE
slug: task-b
parent_feature: FEAT-01AAA
status: active
summary: In-progress task
estimate: 5
created: "2025-01-02T00:00:00Z"
created_by: test
updated: "2025-01-02T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/tasks/TASK-01FFF-task-c.yaml
id: TASK-01FFF
slug: task-c
parent_feature: FEAT-01AAA
status: not-planned
summary: Excluded task (not-planned)
created: "2025-01-03T00:00:00Z"
created_by: test
updated: "2025-01-03T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/tasks/TASK-01GGG-orphan.yaml
id: TASK-01GGG
slug: orphan-task
parent_feature: FEAT-99NONEXISTENT
status: queued
summary: Task whose parent feature does not exist
created: "2025-01-04T00:00:00Z"
created_by: test
updated: "2025-01-04T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/bugs/BUG-01HHH-crash.yaml
id: BUG-01HHH
slug: crash
title: App crashes on empty input
status: reported
severity: high
priority: medium
type: implementation-defect
reported_by: tester
observed: App crashes with unhandled exception
expected: App shows a validation error
created: "2025-01-01T00:00:00Z"
created_by: tester
updated: "2025-01-01T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/decisions/DEC-01III-arch.yaml
id: DEC-01III
slug: arch
summary: Use Zustand for state management
rationale: Simpler than Redux, good TypeScript support
decided_by: architect
status: accepted
date: "2025-01-01T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/knowledge/KE-01JJJ.yaml
id: KE-01JJJ
tier: 2
topic: testing-conventions
scope: project
content: Use Vitest for all unit tests
status: confirmed
created: "2025-01-01T00:00:00Z"
created_by: test
updated: "2025-01-01T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/documents/PROJECT--design-test.yaml
id: PROJECT/design-test
path: work/design/test.md
type: design
title: Test Design Document
status: approved
owner: P1-test
created: "2025-01-01T00:00:00Z"
created_by: test
updated: "2025-01-01T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/incidents/INC-01KKK-outage.yaml
id: INC-01KKK
slug: outage
title: Production outage
status: resolved
severity: critical
reported_by: ops
summary: Complete service outage for 15 minutes
created: "2025-01-01T00:00:00Z"
created_by: ops
updated: "2025-01-01T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/checkpoints/CHK-01LLL.yaml
id: CHK-01LLL
question: Should we proceed with the migration?
context: Database migration requires 2 hours of downtime
orchestration_summary: Migration plan approved, waiting for human confirmation
created_by: orchestrator
status: pending
created: "2025-01-01T00:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/checkpoints/CHK-01MMM.yaml
id: CHK-01MMM
question: Approve the release?
context: All tests passing, staging verified
orchestration_summary: Release pipeline at gate
created_by: orchestrator
status: responded
response: Approved. Ship it.
created: "2025-01-02T00:00:00Z"
responded_at: "2025-01-02T01:00:00Z"
```

```yaml
# test/fixtures/sample-project/.kbz/state/tasks/broken.yaml
# This file intentionally contains invalid YAML
{{{invalid yaml content!!!
  not: [proper
```

**Implementation — Test file:**

The test file exercises the pure functions directly (tree builder, metrics, references, status colours). The loader cannot be tested directly in Vitest because it depends on `@tauri-apps/plugin-fs` which only works in the Tauri runtime, so loader integration tests are manual (see verification section).

```typescript
// test/data-layer.test.ts

import { describe, it, expect } from 'vitest';
import type { Plan, Feature, Task, HumanCheckpoint } from '../src/lib/types';
import { buildTree } from '../src/lib/query/tree';
import type { TreeNode } from '../src/lib/query/tree';
import {
  taskCompletionForFeature,
  featureCompletionForPlan,
  estimateRollupForFeature,
  estimateRollupForPlan,
} from '../src/lib/query/metrics';
import {
  resolveEntityType,
  resolveEntity,
} from '../src/lib/query/references';
import {
  getStatusColour,
  getStatusHex,
} from '../src/lib/constants/status-colours';
import { ENTITY_TYPES } from '../src/lib/constants/entity-types';

// ── Helper Factories ────────────────────────────────────────────────

function makePlan(overrides: Partial<Plan> & { id: string }): Plan {
  return {
    slug: 'test',
    title: 'Test Plan',
    status: 'active',
    summary: 'test',
    created: '2025-01-01T00:00:00Z',
    created_by: 'test',
    updated: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFeature(
  overrides: Partial<Feature> & { id: string; parent: string },
): Feature {
  return {
    slug: 'test',
    status: 'developing',
    summary: 'test',
    created: '2025-01-01T00:00:00Z',
    created_by: 'test',
    updated: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeTask(
  overrides: Partial<Task> & { id: string; parent_feature: string },
): Task {
  return {
    slug: 'test',
    summary: 'test',
    status: 'active',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Status Colours', () => {
  it('maps known statuses to correct colours', () => {
    expect(getStatusColour('proposed')).toBe('grey');
    expect(getStatusColour('designing')).toBe('blue');
    expect(getStatusColour('active')).toBe('yellow');
    expect(getStatusColour('blocked')).toBe('orange');
    expect(getStatusColour('done')).toBe('green');
    expect(getStatusColour('cancelled')).toBe('red');
    expect(getStatusColour('superseded')).toBe('purple');
  });

  it('returns grey for unknown statuses', () => {
    expect(getStatusColour('xyz-future')).toBe('grey');
    expect(getStatusColour('')).toBe('grey');
  });

  it('returns correct hex values', () => {
    expect(getStatusHex('done')).toBe('#22C55E');
    expect(getStatusHex('active')).toBe('#EAB308');
    expect(getStatusHex('xyz-future')).toBe('#9CA3AF');
  });

  it('covers all 37 mapped statuses', () => {
    const allStatuses = [
      'proposed', 'queued', 'draft', 'reported',
      'designing', 'specifying', 'dev-planning', 'ready', 'planned',
      'contributed', 'triaged', 'reproduced',
      'active', 'in-progress', 'investigating', 'developing',
      'root-cause-identified',
      'blocked', 'needs-review', 'needs-rework', 'disputed', 'pending',
      'mitigated',
      'done', 'closed', 'verified', 'approved', 'accepted', 'confirmed',
      'resolved', 'responded',
      'cancelled', 'not-planned', 'rejected', 'duplicate', 'retired',
      'cannot-reproduce',
      'superseded',
    ];
    for (const status of allStatuses) {
      expect(getStatusColour(status)).not.toBe('grey');
    }
  });
});

describe('Entity Types', () => {
  it('has exactly 9 entries', () => {
    expect(Object.keys(ENTITY_TYPES)).toHaveLength(9);
  });

  it('each entry has required fields', () => {
    for (const info of Object.values(ENTITY_TYPES)) {
      expect(info.type).toBeTruthy();
      expect(info.label).toBeTruthy();
      expect(info.labelPlural).toBeTruthy();
      expect(info.directory).toBeTruthy();
      expect(info.icon).toBeTruthy();
    }
  });
});

describe('buildTree', () => {
  it('returns empty array for empty maps', () => {
    const tree = buildTree(new Map(), new Map(), new Map());
    expect(tree).toEqual([]);
  });

  it('sorts plans by prefix letter then numeric index', () => {
    const plans = new Map<string, Plan>([
      ['P2-beta', makePlan({ id: 'P2-beta' })],
      ['P1-alpha', makePlan({ id: 'P1-alpha' })],
      ['P10-gamma', makePlan({ id: 'P10-gamma' })],
    ]);
    const tree = buildTree(plans, new Map(), new Map());
    expect(tree.map((n) => n.id)).toEqual(['P1-alpha', 'P2-beta', 'P10-gamma']);
  });

  it('nests features under their parent plan', () => {
    const plans = new Map([['P1-test', makePlan({ id: 'P1-test' })]]);
    const features = new Map([
      [
        'FEAT-01AAA',
        makeFeature({ id: 'FEAT-01AAA', parent: 'P1-test' }),
      ],
    ]);
    const tree = buildTree(plans, features, new Map());
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('FEAT-01AAA');
    expect(tree[0].children[0].entityType).toBe('feature');
  });

  it('nests tasks under their parent feature', () => {
    const plans = new Map([['P1-test', makePlan({ id: 'P1-test' })]]);
    const features = new Map([
      [
        'FEAT-01AAA',
        makeFeature({ id: 'FEAT-01AAA', parent: 'P1-test' }),
      ],
    ]);
    const tasks = new Map([
      [
        'TASK-01DDD',
        makeTask({ id: 'TASK-01DDD', parent_feature: 'FEAT-01AAA' }),
      ],
    ]);
    const tree = buildTree(plans, features, tasks);
    const taskNodes = tree[0].children[0].children;
    expect(taskNodes).toHaveLength(1);
    expect(taskNodes[0].id).toBe('TASK-01DDD');
    expect(taskNodes[0].entityType).toBe('task');
    expect(taskNodes[0].children).toEqual([]);
  });

  it('sorts features within a plan by ID', () => {
    const plans = new Map([['P1-test', makePlan({ id: 'P1-test' })]]);
    const features = new Map([
      ['FEAT-01BBB', makeFeature({ id: 'FEAT-01BBB', parent: 'P1-test' })],
      ['FEAT-01AAA', makeFeature({ id: 'FEAT-01AAA', parent: 'P1-test' })],
    ]);
    const tree = buildTree(plans, features, new Map());
    expect(tree[0].children.map((n) => n.id)).toEqual([
      'FEAT-01AAA',
      'FEAT-01BBB',
    ]);
  });

  it('creates orphaned plan for features with missing parent', () => {
    const plans = new Map<string, Plan>();
    const features = new Map([
      [
        'FEAT-01CCC',
        makeFeature({ id: 'FEAT-01CCC', parent: 'P99-nonexistent' }),
      ],
    ]);
    const tree = buildTree(plans, features, new Map());
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('__orphaned__');
    expect(tree[0].entityType).toBe('plan');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('FEAT-01CCC');
  });

  it('creates orphaned feature for tasks with missing parent', () => {
    const plans = new Map<string, Plan>();
    const features = new Map<string, Feature>();
    const tasks = new Map([
      [
        'TASK-01GGG',
        makeTask({ id: 'TASK-01GGG', parent_feature: 'FEAT-99NONEXISTENT' }),
      ],
    ]);
    const tree = buildTree(plans, features, tasks);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('__orphaned__');
    // Should have a synthetic feature for orphaned tasks
    const orphanFeature = tree[0].children.find(
      (n) => n.id === '__orphaned-tasks__',
    );
    expect(orphanFeature).toBeDefined();
    expect(orphanFeature!.children).toHaveLength(1);
    expect(orphanFeature!.children[0].id).toBe('TASK-01GGG');
  });
});

describe('taskCompletionForFeature', () => {
  it('counts done tasks, excludes not-planned and duplicate', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done' })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'active' })],
      [
        'T3',
        makeTask({ id: 'T3', parent_feature: 'F1', status: 'not-planned' }),
      ],
    ]);
    const result = taskCompletionForFeature('F1', tasks);
    expect(result).toEqual({ done: 1, total: 2, percentage: 50 });
  });

  it('returns NaN percentage when no non-excluded tasks exist', () => {
    const tasks = new Map<string, Task>();
    const result = taskCompletionForFeature('F1', tasks);
    expect(result.done).toBe(0);
    expect(result.total).toBe(0);
    expect(result.percentage).toBeNaN();
  });

  it('returns NaN when all tasks are excluded', () => {
    const tasks = new Map([
      [
        'T1',
        makeTask({ id: 'T1', parent_feature: 'F1', status: 'not-planned' }),
      ],
      [
        'T2',
        makeTask({ id: 'T2', parent_feature: 'F1', status: 'duplicate' }),
      ],
    ]);
    const result = taskCompletionForFeature('F1', tasks);
    expect(result.percentage).toBeNaN();
  });

  it('returns 100% when all tasks are done', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done' })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'done' })],
      ['T3', makeTask({ id: 'T3', parent_feature: 'F1', status: 'done' })],
    ]);
    const result = taskCompletionForFeature('F1', tasks);
    expect(result).toEqual({ done: 3, total: 3, percentage: 100 });
  });

  it('ignores tasks belonging to other features', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done' })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F2', status: 'done' })],
    ]);
    const result = taskCompletionForFeature('F1', tasks);
    expect(result).toEqual({ done: 1, total: 1, percentage: 100 });
  });
});

describe('featureCompletionForPlan', () => {
  it('counts done features, excludes cancelled and superseded', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'done' })],
      ['F2', makeFeature({ id: 'F2', parent: 'P1', status: 'done' })],
      ['F3', makeFeature({ id: 'F3', parent: 'P1', status: 'developing' })],
      ['F4', makeFeature({ id: 'F4', parent: 'P1', status: 'developing' })],
      ['F5', makeFeature({ id: 'F5', parent: 'P1', status: 'cancelled' })],
    ]);
    const result = featureCompletionForPlan('P1', features);
    expect(result).toEqual({ done: 2, total: 4, percentage: 50 });
  });

  it('returns NaN percentage for empty features', () => {
    const result = featureCompletionForPlan('P1', new Map());
    expect(result.percentage).toBeNaN();
  });
});

describe('estimateRollupForFeature', () => {
  it('sums estimates, counts unestimated, excludes not-planned', () => {
    const tasks = new Map([
      [
        'T1',
        makeTask({
          id: 'T1',
          parent_feature: 'F1',
          status: 'done',
          estimate: 5,
        }),
      ],
      [
        'T2',
        makeTask({
          id: 'T2',
          parent_feature: 'F1',
          status: 'active',
          estimate: 3,
        }),
      ],
      [
        'T3',
        makeTask({ id: 'T3', parent_feature: 'F1', status: 'queued' }),
        // no estimate
      ],
    ]);
    const result = estimateRollupForFeature('F1', tasks);
    expect(result).toEqual({
      totalPoints: 8,
      estimatedCount: 2,
      unestimatedCount: 1,
    });
  });

  it('returns zeros for empty feature', () => {
    const result = estimateRollupForFeature('F1', new Map());
    expect(result).toEqual({
      totalPoints: 0,
      estimatedCount: 0,
      unestimatedCount: 0,
    });
  });

  it('counts all as unestimated when no tasks have estimates', () => {
    const tasks = new Map([
      [
        'T1',
        makeTask({ id: 'T1', parent_feature: 'F1', status: 'queued' }),
      ],
      [
        'T2',
        makeTask({ id: 'T2', parent_feature: 'F1', status: 'active' }),
      ],
    ]);
    const result = estimateRollupForFeature('F1', tasks);
    expect(result).toEqual({
      totalPoints: 0,
      estimatedCount: 0,
      unestimatedCount: 2,
    });
  });

  it('excludes not-planned tasks from rollup', () => {
    const tasks = new Map([
      [
        'T1',
        makeTask({
          id: 'T1',
          parent_feature: 'F1',
          status: 'done',
          estimate: 5,
        }),
      ],
      [
        'T2',
        makeTask({
          id: 'T2',
          parent_feature: 'F1',
          status: 'not-planned',
          estimate: 13,
        }),
      ],
    ]);
    const result = estimateRollupForFeature('F1', tasks);
    expect(result).toEqual({
      totalPoints: 5,
      estimatedCount: 1,
      unestimatedCount: 0,
    });
  });
});

describe('estimateRollupForPlan', () => {
  it('sums feature estimates, excludes cancelled', () => {
    const features = new Map([
      [
        'F1',
        makeFeature({ id: 'F1', parent: 'P1', status: 'done', estimate: 8 }),
      ],
      [
        'F2',
        makeFeature({
          id: 'F2',
          parent: 'P1',
          status: 'developing',
          estimate: 13,
        }),
      ],
      [
        'F3',
        makeFeature({ id: 'F3', parent: 'P1', status: 'proposed' }),
        // no estimate
      ],
      [
        'F4',
        makeFeature({
          id: 'F4',
          parent: 'P1',
          status: 'cancelled',
          estimate: 5,
        }),
      ],
    ]);
    const result = estimateRollupForPlan('P1', features);
    expect(result).toEqual({
      totalPoints: 21,
      estimatedCount: 2,
      unestimatedCount: 1,
    });
  });
});

describe('resolveEntityType', () => {
  const cases: Array<[string, string | null]> = [
    ['FEAT-01KMZA9CP9XEX', 'feature'],
    ['TASK-01ABC123', 'task'],
    ['BUG-01XYZ789', 'bug'],
    ['DEC-01AAA111', 'decision'],
    ['KE-01BBB222', 'knowledge'],
    ['INC-01CCC333', 'incident'],
    ['CHK-01DDD444', 'checkpoint'],
    ['FEAT-01ABC/design-my-feature', 'document'],
    ['PROJECT/policy-security', 'document'],
    ['P1-kbzv', 'plan'],
    ['P12-infra', 'plan'],
    ['unknown-thing', null],
    ['', null],
  ];

  for (const [input, expected] of cases) {
    it(`resolves "${input}" to ${expected}`, () => {
      expect(resolveEntityType(input)).toBe(expected);
    });
  }
});

describe('resolveEntity', () => {
  it('returns entity and type when found', () => {
    // Create a minimal mock of ProjectState with a Plan in the plans map
    const plan = makePlan({ id: 'P1-kbzv' });
    const mockState = {
      plans: new Map([['P1-kbzv', plan]]),
      features: new Map(),
      tasks: new Map(),
      bugs: new Map(),
      decisions: new Map(),
      knowledge: new Map(),
      documents: new Map(),
      incidents: new Map(),
      checkpoints: new Map(),
    } as any;

    const result = resolveEntity('P1-kbzv', mockState);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe('plan');
    expect(result!.entity).toBe(plan);
  });

  it('returns null for unknown ID format', () => {
    const mockState = {
      plans: new Map(),
      features: new Map(),
      tasks: new Map(),
      bugs: new Map(),
      decisions: new Map(),
      knowledge: new Map(),
      documents: new Map(),
      incidents: new Map(),
      checkpoints: new Map(),
    } as any;

    expect(resolveEntity('unknown-thing', mockState)).toBeNull();
  });

  it('returns null for valid format but non-existent entity', () => {
    const mockState = {
      plans: new Map(),
      features: new Map(),
      tasks: new Map(),
      bugs: new Map(),
      decisions: new Map(),
      knowledge: new Map(),
      documents: new Map(),
      incidents: new Map(),
      checkpoints: new Map(),
    } as any;

    expect(resolveEntity('FEAT-01NONEXISTENT', mockState)).toBeNull();
  });
});
```

**Verification:**

1. Run `pnpm vitest run test/data-layer.test.ts` — all tests pass
2. Manual Tauri integration test (the loader depends on `@tauri-apps/plugin-fs`):
   - Copy `test/fixtures/sample-project/` to a temporary location
   - Open it in the running app
   - Verify in devtools console:
     ```
     const s = useProjectStore.getState();
     s.plans.size === 2           // P1-test, P2-other
     s.features.size === 3        // FEAT-01AAA, FEAT-01BBB, FEAT-01CCC
     s.tasks.size === 4           // TASK-01DDD, 01EEE, 01FFF, 01GGG (broken.yaml skipped)
     s.bugs.size === 1            // BUG-01HHH
     s.decisions.size === 1       // DEC-01III
     s.knowledge.size === 1       // KE-01JJJ
     s.documents.size === 1       // PROJECT/design-test
     s.incidents.size === 1       // INC-01KKK
     s.checkpoints.size === 2     // CHK-01LLL, CHK-01MMM
     s.pendingCheckpoints.length === 1  // Only CHK-01LLL
     s.tree[0].id === 'P1-test'         // Plans sorted: P1 before P2
     s.tree[1].id === 'P2-other'
     s.tree[2].id === '__orphaned__'     // Orphan plan at end
     ```
   - Verify a console warning was logged for `broken.yaml`
3. Verify AC-1 through AC-18 from the spec by mapping each to the test cases above

**Estimated effort:** 3 points

---

## Implementation Order Summary

| Phase | Tasks | Can Parallelise? | Cumulative Files |
|-------|-------|-----------------|-----------------|
| 1 | T1: Entity Type Definitions | — | 11 |
| 2 | T2: Constants, T3: YAML Loader, T5: Tree Builder, T6: Metrics | Yes — all independent after T1 | 17 |
| 3 | T4: Zustand Project Store | Needs T1, T3, T5 | 18 |
| 4 | T7: Reference Resolution | Needs T4's interface | 19 |
| 5 | T8: Wire to UI | Needs T4 | 19 (1 modified) |
| 6 | T9: Integration Testing | Needs T1–T8 | 19 + 19 fixture/test files |

---

## Testing Strategy

### Unit Tests (Vitest — no Tauri runtime needed)

These test pure functions with no I/O dependencies:

| Module | What to test |
|--------|-------------|
| `status-colours.ts` | All 37 status→colour mappings, grey fallback for unknown, hex output |
| `entity-types.ts` | 9 entries, all fields present |
| `tree.ts` | Plan sorting (P1 < P2 < P12), feature/task nesting, orphan handling, empty maps |
| `metrics.ts` | All 4 functions: normal cases, edge cases (NaN, empty, all-excluded), estimate != null vs undefined |
| `references.ts` | `resolveEntityType` full prefix table, `resolveEntity` found/not-found/unknown |

### Manual Integration Tests (Tauri runtime required)

The YAML loader and Zustand store require the Tauri filesystem plugin, so they must be tested in the running application:

| Test | Procedure |
|------|-----------|
| Full load cycle | Open the KBZV project itself; inspect store in devtools |
| Fixture project | Open `test/fixtures/sample-project/`; verify all entity counts |
| Missing directories | Open a project with no `state/bugs/` directory; verify no error |
| Broken YAML | Include `broken.yaml` in fixtures; verify console warning, others still load |
| Invalid project | Open a random folder; verify error dialog |
| Loading state | Add a `console.log` breakpoint in `openProject`; verify `loading: true` before data arrives |
| Close project | Open → close → verify all state reset |

### Future: Automated Integration Tests

When F6 (File Watching) adds a test harness that mocks Tauri FS APIs, the manual tests above should be automated. Until then, manual verification is sufficient.

---

## Acceptance Criteria Mapping

Every acceptance criterion from the spec (AC-1 through AC-18) maps to a verification step:

| AC | Description | Verified by |
|----|-------------|-------------|
| AC-1 | Entity map population | T9 manual test — check all 9 map sizes |
| AC-2 | Tree hierarchy | T5 unit tests + T9 manual tree inspection |
| AC-3 | Standalone entity lists | T9 manual test — `store.bugs instanceof Map` |
| AC-4 | Pending checkpoints | T9 manual test — `pendingCheckpoints.length` |
| AC-5 | Task completion metrics | T6 unit tests — all cases |
| AC-6 | Feature completion metrics | T6 unit tests — all cases |
| AC-7 | Estimate rollups | T6 unit tests — all cases |
| AC-8 | Reference resolution — type | T7 unit tests — full prefix table |
| AC-9 | Reference resolution — lookup | T7 unit tests — found/not-found |
| AC-10 | Config parsing | T9 manual test — inspect `store.config` |
| AC-11 | Missing directory resilience | T9 manual test — remove a directory, verify no error |
| AC-12 | Parse error resilience | T9 manual test — `broken.yaml` fixture |
| AC-13 | Unknown field resilience | T9 manual test — add extra fields to fixture YAML |
| AC-14 | Unknown status resilience | T2 unit test — `getStatusColour('xyz')` returns grey |
| AC-15 | Status colour correctness | T2 unit tests — all 37 statuses |
| AC-16 | Orphan handling | T5 unit tests — orphan plan/feature synthetic nodes |
| AC-17 | closeProject resets state | T9 manual test — open then close |
| AC-18 | Loading state management | T8 manual test — observe spinner |

---

## Risk Areas

### 1. Tauri FS API Mismatch (Medium Risk)

**Risk:** The `readDir()` and `readTextFile()` APIs from `@tauri-apps/plugin-fs` may have subtle differences from the expected signatures (e.g. `readDir` return type, error types).

**Mitigation:** Test with the actual Tauri runtime early. The F1 scaffold already has the FS plugin registered and capabilities granted. The first thing to verify after T3 is a manual `loadProject()` call in devtools.

### 2. Large Project Performance (Low Risk)

**Risk:** A project with thousands of YAML files could make the initial load slow.

**Mitigation:** The loader is sequential per directory but parallel across directories would be a trivial optimisation if needed. Expected data sizes (hundreds of files) should load in < 1 second. Monitor load times during manual testing.

### 3. YAML Library Type Coercion (Medium Risk)

**Risk:** The `yaml` npm package may coerce YAML values unexpectedly (e.g. "2" as a number, "true" as a boolean, dates as Date objects).

**Mitigation:** The spec mandates storing all fields as-is — no validation or coercion. The `yaml` library's default options should be tested with the fixture data. If it converts `version: "2"` to a number, we may need to configure `{ schema: 'failsafe' }` or similar. Test this in T3.

### 4. Two-Store Coordination (Low Risk)

**Risk:** `useUIStore.projectPath` and `useProjectStore.projectPath` could get out of sync.

**Mitigation:** T8 sets `useUIStore.projectPath` only after `useProjectStore.openProject()` succeeds. `closeProject()` on the project store does not automatically clear the UI store — T8 must ensure both are cleared together. Document this clearly.

### 5. Document ID Encoding (Low Risk)

**Risk:** DocumentRecord IDs contain `/` which is encoded as `--` in filenames. If the `id` field inside the YAML doesn't match expectations, lookups will fail silently.

**Mitigation:** The loader always reads `id` from inside the YAML, never from the filename. This is correct by design. The fixture data in T9 includes a document with a `/` in its ID to verify this path.

---

## npm Dependencies

All dependencies are already installed by F1. No new packages are needed.

| Package | Version | Used by |
|---------|---------|---------|
| `zustand` | `^5.0.3` | T4: project-store.ts |
| `yaml` | (installed by F1) | T3: loader.ts |
| `@tauri-apps/plugin-fs` | `^2.2.0` | T3: loader.ts |
| `@tauri-apps/plugin-dialog` | `^2.2.0` | T8: MainPanel.tsx (existing) |
| `vitest` | (dev dep, installed by F1) | T9: test runner |

If `yaml` was not installed in F1, add it:

```sh
pnpm add yaml
```

If `vitest` was not installed in F1, add it:

```sh
pnpm add -D vitest
```

---

## References

- [F2: Data Layer — Specification](../spec/f2-data-layer-spec.md)
- [F2: Data Layer — Design Document](../design/f2-data-layer.md)
- [KBZV Architecture Design](../design/kbzv-architecture.md)
- Feature entity: `FEAT-01KMZA9CP9XEX` (data-layer)
- Parent plan: `P1-kbzv`
- Depends on: `FEAT-01KMZA96W1J98` (F1: App Scaffold + Theme)