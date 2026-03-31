// src/components/document/DocumentViewer.tsx

import { useEffect, useState, useRef, useCallback } from "react";
import {
  ChevronLeft,
  FileX,
  AlertCircle,
  AlignHorizontalSpaceAround,
  AlignStartVertical,
} from "lucide-react";
import { Button, IconButton, Tooltip } from "@radix-ui/themes";
import { MarkdownViewer } from "./MarkdownViewer";
import { MetadataPanel } from "./MetadataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore } from "@/lib/store/ui-store";
import { readDocumentContent } from "@/lib/reader/document";
import type { DocumentReadResult } from "@/lib/reader/document";

// ── Resize constants ────────────────────────────────────────────────

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 260;

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
  const [centered, setCentered] = useState(false);

  // ── Resizable sidebar state ─────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      // Dragging left increases sidebar width (sidebar is on the right)
      const delta = startXRef.current - e.clientX;
      const next = Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(MAX_SIDEBAR_WIDTH, startWidthRef.current + delta),
      );
      setSidebarWidth(next);
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

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
        frontMatter: null,
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
      {/* Viewer header — h-10 matches filter bars for consistent height */}
      <div className="flex items-center gap-2 px-4 h-10 border-b border-border shrink-0">
        <Button
          variant="soft"
          size="1"
          onClick={navigateBack}
          style={{ cursor: "pointer" }}
        >
          <ChevronLeft size={14} />
          Back
        </Button>
        <h1 className="text-sm font-semibold truncate flex-1">
          {displayTitle}
        </h1>

        {/* Document alignment toggle */}
        <Tooltip content={centered ? "Align left" : "Centre document"}>
          <IconButton
            variant="ghost"
            size="1"
            color="gray"
            onClick={() => setCentered((v) => !v)}
            aria-label={centered ? "Align left" : "Centre document"}
          >
            {centered ? (
              <AlignStartVertical size={14} />
            ) : (
              <AlignHorizontalSpaceAround size={14} />
            )}
          </IconButton>
        </Tooltip>
      </div>

      {/* Content + resizable sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Content area — scrolls independently */}
        <div
          className={
            centered
              ? "flex-1 overflow-y-auto px-8 py-6 flex justify-center"
              : "flex-1 overflow-y-auto px-8 py-6"
          }
        >
          {centered ? (
            <div className="w-full max-w-prose">
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
          ) : isLoading ? (
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

        {/* Drag handle for resizable sidebar */}
        <div
          className="shrink-0 w-1 relative cursor-col-resize hover:bg-[var(--accent-6)] transition-colors"
          onMouseDown={handleDividerMouseDown}
        >
          <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
        </div>

        {/* Metadata sidebar — resizable */}
        <div
          className="shrink-0 overflow-y-auto"
          style={{ width: sidebarWidth }}
        >
          {record && <MetadataPanel record={record} readResult={readResult} />}
        </div>
      </div>
    </div>
  );
}

export { DocumentViewer };
