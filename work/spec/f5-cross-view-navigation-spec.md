# F5: Cross-View Navigation — Specification

**Feature ID:** FEAT-01KMZA9MWR7WK
**Parent Plan:** P1-kbzv
**Depends on:** FEAT-01KMZA9GFB075 (F3: Workflows View), FEAT-01KMZA9JMZFNF (F4: Documents View)
**Type:** Specification
**Status:** Draft

---

## 1. Files Modified

F5 creates **no new files**. It wires existing components created by F3 and F4. Every change is a modification to an existing file.

| File | Change Type | Summary |
|------|-------------|---------|
| `src/lib/store/ui-store.ts` | Major rewrite | Full UIState interface; navigation actions; history stack |
| `src/components/common/EntityLink.tsx` | Wire onClick | Connect stubbed click handler to navigation actions |
| `src/components/tree/EntityTree.tsx` | Add effects | Auto-expansion + scroll-to-selected on `selectedEntityId` change |
| `src/components/tree/TreeNode.tsx` | Add attribute | `id` attribute for scroll targeting |
| `src/components/document/DocumentViewer.tsx` | Wire navigation | Back button → `navigateBack()`; accept external `viewingDocumentId` |
| `src/components/document/MetadataPanel.tsx` | Wire handlers | EntityLink navigation; lozenge `onFilterClick` props |
| `src/components/document/DocumentList.tsx` | Wire scroll + filters | Scroll position save/restore; lozenge `onFilterClick` props |
| `src/components/entity/PlanDetail.tsx` | Wire handlers | Document links → `navigateToDocument`; lozenge `onFilterClick` |
| `src/components/entity/FeatureDetail.tsx` | Wire handlers | Same as PlanDetail |
| `src/components/entity/TaskDetail.tsx` | Wire handlers | Lozenge `onFilterClick` |
| `src/components/entity/BugDetail.tsx` | Wire handlers | Lozenge `onFilterClick` |
| `src/components/entity/DecisionDetail.tsx` | Wire handlers | Lozenge `onFilterClick` |
| `src/components/entity/CheckpointDetail.tsx` | Wire handlers | Lozenge `onFilterClick` |
| `src/components/common/StatusBadge.tsx` | Add prop | `onFilterClick` optional prop |
| `src/App.tsx` | Add effect | Global keyboard shortcut listener for ⌘[ / ⌘] |

---

## 2. UI Store Updates

### 2.1 Updated UIState Interface — Complete Definition

This is the **complete** `UIState` interface after F5. Fields marked `// F3`, `// F4`, or `// F5` indicate which feature introduced them.

```typescript
// src/lib/store/ui-store.ts

import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────

type ViewId = 'documents' | 'workflows';
type DocumentViewMode = 'list' | 'viewer';
type FilterField = 'types' | 'statuses';

interface DocumentHistoryEntry {
  mode: DocumentViewMode;
  documentId: string | null;       // non-null when mode === 'viewer'
  scrollTop: number;               // list scroll position at time of capture
  filters: {
    types: string[];
    statuses: string[];
  };
}

// ─── Entity type resolution (pure function, no store dependency) ─────

type EntityType =
  | 'plan'
  | 'feature'
  | 'task'
  | 'bug'
  | 'decision'
  | 'knowledge'
  | 'incident'
  | 'checkpoint'
  | 'document';

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

// ─── Store interface ─────────────────────────────────────

interface UIState {
  // --- View routing (F1) ---
  activeView: ViewId;

  // --- Workflows view state (F3) ---
  selectedEntityId: string | null;
  selectedEntityType: string | null;

  // --- Workflows filter state (F3) ---
  workflowFilters: {
    types: Set<string>;              // entity types shown (e.g. 'feature', 'task')
    statusColours: Set<string>;      // colour groups shown (e.g. 'grey', 'green')
  };

  // --- Documents view state (F4) ---
  documentViewMode: DocumentViewMode;
  viewingDocumentId: string | null;
  documentListScrollTop: number;

  // --- Documents filter state (F4) ---
  documentFilters: {
    types: string[];                 // e.g. ['design', 'specification']
    statuses: string[];              // e.g. ['approved']
  };

  // --- Documents view history stack (F5) ---
  documentHistory: DocumentHistoryEntry[];
  documentHistoryIndex: number;      // points to current position; -1 = no history

  // --- Tree expansion state (F3, extended by F5) ---
  expandedNodeIds: Set<string>;

  // --- Actions: view switching (F1, extended by F5) ---
  setActiveView: (view: ViewId) => void;

  // --- Actions: workflows selection (F3, extended by F5) ---
  selectEntity: (id: string | null, type: string | null) => void;

  // --- Actions: workflows filters (F3) ---
  toggleWorkflowType: (type: string) => void;
  toggleWorkflowStatusColour: (colour: string) => void;
  clearWorkflowFilters: () => void;
  activateWorkflowStatusFilter: (status: string) => void;

  // --- Actions: documents (F4, extended by F5) ---
  setDocumentViewMode: (mode: DocumentViewMode) => void;
  setViewingDocumentId: (id: string | null) => void;
  saveDocumentListScrollTop: (scrollTop: number) => void;

  // --- Actions: documents filters (F4, extended by F5) ---
  toggleDocumentType: (type: string) => void;
  toggleDocumentStatus: (status: string) => void;
  clearDocumentFilters: () => void;

  // --- Actions: tree expansion (F3, extended by F5) ---
  toggleExpandNode: (id: string) => void;
  expandNodes: (ids: string[]) => void;

  // --- Actions: cross-view navigation (F5) ---
  navigateToEntity: (id: string) => void;
  navigateToDocument: (id: string) => void;
  activateFilter: (view: ViewId, field: FilterField, value: string) => void;

  // --- Actions: history navigation (F5) ---
  navigateBack: () => void;
  navigateForward: () => void;
}
```

**Export the `resolveEntityType` function** as a named export from `ui-store.ts` so that `EntityLink.tsx` and other components can import it:

```typescript
export { resolveEntityType };
export type { EntityType, ViewId, DocumentViewMode, FilterField, DocumentHistoryEntry };
```

### 2.2 `navigateToEntity(id)` — Exact Implementation

