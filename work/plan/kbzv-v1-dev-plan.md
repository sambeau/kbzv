# KBZV v1.0 Development Plan

## Overview

This plan decomposes the KBZV v1.0 architecture into six features, ordered by dependency. Each feature is a vertical slice that delivers testable, visible progress. The architecture document (`work/design/kbzv-architecture.md`) is the source of truth for all design decisions referenced here.

### Dependency Graph

```
F1: App Scaffold + Theme
 ├── F2: Data Layer
 │    ├── F3: Workflows View  ─────┐
 │    ├── F4: Documents View  ─────┤
 │    │                            ├── F5: Cross-View Navigation
 │    └── F6: File Watching + Git Status
```

F1 → F2 is strictly sequential. F3 and F4 can be worked in parallel (both depend on F2, neither depends on the other). F5 depends on both F3 and F4. F6 depends on F2 but is otherwise independent.

---

## Feature 1: App Scaffold + Theme

**Goal:** A running Tauri v2 desktop app with React, shadcn/ui (Nova/Mist/Sky theme), and a project-open dialog. The app shell displays the two-view layout with a header (view switcher + placeholder git info area) and empty states for both views.

**Why first:** Everything else builds on this. It validates the toolchain, establishes the visual foundation, and gives us something to run immediately.

### Scope

- Tauri v2 scaffold (`src-tauri/`) with minimal Rust: `lib.rs`, `tauri.conf.json`, capabilities for FS access and native dialogs
- React + TypeScript + Vite frontend in `src/`
- Tailwind CSS + shadcn/ui initialised with `--preset b7BFemEXi` (Nova style, Mist base, Sky theme)
- Install core shadcn components: `Button`, `Badge`, `Tabs`, `Collapsible`, `Popover`, `Tooltip`, `Separator`, `Progress`, `Toggle`, `ToggleGroup`, `Card`
- `App.tsx` with header bar containing view switcher (two tabs: Documents, Workflows) and a placeholder git info area (right-aligned)
- Each view renders an empty state component ("No project open — click to open a folder")
- Project open: native folder picker via `@tauri-apps/plugin-dialog`, validates `.kbz/config.yaml` exists, shows error dialog if not a Kanbanzai project
- Store the selected project path in a minimal Zustand `ui-store` (just `projectPath`, `activeView`)
- `globals.css` with Tailwind imports and the shadcn theme CSS variables
- Lucide React icons installed (ships with shadcn)

### Acceptance Criteria

- `pnpm tauri dev` launches a desktop window with the header bar and view switcher
- Clicking "Open" triggers a native folder picker
- Selecting a valid Kanbanzai project stores the path; selecting an invalid folder shows an error
- View switcher toggles between Documents and Workflows (both showing empty states)
- The shadcn theme (Nova/Mist/Sky) is visibly applied — correct colours, typography, spacing

### Out of Scope

- No entity loading, no YAML parsing, no actual content in either view

---

## Feature 2: Data Layer

**Goal:** Open a Kanbanzai project folder, parse all `.kbz/state/` YAML files into typed entity maps, parse the config, and build the entity hierarchy tree. The data is available in a Zustand store for the UI to consume.

**Why second:** The UI views (F3, F4) need data to render. This feature is pure data — no visual changes except possibly a loading indicator. But it's fully testable: load a project, inspect the store, verify all entities are parsed correctly.

### Scope

- TypeScript entity type definitions in `src/lib/types/` — one file per entity type (`plan.ts`, `feature.ts`, `task.ts`, `bug.ts`, `decision.ts`, `knowledge.ts`, `document.ts`, `incident.ts`, `checkpoint.ts`, `config.ts`, `index.ts`), matching the interfaces in architecture §4.1
- `src/lib/reader/loader.ts`:
  - `openProject(path)`: read and parse `.kbz/config.yaml`, walk each `state/` subdirectory, parse all `.yaml` files, populate entity maps
  - Handle missing subdirectories gracefully (skip silently)
  - Handle YAML parse errors per-file (log warning, skip file)
  - Handle unknown fields (ignore — forward compatibility)
  - Filename → entity type mapping per architecture §5.2
