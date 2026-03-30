# Feature 3: Workflows View — Design Document

| Field | Value |
|-------|-------|
| **Feature ID** | FEAT-01KMZA9GFB075 |
| **Slug** | `workflows-view` |
| **Parent Plan** | P1-kbzv |
| **Status** | proposed |
| **Depends On** | FEAT-01KMZA96W1J98 (F1: App Scaffold + Theme), FEAT-01KMZA9CP9XEX (F2: Data Layer) |
| **Tags** | `ui`, `tree`, `entity-detail` |
| **Architecture Sections** | §6.1, §6.5, §6.6, §6.7, §6.8, §6.10, §7.1, §7.4, §7.5, §8 |

---

## 1. Overview

The Workflows view is the primary view for understanding project state. It presents a two-column layout: a nested, collapsible entity tree on the left and a full entity detail panel on the right. Users browse the Plan → Feature → Task hierarchy, inspect any entity's complete metadata, filter by type and status, and see progress metrics — all read-only, all from in-memory data loaded by F2.

### 1.1 What This Feature Delivers

- Nested collapsible entity tree (Plan → Feature → Task) with status-coloured dots
- Standalone collapsible sections for Bugs, Decisions, Incidents, and Pending Checkpoints
- Full entity detail panel with type-specific rendering for all 9 entity types
- Status badges using the prescribed 7-colour palette
- Filter bar with type and status toggles (AND logic)
- Progress bars (task completion by feature, feature completion by plan)
- Estimate rollup display
- Broken-reference and unknown-status resilience

### 1.2 What This Feature Does NOT Deliver

- **Cross-view navigation (F5):** `EntityLink` components render as clickable-styled elements but navigation actions are stubbed. Clicking a document reference does nothing until F5 wires it.
- **File watching (F6):** All data comes from the initial load performed by F2. The tree does not update live.
- **Documents view (F4):** No Markdown rendering, no document list.

---

## 2. Layout

The Workflows view occupies the full area below the app header (provided by F1). It is a horizontal two-column split.

```
┌─[FileText: Docs]─[GitBranch: Workflows]──────────────[git info]──┐
│                                                                    │
│  [type toggles: Plan Feature Task Bug Decision Incident Checkpoint]│
│  [status toggles: grey | blue | yellow | orange | green | red | ⬣] │
│  [active filters: ×Feature  ×active ]                              │
│                                                                    │
│  ┌─ Entity Tree ──────────────┐  ┌─ Entity Detail ──────────────┐ │
│  │                             │  │                               │ │
│  │ ▼ P1-kbzv                  │  │  🏗 FEAT-003                  │ │
│  │   ▼ FEAT-001 app-scaffold  │  │  workflows-view               │ │
│  │     ● TASK-01a scaffold   │  │                               │ │
│  │     ● TASK-01b theme      │  │  Status                       │ │
│  │   ▶ FEAT-002 data-layer    │  │  [proposed]                   │ │
│  │   ▼ FEAT-003 workflows-view│  │                               │ │
│  │     ○ TASK-03a tree       │  │  Parent                       │ │
│  │     ○ TASK-03b detail     │  │  P1-kbzv                      │ │
│  │     ○ TASK-03c filters    │  │                               │ │
│  │ ▶ P2-other                  │  │  Tasks  0/3 (0%)             │ │
│  │                             │  │  ░░░░░░░░░░░                 │ │
│  │ ── Bugs (2) ─────────────  │  │                               │ │
│  │   ● BUG-001 parse failure  │  │  Estimate                    │ │
│  │   ○ BUG-002 watch loop     │  │  unestimated                 │ │
│  │                             │  │                               │ │
│  │ ── Decisions (1) ─────────  │  │  Documents                   │ │
│  │   DEC-001 use tauri         │  │  Architecture Design         │ │
│  │                             │  │                               │ │
│  │ ── Incidents ─────────────  │  │  Depends On                  │ │
│  │   (none)                    │  │  FEAT-001  FEAT-002          │ │
│  │                             │  │                               │ │
│  │ ▌▌ Pending Checkpoints ▌▌  │  │  Tags                        │ │
│  │   ⚠ CHK-001 pending        │  │  [ui] [tree] [entity-detail] │ │
│  └─────────────────────────────┘  └───────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.1 Column Sizing

| Column | Width | Behaviour |
|--------|-------|-----------|
| Entity Tree (left) | `w-80` (320px) or ~30% | Fixed min-width of 280px. Scrolls vertically independently. |
| Entity Detail (right) | Remaining space (flex-1) | Scrolls vertically independently. Max content width ~700px for readability, left-aligned within the column. |

The two columns are separated by a subtle vertical `Separator`. Both columns scroll independently via `overflow-y: auto`.

### 2.2 Filter Bar Position

The filter bar sits above both columns, spanning the full width. It is fixed (does not scroll with either column).

---

## 3. Entity Tree — Left Column

### 3.1 Component Structure

```
EntityTree.tsx
├── TreeContext.tsx (context provider: expand/collapse/selection state)
├── FilterBar.tsx (type + status toggles, active filter badges)
├── TreeNode.tsx (recursive, used for Plan/Feature/Task hierarchy)
├── StandaloneSection.tsx (Bugs, Decisions, Incidents, Checkpoints)
└── StatusDot.tsx (coloured circle indicator)
```

### 3.2 Tree Hierarchy

The tree is built from the Zustand store's `tree` derived data (computed by F2's `lib/query/tree.ts`). The nesting is:

```
Plan (top level, collapsible)
 └── Feature (child, collapsible)
      └── Task (leaf, not collapsible)
```

**Data flow:**
1. `EntityTree` reads `tree: TreeNode[]` from the project store
2. Each `TreeNode` has `{ entity, entityType, children: TreeNode[] }`
3. `EntityTree` maps over root nodes (Plans), rendering `TreeNode` recursively
4. Filtering is applied before rendering — filtered-out nodes are excluded from the JSX entirely (not hidden with CSS)

### 3.3 TreeNode Component

Based on shadcn `Collapsible` + `SidebarMenuSub` (sidebar-11 pattern).

**Props:**

```typescript
interface TreeNodeProps {
  node: TreeNode;
  depth: number;          // 0 = plan, 1 = feature, 2 = task
  isSelected: boolean;
  onSelect: (entityId: string, entityType: string) => void;
}
```

**Rendering per node:**

```
[▼ chevron] [● status dot] [FEAT-003] workflows-view
 ╰─ bold ID              ╰─ normal weight summary/label
