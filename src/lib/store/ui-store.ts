import { create } from "zustand";

/**
 * The two top-level views in the app.
 * - 'documents': Document list and viewer (Feature 4)
 * - 'workflows': Entity tree and detail panel (Feature 3)
 */
type ActiveView = "documents" | "workflows";

type SortOption =
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "type"
  | "status";

interface DocumentListFilters {
  activeTypes: string[];
  activeStatuses: string[];
  sortOption: SortOption;
  scrollTop: number;
}

const DEFAULT_DOCUMENT_LIST_FILTERS: DocumentListFilters = {
  activeTypes: [],
  activeStatuses: [],
  sortOption: "newest",
  scrollTop: 0,
};

/**
 * UI state for the application shell.
 * Grows in later features with selectedEntityId, navigationHistory, etc.
 */
interface UIState {
  /** Absolute path to the open Kanbanzai project, or null if none open */
  projectPath: string | null;

  /** Currently active top-level view */
  activeView: ActiveView;

  /** Persisted document list filter/sort/scroll state for back-navigation preservation */
  documentListFilters: DocumentListFilters;

  /** Set the project path. Pass null to close the project. */
  setProjectPath: (path: string | null) => void;

  /** Switch the active top-level view */
  setActiveView: (view: ActiveView) => void;

  /** Persist document list filter/sort/scroll state */
  setDocumentListFilters: (filters: DocumentListFilters) => void;
}

const useUIStore = create<UIState>((set) => ({
  // --- State ---
  projectPath: null,
  activeView: "documents",
  documentListFilters: DEFAULT_DOCUMENT_LIST_FILTERS,

  // --- Actions ---
  setProjectPath: (path) => set({ projectPath: path }),
  setActiveView: (view) => set({ activeView: view }),
  setDocumentListFilters: (filters) => set({ documentListFilters: filters }),
}));

export { useUIStore };
export type { ActiveView, UIState, DocumentListFilters, SortOption };
