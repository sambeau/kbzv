# F3: Workflows View — Development Plan

| Field | Value |
|-------|-------|
| **Feature ID** | FEAT-01KMZA9GFB075 |
| **Slug** | `workflows-view` |
| **Parent Plan** | P1-kbzv |
| **Depends On** | FEAT-01KMZA96W1J98 (F1: App Scaffold + Theme), FEAT-01KMZA9CP9XEX (F2: Data Layer) |
| **Source Spec** | `work/spec/f3-workflows-view-spec.md` |
| **Source Design** | `work/design/f3-workflows-view.md` |
| **Total Estimated Effort** | 34 story points |

---

## Task Dependency Graph

```
T1  UI Store Extensions ─────────────────────────┐
                                                  │
T2  StatusDot + StatusBadge ──────┬───────────────┤
                                  │               │
T3  EntityLink (stubbed) ─────────┤               │
                                  │               │
T4  FieldValue Renderer ──────────┤               │
                                  │               │
T5  ProgressBar + EstimateDisplay ┤               │
                                  │               │
T6  TreeContext + TreeNode ────────┤               │
                                  │               │
T7  StandaloneSection ────────────┤               │
                                  │               │
T8  EntityTree ───────────────────┤               │
                                  ▼               │
T9  DetailHeader + helpers ───────┤               │
                                  │               │
T10 Per-type Detail Components ───┤               │
                                  │               │
T11 EntityDetail Router ──────────┤               │
                                  │               │
T12 Filter Bar ───────────────────┤               │
                                  │               │
T13 EmptyState update ────────────┤               │
                                  ▼               │
T14 WorkflowsView Assembly ◄─────────────────────┘
```

**Parallelism opportunities:**

- T2, T3, T5 can run in parallel (all leaf-level common components)
- T4 depends on T2 + T3 (uses StatusBadge and EntityLink)
- T6 and T7 depend on T1 + T2 (use UI store + StatusDot)
- T8 depends on T6 + T7 (composes tree + standalone sections)
- T9, T10, T11 form a chain (header → detail components → router)
- T12 depends on T1 (uses filter state from UI store)
- T14 is the final integration task

---

## Task Breakdown

---

### T1: UI Store Extensions — Selection + Filter State

**Effort:** 2 points

#### What to Do

Extend the existing `ui-store.ts` (created by F1) with selection state and filter state required by the Workflows view. This is foundational — nearly every other task reads from or writes to this state.

#### Implementation

Add the following to the existing Zustand store in `src/lib/store/ui-store.ts`:

```typescript
// --- Selection state ---
selectedEntityId: null as string | null,
selectedEntityType: null as string | null,
selectEntity: (id: string | null, type: string | null) =>
  set({ selectedEntityId: id, selectedEntityType: type }),

// --- Filter state ---
activeTypes: new Set([
  'plan', 'feature', 'task', 'bug', 'decision', 'incident', 'checkpoint',
]),
activeStatusColours: new Set([
  'grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple',
]),

toggleType: (type: string) =>
  set((state) => {
    const next = new Set(state.activeTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    return { activeTypes: next };
  }),

toggleStatusColour: (colour: string) =>
  set((state) => {
    const next = new Set(state.activeStatusColours);
    if (next.has(colour)) next.delete(colour);
    else next.add(colour);
    return { activeStatusColours: next };
  }),

clearFilters: () =>
  set({
    activeTypes: new Set([
      'plan', 'feature', 'task', 'bug', 'decision', 'incident', 'checkpoint',
    ]),
    activeStatusColours: new Set([
      'grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple',
    ]),
  }),

activateStatusFilter: (status: string) =>
  set({
    activeStatusColours: new Set([getStatusColour(status)]),
  }),
```

**Zustand `Set` serialisation note:** Zustand handles `Set` objects natively — no custom middleware needed. Equality is by reference, so always create a new `Set` when mutating.

#### Files Touched

| File | Action |
|------|--------|
| `src/lib/store/ui-store.ts` | **Modified** — add selection + filter state and actions |

#### Dependencies

- F1 must be complete (file exists)
- F2 must be complete (`getStatusColour` import from `src/lib/constants/status-colours.ts`)

#### Verification

1. Import `useUIStore` in a test component or browser console
2. Call `selectEntity('FEAT-001', 'feature')` → verify `selectedEntityId` and `selectedEntityType` update
3. Call `toggleType('bug')` → verify `activeTypes` no longer contains `'bug'`
4. Call `toggleType('bug')` again → verify `'bug'` is restored
5. Call `toggleStatusColour('green')` → verify `activeStatusColours` shrinks
6. Call `activateStatusFilter('done')` → verify only `'green'` remains in `activeStatusColours`
7. Call `clearFilters()` → verify both sets are fully restored to defaults

---

### T2: StatusDot + StatusBadge — Foundational Status Indicators

**Effort:** 2 points

#### What to Do

Create two common components that translate entity status strings into visual colour indicators. These are used pervasively throughout the tree, detail panels, and filter bar. Both components consume F2's `getStatusColour` and `getStatusHex` functions.

#### Implementation — StatusDot

`src/components/tree/StatusDot.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { getStatusHex } from '@/lib/constants/status-colours';

interface StatusDotProps {
  status: string;
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
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

- Dimensions: `w-2 h-2` = 8×8px circle
- Colour: inline `style` with hex from the 7-colour palette
- Unknown statuses fall through to grey (`#9CA3AF`) via `getStatusHex`

#### Implementation — StatusBadge

`src/components/common/StatusBadge.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getStatusColour } from '@/lib/constants/status-colours';
import { useUIStore } from '@/lib/store/ui-store';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  grey:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  green:  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const activateStatusFilter = useUIStore((s) => s.activateStatusFilter);
  const colour = getStatusColour(status);

  return (
    <Badge
      className={cn(
        STATUS_BADGE_STYLES[colour] ?? STATUS_BADGE_STYLES.grey,
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

- Displays status string as-is (lowercase, hyphenated)
- Click activates the status colour as a solo filter
- Unknown colours fall back to grey style

#### Files Touched

| File | Action |
|------|--------|
| `src/components/tree/StatusDot.tsx` | **Created** |
| `src/components/common/StatusBadge.tsx` | **Created** |

#### Dependencies

- T1 (UI store — `activateStatusFilter` used by StatusBadge)
- F2 (`getStatusColour`, `getStatusHex` from `src/lib/constants/status-colours.ts`)

#### Verification

1. Render `<StatusDot status="active" />` → yellow dot (#EAB308)
2. Render `<StatusDot status="done" />` → green dot (#22C55E)
3. Render `<StatusDot status="banana" />` → grey dot (#9CA3AF), no crash
4. Render `<StatusBadge status="needs-review" />` → orange badge with text "needs-review"
5. Click the StatusBadge → verify `activeStatusColours` in UI store narrows to `['orange']`
6. Verify dark mode rendering uses `dark:` variant classes

---

### T3: EntityLink — Clickable Entity Reference (Stubbed Navigation)

**Effort:** 3 points

#### What to Do

Create a component that renders a clickable entity ID reference. Resolves the entity from the store to show a tooltip with summary. Handles broken references gracefully with dimmed, struck-through rendering. Click behaviour navigates within the tree (F3 scope) for workflow entities; document links are no-ops until F5.

#### Implementation

`src/components/common/EntityLink.tsx`:

```tsx
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { resolveEntityType, resolveEntity } from '@/lib/query/references';
import { useProjectStore } from '@/lib/store/project-store';
import { useTreeContext } from '@/components/tree/TreeContext';

interface EntityLinkProps {
  entityId: string;
  className?: string;
}

export function EntityLink({ entityId, className }: EntityLinkProps) {
  const projectState = useProjectStore();
  const entity = resolveEntity(entityId, projectState);
  const entityType = resolveEntityType(entityId);

  if (!entity) {
    return (
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
    );
  }

  const entitySummary = getEntitySummary(entity, entityType);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            'text-primary underline-offset-4 hover:underline cursor-pointer font-mono text-sm',
            className,
          )}
          onClick={() => handleClick(entityId, entityType)}
        >
          {entityId}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{entitySummary}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

**`getEntitySummary` helper** — derives display text per type:

| Entity Type | Summary Source |
|-------------|---------------|
| `plan` | `entity.title` |
| `feature` | `entity.summary` |
| `task` | `entity.summary` |
| `bug` | `entity.title` |
| `decision` | `entity.summary` |
| `incident` | `entity.title` |
| `checkpoint` | `entity.question` (truncated to 80 chars) |
| `knowledge` | `entity.topic` |
| `document` | `entity.title` |

**`handleClick` function:**

```typescript
function handleClick(entityId: string, entityType: string | null) {
  if (!entityType || entityType === 'document') return;
  // TreeContext provides select + expandTo
  const { select, expandTo } = useTreeContext();
  expandTo(entityId);
  select(entityId, entityType);
}
```

**Important:** `EntityLink` must be rendered inside a `TreeProvider` (which wraps the entire `WorkflowsView`). The `useTreeContext()` call will throw if used outside the provider.

#### Files Touched

| File | Action |
|------|--------|
| `src/components/common/EntityLink.tsx` | **Created** |

#### Dependencies