- `src/lib/store/project-store.ts` (Zustand):
  - `ProjectState` interface per architecture §4.3
  - Entity maps: `plans`, `features`, `tasks`, `bugs`, `decisions`, `knowledge`, `documents`, `incidents`, `checkpoints`
  - `config: ProjectConfig | null`
  - Actions: `openProject(path)`, `closeProject()`
- `src/lib/query/tree.ts`:
  - Build the Plan → Feature → Task hierarchy from entity maps
  - Standalone entity lists: Bugs, Decisions, Incidents, Checkpoints
  - Sort plans by prefix+number, TSID13 entities lexicographically (= chronological)
- `src/lib/query/metrics.ts`:
  - Task completion % per feature
  - Feature completion % per plan
  - Estimate rollups (per architecture §6.10)
- `src/lib/query/references.ts`:
  - Resolve entity ID → entity type from prefix pattern (architecture §7.1)
  - Look up referenced entities in the store
- `src/lib/constants/status-colours.ts`: status → hex colour mapping (architecture §6.5)
- `src/lib/constants/entity-types.ts`: entity type metadata (icon, label, directory name)

### Acceptance Criteria

- Opening a Kanbanzai project populates all entity maps with correctly typed data
- The tree hierarchy correctly nests Features under Plans and Tasks under Features
- Metrics compute correct completion percentages and estimate rollups
- Missing directories, unparseable files, and unknown fields are handled without crashing
- Reference resolution correctly identifies entity type from ID prefix

### Out of Scope

- No UI changes beyond wiring `openProject` to the existing folder picker from F1
- No file watching (F6)
- No document content reading (F4)

---

## Feature 3: Workflows View

**Goal:** The Workflows view displays the full entity tree as nested collapsibles (Plan → Feature → Task) with an entity detail panel on the right. Status badges, filter bar, and progress metrics are functional.

**Why now:** This is the primary view for understanding project state. It depends on F1 (shell) and F2 (data), but not on F4 (Documents view).

### Scope

#### Entity Tree (left column)

- `src/components/tree/EntityTree.tsx`: full tree built from the store's `tree` data
- `src/components/tree/TreeNode.tsx`: individual node using shadcn `Collapsible` + `SidebarMenuSub` (based on sidebar-11 pattern)
  - Each node: status-coloured dot + entity ID (bold) + summary/label (normal weight)
  - Collapsible chevron on nodes with children
  - `cursor: pointer` on all clickable nodes
- Standalone collapsible sections below the tree:
  - Bugs (flat list with status dots)
  - Decisions (flat list)
  - Incidents (flat list, if any)
  - Pending Checkpoints (always visible when non-empty, orange background highlight)
- Clicking any entity selects it and populates the detail panel

#### Entity Detail Panel (right column)

- `src/components/entity/EntityDetail.tsx`: router component that selects the right detail view by entity type
- Per-type detail components: `PlanDetail.tsx`, `FeatureDetail.tsx`, `TaskDetail.tsx`, `BugDetail.tsx`, `DecisionDetail.tsx`, `CheckpointDetail.tsx`
- Each detail view:
  - Header: Lucide icon + ID (prominent) + summary + status lozenge
  - All populated fields rendered by type
  - Timestamps: relative format ("3 days ago") with full RFC3339 in a `Tooltip` on hover
  - Arrays (`tags`, `depends_on`, `files_planned`): rendered as lozenges; entity IDs rendered as `EntityLink` components (clickable styling with `cursor: pointer`, but navigation wired in F5)
  - Long text fields: expandable via `Collapsible`
  - Related entities section (cross-references): Feature shows its Tasks with progress bar, Documents (by title), linked Bugs/Decisions; Plan shows Features with progress summary; Task shows dependencies/dependents
