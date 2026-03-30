import React, { createContext, useCallback, useContext } from "react";
import { useUIStore } from "@/lib/store/ui-store";

// ── Context value interface ─────────────────────────────────────────

interface TreeContextValue {
  expandedNodes: Set<string>;
  selectedEntity: string | null;
  selectedType: string | null;
  toggleExpand: (id: string) => void;
  expandTo: (id: string) => void;
  select: (id: string, type: string) => void;
}

// ── Context creation ────────────────────────────────────────────────

const TreeContext = createContext<TreeContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────

function TreeProvider({ children }: { children: React.ReactNode }) {
  const expandedNodeIds = useUIStore((s) => s.expandedNodeIds);
  const selectedEntityId = useUIStore((s) => s.selectedEntityId);
  const selectedEntityType = useUIStore((s) => s.selectedEntityType);
  const toggleExpandNode = useUIStore((s) => s.toggleExpandNode);
  const selectEntity = useUIStore((s) => s.selectEntity);
  const navigateToEntity = useUIStore((s) => s.navigateToEntity);

  const toggleExpand = useCallback(
    (id: string) => {
      toggleExpandNode(id);
    },
    [toggleExpandNode],
  );

  // expandTo delegates to navigateToEntity which handles ancestor expansion
  // and scroll-to-selected via EntityTree useEffect
  const expandTo = useCallback(
    (id: string) => {
      navigateToEntity(id);
    },
    [navigateToEntity],
  );

  const select = useCallback(
    (id: string, type: string) => {
      selectEntity(id, type);
    },
    [selectEntity],
  );

  return (
    <TreeContext.Provider
      value={{
        expandedNodes: expandedNodeIds,
        selectedEntity: selectedEntityId,
        selectedType: selectedEntityType,
        toggleExpand,
        expandTo,
        select,
      }}
    >
      {children}
    </TreeContext.Provider>
  );
}

// ── Consumer hooks ──────────────────────────────────────────────────

/**
 * Returns the tree context value. Throws if used outside a TreeProvider.
 */
function useTreeContext(): TreeContextValue {
  const ctx = useContext(TreeContext);
  if (!ctx)
    throw new Error("useTreeContext must be used within a TreeProvider");
  return ctx;
}

/**
 * Returns the tree context value, or null if outside a TreeProvider.
 * Use this in components that may render both inside and outside the tree.
 */
function useOptionalTreeContext(): TreeContextValue | null {
  return useContext(TreeContext);
}

export { TreeProvider, useTreeContext, useOptionalTreeContext };
export type { TreeContextValue };
