# F2: Data Layer — Specification

| Field | Value |
|-------|-------|
| **Feature** | FEAT-01KMZA9CP9XEX |
| **Parent Plan** | P1-kbzv |
| **Depends On** | FEAT-01KMZA96W1J98 (F1: App Scaffold + Theme) |
| **Type** | Specification |
| **Author** | sambeau |

---

## 1. File Manifest

Every file created by this feature, listed with its full path relative to the project root. No other files are created or modified.

| # | Path | Purpose |
|---|------|---------|
| 1 | `src/lib/types/plan.ts` | Plan entity interface |
| 2 | `src/lib/types/feature.ts` | Feature entity interface |
| 3 | `src/lib/types/task.ts` | Task entity interface |
| 4 | `src/lib/types/bug.ts` | Bug entity interface |
| 5 | `src/lib/types/decision.ts` | Decision entity interface |
| 6 | `src/lib/types/knowledge.ts` | KnowledgeEntry entity interface |
| 7 | `src/lib/types/document.ts` | DocumentRecord entity interface |
| 8 | `src/lib/types/incident.ts` | Incident entity interface |
| 9 | `src/lib/types/checkpoint.ts` | HumanCheckpoint entity interface |
| 10 | `src/lib/types/config.ts` | ProjectConfig, PrefixEntry, DocumentRoot interfaces |
| 11 | `src/lib/types/index.ts` | Barrel re-exports, union types, EntityTypeName |
| 12 | `src/lib/constants/status-colours.ts` | STATUS_COLOURS palette, STATUS_TO_COLOUR mapping, getStatusColour(), getStatusHex() |
| 13 | `src/lib/constants/entity-types.ts` | EntityTypeInfo interface, ENTITY_TYPES record |
| 14 | `src/lib/reader/loader.ts` | loadProject() — full project directory reader |
| 15 | `src/lib/reader/document.ts` | readDocumentContent() — stub for F4 |
| 16 | `src/lib/store/project-store.ts` | Zustand store: useProjectStore |
| 17 | `src/lib/query/tree.ts` | buildTree() — Plan→Feature→Task hierarchy builder |
| 18 | `src/lib/query/metrics.ts` | Completion metrics and estimate rollup functions |
| 19 | `src/lib/query/references.ts` | resolveEntityType(), resolveEntity() |

**Total: 19 files.**

---

## 2. Entity Type Definitions

All interfaces use exact YAML field names as-is. Optional fields use `?`. Timestamps are `string` (RFC 3339 UTC). Status fields are typed as `string` (not union types) so that unknown future values from newer Kanbanzai schema versions are stored without error.

### 2.1 plan.ts

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

### 2.2 feature.ts

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
 * Backward transitions triggered by document supersession.
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

### 2.3 task.ts

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

### 2.4 bug.ts

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

  /** Lifecycle status. Known values: reported, triaged, reproduced, planned, in-progress, needs-review, verified, closed, cannot-reproduce, needs-rework, duplicate, not-planned */
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

### 2.5 decision.ts

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

### 2.6 knowledge.ts

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

### 2.7 document.ts

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
 * Example: "FEAT-01ABC/design-my-feature" → "FEAT-01ABC--design-my-feature.yaml"
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

### 2.8 incident.ts

