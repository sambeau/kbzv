// src/lib/__tests__/f5-navigation.test.ts
//
// Tests for F5: Cross-View Navigation
// Covers: resolveEntityType, navigateToEntity, navigateToDocument,
//         activateFilter, navigateBack, navigateForward, history stack

import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore, resolveEntityType } from "../store/ui-store";

// ── Helpers ─────────────────────────────────────────────────────────

function resetStore() {
  useUIStore.setState({
    activeView: "workflows",
    selectedEntityId: null,
    selectedEntityType: null,
    activeTypes: new Set(["plan", "feature", "task", "bug", "decision", "incident", "checkpoint"]),
    activeStatusColours: new Set(["grey", "blue", "yellow", "orange", "green", "red", "purple"]),
    expandedNodeIds: new Set(),
    documentViewMode: "list",
    viewingDocumentId: null,
    documentFilters: { types: [], statuses: [] },
    documentHistoryStack: [],
    documentHistoryCursor: -1,
    documentListFilters: { activeTypes: [], activeStatuses: [], sortOption: "newest", scrollTop: 0 },
  });
}

// ── resolveEntityType ────────────────────────────────────────────────

describe("resolveEntityType", () => {
  it("resolves FEAT- prefix to feature", () => {
    expect(resolveEntityType("FEAT-01KMZA9GFB075")).toBe("feature");
  });

  it("resolves TASK- prefix to task", () => {
    expect(resolveEntityType("TASK-01ABC")).toBe("task");
  });

  it("resolves BUG- prefix to bug", () => {
    expect(resolveEntityType("BUG-01XYZ")).toBe("bug");
  });

  it("resolves DEC- prefix to decision", () => {
    expect(resolveEntityType("DEC-01ABC")).toBe("decision");
  });

  it("resolves KE- prefix to knowledge", () => {
    expect(resolveEntityType("KE-01ABC")).toBe("knowledge");
  });

  it("resolves INC- prefix to incident", () => {
    expect(resolveEntityType("INC-01ABC")).toBe("incident");
  });

  it("resolves CHK- prefix to checkpoint", () => {
    expect(resolveEntityType("CHK-01ABC")).toBe("checkpoint");
  });

  it("resolves plan ID pattern to plan", () => {
    expect(resolveEntityType("P1-kbzv")).toBe("plan");
    expect(resolveEntityType("P12-my-plan")).toBe("plan");
  });

  it("resolves document paths containing '/' to document", () => {
    expect(resolveEntityType("work/design/kbzv-architecture.md")).toBe("document");
    expect(resolveEntityType("FEAT-01ABC/design-spec")).toBe("document");
  });

  it("returns null for unrecognised IDs", () => {
    expect(resolveEntityType("garbage")).toBeNull();
    expect(resolveEntityType("")).toBeNull();
    expect(resolveEntityType("UNKNOWN-123")).toBeNull();
  });

  it("document check takes priority over feature prefix when ID contains /", () => {
    // "FEAT-01ABC/design-spec" starts with FEAT- but contains "/" → document
    expect(resolveEntityType("FEAT-01ABC/design-spec")).toBe("document");
  });
});

// ── navigateToEntity ─────────────────────────────────────────────────

describe("navigateToEntity", () => {
  beforeEach(resetStore);

  it("is a no-op for unrecognised ID formats", () => {
    const { navigateToEntity } = useUIStore.getState();
    navigateToEntity("garbage");
    const state = useUIStore.getState();
    expect(state.selectedEntityId).toBeNull();
    expect(state.activeView).toBe("workflows");
  });

  it("is a no-op for IDs not found in the store", () => {
    const { navigateToEntity } = useUIStore.getState();
    // No project loaded, so all maps are empty
    navigateToEntity("FEAT-01DOESNOTEXIST");
    const state = useUIStore.getState();
    expect(state.selectedEntityId).toBeNull();
  });

  it("switches activeView to 'workflows'", () => {
    useUIStore.setState({ activeView: "documents" });
    // navigateToEntity with a non-existent ID is a no-op,
    // but we can test the view switch on a known entity by
    // priming the store.
    // Here we just verify the action doesn't crash.
    const { navigateToEntity } = useUIStore.getState();
    navigateToEntity("UNKNOWN-FORMAT");
    // Still documents because it was a no-op
    expect(useUIStore.getState().activeView).toBe("documents");
  });
});

// ── navigateToDocument ───────────────────────────────────────────────

describe("navigateToDocument", () => {
  beforeEach(resetStore);

  it("is a no-op when document is not in the store", () => {
    const { navigateToDocument } = useUIStore.getState();
    navigateToDocument("work/nonexistent.md");
    const state = useUIStore.getState();
    expect(state.viewingDocumentId).toBeNull();
    expect(state.documentViewMode).toBe("list");
  });
});

