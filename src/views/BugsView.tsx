// src/views/BugsView.tsx

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Bug } from "lucide-react";
import { Badge, Separator } from "@radix-ui/themes";
import { useProjectStore } from "@/lib/store/project-store";
import { useUIStore } from "@/lib/store/ui-store";
import { EmptyState } from "@/components/common/EmptyState";
import { EntityDetail } from "@/components/entity/EntityDetail";
import { cn } from "@/lib/utils";

// ── Colour maps ─────────────────────────────────────────────────────

type BadgeColor =
  | "red"
  | "orange"
  | "yellow"
  | "gray"
  | "blue"
  | "green"
  | "purple";

const SEVERITY_COLOUR: Record<string, BadgeColor> = {
  critical: "red",
  high: "orange",
  medium: "yellow",
  low: "gray",
};

const STATUS_COLOUR: Record<string, BadgeColor> = {
  open: "blue",
  "in-progress": "yellow",
  "needs-review": "orange",
  resolved: "green",
  closed: "gray",
  cancelled: "gray",
};

// ── Filter options ──────────────────────────────────────────────────

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;
const STATUS_OPTIONS = [
  "open",
  "in-progress",
  "needs-review",
  "resolved",
  "closed",
  "cancelled",
] as const;

// ── Resize constants ────────────────────────────────────────────────

const MIN_LIST_WIDTH = 260;
const MAX_LIST_WIDTH = 560;
const DEFAULT_LIST_WIDTH = 340;

// ── FilterCheckbox ──────────────────────────────────────────────────

function FilterCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-1.5 cursor-pointer select-none rounded px-2 py-1 text-sm transition-colors hover:bg-[var(--gray-3)]"
      style={{ color: checked ? "var(--gray-12)" : "var(--gray-10)" }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 cursor-pointer rounded"
        style={{ accentColor: "var(--accent-9)" }}
      />
      {label}
    </label>
  );
}

// ── BugsFilterBar ───────────────────────────────────────────────────

function BugsFilterBar({
  activeSeverities,
  activeStatuses,
  onToggleSeverity,
  onToggleStatus,
}: {
  activeSeverities: Set<string>;
  activeStatuses: Set<string>;
  onToggleSeverity: (s: string) => void;
  onToggleStatus: (s: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-0.5 px-3 py-1.5 flex-wrap">
        {SEVERITY_OPTIONS.map((sev) => (
          <FilterCheckbox
            key={sev}
            id={`bug-sev-${sev}`}
            label={sev}
            checked={activeSeverities.has(sev)}
            onChange={() => onToggleSeverity(sev)}
          />
        ))}

        <Separator
          orientation="vertical"
          style={{ height: "1.25rem", margin: "0 0.25rem" }}
        />

        {STATUS_OPTIONS.map((st) => (
          <FilterCheckbox
            key={st}
            id={`bug-status-${st}`}
            label={st}
            checked={activeStatuses.has(st)}
            onChange={() => onToggleStatus(st)}
          />
        ))}
      </div>
      <Separator size="4" />
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────

function BugsView() {
  const bugs = useProjectStore((s) => s.bugs);
  const selectedEntityId = useUIStore((s) => s.selectedEntityId);
  const selectedEntityType = useUIStore((s) => s.selectedEntityType);
  const selectEntity = useUIStore((s) => s.selectEntity);

  // ── Filter state (empty = show all) ─────────────────────────────
  const [activeSeverities, setActiveSeverities] = useState<Set<string>>(
    new Set(),
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());

  const toggleSeverity = useCallback((sev: string) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }, []);

  const toggleStatus = useCallback((st: string) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st);
      else next.add(st);
      return next;
    });
  }, []);

  // ── Drag resize ─────────────────────────────────────────────────
  const [listWidth, setListWidth] = useState(DEFAULT_LIST_WIDTH);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_LIST_WIDTH);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = listWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [listWidth],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const next = Math.max(
        MIN_LIST_WIDTH,
        Math.min(MAX_LIST_WIDTH, startWidthRef.current + delta),
      );
      setListWidth(next);
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

  // ── Sort + filter bug list ──────────────────────────────────────
  const bugList = useMemo(() => {
    const sorted = [...bugs.values()].sort((a, b) => {
      const sevOrder = ["critical", "high", "medium", "low"];
      const aIdx = sevOrder.indexOf(a.severity ?? "low");
      const bIdx = sevOrder.indexOf(b.severity ?? "low");
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.id.localeCompare(b.id);
    });

    return sorted.filter((bug) => {
      const sevOk =
        activeSeverities.size === 0 ||
        activeSeverities.has(bug.severity ?? "low");
      const statusOk =
        activeStatuses.size === 0 || activeStatuses.has(bug.status ?? "open");
      return sevOk && statusOk;
    });
  }, [bugs, activeSeverities, activeStatuses]);

  const allBugsEmpty = bugs.size === 0;

  if (allBugsEmpty) {
    return (
      <div className="flex-1 overflow-auto">
        <EmptyState
          icon={Bug}
          title="No bugs"
          description="No bugs have been reported for this project."
        />
      </div>
    );
  }

  const activeBugId = selectedEntityType === "bug" ? selectedEntityId : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <BugsFilterBar
        activeSeverities={activeSeverities}
        activeStatuses={activeStatuses}
        onToggleSeverity={toggleSeverity}
        onToggleStatus={toggleStatus}
      />

      {/* Two-column split below filter bar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: bug list */}
        <div
          className="shrink-0 overflow-y-auto border-r border-[var(--gray-5)]"
          style={{ width: listWidth }}
        >
          {bugList.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">
              No bugs match the current filters
            </div>
          ) : (
            <div className="space-y-px p-2">
              {bugList.map((bug) => {
                const isSelected = bug.id === activeBugId;
                const sevColor =
                  SEVERITY_COLOUR[bug.severity ?? "low"] ?? "gray";
                const statusColor =
                  STATUS_COLOUR[bug.status ?? "open"] ?? "gray";

                return (
                  <button
                    key={bug.id}
                    type="button"
                    onClick={() => selectEntity(bug.id, "bug")}
                    className={cn(
                      "w-full text-left rounded-md px-3 py-2.5 transition-colors",
                      "hover:bg-[var(--gray-3)]",
                      isSelected && "bg-[var(--accent-3)]",
                    )}
                  >
                    {/* ID + title row */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-[var(--gray-10)] shrink-0">
                        {bug.id}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          isSelected
                            ? "text-[var(--accent-11)]"
                            : "text-[var(--gray-12)]",
                        )}
                      >
                        {bug.title ?? "(untitled)"}
                      </span>
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {bug.severity && (
                        <Badge color={sevColor} variant="soft" size="1">
                          {bug.severity}
                        </Badge>
                      )}
                      {bug.status && (
                        <Badge color={statusColor} variant="soft" size="1">
                          {bug.status}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Drag handle */}
        <div
          className="shrink-0 w-1 relative cursor-col-resize hover:bg-[var(--accent-6)] transition-colors"
          onMouseDown={handleDividerMouseDown}
        >
          <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <EntityDetail
            entityId={activeBugId}
            entityType={activeBugId ? "bug" : null}
          />
        </div>
      </div>
    </div>
  );
}

export { BugsView };