```typescript
// src/lib/types/incident.ts

/**
 * An Incident tracks a production or development incident.
 * Standalone entity — cross-linked via affected_features[] and linked_bugs[].
 *
 * ID format: INC-{TSID13}
 *
 * Lifecycle: reported → triaged → investigating → root-cause-identified → mitigated → resolved → closed
 * Back-transitions allowed.
 */
export interface Incident {
  /** Incident identifier. Format: INC-{TSID13} */
  id: string;

  /** URL-friendly identifier */
  slug: string;

  /** Human-readable title */
  title: string;

  /** Lifecycle status. Known values: reported, triaged, investigating, root-cause-identified, mitigated, resolved, closed */
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

### 2.9 checkpoint.ts

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

### 2.10 config.ts

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

### 2.11 index.ts (barrel exports + union types)

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
 * Used by resolveEntityType(), resolveEntity(), reloadEntity(), ENTITY_TYPES, etc.
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

---

## 3. Constants

### 3.1 status-colours.ts

This file defines the complete mapping from entity lifecycle status strings to display colours. Every known status across all nine entity types is mapped. Unknown statuses fall back to grey.

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
 * Grouped by semantic category for readability.
 *
 * IMPORTANT: This record is intentionally typed as Record<string, StatusColourName>
 * (not a union of literal status keys) so that new statuses can be added
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
 *
 * @param status - Any entity status string
 * @returns The StatusColourName. Returns 'grey' for unknown/unrecognised statuses.
 *
 * @example
 * getStatusColour('active')     // → 'yellow'
 * getStatusColour('done')       // → 'green'
 * getStatusColour('xyz-future') // → 'grey'
 */
export function getStatusColour(status: string): StatusColourName {
  return STATUS_TO_COLOUR[status] ?? 'grey';
}

/**
 * Returns the hex colour code for a given status string.
 *
 * @param status - Any entity status string
 * @returns A hex colour string, e.g. '#22C55E'. Returns '#9CA3AF' (grey) for unknown statuses.
 *
 * @example
 * getStatusHex('done')          // → '#22C55E'
 * getStatusHex('xyz-future')    // → '#9CA3AF'
 */
export function getStatusHex(status: string): string {
  return STATUS_COLOURS[getStatusColour(status)];
}
```

**Complete status→colour table (37 statuses):**

| Status | Colour Name | Hex |
|--------|-------------|-----|
| `proposed` | grey | `#9CA3AF` |
| `queued` | grey | `#9CA3AF` |
| `draft` | grey | `#9CA3AF` |
| `reported` | grey | `#9CA3AF` |
| `designing` | blue | `#3B82F6` |
| `specifying` | blue | `#3B82F6` |
| `dev-planning` | blue | `#3B82F6` |
| `ready` | blue | `#3B82F6` |
| `planned` | blue | `#3B82F6` |
| `contributed` | blue | `#3B82F6` |
| `triaged` | blue | `#3B82F6` |
| `reproduced` | blue | `#3B82F6` |
| `active` | yellow | `#EAB308` |
| `in-progress` | yellow | `#EAB308` |
| `investigating` | yellow | `#EAB308` |
| `developing` | yellow | `#EAB308` |
| `root-cause-identified` | yellow | `#EAB308` |
| `blocked` | orange | `#F97316` |
| `needs-review` | orange | `#F97316` |
| `needs-rework` | orange | `#F97316` |
| `disputed` | orange | `#F97316` |
| `pending` | orange | `#F97316` |
| `mitigated` | orange | `#F97316` |
| `done` | green | `#22C55E` |
| `closed` | green | `#22C55E` |
| `verified` | green | `#22C55E` |
| `approved` | green | `#22C55E` |
| `accepted` | green | `#22C55E` |
| `confirmed` | green | `#22C55E` |
| `resolved` | green | `#22C55E` |
| `responded` | green | `#22C55E` |
| `cancelled` | red | `#EF4444` |
| `not-planned` | red | `#EF4444` |
| `rejected` | red | `#EF4444` |
| `duplicate` | red | `#EF4444` |
| `retired` | red | `#EF4444` |
| `cannot-reproduce` | red | `#EF4444` |
| `superseded` | purple | `#A855F7` |
| *(any unknown)* | grey | `#9CA3AF` |

> **Note on additions vs. design doc:** The design doc's `STATUS_TO_COLOUR` omitted `reported`, `triaged`, `reproduced`, `root-cause-identified`, `mitigated`, and `responded`. These are statuses that appear on Bug, Incident, and Checkpoint entities and were defined in the entity lifecycle sections. This spec adds them for completeness. Categorisation follows the same semantic grouping rules defined in the design doc.

### 3.2 entity-types.ts

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

---

## 4. Directory Reader