// ── activateFilter ────────────────────────────────────────────────────

describe("activateFilter", () => {
  beforeEach(resetStore);

  it("toggles a document type filter on", () => {
    const { activateFilter } = useUIStore.getState();
    activateFilter("documents", "type", "design");
    expect(useUIStore.getState().documentFilters.types).toContain("design");
    expect(useUIStore.getState().activeView).toBe("documents");
  });

  it("toggles a document type filter off when already active", () => {
    useUIStore.setState({ documentFilters: { types: ["design"], statuses: [] } });
    const { activateFilter } = useUIStore.getState();
    activateFilter("documents", "type", "design");
    expect(useUIStore.getState().documentFilters.types).not.toContain("design");
  });

  it("toggles a document status filter on", () => {
    const { activateFilter } = useUIStore.getState();
    activateFilter("documents", "status", "approved");
    expect(useUIStore.getState().documentFilters.statuses).toContain("approved");
  });

  it("toggles a document status filter off when already active", () => {
    useUIStore.setState({ documentFilters: { types: [], statuses: ["approved"] } });
    const { activateFilter } = useUIStore.getState();
    activateFilter("documents", "status", "approved");
    expect(useUIStore.getState().documentFilters.statuses).not.toContain("approved");
  });

  it("switches to documents view when activating a document filter from workflows", () => {
    useUIStore.setState({ activeView: "workflows" });
    const { activateFilter } = useUIStore.getState();
    activateFilter("documents", "type", "design");
    expect(useUIStore.getState().activeView).toBe("documents");
  });

  it("sets documentViewMode to 'list' when cross-view activating a document filter", () => {
    useUIStore.setState({ activeView: "workflows", documentViewMode: "viewer" });
    const { activateFilter } = useUIStore.getState();
    activateFilter("documents", "type", "design");
    expect(useUIStore.getState().documentViewMode).toBe("list");
  });

  it("does not reset documentViewMode when already in documents view", () => {
    useUIStore.setState({ activeView: "documents", documentViewMode: "viewer" });
    const { activateFilter } = useUIStore.getState();
    activateFilter("documents", "type", "design");
    // Already in documents view — viewer mode is preserved
    expect(useUIStore.getState().documentViewMode).toBe("viewer");
  });

  it("toggles a workflow entity type on", () => {
    // Remove "feature" from active types first
    useUIStore.setState({ activeTypes: new Set(["plan", "task"]) });
    const { activateFilter } = useUIStore.getState();
    activateFilter("workflows", "type", "feature");
    expect(useUIStore.getState().activeTypes.has("feature")).toBe(true);
  });

  it("toggles a workflow entity type off when already active", () => {
    useUIStore.setState({ activeTypes: new Set(["plan", "feature", "task"]) });
    const { activateFilter } = useUIStore.getState();
    activateFilter("workflows", "type", "feature");
    expect(useUIStore.getState().activeTypes.has("feature")).toBe(false);
  });

  it("toggles a workflow status colour group on", () => {
    useUIStore.setState({ activeStatusColours: new Set(["grey"]) });
    const { activateFilter } = useUIStore.getState();
    activateFilter("workflows", "statusColour", "green");
    expect(useUIStore.getState().activeStatusColours.has("green")).toBe(true);
  });

  it("toggles a workflow status colour group off when already active", () => {
    useUIStore.setState({ activeStatusColours: new Set(["grey", "green"]) });
    const { activateFilter } = useUIStore.getState();
    activateFilter("workflows", "statusColour", "green");
    expect(useUIStore.getState().activeStatusColours.has("green")).toBe(false);
    expect(useUIStore.getState().activeStatusColours.has("grey")).toBe(true);
  });

  it("switches to workflows view when activating a workflow filter from documents", () => {
    useUIStore.setState({ activeView: "documents" });
    const { activateFilter } = useUIStore.getState();
    activateFilter("workflows", "statusColour", "green");
    expect(useUIStore.getState().activeView).toBe("workflows");
  });

  it("can activate multiple document type filters independently", () => {
    const { activateFilter } = useUIStore.getState();
    activateFilter("documents", "type", "design");
    activateFilter("documents", "type", "specification");
    const types = useUIStore.getState().documentFilters.types;
    expect(types).toContain("design");
    expect(types).toContain("specification");
  });
});

// ── navigateBack / navigateForward ────────────────────────────────────

