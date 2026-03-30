# F5: Cross-View Navigation — Development Plan

**Feature ID:** FEAT-01KMZA9MWR7WK
**Parent Plan:** P1-kbzv
**Depends on:** FEAT-01KMZA9GFB075 (F3: Workflows View), FEAT-01KMZA9JMZFNF (F4: Documents View)
**Type:** Development Plan
**Status:** Draft

---

## Overview

Feature 5 creates no new files. It wires the Workflows view (F3) and Documents view (F4) into a cohesive navigation system. Every change is a modification to an existing file — adding navigation state to the UI store, connecting stubbed click handlers to real actions, and synchronising the entity tree with programmatic navigation.

The work decomposes into 9 tasks with a clear dependency chain: the store foundation comes first, then parallel wiring of individual components.

### Files Modified

| File | Tasks |
|------|-------|
| `src/lib/store/ui-store.ts` | T1 |
| `src/components/common/EntityLink.tsx` | T2 |
| `src/components/tree/EntityTree.tsx` | T3 |
| `src/components/tree/TreeNode.tsx` | T3 |
| `src/components/common/StatusBadge.tsx` | T4 |
| `src/components/entity/PlanDetail.tsx` | T5 |
| `src/components/entity/FeatureDetail.tsx` | T5 |
| `src/components/entity/TaskDetail.tsx` | T5 |
| `src/components/entity/BugDetail.tsx` | T5 |
| `src/components/entity/DecisionDetail.tsx` | T5 |
| `src/components/entity/CheckpointDetail.tsx` | T5 |
| `src/components/entity/IncidentDetail.tsx` | T5 |
| `src/components/entity/KnowledgeDetail.tsx` | T5 |
| `src/components/document/DocumentViewer.tsx` | T5 |
| `src/components/document/DocumentList.tsx` | T5 |
| `src/components/document/MetadataPanel.tsx` | T6 |
| `src/App.tsx` | T7 |

---

## Task Dependency Graph

```
T1  UI Store Expansion
├──► T2  EntityLink Wiring
├──► T3  Tree Selection Sync
├──► T4  Lozenge Click Handlers
├──► T7  Keyboard Shortcuts
│
T2 ──► T5  Detail Panel + View Wiring
T4 ──► T5
│
T2 ──► T6  Document Metadata Wiring
T4 ──► T6
│
T5 ──┐
T6 ──┤
T3 ──┼──► T8  Edge Case Handling
T7 ──┘
│
T8 ──► T9  Integration Testing
```

**Critical path:** T1 → T2 → T5 → T8 → T9

**Parallelisable after T1:** T2, T3, T4, T7 can all proceed in parallel once the store is complete. T5 and T6 can proceed in parallel once T2 and T4 are done.

---

## Task 1: UI Store Expansion

**Estimated effort:** 5 points

### What to do

Expand `src/lib/store/ui-store.ts` from the minimal F3/F4 state into the full F5 interface. Add all new state fields, types, the `resolveEntityType` pure function, and all five navigation actions: `navigateToEntity`, `navigateToDocument`, `activateFilter`, `navigateBack`, `navigateForward`. Use the simplified cursor-based history model from spec §2.5.

### Implementation

**1. Add types and the `resolveEntityType` function before the store definition:**

```typescript
// src/lib/store/ui-store.ts — new types at top of file

type ViewId = 'documents' | 'workflows';
type DocumentViewMode = 'list' | 'viewer';
type FilterField = 'types' | 'statuses';

interface DocumentHistoryEntry {
  mode: DocumentViewMode;
  documentId: string | null;
  scrollTop: number;
  filters: {
    types: string[];
    statuses: string[];
  };
}

type EntityType =
  | 'plan' | 'feature' | 'task' | 'bug' | 'decision'
  | 'knowledge' | 'incident' | 'checkpoint' | 'document';

export function resolveEntityType(id: string): EntityType | null {
  if (id.startsWith('FEAT-'))    return 'feature';
  if (id.startsWith('TASK-'))    return 'task';
  if (id.startsWith('BUG-'))     return 'bug';
  if (id.startsWith('DEC-'))     return 'decision';
  if (id.startsWith('KE-'))      return 'knowledge';
  if (id.startsWith('INC-'))     return 'incident';
  if (id.startsWith('CHK-'))     return 'checkpoint';
  if (id.includes('/'))          return 'document';
  if (/^[A-Za-z]\d+-/.test(id))  return 'plan';
  return null;
}
```

**2. Extend the `UIState` interface with F5 fields (additive to F3/F4 fields):**

```typescript
interface UIState {
  // --- Existing F3/F4 fields (unchanged) ---
  activeView: ViewId;
  selectedEntityId: string | null;
  selectedEntityType: string | null;
  workflowFilters: { types: Set<string>; statusColours: Set<string> };
  documentViewMode: DocumentViewMode;
  viewingDocumentId: string | null;
  documentListScrollTop: number;
  documentFilters: { types: string[]; statuses: string[] };
  expandedNodeIds: Set<string>;

  // --- Existing F3/F4 actions (unchanged) ---
  setActiveView: (view: ViewId) => void;
  selectEntity: (id: string | null, type: string | null) => void;
  toggleWorkflowType: (type: string) => void;
  toggleWorkflowStatusColour: (colour: string) => void;
  clearWorkflowFilters: () => void;
  activateWorkflowStatusFilter: (status: string) => void;
  setDocumentViewMode: (mode: DocumentViewMode) => void;
  setViewingDocumentId: (id: string | null) => void;
  saveDocumentListScrollTop: (scrollTop: number) => void;
  toggleDocumentType: (type: string) => void;
  toggleDocumentStatus: (status: string) => void;
  clearDocumentFilters: () => void;
  toggleExpandNode: (id: string) => void;

  // --- New F5 fields ---
  documentHistoryStack: DocumentHistoryEntry[];
  documentHistoryCursor: number;

  // --- New F5 actions ---
  expandNodes: (ids: string[]) => void;
  navigateToEntity: (id: string) => void;
  navigateToDocument: (id: string) => void;
  activateFilter: (view: ViewId, field: FilterField, value: string) => void;
  navigateBack: () => void;
  navigateForward: () => void;
}
```

**3. Add initial state for the new fields:**

```typescript
// Inside create<UIState>((set, get) => ({ ... }))

// New F5 initial state
documentHistoryStack: [],
documentHistoryCursor: -1,
```

**4. Implement `expandNodes` action:**

```typescript
expandNodes: (ids: string[]) => {
  set((state) => ({
    expandedNodeIds: new Set([...state.expandedNodeIds, ...ids]),
  }));
},
```

**5. Implement `navigateToEntity` — full logic per spec §2.2:**

