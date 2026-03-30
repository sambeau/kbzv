// src/lib/query/metrics.ts

import type { Feature, Task } from "../types";

// ── Constants ───────────────────────────────────────────────────────

/**
 * Task statuses that are excluded from completion metric denominators.
 * These are terminal-negative statuses — the task was not done, it was
 * removed from scope.
 */
const TASK_EXCLUDED_STATUSES: readonly string[] = ["not-planned", "duplicate"];

/**
 * Feature statuses that are excluded from completion metric denominators.
 * These are terminal-negative statuses — the feature was not done, it was
 * removed from scope.
 */
const FEATURE_EXCLUDED_STATUSES: readonly string[] = [
  "cancelled",
  "superseded",
];

// ── Metric Interfaces ───────────────────────────────────────────────

/**
 * Completion metrics for a set of entities.
 *
 * Edge case behaviour:
 * - When total is 0 (no entities, or all excluded): percentage is NaN.
 *   UI consumers must check for NaN and display "—" or "N/A".
 * - done is never greater than total.
 * - percentage is in the range [0, 100] when total > 0.
 */
export interface CompletionMetrics {
  /** Count of entities with status 'done' */
  done: number;

  /** Count of all entities, excluding terminal-negative statuses */
  total: number;

  /**
   * Completion percentage: (done / total) * 100.
   * Range: 0–100 when total > 0.
   * Value: NaN when total is 0.
   */
  percentage: number;
}

/**
 * Estimate rollup for a set of entities.
 *
 * Edge case behaviour:
 * - When all entities are unestimated: totalPoints = 0, estimatedCount = 0.
 * - When no entities exist (or all excluded): all fields are 0.
 * - Entities without an estimate field are counted as unestimated — never as 0.
 */
export interface EstimateRollup {
  /** Sum of estimate values for all estimated entities */
  totalPoints: number;

  /** Count of entities that have an estimate value (estimate != null) */
  estimatedCount: number;

  /** Count of entities that do NOT have an estimate value (estimate is undefined/null) */
  unestimatedCount: number;
}

// ── Task Completion by Feature ──────────────────────────────────────

/**
 * Computes task completion metrics for a single feature.
 *
 * Iterates all tasks in the map, selects those belonging to the given
 * feature, excludes tasks with terminal-negative statuses, and counts
 * how many are done.
 *
 * @param featureId - The Feature ID to compute metrics for
 * @param tasks - All Task entities, keyed by ID
 * @returns CompletionMetrics. percentage is NaN if the feature has no non-excluded tasks.
 */
export function taskCompletionForFeature(
  featureId: string,
  tasks: Map<string, Task>,
): CompletionMetrics {
  let done = 0;
  let total = 0;

  for (const task of tasks.values()) {
    if (task.parent_feature !== featureId) continue;
    if (TASK_EXCLUDED_STATUSES.includes(task.status)) continue;
    total++;
    if (task.status === "done") done++;
  }

  return {
    done,
    total,
    percentage: total > 0 ? (done / total) * 100 : NaN,
  };
}

// ── Feature Completion by Plan ──────────────────────────────────────

/**
 * Computes feature completion metrics for a single plan.
 *
 * Iterates all features in the map, selects those belonging to the given
 * plan, excludes features with terminal-negative statuses, and counts
 * how many are done.
 *
 * @param planId - The Plan ID to compute metrics for
 * @param features - All Feature entities, keyed by ID
 * @returns CompletionMetrics. percentage is NaN if the plan has no non-excluded features.
 */
export function featureCompletionForPlan(
  planId: string,
  features: Map<string, Feature>,
): CompletionMetrics {
  let done = 0;
  let total = 0;

  for (const feature of features.values()) {
    if (feature.parent !== planId) continue;
    if (FEATURE_EXCLUDED_STATUSES.includes(feature.status)) continue;
    total++;
    if (feature.status === "done") done++;
  }

  return {
    done,
    total,
    percentage: total > 0 ? (done / total) * 100 : NaN,
  };
}

// ── Estimate Rollup for Feature ─────────────────────────────────────

/**
 * Computes estimate rollup for all tasks within a feature.
 *
 * Sums the estimate values for tasks that have one, and counts
 * those that don't. Tasks with terminal-negative statuses are excluded.
 *
 * @param featureId - The Feature ID to roll up estimates for
 * @param tasks - All Task entities, keyed by ID
 * @returns EstimateRollup. All fields are 0 if no non-excluded tasks exist.
 */
export function estimateRollupForFeature(
  featureId: string,
  tasks: Map<string, Task>,
): EstimateRollup {
  let totalPoints = 0;
  let estimatedCount = 0;
  let unestimatedCount = 0;

  for (const task of tasks.values()) {
    if (task.parent_feature !== featureId) continue;
    if (TASK_EXCLUDED_STATUSES.includes(task.status)) continue;
    if (task.estimate != null) {
      totalPoints += task.estimate;
      estimatedCount++;
    } else {
      unestimatedCount++;
    }
  }

  return { totalPoints, estimatedCount, unestimatedCount };
}

// ── Estimate Rollup for Plan ────────────────────────────────────────

/**
 * Computes estimate rollup for all features within a plan.
 *
 * Sums the estimate values for features that have one, and counts
 * those that don't. Features with terminal-negative statuses are excluded.
 *
 * @param planId - The Plan ID to roll up estimates for
 * @param features - All Feature entities, keyed by ID
 * @returns EstimateRollup. All fields are 0 if no non-excluded features exist.
 */
export function estimateRollupForPlan(
  planId: string,
  features: Map<string, Feature>,
): EstimateRollup {
  let totalPoints = 0;
  let estimatedCount = 0;
  let unestimatedCount = 0;

  for (const feature of features.values()) {
    if (feature.parent !== planId) continue;
    if (FEATURE_EXCLUDED_STATUSES.includes(feature.status)) continue;
    if (feature.estimate != null) {
      totalPoints += feature.estimate;
      estimatedCount++;
    } else {
      unestimatedCount++;
    }
  }

  return { totalPoints, estimatedCount, unestimatedCount };
}
