import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore } from "@/lib/store/ui-store";
import { getStatusColour } from "@/lib/constants/status-colours";
import { applyTreeFilters } from "./treeFilters";
import { TreeNode as TreeNodeComponent } from "./TreeNode";
import { StandaloneSection } from "./StandaloneSection";

function EntityTree() {
  const tree = useProjectStore((s) => s.tree);
  const bugs = useProjectStore((s) => s.bugs);
  const decisions = useProjectStore((s) => s.decisions);
  const incidents = useProjectStore((s) => s.incidents);
  const pendingCheckpoints = useProjectStore((s) => s.pendingCheckpoints);

  const activeTypes = useUIStore((s) => s.activeTypes);
  const activeStatusColours = useUIStore((s) => s.activeStatusColours);

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
          entities={filteredBugs}
          showStatusDot={true}
        />
      )}

      {activeTypes.has("decision") && (
        <StandaloneSection
          title="Decisions"
          entityType="decision"
          entities={filteredDecisions}
          showStatusDot={false}
        />
      )}

      {activeTypes.has("incident") && (
        <StandaloneSection
          title="Incidents"
          entityType="incident"
          entities={filteredIncidents}
          showStatusDot={true}
        />
      )}

      {activeTypes.has("checkpoint") &&
        filteredPendingCheckpoints.length > 0 && (
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

export { EntityTree };
