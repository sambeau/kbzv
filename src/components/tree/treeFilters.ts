import { getStatusColour } from "@/lib/constants/status-colours";
import type { TreeNode } from "@/lib/query/tree";

// ── Filter types ────────────────────────────────────────────────────

export interface FilteredTreeNode extends TreeNode {
  _ghost: boolean;
  children: FilteredTreeNode[];
}

// ── Filter helpers ──────────────────────────────────────────────────

export function isVisible(
  entity: { status: string },
  entityType: string,
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): boolean {
  const typeOk = activeTypes.size === 0 || activeTypes.has(entityType);
  const colourOk =
    activeStatusColours.size === 0 ||
    activeStatusColours.has(getStatusColour(entity.status));
  return typeOk && colourOk;
}

export function filterFeatureNode(
  featureNode: TreeNode,
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): FilteredTreeNode | null {
  const featureVisible = isVisible(
    featureNode.entity,
    "feature",
    activeTypes,
    activeStatusColours,
  );

  const filteredChildren = featureNode.children.filter((taskNode) =>
    isVisible(taskNode.entity, "task", activeTypes, activeStatusColours),
  );

  if (featureVisible) {
    return {
      ...featureNode,
      children: filteredChildren.map((c) => ({
        ...c,
        _ghost: false,
        children: [],
      })),
      _ghost: false,
    };
  }

  if (filteredChildren.length > 0) {
    return {
      ...featureNode,
      children: filteredChildren.map((c) => ({
        ...c,
        _ghost: false,
        children: [],
      })),
      _ghost: true,
    };
  }

  return null;
}

export function filterPlanNode(
  planNode: TreeNode,
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): FilteredTreeNode | null {
  const planVisible = isVisible(
    planNode.entity,
    "plan",
    activeTypes,
    activeStatusColours,
  );

  const filteredChildren = planNode.children
    .map((featureNode) =>
      filterFeatureNode(featureNode, activeTypes, activeStatusColours),
    )
    .filter((node): node is FilteredTreeNode => node !== null);

  if (planVisible) {
    return { ...planNode, children: filteredChildren, _ghost: false };
  }

  if (filteredChildren.length > 0) {
    return { ...planNode, children: filteredChildren, _ghost: true };
  }

  return null;
}

export function applyTreeFilters(
  tree: TreeNode[],
  activeTypes: Set<string>,
  activeStatusColours: Set<string>,
): FilteredTreeNode[] {
  return tree
    .map((planNode) =>
      filterPlanNode(planNode, activeTypes, activeStatusColours),
    )
    .filter((node): node is FilteredTreeNode => node !== null);
}
