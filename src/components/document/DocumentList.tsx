// src/components/document/DocumentList.tsx

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FileText, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import { EmptyState } from "@/components/common/EmptyState";
import { DocumentFilterBar } from "./DocumentFilterBar";
import { useProjectStore } from "@/lib/store/project-store";
import { getTypeColour } from "@/lib/constants/type-colours";
import type { DocumentRecord } from "@/lib/types";
import type { DocumentListFilters, SortOption } from "@/lib/store/ui-store";

// ── Sort / Filter Helpers ───────────────────────────────────────────

type SortOptionValue = SortOption;

const DEFAULT_SORT: SortOptionValue = "newest";

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  approved: { bg: "bg-green-100", text: "text-green-800" },
  draft: { bg: "bg-gray-100", text: "text-gray-600" },
  superseded: { bg: "bg-purple-100", text: "text-purple-800" },
};

const UNKNOWN_STATUS_COLOUR = { bg: "bg-gray-100", text: "text-gray-500" };

function getStatusColour(status: string): { bg: string; text: string } {
  return STATUS_COLOURS[status] ?? UNKNOWN_STATUS_COLOUR;
}

function sortDocuments(
  docs: DocumentRecord[],
  option: SortOptionValue,
): DocumentRecord[] {
  return [...docs].sort((a, b) => {
    switch (option) {
      case "newest":
        return b.updated.localeCompare(a.updated);
      case "oldest":
        return a.updated.localeCompare(b.updated);
      case "title-asc":
        return a.title.localeCompare(b.title, undefined, {
          sensitivity: "base",
        });
      case "title-desc":
        return b.title.localeCompare(a.title, undefined, {
          sensitivity: "base",
        });
      case "type":
        return a.type.localeCompare(b.type);
      case "status":
        return a.status.localeCompare(b.status);
    }
  });
}

function filterDocuments(
  docs: DocumentRecord[],
  activeTypes: Set<string>,
  activeStatuses: Set<string>,
): DocumentRecord[] {
  return docs.filter((doc) => {
    const matchesType = activeTypes.size === 0 || activeTypes.has(doc.type);
    const matchesStatus =
      activeStatuses.size === 0 || activeStatuses.has(doc.status);
    return matchesType && matchesStatus;
  });
}

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 1) return "Today";
    if (diffDays < 2) return "Yesterday";

    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateStr;
  }
}

// ── Props ───────────────────────────────────────────────────────────

interface DocumentListProps {
  onSelect: (documentId: string) => void;
  initialFilters?: DocumentListFilters;
  onFiltersChange?: (filters: DocumentListFilters) => void;
}

// ── Component ───────────────────────────────────────────────────────

function DocumentList({
  onSelect,
  initialFilters,
  onFiltersChange,
}: DocumentListProps) {
  const documents = useProjectStore((s) => s.documents);

  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    () => new Set(initialFilters?.activeTypes ?? []),
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(initialFilters?.activeStatuses ?? []),
  );
  const [sortOption, setSortOption] = useState<SortOptionValue>(
    initialFilters?.sortOption ?? DEFAULT_SORT,
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Restore scroll position on mount ─────────────────────────────
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el && initialFilters?.scrollTop) {
      el.scrollTop = initialFilters.scrollTop;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save scroll + filter state on change ─────────────────────────
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    let rafId: number;
    const handler = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        onFiltersChange?.({
          activeTypes: [...activeTypes],
          activeStatuses: [...activeStatuses],
          sortOption,
          scrollTop: el.scrollTop,
        });
      });
    };

    el.addEventListener("scroll", handler, { passive: true });
    return () => {
      el.removeEventListener("scroll", handler);
      cancelAnimationFrame(rafId);
    };
  }, [activeTypes, activeStatuses, sortOption, onFiltersChange]);

  // ── Notify parent when filters change (non-scroll) ────────────────
  useEffect(() => {
    const el = scrollContainerRef.current;
    onFiltersChange?.({
      activeTypes: [...activeTypes],
      activeStatuses: [...activeStatuses],
      sortOption,
      scrollTop: el?.scrollTop ?? 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTypes, activeStatuses, sortOption]);

  // ── Derived lists ─────────────────────────────────────────────────
  const allDocs = useMemo(() => Array.from(documents.values()), [documents]);

  const filtered = useMemo(
    () => filterDocuments(allDocs, activeTypes, activeStatuses),
    [allDocs, activeTypes, activeStatuses],
  );

  const sorted = useMemo(
    () => sortDocuments(filtered, sortOption),
    [filtered, sortOption],
  );

  // ── Badge click handlers ──────────────────────────────────────────
  function handleTypeBadgeClick(e: React.MouseEvent, type: string) {
    e.stopPropagation();
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function handleStatusBadgeClick(e: React.MouseEvent, status: string) {
    e.stopPropagation();
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function clearAllFilters() {
    setActiveTypes(new Set());
    setActiveStatuses(new Set());
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Filter bar — fixed at top */}
      <DocumentFilterBar
        activeTypes={activeTypes}
        activeStatuses={activeStatuses}
        sortOption={sortOption}
        onTypesChange={setActiveTypes}
        onStatusesChange={setActiveStatuses}
        onSortChange={setSortOption}
      />

      {/* Scroll container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        {allDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents"
            description="This project has no registered documents."
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No matches"
            description="No documents match the active filters."
            action={{
              label: "Clear filters",
              onClick: clearAllFilters,
            }}
          />
        ) : (
          <div className="space-y-2">
            {sorted.map((doc) => {
              const typeColour = getTypeColour(doc.type);
              const statusColour = getStatusColour(doc.status);
              const displayTitle =
                doc.title || doc.path.split("/").pop() || doc.id;

              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onSelect(doc.id)}
                  className={cn(
                    "flex items-start justify-between w-full rounded-lg border",
                    "border-border bg-card px-4 py-3 text-left transition-colors",
                    "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2",
                    "focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                >
                  {/* Left column */}
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
                    <span className="text-sm font-medium leading-tight truncate">
                      {displayTitle}
                    </span>
                    <span
                      className="text-xs text-muted-foreground"
                      title={doc.updated}
                    >
                      {formatRelativeDate(doc.updated)}
                    </span>
                  </div>

                  {/* Right column — badges */}
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <Badge
                      variant="secondary"
                      className={cn(
                        typeColour.bg,
                        typeColour.text,
                        "border-0 font-normal",
                      )}
                      onClick={(e) => handleTypeBadgeClick(e, doc.type)}
                    >
                      {doc.type}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={cn(
                        statusColour.bg,
                        statusColour.text,
                        "border-0 font-normal",
                      )}
                      onClick={(e) => handleStatusBadgeClick(e, doc.status)}
                    >
                      {doc.status}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export { DocumentList };
export type { DocumentListProps };