```

| Element | Rendering | Notes |
|---------|-----------|-------|
| Chevron | `ChevronRight` icon, rotates 90° when expanded | Only on nodes with children (Plans, Features with tasks). Hidden for leaf Tasks. |
| Status dot | 8×8 filled circle (`rounded-full w-2 h-2`) | Colour from status-colours mapping (§6.5). Inline, vertically centred. |
| Entity ID | `font-semibold text-sm font-mono` | Primary identifier. Always visible. |
| Summary/Label | `font-normal text-sm text-muted-foreground truncate` | The entity's `summary` field (or `label` if present, or `title` for Plans/Bugs). Truncated with ellipsis to fit. |

**Indentation:** Each depth level indents by `pl-4` (16px). This gives Plan nodes no indent, Features 16px, Tasks 32px.

**Interaction:**
- `cursor: pointer` on every node
- Click anywhere on the row → selects the entity (calls `onSelect`)
- Click the chevron → toggles expand/collapse without changing selection
- Selected node gets `bg-accent` highlight (from shadcn theme)
- Hover: `bg-accent/50` subtle highlight

**Expand/collapse state** is managed by `TreeContext`:

```typescript
interface TreeContextValue {
  expandedNodes: Set<string>;     // entity IDs
  selectedEntity: string | null;  // entity ID
  selectedType: string | null;    // entity type string
  toggleExpand: (id: string) => void;
  expandTo: (id: string) => void; // expand all ancestors
  select: (id: string, type: string) => void;
}
```

`expandTo` is used when navigating to an entity programmatically — it walks the entity's parent chain and expands each ancestor so the target node is visible, then scrolls it into view.

### 3.4 Sorting

Within the tree:

| Level | Sort Order |
|-------|-----------|
| Plans | By prefix + number: `P1-...` < `P2-...` < `P10-...`. Lexicographic on the full ID. |
| Features within a Plan | Lexicographic by ID (TSID13 gives chronological creation order). |
| Tasks within a Feature | Lexicographic by ID (creation order). Topological sort on `depends_on` is a future enhancement. |

### 3.5 Standalone Sections

Below the Plan→Feature→Task tree, four standalone collapsible sections display entities that don't fit the hierarchy:

```
── Bugs (3) ──────────────────
  ● BUG-001 parse failure
  ● BUG-002 watch loop
  ○ BUG-003 hash mismatch

── Decisions (2) ──────────────
  DEC-001 use tauri
  DEC-002 no mcp v1

── Incidents ──────────────────
  (none)

▌▌ Pending Checkpoints (1) ▌▌
  ⚠ CHK-001 What approach for…
```

**Implementation:** Each section uses a `Collapsible` with a header row showing the section title and count badge.

| Section | Content | Dot/Icon | Sort | Visibility |
|---------|---------|----------|------|------------|
| Bugs | All bugs, flat list | Status dot (coloured) | By ID (chronological) | Always shown (collapsed if empty) |
| Decisions | All decisions, flat list | No dot — just ID + summary | By ID | Always shown (collapsed if empty) |
| Incidents | All incidents, flat list | Status dot (coloured) | By ID | Always shown (collapsed if empty) |
| Pending Checkpoints | Checkpoints where `status === "pending"` | ⚠ `AlertTriangle` icon (orange) | By `created` (newest first) | **Always visible and expanded when non-empty.** Hidden when empty. |

**Pending Checkpoints special styling:**
- Section header: `bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-400`
- Each checkpoint row: `bg-orange-50/50 dark:bg-orange-950/50`
- The `AlertTriangle` icon replaces the status dot
- This section cannot be collapsed by the user when non-empty (always expanded)

**Row rendering for standalone sections** follows the same pattern as tree nodes: `[● dot/icon] [ID] summary` with `cursor: pointer` and click-to-select behaviour.

Each row in a standalone section also filters correctly — if the filter bar hides Bugs, the Bugs section is hidden entirely.

### 3.6 Empty Tree State

If the project has no Plans (empty `tree` array), the tree area shows:

```
(Lucide Inbox icon, muted)
No workflow entities found
Open a project with .kbz/state/ data
```

Uses the `EmptyState` component (updated from F1's initial empty state).

---

## 4. Entity Detail Panel — Right Column

### 4.1 Component Structure

```
EntityDetail.tsx (router — selects detail component by entity type)
├── PlanDetail.tsx
├── FeatureDetail.tsx
├── TaskDetail.tsx
├── BugDetail.tsx
├── DecisionDetail.tsx
├── CheckpointDetail.tsx
├── IncidentDetail.tsx
├── KnowledgeDetail.tsx
└── FieldValue.tsx (renders a single field with appropriate formatting)
```

### 4.2 EntityDetail Router

**Props:**

```typescript
interface EntityDetailProps {
  entityId: string | null;
  entityType: string | null;
}
```

**Behaviour:**
1. If `entityId` is `null` → render the empty/default state
2. Look up the entity from the Zustand store using `entityId` and `entityType`
3. If not found → render an error state ("Entity not found")
4. Switch on `entityType` and render the appropriate detail component

**Type → Component mapping:**

| Entity Type | Component | Lucide Icon |
|-------------|-----------|-------------|
| `plan` | `PlanDetail` | `Map` |
| `feature` | `FeatureDetail` | `Puzzle` |
| `task` | `TaskDetail` | `CheckSquare` |
| `bug` | `BugDetail` | `Bug` |
| `decision` | `DecisionDetail` | `Scale` |
| `checkpoint` | `CheckpointDetail` | `CircleHelp` |
| `incident` | `IncidentDetail` | `AlertOctagon` |
| `knowledge` | `KnowledgeDetail` | `Lightbulb` |
| `document` | (not rendered in Workflows — belongs to F4) | — |

### 4.3 Detail Panel Layout

Every detail component follows the same structural template:

```
┌──────────────────────────────────────────────────────┐
│  [Lucide icon]  FEAT-01KMZA9GFB075                   │
│  workflows-view                                       │
│  [proposed]                                           │
│──────────────────────────────────────────────────────│
│                                                       │
│  Parent                                               │
│  P1-kbzv                                             │
│                                                       │
│  Created                                              │
│  3 days ago                        Created By        │
│                                    sambeau            │
│                                                       │
│  Updated                                              │
│  2 hours ago                                          │
│                                                       │
│  Tags                                                 │
│  [ui] [tree] [entity-detail]                         │
│                                                       │
│  ── Tasks ── 2/5 done (40%) ─────────────────────    │
│  ████████░░░░░░░░░░░░                                │
│  TASK-001 scaffold      ● done                       │
│  TASK-002 theme         ● done                       │
│  TASK-003 tree          ○ queued                     │
│  TASK-004 detail        ○ queued                     │
│  TASK-005 filters       ○ queued                     │
│                                                       │
│  ── Documents ─────────────────────────────────────  │
│  Architecture Design                                  │
│  Feature Spec                                         │
│                                                       │
│  ── Linked Bugs ───────────────────────────────────  │
│  BUG-001 parse failure  ● reported                   │
│                                                       │
│  ── Decisions ─────────────────────────────────────  │
│  DEC-001 use tauri      ● accepted                   │
│                                                       │
│  ── Estimate ──────────────────────────────────────  │
│  8 pts  (sum of 5 task estimates; 1 unestimated)     │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 4.4 Detail Header

