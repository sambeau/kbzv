// src/lib/__tests__/type-colours.test.ts

import { describe, it, expect } from "vitest";
import {
  getTypeColour,
  DOC_TYPE_COLOURS,
  type TypeColour,
} from "../constants/type-colours";

// ── DOC_TYPE_COLOURS ─────────────────────────────────────────────────

describe("DOC_TYPE_COLOURS", () => {
  const KNOWN_TYPES = [
    "design",
    "specification",
    "dev-plan",
    "research",
    "report",
    "policy",
    "rca",
  ] as const;

  it("contains all 7 known document types", () => {
    for (const type of KNOWN_TYPES) {
      expect(DOC_TYPE_COLOURS).toHaveProperty(type);
    }
  });

  it("every entry has a bg and text field", () => {
    for (const [_type, colour] of Object.entries(DOC_TYPE_COLOURS)) {
      expect(colour).toHaveProperty("bg", expect.any(String));
      expect(colour).toHaveProperty("text", expect.any(String));
      expect(colour.bg.length).toBeGreaterThan(0);
      expect(colour.text.length).toBeGreaterThan(0);
    }
  });

  it("bg fields start with 'bg-'", () => {
    for (const [_type, colour] of Object.entries(DOC_TYPE_COLOURS)) {
      expect(colour.bg).toMatch(/^bg-/);
    }
  });

  it("text fields start with 'text-'", () => {
    for (const [_type, colour] of Object.entries(DOC_TYPE_COLOURS)) {
      expect(colour.text).toMatch(/^text-/);
    }
  });

  it("design uses blue palette", () => {
    expect(DOC_TYPE_COLOURS["design"].bg).toContain("blue");
    expect(DOC_TYPE_COLOURS["design"].text).toContain("blue");
  });

  it("specification uses teal palette", () => {
    expect(DOC_TYPE_COLOURS["specification"].bg).toContain("teal");
    expect(DOC_TYPE_COLOURS["specification"].text).toContain("teal");
  });

  it("dev-plan uses indigo palette", () => {
    expect(DOC_TYPE_COLOURS["dev-plan"].bg).toContain("indigo");
    expect(DOC_TYPE_COLOURS["dev-plan"].text).toContain("indigo");
  });

  it("research uses amber palette", () => {
    expect(DOC_TYPE_COLOURS["research"].bg).toContain("amber");
    expect(DOC_TYPE_COLOURS["research"].text).toContain("amber");
  });

  it("report uses slate palette", () => {
    expect(DOC_TYPE_COLOURS["report"].bg).toContain("slate");
    expect(DOC_TYPE_COLOURS["report"].text).toContain("slate");
  });

  it("policy uses rose palette", () => {
    expect(DOC_TYPE_COLOURS["policy"].bg).toContain("rose");
    expect(DOC_TYPE_COLOURS["policy"].text).toContain("rose");
  });

  it("rca uses orange palette", () => {
    expect(DOC_TYPE_COLOURS["rca"].bg).toContain("orange");
    expect(DOC_TYPE_COLOURS["rca"].text).toContain("orange");
  });

  it("all bg colours are distinct from each other", () => {
    const bgs = Object.values(DOC_TYPE_COLOURS).map((c) => c.bg);
    const unique = new Set(bgs);
    expect(unique.size).toBe(bgs.length);
  });

  it("all text colours are distinct from each other", () => {
    const texts = Object.values(DOC_TYPE_COLOURS).map((c) => c.text);
    const unique = new Set(texts);
    expect(unique.size).toBe(texts.length);
  });
});

// ── getTypeColour ────────────────────────────────────────────────────

