import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectStore } from "@/lib/store/project-store";
import { resolveEntityType, resolveEntity } from "@/lib/query/references";
import { useOptionalTreeContext } from "@/components/tree/TreeContext";
import type {
  Plan,
  Feature,
  Task,
  Bug,
  Decision,
  Incident,
  HumanCheckpoint,
  KnowledgeEntry,
  DocumentRecord,
} from "@/lib/types";

interface EntityLinkProps {
  entityId: string;
  className?: string;
}

function getEntitySummary(entityType: string, entity: unknown): string {
  switch (entityType) {
    case "plan":
      return (entity as Plan).title;
    case "feature":
      return (entity as Feature).summary;
    case "task":
      return (entity as Task).summary;
    case "bug":
      return (entity as Bug).title;
    case "decision":
      return (entity as Decision).summary;
    case "incident":
      return (entity as Incident).title;
    case "checkpoint": {
      const q = (entity as HumanCheckpoint).question;
      return q.length > 80 ? q.slice(0, 80) + "…" : q;
    }
    case "knowledge":
      return (entity as KnowledgeEntry).topic;
    case "document":
      return (entity as DocumentRecord).title;
    default:
      return entityType;
  }
}

function EntityLink({ entityId, className }: EntityLinkProps) {
  const projectState = useProjectStore();
  const treeCtx = useOptionalTreeContext();
  const resolved = resolveEntity(entityId, projectState);

  function handleClick() {
    const type = resolveEntityType(entityId);
    if (!type) return;
    // Document links are no-ops until F5 wires cross-view navigation
    if (type === "document") return;
    if (!treeCtx) return;
    treeCtx.expandTo(entityId);
    treeCtx.select(entityId, type);
  }

  if (!resolved) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "text-muted-foreground/50 line-through cursor-default font-mono text-sm",
              className,
            )}
          >
            {entityId}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Entity not found</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const entitySummary = getEntitySummary(resolved.entityType, resolved.entity);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "text-primary underline-offset-4 hover:underline cursor-pointer font-mono text-sm",
            className,
          )}
          onClick={handleClick}
        >
          {entityId}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{entitySummary}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export { EntityLink };
export type { EntityLinkProps };
