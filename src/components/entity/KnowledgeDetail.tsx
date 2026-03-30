import { Lightbulb } from 'lucide-react';
import type { KnowledgeEntry } from '@/lib/types';
import { FieldValue } from './FieldValue';
import { DetailHeader } from './DetailHelpers';

interface KnowledgeDetailProps {
  entity: KnowledgeEntry;
}

function KnowledgeDetail({ entity }: KnowledgeDetailProps) {
  const tierLabel =
    entity.tier === 2 ? 'Tier 2 (project)' : entity.tier === 3 ? 'Tier 3 (session)' : String(entity.tier);

  const confidenceLabel =
    entity.confidence != null ? `${Math.round(entity.confidence * 100)}%` : undefined;

  const ttlLabel =
    entity.ttl_days != null ? `${entity.ttl_days} days` : undefined;

  return (
    <div className="space-y-6">
      <DetailHeader
        icon={Lightbulb}
        entityId={entity.id}
        summary={entity.topic}
        status={entity.status}
      />

      <FieldValue
        label="Content"
        value={entity.content}
        type="long-text"
        alwaysExpanded
      />

      <FieldValue label="Tier"         value={tierLabel}                  type="text" />
      <FieldValue label="Scope"        value={entity.scope}               type="text" />
      <FieldValue label="Learned From" value={entity.learned_from}        type="entity-ref" />
      <FieldValue label="Use Count"    value={entity.use_count}           type="number" />
      <FieldValue label="Miss Count"   value={entity.miss_count}          type="number" />
      <FieldValue label="Confidence"   value={confidenceLabel}            type="text" />
      <FieldValue label="TTL"          value={ttlLabel}                   type="text" />
      <FieldValue label="Git Anchors"  value={entity.git_anchors}         type="string-list" />
      <FieldValue label="Tags"         value={entity.tags}                type="tag-list" />
      <FieldValue label="Created"      value={entity.created}             type="timestamp" />
      <FieldValue label="Created By"   value={entity.created_by}          type="text" />
      <FieldValue label="Updated"      value={entity.updated}             type="timestamp" />
    </div>
  );
}

export { KnowledgeDetail };
export type { KnowledgeDetailProps };
