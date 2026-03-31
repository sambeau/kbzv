import { CheckSquare } from "lucide-react";
import { Badge } from "@radix-ui/themes";
import { formatDistanceToNow } from "date-fns";
import { useProjectStore } from "@/lib/store/project-store";
import type { Task } from "@/lib/types";
import { FieldValue } from "./FieldValue";
import {
  DetailHeader,
  MetadataList,
  RelatedEntitiesSection,
  RelatedEntityRow,
} from "./DetailHelpers";
import { EntityLink } from "@/components/common/EntityLink";

interface TaskDetailProps {
  entity: Task;
}

function formatTimestamp(ts: string): string {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return ts;
  }
}

function TaskDetail({ entity }: TaskDetailProps) {
  const tasks = useProjectStore((s) => s.tasks);
  const bugs = useProjectStore((s) => s.bugs);

  // Tasks that depend on this task (dependents)
  const dependents = [...tasks.values()]
    .filter((t) => t.depends_on?.includes(entity.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const linkedBugs = [...bugs.values()]
    .filter((b) => b.origin_task === entity.id)
    .sort((a, b) => a.id.localeCompare(b.id));

  // Build metadata items for the DataList
  const metadataItems = [
    entity.parent_feature
      ? {
          label: "Parent Feature",
          value: <EntityLink entityId={entity.parent_feature} />,
        }
      : null,
    entity.slug
      ? {
          label: "Slug",
          value: (
            <span className="text-xs text-muted-foreground font-mono">
              {entity.slug}
            </span>
          ),
        }
      : null,
    entity.estimate != null
      ? {
          label: "Estimate",
          value: <span className="text-sm">{entity.estimate} pts</span>,
        }
      : null,
    entity.assignee
      ? {
          label: "Assignee",
          value: <span className="text-sm">{entity.assignee}</span>,
        }
      : null,
    entity.depends_on && entity.depends_on.length > 0
      ? {
          label: "Depends On",
          value: (
            <div className="flex flex-wrap gap-1.5">
              {entity.depends_on.map((id) => (
                <EntityLink key={id} entityId={id} />
              ))}
            </div>
          ),
        }
      : null,
    entity.files_planned && entity.files_planned.length > 0
      ? {
          label: "Files Planned",
          value: (
            <div className="flex flex-wrap gap-1">
              {entity.files_planned.map((item) => (
                <Badge
                  key={item}
                  variant="outline"
                  color="gray"
                  style={{ fontFamily: "monospace" }}
                >
                  {item}
                </Badge>
              ))}
            </div>
          ),
        }
      : null,
    entity.dispatched_to
      ? {
          label: "Dispatched To",
          value: <span className="text-sm">{entity.dispatched_to}</span>,
        }
      : null,
    entity.dispatched_by
      ? {
          label: "Dispatched By",
          value: <span className="text-sm">{entity.dispatched_by}</span>,
        }
      : null,
    entity.dispatched_at
      ? {
          label: "Dispatched At",
          value: (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(entity.dispatched_at)}
            </span>
          ),
        }
      : null,
    entity.started
      ? {
          label: "Started",
          value: (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(entity.started)}
            </span>
          ),
        }
      : null,
    entity.completed
      ? {
          label: "Completed",
          value: (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(entity.completed)}
            </span>
          ),
        }
      : null,
    entity.claimed_at
      ? {
          label: "Claimed At",
          value: (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(entity.claimed_at)}
            </span>
          ),
        }
      : null,
    entity.tags && entity.tags.length > 0
      ? {
          label: "Tags",
          value: (
            <div className="flex flex-wrap gap-1">
              {entity.tags.map((tag) => (
                <Badge key={tag} variant="soft" color="gray" radius="full">
                  {tag}
                </Badge>
              ))}
            </div>
          ),
        }
      : null,
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  return (
    <div className="space-y-6">
      <DetailHeader
        icon={CheckSquare}
        entityId={entity.id}
        summary={entity.summary}
        status={entity.status}
      />

      {/* Summary text — no label, just the text */}
      {entity.summary && (
        <p className="text-sm text-muted-foreground">{entity.summary}</p>
      )}

      {/* Compact metadata via DataList */}
      <MetadataList items={metadataItems} />

      {/* Long-text fields stay as standalone sections */}
      <FieldValue
        label="Completion Summary"
        value={entity.completion_summary}
        type="long-text"
      />
      <FieldValue
        label="Rework Reason"
        value={entity.rework_reason}
        type="long-text"
      />
      <FieldValue
        label="Verification"
        value={entity.verification}
        type="long-text"
      />

      {dependents.length > 0 && (
        <RelatedEntitiesSection title="Dependents">
          {dependents.map((t) => (
            <RelatedEntityRow
              key={t.id}
              entityId={t.id}
              summary={t.summary}
              status={t.status}
            />
          ))}
        </RelatedEntitiesSection>
      )}

      {linkedBugs.length > 0 && (
        <RelatedEntitiesSection title="Linked Bugs">
          {linkedBugs.map((b) => (
            <RelatedEntityRow
              key={b.id}
              entityId={b.id}
              summary={b.title}
              status={b.status}
            />
          ))}
        </RelatedEntitiesSection>
      )}
    </div>
  );
}

export { TaskDetail };
export type { TaskDetailProps };
