import { Map } from "lucide-react";
import { useProjectStore } from "@/lib/store/project-store";
import {
  featureCompletionForPlan,
  estimateRollupForPlan,
} from "@/lib/query/metrics";
import type { Plan } from "@/lib/types";
import {
  DetailHeader,
  MetadataList,
  RelatedEntitiesSection,
  RelatedEntityRow,
} from "./DetailHelpers";
import { ProgressBar } from "@/components/metrics/ProgressBar";
import { EstimateDisplay } from "@/components/metrics/EstimateDisplay";
import { EntityLink } from "@/components/common/EntityLink";
import { Badge } from "@radix-ui/themes";
import { formatDistanceToNow } from "date-fns";

interface PlanDetailProps {
  entity: Plan;
}

function formatTimestamp(ts: string): string {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return ts;
  }
}

function PlanDetail({ entity }: PlanDetailProps) {
  const features = useProjectStore((s) => s.features);
  const documents = useProjectStore((s) => s.documents);

  const planFeatures = [...features.values()]
    .filter((f) => f.parent === entity.id)
    .sort((a, b) => a.id.localeCompare(b.id));

  const featureMetrics = featureCompletionForPlan(entity.id, features);

  const planDocuments = [...documents.values()]
    .filter((d) => d.owner === entity.id)
    .sort((a, b) => a.title.localeCompare(b.title));

  const planEstimate = estimateRollupForPlan(entity.id, features);

  // Build metadata items for the DataList
  const metadataItems = [
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
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  return (
    <div className="space-y-6">
      <DetailHeader
        icon={Map}
        entityId={entity.id}
        summary={entity.title}
        status={entity.status}
      />

      {/* Summary text — no label, just the text */}
      {entity.summary && (
        <p className="text-sm text-muted-foreground">{entity.summary}</p>
      )}

      {/* Compact metadata via DataList */}
      <MetadataList items={metadataItems} />

      <RelatedEntitiesSection
        title="Features"
        headerContent={
          <ProgressBar
            done={featureMetrics.done}
            total={featureMetrics.total}
            percentage={
              isNaN(featureMetrics.percentage) ? 0 : featureMetrics.percentage
            }
            label="Features"
          />
        }
      >
        {planFeatures.map((f) => (
          <RelatedEntityRow
            key={f.id}
            entityId={f.id}
            summary={f.summary}
            status={f.status}
          />
        ))}
      </RelatedEntitiesSection>

      {planDocuments.length > 0 && (
        <RelatedEntitiesSection title="Documents">
          {planDocuments.map((d) => (
            <RelatedEntityRow
              key={d.id}
              entityId={d.id}
              summary={d.title}
              status={d.status}
            />
          ))}
        </RelatedEntitiesSection>
      )}

      <EstimateDisplay rollup={planEstimate} />
    </div>
  );
}

export { PlanDetail };
export type { PlanDetailProps };