Every detail component starts with:

```typescript
interface DetailHeaderProps {
  icon: LucideIcon;
  entityId: string;
  summary: string;        // or title for Plans/Bugs
  status: string;
}
```

**Rendering:**

| Element | Style | Notes |
|---------|-------|-------|
| Icon | `w-5 h-5 text-muted-foreground` inline | Type-specific Lucide icon |
| Entity ID | `text-lg font-bold font-mono` | Primary — people say "FEAT-003" in conversation |
| Summary | `text-base text-muted-foreground` below the ID | Secondary supporting text |
| Status lozenge | `StatusBadge` component | Immediately below summary, left-aligned |

### 4.5 FieldValue Component

A polymorphic renderer for individual entity fields.

**Props:**

```typescript
interface FieldValueProps {
  label: string;                    // Field name displayed as section label
  value: FieldValueType;           // The raw value
  type: 'text' | 'timestamp' | 'entity-ref' | 'entity-ref-list'
      | 'tag-list' | 'string-list' | 'long-text' | 'number'
      | 'severity' | 'priority' | 'status';
}
```

**Rendering by type:**

| Type | Rendering |
|------|-----------|
| `text` | Plain text, `text-sm` |
| `timestamp` | Relative time ("3 days ago") via `date-fns` `formatDistanceToNow`. Full RFC 3339 string in a `Tooltip` on hover. |
| `entity-ref` | `EntityLink` component (see §4.8) |
| `entity-ref-list` | Horizontal wrap of `EntityLink` components |
| `tag-list` | Horizontal wrap of `Badge` variants (`bg-secondary text-secondary-foreground`). Each tag is clickable — activates it as a filter (within-view only for F3). |
| `string-list` | Horizontal wrap of `Badge` variants (neutral colour) for items like `files_planned` |
| `long-text` | First 3 lines visible. Expandable via `Collapsible` with "Show more" / "Show less" toggle. `text-sm whitespace-pre-wrap font-mono` for content like `completion_summary`, `verification`. |
| `number` | Plain text, `text-sm font-mono` |
| `severity` / `priority` | `Badge` with colour: critical=red, high=orange, medium=yellow, low=grey |
| `status` | `StatusBadge` component |

**Absent fields:** If a value is `undefined`, `null`, or an empty array, the entire `FieldValue` block (label + value) is **not rendered**. The detail panel only shows populated fields.

### 4.6 Per-Type Detail Components

#### PlanDetail

| Field | FieldValue Type | Notes |
|-------|-----------------|-------|
| `status` | `status` | In header |
| `title` | `text` | In header as summary |
| `summary` | `long-text` | |
| `slug` | `text` | Small/grey metadata |
| `design` | `entity-ref` | Document reference |
| `tags` | `tag-list` | |
| `created` | `timestamp` | |
| `created_by` | `text` | |
| `updated` | `timestamp` | |
| `supersedes` | `entity-ref` | |
| `superseded_by` | `entity-ref` | |

**Related entities section:**
- **Features:** List all features where `feature.parent === plan.id`. Each row: `EntityLink` + summary + `StatusDot`. Include a `ProgressBar` header: "Features N/M done (X%)".
- **Documents:** List documents where `document.owner === plan.id`, displayed by `title` (not filename). Each is an `EntityLink` (navigation stubbed for F5).

**Computed metrics:**
- Feature completion %: `done_features / total_features * 100` (excluding cancelled, superseded)
- Estimate rollup: sum of child feature estimates

#### FeatureDetail

| Field | FieldValue Type | Notes |
|-------|-----------------|-------|
| `status` | `status` | In header |
| `summary` | `text` | In header |
| `parent` | `entity-ref` | Plan link |
| `slug` | `text` | Small/grey |
| `estimate` | `number` | With "pts" suffix, or "unestimated" |
| `design` | `entity-ref` | Document reference |
| `spec` | `entity-ref` | Document reference |
| `dev_plan` | `entity-ref` | Document reference |
| `tags` | `tag-list` | |
| `branch` | `text` | `font-mono` |
| `supersedes` | `entity-ref` | |
| `superseded_by` | `entity-ref` | |
| `created` | `timestamp` | |
| `created_by` | `text` | |
| `updated` | `timestamp` | |

**Related entities section:**
- **Tasks:** All tasks where `task.parent_feature === feature.id`. Each row: `EntityLink` + summary + `StatusDot`. Header with `ProgressBar`: "Tasks N/M done (X%)".
- **Documents:** All documents where `document.owner === feature.id`, displayed by title.
- **Linked Bugs:** Bugs where `bug.origin_feature === feature.id`.
- **Linked Decisions:** Decisions where `feature.id` appears in `decision.affects[]`.

**Computed metrics:**
- Task completion %: `done_tasks / total_tasks * 100` (excluding not-planned, duplicate)
- Estimate rollup: sum of child task estimates. Show count of unestimated tasks.

#### TaskDetail

