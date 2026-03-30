import { create } from "zustand";
import { getStatusColour } from "@/lib/constants/status-colours";
import { useProjectStore } from "@/lib/store/project-store";

// ─── Types ─────────────────────────────────────────────────────────────

type ActiveView = "documents" | "workflows";
type DocumentViewMode = "list" | "viewer";

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

interface DocumentHistoryEntry {
  mode: DocumentViewMode;
  documentId: string | null;
  scrollTop: number;
  filters: {
    types: string[];
    statuses: string[];
  };
}

// ─── Entity type resolution ─────────────────────────────────────────────

type EntityType =
  | "plan"
  | "feature"
  | "task"
  | "bug"
  | "decision"
  | "knowledge"
  | "incident"
  | "checkpoint"
  | "document";

/**
 * Resolves entity type from an ID string by examining its prefix.
 * Order matters — document check (contains "/") must come before specific
 * prefix checks to avoid false positives on IDs like "FEAT-01ABC/design-spec".
 */
function resolveEntityType(id: string): EntityType | null {
  // Document IDs contain "/" — check first to avoid mis-classifying
  // paths like "work/design/kbzv-architecture.md" as a plan.
  if (id.includes("/")) return "document";
  if (id.startsWith("FEAT-")) return "feature";
  if (id.startsWith("TASK-")) return "task";
  if (id.startsWith("BUG-")) return "bug";
  if (id.startsWith("DEC-")) return "decision";
  if (id.startsWith("KE-")) return "knowledge";
  if (id.startsWith("INC-")) return "incident";
  if (id.startsWith("CHK-")) return "checkpoint";
  // Plan IDs match {Letter}{Digits}- (e.g. "P1-kbzv", "P12-my-plan")
  if (/^[A-Za-z]\d+-/.test(id)) return "plan";
  return null;
}

// ─── UIState interface ──────────────────────────────────────────────────

interface UIState {
  // --- App shell ---
  projectPath: string | null;
  activeView: ActiveView;

  // --- F4: document list filters (legacy, preserved for DocumentFilterBar compat) ---
  documentListFilters: DocumentListFilters;

  // --- F3: workflow entity selection ---
  selectedEntityId: string | null;
  selectedEntityType: string | null;

  // --- F3: workflow tree filters ---
  activeTypes: Set<string>;
  activeStatusColours: Set<string>;

  // --- F5: tree expansion state (migrated from TreeContext local state) ---
  expandedNodeIds: Set<string>;

  // --- F5: document navigation state ---
  documentViewMode: DocumentViewMode;
  viewingDocumentId: string | null;
  documentFilters: { types: string[]; statuses: string[] };

  // --- F5: document history stack (cursor model) ---
  documentHistoryStack: DocumentHistoryEntry[];
  documentHistoryCursor: number; // -1 = no history

  // ── Actions: app shell ───────────────────────────────────────────
  setProjectPath: (path: string | null) => void;
  setActiveView: (view: ActiveView) => void;
  setDocumentListFilters: (filters: DocumentListFilters) => void;

  // ── Actions: workflow selection ──────────────────────────────────
  selectEntity: (id: string | null, type: string | null) => void;

  // ── Actions: workflow filters ────────────────────────────────────
  toggleType: (type: string) => void;
  toggleStatusColour: (colour: string) => void;
  clearFilters: () => void;
  activateStatusFilter: (status: string) => void;

  // ── Actions: tree expansion ──────────────────────────────────────
  toggleExpandNode: (id: string) => void;
  expandNodes: (ids: string[]) => void;

  // ── Actions: document state ──────────────────────────────────────
  setDocumentViewMode: (mode: DocumentViewMode) => void;
  setViewingDocumentId: (id: string | null) => void;
  saveDocumentListScrollTop: (scrollTop: number) => void;
  setDocumentFilters: (filters: {
    types: string[];
    statuses: string[];
  }) => void;

  // ── Actions: F5 cross-view navigation ───────────────────────────
  navigateToEntity: (id: string) => void;
  navigateToDocument: (id: string) => void;
  activateFilter: (
    view: ActiveView,
    field: "type" | "status" | "statusColour",
    value: string,
  ) => void;
  navigateBack: () => void;
  navigateForward: () => void;
}

// ─── Default filter sets ────────────────────────────────────────────────

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

// ─── Store ──────────────────────────────────────────────────────────────