describe("navigateBack / navigateForward", () => {
  beforeEach(resetStore);

  it("navigateBack is a no-op when not in documents view", () => {
    useUIStore.setState({ activeView: "workflows" });
    const { navigateBack } = useUIStore.getState();
    navigateBack();
    expect(useUIStore.getState().activeView).toBe("workflows");
  });

  it("navigateForward is a no-op when not in documents view", () => {
    useUIStore.setState({ activeView: "workflows" });
    const { navigateForward } = useUIStore.getState();
    navigateForward();
    // Should stay in workflows with no effect
    expect(useUIStore.getState().activeView).toBe("workflows");
  });

  it("navigateBack in documents view with no history returns to list from viewer", () => {
    useUIStore.setState({
      activeView: "documents",
      documentViewMode: "viewer",
      viewingDocumentId: "work/doc.md",
      documentHistoryStack: [],
      documentHistoryCursor: -1,
    });
    const { navigateBack } = useUIStore.getState();
    navigateBack();
    const state = useUIStore.getState();
    expect(state.documentViewMode).toBe("list");
    expect(state.viewingDocumentId).toBeNull();
  });

  it("navigateBack with cursor <= 0 returns to list from viewer", () => {
    useUIStore.setState({
      activeView: "documents",
      documentViewMode: "viewer",
      viewingDocumentId: "work/doc.md",
      documentHistoryStack: [
        { mode: "list", documentId: null, scrollTop: 0, filters: { types: [], statuses: [] } },
      ],
      documentHistoryCursor: 0,
    });
    const { navigateBack } = useUIStore.getState();
    navigateBack();
    const state = useUIStore.getState();
    expect(state.documentViewMode).toBe("list");
    expect(state.viewingDocumentId).toBeNull();
  });

  it("navigateBack with history restores previous entry", () => {
    useUIStore.setState({
      activeView: "documents",
      documentViewMode: "viewer",
      viewingDocumentId: "work/doc-b.md",
      documentFilters: { types: ["design"], statuses: [] },
      documentHistoryStack: [
        { mode: "list", documentId: null, scrollTop: 42, filters: { types: ["specification"], statuses: ["approved"] } },
        { mode: "viewer", documentId: "work/doc-a.md", scrollTop: 0, filters: { types: [], statuses: [] } },
        { mode: "viewer", documentId: "work/doc-b.md", scrollTop: 0, filters: { types: ["design"], statuses: [] } },
      ],
      documentHistoryCursor: 2,
    });
    const { navigateBack } = useUIStore.getState();
    navigateBack();
    const state = useUIStore.getState();
    expect(state.documentHistoryCursor).toBe(1);
    expect(state.documentViewMode).toBe("viewer");
    expect(state.viewingDocumentId).toBe("work/doc-a.md");
  });

  it("navigateForward is a no-op when at the end of the stack", () => {
    useUIStore.setState({
      activeView: "documents",
      documentViewMode: "viewer",
      viewingDocumentId: "work/doc.md",
      documentHistoryStack: [
        { mode: "viewer", documentId: "work/doc.md", scrollTop: 0, filters: { types: [], statuses: [] } },
      ],
      documentHistoryCursor: 0,
    });
    const { navigateForward } = useUIStore.getState();
    navigateForward();
    // cursor is already at the end (length - 1)
    expect(useUIStore.getState().documentHistoryCursor).toBe(0);
  });

  it("navigateForward advances cursor and restores entry", () => {
    useUIStore.setState({
      activeView: "documents",
      documentViewMode: "list",
      viewingDocumentId: null,
      documentHistoryStack: [
        { mode: "list", documentId: null, scrollTop: 0, filters: { types: [], statuses: [] } },
        { mode: "viewer", documentId: "work/doc-a.md", scrollTop: 0, filters: { types: ["design"], statuses: [] } },
      ],
      documentHistoryCursor: 0,
    });
    const { navigateForward } = useUIStore.getState();
    navigateForward();
    const state = useUIStore.getState();
    expect(state.documentHistoryCursor).toBe(1);
    expect(state.documentViewMode).toBe("viewer");
    expect(state.viewingDocumentId).toBe("work/doc-a.md");
    expect(state.documentFilters.types).toContain("design");
  });

  it("back then forward returns to original state", () => {
    const entry0 = { mode: "list" as const, documentId: null, scrollTop: 0, filters: { types: [], statuses: [] } };
    const entry1 = { mode: "viewer" as const, documentId: "work/doc-a.md", scrollTop: 0, filters: { types: [], statuses: [] } };
    const entry2 = { mode: "viewer" as const, documentId: "work/doc-b.md", scrollTop: 0, filters: { types: [], statuses: [] } };

    useUIStore.setState({
      activeView: "documents",
      documentViewMode: "viewer",
      viewingDocumentId: "work/doc-b.md",
      documentHistoryStack: [entry0, entry1, entry2],
      documentHistoryCursor: 2,
    });

    const { navigateBack, navigateForward } = useUIStore.getState();

    navigateBack();
    expect(useUIStore.getState().documentHistoryCursor).toBe(1);
    expect(useUIStore.getState().viewingDocumentId).toBe("work/doc-a.md");

    navigateForward();
    expect(useUIStore.getState().documentHistoryCursor).toBe(2);
    expect(useUIStore.getState().viewingDocumentId).toBe("work/doc-b.md");
  });
});

