// src/lib/query/tree.ts

import type { Plan, Feature, Task } from '../types';

// ── TreeNode ────────────────────────────────────────────────────────

/**
 * A node in the Plan→Feature→Task hierarchy tree.
 * Each node wraps an entity and may have child nodes.
 */
export interface TreeNode {
  /** The entity at this tree level */
  entity: Plan | Feature | Task;

  /** Discriminator for the entity type */
  entityType: 'plan' | 'feature' | 'task';

  /** The entity's ID (duplicated from entity.id for convenience) */
  id: string;

  /**
   * Child nodes.
   * - Plan nodes have Feature children.
   * - Feature nodes have Task children.
   * - Task nodes always have an empty array.
   */
  children: TreeNode[];
}

// ── Sort Helpers ────────────────────────────────────────────────────

/**
 * Extracts the sort key from a Plan ID for ordering.
 *
 * Plan IDs have the format P{n}-{slug}, e.g. "P1-kbzv", "P12-infra".
 * The sort key is a [prefix_letter, number] tuple so that:
 *   P1 < P2 < P12 (numeric, not lexicographic)
 *
 * If the ID does not match the expected pattern, falls back to
 * sorting by the raw ID string with number 0.
 */
function planSortKey(plan: Plan): [string, number] {
  const match = plan.id.match(/^([A-Z])(\d+)-/);
  if (!match) return [plan.id, 0];
  return [match[1], parseInt(match[2], 10)];
}

/**
 * Comparator for sorting Plans by their prefix letter and numeric index.
 *
 * Sort order:
 * 1. First by prefix letter (alphabetical): A < B < P < Z
 * 2. Then by numeric index (ascending): P1 < P2 < P12
 * 3. Fallback to raw ID comparison for malformed IDs
 */
function comparePlans(a: Plan, b: Plan): number {
  const [aLetter, aNum] = planSortKey(a);
  const [bLetter, bNum] = planSortKey(b);

  if (aLetter < bLetter) return -1;
  if (aLetter > bLetter) return 1;

  return aNum - bNum;
}

/**
 * Comparator for sorting entities by ID (lexicographic).
 *
 * Since TSID13-based IDs are time-sortable, lexicographic order
 * produces chronological (creation-time) order for Features, Tasks,
 * and all other TSID-based entities.
 */
function compareById(a: { id: string }, b: { id: string }): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

// ── Tree Builder ────────────────────────────────────────────────────

/**
 * Builds the Plan→Feature→Task hierarchy tree from entity maps.
 *
 * Algorithm:
 * 1. Group features by parent plan ID into a Map<planId, Feature[]>.
 * 2. Group tasks by parent_feature ID into a Map<featureId, Task[]>.
 * 3. Sort plans using comparePlans (prefix letter + numeric index).
 * 4. For each plan, sort its features by ID (lexicographic = chronological).
 * 5. For each feature, sort its tasks by ID (lexicographic = chronological).
 * 6. Assemble TreeNode objects at each level.
 * 7. Features whose parent plan does not exist are collected into an
 *    "Orphaned Features" synthetic plan node, appended at the end.
 * 8. Tasks whose parent_feature does not exist are collected into an
 *    "Orphaned Tasks" synthetic feature node under the orphan plan.
 *
 * @param plans - All Plan entities, keyed by ID
 * @param features - All Feature entities, keyed by ID
 * @param tasks - All Task entities, keyed by ID
 * @returns Sorted array of plan-level TreeNodes
 */
export function buildTree(
  plans: Map<string, Plan>,
  features: Map<string, Feature>,
  tasks: Map<string, Task>,
): TreeNode[] {
  // ── Step 1: Group features by parent plan ID ──────────────────
  const featuresByPlan = new Map<string, Feature[]>();
  const orphanedFeatures: Feature[] = [];

  for (const feature of features.values()) {
    if (plans.has(feature.parent)) {
      const list = featuresByPlan.get(feature.parent);
      if (list) {
        list.push(feature);
      } else {
        featuresByPlan.set(feature.parent, [feature]);
      }
    } else {
      orphanedFeatures.push(feature);
    }
  }

  // ── Step 2: Group tasks by parent feature ID ──────────────────
  const tasksByFeature = new Map<string, Task[]>();
  const orphanedTasks: Task[] = [];

  for (const task of tasks.values()) {
    if (features.has(task.parent_feature)) {
      const list = tasksByFeature.get(task.parent_feature);
      if (list) {
        list.push(task);
      } else {
        tasksByFeature.set(task.parent_feature, [task]);
      }
    } else {
      orphanedTasks.push(task);
    }
  }

  // ── Step 3: Build task nodes for a feature ────────────────────
  function buildTaskNodes(featureId: string): TreeNode[] {
    const featureTasks = tasksByFeature.get(featureId) ?? [];
    return featureTasks.sort(compareById).map((task) => ({
      entity: task,
      entityType: 'task' as const,
      id: task.id,
      children: [],
    }));
  }

  // ── Step 4: Build feature nodes for a plan ────────────────────
  function buildFeatureNodes(planId: string): TreeNode[] {
    const planFeatures = featuresByPlan.get(planId) ?? [];
    return planFeatures.sort(compareById).map((feature) => ({
      entity: feature,
      entityType: 'feature' as const,
      id: feature.id,
      children: buildTaskNodes(feature.id),
    }));
  }

  // ── Step 5: Build plan nodes ──────────────────────────────────
  const sortedPlans = [...plans.values()].sort(comparePlans);

  const tree: TreeNode[] = sortedPlans.map((plan) => ({
    entity: plan,
    entityType: 'plan' as const,
    id: plan.id,
    children: buildFeatureNodes(plan.id),
  }));

  // ── Step 6: Handle orphaned features and tasks ────────────────
  if (orphanedFeatures.length > 0 || orphanedTasks.length > 0) {
    const orphanFeatureNodes: TreeNode[] = orphanedFeatures
      .sort(compareById)
      .map((feature) => ({
        entity: feature,
        entityType: 'feature' as const,
        id: feature.id,
        children: buildTaskNodes(feature.id),
      }));

    // Orphaned tasks go under a synthetic feature
    if (orphanedTasks.length > 0) {
      const syntheticFeature: Feature = {
        id: '__orphaned-tasks__',
        slug: 'orphaned-tasks',
        parent: '__orphaned__',
        status: 'active',
        summary: 'Tasks with no matching parent feature',
        created: '',
        created_by: '',
        updated: '',
      };

      const orphanTaskNodes: TreeNode[] = orphanedTasks
        .sort(compareById)
        .map((task) => ({
          entity: task,
          entityType: 'task' as const,
          id: task.id,
          children: [],
        }));

      orphanFeatureNodes.push({
        entity: syntheticFeature,
        entityType: 'feature' as const,
        id: syntheticFeature.id,
        children: orphanTaskNodes,
      });
    }

    const syntheticPlan: Plan = {
      id: '__orphaned__',
      slug: 'orphaned',
      title: 'Orphaned',
      status: 'active',
      summary: 'Entities with no matching parent',
      created: '',
      created_by: '',
      updated: '',
    };

    tree.push({
      entity: syntheticPlan,
      entityType: 'plan' as const,
      id: syntheticPlan.id,
      children: orphanFeatureNodes,
    });
  }

  return tree;
}
