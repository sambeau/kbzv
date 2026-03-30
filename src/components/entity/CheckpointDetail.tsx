import { CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HumanCheckpoint } from '@/lib/types';
import { FieldValue } from './FieldValue';
import { DetailHeader } from './DetailHelpers';

interface CheckpointDetailProps {
  entity: HumanCheckpoint;
}

function CheckpointDetail({ entity }: CheckpointDetailProps) {
  const isPending = entity.status === 'pending';

  return (
    <div className="space-y-6">
      <DetailHeader
        icon={CircleHelp}
        entityId={entity.id}
        summary={entity.question.length > 80 ? entity.question.slice(0, 80) + '…' : entity.question}
        status={entity.status}
        className={cn(
          isPending &&
            'bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-400 rounded-r-md p-4',
        )}
      />

      <FieldValue
        label="Question"
        value={entity.question}
        type="long-text"
        alwaysExpanded
      />

      <FieldValue
        label="Context"
        value={entity.context}
        type="long-text"
      />

      <FieldValue
        label="Orchestration Summary"
        value={entity.orchestration_summary}
        type="long-text"
      />

      <FieldValue label="Created By" value={entity.created_by} type="text" />

      {entity.status === 'responded' && (
        <FieldValue
          label="Response"
          value={entity.response}
          type="long-text"
          alwaysExpanded
        />
      )}

      <FieldValue label="Created" value={entity.created} type="timestamp" />

      {entity.status === 'responded' && (
        <FieldValue label="Responded At" value={entity.responded_at} type="timestamp" />
      )}
    </div>
  );
}

export { CheckpointDetail };
export type { CheckpointDetailProps };
