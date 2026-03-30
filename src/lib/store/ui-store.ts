import { create } from "zustand";

/**
 * The two top-level views in the app.
 * - 'documents': Document list and viewer (Feature 4)
 * - 'workflows': Entity tree and detail panel (Feature 3)
 */
type ActiveView = "documents" | "workflows";

/**
 * UI state for the application shell.
 * Grows in later features with selectedEntityId, navigationHistory, etc.
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
}

const useUIStore = create<UIState>((set) => ({
  // --- State ---
  projectPath: null,
  activeView: "documents",

  // --- Actions ---
  setProjectPath: (path) => set({ projectPath: path }),
  setActiveView: (view) => set({ activeView: view }),
}));

export { useUIStore };
export type { ActiveView, UIState };
