import { Puzzle } from 'lucide-react';
import { useProjectStore } from '@/lib/store/project-store';
import { taskCompletionForFeature, estimateRollupForFeature } from '@/lib/query/metrics';
import type { Feature } from '@/lib/types';
import { FieldValue } from './FieldValue';
import { DetailHeader, RelatedEntitiesSection, RelatedEntityRow } from './DetailHelpers';
import { ProgressBar } from '@/components/metrics/ProgressBar';
import { EstimateDisplay } from '@/components/metrics/EstimateDisplay';

interface FeatureDetailProps {
  entity: Feature;
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

  return (
    <div className="space-y-6">
      <DetailHeader
        icon={Puzzle}
        entityId={entity.id}
        summary={entity.summary}
        status={entity.status}
      />

      <FieldValue label="Parent Plan" value={entity.parent} type="entity-ref" />
      <FieldValue label="Slug" value={entity.slug} type="text" />
      <FieldValue label="Design" value={entity.design} type="entity-ref" />
      <FieldValue label="Spec" value={entity.spec} type="entity-ref" />
      <FieldValue label="Dev Plan" value={entity.dev_plan} type="entity-ref" />
      <FieldValue label="Tags" value={entity.tags} type="tag-list" />
      <FieldValue label="Branch" value={entity.branch} type="text" className="font-mono" />
      <FieldValue label="Supersedes" value={entity.supersedes} type="entity-ref" />
      <FieldValue label="Superseded By" value={entity.superseded_by} type="entity-ref" />
      <FieldValue label="Created" value={entity.created} type="timestamp" />
      <FieldValue label="Created By" value={entity.created_by} type="text" />
      <FieldValue label="Updated" value={entity.updated} type="timestamp" />

      <EstimateDisplay rollup={estimateRollup} entityEstimate={entity.estimate} />

      <RelatedEntitiesSection title="Tasks">
        <ProgressBar
          done={taskMetrics.done}
          total={taskMetrics.total}
          percentage={isNaN(taskMetrics.percentage) ? 0 : taskMetrics.percentage}
          label="Tasks"
        />
        {featureTasks.map((t) => (
          <RelatedEntityRow key={t.id} entityId={t.id} summary={t.summary} status={t.status} />
        ))}
      </RelatedEntitiesSection>

      {featureDocuments.length > 0 && (
        <RelatedEntitiesSection title="Documents">
          {featureDocuments.map((d) => (
            <RelatedEntityRow key={d.id} entityId={d.id} summary={d.title} status={d.status} />
          ))}
        </RelatedEntitiesSection>
      )}

      {linkedBugs.length > 0 && (
        <RelatedEntitiesSection title="Linked Bugs">
          {linkedBugs.map((b) => (
            <RelatedEntityRow key={b.id} entityId={b.id} summary={b.title} status={b.status} />
          ))}
        </RelatedEntitiesSection>
      )}

      {linkedDecisions.length > 0 && (
        <RelatedEntitiesSection title="Decisions">
          {linkedDecisions.map((d) => (
            <RelatedEntityRow key={d.id} entityId={d.id} summary={d.summary} status={d.status} />
          ))}
        </RelatedEntitiesSection>
      )}
    </div>
  );
}

export { FeatureDetail };
export type { FeatureDetailProps };
