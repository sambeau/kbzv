import { Puzzle } from "lucide-react";
import { Badge } from "@radix-ui/themes";
import { formatDistanceToNow } from "date-fns";
import { useProjectStore } from "@/lib/store/project-store";
import {
  taskCompletionForFeature,
  estimateRollupForFeature,
} from "@/lib/query/metrics";
import type { Feature } from "@/lib/types";
import {
  DetailHeader,
  MetadataList,
  RelatedEntitiesSection,
  RelatedEntityRow,
} from "./DetailHelpers";
import { ProgressBar } from "@/components/metrics/ProgressBar";
import { EstimateDisplay } from "@/components/metrics/EstimateDisplay";
import { EntityLink } from "@/components/common/EntityLink";

interface FeatureDetailProps {
  entity: Feature;
}

function formatTimestamp(ts: string): string {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return ts;
  }
}

function FeatureDetail({ entity }: FeatureDetailProps) {
  const tasks = useProjectStore((s) => s.tasks);
  const bugs = useProjectStore((s) => s.bugs);
  const decisions = useProjectStore((s) => s.decisions);
  const documents = useProjectStore((s) => s.documents);

  const featureTasks = [...tasks.values()]
    .filter((t) => t.parent_feature === entity.id)
    .sort((a, b) => a.id.localeCompare(b.id));

  const taskMetrics = taskCompletionForFeature(entity.id, tasks);

  const featureDocuments = [...documents.values()]
    .filter((d) => d.owner === entity.id)
    .sort((a, b) => a.title.localeCompare(b.title));

  const linkedBugs = [...bugs.values()]
    .filter((b) => b.origin_feature === entity.id)
    .sort((a, b) => a.id.localeCompare(b.id));

  const linkedDecisions = [...decisions.values()]
    .filter((d) => d.affects?.includes(entity.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const estimateRollup = estimateRollupForFeature(entity.id, tasks);

  // Build metadata items for the DataList
  const metadataItems = [
    entity.parent
      ? { label: "Parent Plan", value: <EntityLink entityId={entity.parent} /> }
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
    entity.design
      ? { label: "Design", value: <EntityLink entityId={entity.design} /> }
      : null,
    entity.spec
      ? { label: "Spec", value: <EntityLink entityId={entity.spec} /> }
      : null,
    entity.dev_plan
      ? { label: "Dev Plan", value: <EntityLink entityId={entity.dev_plan} /> }
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
    entity.branch
      ? {
          label: "Branch",
          value: (
            <span className="text-xs font-mono text-muted-foreground">
              {entity.branch}
            </span>
          ),
        }
      : null,
    entity.supersedes
      ? {
          label: "Supersedes",
          value: <EntityLink entityId={entity.supersedes} />,
        }
      : null,
    entity.superseded_by
      ? {
          label: "Superseded By",
          value: <EntityLink entityId={entity.superseded_by} />,
        }
      : null,
    entity.created
      ? {
          label: "Created",
          value: (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(entity.created)}
            </span>
          ),
        }
      : null,
    entity.created_by
      ? {
          label: "Created By",
          value: <span className="text-sm">{entity.created_by}</span>,
        }
      : null,
    entity.updated
      ? {
          label: "Updated",
          value: (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(entity.updated)}
            </span>
          ),
        }
      : null,
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  return (
    <div className="space-y-6">
      <DetailHeader
        icon={Puzzle}
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

      <EstimateDisplay
        rollup={estimateRollup}
        entityEstimate={entity.estimate}
      />

      <RelatedEntitiesSection
        title="Tasks"
        headerContent={
          <ProgressBar
            done={taskMetrics.done}
            total={taskMetrics.total}
            percentage={
              isNaN(taskMetrics.percentage) ? 0 : taskMetrics.percentage
            }
            label="Tasks"
          />
        }
      >
        {featureTasks.map((t) => (
          <RelatedEntityRow
            key={t.id}
            entityId={t.id}
            summary={t.summary}
            status={t.status}
          />
        ))}
      </RelatedEntitiesSection>

      {featureDocuments.length > 0 && (
        <RelatedEntitiesSection title="Documents">
          {featureDocuments.map((d) => (
            <RelatedEntityRow
              key={d.id}
              entityId={d.id}
              summary={d.title}
              status={d.status}
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

      {linkedDecisions.length > 0 && (
        <RelatedEntitiesSection title="Decisions">
          {linkedDecisions.map((d) => (
            <RelatedEntityRow
              key={d.id}
              entityId={d.id}
              summary={d.summary}
              status={d.status}
            />
          ))}
        </RelatedEntitiesSection>
      )}
    </div>
  );
}

export { FeatureDetail };
export type { FeatureDetailProps };
