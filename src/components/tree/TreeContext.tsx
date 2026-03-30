import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useProjectStore } from '@/lib/store/project-store';
import { useUIStore } from '@/lib/store/ui-store';
import { resolveEntityType } from '@/lib/query/references';

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
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const { selectEntity, selectedEntityId, selectedEntityType } = useUIStore(
    (s) => ({
      selectEntity: s.selectEntity,
      selectedEntityId: s.selectedEntityId,
      selectedEntityType: s.selectedEntityType,
    }),
  );

  const tree = useProjectStore((s) => s.tree);
  const features = useProjectStore((s) => s.features);
  const tasks = useProjectStore((s) => s.tasks);

  // On initial mount (or when tree changes), expand the first plan node
  useEffect(() => {
    if (tree.length > 0) {
      setExpandedNodes(new Set([tree[0].id]));
    }
  }, [tree]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandTo = useCallback(
    (id: string) => {
      const type = resolveEntityType(id);
      const ancestors: string[] = [];

      if (type === 'task') {
        const task = tasks.get(id);
        if (task) {
          ancestors.push(task.parent_feature);
          const feature = features.get(task.parent_feature);
          if (feature) {
            ancestors.push(feature.parent);
          }
        }
      } else if (type === 'feature') {
        const feature = features.get(id);
        if (feature) {
          ancestors.push(feature.parent);
        }
      }

      if (ancestors.length > 0) {
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          for (const ancestor of ancestors) {
            next.add(ancestor);
          }
          return next;
        });
      }

      // Scroll the target into view after state update
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-entity-id="${id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    },
    [features, tasks],
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
        expandedNodes,
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
  if (!ctx) throw new Error('useTreeContext must be used within a TreeProvider');
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