```typescript
navigateToEntity: (id: string) => {
  const state = get();
  const projectState = useProjectStore.getState();

  const type = resolveEntityType(id);
  if (!type) return;

  if (type === 'document') {
    get().navigateToDocument(id);
    return;
  }

  const storeMap: Record<string, Map<string, unknown>> = {
    plan:       projectState.plans,
    feature:    projectState.features,
    task:       projectState.tasks,
    bug:        projectState.bugs,
    decision:   projectState.decisions,
    knowledge:  projectState.knowledge,
    incident:   projectState.incidents,
    checkpoint: projectState.checkpoints,
  };

  const entityMap = storeMap[type];
  if (!entityMap || !entityMap.has(id)) return;

  const expansionIds: string[] = [];

  if (type === 'task') {
    const task = projectState.tasks.get(id);
    if (task?.parent_feature) {
      expansionIds.push(task.parent_feature);
      const feature = projectState.features.get(task.parent_feature);
      if (feature?.parent) expansionIds.push(feature.parent);
    }
  } else if (type === 'feature') {
    const feature = projectState.features.get(id);
    if (feature?.parent) expansionIds.push(feature.parent);
  } else if (type === 'bug')        expansionIds.push('__bugs__');
    else if (type === 'decision')    expansionIds.push('__decisions__');
    else if (type === 'incident')    expansionIds.push('__incidents__');
    else if (type === 'checkpoint')  expansionIds.push('__checkpoints__');
    else if (type === 'knowledge')   expansionIds.push('__knowledge__');

  set({
    selectedEntityId: id,
    selectedEntityType: type,
    activeView: 'workflows',
    expandedNodeIds: new Set([...state.expandedNodeIds, ...expansionIds]),
  });
},
```

**6. Implement `navigateToDocument` — per spec §2.3 (cursor model from §2.5):**

```typescript
navigateToDocument: (id: string) => {
  const state = get();
  const projectState = useProjectStore.getState();

  if (!projectState.documents.has(id)) return;

  if (state.activeView === 'documents') {
    const currentEntry: DocumentHistoryEntry = {
      mode: state.documentViewMode,
      documentId: state.viewingDocumentId,
      scrollTop: state.documentListScrollTop,
      filters: {
        types: [...state.documentFilters.types],
        statuses: [...state.documentFilters.statuses],
      },
    };

    const truncated = state.documentHistoryStack.slice(
      0, state.documentHistoryCursor + 1
    );
    truncated.push(currentEntry);

    const MAX_HISTORY = 50;
    const overflow = truncated.length > MAX_HISTORY ? 1 : 0;
    const finalStack = overflow ? truncated.slice(1) : truncated;

    const destinationEntry: DocumentHistoryEntry = {
      mode: 'viewer',
      documentId: id,
      scrollTop: 0,
      filters: {
        types: [...state.documentFilters.types],
        statuses: [...state.documentFilters.statuses],
      },
    };
    finalStack.push(destinationEntry);

    set({
      documentHistoryStack: finalStack,
      documentHistoryCursor: finalStack.length - 1,
      viewingDocumentId: id,
      documentViewMode: 'viewer',
    });
  } else {
    set({
      activeView: 'documents',
      viewingDocumentId: id,
      documentViewMode: 'viewer',
    });
  }
},
```

**7. Implement `activateFilter` — per spec §2.4:**

```typescript
activateFilter: (view: ViewId, field: FilterField, value: string) => {
  const state = get();

  if (view === 'documents') {
    const filterKey = field;
    const currentArray = [...state.documentFilters[filterKey]];
    const index = currentArray.indexOf(value);

    if (index >= 0) {
      currentArray.splice(index, 1);
    } else {
      currentArray.push(value);
    }

    set({
      activeView: 'documents',
      documentFilters: {
        ...state.documentFilters,
        [filterKey]: currentArray,
      },
      ...(state.activeView !== 'documents'
        ? { documentViewMode: 'list' as const }
        : {}),
    });
  } else {
    if (field === 'types') {
      const newTypes = new Set(state.workflowFilters.types);
      if (newTypes.has(value)) newTypes.delete(value);
      else newTypes.add(value);

      set({
        activeView: 'workflows',
        workflowFilters: { ...state.workflowFilters, types: newTypes },
      });
    } else {
      set({ activeView: 'workflows' });
      get().activateWorkflowStatusFilter(value);
    }
  }
},
```

**8. Implement `navigateBack` / `navigateForward` — cursor model per spec §2.5:**

```typescript
navigateBack: () => {
  const state = get();
  if (state.activeView !== 'documents') return;

  if (state.documentHistoryCursor <= 0) {
    if (state.documentViewMode === 'viewer') {
      set({ documentViewMode: 'list', viewingDocumentId: null });
    }
    return;
  }

  const newCursor = state.documentHistoryCursor - 1;
  const entry = state.documentHistoryStack[newCursor];

  set({
    documentHistoryCursor: newCursor,
    documentViewMode: entry.mode,
    viewingDocumentId: entry.documentId,
    documentListScrollTop: entry.scrollTop,
    documentFilters: {
      types: [...entry.filters.types],
      statuses: [...entry.filters.statuses],
    },
  });
},

navigateForward: () => {
  const state = get();
  if (state.activeView !== 'documents') return;
  if (state.documentHistoryCursor >= state.documentHistoryStack.length - 1) return;

  const newCursor = state.documentHistoryCursor + 1;
  const entry = state.documentHistoryStack[newCursor];

  set({
    documentHistoryCursor: newCursor,
    documentViewMode: entry.mode,
    viewingDocumentId: entry.documentId,
    documentListScrollTop: entry.scrollTop,
    documentFilters: {
      types: [...entry.filters.types],
      statuses: [...entry.filters.statuses],
    },
  });
},
```

**9. Export types:**

```typescript
export { resolveEntityType };
export type { EntityType, ViewId, DocumentViewMode, FilterField, DocumentHistoryEntry };
```

### Files touched

| File | Changes |
|------|---------|
| `src/lib/store/ui-store.ts` | Add types (`ViewId`, `DocumentViewMode`, `FilterField`, `DocumentHistoryEntry`, `EntityType`), add `resolveEntityType` function (exported), extend `UIState` interface with `documentHistoryStack`, `documentHistoryCursor`, and 6 action signatures, add initial state for new fields, implement all 6 action bodies |

### Dependencies

None — this is the foundation task. F3 and F4 must be complete (feature-level dependency).

### Verification

1. **Unit test — `resolveEntityType`:** Verify all prefix mappings: `FEAT-` → feature, `TASK-` → task, `BUG-` → bug, `DEC-` → decision, `KE-` → knowledge, `INC-` → incident, `CHK-` → checkpoint, path with `/` → document, `P1-slug` → plan, `garbage` → null. Confirm that `FEAT-01ABC/design-spec` returns `'feature'` (prefix check wins over `/`).
2. **Unit test — `navigateToEntity`:** With a mock project store containing a task nested under a feature under a plan, call `navigateToEntity(taskId)`. Assert `selectedEntityId === taskId`, `activeView === 'workflows'`, and `expandedNodeIds` contains both the feature ID and plan ID.
3. **Unit test — `navigateToEntity` with broken ref:** Call with an ID not in any store map. Assert no state change.
4. **Unit test — `navigateToDocument`:** From workflows view, call `navigateToDocument(docId)`. Assert `activeView === 'documents'`, `viewingDocumentId === docId`, `documentViewMode === 'viewer'`. Confirm no history entry pushed (cross-view).
5. **Unit test — `navigateToDocument` within documents view:** Call twice with different IDs from documents view. Assert history stack has two entries and cursor points to the latest.
6. **Unit test — `navigateBack` / `navigateForward` cycle:** Push 3 document navigations, go back twice, go forward once. Verify cursor position and restored state at each step.
7. **Unit test — `navigateBack` when viewing a document with empty history:** Assert falls back to `documentViewMode: 'list'`, `viewingDocumentId: null`.
8. **Unit test — `activateFilter` toggle on/off:** Activate `'design'` on `documentFilters.types`, verify it's added. Activate again, verify it's removed.
9. **Unit test — `activateFilter` cross-view:** From workflows, activate a documents filter. Assert `activeView` switches to `'documents'` and `documentViewMode` becomes `'list'`.
10. **Unit test — History stack bounded at 50:** Push 55 document navigations. Assert `documentHistoryStack.length <= 51` (50 history + 1 current).

