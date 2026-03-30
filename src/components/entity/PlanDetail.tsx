import { Map } from 'lucide-react';
import { useProjectStore } from '@/lib/store/project-store';
import { featureCompletionForPlan, estimateRollupForPlan } from '@/lib/query/metrics';
import type { Plan } from '@/lib/types';
import { FieldValue } from './FieldValue';
import { DetailHeader } from './DetailHelpers';
import { RelatedEntitiesSection, RelatedEntityRow } from './DetailHelpers';
import { ProgressBar } from '@/components/metrics/ProgressBar';
import { EstimateDisplay } from '@/components/metrics/EstimateDisplay';

interface PlanDetailProps {
  entity: Plan;
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

  return (
    <div className="space-y-6">
      <DetailHeader
        icon={Map}
        entityId={entity.id}
        summary={entity.title}
        status={entity.status}
      />

      <FieldValue label="Summary"       value={entity.summary}        type="long-text" />
      <FieldValue label="Slug"          value={entity.slug}           type="text" className="text-xs text-muted-foreground" />
      <FieldValue label="Design"        value={entity.design}         type="entity-ref" />
      <FieldValue label="Tags"          value={entity.tags}           type="tag-list" />
      <FieldValue label="Created"       value={entity.created}        type="timestamp" />
      <FieldValue label="Created By"    value={entity.created_by}     type="text" />
      <FieldValue label="Updated"       value={entity.updated}        type="timestamp" />
      <FieldValue label="Supersedes"    value={entity.supersedes}     type="entity-ref" />
      <FieldValue label="Superseded By" value={entity.superseded_by}  type="entity-ref" />

      <RelatedEntitiesSection title="Features">
        <ProgressBar
          done={featureMetrics.done}
          total={featureMetrics.total}
          percentage={isNaN(featureMetrics.percentage) ? 0 : featureMetrics.percentage}
          label="Features"
        />
        {planFeatures.map((f) => (
          <RelatedEntityRow key={f.id} entityId={f.id} summary={f.summary} status={f.status} />
        ))}
      </RelatedEntitiesSection>

      {planDocuments.length > 0 && (
        <RelatedEntitiesSection title="Documents">
          {planDocuments.map((d) => (
            <RelatedEntityRow key={d.id} entityId={d.id} summary={d.title} status={d.status} />
          ))}
        </RelatedEntitiesSection>
      )}

      <EstimateDisplay rollup={planEstimate} />
    </div>
  );
}

export { PlanDetail };
export type { PlanDetailProps };
