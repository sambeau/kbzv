// src/lib/__tests__/tree.test.ts

import { describe, it, expect } from 'vitest';
import type { Plan, Feature, Task } from '../types';
import { buildTree } from '../query/tree';

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
    summary: 'test',
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
    summary: 'test',
    status: 'active',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('buildTree', () => {
  it('returns empty array for empty maps', () => {
    const tree = buildTree(new Map(), new Map(), new Map());
    expect(tree).toEqual([]);
  });

  it('sorts plans by prefix letter then numeric index', () => {
    const plans = new Map<string, Plan>([
      ['P2-beta', makePlan({ id: 'P2-beta' })],
      ['P1-alpha', makePlan({ id: 'P1-alpha' })],
      ['P10-gamma', makePlan({ id: 'P10-gamma' })],
    ]);
    const tree = buildTree(plans, new Map(), new Map());
    expect(tree.map((n) => n.id)).toEqual(['P1-alpha', 'P2-beta', 'P10-gamma']);
  });

  it('nests features under their parent plan', () => {
    const plans = new Map([['P1-test', makePlan({ id: 'P1-test' })]]);
    const features = new Map([
      [
        'FEAT-01AAA',
        makeFeature({ id: 'FEAT-01AAA', parent: 'P1-test' }),
      ],
    ]);
    const tree = buildTree(plans, features, new Map());
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('FEAT-01AAA');
    expect(tree[0].children[0].entityType).toBe('feature');
  });

  it('nests tasks under their parent feature', () => {
    const plans = new Map([['P1-test', makePlan({ id: 'P1-test' })]]);
    const features = new Map([
      [
        'FEAT-01AAA',
        makeFeature({ id: 'FEAT-01AAA', parent: 'P1-test' }),
      ],
    ]);
    const tasks = new Map([
      [
        'TASK-01DDD',
        makeTask({ id: 'TASK-01DDD', parent_feature: 'FEAT-01AAA' }),
      ],
    ]);
    const tree = buildTree(plans, features, tasks);
    const taskNodes = tree[0].children[0].children;
    expect(taskNodes).toHaveLength(1);
    expect(taskNodes[0].id).toBe('TASK-01DDD');
    expect(taskNodes[0].entityType).toBe('task');
    expect(taskNodes[0].children).toEqual([]);
  });

  it('sorts features within a plan by ID', () => {
    const plans = new Map([['P1-test', makePlan({ id: 'P1-test' })]]);
    const features = new Map([
      ['FEAT-01BBB', makeFeature({ id: 'FEAT-01BBB', parent: 'P1-test' })],
      ['FEAT-01AAA', makeFeature({ id: 'FEAT-01AAA', parent: 'P1-test' })],
    ]);
    const tree = buildTree(plans, features, new Map());
    expect(tree[0].children.map((n) => n.id)).toEqual([
      'FEAT-01AAA',
      'FEAT-01BBB',
    ]);
  });

  it('sorts tasks within a feature by ID', () => {
    const plans = new Map([['P1-test', makePlan({ id: 'P1-test' })]]);
    const features = new Map([
      ['FEAT-01AAA', makeFeature({ id: 'FEAT-01AAA', parent: 'P1-test' })],
    ]);
    const tasks = new Map([
      ['TASK-01BBB', makeTask({ id: 'TASK-01BBB', parent_feature: 'FEAT-01AAA' })],
      ['TASK-01AAA', makeTask({ id: 'TASK-01AAA', parent_feature: 'FEAT-01AAA' })],
    ]);
    const tree = buildTree(plans, features, tasks);
    expect(tree[0].children[0].children.map((n) => n.id)).toEqual([
      'TASK-01AAA',
      'TASK-01BBB',
    ]);
  });

  it('creates orphaned plan for features with missing parent', () => {
    const plans = new Map<string, Plan>();
    const features = new Map([
      [
        'FEAT-01CCC',
        makeFeature({ id: 'FEAT-01CCC', parent: 'P99-nonexistent' }),
      ],
    ]);
    const tree = buildTree(plans, features, new Map());
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('__orphaned__');
    expect(tree[0].entityType).toBe('plan');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('FEAT-01CCC');
  });

  it('creates orphaned feature for tasks with missing parent', () => {
    const plans = new Map<string, Plan>();
    const features = new Map<string, Feature>();
    const tasks = new Map([
      [
        'TASK-01GGG',
        makeTask({ id: 'TASK-01GGG', parent_feature: 'FEAT-99NONEXISTENT' }),
      ],
    ]);
    const tree = buildTree(plans, features, tasks);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('__orphaned__');
    const orphanFeature = tree[0].children.find(
      (n) => n.id === '__orphaned-tasks__',
    );
    expect(orphanFeature).toBeDefined();
    expect(orphanFeature!.children).toHaveLength(1);
    expect(orphanFeature!.children[0].id).toBe('TASK-01GGG');
  });

  it('orphaned plan is appended at the end after real plans', () => {
    const plans = new Map([['P1-real', makePlan({ id: 'P1-real' })]]);
    const features = new Map([
      ['FEAT-01AAA', makeFeature({ id: 'FEAT-01AAA', parent: 'P99-missing' })],
    ]);
    const tree = buildTree(plans, features, new Map());
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe('P1-real');
    expect(tree[1].id).toBe('__orphaned__');
  });

  it('sets correct entityType on plan nodes', () => {
    const plans = new Map([['P1-test', makePlan({ id: 'P1-test' })]]);
    const tree = buildTree(plans, new Map(), new Map());
    expect(tree[0].entityType).toBe('plan');
  });

  it('plan with no features has empty children', () => {
    const plans = new Map([['P1-empty', makePlan({ id: 'P1-empty' })]]);
    const tree = buildTree(plans, new Map(), new Map());
    expect(tree[0].children).toEqual([]);
  });

  it('sorts plans with different prefix letters alphabetically', () => {
    const plans = new Map<string, Plan>([
      ['P1-p', makePlan({ id: 'P1-p' })],
      ['A1-a', makePlan({ id: 'A1-a' })],
      ['B1-b', makePlan({ id: 'B1-b' })],
    ]);
    const tree = buildTree(plans, new Map(), new Map());
    expect(tree.map((n) => n.id)).toEqual(['A1-a', 'B1-b', 'P1-p']);
  });

  it('handles multiple orphaned features under the orphan plan', () => {
    const plans = new Map<string, Plan>();
    const features = new Map([
      ['FEAT-01AAA', makeFeature({ id: 'FEAT-01AAA', parent: 'P99-missing' })],
      ['FEAT-01BBB', makeFeature({ id: 'FEAT-01BBB', parent: 'P88-missing' })],
    ]);
    const tree = buildTree(plans, features, new Map());
    expect(tree[0].id).toBe('__orphaned__');
    expect(tree[0].children).toHaveLength(2);
  });
});