- F2 (`resolveEntityType`, `resolveEntity` from `src/lib/query/references.ts`; `useProjectStore`)
- T6 (`useTreeContext` from `TreeContext.tsx` — **circular concern**, see note)

**Circular dependency note:** EntityLink imports `useTreeContext`, but TreeNode also uses EntityLink (indirectly via detail panels). This is not a JS module cycle because EntityLink only calls `useTreeContext()` at runtime (inside event handlers), and TreeContext is provided at the `WorkflowsView` level. However, during T3 implementation, `useTreeContext` won't exist yet. **Approach:** Implement EntityLink first with a guarded `try/catch` on `useTreeContext` (return early if not available). Wire the tree navigation in T6 once TreeContext exists.

#### Verification

1. Render `<EntityLink entityId="FEAT-01KMZA96W1J98" />` with that entity in the store → blue, underline-on-hover link with tooltip showing the feature summary
2. Render `<EntityLink entityId="FEAT-NONEXISTENT" />` → dimmed, line-through text, tooltip "Entity not found"
3. Click a valid EntityLink → verify `selectEntity` fires on UI store, tree scrolls to and highlights the target
4. Click a document EntityLink → no-op (no crash)
5. Hover over a checkpoint EntityLink → tooltip shows question truncated to 80 chars

---

### T4: FieldValue — Polymorphic Field Renderer

**Effort:** 5 points

#### What to Do

Create the `FieldValue` component that handles all field type rendering across every detail panel. This is the most complex common component — it must handle 11 `type` variants, the absent-field rule (return `null` for empty values), the long-text collapsible behaviour, and severity/priority badge colours.

#### Implementation

`src/components/entity/FieldValue.tsx`:

```tsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EntityLink } from '@/components/common/EntityLink';

type FieldValueType = string | number | string[] | null | undefined;

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
  alwaysExpanded?: boolean;
}
```

**Absent-field rule:** If `value` is `undefined`, `null`, `""`, or `[]` → return `null`.

**Root wrapper:**

```tsx
<div className="space-y-1">
  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
    {label}
  </dt>
  <dd>{/* rendered value */}</dd>
</div>
```

**Rendering by type:**

| `type` | Rendered Output | Classes |
|--------|----------------|---------|
| `text` | Plain `<span>` | `text-sm` + optional `className` |
| `timestamp` | Relative time via `formatDistanceToNow` with full RFC 3339 in `Tooltip` | `text-sm text-muted-foreground` |
| `entity-ref` | `<EntityLink entityId={value} />` | — |
| `entity-ref-list` | Flex wrap of `<EntityLink>` per item | `flex flex-wrap gap-1.5` |
| `tag-list` | `<Badge variant="secondary">` per tag | `flex flex-wrap gap-1`; badge: `text-xs` |
| `string-list` | `<Badge variant="outline">` per item | `flex flex-wrap gap-1`; badge: `text-xs font-mono` |
| `long-text` | `<LongTextValue>` — first 3 lines with expand/collapse | `text-sm whitespace-pre-wrap font-mono` |
| `number` | Plain `<span>` | `text-sm font-mono` |
| `severity` | `<Badge>` with severity colour | See colour table |
| `priority` | `<Badge>` with priority colour | See colour table |
| `status` | `<StatusBadge status={value} />` | — |

**Severity/Priority colours:**

| Value | Classes |
|-------|---------|
| `critical` | `bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300` |
| `high` | `bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300` |
| `medium` | `bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300` |
| `low` | `bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300` |

**LongTextValue subcomponent:**

```tsx
function LongTextValue({
  value,
  alwaysExpanded,
}: {
  value: string;
  alwaysExpanded?: boolean;
}) {
  const lines = value.split('\n');
  const needsCollapse = !alwaysExpanded && lines.length > 3;
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

**`date-fns` dependency:** The `timestamp` type requires `formatDistanceToNow` from `date-fns`. Ensure `date-fns` is in `package.json`:

```bash
npm install date-fns
```

#### Files Touched

| File | Action |
|------|--------|
| `src/components/entity/FieldValue.tsx` | **Created** |
| `package.json` | **Modified** — add `date-fns` dependency (if not present) |

#### Dependencies

- T2 (`StatusBadge` import)
- T3 (`EntityLink` import)
- F2 (entity type interfaces for type guards)

#### Verification

1. **text**: `<FieldValue label="Slug" value="my-slug" type="text" />` → renders "my-slug" as plain text
2. **timestamp**: `<FieldValue label="Created" value="2025-01-15T10:30:00Z" type="timestamp" />` → shows "X days ago", hover shows full timestamp
3. **entity-ref**: `<FieldValue label="Parent" value="P1-kbzv" type="entity-ref" />` → renders EntityLink
4. **entity-ref-list**: `<FieldValue label="Depends On" value={["TASK-001", "TASK-002"]} type="entity-ref-list" />` → renders two EntityLinks in a flex row
5. **tag-list**: `<FieldValue label="Tags" value={["ui", "tree"]} type="tag-list" />` → secondary badges
6. **string-list**: `<FieldValue label="Files" value={["src/App.tsx"]} type="string-list" />` → outline badges in mono font
7. **long-text** (short): `<FieldValue label="Summary" value="One line" type="long-text" />` → full text, no toggle
8. **long-text** (long): 5-line value → first 3 lines + "Show more" → click → full text + "Show less"
9. **long-text** (always expanded): `alwaysExpanded={true}` with 10-line value → full text, no toggle
10. **number**: `<FieldValue label="Estimate" value={5} type="number" />` → "5" in mono font
11. **severity**: `<FieldValue label="Severity" value="critical" type="severity" />` → red badge
12. **priority**: `<FieldValue label="Priority" value="low" type="priority" />` → grey badge
13. **status**: `<FieldValue label="Status" value="active" type="status" />` → yellow StatusBadge
14. **absent**: `<FieldValue label="Slug" value={undefined} type="text" />` → nothing rendered
15. **absent array**: `<FieldValue label="Tags" value={[]} type="tag-list" />` → nothing rendered

---

### T5: ProgressBar + EstimateDisplay — Metrics Components

**Effort:** 2 points

#### What to Do

Create two display components for progress metrics and story point estimates. These are used in PlanDetail, FeatureDetail, and the default empty state (project summary).

#### Implementation — ProgressBar

`src/components/metrics/ProgressBar.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface ProgressBarProps {
  done: number;
  total: number;
  percentage: number;
  label?: string;
}

export function ProgressBar({ done, total, percentage, label }: ProgressBarProps) {
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

#### Implementation — EstimateDisplay

`src/components/metrics/EstimateDisplay.tsx`:

```tsx
import type { EstimateRollup } from '@/lib/query/metrics';

interface EstimateDisplayProps {
  rollup: EstimateRollup;
  entityEstimate?: number;
}

export function EstimateDisplay({ rollup, entityEstimate }: EstimateDisplayProps) {
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

#### Files Touched

| File | Action |
|------|--------|
| `src/components/metrics/ProgressBar.tsx` | **Created** |
| `src/components/metrics/EstimateDisplay.tsx` | **Created** |

#### Dependencies

- F2 (`EstimateRollup` type from `src/lib/query/metrics.ts`; `Progress` from shadcn — installed by F1)

#### Verification

1. `<ProgressBar done={3} total={5} percentage={60} label="Tasks" />` → "Tasks 3/5 done (60%)" + 60% filled bar
2. `<ProgressBar done={5} total={5} percentage={100} label="Tasks" />` → green bar
3. `<ProgressBar done={0} total={0} percentage={0} label="Tasks" />` → "No tasks" italic text
4. `<EstimateDisplay rollup={{ totalPoints: 8, estimatedCount: 2, unestimatedCount: 1 }} />` → rollup line only
5. `<EstimateDisplay rollup={{ totalPoints: 8, estimatedCount: 2, unestimatedCount: 1 }} entityEstimate={5} />` → "5 pts" + rollup
6. `<EstimateDisplay rollup={{ totalPoints: 0, estimatedCount: 0, unestimatedCount: 3 }} />` → "unestimated"

---

### T6: TreeContext + TreeNode — Tree State and Node Rendering

**Effort:** 5 points

#### What to Do

Create the React context provider that manages expand/collapse state, entity selection, and programmatic navigation (`expandTo`). Then create the recursive `TreeNode` component that renders individual Plan/Feature/Task nodes with chevrons, status dots, and indentation.

#### Implementation — TreeContext

`src/components/tree/TreeContext.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useUIStore } from '@/lib/store/ui-store';
import { useProjectStore } from '@/lib/store/project-store';

interface TreeContextValue {
  expandedNodes: Set<string>;
  selectedEntity: string | null;
  selectedType: string | null;
  toggleExpand: (id: string) => void;
  expandTo: (id: string) => void;
  select: (id: string, type: string) => void;
}

const TreeContext = createContext<TreeContextValue | null>(null);

