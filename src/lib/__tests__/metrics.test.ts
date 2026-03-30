// src/lib/__tests__/metrics.test.ts

import { describe, it, expect } from 'vitest';
import type { Feature, Task } from '../types';
import {
  taskCompletionForFeature,
  featureCompletionForPlan,
  estimateRollupForFeature,
  estimateRollupForPlan,
} from '../query/metrics';

// ── Helper Factories ────────────────────────────────────────────────

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

// ── taskCompletionForFeature ────────────────────────────────────────

describe('taskCompletionForFeature', () => {
  it('counts done tasks, excludes not-planned and duplicate', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done' })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'active' })],
      ['T3', makeTask({ id: 'T3', parent_feature: 'F1', status: 'not-planned' })],
    ]);
    const result = taskCompletionForFeature('F1', tasks);
    expect(result).toEqual({ done: 1, total: 2, percentage: 50 });
  });

  it('returns NaN percentage when no non-excluded tasks exist', () => {
    const tasks = new Map<string, Task>();
    const result = taskCompletionForFeature('F1', tasks);
    expect(result.done).toBe(0);
    expect(result.total).toBe(0);
    expect(result.percentage).toBeNaN();
  });

  it('returns NaN when all tasks are excluded', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'not-planned' })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'duplicate' })],
    ]);
    const result = taskCompletionForFeature('F1', tasks);
    expect(result.done).toBe(0);
    expect(result.total).toBe(0);
    expect(result.percentage).toBeNaN();
  });

  it('returns 100% when all tasks are done', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done' })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'done' })],
      ['T3', makeTask({ id: 'T3', parent_feature: 'F1', status: 'done' })],
    ]);
    const result = taskCompletionForFeature('F1', tasks);
    expect(result).toEqual({ done: 3, total: 3, percentage: 100 });
  });

  it('ignores tasks belonging to other features', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done' })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F2', status: 'done' })],
    ]);
    const result = taskCompletionForFeature('F1', tasks);
    expect(result).toEqual({ done: 1, total: 1, percentage: 100 });
  });

  it('excludes duplicate tasks from the denominator', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done' })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'duplicate' })],
      ['T3', makeTask({ id: 'T3', parent_feature: 'F1', status: 'active' })],
    ]);
    const result = taskCompletionForFeature('F1', tasks);
    expect(result).toEqual({ done: 1, total: 2, percentage: 50 });
  });

  it('returns 0% when no tasks are done but some exist', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'active' })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'queued' })],
    ]);
    const result = taskCompletionForFeature('F1', tasks);
    expect(result).toEqual({ done: 0, total: 2, percentage: 0 });
  });
});

// ── featureCompletionForPlan ────────────────────────────────────────

describe('featureCompletionForPlan', () => {
  it('counts done features, excludes cancelled and superseded', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'done' })],
      ['F2', makeFeature({ id: 'F2', parent: 'P1', status: 'done' })],
      ['F3', makeFeature({ id: 'F3', parent: 'P1', status: 'developing' })],
      ['F4', makeFeature({ id: 'F4', parent: 'P1', status: 'developing' })],
      ['F5', makeFeature({ id: 'F5', parent: 'P1', status: 'cancelled' })],
    ]);
    const result = featureCompletionForPlan('P1', features);
    expect(result).toEqual({ done: 2, total: 4, percentage: 50 });
  });

  it('returns NaN percentage for empty features', () => {
    const result = featureCompletionForPlan('P1', new Map());
    expect(result.done).toBe(0);
    expect(result.total).toBe(0);
    expect(result.percentage).toBeNaN();
  });

  it('excludes superseded features from the denominator', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'done' })],
      ['F2', makeFeature({ id: 'F2', parent: 'P1', status: 'superseded' })],
    ]);
    const result = featureCompletionForPlan('P1', features);
    expect(result).toEqual({ done: 1, total: 1, percentage: 100 });
  });

  it('returns NaN when all features are excluded', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'cancelled' })],
      ['F2', makeFeature({ id: 'F2', parent: 'P1', status: 'superseded' })],
    ]);
    const result = featureCompletionForPlan('P1', features);
    expect(result.percentage).toBeNaN();
  });

  it('ignores features belonging to other plans', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'done' })],
      ['F2', makeFeature({ id: 'F2', parent: 'P2', status: 'done' })],
    ]);
    const result = featureCompletionForPlan('P1', features);
    expect(result).toEqual({ done: 1, total: 1, percentage: 100 });
  });

  it('returns 0% when no features are done but some exist', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'developing' })],
      ['F2', makeFeature({ id: 'F2', parent: 'P1', status: 'proposed' })],
    ]);
    const result = featureCompletionForPlan('P1', features);
    expect(result).toEqual({ done: 0, total: 2, percentage: 0 });
  });
});

// ── estimateRollupForFeature ────────────────────────────────────────

