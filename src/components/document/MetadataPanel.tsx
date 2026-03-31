// src/components/document/MetadataPanel.tsx

import { useMemo } from "react";
import { Badge } from "@radix-ui/themes";
import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore } from "@/lib/store/ui-store";
import { getRelatedEntities } from "@/lib/query/references";
import { DriftBadge } from "./DriftBadge";
import { EntityLink } from "@/components/common/EntityLink";
import type { DocumentRecord } from "@/lib/types";
import type { DocumentReadResult } from "@/lib/reader/document";

// Fields already covered by the record — skip these in front matter display
const RECORD_COVERED_KEYS = new Set([
  "title",
  "type",
  "status",
  "owner",
  "path",
  "content_hash",
  "superseded_by",
  "supersedes",
  "created",
  "created_by",
  "updated",
]);

function formatFrontMatterValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Map document type strings to Radix Themes colour names
const DOC_TYPE_COLOUR: Record<string, string> = {
  design: "blue",
  specification: "teal",
  "dev-plan": "indigo",
  research: "amber",
  report: "gray",
  policy: "orange",
  rca: "red",
};

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
  // Subscribe to the two maps that feed getRelatedEntities so that the memo
  // dependency array receives stable Map references (Zustand creates a new Map
  // instance on every update, so these are reliable change signals).
  const plans = useProjectStore((s) => s.plans);
  const features = useProjectStore((s) => s.features);

  // Derive related entities only when the relevant data actually changes.
  // Calling getRelatedEntities directly inside a Zustand selector creates a
  // new array reference on every store update, which triggers an infinite
  // re-render loop via useSyncExternalStore's snapshot comparison.
  const relatedEntities = useMemo(
    () => getRelatedEntities(record.id, useProjectStore.getState()),
    [record.id, plans, features],
  );

  const activateFilter = useUIStore((s) => s.activateFilter);
  const documentFilters = useUIStore((s) => s.documentFilters);

  const contentHashActual =
    readResult && !readResult.fileMissing ? readResult.contentHash : undefined;

  const typeColour = (DOC_TYPE_COLOUR[record.type] ??
    "gray") as React.ComponentProps<typeof Badge>["color"];
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
          color={typeColour}
          variant={isTypeActive ? "solid" : "soft"}
          style={{ cursor: "pointer" }}
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

      {/* 8. Front Matter */}
      {(() => {
        const fm =
          readResult && !readResult.fileMissing ? readResult.frontMatter : null;
        if (!fm) return null;
        const entries = Object.entries(fm).filter(
          ([key]) => !RECORD_COVERED_KEYS.has(key),
        );
        if (entries.length === 0) return null;
        return (
          <MetadataField label="Front Matter">
            <div className="space-y-2">
              {entries.map(([key, value]) => (
                <div key={key}>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {key}
                  </div>
                  <span className="text-xs text-muted-foreground break-all">
                    {formatFrontMatterValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </MetadataField>
        );
      })()}
    </div>
  );
}

export { MetadataPanel };
export type { MetadataPanelProps };
