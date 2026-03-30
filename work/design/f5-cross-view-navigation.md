# Feature 5: Cross-View Navigation — Design Document

**Feature ID:** FEAT-01KMZA9MWR7WK
**Parent Plan:** P1-kbzv
**Depends on:** FEAT-01KMZA9GFB075 (F3: Workflows View), FEAT-01KMZA9JMZFNF (F4: Documents View)
**Architecture reference:** kbzv-architecture.md §7 (Navigation Model)

---

## 1. Purpose

Features 3 and 4 build the Workflows and Documents views as independent screens. Without F5, they are isolated — you can browse entities *or* read documents, but you cannot follow the thread of a project across both. This feature wires them together into a cohesive navigation experience.

Concretely, F5 delivers:

- **Cross-reference navigation**: clicking an entity ID anywhere navigates to that entity, switching views if necessary.
- **Document reference navigation**: clicking a document reference opens the Document Viewer, switching views if necessary.
- **Lozenge filter activation**: clicking a metadata lozenge activates it as a filter in the appropriate view.
- **Tree selection sync**: the entity tree auto-expands, selects, and scrolls to match navigation state.
- **Navigation history**: back/forward within the Documents view, plus keyboard shortcuts.

F5 creates no new visual components. It wires existing stubs (from F3 and F4) into a functioning navigation system.

---

## 2. Navigation State Machine

### 2.1 UI Store Shape

All navigation state lives in `src/lib/store/ui-store.ts`. F3 and F4 establish a minimal UI store; F5 expands it to the following shape:

```typescript
interface UIState {
  // --- View routing ---
  activeView: 'documents' | 'workflows';

  // --- Workflows view state ---
  selectedEntityId: string | null;

  // --- Documents view state ---
  documentViewMode: 'list' | 'viewer';
  viewingDocumentId: string | null;
  documentListScrollTop: number;          // preserved across list ↔ viewer transitions

  // --- Filters (per-view) ---
  documentFilters: {
    types: string[];      // e.g. ['design', 'specification']
    statuses: string[];   // e.g. ['approved']
  };
  workflowFilters: {
    types: string[];      // e.g. ['feature', 'task']
    statuses: string[];   // e.g. ['active', 'blocked']
  };

  // --- Documents view history stack ---
  documentHistory: DocumentHistoryEntry[];
  documentHistoryIndex: number;

  // --- Tree expansion state ---
  expandedNodeIds: Set<string>;
}

interface DocumentHistoryEntry {
  mode: 'list' | 'viewer';
  documentId: string | null;    // non-null when mode === 'viewer'
  scrollTop: number;            // captured from list on departure
  filters: { types: string[]; statuses: string[] };
}
```

### 2.2 State Transitions

The navigation state machine has two independent axes: **active view** and **intra-view state**.

```
                    ┌──────────────────────────────────────────┐
                    │            activeView                     │
                    │                                          │
                    │   'documents'  ◄────────►  'workflows'   │
                    │                                          │
                    └──────────────────────────────────────────┘
                          │                          │
                    ┌─────┴─────┐              ┌─────┴─────┐
                    │ Documents │              │ Workflows │
                    │   State   │              │   State   │
                    │           │              │           │
                    │  list ◄─► │              │ selected  │
                    │  viewer   │              │ entity ID │
                    └───────────┘              └───────────┘
```

**Documents view** has a sub-state machine:

```
    ┌──────┐   click row    ┌────────┐
    │ list │ ──────────────► │ viewer │
    │      │ ◄────────────── │        │
    └──────┘   back button   └────────┘
                 ⌘[
```

**Workflows view** has no sub-state — the tree is always visible alongside the detail panel. Selecting a different entity simply replaces `selectedEntityId`.

---

## 3. Navigation Actions

All navigation is dispatched through three primary actions on the UI store. Every clickable reference in the app calls one of these — no component performs navigation logic directly.

### 3.1 `navigateToEntity(id: string)`