```typescript
navigateToEntity: (id: string) => {
  const state = get();
  const projectState = useProjectStore.getState();

  // 1. Resolve entity type from ID prefix
  const type = resolveEntityType(id);
  if (!type) return; // unrecognised ID format → no-op

  // 2. If document, delegate to navigateToDocument
  if (type === 'document') {
    get().navigateToDocument(id);
    return;
  }

  // 3. Look up entity in the correct store map
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
  if (!entityMap || !entityMap.has(id)) return; // broken ref → no-op

  // 4. Compute tree expansion path (ancestor chain)
  const expansionIds: string[] = [];

  if (type === 'task') {
    const task = projectState.tasks.get(id);
    if (task?.parent_feature) {
      expansionIds.push(task.parent_feature);
      const feature = projectState.features.get(task.parent_feature);
      if (feature?.parent) {
        expansionIds.push(feature.parent);
      }
    }
  } else if (type === 'feature') {
    const feature = projectState.features.get(id);
    if (feature?.parent) {
      expansionIds.push(feature.parent);
    }
  } else if (type === 'bug') {
    expansionIds.push('__bugs__');
  } else if (type === 'decision') {
    expansionIds.push('__decisions__');
  } else if (type === 'incident') {
    expansionIds.push('__incidents__');
  } else if (type === 'checkpoint') {
    expansionIds.push('__checkpoints__');
  } else if (type === 'knowledge') {
    expansionIds.push('__knowledge__');
  }
  // type === 'plan' → no expansion needed (top-level)

  // 5. Apply all state changes in a single set() call
  set({
    selectedEntityId: id,
    selectedEntityType: type,
    activeView: 'workflows',
    expandedNodeIds: new Set([...state.expandedNodeIds, ...expansionIds]),
  });
},
```

**Key behaviours:**
- If `activeView` is already `'workflows'`, the view does not re-mount — only `selectedEntityId` changes.
- If `activeView` is `'documents'`, it switches to `'workflows'` but the Documents view state is preserved (not reset).
- The `expandedNodeIds` update is additive — existing expansions are never collapsed by navigation.
- Scroll-to-selected happens in `EntityTree.tsx` via a `useEffect` (§4), not in the store action.

### 2.3 `navigateToDocument(id)` — Exact Implementation

```typescript
navigateToDocument: (id: string) => {
  const state = get();
  const projectState = useProjectStore.getState();

  // 1. Look up DocumentRecord
  if (!projectState.documents.has(id)) return; // broken ref → no-op

  // 2. If already in documents view, push current state onto history
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

    // Truncate any forward history beyond current index
    const newHistory = state.documentHistory.slice(0, state.documentHistoryIndex + 1);
    newHistory.push(currentEntry);

    // Enforce max history size
    const MAX_HISTORY = 50;
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift(); // remove oldest entry
    }

    set({
      documentHistory: newHistory,
      documentHistoryIndex: newHistory.length - 1,
      viewingDocumentId: id,
      documentViewMode: 'viewer',
    });
  } else {
    // 3. Coming from Workflows view — switch views, no history push
    //    (there's no prior Documents state to preserve in history)
    set({
      activeView: 'documents',
      viewingDocumentId: id,
      documentViewMode: 'viewer',
    });
  }
},
```

**Key behaviours:**
- Forward history is truncated when a new navigation occurs (standard browser-like behaviour).
- History entries capture the *departing* state, not the destination.
- Cross-view navigation from Workflows does NOT push a history entry (there is no prior Documents state worth preserving for back-navigation).
- The `MAX_HISTORY = 50` cap prevents unbounded memory growth.

### 2.4 `activateFilter(view, field, value)` — Exact Implementation

```typescript
activateFilter: (view: ViewId, field: FilterField, value: string) => {
  const state = get();

  if (view === 'documents') {
    const filterKey = field; // 'types' or 'statuses'
    const currentArray = [...state.documentFilters[filterKey]];
    const index = currentArray.indexOf(value);

    if (index >= 0) {
      // Toggle off — remove the value
      currentArray.splice(index, 1);
    } else {
      // Toggle on — add the value
      currentArray.push(value);
    }

    set({
      activeView: 'documents', // switch view if not already there
      documentFilters: {
        ...state.documentFilters,
        [filterKey]: currentArray,
      },
      // When activating a filter cross-view, show the list (not a specific doc)
      ...(state.activeView !== 'documents' ? { documentViewMode: 'list' as const } : {}),
    });
  } else {
    // view === 'workflows'
    //
    // Workflows filters use the F3 filter model (Set-based colour groups
    // and type toggles). F5 exposes activateFilter as a convenience bridge.
    //
    // For 'types': toggle the entity type in workflowFilters.types
    // For 'statuses': map the status string to its colour group, then
    //   call the existing activateWorkflowStatusFilter action
    if (field === 'types') {
      const newTypes = new Set(state.workflowFilters.types);
      if (newTypes.has(value)) {
        newTypes.delete(value);
      } else {
        newTypes.add(value);
      }
      set({
        activeView: 'workflows',
        workflowFilters: {
          ...state.workflowFilters,
          types: newTypes,
        },
      });
    } else {
      // field === 'statuses'
      // Delegate to the existing F3 action which handles colour-group logic
      set({ activeView: 'workflows' });
      get().activateWorkflowStatusFilter(value);
    }
  }
},
```

**Key behaviours:**
- If the view is already active, no view switch occurs (the `set` is still harmless).
- Cross-view filter activation from Workflows → Documents switches to the document list (not viewer).
- Within-view activation toggles the filter value (click again to remove).
- Workflows status filtering delegates to the existing F3 colour-group mechanism.

### 2.5 `goBack()` / `goForward()` — History Navigation

```typescript
navigateBack: () => {
  const state = get();

  // Only operates in documents view
  if (state.activeView !== 'documents') return;

  // If viewing a document but no history, return to list with defaults
  if (state.documentHistoryIndex < 0 || state.documentHistory.length === 0) {
    if (state.documentViewMode === 'viewer') {
      set({
        documentViewMode: 'list',
        viewingDocumentId: null,
      });
    }
    return;
  }

  // Pop the entry at the current index
  const entry = state.documentHistory[state.documentHistoryIndex];

  set({
    documentViewMode: entry.mode,
    viewingDocumentId: entry.documentId,
    documentListScrollTop: entry.scrollTop,
    documentFilters: {
      types: [...entry.filters.types],
      statuses: [...entry.filters.statuses],
    },
    documentHistoryIndex: state.documentHistoryIndex - 1,
  });
},

navigateForward: () => {
  const state = get();

  // Only operates in documents view
  if (state.activeView !== 'documents') return;

  const nextIndex = state.documentHistoryIndex + 2;
  // +2 because: current index points to the last "back" entry,
  // +1 is the current state (not stored), +2 would be forward.
  // But we need to reconsider: forward entries exist when the user
  // navigated back and hasn't yet navigated forward past them.

  // Simpler model: we store both back and forward in one array.
  // documentHistoryIndex points to the entry we'd restore on "back".
  // Forward entries are those at indices > documentHistoryIndex + 1.

  // On navigateForward: save current state at documentHistoryIndex + 1,
  // then restore the entry at documentHistoryIndex + 2.

  const forwardIndex = state.documentHistoryIndex + 2;
  if (forwardIndex >= state.documentHistory.length) return; // no forward history

  // Save current state into the slot we're leaving
  const currentEntry: DocumentHistoryEntry = {
    mode: state.documentViewMode,
    documentId: state.viewingDocumentId,
    scrollTop: state.documentListScrollTop,
    filters: {
      types: [...state.documentFilters.types],
      statuses: [...state.documentFilters.statuses],
    },
  };

  const newHistory = [...state.documentHistory];
  // The current state occupies index documentHistoryIndex + 1
  newHistory[state.documentHistoryIndex + 1] = currentEntry;

  const forwardEntry = newHistory[forwardIndex];

  set({
    documentHistory: newHistory,
    documentHistoryIndex: forwardIndex - 1,
    documentViewMode: forwardEntry.mode,
    viewingDocumentId: forwardEntry.documentId,
    documentListScrollTop: forwardEntry.scrollTop,
    documentFilters: {
      types: [...forwardEntry.filters.types],
      statuses: [...forwardEntry.filters.statuses],
    },
  });
},
```

