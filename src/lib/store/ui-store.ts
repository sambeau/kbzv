import { create } from "zustand";
import { getStatusColour } from "@/lib/constants/status-colours";

/**
 * The two top-level views in the app.
 * - 'documents': Document list and viewer (Feature 4)
 * - 'workflows': Entity tree and detail panel (Feature 3)
 */
type ActiveView = "documents" | "workflows";

/**
 * UI state for the application shell.
 */
interface UIState {
  /** Absolute path to the open Kanbanzai project, or null if none open */
  projectPath: string | null;

  /** Currently active top-level view */
  activeView: ActiveView;

  /** Set the project path. Pass null to close the project. */
  setProjectPath: (path: string | null) => void;

  /** Switch the active top-level view */
  setActiveView: (view: ActiveView) => void;

  // --- Selection state ---
  /** Currently selected entity ID, or null */
  selectedEntityId: string | null;

  /** Currently selected entity type, or null */
  selectedEntityType: string | null;

  /** Select an entity (or clear with null, null) */
  selectEntity: (id: string | null, type: string | null) => void;

  // --- Filter state ---
  /** Entity types currently visible in the tree */
  activeTypes: Set<string>;

  /** Status colour groups currently visible */
  activeStatusColours: Set<string>;

  /** Toggle a single entity type on/off */
  toggleType: (type: string) => void;

  /** Toggle a single status colour group on/off */
  toggleStatusColour: (colour: string) => void;

  /** Reset all filters to their defaults (all types and colours on) */
  clearFilters: () => void;

  /**
   * Activate a solo status colour filter — turns OFF all colour groups
   * except the one matching the given status string.
   */
  activateStatusFilter: (status: string) => void;
}

const DEFAULT_ACTIVE_TYPES = new Set([
  "plan",
  "feature",
  "task",
  "bug",
  "decision",
  "incident",
  "checkpoint",
]);

const DEFAULT_ACTIVE_STATUS_COLOURS = new Set([
  "grey",
  "blue",
  "yellow",
  "orange",
  "green",
  "red",
  "purple",
]);

const useUIStore = create<UIState>((set) => ({
  // --- App shell state ---
  projectPath: null,
  activeView: "workflows",

  setProjectPath: (path) => set({ projectPath: path }),
  setActiveView: (view) => set({ activeView: view }),

  // --- Selection state ---
  selectedEntityId: null,
  selectedEntityType: null,

  selectEntity: (id, type) =>
    set({ selectedEntityId: id, selectedEntityType: type }),

  // --- Filter state ---
  activeTypes: new Set(DEFAULT_ACTIVE_TYPES),
  activeStatusColours: new Set(DEFAULT_ACTIVE_STATUS_COLOURS),

  toggleType: (type) =>
    set((state) => {
      const next = new Set(state.activeTypes);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return { activeTypes: next };
    }),

  toggleStatusColour: (colour) =>
    set((state) => {
      const next = new Set(state.activeStatusColours);
      if (next.has(colour)) {
        next.delete(colour);
      } else {
        next.add(colour);
      }
      return { activeStatusColours: next };
    }),

  clearFilters: () =>
    set({
      activeTypes: new Set(DEFAULT_ACTIVE_TYPES),
      activeStatusColours: new Set(DEFAULT_ACTIVE_STATUS_COLOURS),
    }),

  activateStatusFilter: (status) =>
    set({
      activeStatusColours: new Set([getStatusColour(status)]),
    }),
}));

export { useUIStore };
export type { ActiveView, UIState };