export function TreeProvider({ children }: { children: ReactNode }) {
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandTo = useCallback(
    (targetId: string) => {
      setExpandedNodes((prev) => {
        const next = new Set(prev);

        // Walk the parent chain
        // Check if it's a task → find parent feature → find parent plan
        const task = tasks.get(targetId);
        if (task?.parent_feature) {
          next.add(task.parent_feature);
          const feature = features.get(task.parent_feature);
          if (feature?.parent) next.add(feature.parent);
        }

        // Check if it's a feature → find parent plan
        const feature = features.get(targetId);
        if (feature?.parent) next.add(feature.parent);

        return next;
      });

      // Scroll target into view after React re-renders
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-entity-id="${targetId}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    },
    [features, tasks],
  );

  const select = useCallback(
    (id: string, type: string) => {
      selectEntity(id, type);
    },
    [selectEntity],
  );

  return (
    <TreeContext.Provider
      value={{
        expandedNodes,
        selectedEntity: selectedEntityId,
        selectedType: selectedEntityType,
        toggleExpand,
        expandTo,
        select,
      }}
    >
      {children}
    </TreeContext.Provider>
  );
}

export function useTreeContext(): TreeContextValue {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error('useTreeContext must be used within a TreeProvider');
  return ctx;
}
```

#### Implementation — TreeNode

`src/components/tree/TreeNode.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { StatusDot } from './StatusDot';
import { useTreeContext } from './TreeContext';
import type { TreeNode as TreeNodeType } from '@/lib/query/tree';

interface TreeNodeProps {
  node: TreeNodeType;
  depth: number; // 0=plan, 1=feature, 2=task
}

export function TreeNode({ node, depth }: TreeNodeProps) {
  const { expandedNodes, selectedEntity, toggleExpand, select } =
    useTreeContext();

  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedEntity === node.id;
  const hasChildren = node.children.length > 0;
  const isGhost = (node as any)._ghost === true;

  // Derive display text based on entity type
  const displayText = getDisplayText(node);

  return (
    <div>
      <button
        data-entity-id={node.id}
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
        {/* Chevron for expandable nodes */}
        {hasChildren ? (
          <span
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.id);
            }}
          >
            <ChevronRight
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-90',
              )}
            />
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Status dot */}
        <StatusDot status={node.entity.status} />

        {/* Entity ID */}
        <span className="font-semibold font-mono shrink-0">{node.id}</span>

        {/* Display text — truncated */}
        <span className="font-normal text-muted-foreground truncate">
          {displayText}
        </span>
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**`getDisplayText` helper:**

| Entity Type | Source |
|-------------|-------|
| `plan` | `entity.title` |
| `feature` | `entity.label ?? entity.slug ?? entity.summary` |
| `task` | `entity.label ?? entity.slug ?? entity.summary` |

#### Files Touched

| File | Action |
|------|--------|
| `src/components/tree/TreeContext.tsx` | **Created** |
| `src/components/tree/TreeNode.tsx` | **Created** |

#### Dependencies

- T1 (UI store — `selectEntity`, `selectedEntityId`, `selectedEntityType`)
- T2 (`StatusDot`)
- F2 (`useProjectStore`, `TreeNode` type from `src/lib/query/tree.ts`)

#### Verification

1. Wrap a test area in `<TreeProvider>` → no errors
2. Render a Plan TreeNode with 2 Feature children → Plan visible, Features hidden (collapsed)
3. Click the Plan chevron → Features appear with `pl-6` indent. Chevron rotates 90°.
4. Click a Feature row → `selectedEntityId` updates in UI store. Row gets `bg-accent`.
5. Click chevron again → children collapse. Selection state preserved.
6. Call `expandTo('TASK-001')` where TASK-001 is nested under FEAT-001 under P1-kbzv → both P1-kbzv and FEAT-001 expand, TASK-001 scrolls into view
7. Render a ghost node → `opacity-50`, no click response

---

### T7: StandaloneSection — Bugs, Decisions, Incidents, Pending Checkpoints

**Effort:** 3 points

#### What to Do

Create the collapsible section component used for entity types that don't fit the Plan→Feature→Task hierarchy. Four instances: Bugs, Decisions, Incidents, and Pending Checkpoints. The checkpoint section has special orange highlighting and is always expanded when non-empty.

#### Implementation

`src/components/tree/StandaloneSection.tsx`:

```tsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from './StatusDot';
import { useTreeContext } from './TreeContext';

interface StandaloneSectionProps {
  title: string;
  entityType: string;
  entities: Array<{ id: string; status: string; displayText: string }>;
  showStatusDot: boolean;
  variant?: 'default' | 'pending-checkpoint';
}

export function StandaloneSection({
  title,
  entityType,
  entities,
  showStatusDot,
  variant = 'default',
}: StandaloneSectionProps) {
  const forceOpen = variant === 'pending-checkpoint';
  const [isOpen, setIsOpen] = useState(forceOpen);
  const { selectedEntity, select } = useTreeContext();

  const toggleOpen = () => setIsOpen((prev) => !prev);

  return (
    <div
      className={cn(
        'mt-4',
        variant === 'pending-checkpoint' &&
          'bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-400 rounded-r-md',
      )}
    >
      {/* Header */}
      <button
        className={cn(
          'flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-muted-foreground',
          variant === 'pending-checkpoint' &&
            'text-orange-700 dark:text-orange-300',
        )}
        onClick={() => !forceOpen && toggleOpen()}
        disabled={forceOpen}
      >
        {!forceOpen && (
          <ChevronRight
            className={cn(
              'w-4 h-4 transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
          />
        )}
        <span>{title}</span>
        {entities.length > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {entities.length}
          </Badge>
        )}
      </button>

      {/* Entity rows */}
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
                data-entity-id={entity.id}
                className={cn(
                  'flex items-center gap-1.5 w-full text-left py-1 px-6 rounded-md text-sm',
                  'hover:bg-accent/50 cursor-pointer',
                  selectedEntity === entity.id && 'bg-accent',
                  variant === 'pending-checkpoint' &&
                    'bg-orange-50/50 dark:bg-orange-950/50',
                )}
                onClick={() => select(entity.id, entityType)}
              >
                {variant === 'pending-checkpoint' ? (
                  <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                ) : showStatusDot ? (
                  <StatusDot status={entity.status} />
                ) : null}

                <span className="font-semibold font-mono shrink-0">
                  {entity.id}
                </span>
                <span className="text-muted-foreground truncate">
                  {entity.displayText}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

**Section visibility and behaviour:**

| Section | Status Dot | Default State | Collapsible | Special Styling |
|---------|-----------|---------------|-------------|-----------------|
| Bugs | Yes | Collapsed | Yes | None |
| Decisions | No | Collapsed | Yes | None |
| Incidents | Yes | Collapsed | Yes | None |
| Pending Checkpoints | AlertTriangle icon | Always expanded | No (force open) | Orange bg, orange border-left, orange header text |

**Display text per entity type:**

| Type | Display Text |
|------|-------------|
| `bug` | `bug.title` |
| `decision` | `decision.summary` |
| `incident` | `incident.title` |
| `checkpoint` | `checkpoint.question` (truncated) |

#### Files Touched

| File | Action |
|------|--------|
| `src/components/tree/StandaloneSection.tsx` | **Created** |

#### Dependencies

- T2 (`StatusDot`)
- T6 (`useTreeContext` — for selection state and select action)

#### Verification

1. Render Bugs section with 3 bugs → header shows "Bugs (3)", starts collapsed
2. Click header → section expands showing 3 bug rows with status dots
3. Render Decisions section → no status dots, just ID + summary
4. Render Pending Checkpoints with 1 entry → orange bg, always open, AlertTriangle icon, cannot collapse
5. Render Pending Checkpoints with 0 entries → section hidden entirely (checked at parent level)
6. Click an entity row → `selectedEntity` updates, row highlights with `bg-accent`
7. Render empty Bugs section (expanded) → "(none)" text shown

---

### T8: EntityTree — Full Tree with Filtering

**Effort:** 5 points

#### What to Do

Create the main `EntityTree` component that reads the full project tree from the store, applies the filter algorithm (type + status colour + ghost parents), sorts entities, and renders the Plan→Feature→Task hierarchy via `TreeNode` plus the standalone sections via `StandaloneSection`.

#### Implementation

`src/components/tree/EntityTree.tsx`:

```tsx
import { useMemo } from 'react';
import { useProjectStore } from '@/lib/store/project-store';
import { useUIStore } from '@/lib/store/ui-store';
import { getStatusColour } from '@/lib/constants/status-colours';
import { TreeNode } from './TreeNode';
import { StandaloneSection } from './StandaloneSection';
import { EmptyState } from '@/components/common/EmptyState';
import type { TreeNode as TreeNodeType } from '@/lib/query/tree';

// --- Filter algorithm (spec §6.3) ---

interface FilteredTreeNode extends TreeNodeType {
  _ghost: boolean;
}

function isVisible(
  entity: { status: string },
  entityType: string,
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): boolean {
  return (
    activeTypes.has(entityType) &&
    activeStatusColours.has(getStatusColour(entity.status))
  );
}

function filterFeatureNode(
  featureNode: TreeNodeType,
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): FilteredTreeNode | null {
  const featureVisible = isVisible(
    featureNode.entity, 'feature', activeTypes, activeStatusColours,
  );

  const filteredChildren = featureNode.children.filter((taskNode) =>
    isVisible(taskNode.entity, 'task', activeTypes, activeStatusColours),
  );

  if (featureVisible) {
    return {
      ...featureNode,
      children: filteredChildren.map((c) => ({ ...c, _ghost: false })),
      _ghost: false,
    } as FilteredTreeNode;
  }

  if (filteredChildren.length > 0) {
    return {
      ...featureNode,
      children: filteredChildren.map((c) => ({ ...c, _ghost: false })),
      _ghost: true,
    } as FilteredTreeNode;
  }

  return null;
}

