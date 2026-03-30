// src/lib/__tests__/f3-tree-filters.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import type { Plan, Feature, Task } from '../types';
import { applyTreeFilters, isVisible } from '../../components/tree/treeFilters';
import type { TreeNode } from '../query/tree';
import { useUIStore } from '../store/ui-store';

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
    summary: 'test feature',
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
    status: 'ready',
    summary: 'test task',
    ...overrides,
  };
}

function makePlanNode(
  plan: Plan,
  children: TreeNode[] = [],
): TreeNode {
  return { entity: plan, entityType: 'plan', id: plan.id, children };
}

function makeFeatureNode(
  feature: Feature,
  children: TreeNode[] = [],
): TreeNode {
  return { entity: feature, entityType: 'feature', id: feature.id, children };
}

function makeTaskNode(task: Task): TreeNode {
  return { entity: task, entityType: 'task', id: task.id, children: [] };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('isVisible', () => {
  const ALL_TYPES = new Set(['plan', 'feature', 'task', 'bug', 'decision', 'incident', 'checkpoint']);
  const ALL_COLOURS = new Set(['grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple']);

  it('returns true when type and colour are both active', () => {
    expect(isVisible({ status: 'active' }, 'task', ALL_TYPES, ALL_COLOURS)).toBe(true);
  });

  it('returns false when type is not active', () => {
    const noTasks = new Set(['plan', 'feature']);
    expect(isVisible({ status: 'active' }, 'task', noTasks, ALL_COLOURS)).toBe(false);
  });

  it('returns false when status colour is not active', () => {
    const noYellow = new Set(['grey', 'blue', 'orange', 'green', 'red', 'purple']);
    // 'active' maps to 'yellow'
    expect(isVisible({ status: 'active' }, 'task', ALL_TYPES, noYellow)).toBe(false);
  });

  it('maps unknown status to grey and checks grey colour', () => {
    const noGrey = new Set(['blue', 'yellow', 'orange', 'green', 'red', 'purple']);
    expect(isVisible({ status: 'unknown-xyz' }, 'task', ALL_TYPES, noGrey)).toBe(false);
    expect(isVisible({ status: 'unknown-xyz' }, 'task', ALL_TYPES, ALL_COLOURS)).toBe(true);
  });
});

describe('applyTreeFilters', () => {
  const ALL_TYPES = new Set(['plan', 'feature', 'task', 'bug', 'decision', 'incident', 'checkpoint']);
  const ALL_COLOURS = new Set(['grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple']);

  it('returns all nodes when no filters are active', () => {
    const plan = makePlan({ id: 'P1-test', status: 'active' });
    const feature = makeFeature({ id: 'FEAT-001', parent: 'P1-test', status: 'developing' });
    const task = makeTask({ id: 'TASK-001', parent_feature: 'FEAT-001', status: 'ready' });

    const tree: TreeNode[] = [
      makePlanNode(plan, [
        makeFeatureNode(feature, [makeTaskNode(task)]),
      ]),
    ];

    const result = applyTreeFilters(tree, ALL_TYPES, ALL_COLOURS);
    expect(result).toHaveLength(1);
    expect(result[0]._ghost).toBe(false);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0]._ghost).toBe(false);
    expect(result[0].children[0].children).toHaveLength(1);
  });

  it('omits plan entirely when plan type is off and plan has no visible children', () => {
    const plan = makePlan({ id: 'P1-test', status: 'active' });
    const tree: TreeNode[] = [makePlanNode(plan, [])];

    const noPlan = new Set(['feature', 'task', 'bug', 'decision', 'incident', 'checkpoint']);
    const result = applyTreeFilters(tree, noPlan, ALL_COLOURS);
    expect(result).toHaveLength(0);
  });

  it('renders plan as ghost when plan type is off but has visible children', () => {
    const plan = makePlan({ id: 'P1-test', status: 'active' });
    const feature = makeFeature({ id: 'FEAT-001', parent: 'P1-test', status: 'developing' });

    const tree: TreeNode[] = [
      makePlanNode(plan, [makeFeatureNode(feature, [])]),
    ];

    const noPlan = new Set(['feature', 'task', 'bug', 'decision', 'incident', 'checkpoint']);
    const result = applyTreeFilters(tree, noPlan, ALL_COLOURS);

    expect(result).toHaveLength(1);
    expect(result[0]._ghost).toBe(true);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0]._ghost).toBe(false);
  });

  it('renders feature as ghost when feature type is off but has visible tasks', () => {
    const plan = makePlan({ id: 'P1-test', status: 'active' });
    const feature = makeFeature({ id: 'FEAT-001', parent: 'P1-test', status: 'developing' });
    const task = makeTask({ id: 'TASK-001', parent_feature: 'FEAT-001', status: 'ready' });

    const tree: TreeNode[] = [
      makePlanNode(plan, [
        makeFeatureNode(feature, [makeTaskNode(task)]),
      ]),
    ];

    const noFeature = new Set(['plan', 'task', 'bug', 'decision', 'incident', 'checkpoint']);
    const result = applyTreeFilters(tree, noFeature, ALL_COLOURS);

    expect(result).toHaveLength(1);
    expect(result[0]._ghost).toBe(false);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0]._ghost).toBe(true);
    expect(result[0].children[0].children).toHaveLength(1);
  });

  it('omits feature entirely when feature type is off and no tasks match', () => {
    const plan = makePlan({ id: 'P1-test', status: 'active' });
    const feature = makeFeature({ id: 'FEAT-001', parent: 'P1-test', status: 'developing' });

    const tree: TreeNode[] = [
      makePlanNode(plan, [makeFeatureNode(feature, [])]),
    ];

    const noFeature = new Set(['plan', 'task', 'bug', 'decision', 'incident', 'checkpoint']);
    const result = applyTreeFilters(tree, noFeature, ALL_COLOURS);

    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(0);
  });

  it('hides tasks when task type is off', () => {
    const plan = makePlan({ id: 'P1-test', status: 'active' });
    const feature = makeFeature({ id: 'FEAT-001', parent: 'P1-test', status: 'developing' });
    const task = makeTask({ id: 'TASK-001', parent_feature: 'FEAT-001', status: 'ready' });

    const tree: TreeNode[] = [
      makePlanNode(plan, [
        makeFeatureNode(feature, [makeTaskNode(task)]),
      ]),
    ];

    const noTask = new Set(['plan', 'feature', 'bug', 'decision', 'incident', 'checkpoint']);
    const result = applyTreeFilters(tree, noTask, ALL_COLOURS);

    expect(result[0].children[0].children).toHaveLength(0);
    expect(result[0].children[0]._ghost).toBe(false);
  });

  it('hides entities whose status colour is filtered out', () => {
    const plan = makePlan({ id: 'P1-test', status: 'active' }); // yellow
    const tree: TreeNode[] = [makePlanNode(plan, [])];

    const noYellow = new Set(['grey', 'blue', 'orange', 'green', 'red', 'purple']);
    const result = applyTreeFilters(tree, ALL_TYPES, noYellow);

    expect(result).toHaveLength(0);
  });

  it('handles empty tree', () => {
    const result = applyTreeFilters([], ALL_TYPES, ALL_COLOURS);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when all types are filtered out', () => {
    const plan = makePlan({ id: 'P1-test', status: 'active' });
    const tree: TreeNode[] = [makePlanNode(plan, [])];

    const noTypes = new Set<string>();
    const result = applyTreeFilters(tree, noTypes, ALL_COLOURS);
    expect(result).toHaveLength(0);
  });
});