describe("getTypeColour", () => {
  // ── Known types ──────────────────────────────────────────────────

  it("returns correct colour for 'design'", () => {
    const colour = getTypeColour("design");
    expect(colour).toStrictEqual(DOC_TYPE_COLOURS["design"]);
  });

  it("returns correct colour for 'specification'", () => {
    const colour = getTypeColour("specification");
    expect(colour).toStrictEqual(DOC_TYPE_COLOURS["specification"]);
  });

  it("returns correct colour for 'dev-plan'", () => {
    const colour = getTypeColour("dev-plan");
    expect(colour).toStrictEqual(DOC_TYPE_COLOURS["dev-plan"]);
  });

  it("returns correct colour for 'research'", () => {
    const colour = getTypeColour("research");
    expect(colour).toStrictEqual(DOC_TYPE_COLOURS["research"]);
  });

  it("returns correct colour for 'report'", () => {
    const colour = getTypeColour("report");
    expect(colour).toStrictEqual(DOC_TYPE_COLOURS["report"]);
  });

  it("returns correct colour for 'policy'", () => {
    const colour = getTypeColour("policy");
    expect(colour).toStrictEqual(DOC_TYPE_COLOURS["policy"]);
  });

  it("returns correct colour for 'rca'", () => {
    const colour = getTypeColour("rca");
    expect(colour).toStrictEqual(DOC_TYPE_COLOURS["rca"]);
  });

  // ── Unknown types ────────────────────────────────────────────────

  it("returns the fallback grey colour for an unknown type", () => {
    const colour = getTypeColour("unknown-custom-type");
    expect(colour.bg).toContain("gray");
    expect(colour.text).toContain("gray");
  });

  it("returns the fallback colour for an empty string", () => {
    const colour = getTypeColour("");
    expect(colour.bg).toContain("gray");
    expect(colour.text).toContain("gray");
  });

  it("returns the fallback colour for numeric-like string", () => {
    const colour = getTypeColour("123");
    expect(colour.bg).toContain("gray");
    expect(colour.text).toContain("gray");
  });

  it("is case-sensitive — 'Design' (capital D) returns the fallback", () => {
    const colour = getTypeColour("Design");
    expect(colour.bg).toContain("gray");
  });

  it("is case-sensitive — 'DESIGN' returns the fallback", () => {
    const colour = getTypeColour("DESIGN");
    expect(colour.bg).toContain("gray");
  });

  it("returns the fallback for 'Dev-Plan' (different capitalisation)", () => {
    const colour = getTypeColour("Dev-Plan");
    expect(colour.bg).toContain("gray");
  });

  // ── Return shape ─────────────────────────────────────────────────

  it("always returns a TypeColour with bg and text", () => {
    const types = [
      "design",
      "specification",
      "dev-plan",
      "unknown",
      "",
      "rca",
      "some-future-type",
    ];
    for (const type of types) {
      const colour: TypeColour = getTypeColour(type);
      expect(typeof colour.bg).toBe("string");
      expect(typeof colour.text).toBe("string");
      expect(colour.bg.length).toBeGreaterThan(0);
      expect(colour.text.length).toBeGreaterThan(0);
    }
  });

  it("fallback colour is consistent across multiple calls", () => {
    const c1 = getTypeColour("unknown-a");
    const c2 = getTypeColour("unknown-b");
    // Both unknowns should use the same fallback values
    expect(c1.bg).toBe(c2.bg);
    expect(c1.text).toBe(c2.text);
  });

  it("fallback colour is different from all known type colours", () => {
    const fallback = getTypeColour("definitely-unknown");
    for (const [, known] of Object.entries(DOC_TYPE_COLOURS)) {
      // Fallback bg should not collide with any known bg
      expect(fallback.bg).not.toBe(known.bg);
    }
  });
});

// ── Filter / Sort Logic ──────────────────────────────────────────────
//
// These pure functions are defined inside DocumentList.tsx but
// their logic is re-implemented here for fast unit testing.
// Any change to the production implementation must be reflected here.

import type { DocumentRecord } from "../types";