The primary cross-reference navigation action. Called when any `EntityLink` is clicked.

**Algorithm:**

```
navigateToEntity(id):
  1. Determine entity type from ID prefix (see §4.1)
  2. If type is 'document' (ID contains '/'):
       → delegate to navigateToDocument(id)
       → return
  3. Look up entity in project store
  4. If entity not found:
       → no-op (broken references are non-navigable; see §6)
       → return
  5. Set selectedEntityId = id
  6. If activeView !== 'workflows':
       → set activeView = 'workflows'
  7. Expand tree path to entity (see §5)
  8. Schedule scroll-to-selected (see §5.2)
```

**Expand tree path** (step 7) means computing the ancestry chain and ensuring every ancestor node is in `expandedNodeIds`:

- For a Task: expand its parent Feature, then that Feature's parent Plan
- For a Feature: expand its parent Plan
- For a Plan: no expansion needed (top-level)
- For standalone entities (Bug, Decision, Incident, Checkpoint, Knowledge Entry): expand the relevant standalone section header

### 3.2 `navigateToDocument(id: string)`

Opens a specific document in the Document Viewer.

**Algorithm:**

```
navigateToDocument(id):
  1. Look up DocumentRecord in project store
  2. If not found:
       → no-op
       → return
  3. Push current Documents state onto documentHistory (if activeView is already 'documents')
  4. Set viewingDocumentId = id
  5. Set documentViewMode = 'viewer'
  6. If activeView !== 'documents':
       → set activeView = 'documents'
```

### 3.3 `activateFilter(view: 'documents' | 'workflows', field: 'types' | 'statuses', value: string)`

Toggles a filter value in the specified view's filter set.

**Algorithm:**

```
activateFilter(view, field, value):
  1. If activeView !== view:
       → set activeView = view
  2. Read current filter array for view.field
  3. If value is already in the array:
       → remove it (toggle off)
  4. Else:
       → add it (toggle on)
  5. Update the appropriate filter state (documentFilters or workflowFilters)
```

---

## 4. Entity Type Resolution

### 4.1 ID Prefix → Type Mapping

The `EntityLink` component and `navigateToEntity` action both need to determine entity type from an ID string. This is a pure function with no store dependency:

```typescript
function resolveEntityType(id: string): EntityType | null {
  if (id.startsWith('FEAT-'))  return 'feature';
  if (id.startsWith('TASK-'))  return 'task';
  if (id.startsWith('BUG-'))   return 'bug';
  if (id.startsWith('DEC-'))   return 'decision';
  if (id.startsWith('KE-'))    return 'knowledge';
  if (id.startsWith('INC-'))   return 'incident';
  if (id.startsWith('CHK-'))   return 'checkpoint';
  if (id.includes('/'))        return 'document';
  if (/^[A-Za-z]\d+-/.test(id)) return 'plan';
  return null;
}
```

This function is used in two places:

1. **`EntityLink` rendering** — determines the icon, colour treatment, and store map to look up for the tooltip.
2. **`navigateToEntity`** — determines whether to delegate to `navigateToDocument` or navigate within Workflows.

### 4.2 Store Lookup

Given a resolved type, look up the entity in the corresponding `ProjectState` map:

| Type | Store Map | View |
|------|-----------|------|
| `plan` | `plans` | Workflows |
| `feature` | `features` | Workflows |
| `task` | `tasks` | Workflows |
| `bug` | `bugs` | Workflows |
| `decision` | `decisions` | Workflows |
| `knowledge` | `knowledge` | Workflows |
| `incident` | `incidents` | Workflows |
| `checkpoint` | `checkpoints` | Workflows |
| `document` | `documents` | Documents |

Every entity type except `document` navigates to the Workflows view. Documents navigate to the Documents view.

---

## 5. Tree Selection Sync

### 5.1 Expansion Logic

When `navigateToEntity` is called (from any source), the tree must expand to reveal the target. The expansion path depends on entity type and the entity hierarchy:

