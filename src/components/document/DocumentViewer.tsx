// src/components/document/DocumentViewer.tsx

import { useEffect, useState } from "react";
import { ChevronLeft, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownViewer } from "./MarkdownViewer";
import { MetadataPanel } from "./MetadataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { useProjectStore } from "@/lib/store/project-store";
import { readDocumentContent } from "@/lib/reader/document";
import type { DocumentReadResult } from "@/lib/reader/document";

// ── Props ───────────────────────────────────────────────────────────

interface DocumentViewerProps {
  documentId: string;
  onBack: () => void;
}

// ── Loading State ───────────────────────────────────────────────────

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────

function DocumentViewer({ documentId, onBack }: DocumentViewerProps) {
  const [readResult, setReadResult] = useState<DocumentReadResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const record = useProjectStore((s) => s.documents.get(documentId));
  const projectPath = useProjectStore((s) => s.projectPath);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setReadResult(null);

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

    readDocumentContent(projectPath, record).then((result) => {
      if (!cancelled) {
        setReadResult(result);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [documentId, record, projectPath]);

  const displayTitle = record?.title || record?.path.split("/").pop() || documentId;

  return (
    <div className="flex flex-col h-full">
      {/* Viewer header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
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
          ) : readResult?.fileMissing ? (
            <EmptyState
              icon={FileX}
              title="File not found"
              description={`The file ${record?.path ?? documentId} could not be found.`}
            />
          ) : (
            <MarkdownViewer content={readResult!.markdown!} />
          )}
        </div>

        {/* Metadata sidebar */}
        <div className="w-[260px] shrink-0 border-l border-border overflow-y-auto">
          {record && (
            <MetadataPanel record={record} readResult={readResult} />
          )}
        </div>
      </div>
    </div>
  );
}

export { DocumentViewer };
export type { DocumentViewerProps };