---

## Task 2: EntityLink Wiring

**Estimated effort:** 3 points

### What to do

Replace the stubbed `onClick` handler in `EntityLink.tsx` with real navigation dispatch. Remove the F3-era direct calls to `TreeContext.select()` and `TreeContext.expandTo()`. The component now delegates all navigation to the UI store.

### Implementation

Replace the existing click handler and store dependencies:

```typescript
// src/components/common/EntityLink.tsx

import { resolveEntityType } from '@/lib/store/ui-store';
import { useUIStore } from '@/lib/store/ui-store';
import { useProjectStore } from '@/lib/store/project-store';

interface EntityLinkProps {
  entityId: string;
  className?: string;
}

export function EntityLink({ entityId, className }: EntityLinkProps) {
  const navigateToEntity = useUIStore((s) => s.navigateToEntity);
  const navigateToDocument = useUIStore((s) => s.navigateToDocument);

  const type = resolveEntityType(entityId);

  const entity = useProjectStore((s) => {
    if (!type) return null;
    const storeMap: Record<string, Map<string, unknown> | undefined> = {
      plan:       s.plans,
      feature:    s.features,
      task:       s.tasks,
      bug:        s.bugs,
      decision:   s.decisions,
      knowledge:  s.knowledge,
      incident:   s.incidents,
      checkpoint: s.checkpoints,
      document:   s.documents,
    };
    return storeMap[type]?.get(entityId) ?? null;
  });

  const isLoading = useProjectStore(
    (s) => s.projectPath !== null && s.plans.size === 0
  );
  const isResolved = entity !== null;
  const isBroken = !isLoading && !isResolved;

  const tooltip = isResolved
    ? (entity as { title?: string; summary?: string }).title
      ?? (entity as { summary?: string }).summary
      ?? entityId
    : isBroken
      ? 'Entity not found'
      : 'Loading…';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isResolved || !type) return;

    if (type === 'document') {
      navigateToDocument(entityId);
    } else {
      navigateToEntity(entityId);
    }
  };

  if (isLoading) {
    return (
      <span className={cn('font-mono text-sm text-muted-foreground', className)}>
        {entityId}
      </span>
    );
  }

  if (isBroken) {
    return (
      <span
        className={cn(
          'font-mono text-sm text-muted-foreground/50 line-through cursor-default',
          className,
        )}
        title={tooltip}
      >
        {entityId}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'font-mono text-sm text-primary underline-offset-4 hover:underline cursor-pointer',
        'bg-transparent border-none p-0 m-0 inline text-left',
        className,
      )}
      onClick={handleClick}
      title={tooltip}
    >
      {entityId}
    </button>
  );
}
```

**Key changes from F3 stub:**
- Remove `TreeContext` dependency entirely — no more `useContext(TreeContext)`.
- Add `useUIStore` selectors for `navigateToEntity` and `navigateToDocument`.
- Add `useProjectStore` selector for entity lookup (may already exist from F3 for tooltip; verify and reuse).
- Wire `handleClick` to call the appropriate store action based on `resolveEntityType`.
- Ensure `e.stopPropagation()` is present (prevents click bubbling to parent tree nodes or detail panel sections).

### Files touched

| File | Changes |
|------|---------|
| `src/components/common/EntityLink.tsx` | Remove `TreeContext` import and usage, add `useUIStore` import and selectors, replace click handler body, add entity lookup for rendering states (loading/resolved/broken) |

### Dependencies

- **T1** — requires `resolveEntityType`, `navigateToEntity`, `navigateToDocument` from ui-store.

### Verification

1. **Resolved entity click:** Render `<EntityLink entityId="FEAT-01ABC" />` with the feature in the project store. Click it. Assert `navigateToEntity` was called with `"FEAT-01ABC"`.
2. **Document entity click:** Render `<EntityLink entityId="work/design/arch.md" />` with the document in the project store. Click it. Assert `navigateToDocument` was called.
3. **Broken ref click:** Render with an ID not in the store (store hydrated). Click. Assert no navigation call, no error.
4. **Loading state:** Render with `projectPath` set but `plans.size === 0`. Assert renders as plain text span, no button element.
5. **`stopPropagation`:** Render inside a `<div onClick={parentHandler}>`. Click the EntityLink. Assert `parentHandler` was **not** called.
6. **Tooltip:** Hover over a resolved EntityLink. Assert tooltip shows entity title or summary.

---

## Task 3: Tree Selection Sync

**Estimated effort:** 3 points

### What to do

Add two `useEffect` hooks to `EntityTree.tsx`: one that auto-expands ancestor nodes when `selectedEntityId` changes, and one that scrolls the selected node into view after expansion. Add a DOM `id` attribute to every `TreeNode` for scroll targeting. Migrate `TreeContext` to be a thin pass-through to the UI store.

### Implementation

**1. Add `id` attribute to `TreeNode.tsx` (one-line change):**

```typescript
// src/components/tree/TreeNode.tsx — add id to the root div:
<div
  id={`tree-node-${node.id}`}   // ← NEW
  className={cn('flex items-center gap-2 px-2 py-1 ...', isSelected && 'bg-accent')}
  onClick={() => onSelect(node.id, node.type)}
>
```

Also add IDs to standalone section headers (bugs, decisions, etc.):

```typescript
// In StandaloneSection or equivalent renderer:
<div id="tree-node-__bugs__" ...>
```

**2. Add auto-expansion `useEffect` to `EntityTree.tsx` (spec §4.1):**