- `src/components/common/StatusBadge.tsx`: shadcn `Badge` with colour variant from status-colours mapping; unknown statuses render grey with raw string
- `src/components/common/EntityLink.tsx`: clickable reference component — resolves entity type from ID prefix, shows summary as tooltip, dimmed with "not found" indicator for broken references. Navigation action stubbed for F5.
- `src/components/metrics/ProgressBar.tsx`: shadcn `Progress` for task completion within features
- `src/components/metrics/EstimateDisplay.tsx`: story point display with "unestimated" indicator
- Empty state when nothing is selected: light project summary (plan/feature/task counts, overall progress) or simply empty

#### Filter Bar

- Filter bar above the tree:
  - Type toggles (shadcn `ToggleGroup`): Plan, Feature, Task, Bug, Decision, Incident, Checkpoint — each with Lucide icon
  - Status toggles: segmented by colour groups
  - Active filters shown as removable `Badge` lozenges
  - Clicking a lozenge in the detail panel activates that filter (within-view only; cross-view filter activation is F5)
- Filters are combinative (AND logic)

### Acceptance Criteria

- Opening a project shows the full tree with correct nesting and status colours
- Expanding/collapsing works at all tree levels
- Clicking an entity shows its full detail in the right panel
- Status badges use the correct colour palette from the architecture doc
- Progress bars compute and display correct percentages
- Broken references show a dimmed "not found" state
- Unknown status values display as grey with the raw string
- Filter toggles correctly show/hide entities by type and status
- Pending checkpoints section is prominently visible with orange highlight when non-empty

### Out of Scope

- Cross-view navigation (F5) — EntityLink clicks within Workflows view navigate within the tree; clicking document references is wired in F5
- File watching (F6) — data is from initial load only

---

## Feature 4: Documents View

**Goal:** The Documents view shows a filterable list of all project documents, and clicking one opens a Markdown viewer with GitHub-flavoured rendering, paper-width layout, and a metadata sidebar with drift detection.

**Why now:** This is the second primary view. It depends on F1 (shell) and F2 (data layer for DocumentRecord entities), but not on F3 (Workflows).

### Scope

#### Document List

- `src/components/document/DocumentList.tsx`:
  - Lists all DocumentRecords from the store
  - Each row: title (prominent), date modified (small/grey, relative with full date on hover), type lozenge, status lozenge
  - Default sort: date modified, newest first
  - Sort control (dropdown): by title, date, type, status
  - Clicking a row opens the Document Viewer
  - `cursor: pointer` on all rows
- Filter bar (same pattern as Workflows):
  - Type toggles: design, specification, dev-plan, research, report, policy
  - Status toggles: approved (green), draft (grey), superseded (purple)
  - Clicking a lozenge in the list activates that filter
  - AND logic
- Type lozenges: each document type gets a distinct colour (differentiated from status colours)

#### Document Viewer

- `src/components/document/DocumentViewer.tsx`:
  - Back button (shadcn `Button` variant="ghost" + ChevronLeft icon) — returns to document list, preserving scroll position and filters
  - Document title displayed prominently below the header
- `src/components/document/MarkdownViewer.tsx`:
  - Renders markdown at paper width (~700px max-width)
  - Uses `react-markdown` + `remark-gfm` (tables, task lists, strikethrough) + `rehype-highlight` (syntax highlighting)
  - `rehype-sanitize` for XSS protection
  - GitHub-style clean theme
  - Heading hierarchy with anchor links
- `src/lib/reader/document.ts`:
  - Read Markdown file content from `{projectPath}/{documentRecord.path}`
  - Compute SHA-256 hash of file content
  - Compare against `content_hash` field for drift detection
  - Handle missing files (return "not found" status)
- `src/components/document/MetadataPanel.tsx` (right sidebar, ~250px):
  - Status (prominent, top): drift-aware badge
    - Approved + hash matches → green "Approved"
    - Approved + hash differs → orange "Modified since approval"
    - Draft → grey "Draft"
    - Superseded → purple "Superseded" (with link to successor, wired in F5)
  - Filename (small/grey)
  - Type lozenge
  - Owner (parent plan or feature) — displayed as EntityLink (navigation wired in F5)
  - Related entities — any entities referencing this document, each as EntityLink
  - Content hash status (small/grey, match/mismatch)