| Field | FieldValue Type | Notes |
|-------|-----------------|-------|
| `status` | `status` | In header |
| `summary` | `text` | In header |
| `parent_feature` | `entity-ref` | Feature link |
| `slug` | `text` | Small/grey |
| `estimate` | `number` | With "pts" suffix, or "unestimated" |
| `assignee` | `text` | |
| `depends_on` | `entity-ref-list` | Task ID links |
| `files_planned` | `string-list` | File path lozenges |
| `started` | `timestamp` | |
| `completed` | `timestamp` | |
| `claimed_at` | `timestamp` | |
| `dispatched_to` | `text` | Role/agent name |
| `dispatched_at` | `timestamp` | |
| `dispatched_by` | `text` | |
| `completion_summary` | `long-text` | Expandable |
| `rework_reason` | `long-text` | Expandable |
| `verification` | `long-text` | Expandable |
| `tags` | `tag-list` | |

**Related entities section:**
- **Dependents:** Tasks where this task's ID appears in their `depends_on[]`. Each row: `EntityLink` + summary + `StatusDot`.
- **Linked Bugs:** Bugs where `bug.origin_task === task.id`.

#### BugDetail

| Field | FieldValue Type | Notes |
|-------|-----------------|-------|
| `status` | `status` | In header |
| `title` | `text` | In header as summary |
| `severity` | `severity` | Prominent, near header |
| `priority` | `priority` | Prominent, near header |
| `type` | `text` | Bug type (implementation-defect, etc.) as Badge |
| `slug` | `text` | Small/grey |
| `estimate` | `number` | |
| `reported_by` | `text` | |
| `reported` | `timestamp` | |
| `observed` | `long-text` | Expandable |
| `expected` | `long-text` | Expandable |
| `affects` | `entity-ref-list` | |
| `origin_feature` | `entity-ref` | |
| `origin_task` | `entity-ref` | |
| `environment` | `text` | |
| `reproduction` | `long-text` | Expandable |
| `duplicate_of` | `entity-ref` | |
| `fixed_by` | `text` | |
| `verified_by` | `text` | |
| `release_target` | `text` | |
| `tags` | `tag-list` | |

#### DecisionDetail

| Field | FieldValue Type | Notes |
|-------|-----------------|-------|
| `status` | `status` | In header |
| `summary` | `text` | In header |
| `rationale` | `long-text` | Expandable — this is often the most important field |
| `decided_by` | `text` | |
| `date` | `timestamp` | |
| `affects` | `entity-ref-list` | |
| `supersedes` | `entity-ref` | |
| `superseded_by` | `entity-ref` | |
| `tags` | `tag-list` | |

#### CheckpointDetail

| Field | FieldValue Type | Notes |
|-------|-----------------|-------|
| `status` | `status` | In header — pending = orange, responded = green |
| `question` | `long-text` | Prominent, full text always visible (not collapsed) |
| `context` | `long-text` | Expandable |
| `orchestration_summary` | `long-text` | Expandable |
| `created_by` | `text` | |
| `response` | `long-text` | Only shown when status = "responded". Full text visible. |
| `created` | `timestamp` | |
| `responded_at` | `timestamp` | |

**Special styling:** When `status === "pending"`, the entire detail panel header gets the same orange highlight treatment as the tree section: `bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-400`.

#### IncidentDetail

| Field | FieldValue Type | Notes |
|-------|-----------------|-------|
| `status` | `status` | In header |
| `title` | `text` | In header |
| `severity` | `severity` | Prominent |
| `summary` | `long-text` | |
| `reported_by` | `text` | |
| `detected_at` | `timestamp` | |
| `triaged_at` | `timestamp` | |
| `mitigated_at` | `timestamp` | |
| `resolved_at` | `timestamp` | |
| `affected_features` | `entity-ref-list` | Feature links |
| `linked_bugs` | `entity-ref-list` | Bug links |
| `linked_rca` | `entity-ref` | Document reference |

#### KnowledgeDetail

| Field | FieldValue Type | Notes |
|-------|-----------------|-------|
| `status` | `status` | In header |
| `topic` | `text` | In header as summary |
| `content` | `long-text` | Full text, always visible |
| `tier` | `text` | Rendered as Badge: "Tier 2 (project)" or "Tier 3 (session)" |
| `scope` | `text` | |
| `learned_from` | `entity-ref` | Provenance link |
| `use_count` | `number` | |
| `miss_count` | `number` | |
| `confidence` | `number` | Rendered as percentage: `0.85` → "85%" |
| `ttl_days` | `number` | With "days" suffix |
| `git_anchors` | `string-list` | |
| `tags` | `tag-list` | |
| `created` | `timestamp` | |
| `created_by` | `text` | |
| `updated` | `timestamp` | |

### 4.7 Empty / Default State

When no entity is selected (`entityId === null`), the detail panel shows either:

**Option A — Light project summary (preferred):**

```
┌──────────────────────────────────────┐
│                                      │
│       (Lucide LayoutDashboard icon)  │
│                                      │
│    2 Plans · 6 Features · 18 Tasks   │
│    Overall: 8/18 tasks done (44%)    │
│    ████████████░░░░░░░░░░░░          │
│                                      │
│    3 Bugs · 2 Decisions · 0 Incidents│
│    1 Pending Checkpoint              │
│                                      │
└──────────────────────────────────────┘
```

Centred vertically and horizontally. Uses `text-muted-foreground` for all text. The pending checkpoint count, if > 0, uses `text-orange-500 font-semibold`.

**Option B — Minimal empty state:**

```
┌──────────────────────────────────────┐
│                                      │
│     (Lucide MousePointerClick icon)  │
│     Select an entity to view details │
│                                      │
└──────────────────────────────────────┘
```

