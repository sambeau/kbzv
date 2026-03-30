# KBZV Architecture Design

## 1. Overview

KBZV (Kanbanzai Viewer) is a read-only desktop application for browsing Kanbanzai-managed projects. It renders Markdown documents, displays the entity hierarchy (Plans → Features → Tasks), shows lifecycle states and progress metrics, and provides cross-reference navigation between entities and documents.

KBZV is a viewer — it never writes to `.kbz/`. All mutations flow through the kanbanzai MCP server or CLI.

### 1.1 Design Goals

1. **Zero-friction usage** — double-click to open, File → Open to pick a project folder
2. **Beautiful document rendering** — Markdown is the primary content; it must look excellent
3. **Live updates** — watch the `.kbz/state/` directory and refresh when kanbanzai writes
4. **Graceful degradation** — handle missing fields, broken references, unknown enum values without crashing
5. **Single binary** — ship as one `.app` bundle, no runtime dependencies

### 1.2 v1.0 Scope (Minimal+)

| Included | Deferred |
|----------|----------|
| Open project (folder picker) | Search (v1.1 — command palette ⌘K) |
| **Documents view** — list, filters, markdown viewer | Kanban board view |
| **Workflows view** — nested entity tree, detail panel | Timeline / Gantt view |
| Status badges (colour-coded lozenges) | MCP server integration |
| Cross-reference navigation between views | Write operations |
| Document drift detection (content hash) | Multi-window / multi-project |
| File watching (auto-refresh on change) | |
| Git status panel (read-only) | |
| Pending human checkpoints (prominent display) | |
| Progress metrics (task completion %, estimate rollups) | |

---

## 2. Technology Stack

### 2.1 Decision: Tauri v2 + React/TypeScript

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **App shell** | Tauri v2 | Native desktop app, ~5-10 MB binary, macOS/Windows/Linux |
| **Frontend** | React 18 + TypeScript | Deepest ecosystem for Markdown rendering, tree views, UI |
| **Build** | Vite | Tauri's default bundler, fast HMR |
| **Styling** | Tailwind CSS 4 | Utility-first, rapid iteration, consistent design |
| **State** | Zustand | Lightweight, no boilerplate, good TypeScript support |
| **Markdown** | react-markdown + remark-gfm + rehype-highlight | Best-in-class rendering with GFM tables, syntax highlighting |
| **YAML** | `yaml` (npm) | Full YAML 1.2, TypeScript types, handles all kbz conventions |
| **Icons** | Lucide React | Clean, consistent, tree-shakeable |
| **File access** | @tauri-apps/plugin-fs | Read files, watch directories |
| **Dialogs** | @tauri-apps/plugin-dialog | Native folder picker |

### 2.2 Why Tauri over Alternatives

| Alternative | Reason not chosen |
|-------------|-------------------|
| **Wails (Go)** | Smaller community (~25k vs ~85k stars), less training data for AI agents, no multi-window in v2 |
| **Electron** | 150+ MB binaries, excessive resource usage for a document viewer |
| **Go server + browser** | Not a native app — port conflicts, firewall prompts, no native menus |
| **Native macOS (Swift)** | Locked to one platform, poor Markdown rendering ecosystem |
| **Next.js** | Not a desktop app, requires Node.js runtime |

### 2.3 Why Not the Go `kbzschema` Library

The `kbzschema` Go package provides a `Reader` with directory walking and cross-reference resolution for Plans, Features, Tasks, Bugs, and DocumentRecords. However:

- It does not cover Decisions, KnowledgeEntries, Checkpoints, or Incidents (4 of 9 entity types)
- The YAML format is simple (block style, no exotic features) — parsing in TypeScript is trivial
- The schema reference and JSON Schema provide complete type information
- Choosing Go for the backend would mean either Wails (smaller ecosystem) or a server (not an app)
- The TypeScript ecosystem offers superior Markdown rendering, which is the core feature

TypeScript types will be derived from `schema-reference.md` and the published JSON Schema.

---

## 3. Architecture

### 3.1 High-Level Structure

```
┌──────────────────────────────────────────┐
│              Tauri v2 App                │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │   TypeScript/React (~95% of code)  │  │
│  │                                    │  │
│  │  ┌─────────────┐ ┌─────────────┐  │  │
│  │  │  Data Layer  │ │  UI Layer   │  │  │
│  │  │             │ │             │  │  │
│  │  │ • YAML parse│ │ • Sidebar   │  │  │
│  │  │ • Entity    │ │ • Detail    │  │  │
│  │  │   model     │ │ • Markdown  │  │  │
│  │  │ • Watcher   │ │ • Badges    │  │  │
│  │  │ • Metrics   │ │ • Metrics   │  │  │
│  │  └─────────────┘ └─────────────┘  │  │
│  └──────────────┬─────────────────────┘  │
│                 │ Tauri FS plugin         │
│  ┌──────────────┴─────────────────────┐  │
│  │  Rust (minimal — app scaffold)     │  │
│  │  • Permissions, window config      │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
         │ reads
    .kbz/state/*.yaml  +  work/**/*.md
```