- `src/components/document/DriftBadge.tsx`: badge component that computes and displays drift status

### Acceptance Criteria

- Document list shows all DocumentRecords with correct titles (not filenames), dates, types, and statuses
- Filters work correctly for type and status combinations
- Sort control changes list order
- Clicking a document opens the viewer with rendered Markdown
- GFM features work: tables, task lists, strikethrough, code blocks with syntax highlighting
- Markdown renders at paper width, not full-width
- Metadata panel shows correct status with drift detection
- Missing markdown files show a "File not found" message
- Back button returns to the list with scroll position and filters preserved

### Out of Scope

- Cross-view navigation from metadata panel (F5) — EntityLinks are rendered but navigation is stubbed
- Live updates when documents change on disk (F6)

---

## Feature 5: Cross-View Navigation

**Goal:** Clicking an entity reference anywhere navigates to that entity — across views if needed. Clicking a document reference opens the Document Viewer. Clicking a metadata lozenge activates it as a filter. The tree auto-syncs with navigation.

**Why now:** This ties F3 and F4 together into a cohesive app. Without it, the two views are isolated. With it, you can follow the thread of a project naturally.

### Scope

- Wire `EntityLink.onClick` navigation:
  - Determine target entity type from ID prefix
  - If target is a DocumentRecord → switch to Documents view, open Document Viewer for that document
  - If target is any other entity → switch to Workflows view, select in tree, show detail panel
- Wire document reference clicks in Workflows detail panels → open Documents view with that document
- Wire metadata lozenge clicks:
  - Clicking a type or status lozenge in the detail panel → activate that value as a filter in the appropriate view
  - Cross-view lozenge activation: e.g., clicking a document type badge in Workflows detail → switch to Documents view with that type filter active
- `src/lib/store/ui-store.ts` updates:
  - `activeView`: 'documents' | 'workflows'
  - `selectedEntityId`: string | null (for Workflows)
  - `viewingDocumentId`: string | null (for Documents viewer)
  - `documentFilters`: { types: string[], statuses: string[] }
  - `workflowFilters`: { types: string[], statuses: string[] }
  - Navigation actions: `navigateToEntity(id)`, `navigateToDocument(id)`, `activateFilter(view, field, value)`
- Tree selection sync:
  - `navigateToEntity` expands the tree path to the target and auto-scrolls to it
  - Works from any origin: clicking an EntityLink in a detail panel, clicking a reference in the Document Viewer metadata panel, or any other navigation source
- Navigation history for Documents view:
  - Back button returns from viewer to list (preserving filters and scroll position)
  - `⌘[` / `⌘]` keyboard shortcuts for back/forward within the active view
- Superseded document links: clicking "superseded by" in document metadata navigates to the successor document

### Acceptance Criteria

- Clicking an entity ID in a document's metadata panel switches to Workflows view and selects that entity
- Clicking a document reference in a feature's detail panel switches to Documents view and opens the viewer
- Clicking a status lozenge in the Workflows detail panel activates that status filter in the Workflows filter bar
- Tree auto-expands and scrolls to the selected entity when navigating via cross-reference
- `⌘[` / `⌘]` navigate back/forward within the Documents view (list ↔ viewer)
- Broken references (entity not found) show dimmed text with tooltip and do not navigate

### Out of Scope

- Search (deferred to v1.1)

---

## Feature 6: File Watching + Git Status

**Goal:** The app automatically updates when `.kbz/state/` files change on disk, and displays read-only git status information in the header.

**Why last:** The app is fully functional without this — it loads data on project open. This feature makes it *live*. It depends on F2 (data layer to update) but is otherwise independent of the UI features.

### Scope

#### File Watching

