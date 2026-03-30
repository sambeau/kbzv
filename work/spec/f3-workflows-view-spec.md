# F3: Workflows View — Specification

| Field | Value |
|-------|-------|
| **Feature ID** | FEAT-01KMZA9GFB075 |
| **Slug** | `workflows-view` |
| **Parent Plan** | P1-kbzv |
| **Depends On** | FEAT-01KMZA96W1J98 (F1: App Scaffold + Theme), FEAT-01KMZA9CP9XEX (F2: Data Layer) |
| **Type** | Specification |
| **Source Design** | `work/design/f3-workflows-view.md` |

---

## 1. File Manifest

Every file created or modified by Feature 3, with full paths from the repository root.

### 1.1 New Files

| File | Purpose |
|------|---------|
| `src/views/WorkflowsView.tsx` | Top-level view: composes FilterBar + EntityTree + EntityDetail in a two-column layout |
| `src/components/tree/EntityTree.tsx` | Full tree view; reads store, applies filters, renders Plan→Feature→Task hierarchy + standalone sections |
| `src/components/tree/TreeNode.tsx` | Recursive collapsible node component for Plan/Feature/Task |
| `src/components/tree/TreeContext.tsx` | React context provider for expand/collapse state, selection state, and programmatic navigation |
| `src/components/tree/StandaloneSection.tsx` | Collapsible section for Bugs, Decisions, Incidents, Pending Checkpoints |
| `src/components/tree/StatusDot.tsx` | Tiny coloured circle indicating entity status |
| `src/components/entity/EntityDetail.tsx` | Router component: selects the correct detail component by entity type |
| `src/components/entity/PlanDetail.tsx` | Full detail view for Plan entities |
| `src/components/entity/FeatureDetail.tsx` | Full detail view for Feature entities |
| `src/components/entity/TaskDetail.tsx` | Full detail view for Task entities |
| `src/components/entity/BugDetail.tsx` | Full detail view for Bug entities |
| `src/components/entity/DecisionDetail.tsx` | Full detail view for Decision entities |
| `src/components/entity/CheckpointDetail.tsx` | Full detail view for HumanCheckpoint entities |
| `src/components/entity/IncidentDetail.tsx` | Full detail view for Incident entities |
| `src/components/entity/KnowledgeDetail.tsx` | Full detail view for KnowledgeEntry entities |
| `src/components/entity/FieldValue.tsx` | Polymorphic field renderer (text, timestamp, entity-ref, tag-list, etc.) |
| `src/components/filter/FilterBar.tsx` | Type toggles + status colour toggles + active filter badges |
| `src/components/filter/TypeToggle.tsx` | Single type toggle button with Lucide icon |
| `src/components/filter/StatusColourToggle.tsx` | Single status colour group toggle button |
| `src/components/metrics/ProgressBar.tsx` | Task/feature completion bar with label |
| `src/components/metrics/EstimateDisplay.tsx` | Story point display with rollup |
| `src/components/common/StatusBadge.tsx` | Coloured status lozenge (Badge variant) |
| `src/components/common/EntityLink.tsx` | Clickable entity reference; navigation stubbed for F5 |

### 1.2 Modified Files

| File | Change |
|------|--------|
| `src/components/common/EmptyState.tsx` | Add `variant: "select-entity" \| "project-summary" \| "no-data"` prop; add project-summary rendering |
| `src/lib/store/ui-store.ts` | Add selection state and filter state (§7) |

### 1.3 Consumed (Read-Only) From F2

These files are created by Feature 2. Feature 3 imports from them but does not modify them.

| File | Imports Used |
|------|-------------|
| `src/lib/store/project-store.ts` | `useProjectStore` |
| `src/lib/query/metrics.ts` | `taskCompletionForFeature`, `featureCompletionForPlan`, `estimateRollupForFeature`, `estimateRollupForPlan` |
| `src/lib/query/references.ts` | `resolveEntityType`, `resolveEntity` |
| `src/lib/query/tree.ts` | `TreeNode` type |
| `src/lib/constants/status-colours.ts` | `getStatusColour`, `getStatusHex`, `STATUS_COLOURS`, `StatusColourName` |
| `src/lib/constants/entity-types.ts` | `ENTITY_TYPES`, `EntityTypeInfo` |
| `src/lib/types/index.ts` | All entity type interfaces |

---

## 2. Layout

### 2.1 WorkflowsView.tsx — Container Component

`WorkflowsView` is mounted when the Workflows tab is active in the header. It occupies the full area below the app header.

**Imports:**

```typescript
import { FilterBar } from '@/components/filter/FilterBar';
import { EntityTree } from '@/components/tree/EntityTree';
import { EntityDetail } from '@/components/entity/EntityDetail';
import { TreeProvider } from '@/components/tree/TreeContext';
import { Separator } from '@/components/ui/separator';
import { useUIStore } from '@/lib/store/ui-store';
```

**Props:** None. This is a top-level view component.

**State reads:**

| Store | Field | Purpose |
|-------|-------|---------|
| `useUIStore` | `selectedEntityId` | Current selection for EntityDetail |
| `useUIStore` | `selectedEntityType` | Current selection for EntityDetail |

**JSX structure:**

```tsx
<TreeProvider>
  <div className="flex flex-col h-full overflow-hidden">
    {/* Filter bar — fixed, spans full width */}
    <FilterBar />

    {/* Two-column split below filter bar */}
    <div className="flex flex-1 overflow-hidden">
      {/* Left column — Entity Tree */}
      <div className="w-80 min-w-[280px] overflow-y-auto border-r">
        <EntityTree />
      </div>

      {/* Right column — Entity Detail */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[700px] p-6">
          <EntityDetail
            entityId={selectedEntityId}
            entityType={selectedEntityType}
          />
        </div>
      </div>
    </div>
  </div>
</TreeProvider>
```

**Root element classes:** `flex flex-col h-full overflow-hidden`

### 2.2 Column Dimensions and Responsive Behaviour