### 3.2 Data Flow

1. **Open project** — user picks a folder via native dialog; app validates `.kbz/config.yaml` exists
2. **Initial load** — walk `.kbz/state/` subdirectories, parse all YAML files, build entity model in memory
3. **Render** — sidebar tree populates from entity model; clicking an entity shows its detail panel
4. **Document view** — clicking a document reference reads the Markdown file via its `path` field, renders it
5. **File watch** — `@tauri-apps/plugin-fs` watches `.kbz/state/` for changes; on change, re-read affected files and update the model
6. **Cross-reference** — clicking a reference field (e.g., `parent`, `design`, `origin_feature`) navigates to that entity

### 3.3 Project Structure

```
kbzv/
├── src-tauri/                    # Rust (Tauri scaffold)
│   ├── src/
│   │   └── lib.rs               # App setup, permissions
│   ├── Cargo.toml
│   ├── tauri.conf.json          # Window config, permissions
│   └── capabilities/            # Tauri v2 permission capabilities
│
├── src/                          # TypeScript/React (the app)
│   ├── App.tsx                   # Root component, layout
│   ├── main.tsx                  # Entry point
│   │
│   ├── lib/                      # Data layer (no UI)
│   │   ├── types/                # Entity type definitions
│   │   │   ├── plan.ts
│   │   │   ├── feature.ts
│   │   │   ├── task.ts
│   │   │   ├── bug.ts
│   │   │   ├── decision.ts
│   │   │   ├── knowledge.ts
│   │   │   ├── document.ts
│   │   │   ├── incident.ts
│   │   │   ├── checkpoint.ts
│   │   │   ├── config.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── store/                # Zustand stores
│   │   │   ├── project-store.ts  # Project state (entities, config)
│   │   │   └── ui-store.ts       # UI state (selection, navigation)
│   │   │
│   │   ├── reader/               # .kbz directory reading
│   │   │   ├── loader.ts         # Walk dirs, parse YAML, build model
│   │   │   ├── watcher.ts        # File system watching
│   │   │   └── document.ts       # Markdown file reading + drift detection
│   │   │
│   │   ├── query/                # Derived data
│   │   │   ├── tree.ts           # Entity hierarchy builder
│   │   │   ├── metrics.ts        # Progress, completion %, rollups
│   │   │   └── references.ts     # Cross-reference resolution
│   │   │
│   │   └── constants/
│   │       ├── status-colours.ts # Status → colour mapping
│   │       └── entity-types.ts   # Entity type metadata
│   │
│   ├── components/               # React components
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx     # Sidebar + main area
│   │   │   ├── Sidebar.tsx
│   │   │   └── MainPanel.tsx
│   │   │
│   │   ├── tree/
│   │   │   ├── EntityTree.tsx    # Full tree view
│   │   │   ├── TreeNode.tsx      # Individual node (plan/feature/task)
│   │   │   └── TreeContext.tsx   # Expand/collapse state
│   │   │
│   │   ├── entity/
│   │   │   ├── EntityDetail.tsx  # Generic entity detail view
│   │   │   ├── PlanDetail.tsx
│   │   │   ├── FeatureDetail.tsx
│   │   │   ├── TaskDetail.tsx
│   │   │   ├── BugDetail.tsx
│   │   │   ├── DecisionDetail.tsx
│   │   │   ├── CheckpointDetail.tsx
│   │   │   └── FieldValue.tsx    # Renders a field, linkifying references
│   │   │
│   │   ├── document/
│   │   │   ├── MarkdownViewer.tsx   # Markdown rendering
│   │   │   └── DriftBadge.tsx       # approved / modified / draft badge
│   │   │
│   │   ├── metrics/
│   │   │   ├── ProgressBar.tsx      # Task completion bar
│   │   │   └── EstimateDisplay.tsx  # Story point display
│   │   │
│   │   └── common/
│   │       ├── StatusBadge.tsx      # Colour-coded status pill
│   │       ├── EntityLink.tsx       # Clickable entity reference
│   │       ├── EmptyState.tsx
│   │       └── LoadingState.tsx
│   │
│   └── styles/
│       └── globals.css           # Tailwind imports, custom properties
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── work/                         # Kanbanzai workflow docs (this file lives here)
```

---

## 4. Data Model

