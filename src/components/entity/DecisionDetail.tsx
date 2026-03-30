import { Scale } from 'lucide-react';
import type { Decision } from '@/lib/types';
import { FieldValue } from './FieldValue';
import { DetailHeader } from './DetailHelpers';

interface DecisionDetailProps {
  entity: Decision;
}

function DecisionDetail({ entity }: DecisionDetailProps) {
  return (
    <div className="space-y-6">
      <DetailHeader
        icon={Scale}
        entityId={entity.id}
        summary={entity.summary}
        status={entity.status}
      />

      <FieldValue label="Rationale"     value={entity.rationale}      type="long-text" />
      <FieldValue label="Decided By"    value={entity.decided_by}     type="text" />
      <FieldValue label="Date"          value={entity.date}           type="timestamp" />
      <FieldValue label="Affects"       value={entity.affects}        type="entity-ref-list" />
      <FieldValue label="Supersedes"    value={entity.supersedes}     type="entity-ref" />
      <FieldValue label="Superseded By" value={entity.superseded_by}  type="entity-ref" />
      <FieldValue label="Tags"          value={entity.tags}           type="tag-list" />
    </div>
  );
}

export { DecisionDetail };
export type { DecisionDetailProps };