```typescript
import { resolveEntityType } from '@/lib/store/ui-store';

const selectedEntityId = useUIStore((s) => s.selectedEntityId);
const expandNodes = useUIStore((s) => s.expandNodes);
const expandedNodeIds = useUIStore((s) => s.expandedNodeIds);
const features = useProjectStore((s) => s.features);
const tasks = useProjectStore((s) => s.tasks);

const SECTION_HEADERS: Record<string, string> = {
  bug:        '__bugs__',
  decision:   '__decisions__',
  incident:   '__incidents__',
  checkpoint: '__checkpoints__',
  knowledge:  '__knowledge__',
};

useEffect(() => {
  if (!selectedEntityId) return;

  const type = resolveEntityType(selectedEntityId);
  if (!type) return;

  const pathIds: string[] = [];

  switch (type) {
    case 'task': {
      const task = tasks.get(selectedEntityId);
      if (task?.parent_feature) {
        pathIds.push(task.parent_feature);
        const feature = features.get(task.parent_feature);
        if (feature?.parent) pathIds.push(feature.parent);
      }
      break;
    }
    case 'feature': {
      const feature = features.get(selectedEntityId);
      if (feature?.parent) pathIds.push(feature.parent);
      break;
    }
    case 'plan':
      break;
    case 'bug':
    case 'decision':
    case 'incident':
    case 'checkpoint':
    case 'knowledge': {
      const sectionId = SECTION_HEADERS[type];
      if (sectionId) pathIds.push(sectionId);
      break;
    }
    default:
      break;
  }

  if (pathIds.length > 0) {
    const needsExpansion = pathIds.some((id) => !expandedNodeIds.has(id));
    if (needsExpansion) {
      expandNodes(pathIds);
    }
  }
}, [selectedEntityId, tasks, features, expandNodes, expandedNodeIds]);
```

**3. Add scroll-to-selected `useEffect` (spec §4.2):**

```typescript
useEffect(() => {
  if (!selectedEntityId) return;

  requestAnimationFrame(() => {
    const node = document.getElementById(`tree-node-${selectedEntityId}`);
    if (!node) return;

    node.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  });
}, [selectedEntityId, expandedNodeIds]);
```

**4. Migrate `TreeContext` to pass-through (spec §4.3):**

Replace local state in the `TreeContext` provider with UI store reads:

```typescript
// TreeContext provider — replace useState with store selectors
const expandedNodeIds = useUIStore((s) => s.expandedNodeIds);
const selectedEntityId = useUIStore((s) => s.selectedEntityId);
const toggleExpandNode = useUIStore((s) => s.toggleExpandNode);
const selectEntity = useUIStore((s) => s.selectEntity);

const contextValue: TreeContextValue = {
  expandedNodes: expandedNodeIds,
  selectedEntity: selectedEntityId,
  selectedType: useUIStore((s) => s.selectedEntityType),
  toggleExpand: toggleExpandNode,
  expandTo: (id: string) => {
    useUIStore.getState().navigateToEntity(id);
  },
  select: (id: string, type: string) => {
    selectEntity(id, type);
  },
};
```

### Files touched

| File | Changes |
|------|---------|
| `src/components/tree/TreeNode.tsx` | Add `id={`tree-node-${node.id}`}` to root div |
| `src/components/tree/EntityTree.tsx` | Add two `useEffect` hooks (auto-expansion ~30 lines, scroll-to-selected ~10 lines), import `resolveEntityType`, import `useUIStore` selectors |
| `src/components/tree/TreeContext.tsx` (or equivalent) | Replace local `useState` for expansion/selection with `useUIStore` reads. `TreeContext` becomes a thin pass-through |

### Dependencies

- **T1** — requires `expandNodes`, `selectedEntityId`, `expandedNodeIds`, `navigateToEntity`, `resolveEntityType` from ui-store.

### Verification

1. **Deep expansion:** Collapse all tree nodes. Set `selectedEntityId` to a task nested under a feature under a plan. Assert both the plan and feature nodes are expanded (present in `expandedNodeIds`). Assert the task node is visible in the DOM.
2. **Additive expansion:** Manually expand some nodes. Navigate to a different entity. Assert previously expanded nodes remain expanded — expansion is additive, never collapsing.
3. **Scroll into view:** With a long entity list, navigate to an entity below the fold. Assert `scrollIntoView` is called with `{ behavior: 'smooth', block: 'nearest' }`.
4. **Already visible:** Navigate to an entity that is already visible in the viewport. Assert no scroll jump (`block: 'nearest'` ensures this).
5. **Standalone section expansion:** Navigate to a bug entity. Assert `expandedNodeIds` contains `'__bugs__'`.
6. **Plan selection (no expansion needed):** Navigate to a top-level plan. Assert `expandedNodeIds` is not modified (no ancestors to expand).
7. **TreeContext pass-through:** Click a tree node directly. Assert `selectEntity` is called on the UI store. Assert `expandTo` delegates to `navigateToEntity`.

---

## Task 4: Lozenge Click Handlers

**Estimated effort:** 2 points

### What to do

Add an optional `onFilterClick` prop to `StatusBadge` and create/update a `TypeBadge` component (or inline pattern). When `onFilterClick` is provided, the badge becomes clickable with visual affordance (`cursor-pointer`, `hover:brightness-90`). Add an `isFilterActive` prop for ring indicator on active filters. Call `e.stopPropagation()` to prevent parent element clicks.

### Implementation

**1. Update `StatusBadge.tsx`:**

```typescript
// src/components/common/StatusBadge.tsx

interface StatusBadgeProps {
  status: string;
  className?: string;
  onFilterClick?: (field: 'statuses', value: string) => void;
  isFilterActive?: boolean;
}

export function StatusBadge({
  status,
  className,
  onFilterClick,
  isFilterActive,
}: StatusBadgeProps) {
  const colour = getStatusColour(status);
  const styles = STATUS_STYLES[colour];

  const handleClick = onFilterClick
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onFilterClick('statuses', status);
      }
    : undefined;

  return (
    <Badge
      className={cn(
        styles,
        onFilterClick && 'cursor-pointer hover:brightness-90 transition-colors',
        isFilterActive && 'ring-2 ring-offset-1 ring-primary',
        className,
      )}
      onClick={handleClick}
    >
      {status}
    </Badge>
  );
}
```

**2. Create or update a `TypeBadge` component (inline or shared):**

```typescript
interface TypeBadgeProps {
  value: string;
  variant: 'entity-type' | 'document-type';
  className?: string;
  onFilterClick?: (field: 'types', value: string) => void;
  isFilterActive?: boolean;
}

function TypeBadge({
  value,
  variant,
  className,
  onFilterClick,
  isFilterActive,
}: TypeBadgeProps) {
  const styles = variant === 'document-type'
    ? DOCUMENT_TYPE_STYLES[value] ?? DOCUMENT_TYPE_STYLES.default
    : ENTITY_TYPE_STYLES[value] ?? ENTITY_TYPE_STYLES.default;

  const handleClick = onFilterClick
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onFilterClick('types', value);
      }
    : undefined;

  return (
    <Badge
      className={cn(
        styles,
        onFilterClick && 'cursor-pointer hover:brightness-90 transition-colors',
        isFilterActive && 'ring-2 ring-offset-1 ring-primary',
        className,
      )}
      onClick={handleClick}
    >
      {value}
    </Badge>
  );
}
```

### Files touched

| File | Changes |
|------|---------|
| `src/components/common/StatusBadge.tsx` | Add `onFilterClick` and `isFilterActive` optional props, add `handleClick` with `e.stopPropagation()`, add conditional `cursor-pointer hover:brightness-90 transition-colors` classes, add conditional `ring-2 ring-offset-1 ring-primary` for active state |
| `src/components/common/TypeBadge.tsx` (new utility, or inline in existing Badge) | Same pattern as StatusBadge but for type values. **Note:** if this is the only new file in F5, it can alternatively be inlined as a pattern in each parent component — the spec says "no new files" so prefer inlining or adding to an existing badge utility file |

