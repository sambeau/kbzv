// src/components/document/MetadataPanel.tsx

import { useProjectStore } from "@/lib/store/project-store";
import { getRelatedEntities } from "@/lib/query/references";
import { getTypeColour } from "@/lib/constants/type-colours";
import { DriftBadge } from "./DriftBadge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocumentRecord } from "@/lib/types";
import type { DocumentReadResult } from "@/lib/reader/document";

// ── Props ───────────────────────────────────────────────────────────

interface MetadataPanelProps {
  record: DocumentRecord;
  readResult: DocumentReadResult | null;
}

// ── Sub-components ──────────────────────────────────────────────────

function MetadataField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colour = getTypeColour(type);
  return (
    <Badge
      variant="secondary"
      className={cn(colour.bg, colour.text, "border-0 font-normal")}
    >
      {type}
    </Badge>
  );
}

function EntityLink({
  entityId,
  subtitle,
}: {
  entityId: string;
  subtitle?: string;
}) {
  const entity = useProjectStore((state) => {
    // Try to look up in plans first, then features, tasks, bugs
    return (
      state.plans.get(entityId) ??
      state.features.get(entityId) ??
      state.tasks.get(entityId) ??
      state.bugs.get(entityId) ??
      null
    );
  });

  return (
    <span className="text-sm">
      <span className={entity ? "text-foreground" : "text-muted-foreground/60"}>
        {entityId}
      </span>
      {subtitle && (
        <span className="text-xs text-muted-foreground ml-1">{subtitle}</span>
      )}
      {!entity && (
        <span className="text-muted-foreground/40 ml-0.5 text-xs">(not found)</span>
      )}
    </span>
  );
}

function ContentHashStatus({
  record,
  readResult,
}: {
  record: DocumentRecord;
  readResult: DocumentReadResult | null;
}) {
  if (!readResult) {
    return <span className="text-xs text-muted-foreground">— Loading…</span>;
  }

  if (readResult.fileMissing) {
    return <span className="text-xs text-red-500">✗ File missing</span>;
  }

  if (!record.content_hash) {
    return <span className="text-xs text-muted-foreground">— No hash recorded</span>;
  }

  if (readResult.hashMatches) {
    return <span className="text-xs text-muted-foreground">✓ Content verified</span>;
  }

  return <span className="text-xs text-orange-600">⚠ Content modified</span>;
}

// ── MetadataPanel ───────────────────────────────────────────────────

function MetadataPanel({ record, readResult }: MetadataPanelProps) {
  const relatedEntities = useProjectStore((state) =>
    getRelatedEntities(record.id, state),
  );

  const contentHashActual =
    readResult && !readResult.fileMissing ? readResult.contentHash : undefined;

  return (
    <div className="px-4 py-4 space-y-5">
      {/* 1. Status (DriftBadge) */}
      <MetadataField label="Status">
        <DriftBadge
          status={record.status}
          contentHashExpected={record.content_hash}
          contentHashActual={contentHashActual}
          fileMissing={readResult?.fileMissing ?? false}
        />
      </MetadataField>

      {/* 2. Filename */}
      <MetadataField label="Filename">
        <span className="text-xs text-muted-foreground font-mono break-all">
          {record.path}
        </span>
      </MetadataField>

      {/* 3. Type */}
      <MetadataField label="Type">
        <TypeBadge type={record.type} />
      </MetadataField>

      {/* 4. Owner */}
      <MetadataField label="Owner">
        {record.owner ? (
          <EntityLink entityId={record.owner} />
        ) : (
          <span className="text-sm text-muted-foreground">(none)</span>
        )}
      </MetadataField>

      {/* 5. Related Entities */}
      <MetadataField label="Related Entities">
        {relatedEntities.length > 0 ? (
          <div className="space-y-1">
            {relatedEntities.map((entity) => (
              <EntityLink
                key={entity.id}
                entityId={entity.id}
                subtitle={entity.summary}
              />
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">(none)</span>
        )}
      </MetadataField>

      {/* 6. Superseded By */}
      <MetadataField label="Superseded By">
        {record.superseded_by ? (
          <div>
            <EntityLink entityId={record.superseded_by} />
            {record.supersedes && (
              <div className="mt-1">
                <span className="text-xs text-muted-foreground">Supersedes: </span>
                <EntityLink entityId={record.supersedes} />
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">(none)</span>
        )}
      </MetadataField>

      {/* 7. Content Hash Status */}
      <MetadataField label="Content Hash">
        <ContentHashStatus record={record} readResult={readResult} />
      </MetadataField>
    </div>
  );
}

export { MetadataPanel };
export type { MetadataPanelProps };