**Simplified history model (recommended alternative):**

The above bidirectional model is complex. A simpler and more robust implementation uses a **linear history array + cursor**, matching browser semantics:

```typescript
// The history array stores snapshots of every visited state.
// documentHistoryCursor points to the currently active entry.
// Back decrements the cursor; forward increments it.
// New navigation truncates entries after the cursor and appends.

interface UIState {
  // Replace documentHistory + documentHistoryIndex with:
  documentHistoryStack: DocumentHistoryEntry[];
  documentHistoryCursor: number; // index of the current entry in the stack
}

navigateBack: () => {
  const state = get();
  if (state.activeView !== 'documents') return;
  if (state.documentHistoryCursor <= 0) {
    // At the start of history; if in viewer, fall back to list
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

And the push logic used by `navigateToDocument` becomes:

```typescript
// Inside navigateToDocument, when already in documents view:
const currentEntry: DocumentHistoryEntry = {
  mode: state.documentViewMode,
  documentId: state.viewingDocumentId,
  scrollTop: state.documentListScrollTop,
  filters: {
    types: [...state.documentFilters.types],
    statuses: [...state.documentFilters.statuses],
  },
};

// Truncate forward history, append current state, set cursor to new entry
const truncated = state.documentHistoryStack.slice(0, state.documentHistoryCursor + 1);
truncated.push(currentEntry);

const MAX_HISTORY = 50;
const overflow = truncated.length > MAX_HISTORY ? 1 : 0;
const finalStack = overflow ? truncated.slice(1) : truncated;

// The new destination entry
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
```

**Decision: Use the simplified cursor model.** Replace the `documentHistory` / `documentHistoryIndex` fields in §2.1 with `documentHistoryStack` / `documentHistoryCursor`. The rest of this spec uses the cursor model.

### 2.6 Initial State

```typescript
const useUIStore = create<UIState>((set, get) => ({
  // View routing
  activeView: 'workflows',

  // Workflows
  selectedEntityId: null,
  selectedEntityType: null,
  workflowFilters: {
    types: new Set(),
    statusColours: new Set(),
  },

  // Documents
  documentViewMode: 'list',
  viewingDocumentId: null,
  documentListScrollTop: 0,
  documentFilters: {
    types: [],
    statuses: [],
  },

  // History (cursor model)
  documentHistoryStack: [],
  documentHistoryCursor: -1,

  // Tree
  expandedNodeIds: new Set(),

  // ... all actions defined above ...
}));
```

---

## 3. EntityLink Wiring

### 3.1 Updated `EntityLink.tsx` — onClick Handler Implementation

**Before (F3):** `onClick` is a no-op for document-type entities. For workflow entities, it calls `TreeContext.select()` and `TreeContext.expandTo()` to navigate within the tree.

**After (F5):** `onClick` delegates all navigation to the UI store. `TreeContext.select()` and `TreeContext.expandTo()` are no longer called directly from `EntityLink` — the store actions handle everything, and the tree reacts via `useEffect`.

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

  // 1. Resolve type
  const type = resolveEntityType(entityId);

  // 2. Look up entity in store
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

  // 3. Determine rendering state
  const isLoading = useProjectStore((s) => s.projectPath !== null && s.plans.size === 0);
  const isResolved = entity !== null;
  const isBroken = !isLoading && !isResolved;

  // 4. Derive display text (tooltip)
  const tooltip = isResolved
    ? (entity as { title?: string; summary?: string }).title
      ?? (entity as { summary?: string }).summary
      ?? entityId
    : isBroken
      ? 'Entity not found'
      : 'Loading…';

  // 5. Click handler
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // prevent bubbling to parent clickable elements (tree nodes, etc.)

    if (!isResolved || !type) return; // broken or loading → no-op

    if (type === 'document') {
      navigateToDocument(entityId);
    } else {
      navigateToEntity(entityId);
    }
  };

  // 6. Render
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

### 3.2 Entity Type Resolution from ID Prefix — Exact Matching

The `resolveEntityType` function (defined in §2.1 and exported from `ui-store.ts`) uses the following matching order. **Order matters** — the `includes('/')` check must come after the specific prefix checks to avoid false positives on hypothetical IDs containing slashes.

| Priority | Test | Returns |
|----------|------|---------|
| 1 | `id.startsWith('FEAT-')` | `'feature'` |
| 2 | `id.startsWith('TASK-')` | `'task'` |
| 3 | `id.startsWith('BUG-')` | `'bug'` |
| 4 | `id.startsWith('DEC-')` | `'decision'` |
| 5 | `id.startsWith('KE-')` | `'knowledge'` |
| 6 | `id.startsWith('INC-')` | `'incident'` |
| 7 | `id.startsWith('CHK-')` | `'checkpoint'` |
| 8 | `id.includes('/')` | `'document'` |
| 9 | `/^[A-Za-z]\d+-/.test(id)` | `'plan'` |
| 10 | (none matched) | `null` |

**Examples:**

| Input ID | Resolved Type |
|----------|---------------|
| `FEAT-01KMZA9GFB075` | `'feature'` |
| `TASK-01ABC` | `'task'` |
| `P1-kbzv` | `'plan'` |
| `work/design/kbzv-architecture.md` | `'document'` |
| `FEAT-01ABC/design-spec` | `'feature'` (prefix check wins over `/` check) |
| `garbage` | `null` |

### 3.3 Rendering States

| State | Detection Logic | Visual Treatment | Click Behaviour |
|-------|-----------------|------------------|-----------------|
| **Loading** | `projectPath !== null && plans.size === 0` — store is hydrating | Plain text, `text-muted-foreground`, no cursor change | No handler attached |
| **Resolved** | Entity found in the store map for its type | Blue text (`text-primary`), `underline-offset-4 hover:underline cursor-pointer`, entity title as `title` attribute | `handleClick` → `navigateToEntity` or `navigateToDocument` |
| **Broken** | Store hydrated, entity not found in its type's map | Dimmed text (`text-muted-foreground/50`), `line-through`, `cursor-default`, "Entity not found" as `title` | `handleClick` → early return (no-op) |

---

## 4. Tree Selection Sync

### 4.1 `expandToEntity(id)` — Exact Algorithm

This logic lives inside `EntityTree.tsx` as a `useEffect` that watches `selectedEntityId`. It replaces F3's manual `TreeContext.expandTo()` with a reactive approach driven by the store.

```typescript
// Inside EntityTree.tsx

