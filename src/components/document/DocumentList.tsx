// src/components/document/DocumentList.tsx

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FileText, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import React from "react";
import { Badge, Table } from "@radix-ui/themes";

import { EmptyState } from "@/components/common/EmptyState";
import { DocumentFilterBar } from "./DocumentFilterBar";
import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore } from "@/lib/store/ui-store";

import type { DocumentRecord } from "@/lib/types";
import type { SortOption } from "@/lib/store/ui-store";

// ── Sort / Filter Helpers ───────────────────────────────────────────

type SortOptionValue = SortOption;

const DEFAULT_SORT: SortOptionValue = "newest";

const DOC_TYPE_COLOUR: Record<string, string> = {
  design: "blue",
  specification: "teal",
  "dev-plan": "indigo",
  research: "amber",
  report: "gray",
  policy: "orange",
  rca: "red",
};

const STATUS_COLOUR: Record<string, string> = {
  approved: "green",
  draft: "gray",
  superseded: "purple",
};

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

// ── Component ───────────────────────────────────────────────────────

function DocumentList() {
  const documents = useProjectStore((s) => s.documents);

  // Filter state — driven by the store so cross-view activateFilter() is reactive
  const documentFilters = useUIStore((s) => s.documentFilters);
  const setDocumentFilters = useUIStore((s) => s.setDocumentFilters);
  const activateFilter = useUIStore((s) => s.activateFilter);
  const navigateToDocument = useUIStore((s) => s.navigateToDocument);
  const saveDocumentListScrollTop = useUIStore(
    (s) => s.saveDocumentListScrollTop,
  );
  const storedScrollTop = useUIStore((s) => s.documentListFilters.scrollTop);

  // Sort option stays local (not worth cross-view activation)
  const [sortOption, setSortOption] = useState<SortOptionValue>(DEFAULT_SORT);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Derive Set views of the store arrays for O(1) lookup
  const activeTypes = useMemo(
    () => new Set(documentFilters.types),
    [documentFilters.types],
  );
  const activeStatuses = useMemo(
    () => new Set(documentFilters.statuses),
    [documentFilters.statuses],
  );

  // ── Restore scroll position on mount ─────────────────────────────
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el && storedScrollTop > 0) {
      el.scrollTop = storedScrollTop;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save scroll position during normal scrolling ──────────────────
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    let rafId: number;
    const handler = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        saveDocumentListScrollTop(el.scrollTop);
      });
    };

    el.addEventListener("scroll", handler, { passive: true });
    return () => {
      el.removeEventListener("scroll", handler);
      cancelAnimationFrame(rafId);
    };
  }, [saveDocumentListScrollTop]);

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

  // ── Handlers ─────────────────────────────────────────────────────

  function handleRowClick(docId: string) {
    // Save current scroll position before navigating away
    if (scrollContainerRef.current) {
      saveDocumentListScrollTop(scrollContainerRef.current.scrollTop);
    }
    navigateToDocument(docId);
  }

  function handleTypeBadgeClick(e: React.MouseEvent, type: string) {
    e.stopPropagation();
    activateFilter("documents", "type", type);
  }

  function handleStatusBadgeClick(e: React.MouseEvent, status: string) {
    e.stopPropagation();
    activateFilter("documents", "status", status);
  }

  function handleTypesChange(types: Set<string>) {
    setDocumentFilters({
      ...documentFilters,
      types: [...types],
    });
  }

  function handleStatusesChange(statuses: Set<string>) {
    setDocumentFilters({
      ...documentFilters,
      statuses: [...statuses],
    });
  }

  function clearAllFilters() {
    setDocumentFilters({ types: [], statuses: [] });
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Filter bar — fixed at top */}
      <DocumentFilterBar
        activeTypes={activeTypes}
        activeStatuses={activeStatuses}
        sortOption={sortOption}
        onTypesChange={handleTypesChange}
        onStatusesChange={handleStatusesChange}
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
          <Table.Root variant="surface" size="2">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ width: "6rem" }}>
                  Type
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ width: "6rem" }}>
                  Status
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ width: "8rem" }}>
                  Updated
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sorted.map((doc) => {
                const typeColor = (DOC_TYPE_COLOUR[doc.type] ??
                  "gray") as React.ComponentProps<typeof Badge>["color"];
                const statusColor = (STATUS_COLOUR[doc.status] ??
                  "gray") as React.ComponentProps<typeof Badge>["color"];
                const displayTitle =
                  doc.title || doc.path.split("/").pop() || doc.id;

                return (
                  <Table.Row
                    key={doc.id}
                    onClick={() => handleRowClick(doc.id)}
                    style={{ cursor: "pointer" }}
                    className="hover:bg-[var(--gray-3)]"
                  >
                    <Table.Cell>
                      <span className="text-sm font-medium">
                        {displayTitle}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={typeColor}
                        variant={activeTypes.has(doc.type) ? "solid" : "soft"}
                        style={{ cursor: "pointer" }}
                        onClick={(e) => handleTypeBadgeClick(e, doc.type)}
                      >
                        {doc.type}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={statusColor}
                        variant={
                          activeStatuses.has(doc.status) ? "solid" : "soft"
                        }
                        style={{ cursor: "pointer" }}
                        onClick={(e) => handleStatusBadgeClick(e, doc.status)}
                      >
                        {doc.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className="text-xs text-muted-foreground whitespace-nowrap"
                        title={doc.updated}
                      >
                        {formatRelativeDate(doc.updated)}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </div>
    </div>
  );
}

export { DocumentList };