function filterPlanNode(
  planNode: TreeNodeType,
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): FilteredTreeNode | null {
  const planVisible = isVisible(
    planNode.entity, 'plan', activeTypes, activeStatusColours,
  );

  const filteredChildren = planNode.children
    .map((f) => filterFeatureNode(f, activeTypes, activeStatusColours))
    .filter((n): n is FilteredTreeNode => n !== null);

  if (planVisible) {
    return { ...planNode, children: filteredChildren, _ghost: false } as FilteredTreeNode;
  }

  if (filteredChildren.length > 0) {
    return { ...planNode, children: filteredChildren, _ghost: true } as FilteredTreeNode;
  }

  return null;
}

function applyTreeFilters(
  tree: TreeNodeType[],
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): FilteredTreeNode[] {
  return tree
    .map((planNode) => filterPlanNode(planNode, activeTypes, activeStatusColours))
    .filter((n): n is FilteredTreeNode => n !== null);
}

// --- EntityTree component ---

export function EntityTree() {
  const {
    tree, bugs, decisions, incidents, pendingCheckpoints,
    plans, features, tasks,
  } = useProjectStore();
  const { activeTypes, activeStatusColours } = useUIStore();

  const filteredTree = useMemo(
    () => applyTreeFilters(tree, activeTypes, activeStatusColours),
    [tree, activeTypes, activeStatusColours],
  );

  const filteredBugs = useMemo(
    () =>
      [...bugs.values()]
        .filter((b) => activeStatusColours.has(getStatusColour(b.status)))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((b) => ({ id: b.id, status: b.status, displayText: b.title })),
    [bugs, activeStatusColours],
  );

  const filteredDecisions = useMemo(
    () =>
      [...decisions.values()]
        .filter((d) => activeStatusColours.has(getStatusColour(d.status)))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((d) => ({ id: d.id, status: d.status, displayText: d.summary })),
    [decisions, activeStatusColours],
  );

  const filteredIncidents = useMemo(
    () =>
      [...incidents.values()]
        .filter((i) => activeStatusColours.has(getStatusColour(i.status)))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((i) => ({ id: i.id, status: i.status, displayText: i.title })),
    [incidents, activeStatusColours],
  );

  const filteredPendingCheckpoints = useMemo(
    () =>
      pendingCheckpoints
        .filter((c) => activeStatusColours.has(getStatusColour(c.status)))
        .sort((a, b) => b.created.localeCompare(a.created))
        .map((c) => ({
          id: c.id,
          status: c.status,
          displayText: c.question.length > 60
            ? c.question.slice(0, 60) + '…'
            : c.question,
        })),
    [pendingCheckpoints, activeStatusColours],
  );

  // Empty state
  const isEmpty =
    plans.size === 0 && features.size === 0 && tasks.size === 0 &&
    bugs.size === 0 && decisions.size === 0 && incidents.size === 0;

  if (isEmpty) {
    return <EmptyState variant="no-data" />;
  }

  return (
    <div className="py-2">
      {filteredTree.map((planNode) => (
        <TreeNode key={planNode.id} node={planNode} depth={0} />
      ))}

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
  );
}
```

**Sorting rules (applied within tree builder from F2, and in standalone `useMemo` blocks):**

| Level | Sort Rule |
|-------|-----------|
| Plans | By prefix letter + number (extracted via `/^([A-Z])(\d+)-/`) |
| Features within a Plan | Lexicographic by ID (TSID13 → chronological) |
| Tasks within a Feature | Lexicographic by ID |
| Standalone Bugs/Decisions/Incidents | Lexicographic by ID |
| Pending Checkpoints | By `created` descending (newest first) |

#### Files Touched

| File | Action |
|------|--------|
| `src/components/tree/EntityTree.tsx` | **Created** |

#### Dependencies

- T6 (`TreeNode`)
- T7 (`StandaloneSection`)
- T1 (UI store — `activeTypes`, `activeStatusColours`)
- T13 (`EmptyState` variant — can use placeholder until T13)
- F2 (`useProjectStore`, `getStatusColour`, `TreeNode` type)

#### Verification

1. Load a project with 2 plans, each having features and tasks → full tree renders with correct nesting
2. Toggle `feature` type OFF → features disappear; plans with visible tasks show as ghosts
3. Toggle `yellow` status colour OFF → all `active`/`in-progress` entities disappear
4. Toggle `bug` type OFF → Bugs section disappears entirely
5. Empty project → `<EmptyState variant="no-data" />` shown
6. Verify plans sorted P1 before P2 before P10
7. Verify pending checkpoints sorted newest first
8. Verify ghost nodes have `opacity-50` and are non-interactive

---

### T9: DetailHeader + Shared Helpers

**Effort:** 2 points

#### What to Do

Create the shared `DetailHeader` component used at the top of every entity detail view, plus `RelatedEntitiesSection` and `RelatedEntityRow` helper components.

#### Implementation

These can live in `src/components/entity/DetailHeader.tsx` (exported, shared across all detail components):

```tsx
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StatusDot } from '@/components/tree/StatusDot';
import { EntityLink } from '@/components/common/EntityLink';
import type { LucideIcon } from 'lucide-react';

// --- Detail Header ---

interface DetailHeaderProps {
  icon: LucideIcon;
  entityId: string;
  summary: string;
  status: string;
  className?: string;
}