import { resolveEntityType } from '@/lib/store/ui-store';

const selectedEntityId = useUIStore((s) => s.selectedEntityId);
const expandNodes = useUIStore((s) => s.expandNodes);
const expandedNodeIds = useUIStore((s) => s.expandedNodeIds);

const features = useProjectStore((s) => s.features);
const tasks = useProjectStore((s) => s.tasks);

// Synthetic section header IDs used by standalone sections
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
        if (feature?.parent) {
          pathIds.push(feature.parent);
        }
      }
      break;
    }

    case 'feature': {
      const feature = features.get(selectedEntityId);
      if (feature?.parent) {
        pathIds.push(feature.parent);
      }
      break;
    }

    case 'plan':
      // Top-level node — no ancestors to expand
      break;

    case 'bug':
    case 'decision':
    case 'incident':
    case 'checkpoint':
    case 'knowledge': {
      const sectionId = SECTION_HEADERS[type];
      if (sectionId) {
        pathIds.push(sectionId);
      }
      break;
    }

    default:
      // 'document' type should never reach here (navigateToEntity delegates)
      break;
  }

  // Only update if there are new nodes to expand
  if (pathIds.length > 0) {
    const needsExpansion = pathIds.some((id) => !expandedNodeIds.has(id));
    if (needsExpansion) {
      expandNodes(pathIds);
    }
  }
}, [selectedEntityId, tasks, features, expandNodes, expandedNodeIds]);
```

**`expandNodes` action in the store:**

```typescript
expandNodes: (ids: string[]) => {
  set((state) => ({
    expandedNodeIds: new Set([...state.expandedNodeIds, ...ids]),
  }));
},
```

This is additive only — it never collapses nodes. Collapsing is the user's manual action via chevron clicks.

**Algorithm summary:**

1. When `selectedEntityId` changes (from any source), the effect fires.
2. Resolve the entity type.
3. Walk the entity hierarchy **upward** to collect all ancestor IDs.
4. For standalone entities (bugs, decisions, etc.), collect the synthetic section header ID.
5. Add all collected IDs to `expandedNodeIds` in a single state update.
6. The tree re-renders with the ancestors expanded, revealing the target node.

### 4.2 `scrollToSelected()` — DOM Interaction

A separate `useEffect` in `EntityTree.tsx` handles scrolling after expansion:

```typescript
useEffect(() => {
  if (!selectedEntityId) return;

  // Wait for the DOM to update after expansion
  requestAnimationFrame(() => {
    const node = document.getElementById(`tree-node-${selectedEntityId}`);
    if (!node) return;

    node.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',    // only scrolls if the node is out of view
    });
  });
}, [selectedEntityId, expandedNodeIds]);
```

**`scrollIntoView` options explained:**

| Option | Value | Reason |
|--------|-------|--------|
| `behavior` | `'smooth'` | Animated scroll so the user can track where the selection moved |
| `block` | `'nearest'` | Minimises scrolling — only scrolls if the node is outside the visible area. If already visible, no scroll occurs. Avoids jarring jumps when clicking nearby nodes. |

**Why `requestAnimationFrame`:** The expansion state update triggers a React re-render. `requestAnimationFrame` defers the scroll call until after the browser has painted the newly expanded nodes into the DOM. Without this, `getElementById` might return `null` because the target node hasn't been rendered yet.

**Why depend on both `selectedEntityId` and `expandedNodeIds`:** The expansion and selection updates may be batched by React into a single render, but the scroll needs to happen after *both* have been applied. Including `expandedNodeIds` in the dependency array ensures the scroll fires after expansion, not just after selection.

### 4.3 Integration with TreeContext

F3 introduced a `TreeContext` with `expandTo`, `select`, `toggleExpand`, and related methods. F5 migrates the canonical selection and expansion state into the Zustand UI store. TreeContext becomes a thin pass-through:

**Before (F3):**
```typescript
// TreeContext managed its own local state
const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
```

**After (F5):**
```typescript
// TreeContext reads from and writes to the UI store
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
    // Now delegates to navigateToEntity, which handles expansion
    useUIStore.getState().navigateToEntity(id);
  },
  select: (id: string, type: string) => {
    selectEntity(id, type);
  },
};
```

This ensures that tree state is shared between direct tree interactions (click on a node) and programmatic navigation (click an EntityLink in a detail panel or document metadata).

---

## 5. Keyboard Shortcuts

### 5.1 Event Listener Registration — `useEffect` Hook

The keyboard shortcut listener is registered in `App.tsx` as a global `useEffect`:

```typescript
// src/App.tsx

import { useUIStore } from '@/lib/store/ui-store';

