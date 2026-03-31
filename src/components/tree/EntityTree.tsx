import { useEffect } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore, resolveEntityType } from "@/lib/store/ui-store";
import { applyTreeFilters } from "./treeFilters";
import { TreeNode as TreeNodeComponent } from "./TreeNode";

function EntityTree() {
  const tree = useProjectStore((s) => s.tree);
  const features = useProjectStore((s) => s.features);
  const tasks = useProjectStore((s) => s.tasks);

  const activeTypes = useUIStore((s) => s.activeTypes);
  const activeStatusColours = useUIStore((s) => s.activeStatusColours);
  const selectedEntityId = useUIStore((s) => s.selectedEntityId);
  const expandedNodeIds = useUIStore((s) => s.expandedNodeIds);
  const expandNodes = useUIStore((s) => s.expandNodes);

  // ── Auto-expansion: expand ancestor nodes when selectedEntityId changes ──
  useEffect(() => {
    if (!selectedEntityId) return;

    const type = resolveEntityType(selectedEntityId);
    if (!type) return;

    const pathIds: string[] = [];

    switch (type) {
      case "task": {
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
      case "feature": {
        const feature = features.get(selectedEntityId);
        if (feature?.parent) {
          pathIds.push(feature.parent);
        }
        break;
      }
      case "plan":
        // Top-level node — no ancestors to expand
        break;
      case "bug":
      case "decision":
      case "incident":
      case "checkpoint":
      case "knowledge":
        // These types don't live in the Work tree — nothing to expand
        break;
      default:
        // "document" type should never reach here
        break;
    }

    if (pathIds.length > 0) {
      const needsExpansion = pathIds.some((id) => !expandedNodeIds.has(id));
      if (needsExpansion) {
        expandNodes(pathIds);
      }
    }
  }, [selectedEntityId, tasks, features, expandNodes, expandedNodeIds]);

  // ── Scroll-to-selected: scroll selected node into view after expansion ──
  useEffect(() => {
    if (!selectedEntityId) return;

    // Defer until after React has painted the newly-expanded nodes into the DOM
    requestAnimationFrame(() => {
      const node = document.getElementById(`tree-node-${selectedEntityId}`);
      if (!node) return;
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [selectedEntityId, expandedNodeIds]);

  const filteredTree = applyTreeFilters(tree, activeTypes, activeStatusColours);

  const hasAnyData = tree.length > 0;
  const hasFilteredResults = filteredTree.length > 0;

  if (!hasAnyData) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">
        No entities to display
      </div>
    );
  }

  if (!hasFilteredResults) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">
        No entities match the current filters
      </div>
    );
  }

  return (
    <div className="py-2">
      {filteredTree.map((planNode) => (
        <TreeNodeComponent key={planNode.id} node={planNode} depth={0} />
      ))}
    </div>
  );
}

export { EntityTree };