describe('estimateRollupForFeature', () => {
  it('sums estimates, counts unestimated, excludes not-planned', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done', estimate: 5 })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'active', estimate: 3 })],
      ['T3', makeTask({ id: 'T3', parent_feature: 'F1', status: 'queued' })],
    ]);
    const result = estimateRollupForFeature('F1', tasks);
    expect(result).toEqual({
      totalPoints: 8,
      estimatedCount: 2,
      unestimatedCount: 1,
    });
  });

  it('returns zeros for empty feature', () => {
    const result = estimateRollupForFeature('F1', new Map());
    expect(result).toEqual({
      totalPoints: 0,
      estimatedCount: 0,
      unestimatedCount: 0,
    });
  });

  it('counts all as unestimated when no tasks have estimates', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'queued' })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'active' })],
    ]);
    const result = estimateRollupForFeature('F1', tasks);
    expect(result).toEqual({
      totalPoints: 0,
      estimatedCount: 0,
      unestimatedCount: 2,
    });
  });

  it('excludes not-planned tasks from rollup', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done', estimate: 5 })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'not-planned', estimate: 13 })],
    ]);
    const result = estimateRollupForFeature('F1', tasks);
    expect(result).toEqual({
      totalPoints: 5,
      estimatedCount: 1,
      unestimatedCount: 0,
    });
  });

  it('excludes duplicate tasks from rollup', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done', estimate: 8 })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F1', status: 'duplicate', estimate: 3 })],
    ]);
    const result = estimateRollupForFeature('F1', tasks);
    expect(result).toEqual({
      totalPoints: 8,
      estimatedCount: 1,
      unestimatedCount: 0,
    });
  });

  it('ignores tasks belonging to other features', () => {
    const tasks = new Map([
      ['T1', makeTask({ id: 'T1', parent_feature: 'F1', status: 'done', estimate: 5 })],
      ['T2', makeTask({ id: 'T2', parent_feature: 'F2', status: 'done', estimate: 8 })],
    ]);
    const result = estimateRollupForFeature('F1', tasks);
    expect(result).toEqual({
      totalPoints: 5,
      estimatedCount: 1,
      unestimatedCount: 0,
    });
  });
});

// ── estimateRollupForPlan ───────────────────────────────────────────

describe('estimateRollupForPlan', () => {
  it('sums feature estimates, excludes cancelled', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'done', estimate: 8 })],
      ['F2', makeFeature({ id: 'F2', parent: 'P1', status: 'developing', estimate: 13 })],
      ['F3', makeFeature({ id: 'F3', parent: 'P1', status: 'proposed' })],
      ['F4', makeFeature({ id: 'F4', parent: 'P1', status: 'cancelled', estimate: 5 })],
    ]);
    const result = estimateRollupForPlan('P1', features);
    expect(result).toEqual({
      totalPoints: 21,
      estimatedCount: 2,
      unestimatedCount: 1,
    });
  });

  it('returns zeros for empty plan', () => {
    const result = estimateRollupForPlan('P1', new Map());
    expect(result).toEqual({
      totalPoints: 0,
      estimatedCount: 0,
      unestimatedCount: 0,
    });
  });

  it('counts all as unestimated when no features have estimates', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'developing' })],
      ['F2', makeFeature({ id: 'F2', parent: 'P1', status: 'proposed' })],
    ]);
    const result = estimateRollupForPlan('P1', features);
    expect(result).toEqual({
      totalPoints: 0,
      estimatedCount: 0,
      unestimatedCount: 2,
    });
  });

  it('excludes superseded features from rollup', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'done', estimate: 5 })],
      ['F2', makeFeature({ id: 'F2', parent: 'P1', status: 'superseded', estimate: 20 })],
    ]);
    const result = estimateRollupForPlan('P1', features);
    expect(result).toEqual({
      totalPoints: 5,
      estimatedCount: 1,
      unestimatedCount: 0,
    });
  });

  it('ignores features belonging to other plans', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'done', estimate: 5 })],
      ['F2', makeFeature({ id: 'F2', parent: 'P2', status: 'done', estimate: 8 })],
    ]);
    const result = estimateRollupForPlan('P1', features);
    expect(result).toEqual({
      totalPoints: 5,
      estimatedCount: 1,
      unestimatedCount: 0,
    });
  });

  it('returns zeros when all features are excluded', () => {
    const features = new Map([
      ['F1', makeFeature({ id: 'F1', parent: 'P1', status: 'cancelled', estimate: 8 })],
      ['F2', makeFeature({ id: 'F2', parent: 'P1', status: 'superseded', estimate: 13 })],
    ]);
    const result = estimateRollupForPlan('P1', features);
    expect(result).toEqual({
      totalPoints: 0,
      estimatedCount: 0,
      unestimatedCount: 0,
    });
  });
});
