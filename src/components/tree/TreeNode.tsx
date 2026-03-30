import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTreeContext } from "./TreeContext";
import { StatusDot } from "./StatusDot";
import type { TreeNode as TreeNodeType } from "@/lib/query/tree";
import type { Plan, Feature, Task } from "@/lib/types";

interface TreeNodeProps {
  node: TreeNodeType & { _ghost?: boolean };
  depth: number;
}

function getDisplayText(node: TreeNodeType): string {
  switch (node.entityType) {
    case "plan":
      return (node.entity as Plan).title;
    case "feature": {
      const f = node.entity as Feature & { label?: string };
      return f.label ?? f.slug ?? f.summary ?? "";
    }
    case "task": {
      const t = node.entity as Task & { label?: string };
      return t.label ?? t.slug ?? t.summary ?? "";
    }
    default:
      return node.id;
  }
}

function TreeNode({ node, depth }: TreeNodeProps) {
  const { expandedNodes, selectedEntity, toggleExpand, select } =
    useTreeContext();

  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedEntity === node.id;
  const hasChildren = node.children.length > 0;
  const isGhost = (node as TreeNodeType & { _ghost?: boolean })._ghost === true;

  const displayText = getDisplayText(node);

  return (
    <div>
      {/* Row */}
      <button
        data-entity-id={node.id}
        className={cn(
          "flex items-center gap-1.5 w-full text-left py-1 px-2 rounded-md text-sm",
          "hover:bg-accent/50 cursor-pointer",
          isSelected && "bg-accent",
          isGhost && "opacity-50 pointer-events-none",
          depth === 0 && "pl-2",
          depth === 1 && "pl-6",
          depth === 2 && "pl-10",
        )}
        onClick={() => !isGhost && select(node.id, node.entityType)}
      >
        {/* Chevron */}
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
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-90",
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

        {/* Display text */}
        <span className="font-normal text-muted-foreground truncate">
          {displayText}
        </span>
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child as TreeNodeType & { _ghost?: boolean }}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { TreeNode };
export type { TreeNodeProps };