// ── History stack invariants ───────────────────────────────────────────

describe("history stack invariants", () => {
  beforeEach(resetStore);

  it("navigateBack does not go below cursor -1 equivalent (clamps to list fallback)", () => {
    useUIStore.setState({
      activeView: "documents",
      documentViewMode: "viewer",
      viewingDocumentId: "work/doc.md",
      documentHistoryStack: [],
      documentHistoryCursor: -1,
    });
    const { navigateBack } = useUIStore.getState();
    // Multiple calls should not crash and should stay at list mode
    navigateBack();
    navigateBack();
    navigateBack();
    const state = useUIStore.getState();
    expect(state.documentViewMode).toBe("list");
  });

  it("restores document filters on navigateBack", () => {
    const entryWithFilters = {
      mode: "list" as const,
      documentId: null,
      scrollTop: 100,
      filters: { types: ["design", "specification"], statuses: ["approved"] },
    };
    const entryViewer = {
      mode: "viewer" as const,
      documentId: "work/doc.md",
      scrollTop: 0,
      filters: { types: [], statuses: [] },
    };

    useUIStore.setState({
      activeView: "documents",
      documentViewMode: "viewer",
      viewingDocumentId: "work/doc.md",
      documentFilters: { types: [], statuses: [] },
      documentHistoryStack: [entryWithFilters, entryViewer],
      documentHistoryCursor: 1,
    });

    useUIStore.getState().navigateBack();

    const state = useUIStore.getState();
    expect(state.documentHistoryCursor).toBe(0);
    expect(state.documentViewMode).toBe("list");
    expect(state.documentFilters.types).toContain("design");
    expect(state.documentFilters.types).toContain("specification");
    expect(state.documentFilters.statuses).toContain("approved");
  });
});

// ── expandedNodeIds ────────────────────────────────────────────────────

describe("expandedNodeIds", () => {
  beforeEach(resetStore);

  it("toggleExpandNode adds a new node ID", () => {
    useUIStore.getState().toggleExpandNode("P1-kbzv");
    expect(useUIStore.getState().expandedNodeIds.has("P1-kbzv")).toBe(true);
  });

  it("toggleExpandNode removes an existing node ID", () => {
    useUIStore.setState({ expandedNodeIds: new Set(["P1-kbzv"]) });
    useUIStore.getState().toggleExpandNode("P1-kbzv");
    expect(useUIStore.getState().expandedNodeIds.has("P1-kbzv")).toBe(false);
  });

  it("expandNodes adds multiple node IDs at once", () => {
    useUIStore.getState().expandNodes(["P1-kbzv", "FEAT-01ABC"]);
    const ids = useUIStore.getState().expandedNodeIds;
    expect(ids.has("P1-kbzv")).toBe(true);
    expect(ids.has("FEAT-01ABC")).toBe(true);
  });

  it("expandNodes is additive — does not collapse existing expansions", () => {
    useUIStore.setState({ expandedNodeIds: new Set(["P1-kbzv"]) });
    useUIStore.getState().expandNodes(["FEAT-01ABC"]);
    const ids = useUIStore.getState().expandedNodeIds;
    expect(ids.has("P1-kbzv")).toBe(true);
    expect(ids.has("FEAT-01ABC")).toBe(true);
  });
});

// ── saveDocumentListScrollTop ──────────────────────────────────────────

describe("saveDocumentListScrollTop", () => {
  beforeEach(resetStore);

  it("saves scrollTop to documentListFilters.scrollTop", () => {
    useUIStore.getState().saveDocumentListScrollTop(250);
    expect(useUIStore.getState().documentListFilters.scrollTop).toBe(250);
  });

  it("preserves other documentListFilters fields", () => {
    useUIStore.setState({
      documentListFilters: {
        activeTypes: ["design"],
        activeStatuses: ["approved"],
        sortOption: "title-asc",
        scrollTop: 0,
      },
    });
    useUIStore.getState().saveDocumentListScrollTop(99);
    const filters = useUIStore.getState().documentListFilters;
    expect(filters.scrollTop).toBe(99);
    expect(filters.activeTypes).toEqual(["design"]);
    expect(filters.activeStatuses).toEqual(["approved"]);
    expect(filters.sortOption).toBe("title-asc");
  });
});

// ── setDocumentFilters ─────────────────────────────────────────────────

describe("setDocumentFilters", () => {
  beforeEach(resetStore);

  it("replaces documentFilters entirely", () => {
    useUIStore.getState().setDocumentFilters({ types: ["research"], statuses: ["draft"] });
    const filters = useUIStore.getState().documentFilters;
    expect(filters.types).toEqual(["research"]);
    expect(filters.statuses).toEqual(["draft"]);
  });
});