```
Plan (top-level) → no expansion needed, just select
Feature → expand parent Plan
Task → expand parent Feature → expand grandparent Plan
Bug / Decision / Incident / Checkpoint / Knowledge Entry
  → expand the relevant standalone section header
```

**Implementation:** `EntityTree.tsx` receives `selectedEntityId` from the UI store. A `useEffect` watches for changes to `selectedEntityId` and computes the expansion path:

```typescript
useEffect(() => {
  if (!selectedEntityId) return;

  const type = resolveEntityType(selectedEntityId);
  const pathIds: string[] = [];

  if (type === 'task') {
    const task = tasks.get(selectedEntityId);
    if (task?.parent_feature) {
      pathIds.push(task.parent_feature);
      const feature = features.get(task.parent_feature);
      if (feature?.parent) pathIds.push(feature.parent);
    }
  } else if (type === 'feature') {
    const feature = features.get(selectedEntityId);
    if (feature?.parent) pathIds.push(feature.parent);
  }
  // Standalone types: expand section header node
  // (section headers use synthetic IDs like '__bugs__', '__decisions__', etc.)

  setExpandedNodeIds(prev => {
    const next = new Set(prev);
    pathIds.forEach(id => next.add(id));
    return next;
  });
}, [selectedEntityId]);
```

### 5.2 Scroll-to-Selected

After expansion, the tree must scroll to make the selected node visible. This uses a two-phase approach:

1. **Expand** — update `expandedNodeIds` in state (synchronous).
2. **Scroll** — after the next render (when the expanded nodes are in the DOM), scroll the selected node into view.

```typescript
useEffect(() => {
  if (!selectedEntityId) return;

  // requestAnimationFrame ensures the DOM has updated after expansion
  requestAnimationFrame(() => {
    const node = document.getElementById(`tree-node-${selectedEntityId}`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}, [selectedEntityId, expandedNodeIds]);
```

Each `TreeNode` renders with `id={`tree-node-${entityId}`}` to support this lookup.

### 5.3 Selection Sources

The tree selection can be updated from multiple sources — all converge on the same `selectedEntityId` state:

| Source | Mechanism |
|--------|-----------|
| Click tree node directly | `TreeNode.onClick` → `uiStore.setSelectedEntityId(id)` |
| Click `EntityLink` in a detail panel | `EntityLink.onClick` → `uiStore.navigateToEntity(id)` |
| Click `EntityLink` in Document Viewer metadata | Same as above — triggers view switch + tree sync |
| Click entity reference in rendered Markdown | `EntityLink` embedded by `FieldValue` renderer |

---

## 6. EntityLink Component Wiring

`EntityLink.tsx` was created in F3 with navigation stubbed out. F5 wires the `onClick` handler.

### 6.1 Rendering States

| State | Visual Treatment | Behaviour |
|-------|-----------------|-----------|
| **Resolved** — entity exists in store | Styled link (blue text, `cursor: pointer`), entity title/summary as tooltip | `onClick` → `navigateToEntity(id)` or `navigateToDocument(id)` |
| **Broken** — entity not found in store | Dimmed text (grey, `opacity: 0.5`), "Entity not found" tooltip, no underline | `onClick` → no-op (non-navigable) |
| **Loading** — store not yet populated | Render ID as plain text, no click handler | Will re-render when store hydrates |

### 6.2 onClick Handler

```typescript
const handleClick = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation(); // prevent bubbling to parent clickable elements

  const type = resolveEntityType(id);
  if (!type) return;

  if (type === 'document') {
    uiStore.navigateToDocument(id);
  } else {
    uiStore.navigateToEntity(id);
  }
};
```

`stopPropagation` is critical — `EntityLink` components appear inside tree nodes (which are themselves clickable) and inside detail panel sections. Without it, clicking a reference inside a tree node would both navigate to the referenced entity *and* select the containing node.

---

## 7. Cross-View Interaction Flows

