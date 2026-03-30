import { Bug } from 'lucide-react';
import type { Bug as BugEntity } from '@/lib/types';
import { FieldValue } from './FieldValue';
import { DetailHeader } from './DetailHelpers';

interface BugDetailProps {
  entity: BugEntity;
}

function BugDetail({ entity }: BugDetailProps) {
  return (
    <div className="space-y-6">
      <DetailHeader
        icon={Bug}
        entityId={entity.id}
        summary={entity.title}
        status={entity.status}
      />

      <FieldValue label="Severity"       value={entity.severity}        type="severity" />
      <FieldValue label="Priority"       value={entity.priority}        type="priority" />
      <FieldValue label="Type"           value={entity.type}            type="text" />
      <FieldValue label="Slug"           value={entity.slug}            type="text" />
      <FieldValue label="Estimate"       value={entity.estimate}        type="number" />
      <FieldValue label="Reported By"    value={entity.reported_by}     type="text" />
      <FieldValue label="Reported"       value={entity.reported}        type="timestamp" />
      <FieldValue label="Observed"       value={entity.observed}        type="long-text" />
      <FieldValue label="Expected"       value={entity.expected}        type="long-text" />
      <FieldValue label="Affects"        value={entity.affects}         type="entity-ref-list" />
      <FieldValue label="Origin Feature" value={entity.origin_feature}  type="entity-ref" />
      <FieldValue label="Origin Task"    value={entity.origin_task}     type="entity-ref" />
      <FieldValue label="Environment"    value={entity.environment}     type="text" />
      <FieldValue label="Reproduction"   value={entity.reproduction}    type="long-text" />
      <FieldValue label="Duplicate Of"   value={entity.duplicate_of}    type="entity-ref" />
      <FieldValue label="Fixed By"       value={entity.fixed_by}        type="text" />
      <FieldValue label="Verified By"    value={entity.verified_by}     type="text" />
      <FieldValue label="Release Target" value={entity.release_target}  type="text" />
      <FieldValue label="Tags"           value={entity.tags}            type="tag-list" />
    </div>
  );
}

export { BugDetail };
export type { BugDetailProps };
