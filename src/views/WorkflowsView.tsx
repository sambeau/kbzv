// src/views/WorkflowsView.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { useUIStore } from "@/lib/store/ui-store";
import { TreeProvider } from "@/components/tree/TreeContext";
import { FilterBar } from "@/components/filter/FilterBar";
import { EntityTree } from "@/components/tree/EntityTree";
import { EntityDetail } from "@/components/entity/EntityDetail";

const MIN_TREE_WIDTH = 180;
const MAX_TREE_WIDTH = 520;
const DEFAULT_TREE_WIDTH = 280;

function WorkflowsView() {
  const selectedEntityId = useUIStore((s) => s.selectedEntityId);
  const selectedEntityType = useUIStore((s) => s.selectedEntityType);

  const [treeWidth, setTreeWidth] = useState(DEFAULT_TREE_WIDTH);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_TREE_WIDTH);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = treeWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [treeWidth],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const next = Math.max(
        MIN_TREE_WIDTH,
        Math.min(MAX_TREE_WIDTH, startWidthRef.current + delta),
      );
      setTreeWidth(next);
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

  return (
    <TreeProvider>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Filter bar — fixed, spans full width */}
        <FilterBar />

        {/* Two-column split below filter bar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left column — Entity Tree */}
          <div
            className="shrink-0 overflow-y-auto border-r border-[var(--gray-5)]"
            style={{ width: treeWidth }}
          >
            <EntityTree />
          </div>

          {/* Drag handle */}
          <div
            className="shrink-0 w-1 relative cursor-col-resize hover:bg-[var(--accent-6)] transition-colors"
            onMouseDown={handleDividerMouseDown}
          >
            <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
          </div>

          {/* Right column — Entity Detail */}
          <div className="flex-1 overflow-y-auto p-6">
            <EntityDetail
              entityId={selectedEntityId}
              entityType={selectedEntityType}
            />
          </div>
        </div>
      </div>
    </TreeProvider>
  );
}

export { WorkflowsView };