The choice between A and B: use **Option A** when the project has loaded data; use **Option B** as a transient state before project load (though in practice this shouldn't appear since the Workflows view is only reachable after a project is open).

### 4.8 EntityLink Component

Renders a clickable reference to any entity.

**Props:**

```typescript
interface EntityLinkProps {
  entityId: string;
  className?: string;
}
```

**Behaviour:**

1. **Parse entity type** from ID prefix:
   - `FEAT-` → feature
   - `TASK-` → task
   - `BUG-` → bug
   - `DEC-` → decision
   - `KE-` → knowledge
   - `INC-` → incident
   - `CHK-` → checkpoint
   - Matches `/^[A-Z]\d+-/` → plan
   - Contains `/` → document

2. **Look up the entity** in the Zustand store

3. **Render:**
   - **Found:** `[ID]` in `text-primary underline-offset-4 hover:underline cursor-pointer font-mono text-sm`. Tooltip on hover shows the entity's summary/title.
   - **Not found (broken reference):** `[ID]` in `text-muted-foreground/50 line-through cursor-default font-mono text-sm`. Tooltip shows "Entity not found". No click action.

4. **Click action (F3):** If the target entity is in the Workflows view (any entity type except document), select it in the tree (call `TreeContext.select()` and `TreeContext.expandTo()`). If the target is a document, the click is a no-op (wired in F5). This allows within-tree navigation in F3.

### 4.9 StatusBadge Component

**Props:**

```typescript
interface StatusBadgeProps {
  status: string;
  className?: string;
}
```

**Rendering:** A shadcn `Badge` whose background colour is determined by the status-to-colour mapping.

The Badge displays the status string as-is (lowercase, hyphenated — e.g., "needs-review"). No transformation to title case — the raw status string is the label.

The badge style uses a combination of background tint and solid text for readability:

```typescript
// Tailwind classes per colour group
const STATUS_STYLES: Record<string, string> = {
  grey:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  green:  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};
```

**Clicking a StatusBadge** in the detail panel activates that status value as a filter in the filter bar (within-view only for F3).

---

## 5. Status Colours

The canonical mapping from the architecture document (§6.5). This is the single source of truth for all components.

### 5.1 Colour-to-Status Mapping

| Colour | Hex | CSS Variable | Statuses |
|--------|-----|-------------|----------|
| Grey | `#9CA3AF` | `--status-grey` | `proposed`, `queued`, `draft` |
| Blue | `#3B82F6` | `--status-blue` | `designing`, `specifying`, `dev-planning`, `ready`, `planned`, `contributed` |
| Yellow | `#EAB308` | `--status-yellow` | `active`, `in-progress`, `investigating`, `developing` |
| Orange | `#F97316` | `--status-orange` | `blocked`, `needs-review`, `needs-rework`, `disputed`, `pending` |
| Green | `#22C55E` | `--status-green` | `done`, `closed`, `verified`, `approved`, `accepted`, `confirmed`, `resolved` |
| Red | `#EF4444` | `--status-red` | `cancelled`, `not-planned`, `rejected`, `duplicate`, `retired`, `cannot-reproduce` |
| Purple | `#A855F7` | `--status-purple` | `superseded` |

### 5.2 Implementation

Defined in `lib/constants/status-colours.ts` (created by F2):

```typescript
type StatusColour = 'grey' | 'blue' | 'yellow' | 'orange' | 'green' | 'red' | 'purple';

const STATUS_TO_COLOUR: Record<string, StatusColour> = {
  // Grey
  'proposed': 'grey', 'queued': 'grey', 'draft': 'grey',
  // Blue
  'designing': 'blue', 'specifying': 'blue', 'dev-planning': 'blue',
  'ready': 'blue', 'planned': 'blue', 'contributed': 'blue',
  // Yellow
  'active': 'yellow', 'in-progress': 'yellow',
  'investigating': 'yellow', 'developing': 'yellow',
  // Orange
  'blocked': 'orange', 'needs-review': 'orange', 'needs-rework': 'orange',
  'disputed': 'orange', 'pending': 'orange',
  // Green
  'done': 'green', 'closed': 'green', 'verified': 'green',
  'approved': 'green', 'accepted': 'green', 'confirmed': 'green',
  'resolved': 'green',
  // Red
  'cancelled': 'red', 'not-planned': 'red', 'rejected': 'red',
  'duplicate': 'red', 'retired': 'red', 'cannot-reproduce': 'red',
  // Purple
  'superseded': 'purple',
};

function getStatusColour(status: string): StatusColour {
  return STATUS_TO_COLOUR[status] ?? 'grey';  // Unknown → grey
}
```

### 5.3 Status Dot

The tree uses small filled circles (dots) rather than full Badge lozenges.

```typescript
interface StatusDotProps {
  status: string;
  className?: string;
}
```

Rendered as: `<span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: HEX }} />`

Uses the hex values directly for the dot fill colour (not the tinted background used for badges).

---

## 6. Filter Bar

### 6.1 Layout

```
┌────────────────────────────────────────────────────────────────┐
│ [🗺 Plan] [🧩 Feat] [☑ Task] [🐛 Bug] [⚖ Dec] [🚨 Inc] [❓ Chk] │
│ [● grey] [● blue] [● yellow] [● orange] [● green] [● red] [● purple] │
│ ×Feature  ×active                                               │
└────────────────────────────────────────────────────────────────┘
```

Three rows:
1. **Type toggles** — one per entity type
2. **Status colour toggles** — one per colour group
3. **Active filter badges** — removable lozenges showing current filters

### 6.2 Type Toggles

A shadcn `ToggleGroup` (type `"multiple"`), one toggle per entity type visible in the Workflows view:

| Toggle | Lucide Icon | Entity Type |
|--------|-------------|-------------|
| Plan | `Map` | `plan` |
| Feature | `Puzzle` | `feature` |
| Task | `CheckSquare` | `task` |
| Bug | `Bug` | `bug` |
| Decision | `Scale` | `decision` |
| Incident | `AlertOctagon` | `incident` |
| Checkpoint | `CircleHelp` | `checkpoint` |

**Default state:** All toggles are ON (all types visible). Toggling one OFF hides entities of that type throughout the tree and standalone sections. When a toggle is OFF, it appears dimmed (`opacity-50`).

**Behaviour:** Each toggle sets/unsets its type in `activeTypeFilters: Set<string>` in the filter state.

### 6.3 Status Colour Toggles

A second `ToggleGroup` (type `"multiple"`), one toggle per colour group:

| Toggle | Colour | Label |
|--------|--------|-------|
| Grey dot | `#9CA3AF` | (tooltip: "proposed, queued, draft") |
| Blue dot | `#3B82F6` | (tooltip: "designing, specifying, …") |
| Yellow dot | `#EAB308` | (tooltip: "active, in-progress, …") |
| Orange dot | `#F97316` | (tooltip: "blocked, needs-review, …") |
| Green dot | `#22C55E` | (tooltip: "done, closed, verified, …") |
| Red dot | `#EF4444` | (tooltip: "cancelled, not-planned, …") |
| Purple dot | `#A855F7` | (tooltip: "superseded") |

Each toggle is rendered as a coloured circle (12×12px, same hex as the status dot) inside the toggle button. A `Tooltip` on hover lists all statuses in that colour group.

**Default state:** All colour toggles are ON. Toggling one OFF hides all entities whose status maps to that colour.

### 6.4 Active Filter Badges

When any filter is active (a type or colour group is toggled OFF, meaning we're showing a subset), the third row shows removable `Badge` components:

```
×Feature  ×active
```

Each badge shows the filter value with a small `X` (Lucide `X` icon, 12px) on the left. Clicking the badge removes that filter (re-enables the toggle).

**Interaction from detail panel:** Clicking a `StatusBadge` or tag lozenge in the detail panel adds that value as an active filter:
- Clicking a status badge → enables only that status's colour group (turns off all others)
- Clicking a tag → not filtered in F3 (tags are not a filter dimension in F3; this is a future enhancement)

### 6.5 Filter Logic

Filters combine with **AND** logic:

```
visible = typeFilter.has(entity.type) AND statusColourFilter.has(getStatusColour(entity.status))
```

- An entity is visible only if its type is in the active type set AND its status colour is in the active colour set.
- For the hierarchical tree: if a Plan is filtered out, its children are also hidden. If a Feature is filtered out, its child Tasks are also hidden. If a Task is filtered out, only that task is hidden (it doesn't affect siblings).
- **Exception:** If a parent node is filtered out but has visible children (e.g., Plan type is OFF but Feature type is ON), the parent is still rendered as a "ghost" node — dimmed (`opacity-50`) and non-interactive — so the hierarchy remains intelligible. This prevents orphaned Features from appearing at the root level.
- Standalone sections (Bugs, Decisions, etc.) are hidden entirely when their type is filtered out. Individual items within are hidden when their status colour is filtered out.
- The Pending Checkpoints section follows normal filter rules — it can be hidden if the Checkpoint type or the orange colour group is filtered out.

### 6.6 Filter State

Managed in the Zustand UI store (`lib/store/ui-store.ts`):

```typescript
interface FilterState {
  activeTypes: Set<string>;           // entity types currently shown
  activeStatusColours: Set<string>;   // colour groups currently shown
  toggleType: (type: string) => void;
  toggleStatusColour: (colour: string) => void;
  clearFilters: () => void;
  activateStatusFilter: (status: string) => void;  // solo one colour group
}
```

`activateStatusFilter` is called when clicking a StatusBadge in the detail panel. It turns OFF all colour groups except the one matching the clicked status, providing a "show only this status" shortcut. Clicking the same badge again (or the `×` on the active filter) calls `clearFilters` to reset.

---

## 7. Progress Metrics

### 7.1 Task Completion by Feature

Displayed in `FeatureDetail` and as a summary in `PlanDetail`.

**Computation** (from `lib/query/metrics.ts`, created by F2):

```typescript
function taskCompletionByFeature(featureId: string, tasks: Map<string, Task>): {
  done: number;
  total: number;
  percentage: number;
} {
  const featureTasks = [...tasks.values()]
    .filter(t => t.parent_feature === featureId);

  const excluded = new Set(['not-planned', 'duplicate']);
  const countable = featureTasks.filter(t => !excluded.has(t.status));
  const done = countable.filter(t => t.status === 'done');

  return {
    done: done.length,
    total: countable.length,
    percentage: countable.length === 0 ? 0 : Math.round((done.length / countable.length) * 100),
  };
}
```

### 7.2 Feature Completion by Plan

Displayed in `PlanDetail`.

```typescript
function featureCompletionByPlan(planId: string, features: Map<string, Feature>): {
  done: number;
  total: number;
  percentage: number;
} {
  const planFeatures = [...features.values()]
    .filter(f => f.parent === planId);

  const excluded = new Set(['cancelled', 'superseded']);
  const countable = planFeatures.filter(f => !excluded.has(f.status));
  const done = countable.filter(f => f.status === 'done');

  return {
    done: done.length,
    total: countable.length,
    percentage: countable.length === 0 ? 0 : Math.round((done.length / countable.length) * 100),
  };
}
```

### 7.3 Estimate Rollup

Displayed in `FeatureDetail` and `PlanDetail`.

```typescript
interface EstimateRollup {
  total: number;         // sum of estimated children
  estimated: number;     // count of children with estimate
  unestimated: number;   // count of children without estimate
}
```

- Feature estimate rollup: sum of child task `estimate` fields (where present)
- Plan estimate rollup: sum of child feature `estimate` fields (where present)
- Entities without `estimate` are counted as "unestimated", **not** as zero

### 7.4 ProgressBar Component

**Props:**

```typescript
interface ProgressBarProps {
  done: number;
  total: number;
  percentage: number;
  label?: string;     // e.g., "Tasks" or "Features"
}
```

**Rendering:**

```
Tasks  5/8 done (62%)
████████████████░░░░░░░░░░
```

- Header line: `{label} {done}/{total} done ({percentage}%)` in `text-sm text-muted-foreground`
- Bar: shadcn `Progress` component with `value={percentage}`
- Bar colour: green when 100%, default theme colour otherwise
- Zero tasks (total = 0): show "No tasks" text instead of bar

### 7.5 EstimateDisplay Component

**Props:**

```typescript
interface EstimateDisplayProps {
  rollup: EstimateRollup;
  entityEstimate?: number;  // the entity's own estimate field
}
```

**Rendering:**

- If `entityEstimate` is set: `"{entityEstimate} pts"` in `text-sm font-mono`
- Rollup line (for features/plans): `"Rollup: {total} pts ({estimated} estimated, {unestimated} unestimated)"` in `text-xs text-muted-foreground`
- If everything is unestimated: `"unestimated"` in `text-sm text-muted-foreground italic`

---

## 8. Component File Manifest

All components created or modified by Feature 3:

```
src/components/
├── tree/
│   ├── EntityTree.tsx           # NEW — full tree view, reads store, applies filters
│   ├── TreeNode.tsx             # NEW — recursive node (Collapsible + SidebarMenuSub)
│   ├── TreeContext.tsx          # NEW — React context for expand/collapse/selection
│   ├── StandaloneSection.tsx    # NEW — collapsible section for Bugs/Decisions/etc.
│   └── StatusDot.tsx            # NEW — tiny coloured circle
│
├── entity/
│   ├── EntityDetail.tsx         # NEW — router selecting detail view by type
│   ├── PlanDetail.tsx           # NEW
│   ├── FeatureDetail.tsx        # NEW
│   ├── TaskDetail.tsx           # NEW
│   ├── BugDetail.tsx            # NEW
│   ├── DecisionDetail.tsx       # NEW
│   ├── CheckpointDetail.tsx     # NEW
│   ├── IncidentDetail.tsx       # NEW
│   ├── KnowledgeDetail.tsx      # NEW
│   └── FieldValue.tsx           # NEW — polymorphic field renderer
│
├── filter/
│   ├── FilterBar.tsx            # NEW — type + status toggles + active badges
│   ├── TypeToggle.tsx           # NEW — single type toggle with icon
│   └── StatusColourToggle.tsx   # NEW — single colour-group toggle
│
├── metrics/
│   ├── ProgressBar.tsx          # NEW — task/feature completion bar
│   └── EstimateDisplay.tsx      # NEW — story point display
│
└── common/
    ├── StatusBadge.tsx          # NEW — coloured status lozenge (Badge variant)
    ├── EntityLink.tsx           # NEW — clickable entity reference (navigation stubbed for F5)
    └── EmptyState.tsx           # MODIFIED (from F1) — add project summary variant
```

**Pages / view integration:**

```
src/views/
└── WorkflowsView.tsx           # NEW — composes FilterBar + EntityTree + EntityDetail
```

`WorkflowsView.tsx` is the top-level component rendered when the Workflows tab is active. It manages the two-column layout and connects the filter state, tree selection, and detail panel.

---

## 9. Data Dependencies

Feature 3 consumes data provided by Feature 2's data layer. It does **not** create any new data-layer code — it only reads from the store and calls query functions.

### 9.1 Zustand Store Reads

| Store Field | Used By |
|-------------|---------|
| `plans` | EntityTree, PlanDetail |
| `features` | EntityTree, FeatureDetail, PlanDetail (related) |
| `tasks` | EntityTree, TaskDetail, FeatureDetail (related) |
| `bugs` | StandaloneSection, BugDetail, FeatureDetail (linked) |
| `decisions` | StandaloneSection, DecisionDetail, FeatureDetail (linked) |
| `incidents` | StandaloneSection, IncidentDetail |
| `checkpoints` | StandaloneSection, CheckpointDetail |
| `knowledge` | KnowledgeDetail |
| `documents` | PlanDetail (related), FeatureDetail (related) |
| `tree` | EntityTree (primary data source) |
| `pendingCheckpoints` | StandaloneSection (Pending Checkpoints) |

### 9.2 Query Functions

| Function | Module | Used By |
|----------|--------|---------|
| `taskCompletionByFeature()` | `lib/query/metrics.ts` | FeatureDetail, PlanDetail |
| `featureCompletionByPlan()` | `lib/query/metrics.ts` | PlanDetail |
| `estimateRollup()` | `lib/query/metrics.ts` | FeatureDetail, PlanDetail, EstimateDisplay |
| `resolveEntityType()` | `lib/query/references.ts` | EntityLink |
| `getStatusColour()` | `lib/constants/status-colours.ts` | StatusBadge, StatusDot, FilterBar |

### 9.3 UI Store (new state for F3)

The UI store (`lib/store/ui-store.ts`, created by F1/F2) is extended with:

```typescript
// Selection state
selectedEntityId: string | null;
selectedEntityType: string | null;
selectEntity: (id: string | null, type: string | null) => void;

// Filter state
activeTypes: Set<string>;
activeStatusColours: Set<string>;
toggleType: (type: string) => void;
toggleStatusColour: (colour: string) => void;
clearFilters: () => void;
activateStatusFilter: (status: string) => void;
```

---

## 10. Interaction Flows

### 10.1 Browse Entity Tree

1. User opens the Workflows view (via tab in header)
2. `WorkflowsView` mounts, reads `tree` from store
3. `EntityTree` renders Plan nodes (collapsed by default except the first Plan)
4. User clicks chevron on `P1-kbzv` → expands, showing child Features
5. User clicks chevron on `FEAT-003` → expands, showing child Tasks
6. User clicks `TASK-03a` → tree highlights the row, detail panel shows `TaskDetail`

### 10.2 Inspect Entity Detail

1. User clicks `FEAT-003` in the tree
2. `TreeContext.select("FEAT-01KMZA9GFB075", "feature")` fires
3. `EntityDetail` receives the new `entityId` / `entityType`
4. `FeatureDetail` renders with all populated fields
5. Related Tasks section shows a `ProgressBar` with `0/3 done (0%)`
6. User clicks `P1-kbzv` EntityLink in the Parent field
7. `EntityLink.onClick` calls `TreeContext.select()` for the Plan and `TreeContext.expandTo()` to ensure it's visible
8. Detail panel now shows `PlanDetail` for `P1-kbzv`

### 10.3 Filter by Status

1. User clicks the Yellow colour toggle (deactivating it)
2. All entities with statuses `active`, `in-progress`, `investigating`, `developing` are hidden
3. Active filter badge appears: `×active/in-progress/…`
4. Tree re-renders without those entities. Ghost parents appear where needed.
5. User clicks the `×` on the badge → yellow colour group re-enabled, tree restores

### 10.4 Filter from Detail Panel

1. User is viewing `TASK-03a` which has status `queued` (grey)
2. User clicks the `[queued]` StatusBadge in the detail panel
3. `activateStatusFilter("queued")` is called
4. All colour groups except Grey are turned OFF
5. Only grey-status entities remain visible
6. Active filter badges show the solo filter state

### 10.5 Navigate to Broken Reference

1. `FeatureDetail` for `FEAT-003` shows `depends_on: [FEAT-999]`
2. `EntityLink` for `FEAT-999` finds no entity in the store
3. Renders as: ~~FEAT-999~~ (dimmed, line-through, `cursor: default`)
4. Tooltip on hover: "Entity not found"
5. No click action

---

## 11. Error Handling

Following the architecture's error handling principles (§8):

| Scenario | Behaviour |
|----------|-----------|
| Unknown status value | `StatusBadge` and `StatusDot` render grey with the raw status string. Never crash. |
| Missing/absent fields | `FieldValue` is not rendered. The detail panel only shows populated fields. |
| Broken entity reference | `EntityLink` renders dimmed with "not found" tooltip. No click action. |
| Empty entity maps | Tree shows `EmptyState`. Standalone sections show "(none)". |
| Entity type not in router | `EntityDetail` renders a generic fallback: icon + ID + all fields as key-value pairs. |
| Zero tasks for a feature | `ProgressBar` shows "No tasks" instead of a bar. Avoids division by zero. |
| Circular `depends_on` | `TaskDetail` renders the dependency list as-is. No cycle detection needed — it's a viewer. |
| Very long summaries | Truncated with `truncate` (ellipsis) in tree nodes. Full text shown in detail panel. |
| Very long field values | `long-text` type uses `Collapsible` — first 3 lines visible, expandable. |

---

## 12. Design Fundamentals Applied

Cross-referencing architecture §6.1 principles to F3 implementation:

| Principle | F3 Application |
|-----------|----------------|
| **Minimum info for the size** | Tree nodes show only ID + summary + status dot. Full detail is in the right panel. |
| **Clickability is visible** | All tree nodes, EntityLinks, StatusBadges, filter toggles have `cursor: pointer`. |
| **Colour carries meaning** | Status dots and badges follow the 7-colour palette. Orange highlight for pending checkpoints. |
| **Typography adds info** | Entity ID is bold/mono (primary). Summary is normal/muted (secondary). Timestamps are small/grey. |
| **Popovers for overflow** | Timestamps show full RFC3339 in Tooltip. Status colour toggles show their statuses in Tooltip. |
| **Everything that can link, does** | Entity IDs in fields are EntityLinks. StatusBadges activate filters. Tags are lozenges. |
| **Metadata as lozenges** | Status, tags, severity, priority, bug type all rendered as Badge components. |
| **Icons: routine, judicious** | Each entity type has one Lucide icon, used in detail headers and filter toggles. Tooltips explain. |
| **IDs primary for workflow entities** | Entity ID is the primary label in both tree and detail. Summary is supporting text. |
| **No pagination** | All entities render. Virtual scrolling can be added later if performance requires. |

---

## 13. shadcn/ui Components Required

Components to install (beyond what F1 provides):

| Component | Usage |
|-----------|-------|
| `SidebarMenu` / `SidebarMenuSub` | Tree node hierarchy (sidebar-11 pattern, already part of `Sidebar` from F1) |
| `Collapsible` | Tree nodes, standalone sections, long text expansion (installed by F1) |
| `Badge` | StatusBadge, tags, severity/priority, active filter lozenges (installed by F1) |
| `ToggleGroup` / `Toggle` | Filter bar type and status toggles (installed by F1) |
| `Progress` | ProgressBar for task/feature completion (installed by F1) |
| `Tooltip` / `Popover` | Timestamp hover, colour group hover, EntityLink summary (installed by F1) |
| `Card` | Optional wrapper for detail panel sections (installed by F1) |
| `Separator` | Column divider, section dividers in detail panel (installed by F1) |

**External packages:** `date-fns` for `formatDistanceToNow` (relative timestamps). Should be added to `package.json` if not already present.

---

## 14. Acceptance Criteria

1. **Full tree renders** — Opening a project shows all Plans with nested Features and Tasks in the correct hierarchy.
2. **Status colours correct** — Every status dot and badge uses the prescribed colour from the 7-colour palette.
3. **Expand/collapse works** — Chevrons toggle children at all levels. Expanding a Plan reveals Features; expanding a Feature reveals Tasks.
4. **Entity selection works** — Clicking any entity in the tree (or standalone section) shows its full detail in the right panel.
5. **Detail renders all fields** — Each entity type shows all populated fields with correct formatting (timestamps as relative, arrays as lozenges, long text as expandable).
6. **Progress bars correct** — Feature detail shows task completion with correct done/total/percentage. Plan detail shows feature completion.
7. **Estimate rollup correct** — Features show sum of task estimates with unestimated count. Plans show sum of feature estimates.
8. **Broken references handled** — EntityLinks to non-existent entities render dimmed with "not found" state. No crashes.
9. **Unknown statuses handled** — Any unrecognised status string renders grey with the raw string. No crashes.
10. **Type filters work** — Toggling a type OFF hides all entities of that type. Ghost parents preserve hierarchy.
11. **Status colour filters work** — Toggling a colour OFF hides all entities with statuses in that colour group.
12. **Filter badges appear** — Active filters show as removable badges. Clicking `×` removes the filter.
13. **Detail panel filter activation** — Clicking a StatusBadge in the detail panel activates that colour group as a solo filter.
14. **Pending checkpoints prominent** — The Pending Checkpoints section is always expanded when non-empty, with orange background highlight.
15. **Empty state** — When no entity is selected, the detail panel shows a project summary with counts and overall progress.
16. **EntityLink within-tree navigation** — Clicking an EntityLink in the detail panel selects that entity in the tree, expanding ancestors as needed.
17. **Standalone sections populated** — Bugs, Decisions, Incidents each appear in their own collapsible section below the tree with correct entries and status dots.
18. **Sorting correct** — Plans sort by prefix. Features/Tasks sort by ID (chronological). Standalone entities sort by ID.

---

## References

- [KBZV Architecture Design](kbzv-architecture.md) — §6.1, §6.5, §6.6, §6.7, §6.8, §6.10, §7.1, §7.4, §7.5, §8
- [KBZV v1.0 Dev Plan](../plan/kbzv-v1-dev-plan.md) — Feature 3 scope and acceptance criteria
- [Kanbanzai Viewer Guide](../plan/kbz-references/kanbanzai-guide-for-viewer-agents.md) — §10, §16 (tree building, sorting, colouring, metrics)
- [Schema Reference](../plan/kbz-references/schema-reference.md) — entity field definitions
- [shadcn sidebar-11 example](https://ui.shadcn.com/blocks/sidebar-11) — reference pattern for collapsible tree