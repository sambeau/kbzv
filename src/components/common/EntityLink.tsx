// src/components/common/EntityLink.tsx

import React from "react";
import { Tooltip } from "@radix-ui/themes";
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

  const isLoading = useProjectStore(
    (s) => s.projectPath !== null && s.plans.size === 0,
  );
  const isResolved = entity !== null;
  const isBroken = !isLoading && !isResolved;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isResolved || !type) return;
    if (type === "document") {
      navigateToDocument(entityId);
    } else {
      navigateToEntity(entityId);
    }
  };

  const label = isResolved
    ? getEntityLabel(type!, entity)
    : isBroken
      ? "Entity not found"
      : "Loading…";

  if (isLoading) {
    return (
      <span
        className={`font-mono text-sm text-muted-foreground ${className ?? ""}`}
      >
        {entityId}
      </span>
    );
  }

  if (isBroken) {
    return (
      <Tooltip content="Entity not found">
        <span
          className={`font-mono text-sm text-muted-foreground/50 line-through cursor-default ${className ?? ""}`}
        >
          {entityId}
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={label}>
      <button
        type="button"
        className={`font-mono text-sm text-[var(--accent-11)] underline-offset-4 hover:underline cursor-pointer bg-transparent border-none p-0 m-0 inline text-left ${className ?? ""}`}
        onClick={handleClick}
      >
        {entityId}
      </button>
    </Tooltip>
  );
}

export { EntityLink };
export type { EntityLinkProps };