### Dependencies

- **T1** — requires `activateFilter` signature to exist (for typing the callback prop correctly). The actual binding of `activateFilter` happens in T5/T6, not here.

### Verification

1. **Clickable when `onFilterClick` provided:** Render `<StatusBadge status="active" onFilterClick={handler} />`. Click it. Assert `handler` called with `('statuses', 'active')`.
2. **Not clickable when `onFilterClick` absent:** Render `<StatusBadge status="active" />`. Assert no `cursor-pointer` class. Assert no `onClick` handler on the DOM element.
3. **`stopPropagation`:** Render inside a clickable parent. Click the badge. Assert parent handler not called.
4. **Active ring indicator:** Render with `isFilterActive={true}`. Assert `ring-2 ring-offset-1 ring-primary` classes are present.
5. **No ring when inactive:** Render with `isFilterActive={false}`. Assert ring classes absent.
6. **TypeBadge variants:** Render with `variant="document-type"` and `variant="entity-type"`. Assert correct style maps used.

---

## Task 5: Detail Panel + View Component Wiring

**Estimated effort:** 5 points

### What to do

Wire `onFilterClick` callbacks into all entity detail components (PlanDetail, FeatureDetail, TaskDetail, BugDetail, DecisionDetail, CheckpointDetail, IncidentDetail, KnowledgeDetail). Wire document reference clicks in PlanDetail and FeatureDetail to `navigateToDocument`. Update `DocumentViewer.tsx` to read from the UI store instead of props. Update `DocumentList.tsx` for scroll position save/restore and store-driven navigation.

This is the largest task by file count but each change is small and repetitive.

### Implementation

**1. Detail panels — StatusBadge wiring (all 8 detail components):**

Each detail component that renders a `StatusBadge` adds the filter callback:

```typescript
// In every detail component (e.g., FeatureDetail.tsx):
const activateFilter = useUIStore((s) => s.activateFilter);

<StatusBadge
  status={entity.status}
  onFilterClick={(field, value) => activateFilter('workflows', field, value)}
/>
```

**2. PlanDetail + FeatureDetail — document reference clicks:**

```typescript
// In FeatureDetail.tsx:
const navigateToDocument = useUIStore((s) => s.navigateToDocument);

// Design document link
{feature.design && (
  <button
    type="button"
    className="text-sm text-primary hover:underline cursor-pointer"
    onClick={() => navigateToDocument(feature.design!)}
  >
    {designDocTitle}
  </button>
)}

// Repeat for feature.spec and feature.dev_plan
```

**3. PlanDetail + FeatureDetail — cross-view document type badges:**

```typescript
// In FeatureDetail.tsx, next to document references:
<TypeBadge
  value={docRecord.type}
  variant="document-type"
  onFilterClick={(field, value) => activateFilter('documents', field, value)}
/>
```

**4. DocumentViewer.tsx — remove props, read from store:**

```typescript
// Before (F4):
function DocumentViewer({ documentId, onBack }: Props) { ... }

// After (F5):
function DocumentViewer() {
  const viewingDocumentId = useUIStore((s) => s.viewingDocumentId);
  const navigateBack = useUIStore((s) => s.navigateBack);

  if (!viewingDocumentId) return null;

  // Back button:
  <Button variant="ghost" onClick={navigateBack}>
    <ChevronLeft className="h-4 w-4" />
    Back
  </Button>

  // Replace all uses of `documentId` prop with `viewingDocumentId`
}
```

**5. DocumentList.tsx — scroll save/restore, store-driven navigation:**

```typescript
const scrollRef = useRef<HTMLDivElement>(null);
const documentListScrollTop = useUIStore((s) => s.documentListScrollTop);
const saveDocumentListScrollTop = useUIStore((s) => s.saveDocumentListScrollTop);
const navigateToDocument = useUIStore((s) => s.navigateToDocument);
const activateFilter = useUIStore((s) => s.activateFilter);

// Restore scroll on mount
useEffect(() => {
  if (scrollRef.current && documentListScrollTop > 0) {
    scrollRef.current.scrollTop = documentListScrollTop;
  }
}, []);

// Save scroll before navigating
const handleRowClick = (documentId: string) => {
  if (scrollRef.current) {
    saveDocumentListScrollTop(scrollRef.current.scrollTop);
  }
  navigateToDocument(documentId);
};

// Replace local filter state reads with store reads
const documentFilters = useUIStore((s) => s.documentFilters);
```

**6. App.tsx — documents view container:**

```typescript
// Before (F4):
function DocumentsView() {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  if (selectedDocId) {
    return <DocumentViewer documentId={selectedDocId} onBack={() => setSelectedDocId(null)} />;
  }
  return <DocumentList onSelect={(id) => setSelectedDocId(id)} />;
}

// After (F5):
function DocumentsView() {
  const documentViewMode = useUIStore((s) => s.documentViewMode);

  if (documentViewMode === 'viewer') {
    return <DocumentViewer />;
  }
  return <DocumentList />;
}
```

### Files touched

| File | Changes |
|------|---------|
| `src/components/entity/PlanDetail.tsx` | Add `useUIStore` import, wire `StatusBadge.onFilterClick`, wire document reference clicks to `navigateToDocument`, add cross-view `TypeBadge` for document type |
| `src/components/entity/FeatureDetail.tsx` | Same as PlanDetail, plus wiring for `design`, `spec`, and `dev_plan` document links |
| `src/components/entity/TaskDetail.tsx` | Wire `StatusBadge.onFilterClick` |
| `src/components/entity/BugDetail.tsx` | Wire `StatusBadge.onFilterClick` |
| `src/components/entity/DecisionDetail.tsx` | Wire `StatusBadge.onFilterClick` |
| `src/components/entity/CheckpointDetail.tsx` | Wire `StatusBadge.onFilterClick` |
| `src/components/entity/IncidentDetail.tsx` | Wire `StatusBadge.onFilterClick` |
| `src/components/entity/KnowledgeDetail.tsx` | Wire `StatusBadge.onFilterClick` |
| `src/components/document/DocumentViewer.tsx` | Remove `documentId` and `onBack` props, read `viewingDocumentId` and `navigateBack` from UI store |
| `src/components/document/DocumentList.tsx` | Add `scrollRef`, scroll save/restore logic, replace local `setSelectedDocId` with `navigateToDocument`, replace local filter state with `useUIStore` reads, wire row lozenge clicks to `activateFilter` |
| `src/App.tsx` | Replace local `useState` in DocumentsView with `useUIStore.documentViewMode` read, remove props passed to `DocumentViewer` and `DocumentList` |

### Dependencies

- **T1** — all store actions and state fields.
- **T2** — EntityLink wiring must be done so that `<EntityLink>` components rendered by detail panels are functional.
- **T4** — StatusBadge/TypeBadge `onFilterClick` prop must exist.

### Verification