### 4.1 Entity Types

TypeScript interfaces derived from `schema-reference.md`. All fields use the exact YAML field names. Optional fields use `?`. Timestamps are parsed as `string` (RFC 3339) — formatted for display, compared for sorting.

#### Plan

```typescript
interface Plan {
  id: string;              // P{n}-{slug}
  slug: string;
  title: string;
  status: string;
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

**Statuses:** `proposed` → `designing` → `active` → `done`. From any non-terminal: → `superseded`, → `cancelled`.

#### Feature

```typescript
interface Feature {
  id: string;              // FEAT-{TSID13}
  slug: string;
  parent: string;          // Plan ID
  status: string;
  estimate?: number;       // Modified Fibonacci
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

**Statuses:** `proposed` → `designing` → `specifying` → `dev-planning` → `developing` → `done`. From any non-terminal: → `superseded`, → `cancelled`. Backward transitions triggered by document supersession.

#### Task

```typescript
interface Task {
  id: string;              // TASK-{TSID13}
  parent_feature: string;  // Feature ID
  slug: string;
  summary: string;
  status: string;
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

**Statuses:** `queued` → `ready` → `active` → `done`. Also: `blocked`, `needs-review`, `needs-rework`. Terminal: `done`, `not-planned`, `duplicate`. Auto-promotion: `queued` → `ready` when all `depends_on` reach terminal state.

#### Bug

```typescript
interface Bug {
  id: string;              // BUG-{TSID13}
  slug: string;
  title: string;
  status: string;
  estimate?: number;
  severity: string;        // low | medium | high | critical
  priority: string;        // low | medium | high | critical
  type: string;            // implementation-defect | specification-defect | design-problem
  reported_by: string;
  reported?: string;       // timestamp
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

**Statuses:** `reported` → `triaged` → `reproduced` → `planned` → `in-progress` → `needs-review` → `verified` → `closed`. Also: `cannot-reproduce`, `needs-rework`. Terminal: `closed`, `duplicate`, `not-planned`.

#### Decision

```typescript
interface Decision {
  id: string;              // DEC-{TSID13}
  slug: string;
  summary: string;
  rationale: string;
  decided_by: string;
  date?: string;           // timestamp
  status: string;
  affects?: string[];      // Entity IDs
  supersedes?: string;
  superseded_by?: string;
  tags?: string[];
}
```

**Statuses:** `proposed` → `accepted`. Terminal: `rejected`, `superseded`.

#### Knowledge Entry

```typescript
interface KnowledgeEntry {
  id: string;              // KE-{TSID13}
  tier: number;            // 2 (project-level) or 3 (session-level)
  topic: string;           // normalised, lowercase, hyphenated
  scope: string;           // profile name or "project"
  content: string;
  learned_from?: string;   // provenance (task ID etc.)
  status: string;
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

**Statuses:** `contributed` → `confirmed` (auto: use_count ≥ 3, miss_count = 0) or → `disputed`. Terminal: `retired`.

#### Document Record

```typescript
interface DocumentRecord {
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

**Filename encoding:** slashes in ID become `--` (e.g., `FEAT-01ABC/design-my-feature` → `FEAT-01ABC--design-my-feature.yaml`).

#### Incident

```typescript
interface Incident {
  id: string;              // INC-{TSID13}
  slug: string;
  title: string;
  status: string;
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

**Statuses:** `reported` → `triaged` → `investigating` → `root-cause-identified` → `mitigated` → `resolved` → `closed`. Back-transitions allowed.

#### Human Checkpoint

```typescript
interface HumanCheckpoint {
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

### 4.2 Entity Hierarchy

```
Plan (top-level organising unit)
 └── Feature (deliverable, document-driven lifecycle)
      └── Task (atomic unit of work)

Bug (standalone, cross-linked via origin_feature / origin_task)
Decision (standalone, cross-linked via affects[])
Incident (standalone, cross-linked via affected_features[] / linked_bugs[])
DocumentRecord (linked from Plan.design, Feature.design/spec/dev_plan)
KnowledgeEntry (standalone, scoped to role or project)
HumanCheckpoint (standalone, blocking questions)
```

### 4.3 In-Memory Store

The Zustand store holds all parsed entities in typed maps:

```typescript
interface ProjectState {
  // Project root path
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

  // Derived (recomputed on entity change)
  tree: TreeNode[];
  pendingCheckpoints: HumanCheckpoint[];

  // Actions
  openProject: (path: string) => Promise<void>;
  reloadEntity: (entityType: string, filePath: string) => Promise<void>;
  closeProject: () => void;
}
```

### 4.4 Configuration

```typescript
interface ProjectConfig {
  version: string;           // Schema version (currently "2")
  schema_version?: string;   // Semver (from 1.0 onwards; absent = pre-1.0)
  prefixes: PrefixEntry[];
  documents?: {
    roots: DocumentRoot[];
  };
}

interface PrefixEntry {
  prefix: string;            // Single character, e.g. "P"
  name: string;              // Human name, e.g. "Plan"
  retired?: boolean;
}

interface DocumentRoot {
  path: string;              // e.g. "work/design"
  default_type: string;      // e.g. "design"
}
```

---

## 5. Directory Reading Strategy

### 5.1 Initial Load

On `openProject(path)`:

1. Read `{path}/.kbz/config.yaml` — validate it exists, parse prefix registry
2. For each entity subdirectory in `.kbz/state/`:
   - `plans/`, `features/`, `tasks/`, `bugs/`, `decisions/`, `documents/`, `knowledge/`, `incidents/`, `checkpoints/`
   - List all `.yaml` files
   - Parse each file with the `yaml` npm package
   - Store in the corresponding entity map
3. Build the tree hierarchy (see §6.1)
4. Compute derived data (pending checkpoints, metrics)
5. Start the file watcher (see §5.3)

Directories that don't exist are silently skipped — an early project may not have bugs, incidents, etc.

### 5.2 Filename → Entity Type Mapping

| Directory | Entity Type | Filename Pattern |
|-----------|------------|------------------|
| `state/plans/` | Plan | `{id}.yaml` |
| `state/features/` | Feature | `{id}-{slug}.yaml` |
| `state/tasks/` | Task | `{id}-{slug}.yaml` |
| `state/bugs/` | Bug | `{id}-{slug}.yaml` |
| `state/decisions/` | Decision | `{id}-{slug}.yaml` |
| `state/documents/` | DocumentRecord | `{id with / → --}.yaml` |
| `state/knowledge/` | KnowledgeEntry | `{id}.yaml` |
| `state/incidents/` | Incident | `{id}-{slug}.yaml` |
| `state/checkpoints/` | HumanCheckpoint | `{id}.yaml` |

### 5.3 File Watching

Using `@tauri-apps/plugin-fs` watch API:

- Watch `.kbz/state/` recursively
- On file create/modify: re-parse the affected YAML file, update the entity map, rebuild derived data
- On file delete: remove the entity from the map
- Debounce with a ~200ms window to batch rapid writes during orchestration bursts
- Also watch `work/` (or configured document roots) for Markdown file changes — invalidate any cached content hash comparisons

This gives near-real-time updates when kanbanzai writes to the active working directory.

### 5.4 Concurrency Safety

Per the viewer guide: kanbanzai uses atomic writes (temp file → rename). Individual YAML files are always consistent. Cross-file inconsistency during a write burst is transient and acceptable for a viewer — the next change event resolves it.

---

## 6. UI Design

### 6.1 Design Fundamentals

These principles apply across every component and view:

- **Minimum info for the size** — lists show the minimum needed to identify an item; detail panels show everything useful
- **Clickability is visible** — anything interactive gets `cursor: pointer`, no exceptions
- **Colour carries meaning** — status lozenges use the prescribed palette (§6.5); other metadata lozenges use distinct colours to differentiate types
- **Typography adds info** — use small/grey text for secondary details (timestamps, IDs as context) rather than giving them equal visual weight
- **Popovers for overflow** — anything that needs more info than its container allows uses a popover on hover/click
- **Everything that can link, does** — metadata lozenges become list filters when clicked; document references open the document viewer; entity IDs navigate to the workflows view; all links are styled as clickable
- **Metadata as lozenges** — status, type, tags, and other categorical metadata render as coloured badge/pill components
- **Icons: routine, judicious** — use Lucide icons (via shadcn) in standard ways; pair with popovers to explain where meaning isn't obvious; use text labels where an icon alone is ambiguous
- **Titles over IDs for documents** — documents display their title prominently; the filename/ID is secondary metadata. For workflow entities, the ID is primary (since people reference `FEAT-003` in conversation) with the summary as supporting text
- **No pagination** — all data loads in full (it's local, small). Virtual scrolling can be added later if performance requires it

### 6.2 shadcn/ui Theme

| Setting | Value |
|---------|-------|
| Style | Nova |
| Base Colour | Mist |
| Theme | Sky |
| Preset | `--preset b7BFemEXi` |

This provides the full CSS variable palette. All components inherit from the theme — no ad-hoc colour overrides except for the status colour mapping (§6.5).

### 6.3 Layout: Two-View Model

The app has two top-level views — **Documents** and **Workflows** — switched via a minimal nav in the header. Each view fills the full window below the header.

```
┌─[FileText icon: Docs] [GitBranch icon: Workflows]──────────[git info]─┐
│                                                                        │
│  (active view fills the space below)                                   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

The header is a single thin bar containing:

- **View switcher** (left) — two icon+label buttons, active state highlighted
- **Git info panel** (right) — read-only repo status (see §6.9)

### 6.4 Documents View

A list-and-detail view for browsing project documents.

#### Document List

```
┌─[Docs]─[Workflows]───────────────────────[git info]─┐
│                                                       │
│  [type filters]  [status filters]  [sort: newest ▼]  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Architecture Design            design  approved │ │
│  │ 3 days ago                                      │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ Initial Proposal                 plan    draft  │ │
│  │ 5 days ago                                      │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ Sprint Retrospective           report  approved │ │
│  │ 1 week ago                                      │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
└───────────────────────────────────────────────────────┘
```

- Default sort: date modified, newest first
- Each row shows:
  - **Title** (prominent — the document's `title` field, not the filename)
  - **Date modified** (small/grey, relative with full date on hover)
  - **Type** lozenge (design, specification, dev-plan, research, report, policy — each a distinct colour)
  - **Status** lozenge (approved = green, draft = grey, superseded = purple)
- Filter bar above the list:
  - Toggle buttons for each document type
  - Toggle buttons for status (approved / draft / superseded)
  - Clicking a lozenge in the list activates that filter
- Clicking a row opens the Document Viewer

#### Document Viewer

```
┌─[Docs]─[Workflows]───────────────────────[git info]─┐
│                                                       │
│  [ChevronLeft icon]  Architecture Design              │
│                                                       │
│  ┌─────────────────────────┐  ┌────────────────────┐ │
│  │                         │  │ Status             │ │
│  │  (markdown content)     │  │ [approved badge]   │ │
│  │                         │  │                    │ │
│  │  rendered at             │  │ Filename           │ │
│  │  paper width             │  │ kbzv-arch.md      │ │
│  │  (~700px max)            │  │                    │ │
│  │                         │  │ Type               │ │
│  │  github-flavoured        │  │ [design badge]    │ │
│  │  markdown theme          │  │                    │ │
│  │                         │  │ Owner              │ │
│  │                         │  │ P1-kbzv            │ │
│  │                         │  │                    │ │
│  │                         │  │ Related Entities   │ │
│  │                         │  │ FEAT-001 init-cmd  │ │
│  │                         │  │ FEAT-002 viewer    │ │
│  │                         │  │                    │ │
│  │                         │  │ Superseded By      │ │
│  │                         │  │ (none)             │ │
│  └─────────────────────────┘  └────────────────────┘ │
│                                                       │
└───────────────────────────────────────────────────────┘
```

- **Back button** (left, with ChevronLeft icon) — returns to the document list
- **Markdown content** — fixed paper-width column (~700px max-width), centred or left-aligned
  - GitHub Flavoured Markdown (tables, task lists, strikethrough)
  - Syntax highlighting for code blocks
  - GitHub-style theme (clean, readable)
  - Heading hierarchy with anchor links
- **Metadata panel** (right sidebar, ~250px):
  - **Status** — prominent at top, with drift detection:
    - Approved + hash matches: green "Approved" badge
    - Approved + hash differs: orange "Modified since approval" badge
    - Draft: grey "Draft" badge
    - Superseded: purple "Superseded" badge with link to successor
  - **Filename** — the actual file path (small/grey)
  - **Type** lozenge
  - **Owner** — the parent plan or feature, clickable (navigates to Workflows view)
  - **Related entities** — any entities that reference this document, each clickable
  - **Content hash** status (small/grey — match/mismatch indicator)
- If the markdown file is missing: show a "File not found" message in the content area

### 6.5 Status Colours

From the viewer guide's prescribed palette:

| Colour | Hex | Statuses |
|--------|-----|----------|
| Grey | `#9CA3AF` | `proposed`, `queued`, `draft` |
| Blue | `#3B82F6` | `designing`, `specifying`, `dev-planning`, `ready`, `planned`, `contributed` |
| Yellow | `#EAB308` | `active`, `in-progress`, `investigating`, `developing` |
| Orange | `#F97316` | `blocked`, `needs-review`, `needs-rework`, `disputed`, `pending` |
| Green | `#22C55E` | `done`, `closed`, `verified`, `approved`, `accepted`, `confirmed`, `resolved` |
| Red | `#EF4444` | `cancelled`, `not-planned`, `rejected`, `duplicate`, `retired`, `cannot-reproduce` |
| Purple | `#A855F7` | `superseded` |

Unknown statuses (from future schema versions) display as grey with the raw string. The viewer must never fail on an unrecognised status value.

### 6.6 Workflows View

A two-column view: nested entity tree on the left, detail panel on the right.

```
┌─[Docs]─[Workflows]───────────────────────[git info]─┐
│                                                       │
│  [type filters]  [status filters]                     │
│                                                       │
│  ┌──────────────────────┐  ┌────────────────────────┐│
│  │ ▼ P1-kbzv            │  │ FEAT-001               ││
│  │   ▼ FEAT-001 init-cmd│  │ init-command            ││
│  │     TASK-01a parser  ●│  │                        ││
│  │     TASK-01b loader  ●│  │ Status                 ││
│  │     TASK-01c watcher ○│  │ [developing badge]     ││
│  │   ▶ FEAT-002 viewer   │  │                        ││
│  │   ▶ FEAT-003 ui       │  │ Parent                 ││
│  │ ▶ P2-infra            │  │ P1-kbzv               ││
│  │                       │  │                        ││
│  │ ── Bugs (3) ────────  │  │ Tasks  5/8 (62%)      ││
│  │   BUG-001 parse fail  │  │ ████████░░░            ││
│  │   BUG-002 watch loop  │  │                        ││
│  │   BUG-003 hash error  │  │ Documents              ││
│  │                       │  │ Architecture Design    ││
│  │ ── Decisions (2) ──── │  │ Feature Spec           ││
│  │   DEC-001 use tauri   │  │                        ││
│  │   DEC-002 no mcp v1   │  │ Estimate: 8 pts       ││
│  │                       │  │                        ││
│  │ ── Checkpoints ────── │  │ Depends On             ││
│  │   ⚠ CHK-001 pending   │  │ (none)                ││
│  └──────────────────────┘  └────────────────────────┘│
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### Entity Tree (left column)

- **Nested collapsibles** using shadcn `Collapsible` + `SidebarMenuSub`:
  - Plans (top level) → Features → Tasks (leaf)
  - Each node shows: entity ID (bold) + summary/label (normal weight) + status dot (coloured)
  - Collapsible chevron on nodes with children
- **Standalone sections** below the tree (also collapsible):
  - Bugs — flat list, each with status dot
  - Decisions — flat list
  - Incidents — flat list (if any exist)
  - Pending Checkpoints — always visible when non-empty, highlighted with orange background
- Clicking any entity populates the detail panel on the right

#### Entity Detail Panel (right column)

Displays full information for the selected entity:

1. **Header** — entity type icon (Lucide) + ID (prominent) + summary + status lozenge
2. **Fields** — all populated fields, rendered by type:
   - Reference fields (`parent`, `design`, `origin_feature`) → clickable links that navigate within Workflows or cross to Documents view
   - Timestamps → relative format ("3 days ago") with full RFC3339 on hover via popover
   - Arrays (`tags`, `files_planned`, `depends_on`) → lozenge list; IDs are clickable
   - Long text (`completion_summary`, `verification`) → expandable/collapsible sections
3. **Related entities** (computed cross-references):
   - Feature → its Tasks (with completion progress bar), Documents, linked Bugs and Decisions
   - Plan → its Features with progress summary
   - Task → its dependencies and dependents
4. **Documents** — listed by title (not filename), clickable to open Document Viewer

When nothing is selected, the detail panel shows a light project summary (plan count, feature count, task count, overall progress) or is simply empty.

### 6.7 Filter Bar

Both views share a consistent filter bar pattern:

- **Type toggles** — one button per entity type (Documents view) or entity type (Workflows view), each with a Lucide icon
- **Status toggles** — segmented by the status colour groups
- **Active filters** shown as removable lozenges
- Clicking a metadata lozenge anywhere in the UI activates that value as a filter
- All filters are combinative (AND logic): selecting "design" type + "approved" status shows only approved design documents

### 6.8 Component Mapping

Specific shadcn/ui components mapped to UI elements:

| UI Element | shadcn Component(s) | Notes |
|------------|---------------------|-------|
| View switcher | `Tabs` or custom nav buttons | Two items: Docs, Workflows |
| Document list | `Card` or custom list items | Each row is a clickable card |
| Filter toggles | `ToggleGroup` + `Toggle` | Grouped by category |
| Status/type lozenges | `Badge` | Colour variants per status |
| Entity tree | `Collapsible` + `SidebarMenu` / `SidebarMenuSub` | Based on sidebar-11 pattern |
| Detail panel | `Card` sections or bare layout | Right column |
| Markdown viewer | `react-markdown` + `remark-gfm` + `rehype-highlight` | Paper-width container |
| Popovers | `Popover` / `Tooltip` | For timestamps, icon explanations |
| Back button | `Button` variant="ghost" + ChevronLeft icon | Document viewer |
| Progress bars | `Progress` | Task completion within features |
| Expandable sections | `Collapsible` | Long text fields in detail panel |
| Git info | Custom component with Lucide icons | See §6.9 |

Reference blocks: `sidebar-11` (collapsible file tree) for the Workflows tree structure; `sidebar-15` (left + right sidebars) for the Document Viewer's content + metadata layout.

### 6.9 Git Info Panel

A small, read-only status display in the top-right of the header bar. Shows ambient information about the project's git state so the user knows how current their view is.

```
  GitBranch icon  kbzv / main    46 changes    ArrowUp icon 16 | ArrowDown icon 0
```

- **Repo name / branch** — with GitBranch icon
- **Uncommitted changes** — count from `git status` (how much local work is in flight)
- **Ahead / behind remote** — arrow-up for commits ahead, arrow-down for commits behind (staleness indicator)

This is purely informational — no interactive elements. Refreshed on file-watch events alongside entity data.

### 6.10 Progress Metrics

All metrics are computed from entity state — nothing is pre-stored:

**Task completion by feature:**

```
done_tasks     = count tasks where parent_feature == feature.id
                 AND status == "done"
total_tasks    = count tasks where parent_feature == feature.id
                 AND status NOT IN ("not-planned", "duplicate")
completion_pct = done_tasks / total_tasks * 100
```

**Feature completion by plan:**

Same pattern: count done features / total features (excluding `cancelled`, `superseded`).

**Estimate rollup:**

- Feature points = sum of child task estimates (where present)
- Plan points = sum of child feature estimates (where present)
- Entities without an estimate are shown as "unestimated" — not counted as zero

---

## 7. Navigation Model

### 7.1 Cross-Reference Links

Any entity ID appearing in a field value is rendered as a clickable link. The `EntityLink` component:

1. Takes an entity ID string
2. Determines the entity type from the ID prefix:
   - `FEAT-` → Feature
   - `TASK-` → Task
   - `BUG-` → Bug
   - `DEC-` → Decision
   - `KE-` → Knowledge Entry
   - `INC-` → Incident
   - `CHK-` → Human Checkpoint
   - Matches `{letter}{digit}+-` pattern → Plan
   - Contains `/` → DocumentRecord (composite ID)
3. Looks up the entity in the store
4. Renders as a styled link with the entity's title/summary as tooltip
5. If the target entity doesn't exist (broken reference): renders as a dimmed link with "not found" indicator

### 7.2 Cross-View Navigation

Links navigate between views when the target is in a different view:

- **Entity ID clicked in Documents view** → switches to Workflows view, selects that entity in the tree, shows its detail panel
- **Document reference clicked in Workflows view** → switches to Documents view, opens the Document Viewer for that document
- **Metadata lozenge clicked anywhere** → activates as a filter in the appropriate view's filter bar

The view switch is seamless — no modal, no confirmation. The user can always use the view switcher tabs to go back.

### 7.3 Navigation History

Each view maintains its own navigation state:

- **Documents view**: list ↔ viewer (back button returns to list, preserving scroll position and active filters)
- **Workflows view**: tree selection + detail panel (selecting a new entity replaces the detail; no "back" needed since the tree is always visible)

Global keyboard shortcuts:

- ⌘[ / ⌘] for back/forward (matching macOS conventions) — navigates within the active view's history

### 7.4 Tree Selection Sync

- Selecting an entity in the tree shows it in the Workflows detail panel
- Navigating to an entity via a cross-reference link (from either view) updates the tree selection and expands the relevant tree path
- The tree auto-scrolls to keep the selected node visible

### 7.5 Sorting

- **Documents** default to date modified (newest first); sortable by title, type, or status
- **Plans** sort by prefix + number: `P1-...`, `P2-...`, `P3-...`
- **TSID13-based entities** (Features, Tasks, Bugs, etc.) sort lexicographically by ID — this gives chronological (creation-time) order
- **Tasks within a feature** default to creation order; topological sort on `depends_on` is a future enhancement

---

## 8. Error Handling

### 8.1 Principles

From the viewer guide:

- **Never fail on unknown enum values** — display the raw string
- **Handle missing fields** — absent means "not set", render as empty/hidden
- **Handle broken references** — display "not found" indicator, never crash
- **Handle missing files** — DocumentRecord.path may point to a deleted file
- **Handle missing directories** — a project may not have bugs, incidents, etc.

### 8.2 Specific Cases

| Scenario | Behaviour |
|----------|-----------|
| `.kbz/config.yaml` missing | Error dialog: "Not a Kanbanzai project" |
| `state/` directory missing | Empty project state (valid — newly initialised project) |
| YAML parse error in a single file | Log warning, skip that file, show error indicator in sidebar |
| Unknown entity field in YAML | Silently ignored (forward compatibility) |
| Unknown status value | Display raw string with grey colour |
| Broken cross-reference | Dimmed link with "not found" tooltip |
| Document Markdown file missing | "File not found" message in Markdown viewer area |
| SHA-256 content hash mismatch | "Modified since approval" warning badge on document |
| `schema_version` absent | Treat as pre-1.0; parse best-effort |

---

## 9. Future Considerations

### 9.1 Search (v1.1)

Full-text search across entity fields and document content. A lightweight client-side index (e.g., Fuse.js or MiniSearch) since the dataset is small — a large project might have hundreds of entities, not millions.

### 9.2 Kanban Board View (v2.0)

A board view showing entities as cards in status columns:

- Feature board: columns for each lifecycle stage
- Task board: columns for queued → ready → active → done

### 9.3 MCP Server Integration (v2.0+)

Optional mode where KBZV spawns `kanbanzai serve` and communicates via JSON-RPC over stdio. This would enable:

- Richer queries (`work_queue`, `dependency_status`, `estimate_query`)
- Health check display
- Potentially write operations in the future

The `@modelcontextprotocol/sdk` TypeScript package provides MCP client support.

### 9.4 Multi-Window (v2.0+)

Tauri v2 supports multiple windows. Each window could view a different project, or the same project with different panels.

---

## 10. Dependencies

### 10.1 Rust (Cargo)

| Crate | Purpose |
|-------|---------|
| `tauri` v2.x | App framework |
| `tauri-plugin-fs` | File system access and watching |
| `tauri-plugin-dialog` | Native dialogs (open folder) |
| `tauri-plugin-shell` | Open external links (optional) |

### 10.2 TypeScript (npm)

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI framework |
| `typescript` | Type safety |
| `yaml` | YAML parsing |
| `react-markdown` | Markdown rendering |
| `remark-gfm` | GitHub Flavoured Markdown support |
| `rehype-highlight` | Syntax highlighting in code blocks |
| `rehype-sanitize` | XSS protection for rendered Markdown |
| `zustand` | State management |
| `lucide-react` | Icons (bundled with shadcn/ui) |
| `shadcn/ui` | Component library (Nova style, Mist base, Sky theme) |
| `tailwindcss` | Styling (required by shadcn/ui) |
| `@tauri-apps/api` | Tauri frontend API |
| `@tauri-apps/plugin-fs` | File system access from frontend |
| `@tauri-apps/plugin-dialog` | Native dialogs from frontend |

### 10.3 Build Tools

| Tool | Purpose |
|------|---------|
| Rust toolchain (stable) | Tauri compilation |
| Node.js 20+ | Frontend build |
| pnpm | Package manager (fast, disk-efficient) |
| Vite | Frontend bundler |

---

## 11. Open Questions

1. **Schema version handling** — pre-1.0 repos lack `schema_version`. Should we warn, or just parse best-effort? _Recommendation: parse best-effort with a subtle indicator in the status bar._

2. **Large project performance** — how many entities before the in-memory model becomes problematic? _Estimate: thousands of entities at ~1-5 KB each is well within browser memory limits. No pagination in v1 — load everything. Add virtual scrolling only if measured performance requires it._

3. **Markdown extensions** — should we support Mermaid diagrams, math (KaTeX), or other extensions? _Recommendation: add remark/rehype plugins incrementally. The architecture supports this without structural changes._

4. **Theme** — light mode, dark mode, or system-follows? _Recommendation: system-follows with manual override. shadcn/ui + Tailwind's dark mode support makes this straightforward._

5. **Keyboard navigation** — what keyboard shortcuts beyond ⌘[/⌘] back/forward? _Recommendation: define as part of a UX specification, post-architecture._

6. **Search (planned v1.1)** — command-palette style (⌘K) searching across entity fields and document content. Worth keeping in mind during layout — the header bar has space for a search trigger. Lightweight client-side index (e.g., Fuse.js or MiniSearch) since all data is local.

---

## References

- [KBZV Initial Proposal](../plan/kbzv-initial-proposal.md)
- [Kanbanzai Guide for Viewer Agents](../plan/kbz-references/kanbanzai-guide-for-viewer-agents.md)
- [Schema Reference](../plan/kbz-references/schema-reference.md)
- [MCP Tool Reference](../plan/kbz-references/mcp-tool-reference.md)
- [Workflow Overview](../plan/kbz-references/workflow-overview.md)
- [Configuration Reference](../plan/kbz-references/configuration-reference.md)
- [Tauri v2 Documentation](https://v2.tauri.app)