### 7.1 Entity Reference in Documents View → Workflows

**Trigger:** User is in the Documents view, viewing a document. The metadata panel shows "Owner: P1-kbzv" as an `EntityLink`. User clicks it.

**Flow:**

```
1. EntityLink.onClick fires
2. resolveEntityType('P1-kbzv') → 'plan'
3. navigateToEntity('P1-kbzv') called
4. Entity found in plans store → proceed
5. selectedEntityId = 'P1-kbzv'
6. activeView = 'workflows' (view switches)
7. Tree expansion: P1-kbzv is top-level → no expansion needed
8. Tree scrolls to P1-kbzv node
9. Detail panel shows Plan detail for P1-kbzv
```

**User sees:** Instant switch from the Document Viewer to the Workflows view, with the referenced plan selected and visible.

### 7.2 Document Reference in Workflows View → Documents

**Trigger:** User is in the Workflows view, viewing a feature's detail. The "Documents" section lists "Architecture Design" as a clickable link. User clicks it.

**Flow:**

```
1. Document link onClick fires
2. navigateToDocument('work/design/kbzv-architecture.md') called
3. DocumentRecord found in documents store → proceed
4. viewingDocumentId = 'work/design/kbzv-architecture.md'
5. documentViewMode = 'viewer'
6. activeView = 'documents' (view switches)
7. Document Viewer renders with the architecture doc
```

**User sees:** Instant switch from Workflows to the Document Viewer showing the referenced document.

### 7.3 Lozenge Filter Activation (Within View)

**Trigger:** User is in the Workflows view, viewing a task detail. The status lozenge shows "blocked" (orange). User clicks it.

**Flow:**

```
1. StatusBadge.onClick fires
2. activateFilter('workflows', 'statuses', 'blocked') called
3. activeView is already 'workflows' → no switch
4. 'blocked' added to workflowFilters.statuses
5. Filter bar updates to show 'blocked' as active
6. Entity tree filters to show only blocked entities
```

### 7.4 Lozenge Filter Activation (Cross-View)

**Trigger:** User is in the Workflows view, viewing a feature detail. The "Documents" section shows a document with a "design" type badge. User clicks the type badge.

**Flow:**

```
1. Badge.onClick fires
2. activateFilter('documents', 'types', 'design') called
3. activeView switches to 'documents'
4. 'design' added to documentFilters.types
5. Document list filters to show only design documents
```

### 7.5 Superseded Document Chain

**Trigger:** User is viewing a document with status "Superseded". The metadata panel shows "Superseded by: work/design/kbzv-arch-v2.md" as a clickable link.

**Flow:**

```
1. EntityLink.onClick fires (superseded_by is a document path → type = 'document')
2. navigateToDocument('work/design/kbzv-arch-v2.md') called
3. viewingDocumentId updated
4. Document Viewer re-renders with the successor document
5. (Already in Documents view → no view switch)
```

---

## 8. Navigation History

### 8.1 Scope

Navigation history applies **only to the Documents view**, which has a list ↔ viewer sub-state. The Workflows view does not need history — the tree is always visible, and selecting a new entity is not a destructive navigation.

### 8.2 History Stack

The Documents view maintains a bounded history stack:

```typescript
const MAX_HISTORY = 50;

interface DocumentHistoryEntry {
  mode: 'list' | 'viewer';
  documentId: string | null;
  scrollTop: number;
  filters: { types: string[]; statuses: string[] };
}
```

**Push** happens on any forward navigation:
- List → Viewer (clicking a document row)
- Viewer → different Viewer (clicking superseded-by link, or navigating to a document from Workflows)