1. **StatusBadge filter activation in Workflows:** In TaskDetail, click the status lozenge. Assert `activateFilter('workflows', 'statuses', statusValue)` is called.
2. **Document reference click in FeatureDetail:** Click a design document link. Assert `navigateToDocument` called with the document path. Assert view switches to Documents and viewer shows the document.
3. **Cross-view type badge:** In FeatureDetail, click a document type badge. Assert `activateFilter('documents', 'types', docType)` called. Assert view switches to Documents with filter active.
4. **DocumentViewer store-driven:** Set `viewingDocumentId` in the store to a valid document. Assert DocumentViewer renders the document. Click Back button. Assert `navigateBack` called.
5. **DocumentViewer cross-view entry:** From Workflows view, call `navigateToDocument(id)`. Assert Documents view renders with DocumentViewer showing the correct document.
6. **DocumentList scroll save/restore:** Scroll down in the list, click a row. Assert `saveDocumentListScrollTop` called with the current scroll value. Navigate back. Assert the list remounts with `scrollTop` restored.
7. **DocumentList row navigation:** Click a document row. Assert `navigateToDocument` called (not local state setter). Assert history entry pushed.
8. **App.tsx view container:** Assert `DocumentsView` renders `<DocumentList />` when `documentViewMode === 'list'` and `<DocumentViewer />` when `documentViewMode === 'viewer'`. Assert no local state.

---

## Task 6: Document Metadata Wiring

**Estimated effort:** 2 points

### What to do

Wire the `MetadataPanel.tsx` in the Documents view so that entity references (Owner, related entities) navigate via `EntityLink` (already functional from T2), superseded-by links navigate to successor documents, and type/status lozenges activate document filters.

### Implementation

**1. Superseded-by link wiring:**

The superseded-by field may already render as an `EntityLink` — if so, no change needed (T2 handles it). If it's a separate element, wire it:

```typescript
// In MetadataPanel.tsx
const navigateToDocument = useUIStore((s) => s.navigateToDocument);

// Superseded-by section
{record.superseded_by && (
  <button
    type="button"
    className="text-sm text-primary hover:underline cursor-pointer"
    onClick={() => navigateToDocument(record.superseded_by!)}
  >
    {record.superseded_by}
  </button>
)}
```

**2. Type and status lozenge wiring:**

```typescript
const activateFilter = useUIStore((s) => s.activateFilter);

// Document type badge
<TypeBadge
  value={record.type}
  variant="document-type"
  onFilterClick={(field, value) => activateFilter('documents', field, value)}
/>

// Document status badge
<StatusBadge
  status={record.status}
  onFilterClick={(field, value) => activateFilter('documents', field, value)}
/>
```

**3. Owner EntityLink — already functional:**

`<EntityLink entityId={record.owner} />` requires no change — T2 made it navigate automatically.

### Files touched

| File | Changes |
|------|---------|
| `src/components/document/MetadataPanel.tsx` | Add `useUIStore` import, wire `navigateToDocument` for superseded-by link, pass `onFilterClick` to type and status lozenges, pass `activateFilter('documents', ...)` callbacks |

### Dependencies

- **T2** — EntityLink wiring (for owner/entity reference navigation).
- **T4** — Lozenge `onFilterClick` prop.

### Verification