function App() {
  const activeView = useUIStore((s) => s.activeView);
  const navigateBack = useUIStore((s) => s.navigateBack);
  const navigateForward = useUIStore((s) => s.navigateForward);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle when Meta key (⌘ on macOS) is held
      if (!e.metaKey) return;

      // Ignore if other modifiers are also held (Shift, Ctrl, Alt)
      if (e.shiftKey || e.ctrlKey || e.altKey) return;

      if (e.key === '[') {
        e.preventDefault();  // prevent default browser/system behaviour
        e.stopPropagation(); // prevent Tauri from intercepting
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

  // ... rest of App render
}
```

### 5.2 ⌘[ / ⌘] — Back/Forward Implementation

| Shortcut | `KeyboardEvent.key` | Action | Scope |
|----------|---------------------|--------|-------|
| `⌘[` | `'['` with `metaKey === true` | `navigateBack()` | Documents view only (action no-ops in Workflows) |
| `⌘]` | `']'` with `metaKey === true` | `navigateForward()` | Documents view only (action no-ops in Workflows) |

These shortcuts match macOS conventions used by Safari and Finder. They do not conflict with Tauri's default key bindings (Tauri does not bind `⌘[` or `⌘]` by default).

The `navigateBack()` and `navigateForward()` actions (§2.5) internally check `activeView === 'documents'` and no-op if in Workflows view. This means the event listener does not need to check the active view — it can always call the action.

### 5.3 Key Event Handling — `preventDefault`, `stopPropagation`

Both `preventDefault()` and `stopPropagation()` are called:

- **`preventDefault()`** — prevents the browser/webview from handling the key combination (e.g., some systems use `⌘[` for text indent).
- **`stopPropagation()`** — prevents the event from bubbling to Tauri's native key event handling.

The modifier guard (`!e.shiftKey && !e.ctrlKey && !e.altKey`) ensures that combinations like `⌘⇧[` (switch tab in some apps) are not intercepted.

---

## 6. Lozenge Click Handlers

### 6.1 StatusBadge `onClick` — Filter Activation

**Updated `StatusBadge` interface:**

```typescript
// src/components/common/StatusBadge.tsx

interface StatusBadgeProps {
  status: string;
  className?: string;
  onFilterClick?: (field: 'statuses', value: string) => void;
}

export function StatusBadge({ status, className, onFilterClick }: StatusBadgeProps) {
  const colour = getStatusColour(status);
  const styles = STATUS_STYLES[colour];

  const handleClick = onFilterClick
    ? (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent row/node click from firing
        onFilterClick('statuses', status);
      }
    : undefined;

  return (
    <Badge
      className={cn(
        styles,
        onFilterClick && 'cursor-pointer hover:brightness-90 transition-colors',
        className,
      )}
      onClick={handleClick}
    >
      {status}
    </Badge>
  );
}
```

**Visual affordance for clickable lozenges:**
- `cursor: pointer` on hover (via `cursor-pointer` class, applied only when `onFilterClick` is provided)
- Subtle hover darkening (via `hover:brightness-90`)
- Transition on colour change (`transition-colors`) for smooth feedback

### 6.2 Type Badge `onClick` — Filter Activation

A general-purpose `TypeBadge` or the existing `Badge` component is used for document types and entity types. The same pattern applies:

```typescript
// Used inline or as a small wrapper

interface TypeBadgeProps {
  value: string;
  variant: 'entity-type' | 'document-type';
  className?: string;
  onFilterClick?: (field: 'types', value: string) => void;
}

function TypeBadge({ value, variant, className, onFilterClick }: TypeBadgeProps) {
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
        className,
      )}
      onClick={handleClick}
    >
      {value}
    </Badge>
  );
}
```

### 6.3 Cross-View Filter Activation Flow

The parent component is responsible for binding the correct view to the `onFilterClick` callback. This is how cross-view activation works:

**Same-view activation (e.g., StatusBadge in Workflows detail panel):**

```typescript
// In FeatureDetail.tsx
<StatusBadge
  status={feature.status}
  onFilterClick={(field, value) =>
    uiStore.activateFilter('workflows', field, value)
  }
/>
```

**Cross-view activation (e.g., document type badge inside a Workflows detail panel):**

```typescript
// In FeatureDetail.tsx, inside the "Documents" section
{feature.design && (
  <TypeBadge
    value={documentRecord.type}
    variant="document-type"
    onFilterClick={(field, value) =>
      uiStore.activateFilter('documents', field, value)  // cross-view!
    }
  />
)}
```

**Active filter ring indicator:**

When a lozenge's value matches an active filter, it renders with a ring to indicate active state:

```typescript
// Additional class applied conditionally:
const isActive = activeFilters.includes(value); // or activeFilters.has(value)

<Badge
  className={cn(
    styles,
    onFilterClick && 'cursor-pointer hover:brightness-90 transition-colors',
    isActive && 'ring-2 ring-offset-1 ring-primary',
    className,
  )}
  onClick={handleClick}
>
  {value}
</Badge>
```

To determine `isActive`, the badge component receives the active filters as a prop or reads them from the UI store directly. The recommended approach is for the parent to pass an `isActive` boolean:

```typescript
interface StatusBadgeProps {
  status: string;
  className?: string;
  onFilterClick?: (field: 'statuses', value: string) => void;
  isFilterActive?: boolean; // true when this badge's value is an active filter
}
```

---

## 7. Component Modifications Summary

### 7.1 `EntityLink.tsx` Changes

| Aspect | Before (F3) | After (F5) |
|--------|-------------|------------|
| Click handler (workflow entities) | Calls `TreeContext.select()` + `TreeContext.expandTo()` directly | Calls `uiStore.navigateToEntity(id)` |
| Click handler (document entities) | No-op | Calls `uiStore.navigateToDocument(id)` |
| `e.stopPropagation()` | Present | Present (no change) |
| Store dependency | `TreeContext` | `useUIStore` (navigateToEntity, navigateToDocument) + `useProjectStore` (entity lookup) |
| Rendering | No change | No change — same three states (resolved, broken, loading) |

**Props: No changes.** `EntityLinkProps` remains `{ entityId: string; className?: string }`.

### 7.2 `EntityTree.tsx` Changes

| Aspect | Before (F3) | After (F5) |
|--------|-------------|------------|
| Expansion trigger | User clicks chevron only | User clicks chevron OR `selectedEntityId` changes (auto-expand) |
| Expansion state source | `TreeContext` local state | `useUIStore.expandedNodeIds` |
| Selection state source | `TreeContext` local state | `useUIStore.selectedEntityId` |
| Scroll behaviour | None (manual scrolling only) | Auto-scroll to selected node via `requestAnimationFrame` + `scrollIntoView` |

**New code added:**
1. `useEffect` for auto-expansion (§4.1) — ~30 lines
2. `useEffect` for scroll-to-selected (§4.2) — ~10 lines

### 7.3 `TreeNode.tsx` Changes

| Aspect | Before (F3) | After (F5) |
|--------|-------------|------------|
| DOM `id` attribute | Not set | `id={`tree-node-${entity.id}`}` |
| All other rendering | Unchanged | Unchanged |

**Exact change:**

```typescript
// Before (F3):
<div
  className={cn('flex items-center gap-2 px-2 py-1 ...', isSelected && 'bg-accent')}
  onClick={() => onSelect(node.id, node.type)}
>

// After (F5):
<div
  id={`tree-node-${node.id}`}
  className={cn('flex items-center gap-2 px-2 py-1 ...', isSelected && 'bg-accent')}
  onClick={() => onSelect(node.id, node.type)}
>
```

This is a one-line addition. The `id` attribute is used by `scrollIntoView` in §4.2.

**Standalone section headers** also need IDs for scroll targeting:

```typescript
// StandaloneSection.tsx (or equivalent)
<div id="tree-node-__bugs__" ...>
  ── Bugs ({count}) ──