// ── UI Store — selection and filter state ───────────────────────────

describe('ui-store — selection state', () => {
  beforeEach(() => {
    useUIStore.setState({
      selectedEntityId: null,
      selectedEntityType: null,
    });
  });

  it('selectEntity sets selectedEntityId and selectedEntityType', () => {
    useUIStore.getState().selectEntity('FEAT-001', 'feature');
    const state = useUIStore.getState();
    expect(state.selectedEntityId).toBe('FEAT-001');
    expect(state.selectedEntityType).toBe('feature');
  });

  it('selectEntity(null, null) clears selection', () => {
    useUIStore.getState().selectEntity('FEAT-001', 'feature');
    useUIStore.getState().selectEntity(null, null);
    const state = useUIStore.getState();
    expect(state.selectedEntityId).toBeNull();
    expect(state.selectedEntityType).toBeNull();
  });
});

describe('ui-store — filter state', () => {
  const DEFAULT_TYPES = new Set(['plan', 'feature', 'task', 'bug', 'decision', 'incident', 'checkpoint']);
  const DEFAULT_COLOURS = new Set(['grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple']);

  beforeEach(() => {
    useUIStore.setState({
      activeTypes: new Set(DEFAULT_TYPES),
      activeStatusColours: new Set(DEFAULT_COLOURS),
    });
  });

  it('defaults to all types active', () => {
    const state = useUIStore.getState();
    for (const type of DEFAULT_TYPES) {
      expect(state.activeTypes.has(type)).toBe(true);
    }
  });

  it('defaults to all colour groups active', () => {
    const state = useUIStore.getState();
    for (const colour of DEFAULT_COLOURS) {
      expect(state.activeStatusColours.has(colour)).toBe(true);
    }
  });

  it('toggleType removes an active type', () => {
    useUIStore.getState().toggleType('bug');
    expect(useUIStore.getState().activeTypes.has('bug')).toBe(false);
  });

  it('toggleType re-adds an inactive type', () => {
    useUIStore.getState().toggleType('bug');
    useUIStore.getState().toggleType('bug');
    expect(useUIStore.getState().activeTypes.has('bug')).toBe(true);
  });

  it('toggleStatusColour removes an active colour', () => {
    useUIStore.getState().toggleStatusColour('green');
    expect(useUIStore.getState().activeStatusColours.has('green')).toBe(false);
  });

  it('toggleStatusColour re-adds an inactive colour', () => {
    useUIStore.getState().toggleStatusColour('green');
    useUIStore.getState().toggleStatusColour('green');
    expect(useUIStore.getState().activeStatusColours.has('green')).toBe(true);
  });

  it('clearFilters restores all defaults', () => {
    useUIStore.getState().toggleType('bug');
    useUIStore.getState().toggleType('decision');
    useUIStore.getState().toggleStatusColour('red');
    useUIStore.getState().clearFilters();

    const state = useUIStore.getState();
    for (const type of DEFAULT_TYPES) {
      expect(state.activeTypes.has(type)).toBe(true);
    }
    for (const colour of DEFAULT_COLOURS) {
      expect(state.activeStatusColours.has(colour)).toBe(true);
    }
  });

  it('activateStatusFilter sets only the matching colour group', () => {
    // 'done' maps to 'green'
    useUIStore.getState().activateStatusFilter('done');
    const state = useUIStore.getState();
    expect(state.activeStatusColours.has('green')).toBe(true);
    expect(state.activeStatusColours.has('yellow')).toBe(false);
    expect(state.activeStatusColours.has('grey')).toBe(false);
    expect(state.activeStatusColours.size).toBe(1);
  });

  it('activateStatusFilter works for orange status (pending)', () => {
    useUIStore.getState().activateStatusFilter('pending');
    const state = useUIStore.getState();
    expect(state.activeStatusColours.has('orange')).toBe(true);
    expect(state.activeStatusColours.size).toBe(1);
  });

  it('activateStatusFilter with unknown status activates grey', () => {
    useUIStore.getState().activateStatusFilter('unknown-future-status');
    const state = useUIStore.getState();
    expect(state.activeStatusColours.has('grey')).toBe(true);
    expect(state.activeStatusColours.size).toBe(1);
  });
});