1. **Owner EntityLink navigation:** In MetadataPanel, click the Owner EntityLink. Assert navigation switches to Workflows view and selects the owner entity.
2. **Superseded-by navigation:** View a superseded document. Click the superseded-by link. Assert `navigateToDocument` called with the successor document ID. Assert viewer shows the successor.
3. **Circular supersession:** Document A → B → A. Click superseded-by on A, verify B opens. Click superseded-by on B, verify A opens. Press ⌘[ twice, verify you're back at A's first viewing.
4. **Type lozenge filter:** Click the document type badge in MetadataPanel. Assert `activateFilter('documents', 'types', type)` called. Assert document list filters to that type.
5. **Status lozenge filter:** Click the status badge. Assert `activateFilter('documents', 'statuses', status)` called.

---

## Task 7: Keyboard Shortcuts

**Estimated effort:** 1 point

### What to do

Register a global `keydown` event listener in `App.tsx` that handles `⌘[` (back) and `⌘]` (forward) for Documents view history navigation. The listener calls `navigateBack()` / `navigateForward()` which internally no-op when not in Documents view.

### Implementation

```typescript
// src/App.tsx — add inside the App component:

const navigateBack = useUIStore((s) => s.navigateBack);
const navigateForward = useUIStore((s) => s.navigateForward);

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (!e.metaKey) return;
    if (e.shiftKey || e.ctrlKey || e.altKey) return;

    if (e.key === '[') {
      e.preventDefault();
      e.stopPropagation();
      navigateBack();
      return;
    }

    if (e.key === ']') {
      e.preventDefault();
      e.stopPropagation();
      navigateForward();
      return;
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [navigateBack, navigateForward]);
```

### Files touched

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `useUIStore` selectors for `navigateBack` and `navigateForward`, add `useEffect` with `keydown` event listener (~20 lines) |

### Dependencies

- **T1** — requires `navigateBack` and `navigateForward` actions.

### Verification

1. **⌘[ in Documents view:** Navigate to a document, press `⌘[`. Assert `navigateBack` called. Assert returns to document list.
2. **⌘] after ⌘[:** Press `⌘]` after going back. Assert `navigateForward` called. Assert returns to the document.
3. **⌘[ in Workflows view:** Press `⌘[` while in Workflows. Assert `navigateBack` is called but no-ops (action checks `activeView`). Assert no state change.
4. **Modifier guard:** Press `⌘⇧[`. Assert handler does not fire (guarded by `e.shiftKey` check).
5. **`preventDefault`:** Press `⌘[`. Assert browser/webview default behaviour is suppressed.
6. **Cleanup on unmount:** Unmount the App component. Assert `removeEventListener` is called.

---

## Task 8: Edge Case Handling

**Estimated effort:** 3 points

### What to do

Audit and harden all navigation paths against edge cases documented in the spec §8. Most edge cases are handled by the defensive patterns already built into T1–T7 (early returns on missing entities, additive expansion, `requestAnimationFrame` scroll coalescing). This task is an explicit review and hardening pass to close any gaps.

### Implementation

**8.1 Broken references (spec §8.1):**
- Verify `EntityLink` renders broken state correctly: `text-muted-foreground/50 line-through cursor-default`, tooltip "Entity not found", click is no-op.
- Verify `navigateToEntity` returns early when entity not found in store.
- **No error toasts, no modals, no console warnings.** Broken references are a normal condition.

**8.2 Circular supersession (spec §8.2):**
- Verify clicking superseded-by link A→B→A→B… pushes history entries each time.
- Verify history stack is bounded at `MAX_HISTORY = 50`.
- Verify `⌘[` unwinds the stack correctly.
- No cycle detection needed — the bounded history stack prevents unbounded growth.

**8.3 Deep tree expansion (spec §8.3):**
- Verify that `navigateToEntity(taskId)` where task is 3 levels deep (Plan → Feature → Task) expands both ancestors in a **single** `set()` call. No intermediate renders.
- This is already handled by T1's `navigateToEntity` implementation which collects all `expansionIds` before calling `set()`.

**8.4 Navigation during loading (spec §8.4):**
- Verify `navigateToEntity` no-ops when the entity is not yet in the store (store hydrating).
- Verify `EntityLink` detects loading state (`projectPath !== null && plans.size === 0`) and renders as inert plain text.
- Once store hydrates, React re-renders EntityLinks to active state. **No queuing of navigation intents.**

**8.5 View switch preserves state (spec §8.5):**
- Verify switching from Documents to Workflows does **not** reset `documentViewMode`, `viewingDocumentId`, `documentListScrollTop`, or `documentFilters`.
- Verify switching back to Documents shows the same state.
- This is automatic — Zustand state persists independently of mounted components.

**8.6 Rapid navigation (spec §8.6):**
- Verify rapid `navigateToEntity` calls update `selectedEntityId` correctly.
- React batches state updates within the same event loop tick — only the final value renders.
- `requestAnimationFrame` for scroll coalesces to the latest frame.
- **No flicker, no intermediate renders, no race conditions.**

**8.7 Orphaned entities — broken parent chain (spec §8.7):**
- Verify `navigateToEntity` succeeds for an entity whose `parent_feature` doesn't exist.
- The expansion algorithm simply skips the missing parent — `pathIds` only contains successfully looked-up IDs.
- The detail panel updates correctly. The tree may not show the node (acceptable for orphaned entities).

**8.8 Document file missing on disk (spec §8.8):**
- Verify `navigateToDocument` succeeds (sets `viewingDocumentId`).
- `DocumentViewer` attempts to read the file, gets file-not-found, shows F4's error message.
- MetadataPanel still renders all DocumentRecord fields.
- Back navigation works normally.

**Hardening changes (if not already present from T1–T7):**

- In `navigateToEntity`: add explicit `if (!type) return;` guard (should already be present).
- In `navigateToDocument`: add explicit `if (!projectState.documents.has(id)) return;` guard.
- In the expansion `useEffect`: add null checks on `tasks.get()` and `features.get()` results before reading `.parent_feature` or `.parent`.
- In `navigateBack`/`navigateForward`: add bounds checking on cursor before array access.
- Add defensive array spread (`[...entry.filters.types]`) when restoring history entries to prevent shared references.

### Files touched

| File | Changes |
|------|---------|
| `src/lib/store/ui-store.ts` | Audit all guards and early returns; add any missing null checks |
| `src/components/common/EntityLink.tsx` | Verify broken/loading rendering states |
| `src/components/tree/EntityTree.tsx` | Verify null checks in expansion algorithm |
| `src/components/document/DocumentViewer.tsx` | Verify graceful handling of missing file |

### Dependencies

- **T1–T7** — all prior tasks must be complete for a meaningful edge case audit.

### Verification

Each edge case maps to a scenario in the spec. The verification matrix:

| Edge Case | Scenario | Expected Result |
|-----------|----------|-----------------|
| Broken ref | Render `<EntityLink entityId="FEAT-DELETED" />` with store hydrated | Dimmed, struck-through, tooltip "Entity not found", click no-op |
| Circular supersession | Navigate A→B→A→B 5 times, then ⌘[ 5 times | History unwinds correctly, no errors |
| Deep expansion | Navigate to task 3 levels deep from documents view | Tree shows task, both ancestors expanded, single render |
| Nav during loading | Click EntityLink before store finishes hydrating | No-op. After hydration, link becomes active |
| State preservation | Apply doc filters, switch to workflows, switch back | Doc filters still active |
| Rapid clicks | Click 10 EntityLinks in < 1 second | Final entity selected, no flicker |
| Orphaned entity | Navigate to task with missing parent_feature | Detail panel shows task, tree may not reveal it |
| Missing file | Navigate to document whose .md file doesn't exist | Viewer shows "file not found", metadata panel renders, back works |

---

## Task 9: Integration Testing

**Estimated effort:** 3 points

### What to do

Write end-to-end integration tests covering the major cross-view navigation flows. These tests use a mock project store populated with representative entities and documents, then simulate user interactions and assert the resulting UI state.

### Implementation

**Test fixture setup:**

```typescript
// test/fixtures/navigation-test-data.ts
// A mock project with:
// - Plan P1-test with 2 features
// - Feature FEAT-001 with design doc and 2 tasks
// - Feature FEAT-002 with spec doc
// - Task TASK-001 under FEAT-001
// - Task TASK-002 under FEAT-001
// - Bug BUG-001
// - Decision DEC-001
// - Document work/design/arch.md (owner: P1-test)
// - Document work/design/arch-v2.md (supersedes arch.md)
// - Document work/spec/f1-spec.md (owner: FEAT-001)
// - A broken reference: FEAT-DELETED (not in store)
```

**Integration test flows:**

1. **Flow: Entity cross-reference (Documents → Workflows)**
   - Start in Documents view, viewing `work/design/arch.md`.
   - MetadataPanel shows Owner: `P1-test` as EntityLink.
   - Simulate click on the EntityLink.
   - Assert: `activeView === 'workflows'`, `selectedEntityId === 'P1-test'`, tree shows P1-test selected.

2. **Flow: Document cross-reference (Workflows → Documents)**
   - Start in Workflows view, FeatureDetail for FEAT-001.
   - Simulate click on the design document link.
   - Assert: `activeView === 'documents'`, `documentViewMode === 'viewer'`, `viewingDocumentId === 'work/design/arch.md'`.

3. **Flow: Same-view filter activation**
   - In Workflows view, TaskDetail for TASK-001 (status: "active").
   - Click the status lozenge.
   - Assert: `workflowFilters` contains the status value.

4. **Flow: Cross-view filter activation**
   - In Workflows view, FeatureDetail showing document type badge "design".
   - Click the badge.
   - Assert: `activeView === 'documents'`, `documentFilters.types` contains `'design'`, `documentViewMode === 'list'`.

5. **Flow: Back/forward navigation cycle**
   - In Documents list view, click document A → viewer for A.
   - Click superseded-by link → viewer for B.
   - Press ⌘[ → back to viewer for A.
   - Press ⌘[ → back to list.
   - Press ⌘] → forward to viewer for A.
   - Assert cursor position and state at each step.

6. **Flow: Deep tree auto-expansion**
   - Collapse all tree nodes.
   - Navigate to TASK-001 (under FEAT-001 under P1-test) via EntityLink.
   - Assert: `expandedNodeIds` contains both `FEAT-001` and `P1-test`.
   - Assert: DOM element `#tree-node-TASK-001` exists and is visible.

7. **Flow: Broken reference resilience**
   - Render `<EntityLink entityId="FEAT-DELETED" />`.
   - Assert: rendered as `<span>` with `line-through` class.
   - Simulate click. Assert: no state change, no error thrown.

8. **Flow: Scroll position preservation**
   - Populate DocumentList with 100 documents.
   - Scroll to position 500px.
   - Click a document row.
   - Assert: `documentListScrollTop === 500` in the store.
   - Navigate back.
   - Assert: list remounts with `scrollTop === 500`.

9. **Flow: Round-trip state preservation**
   - In Documents view, apply type filter "design", scroll to position 200px.
   - Navigate to Workflows (via EntityLink click).
   - Click the Documents tab to return.
   - Assert: `documentFilters.types` still contains `'design'`, `documentListScrollTop === 200`.

### Files touched

| File | Changes |
|------|---------|
| `src/__tests__/navigation.test.ts` (or similar) | New test file with integration tests |
| `test/fixtures/navigation-test-data.ts` (or similar) | New fixture file with mock project data |

**Note:** While the spec says "no new files," the test files are outside the `src/` application source tree. Test infrastructure files are acceptable additions.

### Dependencies

- **T1–T8** — all implementation tasks must be complete.

### Verification

All 9 integration test flows pass. Each flow is a self-contained test case that:
1. Sets up initial state (mock store, initial view).
2. Simulates user interaction (click, keypress).
3. Asserts final state (store values, DOM state).

---

## Summary Table

| Task | Title | Points | Dependencies | Files Modified |
|------|-------|--------|--------------|----------------|
| T1 | UI Store Expansion | 5 | — | `ui-store.ts` |
| T2 | EntityLink Wiring | 3 | T1 | `EntityLink.tsx` |
| T3 | Tree Selection Sync | 3 | T1 | `EntityTree.tsx`, `TreeNode.tsx`, `TreeContext.tsx` |
| T4 | Lozenge Click Handlers | 2 | T1 | `StatusBadge.tsx`, `TypeBadge` (inline or utility) |
| T5 | Detail Panel + View Wiring | 5 | T1, T2, T4 | `PlanDetail.tsx`, `FeatureDetail.tsx`, `TaskDetail.tsx`, `BugDetail.tsx`, `DecisionDetail.tsx`, `CheckpointDetail.tsx`, `IncidentDetail.tsx`, `KnowledgeDetail.tsx`, `DocumentViewer.tsx`, `DocumentList.tsx`, `App.tsx` |
| T6 | Document Metadata Wiring | 2 | T2, T4 | `MetadataPanel.tsx` |
| T7 | Keyboard Shortcuts | 1 | T1 | `App.tsx` |
| T8 | Edge Case Handling | 3 | T1–T7 | `ui-store.ts`, `EntityLink.tsx`, `EntityTree.tsx`, `DocumentViewer.tsx` |
| T9 | Integration Testing | 3 | T1–T8 | Test files (outside `src/`) |
| | **Total** | **27** | | |

---

## Testing Strategy

### Unit Tests (T1–T4)

Each store action and component is unit-tested in isolation:

- **Store actions** (T1): test with a mock `useProjectStore` populated with fixture data. Assert state transitions for every action. Test boundary conditions (empty history, max history, missing entities).
- **EntityLink** (T2): component test with mock stores. Assert rendering states, click dispatch, and `stopPropagation`.
- **Tree sync** (T3): test `useEffect` hooks by setting `selectedEntityId` and asserting `expandedNodeIds` changes and `scrollIntoView` calls.
- **Lozenge handlers** (T4): component test asserting `onFilterClick` callback and `stopPropagation`.

### Integration Tests (T9)

Full navigation flows spanning store updates, view switches, and DOM state. Uses a complete mock project store with representative data. Tests the wiring between components — that clicking an EntityLink in MetadataPanel actually causes the tree to expand and select the right entity.

### Manual Testing Checklist

Derived from the acceptance criteria (spec §10):

- [ ] AC-1: Entity cross-reference navigation (EntityLink in MetadataPanel → Workflows)
- [ ] AC-2: Document cross-reference navigation (doc link in FeatureDetail → Documents)
- [ ] AC-3: Status filter activation (same view)
- [ ] AC-4: Cross-view filter activation (doc type badge in Workflows → Documents)
- [ ] AC-5: Tree auto-expansion (nested task)
- [ ] AC-6: Tree auto-scroll (node below fold)
- [ ] AC-7: ⌘[ back navigation with state preservation
- [ ] AC-8: ⌘] forward navigation
- [ ] AC-9: Scroll position preservation (list ↔ viewer)
- [ ] AC-10: Superseded document links
- [ ] AC-11: Broken references (dimmed, no-op click)
- [ ] AC-12: No confirmation dialogs on any navigation
- [ ] AC-13: View switch preserves state (round-trip)
- [ ] AC-14: `e.stopPropagation` on EntityLink inside tree nodes

---

## Risk Areas

### 1. TreeContext Migration (T3) — Medium Risk

**Risk:** F3 may have embedded TreeContext deeply into the component tree. Migrating from local state to UI store reads could introduce subtle re-render issues or break existing tree interactions.

**Mitigation:** Test tree node click, chevron toggle, and keyboard navigation (if any) after migration. The TreeContext becomes a thin pass-through — verify it still provides the same interface to consumer components.

### 2. History Stack Complexity (T1) — Medium Risk

**Risk:** The cursor-based history model interacts with multiple state fields (`documentHistoryStack`, `documentHistoryCursor`, `viewingDocumentId`, `documentViewMode`, `documentListScrollTop`, `documentFilters`). A bug in cursor arithmetic or entry capture could cause stale state restoration.

**Mitigation:** Comprehensive unit tests for `navigateBack`/`navigateForward` covering: empty history, single entry, full stack, forward truncation after back navigation, MAX_HISTORY enforcement. Use defensive array spreads when restoring filter arrays to prevent shared references.

### 3. Scroll Position Timing (T3, T5) — Low Risk

**Risk:** `requestAnimationFrame` may not be sufficient if React defers rendering to a later frame. The `scrollIntoView` target might not be in the DOM yet.

**Mitigation:** The `useEffect` depends on both `selectedEntityId` and `expandedNodeIds`, so it fires after both state changes are applied. `requestAnimationFrame` adds one frame of delay. If this proves insufficient in practice, a `setTimeout(..., 0)` fallback or `MutationObserver` could be used — but `requestAnimationFrame` is the standard approach and should work for Tauri's WebView.

### 4. Repetitive Detail Panel Changes (T5) — Low Risk

**Risk:** 8 detail components need the same `onFilterClick` wiring. Easy to miss one or wire with the wrong view name.

**Mitigation:** All detail panels wire to `activateFilter('workflows', ...)` for their own status/type lozenges. Only PlanDetail and FeatureDetail have cross-view document badges wired to `activateFilter('documents', ...)`. A consistent code review checklist per component reduces the risk.

### 5. `stopPropagation` Side Effects (T2) — Low Risk

**Risk:** `e.stopPropagation()` on EntityLink prevents events from reaching parent handlers. If a parent component relies on the click event bubbling (e.g., for analytics or focus management), this could break expectations.

**Mitigation:** The only known parent click handlers are tree node selection and detail panel section toggles. Both are explicitly intended to be blocked when an EntityLink is clicked. No analytics or focus management depends on click bubbling in the current architecture.

---

## References

- [F5 Specification](../spec/f5-cross-view-navigation-spec.md) — primary source for implementation details
- [F5 Design Document](../design/f5-cross-view-navigation.md) — architectural context and interaction flows
- [KBZV Architecture](../design/kbzv-architecture.md) §7 — Navigation Model
- [KBZV v1 Development Plan](../plan/kbzv-v1-dev-plan.md) — Feature 5 scope and acceptance criteria