</div>
```

### 7.4 `DocumentViewer.tsx` Changes

| Aspect | Before (F4) | After (F5) |
|--------|-------------|------------|
| Back button handler | Calls local `onBack` prop or `setSelectedDocId(null)` | Calls `uiStore.navigateBack()` |
| Document ID source | Prop from parent (`documentId`) or local state | Reads `uiStore.viewingDocumentId` (reactive to external changes) |
| Cross-view entry | Not supported | Supported — component reacts to `viewingDocumentId` changes from `navigateToDocument()` |

**Exact changes:**

```typescript
// Before (F4):
function DocumentViewer({ documentId, onBack }: { documentId: string; onBack: () => void }) {

// After (F5):
function DocumentViewer() {
  const viewingDocumentId = useUIStore((s) => s.viewingDocumentId);
  const navigateBack = useUIStore((s) => s.navigateBack);

  if (!viewingDocumentId) return null;

  // ... rest of rendering uses viewingDocumentId instead of prop
  // Back button:
  <Button variant="ghost" onClick={navigateBack}>
    <ChevronLeft className="h-4 w-4" />
    Back
  </Button>
```

The `DocumentViewer` no longer receives `documentId` and `onBack` as props. It reads from the store, making it reactive to both in-view navigation (clicking a document row) and cross-view navigation (clicking a document link in Workflows).

### 7.5 `MetadataPanel.tsx` Changes

| Aspect | Before (F4) | After (F5) |
|--------|-------------|------------|
| Owner EntityLink | Rendered but inert (click does nothing) | Click navigates to Workflows view via `navigateToEntity` |
| Related entity EntityLinks | Rendered but inert | Click navigates to Workflows view |
| Superseded-by link | Rendered but inert | Click navigates to successor document via `navigateToDocument` |
| Type badge | Static display only | Clickable — calls `activateFilter('documents', 'types', value)` |
| Status badge (DriftBadge) | Static display only | Clickable — calls `activateFilter('documents', 'statuses', value)` |

**No prop changes needed** for EntityLink — the wiring happens inside `EntityLink.tsx` itself (§3.1). The MetadataPanel just renders `<EntityLink entityId={record.owner} />` and the click handler works automatically.

**Lozenge wiring requires passing `onFilterClick`:**

```typescript
// In MetadataPanel.tsx
const activateFilter = useUIStore((s) => s.activateFilter);

// Type badge
<TypeBadge
  value={record.type}
  variant="document-type"
  onFilterClick={(field, value) => activateFilter('documents', field, value)}
/>

// Status badge (via DriftBadge or StatusBadge)
<StatusBadge
  status={record.status}
  onFilterClick={(field, value) => activateFilter('documents', field, value)}
/>
```

### 7.6 `DocumentList.tsx` Changes

| Aspect | Before (F4) | After (F5) |
|--------|-------------|------------|
| Scroll position | Local state (lost on unmount) | Saved to `uiStore.documentListScrollTop` on departure |
| Scroll restoration | None | Reads `uiStore.documentListScrollTop` on mount and restores |
| Row click | Calls local `setSelectedDocId(id)` | Calls `uiStore.navigateToDocument(id)` (pushes history) |
| Lozenge clicks in rows | Toggles local filter state | Calls `uiStore.activateFilter('documents', field, value)` |
| Filter state source | Local component state | Reads from `uiStore.documentFilters` |

**Scroll position save/restore:**

```typescript
// In DocumentList.tsx
const scrollRef = useRef<HTMLDivElement>(null);
const documentListScrollTop = useUIStore((s) => s.documentListScrollTop);
const saveDocumentListScrollTop = useUIStore((s) => s.saveDocumentListScrollTop);

// Restore scroll position on mount
useEffect(() => {
  if (scrollRef.current && documentListScrollTop > 0) {
    scrollRef.current.scrollTop = documentListScrollTop;
  }
}, []); // run once on mount

// Save scroll position before navigating away
const handleRowClick = (documentId: string) => {
  if (scrollRef.current) {
    saveDocumentListScrollTop(scrollRef.current.scrollTop);
  }
  navigateToDocument(documentId);
};

// Render
<div ref={scrollRef} className="overflow-y-auto flex-1">
  {filteredDocuments.map((doc) => (
    <DocumentRow
      key={doc.id}
      document={doc}
      onClick={() => handleRowClick(doc.id)}
      onTypeFilterClick={(value) => activateFilter('documents', 'types', value)}
      onStatusFilterClick={(value) => activateFilter('documents', 'statuses', value)}
    />
  ))}
</div>
```

### 7.7 All Detail Panel Changes

The following changes apply uniformly to `PlanDetail.tsx`, `FeatureDetail.tsx`, `TaskDetail.tsx`, `BugDetail.tsx`, `DecisionDetail.tsx`, `CheckpointDetail.tsx`, `IncidentDetail.tsx`, and `KnowledgeDetail.tsx`:

**1. EntityLinks are now functional (automatic — no code change in detail panels)**

Every `<EntityLink entityId={...} />` already rendered by these components is automatically wired because `EntityLink.tsx` now contains the navigation logic (§3.1). No per-component change needed.

**2. StatusBadge receives `onFilterClick`:**

```typescript
// In every detail component that renders a StatusBadge:
const activateFilter = useUIStore((s) => s.activateFilter);

<StatusBadge
  status={entity.status}
  onFilterClick={(field, value) => activateFilter('workflows', field, value)}
/>
```

**3. Document references in PlanDetail and FeatureDetail wire to `navigateToDocument`:**

```typescript
// In FeatureDetail.tsx (and PlanDetail.tsx for plan.design)
const navigateToDocument = useUIStore((s) => s.navigateToDocument);

// In the Documents section
{feature.design && (
  <button
    type="button"
    className="text-sm text-primary hover:underline cursor-pointer"
    onClick={() => navigateToDocument(feature.design!)}
  >
    {designDocTitle}
  </button>
)}

{feature.spec && (
  <button
    type="button"
    className="text-sm text-primary hover:underline cursor-pointer"
    onClick={() => navigateToDocument(feature.spec!)}
  >
    {specDocTitle}
  </button>
)}

{feature.dev_plan && (
  <button
    type="button"
    className="text-sm text-primary hover:underline cursor-pointer"
    onClick={() => navigateToDocument(feature.dev_plan!)}
  >
    {devPlanDocTitle}
  </button>
)}
```

**4. Document type badges in PlanDetail/FeatureDetail wire to cross-view filter activation:**

```typescript
// In FeatureDetail.tsx, next to each document reference
<TypeBadge
  value={docRecord.type}
  variant="document-type"
  onFilterClick={(field, value) => activateFilter('documents', field, value)}
/>
```

### 7.8 `App.tsx` Changes

| Aspect | Before (F4) | After (F5) |
|--------|-------------|------------|
| View switching | Controlled by local state or basic store read | Controlled by `uiStore.activeView` (already the case, but now respects cross-view navigation) |
| Keyboard shortcuts | None | Global `useEffect` for `⌘[` / `⌘]` (§5.1) |
| Documents view container | Manages list/viewer state locally | Reads `documentViewMode` and `viewingDocumentId` from UI store |

**Updated Documents view container in App.tsx (or DocumentsView.tsx):**

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

The local state is removed. The UI store is the single source of truth for document view mode and which document is being viewed. This enables cross-view navigation (Workflows → Documents) to work by simply setting `documentViewMode` and `viewingDocumentId` in the store.

---

## 8. Edge Cases

### 8.1 Broken References

**Scenario:** An entity ID in a field value (e.g., `depends_on: ['FEAT-DELETED']`) doesn't resolve to any entity in the store.

**Behaviour:**
- `EntityLink` detects the broken reference during render (store lookup returns `null` while store is hydrated).
- Renders as dimmed, struck-through text: `text-muted-foreground/50 line-through cursor-default`.
- Tooltip: `"Entity not found"`.
- Click handler: `handleClick` exits early after `!isResolved` check. No navigation occurs.
- **No error toast, no modal, no console warning.** Broken references are a normal condition — entities may have been deleted, or the reference may point to an entity in a different project.

### 8.2 Circular Supersession

**Scenario:** Document A has `superseded_by: B`, Document B has `superseded_by: A`.

**Behaviour:**
- Each document's metadata panel shows a clickable link to the other.
- Clicking the superseded-by link calls `navigateToDocument(otherId)`, which pushes a history entry and switches the viewer.
- The user can click back and forth between A and B indefinitely.
- Each navigation pushes a history entry. `⌘[` unwinds the stack normally.
- **No cycle detection is needed.** The history stack is bounded at `MAX_HISTORY = 50`, so even pathological clicking won't cause unbounded growth.

### 8.3 Deep Tree Expansion (Plan → Feature → Task)

**Scenario:** `navigateToEntity('TASK-01ABC')` where the task is nested under a feature under a plan.

**Behaviour:**
- The expansion algorithm (§4.1) walks upward: `task.parent_feature` → `feature.parent` → plan.
- Collects both the feature ID and the plan ID into `pathIds`.
- Adds both to `expandedNodeIds` in a **single** `set()` call.
- The tree re-renders once with both ancestors expanded, revealing the task node.
- **No intermediate render** with a partially expanded tree (e.g., plan expanded but feature not).

### 8.4 Navigation During Loading

**Scenario:** The user opens the app, and before the project store finishes loading, they interact with a restored history entry or a link.

**Behaviour:**
- `navigateToEntity` performs a store lookup. If the entity isn't in the store yet (store hydrating), the lookup returns `undefined` and the action returns early (no-op).
- `EntityLink` detects the loading state (`projectPath !== null && plans.size === 0`) and renders as plain text with no click handler.
- Once the store finishes hydrating, React re-renders all `EntityLink` components. They detect the entity in the store and upgrade from loading state to resolved state.
- **No queuing of navigation intents.** The user simply clicks again after loading completes.

### 8.5 View Switch Preserves State

**Scenario:** User is in Documents view with filters active, viewing a specific document. They click an EntityLink that navigates to Workflows. Later, they click the Documents tab to return.

**Behaviour:**
- `navigateToEntity` sets `activeView = 'workflows'` but does **not** modify any Documents view state (`documentViewMode`, `viewingDocumentId`, `documentListScrollTop`, `documentFilters`).
- When the user switches back to Documents (via tab click or cross-view navigation), all Documents state is intact: the same document is shown in the viewer, with the same filters and scroll position.
- This is automatic — Zustand state persists independently of which component is mounted.

### 8.6 Rapid Navigation

**Scenario:** User clicks multiple EntityLinks in quick succession (e.g., scanning through a list of references).

**Behaviour:**
- Each click calls `navigateToEntity` synchronously. Each call updates `selectedEntityId` in the store.
- React batches state updates within the same event loop tick. Only the final `selectedEntityId` value triggers a render.
- The `useEffect` for auto-expansion (§4.1) fires once with the final ID.
- The `scrollIntoView` call uses `requestAnimationFrame`, which coalesces to the latest frame — only the final target is scrolled to.
- **No flicker, no intermediate renders, no race conditions.**

### 8.7 Entity Exists But Parent Chain Is Broken

**Scenario:** A task references a `parent_feature` that doesn't exist in the store (orphaned task).

**Behaviour:**
- `navigateToEntity` succeeds (the task itself exists in `tasks` map).
- The expansion algorithm attempts `tasks.get(id)` → finds the task → reads `task.parent_feature` → `features.get(parent_feature)` returns `undefined`.
- `pathIds` only contains IDs that were successfully looked up. The missing parent is simply not expanded.
- The tree may not show the task if it's only rendered under its parent feature. In this case, the detail panel updates to show the task, but the tree selection highlight may not be visible. This is acceptable — orphaned entities are an unusual data condition.

### 8.8 Document File Missing on Disk

**Scenario:** `navigateToDocument` is called with a valid DocumentRecord ID, but the Markdown file doesn't exist on disk.

**Behaviour:**
- Navigation succeeds — `viewingDocumentId` is set, view switches to Documents viewer.
- `DocumentViewer` calls `readDocument()` which returns a file-not-found error.
- The content area shows "File not found" message (F4 error handling).
- The metadata panel still renders all DocumentRecord fields normally.
- Back navigation works normally.

---

## 9. Implementation Order

Tasks should be implemented in this order. Each task builds on the previous.

| Order | Task | Scope | Estimated Complexity |
|-------|------|-------|---------------------|
| 1 | **UI Store expansion** | Add all new fields, types, and action stubs to `ui-store.ts`. Export `resolveEntityType`. | Medium — foundational |
| 2 | **`navigateToEntity` implementation** | Full action logic including entity lookup, tree expansion path computation, and state update. | Medium |
| 3 | **`navigateToDocument` implementation** | Full action logic including history push, view switch, and `MAX_HISTORY` enforcement. | Medium |
| 4 | **`navigateBack` / `navigateForward` implementation** | Cursor-based history stack navigation. | Small |
| 5 | **`activateFilter` implementation** | Toggle logic for both views, cross-view switch. | Small |
| 6 | **EntityLink wiring** | Replace F3 TreeContext calls with store navigation calls. Add document navigation. | Small |
| 7 | **Tree auto-expansion** | Add `useEffect` in `EntityTree.tsx`. Add `id` attribute to `TreeNode.tsx`. | Small |
| 8 | **Scroll-to-selected** | Add `useEffect` with `requestAnimationFrame` + `scrollIntoView`. | Small |
| 9 | **DocumentViewer wiring** | Remove props, read from store, wire back button. | Small |
| 10 | **DocumentList wiring** | Scroll save/restore, filter state from store, row click → `navigateToDocument`. | Small |
| 11 | **MetadataPanel wiring** | Lozenge `onFilterClick` handlers. EntityLinks are already functional from task 6. | Small |
| 12 | **StatusBadge / TypeBadge `onFilterClick`** | Add optional prop, visual affordance, `e.stopPropagation()`. | Small |
| 13 | **Detail panel lozenge wiring** | Pass `onFilterClick` to all StatusBadge/TypeBadge instances across all detail components. | Small (repetitive) |
| 14 | **Keyboard shortcuts** | `useEffect` in `App.tsx` for `⌘[` / `⌘]`. | Small |
| 15 | **TreeContext migration** | Refactor TreeContext to read/write UI store instead of local state. | Medium — integration |

Tasks 1–5 are sequential (each depends on the store foundation). Tasks 6–14 can be parallelised after task 5.  Task 15 should be done last as it touches the most integration points.

---

## 10. Acceptance Criteria

### Functional Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | **Entity cross-reference navigation:** Clicking an `EntityLink` for `FEAT-01ABC` in the Document Viewer metadata panel switches to Workflows view, selects `FEAT-01ABC` in the tree, and shows its detail panel. | Manual test: open a document with an entity reference in its Owner field. Click the reference. Verify view switch + tree selection + detail panel. |
| AC-2 | **Document cross-reference navigation:** Clicking a document title in a FeatureDetail "Documents" section switches to Documents view and opens the Document Viewer for that document. | Manual test: select a feature with a `design` doc. Click the doc link. Verify view switch + document viewer display. |
| AC-3 | **Status filter activation (same view):** Clicking a status lozenge `[blocked]` in a TaskDetail panel activates "blocked" as a workflow status filter. | Manual test: view a blocked task, click the lozenge, verify filter bar shows the active filter and tree is filtered. |
| AC-4 | **Cross-view filter activation:** Clicking a document type badge `[design]` in a FeatureDetail panel switches to Documents view with the "design" type filter active. | Manual test: view a feature with a design doc, click the type badge, verify switch to Documents view with filter active. |
| AC-5 | **Tree auto-expansion:** Navigating to `TASK-01ABC` (nested under `FEAT-002` under `P1-kbzv`) via an EntityLink auto-expands both `P1-kbzv` and `FEAT-002` in the tree. | Manual test: collapse all tree nodes, navigate to the task from a document. Verify the tree expands to reveal the task. |
| AC-6 | **Tree auto-scroll:** After auto-expansion, the selected node is visible in the tree's scrollable area without manual scrolling. | Manual test: navigate to a task that would be below the fold. Verify the tree scrolls to reveal it. |
| AC-7 | **⌘[ back navigation:** While viewing a document, pressing ⌘[ returns to the document list with the previous scroll position and filters preserved. | Manual test: scroll down in the list, apply a filter, click a doc, press ⌘[. Verify list shows with same scroll position and filter. |
| AC-8 | **⌘] forward navigation:** After pressing ⌘[ to go back, pressing ⌘] returns to the document that was being viewed. | Manual test: view a doc, press ⌘[, press ⌘]. Verify the doc viewer returns. |
| AC-9 | **Scroll position preservation:** Returning from Document Viewer to Document List restores the previous scroll position. | Manual test: scroll to the bottom of a long document list, click a doc, click Back. Verify scroll position is restored. |
| AC-10 | **Superseded document links:** Clicking "Superseded by: doc-v2.md" in a document's metadata panel opens doc-v2.md in the Document Viewer. | Manual test: view a superseded document, click the superseded-by link, verify the successor opens. |
| AC-11 | **Broken references:** An EntityLink for a non-existent ID renders as dimmed struck-through text with "Entity not found" tooltip and does not navigate on click. | Manual test: ensure an entity references a deleted/non-existent ID. Verify dimmed rendering and no-op click. |
| AC-12 | **No confirmation dialogs:** All view switches are immediate. No modals or "are you sure" prompts appear during any navigation action. | Manual test: perform all navigation types, verify no modals appear. |
| AC-13 | **View switch preserves state:** Switching from Documents to Workflows and back preserves the Documents view state (filters, scroll, viewed document). | Manual test: apply filters + scroll in documents, navigate to workflows, click Documents tab. Verify state is preserved. |
| AC-14 | **`e.stopPropagation` on EntityLink:** Clicking an EntityLink inside a tree node navigates to the referenced entity, not the containing tree node. | Manual test: in a TaskDetail showing `depends_on: [TASK-OTHER]`, click `TASK-OTHER`. Verify navigation goes to TASK-OTHER, not re-selecting the parent task. |

### Non-Functional Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| NF-1 | No new files created. All changes are modifications to existing files. | File diff review. |
| NF-2 | Navigation actions complete in < 16ms (one frame budget) — no blocking I/O in the navigation path. | All store reads are synchronous map lookups. `scrollIntoView` is deferred to `requestAnimationFrame`. |
| NF-3 | History stack bounded at 50 entries. | Code review of `MAX_HISTORY` constant and enforcement in `navigateToDocument`. |
| NF-4 | Rapid clicks (10+ in < 1 second) do not cause visual glitches, errors, or unexpected state. | Manual stress test: rapidly click EntityLinks. Verify final state is correct. |

### Checklist

- [ ] Update UIState interface with navigation fields (navigateToEntity, navigateToDocument, activateFilter, goBack, goForward, history stack, expandedNodeIds)
- [ ] Implement navigateToEntity(id) — resolves entity type, switches view, selects entity, expands tree ancestors
- [ ] Implement navigateToDocument(id) — pushes history entry, switches to documents view, opens document viewer
- [ ] Implement activateFilter(view, field, value) — activates the appropriate filter in the target view and switches to it
- [ ] Implement goBack() / goForward() history navigation with scroll and filter state restoration
- [ ] Wire EntityLink.tsx onClick to navigateToEntity and navigateToDocument based on resolved type
- [ ] Implement expandToEntity(id) tree expansion algorithm — walks plan→feature→task ancestry and expands nodes
- [ ] Implement scrollToSelected() — scrolls selected tree node into view using requestAnimationFrame
- [ ] Register ⌘[ / ⌘] keyboard shortcuts in App.tsx for back/forward navigation
- [ ] Wire StatusBadge onClick to activateFilter for workflow status filters
- [ ] Wire TypeBadge onClick to activateFilter for document type filters
- [ ] Update DocumentList.tsx to read scroll position from store and restore on mount
- [ ] Update DocumentViewer.tsx to use navigateBack and viewingDocumentId from store
- [ ] Update MetadataPanel.tsx to use activateFilter and navigateToDocument
- [ ] Update all detail panel components to use navigateToDocument and activateFilter
- [ ] Verify entity cross-reference navigation: EntityLink in Document Viewer switches view and selects entity in tree
- [ ] Verify document cross-reference navigation: doc link in FeatureDetail switches to Documents view and opens viewer
- [ ] Verify tree auto-expansion and auto-scroll when navigating to a nested entity
- [ ] Verify ⌘[ back navigation restores scroll position and filters
- [ ] Verify broken references render as dimmed struck-through text with tooltip and no-op click
- [ ] Verify history stack bounded at 50 entries
- [ ] Verify rapid navigation (10+ clicks < 1s) produces no visual glitches or errors