- `src/lib/reader/watcher.ts`:
  - Watch `.kbz/state/` recursively using `@tauri-apps/plugin-fs` watch API
  - On file create/modify: re-parse the affected YAML file, update the entity map in the store, rebuild derived data (tree, metrics, pending checkpoints)
  - On file delete: remove the entity from the map, rebuild derived data
  - Debounce with ~200ms window to batch rapid writes during orchestration bursts
  - Watch configured document roots (`work/` etc.) for Markdown file changes — invalidate cached content hashes so drift badges update
- Wire watcher start/stop to `openProject` / `closeProject` in the project store
- Handle watcher errors gracefully (log, don't crash)

#### Git Status Panel

- `src/components/layout/GitInfo.tsx`:
  - Displays in the header bar (right side)
  - Repo name / current branch (with GitBranch Lucide icon)
  - Uncommitted changes count (from `git status --porcelain`)
  - Ahead/behind remote counts (ArrowUp / ArrowDown Lucide icons)
  - Purely informational — no interactive elements
- Git data retrieval:
  - Run git commands via Tauri shell plugin (or Tauri command) at project open and on file-watch events
  - `git rev-parse --abbrev-ref HEAD` for branch name
  - `git status --porcelain` piped to line count for changes
  - `git rev-list --left-right --count HEAD...@{upstream}` for ahead/behind
  - Handle non-git projects gracefully (hide the panel)
  - Handle missing upstream gracefully (show branch, hide ahead/behind)
- Refresh git info alongside entity data on file-watch events

### Acceptance Criteria

- Editing a `.kbz/state/` YAML file externally (e.g., via kanbanzai CLI) updates the viewer within ~500ms
- Adding a new entity file appears in the tree/list without reopening the project
- Deleting an entity file removes it from the tree/list
- Rapid sequential changes (orchestration burst) are batched and don't cause visual flicker
- Git info panel shows correct branch name, change count, and ahead/behind
- Non-git projects show no git info panel (graceful absence)
- Markdown file changes trigger drift badge updates in the Documents view

### Out of Scope

- Git operations (pull, commit, etc.) — this is read-only
- Watching for config changes (`.kbz/config.yaml` changes require reopening the project — acceptable for v1)

---

## Implementation Notes

### Parallel Work

Features 3 and 4 can be developed in parallel once F2 is complete — they share the data layer but touch completely separate component trees. Feature 6 is also largely independent and could overlap with F3/F4 work.

### Test Strategy

- **Data layer (F2):** Unit tests with fixture `.kbz/` directories — test YAML parsing, tree building, metrics computation, reference resolution, and all error cases from architecture §8.2
- **UI components (F3, F4):** Component tests with mock store data — verify rendering, badge colours, filter behaviour
- **Navigation (F5):** Integration tests verifying cross-view navigation flows
- **File watching (F6):** Integration tests with file system manipulation — verify debounce, add/modify/delete handling

### Development Data

Use the kbzv project's own `.kbz/` directory as development test data. For richer testing, create a fixture project under `test/fixtures/` with representative entities of every type, including edge cases (broken references, missing files, superseded documents, unknown statuses).

### shadcn Component Installation Order

F1 installs the core set. Additional components are added as needed:

- **F1:** Button, Badge, Tabs, Collapsible, Popover, Tooltip, Separator, Progress, Toggle, ToggleGroup, Card, Sidebar
- **F3:** SidebarMenu, SidebarMenuSub (via sidebar primitives already in Sidebar)
- **F4:** react-markdown, remark-gfm, rehype-highlight, rehype-sanitize (npm packages, not shadcn)
- **F5:** No new components — wires existing ones together

---

## References

- [KBZV Architecture Design](../design/kbzv-architecture.md) — source of truth for all technical decisions
- [KBZV Initial Proposal](kbzv-initial-proposal.md) — project motivation and scope
- [Kanbanzai Viewer Guide](kbz-references/kanbanzai-guide-for-viewer-agents.md) — status colours, tree algorithm, error handling rules
- [Schema Reference](kbz-references/schema-reference.md) — entity field definitions and lifecycle states