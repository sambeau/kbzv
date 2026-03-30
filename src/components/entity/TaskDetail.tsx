import { CheckSquare } from 'lucide-react';
import { useProjectStore } from '@/lib/store/project-store';
import type { Task } from '@/lib/types';
import { FieldValue } from './FieldValue';
import { DetailHeader, RelatedEntitiesSection, RelatedEntityRow } from './DetailHelpers';

interface TaskDetailProps {
  entity: Task;
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

  return (
    <div className="space-y-6">
      <DetailHeader
        icon={CheckSquare}
        entityId={entity.id}
        summary={entity.summary}
        status={entity.status}
      />

      <FieldValue label="Parent Feature"     value={entity.parent_feature}     type="entity-ref" />
      <FieldValue label="Slug"               value={entity.slug}               type="text" />
      <FieldValue label="Estimate"           value={entity.estimate != null ? `${entity.estimate} pts` : undefined} type="text" />
      <FieldValue label="Assignee"           value={entity.assignee}           type="text" />
      <FieldValue label="Depends On"         value={entity.depends_on}         type="entity-ref-list" />
      <FieldValue label="Files Planned"      value={entity.files_planned}      type="string-list" />
      <FieldValue label="Started"            value={entity.started}            type="timestamp" />
      <FieldValue label="Completed"          value={entity.completed}          type="timestamp" />
      <FieldValue label="Claimed At"         value={entity.claimed_at}         type="timestamp" />
      <FieldValue label="Dispatched To"      value={entity.dispatched_to}      type="text" />
      <FieldValue label="Dispatched At"      value={entity.dispatched_at}      type="timestamp" />
      <FieldValue label="Dispatched By"      value={entity.dispatched_by}      type="text" />
      <FieldValue label="Completion Summary" value={entity.completion_summary} type="long-text" />
      <FieldValue label="Rework Reason"      value={entity.rework_reason}      type="long-text" />
      <FieldValue label="Verification"       value={entity.verification}       type="long-text" />
      <FieldValue label="Tags"               value={entity.tags}               type="tag-list" />

      {dependents.length > 0 && (
        <RelatedEntitiesSection title="Dependents">
          {dependents.map((t) => (
            <RelatedEntityRow key={t.id} entityId={t.id} summary={t.summary} status={t.status} />
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
    </div>
  );
}

export { TaskDetail };
export type { TaskDetailProps };
