import { Bug } from "lucide-react";
import { Badge } from "@radix-ui/themes";
import { formatDistanceToNow } from "date-fns";
import type { Bug as BugEntity } from "@/lib/types";
import { FieldValue } from "./FieldValue";
import { DetailHeader, MetadataList } from "./DetailHelpers";
import { EntityLink } from "@/components/common/EntityLink";

interface BugDetailProps {
  entity: BugEntity;
}

const SEVERITY_COLOURS: Record<string, "red" | "orange" | "yellow" | "gray"> = {
  critical: "red",
  high: "orange",
  medium: "yellow",
  low: "gray",
};

function formatTimestamp(ts: string): string {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return ts;
  }
}

function BugDetail({ entity }: BugDetailProps) {
  // Build metadata items for the DataList
  const metadataItems = [
    entity.severity
      ? {
          label: "Severity",
          value: (
            <Badge
              color={SEVERITY_COLOURS[entity.severity.toLowerCase()] ?? "gray"}
              variant="soft"
            >
              {entity.severity}
            </Badge>
          ),
        }
      : null,
    entity.priority
      ? {
          label: "Priority",
          value: (
            <Badge
              color={SEVERITY_COLOURS[entity.priority.toLowerCase()] ?? "gray"}
              variant="soft"
            >
              {entity.priority}
            </Badge>
          ),
        }
      : null,
    entity.type
      ? {
          label: "Type",
          value: <span className="text-sm">{entity.type}</span>,
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
    entity.reported_by
      ? {
          label: "Reported By",
          value: <span className="text-sm">{entity.reported_by}</span>,
        }
      : null,
    entity.reported
      ? {
          label: "Reported",
          value: (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(entity.reported)}
            </span>
          ),
        }
      : null,
    entity.affects && entity.affects.length > 0
      ? {
          label: "Affects",
          value: (
            <div className="flex flex-wrap gap-1.5">
              {entity.affects.map((id) => (
                <EntityLink key={id} entityId={id} />
              ))}
            </div>
          ),
        }
      : null,
    entity.origin_feature
      ? {
          label: "Origin Feature",
          value: <EntityLink entityId={entity.origin_feature} />,
        }
      : null,
    entity.origin_task
      ? {
          label: "Origin Task",
          value: <EntityLink entityId={entity.origin_task} />,
        }
      : null,
    entity.environment
      ? {
          label: "Environment",
          value: <span className="text-sm">{entity.environment}</span>,
        }
      : null,
    entity.duplicate_of
      ? {
          label: "Duplicate Of",
          value: <EntityLink entityId={entity.duplicate_of} />,
        }
      : null,
    entity.fixed_by
      ? {
          label: "Fixed By",
          value: <span className="text-sm">{entity.fixed_by}</span>,
        }
      : null,
    entity.verified_by
      ? {
          label: "Verified By",
          value: <span className="text-sm">{entity.verified_by}</span>,
        }
      : null,
    entity.release_target
      ? {
          label: "Release Target",
          value: <span className="text-sm">{entity.release_target}</span>,
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
        icon={Bug}
        entityId={entity.id}
        summary={entity.title}
        status={entity.status}
      />

      {/* Compact metadata via DataList */}
      <MetadataList items={metadataItems} />

      {/* Long-text fields stay as standalone sections */}
      <FieldValue label="Observed" value={entity.observed} type="long-text" />
      <FieldValue label="Expected" value={entity.expected} type="long-text" />
      <FieldValue
        label="Reproduction"
        value={entity.reproduction}
        type="long-text"
      />
    </div>
  );
}

export { BugDetail };
export type { BugDetailProps };
