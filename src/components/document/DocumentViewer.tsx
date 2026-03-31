// src/components/document/DocumentViewer.tsx

import { useEffect, useState } from "react";
import { ChevronLeft, FileX } from "lucide-react";
import { Button } from "@radix-ui/themes";
import { AlertCircle } from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";
import { MetadataPanel } from "./MetadataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore } from "@/lib/store/ui-store";
import { readDocumentContent } from "@/lib/reader/document";
import type { DocumentReadResult } from "@/lib/reader/document";

// ── Loading State ───────────────────────────────────────────────────

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-center max-w-sm">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Failed to load document</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────

function DocumentViewer() {
  const viewingDocumentId = useUIStore((s) => s.viewingDocumentId);
  const navigateBack = useUIStore((s) => s.navigateBack);

  const [readResult, setReadResult] = useState<DocumentReadResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const record = useProjectStore((s) =>
    viewingDocumentId ? s.documents.get(viewingDocumentId) : undefined,
  );
  const projectPath = useProjectStore((s) => s.projectPath);

  useEffect(() => {
    if (!viewingDocumentId) return;

    let cancelled = false;
    setIsLoading(true);
    setReadResult(null);
    setLoadError(null);

    if (!record || !projectPath) {
      setReadResult({
        markdown: null,
        contentHash: null,
        hashMatches: false,
        fileMissing: true,
      });
      setIsLoading(false);
      return;
    }

    readDocumentContent(projectPath, record)
      .then((result) => {
        if (!cancelled) {
          setReadResult(result);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("[DocumentViewer] Failed to load document:", err);
          setLoadError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [viewingDocumentId, record, projectPath]);

  if (!viewingDocumentId) return null;

  const displayTitle =
    record?.title || record?.path.split("/").pop() || viewingDocumentId;

  return (
    <div className="flex flex-col h-full">
      {/* Viewer header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Button variant="soft" size="1" onClick={navigateBack}>
          <ChevronLeft size={14} />
          Back
        </Button>
        <h1 className="text-lg font-semibold truncate">{displayTitle}</h1>
      </div>

      {/* Content + sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Content area — scrolls independently */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {isLoading ? (
            <LoadingState message="Loading document…" />
          ) : loadError ? (
            <ErrorState message={loadError} />
          ) : readResult?.fileMissing ? (
            <EmptyState
              icon={FileX}
              title="File not found"
              description={`The file ${record?.path ?? viewingDocumentId} could not be found.`}
            />
          ) : (
            <MarkdownViewer content={readResult!.markdown!} />
          )}
        </div>

        {/* Metadata sidebar */}
        <div className="w-[260px] shrink-0 border-l border-border overflow-y-auto">
          {record && <MetadataPanel record={record} readResult={readResult} />}
        </div>
      </div>
    </div>
  );
}

export { DocumentViewer };
