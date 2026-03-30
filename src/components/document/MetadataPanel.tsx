// src/components/document/MetadataPanel.tsx

import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore } from "@/lib/store/ui-store";
import { getRelatedEntities } from "@/lib/query/references";
import { getTypeColour } from "@/lib/constants/type-colours";
import { DriftBadge } from "./DriftBadge";
import { EntityLink } from "@/components/common/EntityLink";
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
    return (
      <span className="text-xs text-muted-foreground">— No hash recorded</span>
    );
  }

  if (readResult.hashMatches) {
    return (
      <span className="text-xs text-muted-foreground">✓ Content verified</span>
    );
  }

  return <span className="text-xs text-orange-600">⚠ Content modified</span>;
}

// ── MetadataPanel ───────────────────────────────────────────────────

function MetadataPanel({ record, readResult }: MetadataPanelProps) {
  const relatedEntities = useProjectStore((state) =>
    getRelatedEntities(record.id, state),
  );
  const activateFilter = useUIStore((s) => s.activateFilter);
  const documentFilters = useUIStore((s) => s.documentFilters);

  const contentHashActual =
    readResult && !readResult.fileMissing ? readResult.contentHash : undefined;

  const colour = getTypeColour(record.type);
  const isTypeActive = documentFilters.types.includes(record.type);

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

      {/* 3. Type — clickable to activate document type filter */}
      <MetadataField label="Type">
        <Badge
          variant="secondary"
          className={cn(
            colour.bg,
            colour.text,
            "border-0 font-normal cursor-pointer hover:brightness-90 transition-colors",
            isTypeActive && "ring-2 ring-offset-1 ring-primary",
          )}
          onClick={() => activateFilter("documents", "type", record.type)}
        >
          {record.type}
        </Badge>
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
              <div key={entity.id} className="flex items-center gap-1.5">
                <EntityLink entityId={entity.id} />
                <span className="text-xs text-muted-foreground truncate">
                  {entity.summary}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">(none)</span>
        )}
      </MetadataField>

      {/* 6. Superseded By */}
      <MetadataField label="Superseded By">
        {record.superseded_by ? (
          <div className="space-y-1">
            <EntityLink entityId={record.superseded_by} />
            {record.supersedes && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  Supersedes:
                </span>
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