**Pop** happens on back navigation (back button or ⌘[).

When navigating back, the previous entry's `scrollTop` is restored so the user returns to the same position in the list.

### 8.3 Keyboard Shortcuts

| Shortcut | Action | Scope |
|----------|--------|-------|
| `⌘[` | Navigate back in Documents history | Documents view only |
| `⌘]` | Navigate forward in Documents history | Documents view only |

**Implementation:** A global `useEffect` in `App.tsx` (or the active view's root component) listens for `keydown` events:

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.metaKey && e.key === '[') {
      e.preventDefault();
      if (activeView === 'documents') uiStore.navigateBack();
    }
    if (e.metaKey && e.key === ']') {
      e.preventDefault();
      if (activeView === 'documents') uiStore.navigateForward();
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [activeView]);
```

These shortcuts intentionally match macOS conventions (Safari, Finder) and do not conflict with Tauri's default key bindings.

### 8.4 Back Button Behaviour

The Document Viewer's back button (ChevronLeft icon, rendered by `DocumentViewer.tsx`) calls `uiStore.navigateBack()`. This:

1. Pops the current entry from the history stack.
2. Restores the previous entry's state (`mode`, `documentId`, `scrollTop`, `filters`).
3. If the stack is empty, returns to list mode with default state.

The back button is visible **only** when `documentViewMode === 'viewer'`.

---

## 9. Lozenge Click Handlers

### 9.1 Which Lozenges Are Clickable

Every metadata lozenge rendered by a `Badge` component becomes a filter activator. The clickable lozenges are:

| Lozenge | Found In | Filter Action |
|---------|----------|---------------|
| Entity type (e.g. "feature", "task") | Tree nodes, detail panel headers | `activateFilter('workflows', 'types', value)` |
| Entity status (e.g. "active", "blocked") | Tree nodes, detail panel headers | `activateFilter('workflows', 'statuses', value)` |
| Document type (e.g. "design", "specification") | Document list rows, Document Viewer metadata | `activateFilter('documents', 'types', value)` |
| Document status (e.g. "approved", "draft") | Document list rows, Document Viewer metadata | `activateFilter('documents', 'statuses', value)` |
| Document type badge in Workflows detail | Feature/Plan detail "Documents" section | `activateFilter('documents', 'types', value)` — **cross-view** |

### 9.2 Implementation Pattern

All lozenge click handlers follow a single pattern. The `StatusBadge` and type badge components accept an optional `onFilterClick` prop:

```typescript
interface BadgeProps {
  value: string;
  variant: 'status' | 'type' | 'document-type' | 'document-status';
  onFilterClick?: (field: 'types' | 'statuses', value: string) => void;
}
```

The parent component (detail panel, list row, etc.) passes the appropriate `onFilterClick` bound to the right view:

```typescript
// In FeatureDetail.tsx
<StatusBadge
  value={feature.status}
  variant="status"
  onFilterClick={(field, value) =>
    uiStore.activateFilter('workflows', field, value)
  }
/>

// Document type badge inside a Workflows detail panel
<Badge
  value={doc.type}
  variant="document-type"
  onFilterClick={(field, value) =>
    uiStore.activateFilter('documents', field, value)  // cross-view
  }
/>
```

### 9.3 Visual Affordance

Clickable lozenges must be visually distinguishable from decorative ones:

- `cursor: pointer` on hover
- Subtle hover background darkening (using Tailwind `hover:bg-*` utilities on the existing `Badge` component)
- Active filter state: when a lozenge's value matches an active filter, it renders with a ring/outline indicator (using `ring-2 ring-offset-1` utilities)

---

## 10. Components Modified

F5 is a wiring feature — it modifies existing components rather than creating new ones.

### 10.1 `src/lib/store/ui-store.ts`

**Current state (post-F3/F4):** Minimal — holds `activeView` and possibly basic selection state.

**F5 additions:**

- Full `UIState` interface (§2.1)
- `navigateToEntity(id)` action (§3.1)
- `navigateToDocument(id)` action (§3.2)
- `activateFilter(view, field, value)` action (§3.3)
- `navigateBack()` and `navigateForward()` actions (§8)
- `setSelectedEntityId(id)` — thin wrapper that also triggers tree expansion
- `setDocumentViewMode(mode)` — manages list ↔ viewer transitions
- `saveDocumentListScrollTop(scrollTop)` — captures scroll position before leaving list

### 10.2 `src/components/common/EntityLink.tsx`

**Current state (post-F3):** Renders styled link with tooltip; `onClick` is a no-op stub.

**F5 changes:**

- Wire `onClick` to call `navigateToEntity(id)` or `navigateToDocument(id)` based on resolved type (§6.2)
- Add `e.stopPropagation()` to prevent bubbling (§6.2)
- No visual changes — the rendering states (resolved, broken, loading) are already correct

### 10.3 `src/components/tree/EntityTree.tsx`

**Current state (post-F3):** Renders the full tree; clicking a node sets selection. Expansion is user-driven only.

**F5 changes:**

- Add `useEffect` that watches `selectedEntityId` and computes + applies the expansion path (§5.1)
- Add scroll-to-selected behaviour via `requestAnimationFrame` + `scrollIntoView` (§5.2)
- Ensure each `TreeNode` renders with `id={`tree-node-${entityId}`}` for scroll targeting

### 10.4 `src/components/tree/TreeNode.tsx`

**Current state (post-F3):** Renders a single tree node with status dot, ID, summary.

**F5 changes:**

- Add `id` attribute for scroll targeting: `id={`tree-node-${entity.id}`}`
- No other changes

### 10.5 `src/components/document/DocumentViewer.tsx`

**Current state (post-F4):** Renders Markdown content + metadata panel. Back button returns to list.

**F5 changes:**

- Back button calls `uiStore.navigateBack()` instead of a local state setter
- Accept `viewingDocumentId` from UI store (may already be wired; ensure it reacts to external navigation)
- Handle case where `viewingDocumentId` is set by an external source (cross-view navigation from Workflows)

### 10.6 `src/components/document/MetadataPanel.tsx`

**Current state (post-F4):** Shows document metadata. EntityLinks for Owner and Related Entities are rendered but navigation is stubbed. Superseded-by link is present but non-functional.

**F5 changes:**

- EntityLinks are now functional (wired via EntityLink changes in §10.2)
- Superseded-by link wired: clicking navigates to successor document via `navigateToDocument(supersededById)`
- Type and status lozenges wired with `onFilterClick` handlers (§9.2)

### 10.7 `src/components/document/DocumentList.tsx`

**Current state (post-F4):** Renders document list with filter bar.

**F5 changes:**

- Capture scroll position (`scrollTop`) on departure and store via `uiStore.saveDocumentListScrollTop()`
- Restore scroll position when returning from viewer (read from `uiStore.documentListScrollTop`)
- Type/status lozenges in list rows wired with `onFilterClick` (§9.2)

### 10.8 Entity Detail Components

All detail components (`PlanDetail.tsx`, `FeatureDetail.tsx`, `TaskDetail.tsx`, `BugDetail.tsx`, `DecisionDetail.tsx`, `CheckpointDetail.tsx`):

**Current state (post-F3):** Render full entity details. EntityLinks present but with stubbed navigation. Lozenge clicks activate filters within Workflows view only.

**F5 changes:**

- EntityLinks now functional (automatic via EntityLink wiring)
- Document references in detail panels wired to `navigateToDocument(id)`
- Status/type lozenges wired with `onFilterClick` including cross-view activation (§9.2)
- Document type badges in Features/Plans wire to `activateFilter('documents', 'types', value)` — cross-view

### 10.9 `src/App.tsx`

**F5 changes:**

- Add global keyboard shortcut listener for `⌘[` / `⌘]` (§8.3)
- View switching controlled by `uiStore.activeView`

---

## 11. Edge Cases

### 11.1 Broken References

An entity ID that doesn't resolve to any entity in the store:

- **Rendering:** dimmed text, reduced opacity, "Entity not found" tooltip
- **Click behaviour:** no-op — `onClick` exits early after failed store lookup
- **No error toast or modal** — broken references are a normal condition (entities may have been deleted or may reference future entities)

### 11.2 Circular Supersession

Document A superseded by B, B superseded by A. Each document renders a link to the other. The user can click back and forth — this is fine. The history stack captures each navigation, and `⌘[` unwinds normally. No cycle detection needed.

### 11.3 Deep Tree Expansion

Navigating to a deeply nested task (Plan → Feature → Task) requires expanding two ancestor levels. The expansion logic handles this by walking the entity hierarchy upward and collecting all ancestor IDs before updating `expandedNodeIds` in a single state update. This avoids intermediate renders with partially expanded trees.

### 11.4 Navigation During Loading

If the project store hasn't finished loading when a navigation action fires (e.g. from a restored history entry), the entity lookup will fail and navigation will no-op. Once the store hydrates, EntityLinks re-render from plain text to active links. No queuing of navigation intents is needed — the user can simply click again.

### 11.5 View Switch Preserves State

Switching from Documents to Workflows (or vice versa) does not reset the departed view's state. Returning to Documents shows the same list scroll position, active filters, and viewer state as when the user left. Returning to Workflows shows the same selected entity and tree expansion state.

### 11.6 Rapid Navigation

Multiple rapid `navigateToEntity` calls (e.g. user clicks several links quickly) should each update `selectedEntityId`. Only the final state matters — React's batched rendering ensures no intermediate renders cause flicker. The `scrollIntoView` call uses `requestAnimationFrame` which naturally coalesces to the latest target.

---

## 12. Acceptance Criteria

1. **Entity cross-reference navigation:** Clicking an entity ID rendered as an `EntityLink` in the Document Viewer metadata panel switches to the Workflows view and selects that entity in the tree.

2. **Document cross-reference navigation:** Clicking a document reference in a feature's detail panel (Workflows view) switches to the Documents view and opens the Document Viewer for that document.

3. **Status filter activation:** Clicking a status lozenge in the Workflows detail panel activates that status as a filter in the Workflows filter bar.

4. **Cross-view filter activation:** Clicking a document type badge in a Workflows detail panel switches to the Documents view with that type filter active.

5. **Tree auto-expansion:** When navigating to an entity via cross-reference, the tree auto-expands all ancestor nodes to reveal the target.

6. **Tree auto-scroll:** After expansion, the tree scrolls to keep the selected node visible.

7. **Back/forward navigation:** `⌘[` and `⌘]` navigate back and forward within the Documents view history (list ↔ viewer transitions).

8. **Scroll position preservation:** Returning from the Document Viewer to the document list restores the previous scroll position.

9. **Superseded document links:** Clicking "superseded by" in document metadata navigates to the successor document in the Document Viewer.

10. **Broken references:** Entity IDs that don't resolve to a known entity render as dimmed text with a "not found" tooltip and do not navigate on click.

11. **No confirmation dialogs:** All view switches are immediate — no modals, no "are you sure" prompts.

---

## 13. Out of Scope

- **Search** — deferred to v1.1 (architecture §9.1)
- **Deep linking / URL routing** — not applicable to a desktop app; no URL bar
- **Multi-window navigation** — deferred to v2.0+ (architecture §9.4)
- **Keyboard navigation within the tree** (arrow keys) — could be added later but not part of this feature
- **Undo/redo for filter changes** — filters are toggles; the user can click again to remove

---

## References

- kbzv-architecture.md §7 — Navigation Model (§7.1–§7.5)
- kbzv-architecture.md §6.4 — Documents View (Document Viewer, MetadataPanel)
- kbzv-architecture.md §6.6 — Workflows View (Entity Tree, Detail Panel)
- kbzv-architecture.md §6.7 — Filter Bar
- kbzv-architecture.md §4.3 — In-Memory Store (`ProjectState`)
- kbzv-v1-dev-plan.md — Feature 3 scope (EntityLink stub), Feature 4 scope (MetadataPanel stub), Feature 5 scope