export function DetailHeader({
  icon: Icon,
  entityId,
  summary,
  status,
  className,
}: DetailHeaderProps) {
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

// --- Related Entities Section ---

export function RelatedEntitiesSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

// --- Related Entity Row ---

export function RelatedEntityRow({
  entityId,
  summary,
  status,
}: {
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

#### Files Touched

| File | Action |
|------|--------|
| `src/components/entity/DetailHeader.tsx` | **Created** |

#### Dependencies

- T2 (`StatusBadge`, `StatusDot`)
- T3 (`EntityLink`)

#### Verification

1. Render `<DetailHeader icon={Map} entityId="P1-kbzv" summary="KBZV Project" status="active" />` → icon, bold mono ID, summary text, yellow status badge
2. Render with `className="bg-orange-50 ..."` → orange background applied (for pending checkpoints)
3. Render `<RelatedEntitiesSection title="Tasks">...</RelatedEntitiesSection>` → separator line + uppercase label + children
4. Render `<RelatedEntityRow entityId="TASK-001" summary="Build tree" status="done" />` → clickable EntityLink + summary + green dot at right

---

### T10: Per-Type Detail Components

**Effort:** 5 points

#### What to Do

Create all 8 entity type detail components. Each follows the same pattern: DetailHeader at top, then FieldValue entries in the exact order specified, then RelatedEntitiesSection blocks with ProgressBar and EntityLinks. All 8 can be implemented in parallel.

#### Components and Their Field Tables

**PlanDetail.tsx** — `src/components/entity/PlanDetail.tsx`

Icon: `Map` from Lucide. Fields:

| # | Label | Field | Type | Condition |
|---|-------|-------|------|-----------|
| 1 | (header) | `title`, `status` | — | Always |
| 2 | Summary | `summary` | `long-text` | When populated |
| 3 | Slug | `slug` | `text` | When populated |
| 4 | Design | `design` | `entity-ref` | When populated |
| 5 | Tags | `tags` | `tag-list` | Non-empty array |
| 6 | Created | `created` | `timestamp` | Always |
| 7 | Created By | `created_by` | `text` | Always |
| 8 | Updated | `updated` | `timestamp` | Always |
| 9 | Supersedes | `supersedes` | `entity-ref` | When populated |
| 10 | Superseded By | `superseded_by` | `entity-ref` | When populated |

Related sections: Features (with `ProgressBar` + `featureCompletionForPlan`), Documents. Includes `EstimateDisplay` with `estimateRollupForPlan`.

**FeatureDetail.tsx** — `src/components/entity/FeatureDetail.tsx`

Icon: `Puzzle`. Fields:

| # | Label | Field | Type | Condition |
|---|-------|-------|------|-----------|
| 1 | (header) | `summary`, `status` | — | Always |
| 2 | Parent | `parent` | `entity-ref` | Always |
| 3 | Slug | `slug` | `text` | When populated |
| 4 | Estimate | `estimate` | `number` | Render as `"{value} pts"` or `"unestimated"` |
| 5 | Design | `design` | `entity-ref` | When populated |
| 6 | Spec | `spec` | `entity-ref` | When populated |
| 7 | Dev Plan | `dev_plan` | `entity-ref` | When populated |
| 8 | Tags | `tags` | `tag-list` | Non-empty array |
| 9 | Branch | `branch` | `text` | When populated; `font-mono` |
| 10 | Supersedes | `supersedes` | `entity-ref` | When populated |
| 11 | Superseded By | `superseded_by` | `entity-ref` | When populated |
| 12 | Created | `created` | `timestamp` | Always |
| 13 | Created By | `created_by` | `text` | Always |
| 14 | Updated | `updated` | `timestamp` | Always |

Related sections: Tasks (with `ProgressBar` + `taskCompletionForFeature`), Documents, Linked Bugs, Decisions. Includes `EstimateDisplay` with `estimateRollupForFeature`.

**TaskDetail.tsx** — `src/components/entity/TaskDetail.tsx`

Icon: `CheckSquare`. Fields:

| # | Label | Field | Type | Condition |
|---|-------|-------|------|-----------|
| 1 | (header) | `summary`, `status` | — | Always |
| 2 | Parent Feature | `parent_feature` | `entity-ref` | Always |
| 3 | Slug | `slug` | `text` | When populated |
| 4 | Estimate | `estimate` | `number` | When populated |
| 5 | Assignee | `assignee` | `text` | When populated |
| 6 | Depends On | `depends_on` | `entity-ref-list` | Non-empty array |
| 7 | Files Planned | `files_planned` | `string-list` | Non-empty array |
| 8 | Started | `started` | `timestamp` | When populated |
| 9 | Completed | `completed` | `timestamp` | When populated |
| 10 | Claimed At | `claimed_at` | `timestamp` | When populated |
| 11 | Dispatched To | `dispatched_to` | `text` | When populated |
| 12 | Dispatched At | `dispatched_at` | `timestamp` | When populated |
| 13 | Dispatched By | `dispatched_by` | `text` | When populated |
| 14 | Completion Summary | `completion_summary` | `long-text` | When populated |
| 15 | Rework Reason | `rework_reason` | `long-text` | When populated |
| 16 | Verification | `verification` | `long-text` | When populated |
| 17 | Tags | `tags` | `tag-list` | Non-empty array |

Related sections: Dependents (tasks that depend on this one), Linked Bugs.

**BugDetail.tsx** — `src/components/entity/BugDetail.tsx`

Icon: `Bug`. Fields:

| # | Label | Field | Type | Condition |
|---|-------|-------|------|-----------|
| 1 | (header) | `title`, `status` | — | Always |
| 2 | Severity | `severity` | `severity` | Always |
| 3 | Priority | `priority` | `priority` | Always |
| 4 | Type | `type` | `text` (as Badge) | Always |
| 5 | Slug | `slug` | `text` | When populated |
| 6 | Estimate | `estimate` | `number` | When populated |
| 7 | Reported By | `reported_by` | `text` | Always |
| 8 | Reported | `reported` | `timestamp` | When populated |
| 9 | Observed | `observed` | `long-text` | Always |
| 10 | Expected | `expected` | `long-text` | Always |
| 11 | Affects | `affects` | `entity-ref-list` | Non-empty array |
| 12 | Origin Feature | `origin_feature` | `entity-ref` | When populated |
| 13 | Origin Task | `origin_task` | `entity-ref` | When populated |
| 14 | Environment | `environment` | `text` | When populated |
| 15 | Reproduction | `reproduction` | `long-text` | When populated |
| 16 | Duplicate Of | `duplicate_of` | `entity-ref` | When populated |
| 17 | Fixed By | `fixed_by` | `text` | When populated |
| 18 | Verified By | `verified_by` | `text` | When populated |
| 19 | Release Target | `release_target` | `text` | When populated |
| 20 | Tags | `tags` | `tag-list` | Non-empty array |

**DecisionDetail.tsx** — `src/components/entity/DecisionDetail.tsx`

Icon: `Scale`. Fields:

| # | Label | Field | Type | Condition |
|---|-------|-------|------|-----------|
| 1 | (header) | `summary`, `status` | — | Always |
| 2 | Rationale | `rationale` | `long-text` | Always |
| 3 | Decided By | `decided_by` | `text` | Always |
| 4 | Date | `date` | `timestamp` | When populated |
| 5 | Affects | `affects` | `entity-ref-list` | Non-empty array |
| 6 | Supersedes | `supersedes` | `entity-ref` | When populated |
| 7 | Superseded By | `superseded_by` | `entity-ref` | When populated |
| 8 | Tags | `tags` | `tag-list` | Non-empty array |

**CheckpointDetail.tsx** — `src/components/entity/CheckpointDetail.tsx`

Icon: `CircleHelp`. Fields:

| # | Label | Field | Type | Condition | Notes |
|---|-------|-------|------|-----------|-------|
| 1 | (header) | `question`, `status` | — | Always | Orange wrap when `status === "pending"` |
| 2 | Question | `question` | `long-text` | Always | `alwaysExpanded={true}` |
| 3 | Context | `context` | `long-text` | When populated | Collapsible |
| 4 | Orchestration Summary | `orchestration_summary` | `long-text` | When populated | Collapsible |
| 5 | Created By | `created_by` | `text` | Always | |
| 6 | Response | `response` | `long-text` | Only when `status === "responded"` | `alwaysExpanded={true}` |
| 7 | Created | `created` | `timestamp` | Always | |
| 8 | Responded At | `responded_at` | `timestamp` | Only when `status === "responded"` | |

Special: When `entity.status === "pending"`, the `DetailHeader` receives `className="bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-400 rounded-r-md p-4"`.

**IncidentDetail.tsx** — `src/components/entity/IncidentDetail.tsx`

Icon: `AlertOctagon`. Fields:

| # | Label | Field | Type | Condition |
|---|-------|-------|------|-----------|
| 1 | (header) | `title`, `status` | — | Always |
| 2 | Severity | `severity` | `severity` | Always |
| 3 | Summary | `summary` | `long-text` | Always |
| 4 | Reported By | `reported_by` | `text` | Always |
| 5 | Detected At | `detected_at` | `timestamp` | When populated |
| 6 | Triaged At | `triaged_at` | `timestamp` | When populated |
| 7 | Mitigated At | `mitigated_at` | `timestamp` | When populated |
| 8 | Resolved At | `resolved_at` | `timestamp` | When populated |
| 9 | Affected Features | `affected_features` | `entity-ref-list` | Non-empty array |
| 10 | Linked Bugs | `linked_bugs` | `entity-ref-list` | Non-empty array |
| 11 | Linked RCA | `linked_rca` | `entity-ref` | When populated |

**KnowledgeDetail.tsx** — `src/components/entity/KnowledgeDetail.tsx`

Icon: `Lightbulb`. Fields:

| # | Label | Field | Type | Condition | Notes |
|---|-------|-------|------|-----------|-------|
| 1 | (header) | `topic`, `status` | — | Always | |
| 2 | Content | `content` | `long-text` | Always | `alwaysExpanded={true}` |
| 3 | Tier | `tier` | `text` (as Badge) | Always | `"Tier 2 (project)"` or `"Tier 3 (session)"` |
| 4 | Scope | `scope` | `text` | Always | |
| 5 | Learned From | `learned_from` | `entity-ref` | When populated | |
| 6 | Use Count | `use_count` | `number` | When populated | |
| 7 | Miss Count | `miss_count` | `number` | When populated | |
| 8 | Confidence | `confidence` | `number` | When populated | Format as percentage: `0.85` → `"85%"` |
| 9 | TTL Days | `ttl_days` | `number` | When populated | Render with `"days"` suffix |
| 10 | Git Anchors | `git_anchors` | `string-list` | Non-empty array | |
| 11 | Tags | `tags` | `tag-list` | Non-empty array | |
| 12 | Created | `created` | `timestamp` | Always | |
| 13 | Created By | `created_by` | `text` | Always | |
| 14 | Updated | `updated` | `timestamp` | Always | |

#### Example Component — PlanDetail

```tsx
import { useMemo } from 'react';
import { Map } from 'lucide-react';
import { useProjectStore } from '@/lib/store/project-store';
import { featureCompletionForPlan, estimateRollupForPlan } from '@/lib/query/metrics';
import { DetailHeader, RelatedEntitiesSection, RelatedEntityRow } from './DetailHeader';
import { FieldValue } from './FieldValue';
import { ProgressBar } from '@/components/metrics/ProgressBar';
import { EstimateDisplay } from '@/components/metrics/EstimateDisplay';
import type { Plan } from '@/lib/types';

interface PlanDetailProps {
  entity: Plan;
}

export function PlanDetail({ entity }: PlanDetailProps) {
  const { features, documents } = useProjectStore();

  const planFeatures = useMemo(
    () =>
      [...features.values()]
        .filter((f) => f.parent === entity.id)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [features, entity.id],
  );

  const featureMetrics = useMemo(
    () => featureCompletionForPlan(entity.id, features),
    [entity.id, features],
  );

  const planDocuments = useMemo(
    () =>
      [...documents.values()]
        .filter((d) => d.owner === entity.id)
        .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')),
    [documents, entity.id],
  );

  const planEstimate = useMemo(
    () => estimateRollupForPlan(entity.id, features),
    [entity.id, features],
  );

  return (
    <div className="space-y-6">
      <DetailHeader
        icon={Map}
        entityId={entity.id}
        summary={entity.title}
        status={entity.status}
      />

      <FieldValue label="Summary" value={entity.summary} type="long-text" />
      <FieldValue label="Slug" value={entity.slug} type="text"
                  className="text-xs text-muted-foreground" />
      <FieldValue label="Design" value={entity.design} type="entity-ref" />
      <FieldValue label="Tags" value={entity.tags} type="tag-list" />
      <FieldValue label="Created" value={entity.created} type="timestamp" />
      <FieldValue label="Created By" value={entity.created_by} type="text" />
      <FieldValue label="Updated" value={entity.updated} type="timestamp" />
      <FieldValue label="Supersedes" value={entity.supersedes} type="entity-ref" />
      <FieldValue label="Superseded By" value={entity.superseded_by} type="entity-ref" />

      <RelatedEntitiesSection title="Features">
        <ProgressBar
          done={featureMetrics.done}
          total={featureMetrics.total}
          percentage={featureMetrics.percentage}
          label="Features"
        />
        {planFeatures.map((f) => (
          <RelatedEntityRow
            key={f.id}
            entityId={f.id}
            summary={f.summary}
            status={f.status}
          />
        ))}
      </RelatedEntitiesSection>

      {planDocuments.length > 0 && (
        <RelatedEntitiesSection title="Documents">
          {planDocuments.map((d) => (
            <RelatedEntityRow
              key={d.id}
              entityId={d.id}
              summary={d.title ?? d.path}
              status={d.status}
            />
          ))}
        </RelatedEntitiesSection>
      )}

      <EstimateDisplay rollup={planEstimate} />
    </div>
  );
}
```

All 7 other detail components follow the same structural pattern — DetailHeader + FieldValue fields in order + RelatedEntitiesSection blocks.

#### Files Touched

| File | Action |
|------|--------|
| `src/components/entity/PlanDetail.tsx` | **Created** |
| `src/components/entity/FeatureDetail.tsx` | **Created** |
| `src/components/entity/TaskDetail.tsx` | **Created** |
| `src/components/entity/BugDetail.tsx` | **Created** |
| `src/components/entity/DecisionDetail.tsx` | **Created** |
| `src/components/entity/CheckpointDetail.tsx` | **Created** |
| `src/components/entity/IncidentDetail.tsx` | **Created** |
| `src/components/entity/KnowledgeDetail.tsx` | **Created** |

#### Dependencies

- T4 (`FieldValue`)
- T5 (`ProgressBar`, `EstimateDisplay`)
- T9 (`DetailHeader`, `RelatedEntitiesSection`, `RelatedEntityRow`)
- T3 (`EntityLink` — used within `RelatedEntityRow` and via `FieldValue`)
- F2 (all entity type interfaces, metric query functions, `useProjectStore`)

#### Verification

For each of the 8 components:

1. Render with a fully populated entity → all fields visible in correct order
2. Render with minimal entity (optional fields absent) → absent fields not rendered
3. Verify timestamps show relative time, hover shows full date
4. Verify entity references render as clickable EntityLinks
5. Verify tags render as secondary badges
6. **PlanDetail specific:** Features section shows progress bar with correct done/total
7. **FeatureDetail specific:** Tasks section shows task progress; estimate rollup displayed
8. **TaskDetail specific:** depends_on renders as entity-ref-list; broken refs render dimmed
9. **BugDetail specific:** severity and priority render as coloured badges
10. **CheckpointDetail specific:** pending status → orange background wrapping header; question always expanded
11. **KnowledgeDetail specific:** confidence field formatted as percentage; content always expanded

---

### T11: EntityDetail Router

**Effort:** 2 points

#### What to Do

Create the router component that dispatches to the correct detail component based on `entityType`. Handles null selection (default/empty state), entity not found (error state), and unknown entity types (generic fallback).

#### Implementation

`src/components/entity/EntityDetail.tsx`:

```tsx
import { AlertCircle, HelpCircle, LayoutDashboard, MousePointerClick } from 'lucide-react';
import {
  Map, Puzzle, CheckSquare, Bug, Scale, CircleHelp, AlertOctagon, Lightbulb,
} from 'lucide-react';
import { resolveEntity } from '@/lib/query/references';
import { useProjectStore } from '@/lib/store/project-store';
import { PlanDetail } from './PlanDetail';
import { FeatureDetail } from './FeatureDetail';
import { TaskDetail } from './TaskDetail';
import { BugDetail } from './BugDetail';
import { DecisionDetail } from './DecisionDetail';
import { CheckpointDetail } from './CheckpointDetail';
import { IncidentDetail } from './IncidentDetail';
import { KnowledgeDetail } from './KnowledgeDetail';
import { DefaultState } from './DefaultState'; // or inline

interface EntityDetailProps {
  entityId: string | null;
  entityType: string | null;
}

const DETAIL_COMPONENTS: Record<string, {
  component: React.ComponentType<{ entity: any }>;
  icon: any;
}> = {
  plan:       { component: PlanDetail,       icon: Map },
  feature:    { component: FeatureDetail,    icon: Puzzle },
  task:       { component: TaskDetail,       icon: CheckSquare },
  bug:        { component: BugDetail,        icon: Bug },
  decision:   { component: DecisionDetail,   icon: Scale },
  checkpoint: { component: CheckpointDetail, icon: CircleHelp },
  incident:   { component: IncidentDetail,   icon: AlertOctagon },
  knowledge:  { component: KnowledgeDetail,  icon: Lightbulb },
};

export function EntityDetail({ entityId, entityType }: EntityDetailProps) {
  const projectState = useProjectStore();

  // No selection → default state
  if (!entityId) {
    return <DefaultState />;
  }

  // Resolve entity
  const entity = resolveEntity(entityId, projectState);
  if (!entity) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">
          Entity not found: <code className="font-mono">{entityId}</code>
        </p>
      </div>
    );
  }

  // Type dispatch
  const config = entityType ? DETAIL_COMPONENTS[entityType] : null;
  if (config) {
    const { component: DetailComponent } = config;
    return <DetailComponent entity={entity} />;
  }

  // Unknown type fallback
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-bold font-mono">{entityId}</h2>
      </div>
      <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-md">
        {JSON.stringify(entity, null, 2)}
      </pre>
    </div>
  );
}
```

**DefaultState** (the project summary / "select an entity" state) is covered in T13.

#### Files Touched

| File | Action |
|------|--------|
| `src/components/entity/EntityDetail.tsx` | **Created** |

#### Dependencies

- T10 (all 8 detail components)
- T13 (`DefaultState` / `EmptyState` update — can stub initially)
- F2 (`resolveEntity`, `useProjectStore`)

#### Verification

1. `entityId = null` → project summary default state
2. `entityId = "P1-kbzv", entityType = "plan"` → PlanDetail rendered
3. `entityId = "FEAT-001", entityType = "feature"` → FeatureDetail rendered
4. `entityId = "NONEXISTENT"` → error state with AlertCircle and "Entity not found"
5. `entityId = "X-123", entityType = "alien"` → generic JSON fallback
6. Verify all 8 entity types route correctly

---

### T12: Filter Bar — Type Toggles + Status Colour Toggles

**Effort:** 3 points

#### What to Do

Create the filter bar that spans the full width above both columns. Contains two rows: type toggles (7 entity types with Lucide icons) and status colour toggles (7 colour groups). Plus a third row of active filter badges when any filter is active.

#### Implementation

**TypeToggle** — `src/components/filter/TypeToggle.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/toggle';
import type { EntityTypeInfo } from '@/lib/constants/entity-types';

interface TypeToggleProps {
  entityTypeInfo: EntityTypeInfo;
  isActive: boolean;
  onToggle: () => void;
}

export function TypeToggle({ entityTypeInfo, isActive, onToggle }: TypeToggleProps) {
  const IconComponent = entityTypeInfo.icon; // Lucide icon component
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

**StatusColourToggle** — `src/components/filter/StatusColourToggle.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  STATUS_COLOURS,
  STATUS_TO_COLOUR,
  type StatusColourName,
} from '@/lib/constants/status-colours';

interface StatusColourToggleProps {
  colour: StatusColourName;
  isActive: boolean;
  onToggle: () => void;
}

export function StatusColourToggle({
  colour,
  isActive,
  onToggle,
}: StatusColourToggleProps) {
  const hex = STATUS_COLOURS[colour];
  const tooltipStatuses = Object.entries(STATUS_TO_COLOUR)
    .filter(([, c]) => c === colour)
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

**FilterBar** — `src/components/filter/FilterBar.tsx`:

```tsx
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUIStore } from '@/lib/store/ui-store';
import { ENTITY_TYPES } from '@/lib/constants/entity-types';
import type { StatusColourName } from '@/lib/constants/status-colours';
import { TypeToggle } from './TypeToggle';
import { StatusColourToggle } from './StatusColourToggle';

const WORKFLOW_ENTITY_TYPES = [
  'plan', 'feature', 'task', 'bug', 'decision', 'incident', 'checkpoint',
] as const;

const COLOUR_GROUPS: StatusColourName[] = [
  'grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple',
];

export function FilterBar() {
  const {
    activeTypes, activeStatusColours,
    toggleType, toggleStatusColour,
  } = useUIStore();

  const inactiveTypes = WORKFLOW_ENTITY_TYPES.filter((t) => !activeTypes.has(t));
  const inactiveColours = COLOUR_GROUPS.filter((c) => !activeStatusColours.has(c));
  const hasActiveFilters = inactiveTypes.length > 0 || inactiveColours.length > 0;

  return (
    <div className="border-b px-4 py-2 space-y-2">
      {/* Row 1: Type toggles */}
      <div className="flex items-center gap-1">
        {WORKFLOW_ENTITY_TYPES.map((type) => (
          <TypeToggle
            key={type}
            entityTypeInfo={ENTITY_TYPES[type]}
            isActive={activeTypes.has(type)}
            onToggle={() => toggleType(type)}
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

      {/* Row 3: Active filter badges */}
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
  );
}
```

**Key notes:**
- `knowledge` and `document` are NOT in the filter bar type list
- Default: all types ON, all colours ON → no active filter badges shown
- Clicking a badge's `×` re-enables that type/colour (calls toggle)

#### Files Touched

| File | Action |
|------|--------|
| `src/components/filter/FilterBar.tsx` | **Created** |
| `src/components/filter/TypeToggle.tsx` | **Created** |
| `src/components/filter/StatusColourToggle.tsx` | **Created** |

#### Dependencies

- T1 (UI store — filter state and actions)
- F2 (`ENTITY_TYPES`, `STATUS_COLOURS`, `STATUS_TO_COLOUR`, `StatusColourName`)
- F1 (shadcn `Toggle`, `Badge`, `Tooltip` components)

#### Verification

1. All 7 type toggles render with correct icons and labels
2. Click a type toggle → opacity drops, type disappears from tree, active filter badge appears
3. Click the badge `×` → type re-enabled, badge disappears
4. All 7 colour toggles render with correct hex-coloured dots
5. Hover a colour toggle → tooltip shows all statuses in that group
6. Click a colour toggle → entities with matching statuses hidden from tree
7. Click another colour toggle → AND logic: both groups hidden
8. Verify `clearFilters()` restores all toggles to active state

---

### T13: EmptyState Update — Project Summary Variant

**Effort:** 2 points

#### What to Do

Modify the existing `EmptyState` component (from F1) to support a `"project-summary"` variant that renders the project overview with entity counts and overall progress bar. Also add a `"select-entity"` variant for the transient pre-load state.

#### Implementation

Update `src/components/common/EmptyState.tsx` to accept a `variant` prop:

```tsx
import { LayoutDashboard, MousePointerClick, Inbox } from 'lucide-react';
import { useProjectStore } from '@/lib/store/project-store';
import { ProgressBar } from '@/components/metrics/ProgressBar';

interface EmptyStateProps {
  variant: 'select-entity' | 'project-summary' | 'no-data';
}

export function EmptyState({ variant }: EmptyStateProps) {
  if (variant === 'no-data') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <Inbox className="w-12 h-12 text-muted-foreground/50" />
        <p className="text-sm">No workflow entities found</p>
        <p className="text-xs">Open a project with .kbz/state/ data</p>
      </div>
    );
  }

  if (variant === 'select-entity') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <MousePointerClick className="w-12 h-12 text-muted-foreground/50" />
        <p className="text-sm">Select an entity to view details</p>
      </div>
    );
  }

  // variant === 'project-summary'
  return <ProjectSummary />;
}

function ProjectSummary() {
  const {
    plans, features, tasks, bugs, decisions, incidents, pendingCheckpoints,
  } = useProjectStore();

  // Overall task completion
  const excluded = new Set(['not-planned', 'duplicate']);
  const allTasks = [...tasks.values()].filter((t) => !excluded.has(t.status));
  const doneTasks = allTasks.filter((t) => t.status === 'done');
  const overallTotal = allTasks.length;
  const overallDone = doneTasks.length;
  const overallPercentage =
    overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <LayoutDashboard className="w-12 h-12 text-muted-foreground/50" />

      <p className="text-sm">
        {plans.size} Plans · {features.size} Features · {tasks.size} Tasks
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
        {bugs.size} Bugs · {decisions.size} Decisions · {incidents.size} Incidents
      </p>

      {pendingCheckpoints.length > 0 && (
        <p className="text-sm text-orange-500 font-semibold">
          {pendingCheckpoints.length} Pending Checkpoint
          {pendingCheckpoints.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
```

#### Files Touched

| File | Action |
|------|--------|
| `src/components/common/EmptyState.tsx` | **Modified** — add variant prop and project-summary rendering |

#### Dependencies

- T5 (`ProgressBar`)
- F2 (`useProjectStore`)
- F1 (existing `EmptyState` component)

#### Verification

1. `<EmptyState variant="no-data" />` → Inbox icon + "No workflow entities found"
2. `<EmptyState variant="select-entity" />` → MousePointerClick icon + "Select an entity…"
3. `<EmptyState variant="project-summary" />` with loaded project → correct counts, progress bar with overall task completion
4. Project with 5/10 tasks done → "Overall 5/10 done (50%)" with 50% bar
5. Project with 2 pending checkpoints → orange "2 Pending Checkpoints" text
6. Empty project (0 everything) → "0 Plans · 0 Features · 0 Tasks", "Overall" with 0% bar

---

### T14: WorkflowsView Assembly — Final Integration

**Effort:** 3 points

#### What to Do

Create the top-level `WorkflowsView` component that composes `TreeProvider`, `FilterBar`, `EntityTree`, and `EntityDetail` into the two-column layout. Wire it into the header tab switcher from F1.

#### Implementation

`src/views/WorkflowsView.tsx`:

```tsx
import { FilterBar } from '@/components/filter/FilterBar';
import { EntityTree } from '@/components/tree/EntityTree';
import { EntityDetail } from '@/components/entity/EntityDetail';
import { TreeProvider } from '@/components/tree/TreeContext';
import { useUIStore } from '@/lib/store/ui-store';

export function WorkflowsView() {
  const selectedEntityId = useUIStore((s) => s.selectedEntityId);
  const selectedEntityType = useUIStore((s) => s.selectedEntityType);

  return (
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
  );
}
```

**Layout summary:**

| Area | Classes | Behaviour |
|------|---------|-----------|
| Root | `flex flex-col h-full overflow-hidden` | Fills available space below app header |
| Filter bar | `border-b px-4 py-2` | Fixed at top, does not scroll |
| Column container | `flex flex-1 overflow-hidden` | Horizontal split |
| Left column | `w-80 min-w-[280px] overflow-y-auto border-r` | 320px, independent scroll, right border |
| Right column | `flex-1 overflow-y-auto` | Fills remaining, independent scroll |
| Detail content | `max-w-[700px] p-6` | Constrained width, left-aligned |

**Wiring into F1 header:**

In `src/components/layout/MainPanel.tsx` (or wherever F1's active view switcher is), add a case for the Workflows view:

```tsx
case 'workflows':
  return <WorkflowsView />;
```

#### Files Touched

| File | Action |
|------|--------|
| `src/views/WorkflowsView.tsx` | **Created** |
| `src/components/layout/MainPanel.tsx` | **Modified** — add `WorkflowsView` case |

#### Dependencies

- **All preceding tasks** (T1–T13)
- F1 (`MainPanel.tsx` for view routing)

#### Verification

1. Switch to Workflows tab → `WorkflowsView` mounts with filter bar, tree, and detail panel
2. Tree shows project entities; first plan is expanded
3. Click an entity → detail panel updates
4. Filter bar toggles work → tree re-renders with filtered/ghost nodes
5. Both columns scroll independently
6. Filter bar stays fixed at top
7. No selection → project summary default state in detail panel
8. Click EntityLink in detail → tree navigates to target entity
9. Resize window → left column respects `min-w-[280px]`, right column fills remaining space
10. **Full end-to-end:** load a project, browse tree, inspect entities, filter by status, click EntityLinks — verify all flows from spec §10.1–10.5

---

## Summary Table

| Task | Component(s) | Files | Points | Depends On |
|------|-------------|-------|--------|------------|
| T1 | UI Store Extensions | 1 modified | 2 | F1, F2 |
| T2 | StatusDot, StatusBadge | 2 created | 2 | T1, F2 |
| T3 | EntityLink | 1 created | 3 | F2, T6* |
| T4 | FieldValue | 1 created, 1 modified | 5 | T2, T3 |
| T5 | ProgressBar, EstimateDisplay | 2 created | 2 | F2 |
| T6 | TreeContext, TreeNode | 2 created | 5 | T1, T2, F2 |
| T7 | StandaloneSection | 1 created | 3 | T2, T6 |
| T8 | EntityTree | 1 created | 5 | T6, T7, T1, F2 |
| T9 | DetailHeader + helpers | 1 created | 2 | T2, T3 |
| T10 | 8 Detail Components | 8 created | 5 | T4, T5, T9 |
| T11 | EntityDetail Router | 1 created | 2 | T10, T13 |
| T12 | FilterBar, TypeToggle, StatusColourToggle | 3 created | 3 | T1, F2 |
| T13 | EmptyState update | 1 modified | 2 | T5, F2 |
| T14 | WorkflowsView | 1 created, 1 modified | 3 | All |
| **Total** | | **26 created, 3 modified** | **34** | |

---

## Complete File Manifest

### New Files (26)

| # | Path | Created In |
|---|------|-----------|
| 1 | `src/views/WorkflowsView.tsx` | T14 |
| 2 | `src/components/tree/EntityTree.tsx` | T8 |
| 3 | `src/components/tree/TreeNode.tsx` | T6 |
| 4 | `src/components/tree/TreeContext.tsx` | T6 |
| 5 | `src/components/tree/StandaloneSection.tsx` | T7 |
| 6 | `src/components/tree/StatusDot.tsx` | T2 |
| 7 | `src/components/entity/EntityDetail.tsx` | T11 |
| 8 | `src/components/entity/DetailHeader.tsx` | T9 |
| 9 | `src/components/entity/FieldValue.tsx` | T4 |
| 10 | `src/components/entity/PlanDetail.tsx` | T10 |
| 11 | `src/components/entity/FeatureDetail.tsx` | T10 |
| 12 | `src/components/entity/TaskDetail.tsx` | T10 |
| 13 | `src/components/entity/BugDetail.tsx` | T10 |
| 14 | `src/components/entity/DecisionDetail.tsx` | T10 |
| 15 | `src/components/entity/CheckpointDetail.tsx` | T10 |
| 16 | `src/components/entity/IncidentDetail.tsx` | T10 |
| 17 | `src/components/entity/KnowledgeDetail.tsx` | T10 |
| 18 | `src/components/filter/FilterBar.tsx` | T12 |
| 19 | `src/components/filter/TypeToggle.tsx` | T12 |
| 20 | `src/components/filter/StatusColourToggle.tsx` | T12 |
| 21 | `src/components/metrics/ProgressBar.tsx` | T5 |
| 22 | `src/components/metrics/EstimateDisplay.tsx` | T5 |
| 23 | `src/components/common/StatusBadge.tsx` | T2 |
| 24 | `src/components/common/EntityLink.tsx` | T3 |

### Modified Files (3)

| # | Path | Modified In | Change |
|---|------|------------|--------|
| 1 | `src/lib/store/ui-store.ts` | T1 | Add selection + filter state |
| 2 | `src/components/common/EmptyState.tsx` | T13 | Add project-summary variant |
| 3 | `src/components/layout/MainPanel.tsx` | T14 | Add WorkflowsView case |

### External Dependency

| Package | Version | Needed By |
|---------|---------|-----------|
| `date-fns` | `^4.x` | T4 (FieldValue timestamp rendering) |

---

## Testing Strategy

### Unit Tests

| Scope | What to Test | Priority |
|-------|-------------|----------|
| `getStatusColour` / `getStatusHex` | All known statuses map correctly; unknown returns grey | High |
| Filter algorithm (`applyTreeFilters`) | AND logic, ghost parent generation, edge cases (empty tree, all filtered out) | High |
| `isVisible` helper | Type ON + colour ON → true; either OFF → false | High |
| Task completion metrics | Correct done/total excluding `not-planned`/`duplicate`; division by zero safe | High |
| Estimate rollup | Correct sum; unestimated counted, not zeroed | Medium |
| `resolveEntityType` | All prefix patterns match correctly; unknown returns null | Medium |
| `LongTextValue` | 3-line threshold; expand/collapse toggle; `alwaysExpanded` bypass | Medium |

### Component Tests (React Testing Library)

| Component | What to Test | Priority |
|-----------|-------------|----------|
| `StatusBadge` | Correct colour class per status; click fires `activateStatusFilter` | High |
| `StatusDot` | Correct hex per status; unknown → grey hex | High |
| `EntityLink` | Found state: tooltip + clickable; not-found state: line-through + no-op click | High |
| `FieldValue` | Each of the 11 types renders correctly; absent-field rule | High |
| `TreeNode` | Expand/collapse; selection highlight; ghost state; correct indentation | High |
| `StandaloneSection` | Collapse/expand; forced open for checkpoints; orange styling | Medium |
| `FilterBar` | Toggle interactions; active filter badges appear/disappear | Medium |
| `EntityDetail` | Router dispatches correctly for all 8 types + null + not-found | Medium |
| `WorkflowsView` | Layout renders; columns present; filter bar fixed | Low |

### Visual / Manual Tests

| Flow | Steps | Validates |
|------|-------|-----------|
| Browse tree | Load project → expand Plan → expand Feature → click Task | AC-1, AC-3, AC-4 |
| Inspect entity detail | Click each entity type → verify all fields | AC-5 |
| Status colours | Check 1 entity per colour group | AC-2 |
| Progress bars | Feature with 3/5 done → verify bar and text | AC-6 |
| Estimate rollup | Feature with mixed estimates → verify display | AC-7 |
| Broken reference | Entity with `depends_on` pointing to NONEXISTENT → verify dimmed rendering | AC-8 |
| Unknown status | Set entity to status `"banana"` → verify grey rendering | AC-9 |
| Type filter | Toggle Bug OFF → Bugs section disappears; toggle back → reappears | AC-10 |
| Status colour filter | Toggle yellow OFF → active/in-progress entities vanish; ghost parents appear | AC-11 |
| Detail panel filter activation | Click StatusBadge → only that colour group visible | AC-13 |
| Pending checkpoints | Load project with pending checkpoint → verify orange highlight, always open | AC-14 |
| Default state | No selection → project summary with counts | AC-15 |
| EntityLink navigation | Click parent EntityLink → tree navigates | AC-16 |
| Standalone sections | Verify bugs/decisions/incidents render correctly | AC-17 |
| Sorting | Plans: P1 < P2 < P10; features/tasks: chronological by ID | AC-18 |

---

## Risk Areas

### R1: Performance with Large Projects

**Risk:** Projects with hundreds of entities may cause slow tree re-renders, especially when filtering triggers `useMemo` recalculations on every toggle.

**Mitigation:** The filter algorithm is `O(n)` where `n` is total entities — acceptable for expected project sizes (< 500 entities). If performance issues emerge, add `React.memo()` to `TreeNode` and `StandaloneSection`. Virtual scrolling (e.g. `@tanstack/virtual`) can be added later as a non-breaking enhancement.

### R2: Zustand Set Equality

**Risk:** Zustand performs shallow equality checks. `Set` objects are compared by reference, so every `toggleType` / `toggleStatusColour` call creates a new `Set` and triggers re-renders of all subscribers.

**Mitigation:** Use selector functions in consumers to extract only the needed state. For example, `useUIStore((s) => s.activeTypes.has('bug'))` in a specific component limits re-renders to when that specific value changes. However, this requires Zustand's `shallow` comparator for Set-derived values. Test re-render frequency with React DevTools.

### R3: EntityLink ↔ TreeContext Coupling

**Risk:** `EntityLink` calls `useTreeContext()` for within-tree navigation, but may also be rendered in contexts where `TreeProvider` is absent (e.g. future F5 cross-view navigation).

**Mitigation:** Guard the `useTreeContext()` call in EntityLink with `try/catch` — if the context is unavailable, the click handler falls through to a no-op. This makes EntityLink safe to use anywhere without breaking.

### R4: date-fns Bundle Size

**Risk:** Importing `date-fns` adds to the bundle. The `formatDistanceToNow` function pulls in locale data.

**Mitigation:** Use tree-shakeable imports: `import { formatDistanceToNow } from 'date-fns'`. Only this one function is needed. Verify bundle impact with `vite-bundle-analyzer` if concerned.

### R5: Dark Mode Colour Consistency

**Risk:** Every colour-bearing component (`StatusBadge`, `StatusDot`, severity/priority badges, pending checkpoint orange) needs both light and dark mode classes. Missing `dark:` variants will look broken.

**Mitigation:** The spec provides exact `dark:` classes for every colour. During implementation, test each component in both themes. The shadcn theme toggle (from F1) makes this easy to verify visually.

### R6: Orphaned Entities

**Risk:** Features without a valid parent plan, or tasks without a valid parent feature, won't appear in the tree hierarchy. The spec mentions rendering orphaned entities but doesn't prescribe exact handling.

**Mitigation:** For F3, orphaned entities simply won't appear in the tree. They can still be navigated to via EntityLinks in detail panels. A future enhancement can add an "Orphaned" section at the bottom of the tree.

---

## Implementation Order (Recommended Sequence)

| Phase | Tasks | Rationale |
|-------|-------|-----------|
| **Phase 1: Foundations** | T1, T2, T5 | UI store extensions + leaf components with no internal deps. Can run in parallel. |
| **Phase 2: Core Components** | T3, T4, T6 | EntityLink, FieldValue, TreeContext+TreeNode — building blocks for everything above. T4 depends on T2+T3. T6 depends on T1+T2. |
| **Phase 3: Tree Assembly** | T7, T8 | StandaloneSection + full EntityTree with filtering. Depends on Phase 2. |
| **Phase 4: Detail Panel** | T9, T10, T11 | DetailHeader → 8 detail components → EntityDetail router. Sequential chain. |
| **Phase 5: Filter + Polish** | T12, T13 | FilterBar + EmptyState update. T12 depends on T1. T13 depends on T5. |
| **Phase 6: Integration** | T14 | WorkflowsView assembly. Depends on everything. |

**Critical path:** T1 → T2 → T6 → T8 → T14 (tree side) and T1 → T2 → T4 → T10 → T11 → T14 (detail side).

---

## References

- **Specification:** `work/spec/f3-workflows-view-spec.md`
- **Design:** `work/design/f3-workflows-view.md`
- **Architecture:** `work/design/kbzv-architecture.md`
- **F1 Spec:** `work/spec/f1-app-scaffold-theme-spec.md`
- **F2 Spec:** `work/spec/f2-data-layer-spec.md`