| Column | Width | Overflow | Notes |
|--------|-------|----------|-------|
| Entity Tree (left) | `w-80` (320px), `min-w-[280px]` | `overflow-y-auto` | Separated from detail by `border-r` (1px border using shadcn's `border` colour) |
| Entity Detail (right) | `flex-1` | `overflow-y-auto` | Inner content constrained to `max-w-[700px]` for readability, left-aligned via `p-6` padding |

Both columns scroll independently. The filter bar does **not** scroll — it is outside the scrollable area.

---

## 3. Entity Tree Components

### 3.1 EntityTree.tsx — Props, State, Rendering

**Props:** None. Reads all data from Zustand stores.

**Store reads:**

| Store | Field |
|-------|-------|
| `useProjectStore` | `tree`, `bugs`, `decisions`, `incidents`, `pendingCheckpoints`, `plans`, `features`, `tasks` |
| `useUIStore` | `activeTypes`, `activeStatusColours` |

**Internal state:** None (all state lives in `TreeContext` or Zustand stores).

**Rendering logic:**

1. Read `tree: TreeNode[]` from the project store
2. Apply the filter algorithm (§6.3) to produce `filteredTree: TreeNode[]`
3. If `filteredTree` is empty AND all entity maps are empty → render `<EmptyState variant="no-data" />` (§4.11)
4. Otherwise, render:

```tsx
<div className="py-2">
  {/* Plan → Feature → Task hierarchy */}
  {filteredTree.map((planNode) => (
    <TreeNode key={planNode.id} node={planNode} depth={0} />
  ))}

  {/* Standalone sections */}
  {activeTypes.has('bug') && (
    <StandaloneSection
      title="Bugs"
      entityType="bug"
      entities={filteredBugs}
      showStatusDot={true}
    />
  )}

  {activeTypes.has('decision') && (
    <StandaloneSection
      title="Decisions"
      entityType="decision"
      entities={filteredDecisions}
      showStatusDot={false}
    />
  )}

  {activeTypes.has('incident') && (
    <StandaloneSection
      title="Incidents"
      entityType="incident"
      entities={filteredIncidents}
      showStatusDot={true}
    />
  )}

  {activeTypes.has('checkpoint') && filteredPendingCheckpoints.length > 0 && (
    <StandaloneSection
      title="Pending Checkpoints"
      entityType="checkpoint"
      entities={filteredPendingCheckpoints}
      showStatusDot={false}
      variant="pending-checkpoint"
    />
  )}
</div>
```

**Sorting (applied before rendering):**

| Level | Sort Rule |
|-------|-----------|
| Plans (root nodes) | By prefix letter + number: extract via `/^([A-Z])(\d+)-/`, sort by `[letter, number]` numerically. Fallback: raw ID lexicographic. |
| Features within a Plan | Lexicographic by `id` (TSID13 gives chronological creation order) |
| Tasks within a Feature | Lexicographic by `id` (creation order) |
| Standalone Bugs | Lexicographic by `id` |
| Standalone Decisions | Lexicographic by `id` |
| Standalone Incidents | Lexicographic by `id` |
| Pending Checkpoints | By `created` field, **descending** (newest first) |

### 3.2 TreeNode.tsx — Props, Rendering per Entity Type, Expand/Collapse

**Props interface:**

```typescript
interface TreeNodeProps {
  node: TreeNode;   // from src/lib/query/tree.ts
  depth: number;    // 0 = plan, 1 = feature, 2 = task
}
```

**Context consumption:**

```typescript
const { expandedNodes, selectedEntity, toggleExpand, select } = useTreeContext();
```

**Derived values:**

```typescript
const isExpanded = expandedNodes.has(node.id);
const isSelected = selectedEntity === node.id;
const hasChildren = node.children.length > 0;
const isGhost = node._ghost === true; // set by filter algorithm
```

**JSX structure:**

```tsx
<div>
  {/* This node's row */}
  <button
    className={cn(
      'flex items-center gap-1.5 w-full text-left py-1 px-2 rounded-md text-sm',
      'hover:bg-accent/50 cursor-pointer',
      isSelected && 'bg-accent',
      isGhost && 'opacity-50 pointer-events-none',
      depth === 0 && 'pl-2',
      depth === 1 && 'pl-6',
      depth === 2 && 'pl-10',
    )}
    onClick={() => !isGhost && select(node.id, node.entityType)}
  >
    {/* Chevron — only for nodes with children */}
    {hasChildren ? (
      <span
        className="shrink-0"
        onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
      >
        <ChevronRight
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-90',
          )}
        />
      </span>
    ) : (
      <span className="w-4 shrink-0" /> /* spacer for alignment */
    )}

    {/* Status dot */}
    <StatusDot status={entity.status} />

    {/* Entity ID */}
    <span className="font-semibold font-mono shrink-0">
      {node.id}
    </span>

    {/* Summary / label / title — truncated */}
    <span className="font-normal text-muted-foreground truncate">
      {displayText}
    </span>
  </button>

  {/* Children — rendered only when expanded */}
  {hasChildren && isExpanded && (
    <div>
      {node.children.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )}
</div>
```

**Display text per entity type:**

| Entity Type | Display Text Source |
|-------------|-------------------|
| `plan` | `(entity as Plan).title` |
| `feature` | `(entity as Feature).label ?? (entity as Feature).slug ?? (entity as Feature).summary` |
| `task` | `(entity as Task).label ?? (entity as Task).slug ?? (entity as Task).summary` |

**Row classes by depth:**

| Depth | Left Padding Class | Description |
|-------|--------------------|-------------|
| 0 | `pl-2` | Plan nodes (8px left pad) |
| 1 | `pl-6` | Feature nodes (24px = 8 + 16) |
| 2 | `pl-10` | Task nodes (40px = 8 + 32) |

**Interaction specification:**

| Action | Trigger | Effect |
|--------|---------|--------|
| Select entity | Click anywhere on the row | Calls `select(node.id, node.entityType)`. Sets `selectedEntityId` and `selectedEntityType` in UI store. Detail panel updates. |
| Toggle expand | Click the chevron icon specifically | Calls `toggleExpand(node.id)`. Adds or removes `node.id` from `expandedNodes` set. Does **not** change selection. |
| Hover | Mouse enters row | `bg-accent/50` background applied via hover state |
| Ghost node | Row rendered with `opacity-50` | `pointer-events-none` — no click, no hover |

**Initial expand state:** On mount, the first Plan node in the tree is expanded. All other nodes start collapsed.

### 3.3 TreeContext.tsx — Context Value, Provider, Consumer Hook

**Context value interface:**

```typescript
interface TreeContextValue {
  expandedNodes: Set<string>;
  selectedEntity: string | null;
  selectedType: string | null;
  toggleExpand: (id: string) => void;
  expandTo: (id: string) => void;
  select: (id: string, type: string) => void;
}
```

**Provider implementation:**

```typescript
export function TreeProvider({ children }: { children: React.ReactNode }) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const { selectEntity, selectedEntityId, selectedEntityType } = useUIStore();
  const { tree, features, tasks } = useProjectStore();

  // On initial mount, expand the first plan
  useEffect(() => {
    if (tree.length > 0) {
      setExpandedNodes(new Set([tree[0].id]));
    }
  }, [tree]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandTo = useCallback((id: string) => {
    // Walk the entity's parent chain and expand each ancestor
    // 1. Determine entity type from ID prefix
    // 2. If task: find parent feature, find parent plan → expand both
    // 3. If feature: find parent plan → expand it
    // 4. If plan: already at root level
    // 5. Scroll the target node into view (via ref or DOM query)
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      // ... add all ancestor IDs to `next`
      return next;
    });
  }, [features, tasks]);

  const select = useCallback((id: string, type: string) => {
    selectEntity(id, type);
  }, [selectEntity]);

  return (
    <TreeContext.Provider value={{
      expandedNodes,
      selectedEntity: selectedEntityId,
      selectedType: selectedEntityType,
      toggleExpand,
      expandTo,
      select,
    }}>
      {children}
    </TreeContext.Provider>
  );
}
```

**`expandTo` algorithm detail:**

```
expandTo(targetId):
  1. type = resolveEntityType(targetId)
  2. ancestors = []
  3. if type === 'task':
       task = tasks.get(targetId)
       if task:
         ancestors.push(task.parent_feature)
         feature = features.get(task.parent_feature)
         if feature:
           ancestors.push(feature.parent)
  4. if type === 'feature':
       feature = features.get(targetId)
       if feature:
         ancestors.push(feature.parent)
  5. Add all `ancestors` to expandedNodes
  6. After state update, query DOM for `[data-entity-id="${targetId}"]`
     and call `element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`
```

**Consumer hook:**

```typescript
export function useTreeContext(): TreeContextValue {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error('useTreeContext must be used within a TreeProvider');
  return ctx;
}
```

### 3.4 Standalone Sections (Bugs, Decisions, Incidents, Checkpoints)

**StandaloneSection props interface:**

```typescript
interface StandaloneSectionProps {
  title: string;
  entityType: string;
  entities: Array<{ id: string; status: string; displayText: string }>;
  showStatusDot: boolean;
  variant?: 'default' | 'pending-checkpoint';
}
```

**Display text derivation per standalone type:**

| Entity Type | displayText |
|-------------|-------------|
| `bug` | `(entity as Bug).title` |
| `decision` | `(entity as Decision).summary` |
| `incident` | `(entity as Incident).title` |
| `checkpoint` | `(entity as HumanCheckpoint).question` (truncated) |

**Rendering:**

```tsx
<div className={cn(
  'mt-4',
  variant === 'pending-checkpoint' && 'bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-400 rounded-r-md',
)}>
  {/* Header row */}
  <button
    className={cn(
      'flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-muted-foreground',
      variant === 'pending-checkpoint' && 'text-orange-700 dark:text-orange-300',
    )}
    onClick={() => !forceOpen && toggleOpen()}
    disabled={forceOpen}
  >
    {!forceOpen && (
      <ChevronRight className={cn(
        'w-4 h-4 transition-transform duration-200',
        isOpen && 'rotate-90',
      )} />
    )}
    <span>{title}</span>
    {entities.length > 0 && (
      <Badge variant="secondary" className="text-xs px-1.5 py-0">
        {entities.length}
      </Badge>
    )}
  </button>

  {/* Content — list of entity rows */}
  {isOpen && (
    <div className="pb-1">
      {entities.length === 0 ? (
        <div className="px-6 py-1 text-sm text-muted-foreground italic">
          (none)
        </div>
      ) : (
        entities.map((entity) => (
          <button
            key={entity.id}
            className={cn(
              'flex items-center gap-1.5 w-full text-left py-1 px-6 rounded-md text-sm',
              'hover:bg-accent/50 cursor-pointer',
              isSelected(entity.id) && 'bg-accent',
              variant === 'pending-checkpoint' && 'bg-orange-50/50 dark:bg-orange-950/50',
            )}
            onClick={() => select(entity.id, entityType)}
          >
            {/* Icon / Status dot */}
            {variant === 'pending-checkpoint' ? (
              <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
            ) : showStatusDot ? (
              <StatusDot status={entity.status} />
            ) : null}

            {/* Entity ID */}
            <span className="font-semibold font-mono shrink-0">{entity.id}</span>

            {/* Display text — truncated */}
            <span className="text-muted-foreground truncate">{entity.displayText}</span>
          </button>
        ))
      )}
    </div>
  )}
</div>
```

**Section visibility and collapsibility rules:**

| Section | Visible When | Default State | Collapsible |
|---------|-------------|---------------|-------------|
| Bugs | `activeTypes.has('bug')` is true | Collapsed | Yes |
| Decisions | `activeTypes.has('decision')` is true | Collapsed | Yes |
| Incidents | `activeTypes.has('incident')` is true | Collapsed | Yes |
| Pending Checkpoints | `activeTypes.has('checkpoint')` is true **AND** `entities.length > 0` | **Always expanded** | **No** (`forceOpen = true`) |

**Pending Checkpoints special styling:**

| Element | Classes |
|---------|---------|
| Section container | `bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-400 rounded-r-md` |
| Each row | `bg-orange-50/50 dark:bg-orange-950/50` |
| Icon per row | `AlertTriangle` from Lucide, `w-4 h-4 text-orange-500` (replaces StatusDot) |
| Header text | `text-orange-700 dark:text-orange-300` |

**Section header separator:** Each section is visually separated by the `mt-4` margin on its container. No explicit `Separator` component is needed between sections.

---

## 4. Entity Detail Components

### 4.1 EntityDetail.tsx — Router Component

**Props interface:**

```typescript
interface EntityDetailProps {
  entityId: string | null;
  entityType: string | null;
}
```

**Behaviour:**

1. If `entityId === null` → render `<DefaultState />` (§4.11)
2. Look up entity via `resolveEntity(entityId, projectState)` from `src/lib/query/references.ts`
3. If `resolveEntity` returns `null` → render error state:
   ```tsx
   <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
     <AlertCircle className="w-8 h-8" />
     <p className="text-sm">Entity not found: <code className="font-mono">{entityId}</code></p>
   </div>
   ```
4. Switch on resolved `entityType` and render the appropriate component:

**Type → Component → Icon mapping:**

| `entityType` | Component | Lucide Icon Import | Icon Name |
|-------------|-----------|-------------------|-----------|
| `plan` | `<PlanDetail entity={entity} />` | `Map` | `Map` |
| `feature` | `<FeatureDetail entity={entity} />` | `Puzzle` | `Puzzle` |
| `task` | `<TaskDetail entity={entity} />` | `CheckSquare` | `CheckSquare` |
| `bug` | `<BugDetail entity={entity} />` | `Bug` | `Bug` |
| `decision` | `<DecisionDetail entity={entity} />` | `Scale` | `Scale` |
| `checkpoint` | `<CheckpointDetail entity={entity} />` | `CircleHelp` | `CircleHelp` |
| `incident` | `<IncidentDetail entity={entity} />` | `AlertOctagon` | `AlertOctagon` |
| `knowledge` | `<KnowledgeDetail entity={entity} />` | `Lightbulb` | `Lightbulb` |
| Unknown type | Generic fallback rendering all fields as key-value pairs | `HelpCircle` | `HelpCircle` |

**Root element classes:** none — the detail components handle their own root styling.

### 4.2 PlanDetail.tsx — Exact Field Layout

**Props:**

```typescript
interface PlanDetailProps {
  entity: Plan;
}
```

**Rendering order:**

```tsx
<div className="space-y-6">
  {/* Header */}
  <DetailHeader
    icon={Map}
    entityId={entity.id}
    summary={entity.title}
    status={entity.status}
  />

  {/* Fields — only rendered when value is populated */}
  <FieldValue label="Summary"      value={entity.summary}        type="long-text" />
  <FieldValue label="Slug"         value={entity.slug}           type="text" className="text-xs text-muted-foreground" />
  <FieldValue label="Design"       value={entity.design}         type="entity-ref" />
  <FieldValue label="Tags"         value={entity.tags}           type="tag-list" />
  <FieldValue label="Created"      value={entity.created}        type="timestamp" />
  <FieldValue label="Created By"   value={entity.created_by}     type="text" />
  <FieldValue label="Updated"      value={entity.updated}        type="timestamp" />
  <FieldValue label="Supersedes"   value={entity.supersedes}     type="entity-ref" />
  <FieldValue label="Superseded By" value={entity.superseded_by} type="entity-ref" />

  {/* Related: Features with progress */}
  <RelatedEntitiesSection title="Features">
    <ProgressBar
      done={featureMetrics.done}
      total={featureMetrics.total}
      percentage={featureMetrics.percentage}
      label="Features"
    />
    {planFeatures.map((f) => (
      <RelatedEntityRow key={f.id} entityId={f.id} summary={f.summary} status={f.status} />
    ))}
  </RelatedEntitiesSection>

  {/* Related: Documents */}
  <RelatedEntitiesSection title="Documents">
    {planDocuments.map((d) => (
      <RelatedEntityRow key={d.id} entityId={d.id} summary={d.title} status={d.status} />
    ))}
  </RelatedEntitiesSection>

  {/* Estimate rollup */}
  <EstimateDisplay rollup={planEstimate} />
</div>
```

**Computed data:**

| Variable | Computation |
|----------|-------------|
| `planFeatures` | `[...features.values()].filter(f => f.parent === entity.id)`, sorted by ID |
| `featureMetrics` | `featureCompletionForPlan(entity.id, features)` |
| `planDocuments` | `[...documents.values()].filter(d => d.owner === entity.id)`, sorted by title |
| `planEstimate` | `estimateRollupForPlan(entity.id, features)` |

**Field table (ordered):**

| # | Field | FieldValue Type | Condition |
|---|-------|-----------------|-----------|
| 1 | `status` | `status` | Always (in header) |
| 2 | `title` | — | Always (in header as summary text) |
| 3 | `summary` | `long-text` | When populated |
| 4 | `slug` | `text` | When populated |
| 5 | `design` | `entity-ref` | When populated |
| 6 | `tags` | `tag-list` | When array non-empty |
| 7 | `created` | `timestamp` | Always |
| 8 | `created_by` | `text` | Always |
| 9 | `updated` | `timestamp` | Always |
| 10 | `supersedes` | `entity-ref` | When populated |
| 11 | `superseded_by` | `entity-ref` | When populated |

### 4.3 FeatureDetail.tsx — Exact Field Layout

**Props:**

```typescript
interface FeatureDetailProps {
  entity: Feature;
}
```

**Field table (ordered):**

| # | Field | FieldValue Type | Condition |
|---|-------|-----------------|-----------|
| 1 | `status` | `status` | Always (in header) |
| 2 | `summary` | — | Always (in header) |
| 3 | `parent` | `entity-ref` | Always |
| 4 | `slug` | `text` | When populated |
| 5 | `estimate` | `number` | Render as `"{value} pts"` or `"unestimated"` |
| 6 | `design` | `entity-ref` | When populated |
| 7 | `spec` | `entity-ref` | When populated |
| 8 | `dev_plan` | `entity-ref` | When populated |
| 9 | `tags` | `tag-list` | When array non-empty |
| 10 | `branch` | `text` | When populated; render with `font-mono` |
| 11 | `supersedes` | `entity-ref` | When populated |
| 12 | `superseded_by` | `entity-ref` | When populated |
| 13 | `created` | `timestamp` | Always |
| 14 | `created_by` | `text` | Always |
| 15 | `updated` | `timestamp` | Always |

**Related entities sections (after fields):**

| Section | Content | Header | Sort |
|---------|---------|--------|------|
| Tasks | All tasks where `task.parent_feature === entity.id` | `ProgressBar` with `taskCompletionForFeature()` | By ID (lexicographic) |
| Documents | All documents where `document.owner === entity.id` | "Documents" | By title |
| Linked Bugs | All bugs where `bug.origin_feature === entity.id` | "Linked Bugs" | By ID |
| Linked Decisions | All decisions where `entity.id` is in `decision.affects[]` | "Decisions" | By ID |

**Estimate rollup:** `estimateRollupForFeature(entity.id, tasks)` — rendered via `<EstimateDisplay>`.

### 4.4 TaskDetail.tsx — Exact Field Layout

**Props:**

```typescript
interface TaskDetailProps {
  entity: Task;
}
```

**Field table (ordered):**

| # | Field | FieldValue Type | Condition |
|---|-------|-----------------|-----------|
| 1 | `status` | `status` | Always (in header) |
| 2 | `summary` | — | Always (in header) |
| 3 | `parent_feature` | `entity-ref` | Always |
| 4 | `slug` | `text` | When populated |
| 5 | `estimate` | `number` | Render as `"{value} pts"` or `"unestimated"` |
| 6 | `assignee` | `text` | When populated |
| 7 | `depends_on` | `entity-ref-list` | When array non-empty |
| 8 | `files_planned` | `string-list` | When array non-empty |
| 9 | `started` | `timestamp` | When populated |
| 10 | `completed` | `timestamp` | When populated |
| 11 | `claimed_at` | `timestamp` | When populated |
| 12 | `dispatched_to` | `text` | When populated |
| 13 | `dispatched_at` | `timestamp` | When populated |
| 14 | `dispatched_by` | `text` | When populated |
| 15 | `completion_summary` | `long-text` | When populated |
| 16 | `rework_reason` | `long-text` | When populated |
| 17 | `verification` | `long-text` | When populated |
| 18 | `tags` | `tag-list` | When array non-empty |

**Related entities sections (after fields):**

| Section | Content | Sort |
|---------|---------|------|
| Dependents | All tasks where this task's ID appears in their `depends_on[]` | By ID |
| Linked Bugs | All bugs where `bug.origin_task === entity.id` | By ID |

### 4.5 BugDetail.tsx — Exact Field Layout

**Props:**

```typescript
interface BugDetailProps {
  entity: Bug;
}
```

**Field table (ordered):**

| # | Field | FieldValue Type | Condition |
|---|-------|-----------------|-----------|
| 1 | `status` | `status` | Always (in header) |
| 2 | `title` | — | Always (in header as summary) |
| 3 | `severity` | `severity` | Always |
| 4 | `priority` | `priority` | Always |
| 5 | `type` | `text` | Always; rendered as `Badge` with neutral styling |
| 6 | `slug` | `text` | When populated |
| 7 | `estimate` | `number` | When populated |
| 8 | `reported_by` | `text` | Always |
| 9 | `reported` | `timestamp` | When populated |
| 10 | `observed` | `long-text` | Always |
| 11 | `expected` | `long-text` | Always |
| 12 | `affects` | `entity-ref-list` | When array non-empty |
| 13 | `origin_feature` | `entity-ref` | When populated |
| 14 | `origin_task` | `entity-ref` | When populated |
| 15 | `environment` | `text` | When populated |
| 16 | `reproduction` | `long-text` | When populated |
| 17 | `duplicate_of` | `entity-ref` | When populated |
| 18 | `fixed_by` | `text` | When populated |
| 19 | `verified_by` | `text` | When populated |
| 20 | `release_target` | `text` | When populated |
| 21 | `tags` | `tag-list` | When array non-empty |

### 4.6 DecisionDetail.tsx — Exact Field Layout

**Props:**

```typescript
interface DecisionDetailProps {
  entity: Decision;
}
```

**Field table (ordered):**

| # | Field | FieldValue Type | Condition |
|---|-------|-----------------|-----------|
| 1 | `status` | `status` | Always (in header) |
| 2 | `summary` | — | Always (in header) |
| 3 | `rationale` | `long-text` | Always — primary content field |
| 4 | `decided_by` | `text` | Always |
| 5 | `date` | `timestamp` | When populated |
| 6 | `affects` | `entity-ref-list` | When array non-empty |
| 7 | `supersedes` | `entity-ref` | When populated |
| 8 | `superseded_by` | `entity-ref` | When populated |
| 9 | `tags` | `tag-list` | When array non-empty |

### 4.7 CheckpointDetail.tsx — Exact Field Layout

**Props:**

```typescript
interface CheckpointDetailProps {
  entity: HumanCheckpoint;
}
```

**Field table (ordered):**

| # | Field | FieldValue Type | Condition |
|---|-------|-----------------|-----------|
| 1 | `status` | `status` | Always (in header) |
| 2 | `question` | `long-text` | Always — **never collapsed**, full text visible regardless of length |
| 3 | `context` | `long-text` | When populated — collapsible |
| 4 | `orchestration_summary` | `long-text` | When populated — collapsible |
| 5 | `created_by` | `text` | Always |
| 6 | `response` | `long-text` | Only when `status === "responded"` — **never collapsed** |
| 7 | `created` | `timestamp` | Always |
| 8 | `responded_at` | `timestamp` | Only when `status === "responded"` |

**Special styling for pending status:**

When `entity.status === "pending"`, the detail header wrapper receives additional classes:

```
bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-400 rounded-r-md p-4
```

This matches the orange highlight treatment used in the tree's Pending Checkpoints section.

### 4.8 IncidentDetail.tsx — Exact Field Layout

**Props:**

```typescript
interface IncidentDetailProps {
  entity: Incident;
}
```

**Field table (ordered):**

| # | Field | FieldValue Type | Condition |
|---|-------|-----------------|-----------|
| 1 | `status` | `status` | Always (in header) |
| 2 | `title` | — | Always (in header) |
| 3 | `severity` | `severity` | Always |
| 4 | `summary` | `long-text` | Always |
| 5 | `reported_by` | `text` | Always |
| 6 | `detected_at` | `timestamp` | When populated |
| 7 | `triaged_at` | `timestamp` | When populated |
| 8 | `mitigated_at` | `timestamp` | When populated |
| 9 | `resolved_at` | `timestamp` | When populated |
| 10 | `affected_features` | `entity-ref-list` | When array non-empty |
| 11 | `linked_bugs` | `entity-ref-list` | When array non-empty |
| 12 | `linked_rca` | `entity-ref` | When populated |

### 4.9 KnowledgeDetail.tsx — Exact Field Layout

**Props:**

```typescript
interface KnowledgeDetailProps {
  entity: KnowledgeEntry;
}
```

**Field table (ordered):**

| # | Field | FieldValue Type | Condition |
|---|-------|-----------------|-----------|
| 1 | `status` | `status` | Always (in header) |
| 2 | `topic` | — | Always (in header as summary) |
| 3 | `content` | `long-text` | Always — **never collapsed**, full text visible |
| 4 | `tier` | `text` | Always; rendered as Badge: `"Tier 2 (project)"` or `"Tier 3 (session)"` |
| 5 | `scope` | `text` | Always |
| 6 | `learned_from` | `entity-ref` | When populated |
| 7 | `use_count` | `number` | When populated |
| 8 | `miss_count` | `number` | When populated |
| 9 | `confidence` | `number` | When populated; formatted as percentage: `0.85` → `"85%"` |
| 10 | `ttl_days` | `number` | When populated; rendered with `"days"` suffix |
| 11 | `git_anchors` | `string-list` | When array non-empty |
| 12 | `tags` | `tag-list` | When array non-empty |
| 13 | `created` | `timestamp` | Always |
| 14 | `created_by` | `text` | Always |
| 15 | `updated` | `timestamp` | Always |

### 4.10 FieldValue.tsx — Polymorphic Field Renderer

**Props interface:**

```typescript
type FieldValueType =
  | string
  | number
  | string[]
  | null
  | undefined;

interface FieldValueProps {
  label: string;
  value: FieldValueType;
  type:
    | 'text'
    | 'timestamp'
    | 'entity-ref'
    | 'entity-ref-list'
    | 'tag-list'
    | 'string-list'
    | 'long-text'
    | 'number'
    | 'severity'
    | 'priority'
    | 'status';
  className?: string;
}
```

**Absent-field rule:** If `value` is `undefined`, `null`, `""` (empty string), or `[]` (empty array), the entire `FieldValue` component returns `null`. It renders nothing. The detail panel only shows populated fields.

**Root element structure:**

```tsx
<div className="space-y-1">
  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
    {label}
  </dt>
  <dd>
    {/* Rendered value — varies by type */}
  </dd>
</div>
```

**Rendering by `type`:**

| `type` | Rendered Output | Element Classes |
|--------|----------------|-----------------|
| `text` | Plain text span | `text-sm` |
| `timestamp` | Relative time string (e.g., "3 days ago") via `formatDistanceToNow(new Date(value), { addSuffix: true })` from `date-fns`. Full RFC 3339 string shown in a shadcn `Tooltip` on hover. | `text-sm text-muted-foreground` |
| `entity-ref` | `<EntityLink entityId={value} />` | — (EntityLink handles its own styling) |
| `entity-ref-list` | `<div className="flex flex-wrap gap-1.5">` containing one `<EntityLink>` per item | Container: `flex flex-wrap gap-1.5` |
| `tag-list` | `<div className="flex flex-wrap gap-1">` containing one `<Badge variant="secondary">` per tag. Each badge: `bg-secondary text-secondary-foreground text-xs`. | Container: `flex flex-wrap gap-1` |
| `string-list` | `<div className="flex flex-wrap gap-1">` containing one `<Badge variant="outline">` per item. | Container: `flex flex-wrap gap-1`; Badge: `text-xs font-mono` |
| `long-text` | First 3 lines visible. If content exceeds 3 lines, a shadcn `Collapsible` wraps it with a "Show more" / "Show less" toggle below. | `text-sm whitespace-pre-wrap font-mono` |
| `number` | Plain text span | `text-sm font-mono` |
| `severity` | `<Badge>` with colour by value | See severity/priority colour table below |
| `priority` | `<Badge>` with colour by value | See severity/priority colour table below |
| `status` | `<StatusBadge status={value} />` | — (StatusBadge handles its own styling) |

**Severity / Priority Badge colours:**

| Value | Badge Classes |
|-------|--------------|
| `critical` | `bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300` |
| `high` | `bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300` |
| `medium` | `bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300` |
| `low` | `bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300` |

**`long-text` collapsible detail:**

```tsx
function LongTextValue({ value }: { value: string }) {
  const lines = value.split('\n');
  const needsCollapse = lines.length > 3;
  const [isOpen, setIsOpen] = useState(false);

  if (!needsCollapse) {
    return (
      <pre className="text-sm whitespace-pre-wrap font-mono">{value}</pre>
    );
  }

  const preview = lines.slice(0, 3).join('\n');

  return (
    <div>
      <pre className="text-sm whitespace-pre-wrap font-mono">
        {isOpen ? value : preview + '…'}
      </pre>
      <button
        className="text-xs text-primary hover:underline mt-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}
```

**Exception fields that are never collapsed** (the `long-text` type is used, but collapsing is disabled):
- `CheckpointDetail.question`
- `CheckpointDetail.response`
- `KnowledgeDetail.content`

These are rendered with the same `text-sm whitespace-pre-wrap font-mono` classes but without the `Collapsible` wrapper. This is controlled by passing an optional `alwaysExpanded` prop to `FieldValue`:

```typescript
// Additional optional prop
interface FieldValueProps {
  // ... existing props ...
  alwaysExpanded?: boolean; // For long-text: skip collapsible, show full text
}
```

### 4.11 Empty / Default State

**Two variants, selected by context:**

**Variant A — Project Summary (default when project is loaded):**

Rendered when `entityId === null` and the project store has data.

```tsx
<div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
  <LayoutDashboard className="w-12 h-12 text-muted-foreground/50" />

  <p className="text-sm">
    {planCount} Plans · {featureCount} Features · {taskCount} Tasks
  </p>

  <div className="w-48">
    <ProgressBar
      done={overallDone}
      total={overallTotal}
      percentage={overallPercentage}
      label="Overall"
    />
  </div>

  <p className="text-sm">
    {bugCount} Bugs · {decisionCount} Decisions · {incidentCount} Incidents
  </p>

  {pendingCheckpointCount > 0 && (
    <p className="text-sm text-orange-500 font-semibold">
      {pendingCheckpointCount} Pending Checkpoint{pendingCheckpointCount !== 1 ? 's' : ''}
    </p>
  )}
</div>
```

**Counts derivation:**

| Variable | Source |
|----------|--------|
| `planCount` | `plans.size` |
| `featureCount` | `features.size` |
| `taskCount` | `tasks.size` |
| `bugCount` | `bugs.size` |
| `decisionCount` | `decisions.size` |
| `incidentCount` | `incidents.size` |
| `pendingCheckpointCount` | `pendingCheckpoints.length` |
| `overallDone` / `overallTotal` | Iterate all tasks, count `done` vs total (excluding `not-planned`, `duplicate`) |
| `overallPercentage` | `overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0` |

**Variant B — Select Entity (transient, pre-load):**

Rendered when `entityId === null` and no project data is loaded.

```tsx
<div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
  <MousePointerClick className="w-12 h-12 text-muted-foreground/50" />
  <p className="text-sm">Select an entity to view details</p>
</div>
```

**Detail Header component (shared by all detail views):**

```typescript
interface DetailHeaderProps {
  icon: LucideIcon;
  entityId: string;
  summary: string;
  status: string;
  className?: string; // For special styling (e.g., checkpoint pending)
}
```

```tsx
function DetailHeader({ icon: Icon, entityId, summary, status, className }: DetailHeaderProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
        <h2 className="text-lg font-bold font-mono">{entityId}</h2>
      </div>
      <p className="text-base text-muted-foreground">{summary}</p>
      <StatusBadge status={status} />
    </div>
  );
}
```

**Related entities section (shared helper):**

```tsx
function RelatedEntitiesSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Separator />
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}
```

**Related entity row (shared helper):**

```tsx
function RelatedEntityRow({ entityId, summary, status }: {
  entityId: string;
  summary: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <EntityLink entityId={entityId} />
      <span className="text-sm text-muted-foreground truncate">{summary}</span>
      <StatusDot status={status} className="ml-auto shrink-0" />
    </div>
  );
}
```

---

## 5. Common Components

### 5.1 StatusBadge.tsx — Exact Colour Classes per Status

**Props interface:**

```typescript
interface StatusBadgeProps {
  status: string;
  className?: string;
}
```

**Rendering:** A shadcn `Badge` component. The status string is displayed as-is — lowercase, hyphenated (e.g., `"needs-review"`). No transformation to title case.

```tsx
function StatusBadge({ status, className }: StatusBadgeProps) {
  const colour = getStatusColour(status);
  return (
    <Badge
      className={cn(
        STATUS_BADGE_STYLES[colour],
        'cursor-pointer',
        className,
      )}
      onClick={() => activateStatusFilter(status)}
    >
      {status}
    </Badge>
  );
}
```

**Exact Tailwind classes per colour group:**

| Colour Group | `STATUS_BADGE_STYLES` Value |
|-------------|----------------------------|
| `grey` | `bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300` |
| `blue` | `bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300` |
| `yellow` | `bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300` |
| `orange` | `bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300` |
| `green` | `bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300` |
| `red` | `bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300` |
| `purple` | `bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300` |

**Full status → colour mapping (via `getStatusColour` from F2):**

| Status String | Colour Group |
|--------------|-------------|
| `proposed` | grey |
| `queued` | grey |
| `draft` | grey |
| `designing` | blue |
| `specifying` | blue |
| `dev-planning` | blue |
| `ready` | blue |
| `planned` | blue |
| `contributed` | blue |
| `active` | yellow |
| `in-progress` | yellow |
| `investigating` | yellow |
| `developing` | yellow |
| `blocked` | orange |
| `needs-review` | orange |
| `needs-rework` | orange |
| `disputed` | orange |
| `pending` | orange |
| `done` | green |
| `closed` | green |
| `verified` | green |
| `approved` | green |
| `accepted` | green |
| `confirmed` | green |
| `resolved` | green |
| `cancelled` | red |
| `not-planned` | red |
| `rejected` | red |
| `duplicate` | red |
| `retired` | red |
| `cannot-reproduce` | red |
| `superseded` | purple |
| *(any unknown)* | grey |

**Click behaviour:** Clicking a `StatusBadge` in the detail panel calls `useUIStore().activateStatusFilter(status)`, which enables only that status's colour group and turns off all others.

### 5.2 StatusDot.tsx — Exact Colour Classes per Status

**Props interface:**

```typescript
interface StatusDotProps {
  status: string;
  className?: string;
}
```

**Rendering:**

```tsx
function StatusDot({ status, className }: StatusDotProps) {
  const hex = getStatusHex(status);
  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full shrink-0', className)}
      style={{ backgroundColor: hex }}
      title={status}
    />
  );
}
```

**Exact hex values per colour (from `STATUS_COLOURS` constant in F2):**

| Colour Group | Hex Value |
|-------------|-----------|
| grey | `#9CA3AF` |
| blue | `#3B82F6` |
| yellow | `#EAB308` |
| orange | `#F97316` |
| green | `#22C55E` |
| red | `#EF4444` |
| purple | `#A855F7` |

**Dimensions:** `w-2 h-2` = 8×8 CSS pixels, `rounded-full` = circle.

The dot uses the solid hex value directly (via inline `style`), not the tinted background classes used by `StatusBadge`.

### 5.3 EntityLink.tsx — Rendering States, Click Behaviour

**Props interface:**

```typescript
interface EntityLinkProps {
  entityId: string;
  className?: string;
}
```

**Resolution algorithm:**

1. Call `resolveEntityType(entityId)` to determine entity type from ID prefix
2. Call `resolveEntity(entityId, projectState)` to look up the entity

**ID prefix → entity type mapping (from F2 `resolveEntityType`):**

| Prefix Pattern | Entity Type |
|---------------|-------------|
| `FEAT-` | `feature` |
| `TASK-` | `task` |
| `BUG-` | `bug` |
| `DEC-` | `decision` |
| `KE-` | `knowledge` |
| `INC-` | `incident` |
| `CHK-` | `checkpoint` |
| Contains `/` | `document` |
| Matches `/^[A-Z]\d+-/` | `plan` |
| *(no match)* | `null` |

**Rendering — two states:**

**State 1: Found (entity exists in store):**

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <button
      className={cn(
        'text-primary underline-offset-4 hover:underline cursor-pointer font-mono text-sm',
        className,
      )}
      onClick={handleClick}
    >
      {entityId}
    </button>
  </TooltipTrigger>
  <TooltipContent>
    <p>{entitySummary}</p>
  </TooltipContent>
</Tooltip>
```

Where `entitySummary` is:
- Plan: `entity.title`
- Feature: `entity.summary`
- Task: `entity.summary`
- Bug: `entity.title`
- Decision: `entity.summary`
- Incident: `entity.title`
- Checkpoint: `entity.question` (truncated to 80 chars)
- Knowledge: `entity.topic`
- Document: `entity.title`

**State 2: Not found (broken reference):**

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span
      className={cn(
        'text-muted-foreground/50 line-through cursor-default font-mono text-sm',
        className,
      )}
    >
      {entityId}
    </span>
  </TooltipTrigger>
  <TooltipContent>
    <p>Entity not found</p>
  </TooltipContent>
</Tooltip>
```

**Click behaviour (F3):**

```typescript
function handleClick() {
  const type = resolveEntityType(entityId);
  if (!type) return;

  // Document links are no-ops until F5 wires cross-view navigation
  if (type === 'document') return;

  // For all other entity types: select in tree and expand ancestors
  const { select } = useTreeContext();
  const { expandTo } = useTreeContext();
  expandTo(entityId);
  select(entityId, type);
}
```

### 5.4 ProgressBar.tsx — Exact Rendering

**Props interface:**

```typescript
interface ProgressBarProps {
  done: number;
  total: number;
  percentage: number;
  label?: string;
}
```

**Rendering:**

```tsx
function ProgressBar({ done, total, percentage, label }: ProgressBarProps) {
  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No {label?.toLowerCase() ?? 'items'}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">
        {label && <span>{label} </span>}
        {done}/{total} done ({Math.round(percentage)}%)
      </p>
      <Progress
        value={percentage}
        className={cn(
          'h-2',
          percentage === 100 && '[&>div]:bg-green-500',
        )}
      />
    </div>
  );
}
```

**Exact elements:**

| Element | Classes | Content |
|---------|---------|---------|
| Label line | `text-sm text-muted-foreground` | `"{label} {done}/{total} done ({percentage}%)"` |
| Bar | shadcn `Progress` with `className="h-2"` | `value={percentage}` |
| Bar fill at 100% | `[&>div]:bg-green-500` override | Green bar when fully complete |
| Zero-total fallback | `text-sm text-muted-foreground italic` | `"No {label}"` |

### 5.5 EstimateDisplay.tsx — Exact Rendering

**Props interface:**

```typescript
interface EstimateDisplayProps {
  rollup: EstimateRollup;
  entityEstimate?: number;
}
```

Where `EstimateRollup` is from F2:

```typescript
interface EstimateRollup {
  totalPoints: number;
  estimatedCount: number;
  unestimatedCount: number;
}
```

**Rendering logic:**

```tsx
function EstimateDisplay({ rollup, entityEstimate }: EstimateDisplayProps) {
  const allUnestimated = rollup.estimatedCount === 0 && rollup.unestimatedCount > 0;

  return (
    <div className="space-y-1">
      {entityEstimate != null ? (
        <p className="text-sm font-mono">{entityEstimate} pts</p>
      ) : allUnestimated ? (
        <p className="text-sm text-muted-foreground italic">unestimated</p>
      ) : null}

      {rollup.estimatedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Rollup: {rollup.totalPoints} pts
          ({rollup.estimatedCount} estimated, {rollup.unestimatedCount} unestimated)
        </p>
      )}
    </div>
  );
}
```

**Rendering rules:**

| Condition | Entity Estimate Line | Rollup Line |
|-----------|---------------------|-------------|
| `entityEstimate` is set | `"{entityEstimate} pts"` in `text-sm font-mono` | Shown if `estimatedCount > 0` |
| `entityEstimate` is null, some children estimated | Hidden | `"Rollup: {totalPoints} pts ({estimatedCount} estimated, {unestimatedCount} unestimated)"` in `text-xs text-muted-foreground` |
| Everything unestimated | `"unestimated"` in `text-sm text-muted-foreground italic` | Hidden |

---

## 6. Filter Bar

### 6.1 FilterBar.tsx — Type Toggles, Status Toggles

**Props:** None. Reads from and writes to `useUIStore`.

**Store reads/writes:**

| Store Field | Usage |
|-------------|-------|
| `activeTypes` | Read current set of visible types |
| `activeStatusColours` | Read current set of visible colour groups |
| `toggleType(type)` | Called when a type toggle is clicked |
| `toggleStatusColour(colour)` | Called when a colour toggle is clicked |
| `clearFilters()` | Called when an active filter badge `×` is clicked |

**JSX structure:**

```tsx
<div className="border-b px-4 py-2 space-y-2">
  {/* Row 1: Type toggles */}
  <div className="flex items-center gap-1">
    {WORKFLOW_ENTITY_TYPES.map((info) => (
      <TypeToggle
        key={info.type}
        entityTypeInfo={info}
        isActive={activeTypes.has(info.type)}
        onToggle={() => toggleType(info.type)}
      />
    ))}
  </div>

  {/* Row 2: Status colour toggles */}
  <div className="flex items-center gap-1">
    {COLOUR_GROUPS.map((colour) => (
      <StatusColourToggle
        key={colour}
        colour={colour}
        isActive={activeStatusColours.has(colour)}
        onToggle={() => toggleStatusColour(colour)}
      />
    ))}
  </div>

  {/* Row 3: Active filter badges (only when filters are active) */}
  {hasActiveFilters && (
    <div className="flex items-center gap-1 flex-wrap">
      {inactiveTypes.map((type) => (
        <Badge
          key={type}
          variant="secondary"
          className="text-xs cursor-pointer gap-1"
          onClick={() => toggleType(type)}
        >
          <X className="w-3 h-3" />
          {ENTITY_TYPES[type].label}
        </Badge>
      ))}
      {inactiveColours.map((colour) => (
        <Badge
          key={colour}
          variant="secondary"
          className="text-xs cursor-pointer gap-1"
          onClick={() => toggleStatusColour(colour)}
        >
          <X className="w-3 h-3" />
          {colour}
        </Badge>
      ))}
    </div>
  )}
</div>
```

**`WORKFLOW_ENTITY_TYPES` constant (ordered, filter bar only):**

| Index | Entity Type | Lucide Icon |
|-------|-------------|-------------|
| 0 | `plan` | `Map` |
| 1 | `feature` | `Puzzle` |
| 2 | `task` | `CheckSquare` |
| 3 | `bug` | `Bug` |
| 4 | `decision` | `Scale` |
| 5 | `incident` | `AlertOctagon` |
| 6 | `checkpoint` | `CircleHelp` |

Note: `knowledge` and `document` are **not** shown in the filter bar. Knowledge entries are only accessible via EntityLinks in detail views. Documents belong to F4.

**`COLOUR_GROUPS` constant (ordered):**

```typescript
const COLOUR_GROUPS: StatusColourName[] = [
  'grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple',
];
```

**Active filter badge logic:**

- `hasActiveFilters`: true when any type is OFF or any colour group is OFF
- `inactiveTypes`: entity types where `!activeTypes.has(type)` — these are the hidden types, shown as removable badges
- `inactiveColours`: colour groups where `!activeStatusColours.has(colour)` — these are hidden colour groups
- Clicking a badge's `×` re-enables that type/colour (calls the same toggle function)

**FilterBar root element classes:** `border-b px-4 py-2 space-y-2`

**TypeToggle.tsx:**

```typescript
interface TypeToggleProps {
  entityTypeInfo: EntityTypeInfo;
  isActive: boolean;
  onToggle: () => void;
}
```

```tsx
function TypeToggle({ entityTypeInfo, isActive, onToggle }: TypeToggleProps) {
  const IconComponent = getLucideIcon(entityTypeInfo.icon);
  return (
    <Toggle
      pressed={isActive}
      onPressedChange={onToggle}
      size="sm"
      className={cn(!isActive && 'opacity-50')}
      aria-label={`Toggle ${entityTypeInfo.label} visibility`}
    >
      <IconComponent className="w-4 h-4 mr-1" />
      <span className="text-xs">{entityTypeInfo.label}</span>
    </Toggle>
  );
}
```

**StatusColourToggle.tsx:**

```typescript
interface StatusColourToggleProps {
  colour: StatusColourName;
  isActive: boolean;
  onToggle: () => void;
}
```

```tsx
function StatusColourToggle({ colour, isActive, onToggle }: StatusColourToggleProps) {
  const hex = STATUS_COLOURS[colour];
  const tooltipStatuses = Object.entries(STATUS_TO_COLOUR)
    .filter(([_, c]) => c === colour)
    .map(([s]) => s)
    .join(', ');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          pressed={isActive}
          onPressedChange={onToggle}
          size="sm"
          className={cn('px-2', !isActive && 'opacity-50')}
          aria-label={`Toggle ${colour} status group`}
        >
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: hex }}
          />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs max-w-[200px]">{tooltipStatuses}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

**Colour dot in toggle:** `w-3 h-3` (12×12px), `rounded-full`, inline `style={{ backgroundColor: hex }}`.

### 6.2 Filter State Interface

Managed in `src/lib/store/ui-store.ts`:

```typescript
interface FilterState {
  // Type filters
  activeTypes: Set<string>;
  toggleType: (type: string) => void;

  // Status colour filters
  activeStatusColours: Set<string>;
  toggleStatusColour: (colour: string) => void;

  // Bulk operations
  clearFilters: () => void;
  activateStatusFilter: (status: string) => void;
}
```

**Default state:** All types ON, all colour groups ON.

```typescript
activeTypes: new Set(['plan', 'feature', 'task', 'bug', 'decision', 'incident', 'checkpoint']),
activeStatusColours: new Set(['grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple']),
```

**`toggleType` implementation:**

```typescript
toggleType: (type) => set((state) => {
  const next = new Set(state.activeTypes);
  if (next.has(type)) {
    next.delete(type);
  } else {
    next.add(type);
  }
  return { activeTypes: next };
}),
```

**`toggleStatusColour` implementation:**

```typescript
toggleStatusColour: (colour) => set((state) => {
  const next = new Set(state.activeStatusColours);
  if (next.has(colour)) {
    next.delete(colour);
  } else {
    next.add(colour);
  }
  return { activeStatusColours: next };
}),
```

**`clearFilters` implementation:**

```typescript
clearFilters: () => set({
  activeTypes: new Set(['plan', 'feature', 'task', 'bug', 'decision', 'incident', 'checkpoint']),
  activeStatusColours: new Set(['grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple']),
}),
```

**`activateStatusFilter` implementation:**

```typescript
activateStatusFilter: (status) => set({
  activeStatusColours: new Set([getStatusColour(status)]),
}),
```

This turns OFF all colour groups except the one matching the clicked status, providing a "show only this status" shortcut. Clicking the same badge again or clicking an active filter `×` to re-enable colours restores the view.

### 6.3 Filter Application Algorithm (AND Logic, Ghost Parents)

**Core visibility rule:**

```
isVisible(entity, entityType) =
  activeTypes.has(entityType) AND activeStatusColours.has(getStatusColour(entity.status))
```

**Hierarchical tree filtering algorithm:**

```typescript
function applyTreeFilters(
  tree: TreeNode[],
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): FilteredTreeNode[] {
  return tree
    .map((planNode) => filterPlanNode(planNode, activeTypes, activeStatusColours))
    .filter((node): node is FilteredTreeNode => node !== null);
}

function filterPlanNode(
  planNode: TreeNode,
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): FilteredTreeNode | null {
  const planVisible = isVisible(planNode.entity, 'plan', activeTypes, activeStatusColours);

  // Filter child features
  const filteredChildren = planNode.children
    .map((featureNode) => filterFeatureNode(featureNode, activeTypes, activeStatusColours))
    .filter((node): node is FilteredTreeNode => node !== null);

  if (planVisible) {
    // Plan passes both type and status filters: render normally with filtered children
    return { ...planNode, children: filteredChildren, _ghost: false };
  }

  if (filteredChildren.length > 0) {
    // Plan is filtered out, but has visible children: render as ghost
    return { ...planNode, children: filteredChildren, _ghost: true };
  }

  // Plan is filtered out and has no visible children: omit entirely
  return null;
}

function filterFeatureNode(
  featureNode: TreeNode,
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): FilteredTreeNode | null {
  const featureVisible = isVisible(featureNode.entity, 'feature', activeTypes, activeStatusColours);

  // Filter child tasks
  const filteredChildren = featureNode.children
    .filter((taskNode) => isVisible(taskNode.entity, 'task', activeTypes, activeStatusColours));

  if (featureVisible) {
    return {
      ...featureNode,
      children: filteredChildren.map((c) => ({ ...c, _ghost: false })),
      _ghost: false,
    };
  }

  if (filteredChildren.length > 0) {
    // Feature filtered out but has visible tasks: render as ghost
    return {
      ...featureNode,
      children: filteredChildren.map((c) => ({ ...c, _ghost: false })),
      _ghost: true,
    };
  }

  return null;
}

function isVisible(
  entity: { status: string },
  entityType: string,
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): boolean {
  return activeTypes.has(entityType) && activeStatusColours.has(getStatusColour(entity.status));
}
```

**Extended TreeNode type for filtering:**

```typescript
interface FilteredTreeNode extends TreeNode {
  _ghost: boolean; // true = dimmed, non-interactive parent kept for hierarchy context
}
```

**Ghost parent rules:**

| Scenario | Result |
|----------|--------|
| Plan type OFF, Feature type ON, plan has visible features | Plan renders as ghost (`opacity-50`, `pointer-events-none`). Features render normally. |
| Feature type OFF, Task type ON, feature has visible tasks | Feature renders as ghost. Tasks render normally. |
| Plan type OFF, no visible children | Plan is omitted entirely |
| Feature type OFF, no visible child tasks | Feature is omitted entirely |
| Task type OFF | All tasks hidden; features with no other visible children may become ghost or be omitted depending on their own visibility |

**Standalone section filtering:**

```typescript
// Bugs
const filteredBugs = [...bugs.values()]
  .filter((b) => activeStatusColours.has(getStatusColour(b.status)))
  .sort((a, b) => a.id.localeCompare(b.id));

// Decisions
const filteredDecisions = [...decisions.values()]
  .filter((d) => activeStatusColours.has(getStatusColour(d.status)))
  .sort((a, b) => a.id.localeCompare(b.id));

// Incidents
const filteredIncidents = [...incidents.values()]
  .filter((i) => activeStatusColours.has(getStatusColour(i.status)))
  .sort((a, b) => a.id.localeCompare(b.id));

// Pending Checkpoints
const filteredPendingCheckpoints = pendingCheckpoints
  .filter((c) => activeStatusColours.has(getStatusColour(c.status)))
  .sort((a, b) => b.created.localeCompare(a.created)); // newest first
```

Standalone sections are hidden entirely when their entity type is toggled OFF (`!activeTypes.has(type)`). Individual items within visible sections are hidden when their status colour is toggled OFF.

---

## 7. UI Store Extensions

The UI store at `src/lib/store/ui-store.ts` is extended with the following state and actions for F3. These are added to the existing store created by F1/F2.

```typescript
// Added to the existing useUIStore

// --- Selection state ---
selectedEntityId: string | null;           // default: null
selectedEntityType: string | null;         // default: null
selectEntity: (id: string | null, type: string | null) => void;

// --- Filter state ---
activeTypes: Set<string>;                  // default: all 7 workflow types
activeStatusColours: Set<string>;          // default: all 7 colour groups
toggleType: (type: string) => void;
toggleStatusColour: (colour: string) => void;
clearFilters: () => void;
activateStatusFilter: (status: string) => void;
```

**`selectEntity` implementation:**

```typescript
selectEntity: (id, type) => set({
  selectedEntityId: id,
  selectedEntityType: type,
}),
```

**Initial values:**

```typescript
selectedEntityId: null,
selectedEntityType: null,
activeTypes: new Set(['plan', 'feature', 'task', 'bug', 'decision', 'incident', 'checkpoint']),
activeStatusColours: new Set(['grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple']),
```

---

## 8. Implementation Order

Tasks should be implemented in this order due to dependencies:

| Step | Component(s) | Depends On | Notes |
|------|-------------|------------|-------|
| 1 | `StatusDot.tsx`, `StatusBadge.tsx` | F2 status-colours constants | Foundational — used by everything else |
| 2 | `EntityLink.tsx` | F2 reference resolution | Used by detail panels and tree |
| 3 | `FieldValue.tsx` | `StatusBadge`, `EntityLink`, `date-fns` | Polymorphic renderer used by all detail components |
| 4 | `ProgressBar.tsx`, `EstimateDisplay.tsx` | F2 metrics functions | Used by detail panels |
| 5 | `TreeContext.tsx` | F2 project store, UI store | Context provider — must exist before tree or detail |
| 6 | `TreeNode.tsx` | `StatusDot`, `TreeContext` | Recursive node rendering |
| 7 | `StandaloneSection.tsx` | `StatusDot`, `TreeContext` | Bug/Decision/Incident/Checkpoint sections |
| 8 | `EntityTree.tsx` | `TreeNode`, `StandaloneSection`, `TreeContext`, filter algorithm | Full tree with filtering |
| 9 | `DetailHeader` (inline in EntityDetail or shared) | `StatusBadge` | Shared header for all detail views |
| 10 | `PlanDetail.tsx`, `FeatureDetail.tsx`, `TaskDetail.tsx`, `BugDetail.tsx`, `DecisionDetail.tsx`, `CheckpointDetail.tsx`, `IncidentDetail.tsx`, `KnowledgeDetail.tsx` | `FieldValue`, `ProgressBar`, `EstimateDisplay`, `EntityLink`, `RelatedEntitiesSection` | All 8 detail components — can be done in parallel |
| 11 | `EntityDetail.tsx` | All `*Detail` components | Router |
| 12 | `TypeToggle.tsx`, `StatusColourToggle.tsx` | UI store filter state | Filter toggle building blocks |
| 13 | `FilterBar.tsx` | `TypeToggle`, `StatusColourToggle`, UI store | Full filter bar |
| 14 | `EmptyState.tsx` modification | Existing `EmptyState` from F1 | Add project-summary variant |
| 15 | `WorkflowsView.tsx` | All of the above | Final assembly |
| 16 | UI store extensions (`ui-store.ts`) | — | Can be done early (step 1) alongside StatusDot/StatusBadge |

**External dependency:** `date-fns` must be added to `package.json` (if not already present) before step 3.

---

## 9. Acceptance Criteria

### Functional

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | **Full tree renders.** Opening a project shows all Plans with nested Features and Tasks in the correct hierarchy. | Load a project with ≥2 plans, each having features and tasks. Verify all appear in correct nesting. |
| AC-2 | **Status colours correct.** Every StatusDot and StatusBadge uses the prescribed colour from the 7-colour palette. | Verify at least one entity per colour group renders with the correct colour. Verify unknown status renders grey. |
| AC-3 | **Expand/collapse works.** Chevrons toggle children at all levels. | Click Plan chevron → Features appear/disappear. Click Feature chevron → Tasks appear/disappear. Task nodes have no chevron. |
| AC-4 | **Entity selection works.** Clicking any entity in the tree or standalone section shows its full detail in the right panel. | Click Plan → PlanDetail shows. Click Feature → FeatureDetail. Click Bug in standalone → BugDetail. |
| AC-5 | **Detail renders all fields.** Each entity type shows all populated fields with correct formatting. | For each of the 8 entity types, verify: timestamps as relative, arrays as lozenges, long text as expandable, entity refs as links. |
| AC-6 | **Progress bars correct.** FeatureDetail shows task completion. PlanDetail shows feature completion. | Feature with 3/5 done tasks → "Tasks 3/5 done (60%)" and correct bar fill. |
| AC-7 | **Estimate rollup correct.** Features show sum of task estimates. Plans show sum of feature estimates. | Feature with tasks estimated at 3, 5, and null → "Rollup: 8 pts (2 estimated, 1 unestimated)". |
| AC-8 | **Broken references handled.** EntityLinks to non-existent entities render dimmed with line-through and "Entity not found" tooltip. | Add a `depends_on` reference to a non-existent task ID. Verify dimmed rendering, no crash. |
| AC-9 | **Unknown statuses handled.** Any unrecognised status string renders grey with the raw string. | Set an entity status to "banana" in YAML. Verify grey dot/badge, string "banana" displayed. |
| AC-10 | **Type filters work.** Toggling a type OFF hides all entities of that type. Ghost parents preserve hierarchy. | Toggle Feature OFF → Features disappear. If Plan has visible tasks, Plan renders as ghost. |
| AC-11 | **Status colour filters work.** Toggling a colour OFF hides all entities with statuses in that colour group. | Toggle yellow OFF → all `active`, `in-progress`, etc. entities disappear from tree. |
| AC-12 | **Filter badges appear.** Active filters show as removable badges. Clicking × removes the filter. | Toggle Bug OFF → badge "Bug" appears with ×. Click × → Bugs reappear. |
| AC-13 | **Detail panel filter activation.** Clicking a StatusBadge in the detail panel activates that colour group as a solo filter. | View a "queued" task, click the `[queued]` badge → only grey-status entities visible. |
| AC-14 | **Pending checkpoints prominent.** The Pending Checkpoints section is always expanded when non-empty, with orange highlight. | Load project with pending checkpoint → section visible, orange background, AlertTriangle icon, cannot collapse. |
| AC-15 | **Empty default state.** When no entity is selected, detail panel shows project summary with counts and overall progress bar. | On load (no selection), verify counts and progress bar visible in right panel. |
| AC-16 | **EntityLink within-tree navigation.** Clicking an EntityLink in the detail panel selects that entity in the tree, expanding ancestors as needed. | In FeatureDetail, click the parent Plan EntityLink → tree expands to Plan, Plan is selected, PlanDetail shows. |
| AC-17 | **Standalone sections populated.** Bugs, Decisions, Incidents each appear in their own collapsible section with correct entries and status dots. | Verify Bugs section shows bug entities with status dots. Decisions show without dots. Incidents show with dots. |
| AC-18 | **Sorting correct.** Plans sort by prefix. Features/Tasks sort by ID. Standalone entities sort by ID. | P1 before P2 before P10. Features in chronological order. Tasks in chronological order. |

### Error Resilience

| # | Scenario | Expected Behaviour |
|---|----------|--------------------|
| ER-1 | Unknown status value | StatusBadge and StatusDot render grey. Raw status string displayed. No crash. |
| ER-2 | Missing/absent field on entity | FieldValue returns null — field not rendered in detail panel. No crash. |
| ER-3 | Broken entity reference | EntityLink renders dimmed with line-through, "Entity not found" tooltip. No click action. |
| ER-4 | Empty entity maps (no plans, no features, etc.) | Tree shows EmptyState. Standalone sections show "(none)". Detail shows project summary with all zeroes. |
| ER-5 | Entity type not in detail router | EntityDetail renders generic fallback: icon + ID + all fields as key-value pairs. |
| ER-6 | Zero tasks for a feature | ProgressBar shows "No tasks" text instead of a bar. No division by zero. |
| ER-7 | Circular `depends_on` | TaskDetail renders the dependency list as-is. No cycle detection. No infinite loop. |
| ER-8 | Very long summary text | Truncated with `truncate` class (ellipsis) in tree nodes. Full text in detail panel. |
| ER-9 | Very long field values | `long-text` type uses collapsible — first 3 lines visible, expandable via "Show more". |
| ER-10 | Orphaned feature (parent plan not found) | Rendered under a synthetic "Orphaned" group at the end of the tree, or appended at root level. |
| ER-11 | Orphaned task (parent feature not found) | Included in a standalone "Orphaned Tasks" section if needed. |

### Checklist

- [ ] Full Plan → Feature → Task tree renders with correct nesting
- [ ] Status badges and dots use the correct colour from the 7-colour palette
- [ ] Chevrons expand and collapse children at all tree levels
- [ ] Clicking any tree node selects it and shows its detail panel
- [ ] Each entity type's detail panel renders all populated fields correctly
- [ ] Progress bars show correct task completion percentage on FeatureDetail
- [ ] Estimate rollup shows correct totals on FeatureDetail and PlanDetail
- [ ] Broken entity references render dimmed with "Entity not found" tooltip
- [ ] Unknown status strings render grey with the raw string value
- [ ] Type filter toggles hide/show entities of the toggled type
- [ ] Status colour filter toggles hide/show entities of the toggled colour group
- [ ] Ghost parents preserve hierarchy when children match filter but parent does not
- [ ] Active filter badges appear and can be removed via the × button
- [ ] Clicking a StatusBadge in detail panel activates that colour as a solo filter
- [ ] Pending Checkpoints section is always expanded when non-empty with orange highlight
- [ ] Default (no selection) state shows project summary with counts and progress bar
- [ ] EntityLink within-tree navigation selects the target and expands its ancestors
- [ ] Standalone sections (Bugs, Decisions, Incidents) are populated and collapsible
- [ ] Plans sort by prefix letter + number; Features and Tasks sort by ID
- [ ] Empty entity maps show EmptyState without crashing
- [ ] Orphaned features render under a synthetic "Orphaned" group at tree root

---

## References

- **Design document:** `work/design/f3-workflows-view.md`
- **Architecture document:** `work/design/kbzv-architecture.md` (§6.1, §6.5–6.8, §6.10, §7, §8)
- **F2 Data Layer design:** `work/design/f2-data-layer.md` (§5, §7, §8, §9)
- **shadcn sidebar-11 pattern:** `https://ui.shadcn.com/blocks/sidebar-11`
```

That's a comprehensive specification document. Let me walk you through the key decisions and structure:

**What the spec covers:**

1. **§1 File Manifest** — Every file with full path, categorised as new/modified/consumed
2. **§2 Layout** — Exact `WorkflowsView.tsx` JSX structure with Tailwind classes for the two-column split (`w-80`, `flex-1`, `max-w-[700px]`)
3. **§3 Entity Tree** — Complete `TreeNode` rendering with exact indentation classes (`pl-2`/`pl-6`/`pl-10`), chevron rotation (`rotate-90`), selection (`bg-accent`), hover (`bg-accent/50`), and ghost state (`opacity-50 pointer-events-none`). Full `TreeContext` provider with `expandTo` algorithm. Standalone section specs including the Pending Checkpoints orange treatment.
4. **§4 Entity Detail** — All 8 entity type detail views with **exact ordered field tables** showing field name, `FieldValue` type, and render condition. `FieldValue.tsx` fully specified with rendering for all 11 types, the `long-text` collapsible logic, severity/priority badge colours, and the absent-field rule.
5. **§5 Common Components** — `StatusBadge` with exact Tailwind classes per all 7 colour groups, `StatusDot` with hex values, `EntityLink` with both found/not-found states, `ProgressBar`, and `EstimateDisplay`.
6. **§6 Filter Bar** — Complete filter algorithm with AND logic and ghost parent logic as executable pseudocode. Exact `TypeToggle` and `StatusColourToggle` rendering with icon names and colour dot specs.
7. **§7 UI Store** — Exact interface additions and implementations for selection + filter state
8. **§8 Implementation Order** — 16-step dependency-ordered task sequence
9. **§9 Acceptance Criteria** — 18 functional criteria + 11 error resilience scenarios