function makeDoc(
  overrides: Partial<DocumentRecord> & { id: string },
): DocumentRecord {
  return {
    path: `work/design/${overrides.id}.md`,
    type: "design",
    title: overrides.id,
    status: "draft",
    created: "2025-01-01T00:00:00Z",
    created_by: "test",
    updated: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

type SortOption =
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "type"
  | "status";

function sortDocuments(
  docs: DocumentRecord[],
  option: SortOption,
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

describe("filterDocuments", () => {
  const docs = [
    makeDoc({ id: "d1", type: "design", status: "approved" }),
    makeDoc({ id: "d2", type: "specification", status: "draft" }),
    makeDoc({ id: "d3", type: "dev-plan", status: "approved" }),
    makeDoc({ id: "d4", type: "report", status: "superseded" }),
    makeDoc({ id: "d5", type: "design", status: "draft" }),
  ];

  it("returns all docs when both filter sets are empty", () => {
    const result = filterDocuments(docs, new Set(), new Set());
    expect(result).toHaveLength(docs.length);
  });

  it("filters by a single type", () => {
    const result = filterDocuments(docs, new Set(["design"]), new Set());
    expect(result.map((d) => d.id)).toEqual(["d1", "d5"]);
  });

  it("filters by multiple types (OR within type)", () => {
    const result = filterDocuments(
      docs,
      new Set(["design", "report"]),
      new Set(),
    );
    expect(result.map((d) => d.id)).toEqual(["d1", "d4", "d5"]);
  });

  it("filters by a single status", () => {
    const result = filterDocuments(docs, new Set(), new Set(["approved"]));
    expect(result.map((d) => d.id)).toEqual(["d1", "d3"]);
  });

  it("filters by multiple statuses (OR within status)", () => {
    const result = filterDocuments(
      docs,
      new Set(),
      new Set(["approved", "draft"]),
    );
    expect(result.map((d) => d.id)).toEqual(["d1", "d2", "d3", "d5"]);
  });

  it("AND logic: type AND status filters combine", () => {
    const result = filterDocuments(
      docs,
      new Set(["design"]),
      new Set(["approved"]),
    );
    expect(result.map((d) => d.id)).toEqual(["d1"]);
  });

  it("returns empty array when no docs match type filter", () => {
    const result = filterDocuments(docs, new Set(["policy"]), new Set());
    expect(result).toHaveLength(0);
  });

  it("returns empty array when no docs match status filter", () => {
    const result = filterDocuments(docs, new Set(), new Set(["pending"]));
    expect(result).toHaveLength(0);
  });

  it("returns empty array when no docs match combined filters", () => {
    const result = filterDocuments(
      docs,
      new Set(["design"]),
      new Set(["superseded"]),
    );
    expect(result).toHaveLength(0);
  });

  it("handles empty docs array gracefully", () => {
    const result = filterDocuments([], new Set(["design"]), new Set(["draft"]));
    expect(result).toHaveLength(0);
  });

  it("does not mutate the original array", () => {
    const original = [...docs];
    filterDocuments(docs, new Set(["design"]), new Set());
    expect(docs).toEqual(original);
  });
});

describe("sortDocuments", () => {
  it("'newest' sorts by updated descending (ISO 8601)", () => {
    const docs = [
      makeDoc({ id: "old", updated: "2024-01-01T00:00:00Z" }),
      makeDoc({ id: "new", updated: "2025-06-01T00:00:00Z" }),
      makeDoc({ id: "mid", updated: "2024-12-01T00:00:00Z" }),
    ];
    const result = sortDocuments(docs, "newest");
    expect(result.map((d) => d.id)).toEqual(["new", "mid", "old"]);
  });

  it("'oldest' sorts by updated ascending", () => {
    const docs = [
      makeDoc({ id: "old", updated: "2024-01-01T00:00:00Z" }),
      makeDoc({ id: "new", updated: "2025-06-01T00:00:00Z" }),
      makeDoc({ id: "mid", updated: "2024-12-01T00:00:00Z" }),
    ];
    const result = sortDocuments(docs, "oldest");
    expect(result.map((d) => d.id)).toEqual(["old", "mid", "new"]);
  });

  it("'title-asc' sorts titles alphabetically ascending (case-insensitive)", () => {
    const docs = [
      makeDoc({ id: "d1", title: "Zebra" }),
      makeDoc({ id: "d2", title: "apple" }),
      makeDoc({ id: "d3", title: "Mango" }),
    ];
    const result = sortDocuments(docs, "title-asc");
    expect(result.map((d) => d.title)).toEqual(["apple", "Mango", "Zebra"]);
  });

  it("'title-desc' sorts titles alphabetically descending (case-insensitive)", () => {
    const docs = [
      makeDoc({ id: "d1", title: "Zebra" }),
      makeDoc({ id: "d2", title: "apple" }),
      makeDoc({ id: "d3", title: "Mango" }),
    ];
    const result = sortDocuments(docs, "title-desc");
    expect(result.map((d) => d.title)).toEqual(["Zebra", "Mango", "apple"]);
  });

  it("'type' sorts by type string ascending", () => {
    const docs = [
      makeDoc({ id: "d1", type: "specification" }),
      makeDoc({ id: "d2", type: "design" }),
      makeDoc({ id: "d3", type: "dev-plan" }),
    ];
    const result = sortDocuments(docs, "type");
    const types = result.map((d) => d.type);
    expect(types).toEqual([...types].sort());
  });

  it("'status' sorts by status string ascending", () => {
    const docs = [
      makeDoc({ id: "d1", status: "superseded" }),
      makeDoc({ id: "d2", status: "approved" }),
      makeDoc({ id: "d3", status: "draft" }),
    ];
    const result = sortDocuments(docs, "status");
    const statuses = result.map((d) => d.status);
    expect(statuses).toEqual([...statuses].sort());
  });

  it("does not mutate the original array", () => {
    const docs = [
      makeDoc({ id: "d1", updated: "2025-01-01T00:00:00Z" }),
      makeDoc({ id: "d2", updated: "2024-01-01T00:00:00Z" }),
    ];
    const originalOrder = docs.map((d) => d.id);
    sortDocuments(docs, "newest");
    expect(docs.map((d) => d.id)).toEqual(originalOrder);
  });

  it("handles empty array", () => {
    expect(sortDocuments([], "newest")).toEqual([]);
  });

  it("handles single-element array", () => {
    const docs = [makeDoc({ id: "only" })];
    expect(sortDocuments(docs, "newest")).toHaveLength(1);
    expect(sortDocuments(docs, "newest")[0].id).toBe("only");
  });

  it("stable: equal updated timestamps preserve relative order", () => {
    const ts = "2025-01-01T00:00:00Z";
    const docs = [
      makeDoc({ id: "first", updated: ts }),
      makeDoc({ id: "second", updated: ts }),
      makeDoc({ id: "third", updated: ts }),
    ];
    const result = sortDocuments(docs, "newest");
    // Relative order preserved when timestamps are equal
    expect(result.map((d) => d.id)).toEqual(["first", "second", "third"]);
  });
});

// ── getRelatedEntities ───────────────────────────────────────────────

describe("getRelatedEntities (inline)", () => {
  // Re-implement getRelatedEntities here for isolated testing
  // without importing the full module (which depends on store types).

  interface RelatedEntity {
    id: string;
    type: "plan" | "feature";
    summary: string;
  }

  function getRelatedEntities(
    documentId: string,
    state: {
      plans: Map<string, { design?: string; title: string }>;
      features: Map<string, { design?: string; summary: string }>;
    },
  ): RelatedEntity[] {
    const related: RelatedEntity[] = [];

    for (const [id, plan] of state.plans) {
      if (plan.design === documentId) {
        related.push({ id, type: "plan", summary: plan.title });
      }
    }

    for (const [id, feature] of state.features) {
      if (feature.design === documentId) {
        related.push({ id, type: "feature", summary: feature.summary });
      }
    }

    return related;
  }

  function makeState(
    plans: Array<{ id: string; design?: string; title?: string }> = [],
    features: Array<{ id: string; design?: string; summary?: string }> = [],
  ) {
    return {
      plans: new Map(
        plans.map((p) => [p.id, { design: p.design, title: p.title ?? p.id }]),
      ),
      features: new Map(
        features.map((f) => [
          f.id,
          { design: f.design, summary: f.summary ?? f.id },
        ]),
      ),
    };
  }

  it("returns empty array when no entity references the document", () => {
    const state = makeState(
      [{ id: "P1-test", design: "P1-test/other-doc" }],
      [{ id: "FEAT-001", design: "FEAT-001/another-doc" }],
    );
    expect(getRelatedEntities("P1-test/my-doc", state)).toHaveLength(0);
  });

  it("returns plans that reference the document via design field", () => {
    const state = makeState([
      { id: "P1-test", design: "P1-test/my-doc", title: "My Plan" },
    ]);
    const result = getRelatedEntities("P1-test/my-doc", state);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "P1-test",
      type: "plan",
      summary: "My Plan",
    });
  });

  it("returns features that reference the document via design field", () => {
    const state = makeState(
      [],
      [
        {
          id: "FEAT-001",
          design: "FEAT-001/design-foo",
          summary: "My Feature",
        },
      ],
    );
    const result = getRelatedEntities("FEAT-001/design-foo", state);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "FEAT-001",
      type: "feature",
      summary: "My Feature",
    });
  });

  it("returns both plans and features when both reference the document", () => {
    const state = makeState(
      [{ id: "P1-test", design: "shared-doc", title: "Plan A" }],
      [{ id: "FEAT-001", design: "shared-doc", summary: "Feature B" }],
    );
    const result = getRelatedEntities("shared-doc", state);
    expect(result).toHaveLength(2);
    const types = result.map((r) => r.type);
    expect(types).toContain("plan");
    expect(types).toContain("feature");
  });

  it("returns multiple plans if several reference the same document", () => {
    const state = makeState([
      { id: "P1-a", design: "shared-doc", title: "Plan A" },
      { id: "P1-b", design: "shared-doc", title: "Plan B" },
      { id: "P1-c", design: "other-doc", title: "Plan C" },
    ]);
    const result = getRelatedEntities("shared-doc", state);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id).sort()).toEqual(["P1-a", "P1-b"]);
  });

  it("returns empty array when state has no plans or features", () => {
    const state = makeState();
    expect(getRelatedEntities("any-doc", state)).toHaveLength(0);
  });

  it("does not return entities whose design field is undefined", () => {
    const state = makeState(
      [{ id: "P1-no-design" }],
      [{ id: "FEAT-no-design" }],
    );
    expect(getRelatedEntities("any-doc", state)).toHaveLength(0);
  });
});