const useUIStore = create<UIState>((set, get) => ({
  // --- App shell ---
  projectPath: null,
  activeView: "workflows",
  documentListFilters: DEFAULT_DOCUMENT_LIST_FILTERS,

  // --- F3 ---
  selectedEntityId: null,
  selectedEntityType: null,
  activeTypes: new Set(DEFAULT_ACTIVE_TYPES),
  activeStatusColours: new Set(DEFAULT_ACTIVE_STATUS_COLOURS),

  // --- F5 ---
  expandedNodeIds: new Set(),
  documentViewMode: "list",
  viewingDocumentId: null,
  documentFilters: { types: [], statuses: [] },
  documentHistoryStack: [],
  documentHistoryCursor: -1,

  // ── App shell actions ─────────────────────────────────────────────

  setProjectPath: (path) => set({ projectPath: path }),
  setActiveView: (view) => set({ activeView: view }),
  setDocumentListFilters: (filters) => set({ documentListFilters: filters }),

  // ── Workflow selection actions ────────────────────────────────────

  selectEntity: (id, type) =>
    set({ selectedEntityId: id, selectedEntityType: type }),

  // ── Workflow filter actions ───────────────────────────────────────

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

  // ── Tree expansion actions ────────────────────────────────────────

  toggleExpandNode: (id: string) =>
    set((state) => {
      const next = new Set(state.expandedNodeIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { expandedNodeIds: next };
    }),

  expandNodes: (ids: string[]) =>
    set((state) => ({
      expandedNodeIds: new Set([...state.expandedNodeIds, ...ids]),
    })),

  // ── Document state actions ────────────────────────────────────────

  setDocumentViewMode: (mode) => set({ documentViewMode: mode }),
  setViewingDocumentId: (id) => set({ viewingDocumentId: id }),

  saveDocumentListScrollTop: (scrollTop) =>
    set((state) => ({
      documentListFilters: { ...state.documentListFilters, scrollTop },
    })),

  setDocumentFilters: (filters) => set({ documentFilters: filters }),

  // ── F5: navigateToEntity ──────────────────────────────────────────

  navigateToEntity: (id: string) => {
    const state = get();
    const type = resolveEntityType(id);
    if (!type) return;

    // Document entities delegate to navigateToDocument
    if (type === "document") {
      get().navigateToDocument(id);
      return;
    }

    const projectState = useProjectStore.getState();

    const storeMap: Record<string, Map<string, unknown>> = {
      plan: projectState.plans,
      feature: projectState.features,
      task: projectState.tasks,
      bug: projectState.bugs,
      decision: projectState.decisions,
      knowledge: projectState.knowledge,
      incident: projectState.incidents,
      checkpoint: projectState.checkpoints,
    };

    const entityMap = storeMap[type];
    if (!entityMap || !entityMap.has(id)) return; // broken ref → no-op

    // Compute ancestor chain for tree expansion
    const expansionIds: string[] = [];

    if (type === "task") {
      const task = projectState.tasks.get(id);
      if (task?.parent_feature) {
        expansionIds.push(task.parent_feature);
        const feature = projectState.features.get(task.parent_feature);
        if (feature?.parent) {
          expansionIds.push(feature.parent);
        }
      }
    } else if (type === "feature") {
      const feature = projectState.features.get(id);
      if (feature?.parent) {
        expansionIds.push(feature.parent);
      }
    } else if (type === "bug") {
      expansionIds.push("__bugs__");
    } else if (type === "decision") {
      expansionIds.push("__decisions__");
    } else if (type === "incident") {
      expansionIds.push("__incidents__");
    } else if (type === "checkpoint") {
      expansionIds.push("__checkpoints__");
    } else if (type === "knowledge") {
      expansionIds.push("__knowledge__");
    }
    // type === "plan" → top-level, no ancestors to expand

    set({
      selectedEntityId: id,
      selectedEntityType: type,
      activeView: "workflows",
      expandedNodeIds: new Set([...state.expandedNodeIds, ...expansionIds]),
    });
  },

  // ── F5: navigateToDocument ────────────────────────────────────────

  navigateToDocument: (id: string) => {
    const state = get();

    const projectState = useProjectStore.getState();

    if (!projectState.documents.has(id)) return; // broken ref → no-op

    if (state.activeView === "documents") {
      // Push current state onto history before navigating
      const currentEntry: DocumentHistoryEntry = {
        mode: state.documentViewMode,
        documentId: state.viewingDocumentId,
        scrollTop: state.documentListFilters.scrollTop,
        filters: {
          types: [...state.documentFilters.types],
          statuses: [...state.documentFilters.statuses],
        },
      };

      // Truncate any forward history beyond current cursor, append current state
      const truncated = state.documentHistoryStack.slice(
        0,
        state.documentHistoryCursor + 1,
      );
      truncated.push(currentEntry);

      const MAX_HISTORY = 50;
      const overflow = truncated.length > MAX_HISTORY ? 1 : 0;
      const finalStack = overflow ? truncated.slice(1) : truncated;

      // Append destination entry
      const destinationEntry: DocumentHistoryEntry = {
        mode: "viewer",
        documentId: id,
        scrollTop: 0,
        filters: {
          types: [...state.documentFilters.types],
          statuses: [...state.documentFilters.statuses],
        },
      };
      finalStack.push(destinationEntry);

      set({
        documentHistoryStack: finalStack,
        documentHistoryCursor: finalStack.length - 1,
        viewingDocumentId: id,
        documentViewMode: "viewer",
      });
    } else {
      // Coming from Workflows view — switch views without pushing history
      // (no prior Documents state worth preserving)
      set({
        activeView: "documents",
        viewingDocumentId: id,
        documentViewMode: "viewer",
      });
    }
  },

  // ── F5: activateFilter ────────────────────────────────────────────

  activateFilter: (view, field, value) => {
    const state = get();

    if (view === "documents") {
      const switchToList =
        state.activeView !== "documents"
          ? { documentViewMode: "list" as const }
          : {};

      if (field === "type") {
        const types = [...state.documentFilters.types];
        const idx = types.indexOf(value);
        if (idx >= 0) types.splice(idx, 1);
        else types.push(value);
        set({
          activeView: "documents",
          documentFilters: { ...state.documentFilters, types },
          ...switchToList,
        });
      } else if (field === "status") {
        const statuses = [...state.documentFilters.statuses];
        const idx = statuses.indexOf(value);
        if (idx >= 0) statuses.splice(idx, 1);
        else statuses.push(value);
        set({
          activeView: "documents",
          documentFilters: { ...state.documentFilters, statuses },
          ...switchToList,
        });
      }
    } else {
      // workflows
      if (field === "type") {
        set((s) => {
          const newTypes = new Set(s.activeTypes);
          if (newTypes.has(value)) newTypes.delete(value);
          else newTypes.add(value);
          return { activeView: "workflows", activeTypes: newTypes };
        });
      } else if (field === "statusColour") {
        set((s) => {
          const newColours = new Set(s.activeStatusColours);
          if (newColours.has(value)) newColours.delete(value);
          else newColours.add(value);
          return { activeView: "workflows", activeStatusColours: newColours };
        });
      } else if (field === "status") {
        set({ activeView: "workflows" });
        get().activateStatusFilter(value);
      }
    }
  },

  // ── F5: navigateBack ──────────────────────────────────────────────

  navigateBack: () => {
    const state = get();
    if (state.activeView !== "documents") return;

    // At the start of history or no history at all
    if (
      state.documentHistoryCursor <= 0 ||
      state.documentHistoryStack.length === 0
    ) {
      // If currently in viewer mode with no back history, return to list
      if (state.documentViewMode === "viewer") {
        set({ documentViewMode: "list", viewingDocumentId: null });
      }
      return;
    }

    const newCursor = state.documentHistoryCursor - 1;
    const entry = state.documentHistoryStack[newCursor];

    set({
      documentHistoryCursor: newCursor,
      documentViewMode: entry.mode,
      viewingDocumentId: entry.documentId,
      documentFilters: {
        types: [...entry.filters.types],
        statuses: [...entry.filters.statuses],
      },
    });
  },

  // ── F5: navigateForward ───────────────────────────────────────────

  navigateForward: () => {
    const state = get();
    if (state.activeView !== "documents") return;
    if (state.documentHistoryCursor >= state.documentHistoryStack.length - 1)
      return;

    const newCursor = state.documentHistoryCursor + 1;
    const entry = state.documentHistoryStack[newCursor];

    set({
      documentHistoryCursor: newCursor,
      documentViewMode: entry.mode,
      viewingDocumentId: entry.documentId,
      documentFilters: {
        types: [...entry.filters.types],
        statuses: [...entry.filters.statuses],
      },
    });
  },
}));

export { useUIStore, resolveEntityType };
export type {
  ActiveView,
  UIState,
  DocumentListFilters,
  SortOption,
  DocumentHistoryEntry,
  EntityType,
  DocumentViewMode,
};
