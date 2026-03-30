import React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore, resolveEntityType } from "@/lib/store/ui-store";
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

function getEntityLabel(entityType: string, entity: unknown): string {
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
  const navigateToEntity = useUIStore((s) => s.navigateToEntity);
  const navigateToDocument = useUIStore((s) => s.navigateToDocument);

  const type = resolveEntityType(entityId);

  const entity = useProjectStore((s) => {
    if (!type) return null;
    const storeMap: Record<string, Map<string, unknown> | undefined> = {
      plan: s.plans,
      feature: s.features,
      task: s.tasks,
      bug: s.bugs,
      decision: s.decisions,
      knowledge: s.knowledge,
      incident: s.incidents,
      checkpoint: s.checkpoints,
      document: s.documents,
    };
    return storeMap[type]?.get(entityId) ?? null;
  });

  // Loading state: project is open but entities haven't loaded yet
  const isLoading = useProjectStore(
    (s) => s.projectPath !== null && s.plans.size === 0,
  );
  const isResolved = entity !== null;
  const isBroken = !isLoading && !isResolved;

  const tooltip = isResolved
    ? getEntityLabel(type!, entity)
    : isBroken
      ? "Entity not found"
      : "Loading…";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Prevent click from bubbling to parent clickable elements (tree nodes, list rows, etc.)
    e.stopPropagation();

    if (!isResolved || !type) return; // broken or loading → no-op

    if (type === "document") {
      navigateToDocument(entityId);
    } else {
      navigateToEntity(entityId);
    }
  };

  if (isLoading) {
    return (
      <span
        className={cn("font-mono text-sm text-muted-foreground", className)}
      >
        {entityId}
      </span>
    );
  }

  if (isBroken) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "font-mono text-sm text-muted-foreground/50 line-through cursor-default",
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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "font-mono text-sm text-primary underline-offset-4 hover:underline cursor-pointer",
            "bg-transparent border-none p-0 m-0 inline text-left",
            className,
          )}
          onClick={handleClick}
        >
          {entityId}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export { EntityLink };
export type { EntityLinkProps };