### 4.1 loader.ts — loadProject() function

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
      .filter((name): name is string => typeof name === 'string' && name.endsWith('.yaml'));

    for (const filename of yamlFiles) {
      try {
        const content = await readTextFile(`${dirPath}/${filename}`);

        // Skip empty files
        if (!content || content.trim().length === 0) {
          console.warn(`${LOG_PREFIX} Skipping ${dir}/${filename}: empty file`);
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

**readDir return type note:** The Tauri `@tauri-apps/plugin-fs` `readDir()` function returns `Array<{ name: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean }>`. We use only the `name` property. The implementation maps entries to `e.name` and filters for `.yaml` suffix.

**YAML parsing details:**
- **Library:** `yaml` npm package — full YAML 1.2 support with TypeScript types
- **Unknown fields:** silently ignored. The parsed object is spread into the typed interface — extra fields are harmless and provide forward compatibility with newer Kanbanzai schema versions
- **Missing optional fields:** absent in the parsed object, matching the `?` optional type declarations
- **Type coercion:** none. If a YAML field that should be a number arrives as a string, store it as-is. The viewer is read-only and must not crash on unexpected types
- **Empty files:** skip with a warning (no entity to store)

**Directory → Entity type mapping:**

| Directory under `.kbz/state/` | LoadResult key | TypeScript type | Filename pattern | ID source |
|-------------------------------|---------------|-----------------|-----------------|-----------|
| `plans/` | `plans` | `Plan` | `{id}.yaml` | `id` field in YAML |
| `features/` | `features` | `Feature` | `{id}-{slug}.yaml` | `id` field in YAML |
| `tasks/` | `tasks` | `Task` | `{id}-{slug}.yaml` | `id` field in YAML |
| `bugs/` | `bugs` | `Bug` | `{id}-{slug}.yaml` | `id` field in YAML |
| `decisions/` | `decisions` | `Decision` | `{id}-{slug}.yaml` | `id` field in YAML |
| `documents/` | `documents` | `DocumentRecord` | `{id with / → --}.yaml` | `id` field in YAML |
| `knowledge/` | `knowledge` | `KnowledgeEntry` | `{id}.yaml` | `id` field in YAML |
| `incidents/` | `incidents` | `Incident` | `{id}-{slug}.yaml` | `id` field in YAML |
| `checkpoints/` | `checkpoints` | `HumanCheckpoint` | `{id}.yaml` | `id` field in YAML |

**Critical rule:** The entity ID is **always** read from the `id` field inside the parsed YAML content, never from the filename. Filenames are used only for directory listing. This is especially important for DocumentRecord IDs which contain encoded slashes.

### 4.2 document.ts — readDocumentContent() stub

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

---

## 5. Zustand Store

### 5.1 project-store.ts — full implementation

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
   *
   * @param path - Absolute filesystem path to the project root
   *
   * On success: populates all entity maps, config, tree, pendingCheckpoints.
   * On failure: sets error with descriptive message, all maps remain empty.
   */
  openProject: (path: string) => Promise<void>;

  /**
   * Re-parse a single entity file and update the appropriate map.
   * Recomputes tree and pendingCheckpoints after the update.
   *
   * Stub in F2 — fully implemented in F6 (File Watching & Git Status).
   *
   * @param entityType - Which entity map to update
   * @param filePath - Absolute path to the YAML file that changed
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
    // 2. Update the entity in the appropriate map (get()[_entityType + 's'] or similar)
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

Both are stored as plain values (not selectors or computed getters) because:
1. They must be recomputed as a batch after full project load
2. The computation is cheap for expected data sizes (hundreds of entities)
3. Zustand's `create()` does not support native computed fields; middleware like `subscribeWithSelector` adds unnecessary complexity for this use case

---

## 6. Query Layer

### 6.1 tree.ts — buildTree() with exact algorithm

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
 *
 * @param plan - The Plan entity
 * @returns A tuple of [prefix_letter, numeric_index]
 *
 * @example
 * planSortKey({ id: 'P1-kbzv' })   // → ['P', 1]
 * planSortKey({ id: 'P12-infra' }) // → ['P', 12]
 * planSortKey({ id: 'weird-id' })  // → ['weird-id', 0]
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
 *
 * @returns Negative if a < b, positive if a > b, zero if equal.
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
 * produces chronological (creation-time) order for Features, Tasks,
 * and all other TSID-based entities.
 *
 * @returns Negative if a < b, positive if a > b, zero if equal.
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
 * 7. Features whose parent plan does not exist are collected into an
 *    "Orphaned Features" synthetic plan node, appended at the end.
 * 8. Tasks whose parent_feature does not exist are collected into an
 *    "Orphaned Tasks" synthetic feature node under the orphan plan.
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
  // Features whose parent plan doesn't exist, and tasks whose
  // parent feature doesn't exist, are placed in synthetic nodes.

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

These IDs use double-underscore prefixes which cannot collide with real Kanbanzai IDs (which use uppercase prefixes like `P1-`, `FEAT-`, `TASK-`).

### 6.2 metrics.ts — all metric functions

```typescript
// src/lib/query/metrics.ts

import type { Plan, Feature, Task } from '../types';

// ── Constants ───────────────────────────────────────────────────────

/**
 * Task statuses that are excluded from completion metric denominators.
 * These are terminal-negative statuses — the task was not done, it was
 * removed from scope.
 */
const TASK_EXCLUDED_STATUSES: readonly string[] = ['not-planned', 'duplicate'];

/**
 * Feature statuses that are excluded from completion metric denominators.
 * These are terminal-negative statuses — the feature was not done, it was
 * removed from scope.
 */
const FEATURE_EXCLUDED_STATUSES: readonly string[] = ['cancelled', 'superseded'];

// ── Metric Interfaces ───────────────────────────────────────────────

/**
 * Completion metrics for a set of entities.
 *
 * Edge case behaviour:
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
   * Range: 0–100 when total > 0.
   * Value: NaN when total is 0.
   */
  percentage: number;
}

/**
 * Estimate rollup for a set of entities.
 *
 * Edge case behaviour:
 * - When all entities are unestimated: totalPoints = 0, estimatedCount = 0.
 * - When no entities exist (or all excluded): all fields are 0.
 * - Entities without an estimate field are counted as unestimated — never as 0.
 */
export interface EstimateRollup {
  /** Sum of estimate values for all estimated entities */
  totalPoints: number;

  /** Count of entities that have an estimate value (estimate != null) */
  estimatedCount: number;

  /** Count of entities that do NOT have an estimate value (estimate is undefined/null) */
  unestimatedCount: number;
}

// ── Task Completion by Feature ──────────────────────────────────────

/**
 * Computes task completion metrics for a single feature.
 *
 * Iterates all tasks in the map, selects those belonging to the given
 * feature, excludes tasks with terminal-negative statuses, and counts
 * how many are done.
 *
 * @param featureId - The Feature ID to compute metrics for
 * @param tasks - All Task entities, keyed by ID
 * @returns CompletionMetrics. percentage is NaN if the feature has no non-excluded tasks.
 *
 * @example
 * // Feature has 3 tasks: done, active, not-planned
 * // → { done: 1, total: 2, percentage: 50 }
 * // (not-planned is excluded from total)
 *
 * @example
 * // Feature has 0 tasks
 * // → { done: 0, total: 0, percentage: NaN }
 *
 * @example
 * // Feature has 2 tasks, both not-planned
 * // → { done: 0, total: 0, percentage: NaN }
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
 * Iterates all features in the map, selects those belonging to the given
 * plan, excludes features with terminal-negative statuses, and counts
 * how many are done.
 *
 * @param planId - The Plan ID to compute metrics for
 * @param features - All Feature entities, keyed by ID
 * @returns CompletionMetrics. percentage is NaN if the plan has no non-excluded features.
 *
 * @example
 * // Plan has 5 features: 2 done, 2 developing, 1 cancelled
 * // → { done: 2, total: 4, percentage: 50 }
 * // (cancelled is excluded from total)
 *
 * @example
 * // Plan has 0 features
 * // → { done: 0, total: 0, percentage: NaN }
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
 * Sums the estimate values for tasks that have one, and counts
 * those that don't. Tasks with terminal-negative statuses are excluded.
 *
 * @param featureId - The Feature ID to roll up estimates for
 * @param tasks - All Task entities, keyed by ID
 * @returns EstimateRollup. All fields are 0 if no non-excluded tasks exist.
 *
 * @example
 * // 3 tasks: estimate=5, estimate=3, no estimate
 * // → { totalPoints: 8, estimatedCount: 2, unestimatedCount: 1 }
 *
 * @example
 * // 2 tasks, both without estimates
 * // → { totalPoints: 0, estimatedCount: 0, unestimatedCount: 2 }
 *
 * @example
 * // 0 tasks (or all not-planned/duplicate)
 * // → { totalPoints: 0, estimatedCount: 0, unestimatedCount: 0 }
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
 * Sums the estimate values for features that have one, and counts
 * those that don't. Features with terminal-negative statuses are excluded.
 *
 * @param planId - The Plan ID to roll up estimates for
 * @param features - All Feature entities, keyed by ID
 * @returns EstimateRollup. All fields are 0 if no non-excluded features exist.
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

**Metric formulas summary:**

| Function | Formula | Denominator excludes | Done means | NaN when |
|----------|---------|---------------------|------------|----------|
| `taskCompletionForFeature` | `(done / total) * 100` | `not-planned`, `duplicate` | `status === 'done'` | `total === 0` |
| `featureCompletionForPlan` | `(done / total) * 100` | `cancelled`, `superseded` | `status === 'done'` | `total === 0` |
| `estimateRollupForFeature` | sum of `task.estimate` | `not-planned`, `duplicate` | N/A | N/A (returns 0s) |
| `estimateRollupForPlan` | sum of `feature.estimate` | `cancelled`, `superseded` | N/A | N/A (returns 0s) |

**Critical rule:** Entities without an `estimate` field are counted as "unestimated" — they are **never** treated as having an estimate of zero. The `estimate != null` check uses loose inequality (`!=` not `!==`) to catch both `undefined` and `null`.

### 6.3 references.ts — resolveEntityType() and resolveEntity()

```typescript
// src/lib/query/references.ts

import type { EntityTypeName } from '../types';
import type { ProjectState } from '../store/project-store';

// ── resolveEntityType ───────────────────────────────────────────────

/**
 * Determines entity type from an ID string by examining its prefix.
 *
 * The order of checks is significant:
 * 1. Exact prefix matches (FEAT-, TASK-, BUG-, DEC-, KE-, INC-, CHK-) — checked first
 * 2. Document detection (contains "/") — checked before the plan regex
 *    because document IDs like "FEAT-01ABC/design-my-feature" would
 *    otherwise partially match the plan pattern
 * 3. Plan pattern ({Letter}{Digit}+-) — checked last as a fallback
 *
 * @param id - An entity ID string
 * @returns The EntityTypeName, or null if the ID doesn't match any known pattern
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
 *
 * @example
 * resolveEntityType('FEAT-01KMZA9CP9XEX')                    // → 'feature'
 * resolveEntityType('TASK-01ABC123')                          // → 'task'
 * resolveEntityType('BUG-01XYZ789')                           // → 'bug'
 * resolveEntityType('DEC-01AAA111')                           // → 'decision'
 * resolveEntityType('KE-01BBB222')                            // → 'knowledge'
 * resolveEntityType('INC-01CCC333')                           // → 'incident'
 * resolveEntityType('CHK-01DDD444')                           // → 'checkpoint'
 * resolveEntityType('FEAT-01ABC/design-my-feature')           // → 'document'
 * resolveEntityType('PROJECT/policy-security')                // → 'document'
 * resolveEntityType('P1-kbzv')                                // → 'plan'
 * resolveEntityType('P12-infra')                              // → 'plan'
 * resolveEntityType('something-unknown')                      // → null
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
 * Used by resolveEntity() to look up the correct entity map.
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
 *
 * @example
 * resolveEntity('nonexistent-id', state); // → null
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

---

## 7. Error Handling Matrix

Every error scenario, its trigger condition, and the exact behaviour.

### 7.1 Fatal Errors (openProject throws)

These errors abort the load and cause the store to set `error` with the message below.

| # | Scenario | Trigger | Error message | Store state after |
|---|----------|---------|--------------|-------------------|
| 1 | Config file missing | `readTextFile()` throws for `{path}/.kbz/config.yaml` | `"Not a Kanbanzai project: .kbz/config.yaml not found"` | `loading: false, error: <message>, all maps empty` |
| 2 | Config file unparseable | `parseYaml()` throws on config content | `"Failed to parse .kbz/config.yaml: {yaml error details}"` | `loading: false, error: <message>, all maps empty` |
| 3 | Config missing version | Parsed config has no `version` field | `".kbz/config.yaml is missing required 'version' field"` | `loading: false, error: <message>, all maps empty` |

### 7.2 Non-Fatal Warnings (logged, entity skipped)

These do not abort the load. The affected entity is skipped; all other entities continue loading.

| # | Scenario | Trigger | Console output | Behaviour |
|---|----------|---------|---------------|-----------|
| 4 | Entity directory missing | `readDir()` throws for `state/{dir}/` | *(none — silent skip)* | Empty map for that entity type |
| 5 | `state/` directory missing | `readDir()` throws for all entity dirs | *(none — silent skip)* | All entity maps empty (valid for new project) |
| 6 | YAML parse error | `parseYaml()` throws for a single entity file | `[kbzv] Skipping {dir}/{filename}: {error}` | File skipped, other files in same directory still loaded |
| 7 | YAML file has no `id` field | Parsed object has no `id` property | `[kbzv] Skipping {dir}/{filename}: no 'id' field found` | File skipped |
| 8 | Empty YAML file | File content is empty or whitespace-only | `[kbzv] Skipping {dir}/{filename}: empty file` | File skipped |
| 9 | Unknown fields in YAML | Parsed object has properties not in the TypeScript interface | *(none — silently stored)* | Extra properties are harmless; forward-compatible |
| 10 | Unknown status value | Entity has a status string not in STATUS_TO_COLOUR | *(none at parse time)* | Stored as-is; `getStatusColour()` returns `'grey'` |
| 11 | Broken cross-reference | `resolveEntity()` called with ID pointing to nonexistent entity | *(none)* | Returns `null`; caller renders "not found" indicator |
| 12 | `schema_version` absent | Config lacks `schema_version` field | *(none)* | Treated as pre-1.0 project; parsed best-effort |
| 13 | Missing optional fields | YAML entity lacks optional (`?`) fields | *(none)* | Fields are `undefined` in the TypeScript object |
| 14 | Type coercion mismatch | YAML field has wrong type (e.g. string where number expected) | *(none)* | Stored as-is; viewer is read-only, must not crash |
| 15 | Circular `supersedes` refs | Entity A supersedes B, B supersedes A | *(none)* | Stored as-is; no recursion risk (tree uses hierarchy, not refs) |

### 7.3 Log Format

All console warnings use the `[kbzv]` prefix:

```
[kbzv] Skipping bugs/BUG-01ABC-broken.yaml: YAML parse error at line 5
[kbzv] Skipping tasks/TASK-01XYZ-empty.yaml: no 'id' field found
[kbzv] Skipping features/FEAT-01DEF-blank.yaml: empty file
```

---

## 8. Implementation Order

Tasks should be implemented in this order. Each step builds on the previous one.

| Order | Files | Depends on | Description |
|-------|-------|-----------|-------------|
| 1 | `src/lib/types/*.ts` (all 11 files) | Nothing | Type definitions — no runtime code, no imports between them except index.ts barrel |
| 2 | `src/lib/constants/status-colours.ts` | Step 1 (types) | Status colour palette and mapping — pure functions, no external deps |
| 3 | `src/lib/constants/entity-types.ts` | Step 1 (types) | Entity type metadata — pure data, imports only `EntityTypeName` |
| 4 | `src/lib/query/references.ts` | Step 1 (types) | Reference resolution — pure functions, imports types and store interface |
| 5 | `src/lib/query/metrics.ts` | Step 1 (types) | Metric functions — pure functions, imports only entity types |
| 6 | `src/lib/query/tree.ts` | Step 1 (types) | Tree builder — pure function, imports only entity types |
| 7 | `src/lib/reader/document.ts` | Nothing | Document content stub — returns null |
| 8 | `src/lib/reader/loader.ts` | Step 1 (types) | Project loader — imports `@tauri-apps/plugin-fs`, `yaml`, entity types |
| 9 | `src/lib/store/project-store.ts` | Steps 1, 6, 8 | Zustand store — imports loader, tree builder, all types |

**Rationale:** Types first, then pure functions (constants, queries), then IO (loader), then the store that wires everything together. This order maximises testability — each step can be unit tested independently.

---

## 9. Acceptance Criteria

Each criterion maps to a testable assertion. Implementation is complete when all criteria pass.

### AC-1: Entity map population

**Given** a Kanbanzai project directory with YAML files in `.kbz/state/{entity-dir}/`
**When** `openProject(path)` is called
**Then** all 9 entity maps are populated with correctly typed data, each entity keyed by its `id` field. All fields from the YAML are preserved in the TypeScript objects.

**Test:** Open a sample project, verify `store.plans.get('P1-kbzv')` returns a Plan with all expected fields.

### AC-2: Tree hierarchy

**Given** a loaded project with Plans, Features, and Tasks
**When** `buildTree()` is called
**Then:**
- Features are nested under their parent Plan (matched by `feature.parent === plan.id`)
- Tasks are nested under their parent Feature (matched by `task.parent_feature === feature.id`)
- Plans are sorted by prefix letter + numeric index: P1 before P2 before P12
- Features within a plan are sorted lexicographically by ID
- Tasks within a feature are sorted lexicographically by ID

**Test:** Create plans P2, P1, P10 with features and tasks. Verify `tree[0].id === 'P1-...'`, `tree[1].id === 'P2-...'`, `tree[2].id === 'P10-...'`.

### AC-3: Standalone entity lists

**Given** a loaded project
**Then** Bugs, Decisions, Incidents, DocumentRecords, KnowledgeEntries, and HumanCheckpoints are accessible as flat `Map<string, T>` from the store.

**Test:** Verify `store.bugs instanceof Map` and `store.bugs.get('BUG-01XYZ')` returns a Bug object.

### AC-4: Pending checkpoints

**Given** a loaded project with HumanCheckpoints, some with `status: 'pending'` and some with `status: 'responded'`
**Then** `store.pendingCheckpoints` contains exactly the checkpoints with `status === 'pending'`.

**Test:** Create 3 checkpoints (2 pending, 1 responded). Verify `store.pendingCheckpoints.length === 2`.

### AC-5: Task completion metrics

**Given** a feature with tasks in various statuses
**Then** `taskCompletionForFeature()` returns correct metrics:
- `done` = count of tasks with `status === 'done'`
- `total` = count of tasks excluding `not-planned` and `duplicate`
- `percentage` = `(done / total) * 100`, or `NaN` when total is 0

**Test cases:**
- 3 tasks (done, active, not-planned) → `{ done: 1, total: 2, percentage: 50 }`
- 0 tasks → `{ done: 0, total: 0, percentage: NaN }`
- 2 tasks (not-planned, duplicate) → `{ done: 0, total: 0, percentage: NaN }`
- 3 tasks (done, done, done) → `{ done: 3, total: 3, percentage: 100 }`

### AC-6: Feature completion metrics

**Given** a plan with features in various statuses
**Then** `featureCompletionForPlan()` returns correct metrics:
- `done` = count of features with `status === 'done'`
- `total` = count of features excluding `cancelled` and `superseded`
- `percentage` = `(done / total) * 100`, or `NaN` when total is 0

**Test cases:**
- 5 features (2 done, 2 developing, 1 cancelled) → `{ done: 2, total: 4, percentage: 50 }`
- 0 features → `{ done: 0, total: 0, percentage: NaN }`

### AC-7: Estimate rollups

**Given** a feature with tasks (some estimated, some not)
**Then** `estimateRollupForFeature()` returns:
- `totalPoints` = sum of `estimate` values for tasks that have one
- `estimatedCount` = number of tasks with an `estimate`
- `unestimatedCount` = number of tasks without an `estimate`
- Excluded statuses are not counted at all

**Test cases:**
- Tasks with estimates [5, 3, null] → `{ totalPoints: 8, estimatedCount: 2, unestimatedCount: 1 }`
- All unestimated [null, null] → `{ totalPoints: 0, estimatedCount: 0, unestimatedCount: 2 }`
- Empty → `{ totalPoints: 0, estimatedCount: 0, unestimatedCount: 0 }`

Same logic applies to `estimateRollupForPlan()` over features.

### AC-8: Reference resolution — type detection

**Given** various entity ID strings
**Then** `resolveEntityType()` returns the correct type:

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

### AC-9: Reference resolution — entity lookup

**Given** a loaded project and a valid entity ID
**When** `resolveEntity(id, state)` is called
**Then** it returns `{ entityType, entity }` with the correct type and entity object.

**Given** an unknown or non-existent ID
**Then** `resolveEntity()` returns `null`.

### AC-10: Config parsing

**Given** a `.kbz/config.yaml` file
**Then** `ProjectConfig` correctly reads:
- `version` (string, always present)
- `schema_version` (string, optional — absent in pre-1.0)
- `prefixes` (array of PrefixEntry; may be empty)
- `documents.roots` (array of DocumentRoot; may be absent)

### AC-11: Missing directory resilience

**Given** a project where some `state/` subdirectories do not exist
**When** `openProject()` is called
**Then** missing directories are silently skipped. The corresponding entity maps are empty. No errors are thrown or logged.

### AC-12: Parse error resilience

**Given** a `state/tasks/` directory with 3 YAML files, one of which contains invalid YAML
**When** `openProject()` is called
**Then:**
- The invalid file is skipped
- A warning is logged: `[kbzv] Skipping tasks/{filename}: {error}`
- The other 2 valid files are loaded successfully
- `openProject()` does not throw

### AC-13: Unknown field resilience

**Given** a YAML file with fields not present in the TypeScript interface (e.g. a new schema field)
**When** the file is parsed
**Then** no error occurs. Extra fields are preserved on the object (JavaScript doesn't enforce interface shapes at runtime).

### AC-14: Unknown status resilience

**Given** an entity with `status: 'some-future-status'`
**Then:**
- The entity is stored with the status as-is
- `getStatusColour('some-future-status')` returns `'grey'`
- `getStatusHex('some-future-status')` returns `'#9CA3AF'`
- The application does not crash

### AC-15: Status colour correctness

**Then** `getStatusColour()` returns the correct colour name for every status in the mapping table (§3.1), and `'grey'` for any unmapped status.

### AC-16: Orphan handling

**Given** a feature whose `parent` plan ID does not exist in the plans map, and a task whose `parent_feature` ID does not exist in the features map
**When** `buildTree()` is called
**Then:**
- The orphaned feature appears under a synthetic plan with `id: '__orphaned__'`
- The orphaned task appears under a synthetic feature with `id: '__orphaned-tasks__'`
- Neither is discarded

### AC-17: closeProject resets state

**Given** a project is open
**When** `closeProject()` is called
**Then** all state fields are reset to their initial values:
- `projectPath` = `null`
- `config` = `null`
- All 9 entity maps = `new Map()` (empty)
- `tree` = `[]`
- `pendingCheckpoints` = `[]`
- `loading` = `false`
- `error` = `null`

### AC-18: Loading state management

**When** `openProject()` is called:
1. Immediately: `loading` = `true`, `error` = `null`
2. On success: `loading` = `false`, all data populated
3. On failure: `loading` = `false`, `error` = descriptive message string

### Checklist

- [ ] All 9 entity maps are populated with correctly typed data after `openProject()`
- [ ] Features are nested under their parent Plan in the tree hierarchy
- [ ] Tasks are nested under their parent Feature in the tree hierarchy
- [ ] Plans are sorted by prefix letter + numeric index (P1, P2, P10)
- [ ] Bugs, Decisions, Incidents, Documents, Knowledge, and Checkpoints are accessible as flat Maps
- [ ] `pendingCheckpoints` contains only checkpoints with `status === 'pending'`
- [ ] `taskCompletionForFeature()` returns correct done/total/percentage metrics
- [ ] `featureCompletionForPlan()` returns correct done/total/percentage metrics
- [ ] `estimateRollupForFeature()` returns correct totalPoints/estimatedCount/unestimatedCount
- [ ] `estimateRollupForPlan()` returns correct rollup over features
- [ ] `resolveEntityType()` returns correct type for all ID prefix patterns
- [ ] `resolveEntity()` returns entity + type for known IDs and null for unknown IDs
- [ ] Config parsing reads version, schema_version, prefixes, and document roots
- [ ] Missing state subdirectories are silently skipped without error
- [ ] Invalid YAML files are skipped with a warning; other files still load
- [ ] Unknown status values return `'grey'` from `getStatusColour()` without crashing
- [ ] Orphaned features appear under a synthetic `__orphaned__` plan node
- [ ] Orphaned tasks appear under a synthetic `__orphaned-tasks__` feature node
- [ ] `closeProject()` resets all state fields to their initial values
- [ ] Loading state is set to `true` on start, `false` on completion or failure

---

## References

- [F2: Data Layer — Design Document](../design/f2-data-layer.md) — primary source
- [KBZV Architecture Design](../design/kbzv-architecture.md) — §4 Data Model, §5 Directory Reading
- Feature entity: `FEAT-01KMZA9CP9XEX` (data-layer)
- Parent plan: `P1-kbzv`
- Depends on: `FEAT-01KMZA96W1J98` (F1: App Scaffold + Theme)