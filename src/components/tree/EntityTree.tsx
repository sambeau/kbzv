import { useEffect } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore, resolveEntityType } from "@/lib/store/ui-store";
import { getStatusColour } from "@/lib/constants/status-colours";
import { applyTreeFilters } from "./treeFilters";
import { TreeNode as TreeNodeComponent } from "./TreeNode";
import { StandaloneSection } from "./StandaloneSection";

// Synthetic section header IDs for standalone sections
const SECTION_HEADERS: Record<string, string> = {
  bug: "__bugs__",
  decision: "__decisions__",
  incident: "__incidents__",
  checkpoint: "__checkpoints__",
  knowledge: "__knowledge__",
};

function EntityTree() {
  const tree = useProjectStore((s) => s.tree);
  const bugs = useProjectStore((s) => s.bugs);
  const decisions = useProjectStore((s) => s.decisions);
  const incidents = useProjectStore((s) => s.incidents);
  const pendingCheckpoints = useProjectStore((s) => s.pendingCheckpoints);
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
      case "knowledge": {
        const sectionId = SECTION_HEADERS[type];
        if (sectionId) {
          pathIds.push(sectionId);
        }
        break;
      }
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

  const filteredBugs = [...bugs.values()]
    .filter((b) => activeStatusColours.has(getStatusColour(b.status)))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((b) => ({ id: b.id, status: b.status, displayText: b.title }));

  const filteredDecisions = [...decisions.values()]
    .filter((d) => activeStatusColours.has(getStatusColour(d.status)))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => ({ id: d.id, status: d.status, displayText: d.summary }));

  const filteredIncidents = [...incidents.values()]
    .filter((i) => activeStatusColours.has(getStatusColour(i.status)))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((i) => ({ id: i.id, status: i.status, displayText: i.title }));

  const filteredPendingCheckpoints = pendingCheckpoints
    .filter((c) => activeStatusColours.has(getStatusColour(c.status)))
    .sort((a, b) => b.created.localeCompare(a.created))
    .map((c) => ({
      id: c.id,
      status: c.status,
      displayText:
        c.question.length > 60 ? c.question.slice(0, 60) + "…" : c.question,
    }));

  const hasAnyData =
    tree.length > 0 ||
    bugs.size > 0 ||
    decisions.size > 0 ||
    incidents.size > 0 ||
    pendingCheckpoints.length > 0;

  const hasFilteredResults =
    filteredTree.length > 0 ||
    filteredBugs.length > 0 ||
    filteredDecisions.length > 0 ||
    filteredIncidents.length > 0 ||
    filteredPendingCheckpoints.length > 0;

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
      {/* Plan → Feature → Task hierarchy */}
      {filteredTree.map((planNode) => (
        <TreeNodeComponent key={planNode.id} node={planNode} depth={0} />
      ))}

      {/* Standalone sections */}
      {activeTypes.has("bug") && (
        <StandaloneSection
          title="Bugs"
          entityType="bug"
          sectionId={SECTION_HEADERS.bug}
          entities={filteredBugs}
          showStatusDot={true}
        />
      )}

      {activeTypes.has("decision") && (
        <StandaloneSection
          title="Decisions"
          entityType="decision"
          sectionId={SECTION_HEADERS.decision}
          entities={filteredDecisions}
          showStatusDot={false}
        />
      )}

      {activeTypes.has("incident") && (
        <StandaloneSection
          title="Incidents"
          entityType="incident"
          sectionId={SECTION_HEADERS.incident}
          entities={filteredIncidents}
          showStatusDot={true}
        />
      )}

      {activeTypes.has("checkpoint") &&
        filteredPendingCheckpoints.length > 0 && (
          <StandaloneSection
            title="Pending Checkpoints"
            entityType="checkpoint"
            sectionId={SECTION_HEADERS.checkpoint}
            entities={filteredPendingCheckpoints}
            showStatusDot={false}
            variant="pending-checkpoint"
          />
        )}
    </div>
  );
}

export { EntityTree };
