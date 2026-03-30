import { AlertOctagon } from 'lucide-react';
import type { Incident } from '@/lib/types';
import { FieldValue } from './FieldValue';
import { DetailHeader } from './DetailHelpers';

interface IncidentDetailProps {
  entity: Incident;
}

function IncidentDetail({ entity }: IncidentDetailProps) {
  return (
    <div className="space-y-6">
      <DetailHeader
        icon={AlertOctagon}
        entityId={entity.id}
        summary={entity.title}
        status={entity.status}
      />

      <FieldValue label="Severity"          value={entity.severity}           type="severity" />
      <FieldValue label="Summary"           value={entity.summary}            type="long-text" />
      <FieldValue label="Reported By"       value={entity.reported_by}        type="text" />
      <FieldValue label="Detected At"       value={entity.detected_at}        type="timestamp" />
      <FieldValue label="Triaged At"        value={entity.triaged_at}         type="timestamp" />
      <FieldValue label="Mitigated At"      value={entity.mitigated_at}       type="timestamp" />
      <FieldValue label="Resolved At"       value={entity.resolved_at}        type="timestamp" />
      <FieldValue label="Affected Features" value={entity.affected_features}  type="entity-ref-list" />
      <FieldValue label="Linked Bugs"       value={entity.linked_bugs}        type="entity-ref-list" />
      <FieldValue label="Linked RCA"        value={entity.linked_rca}         type="entity-ref" />
    </div>
  );
}

export { IncidentDetail };
export type { IncidentDetailProps };
