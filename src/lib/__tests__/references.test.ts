// src/lib/__tests__/references.test.ts

import { describe, it, expect } from "vitest";
import type { Plan } from "../types";
import { resolveEntityType, resolveEntity } from "../query/references";

// ── Helper Factories ────────────────────────────────────────────────

function makePlan(overrides: Partial<Plan> & { id: string }): Plan {
  return {
    slug: "test",
    title: "Test Plan",
    status: "active",
    summary: "test",
    created: "2025-01-01T00:00:00Z",
    created_by: "test",
    updated: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── resolveEntityType ───────────────────────────────────────────────

describe("resolveEntityType", () => {
  const cases: Array<[string, string | null]> = [
    ["FEAT-01KMZA9CP9XEX", "feature"],
    ["TASK-01ABC123", "task"],
    ["BUG-01XYZ789", "bug"],
    ["DEC-01AAA111", "decision"],
    ["KE-01BBB222", "knowledge"],
    ["INC-01CCC333", "incident"],
    ["CHK-01DDD444", "checkpoint"],
    ["FEAT-01ABC/design-my-feature", "document"],
    ["PROJECT/policy-security", "document"],
    ["P1-kbzv", "plan"],
    ["P12-infra", "plan"],
    ["unknown-thing", null],
    ["", null],
  ];

  for (const [input, expected] of cases) {
    it(`resolves "${input}" to ${String(expected)}`, () => {
      expect(resolveEntityType(input)).toBe(expected);
    });
  }

  it("returns feature for FEAT- prefix", () => {
    expect(resolveEntityType("FEAT-01KMZA9CP9XEX")).toBe("feature");
  });

  it("returns task for TASK- prefix", () => {
    expect(resolveEntityType("TASK-01ABC123")).toBe("task");
  });

  it("returns bug for BUG- prefix", () => {
    expect(resolveEntityType("BUG-01XYZ789")).toBe("bug");
  });

  it("returns decision for DEC- prefix", () => {
    expect(resolveEntityType("DEC-01AAA111")).toBe("decision");
  });

  it("returns knowledge for KE- prefix", () => {
    expect(resolveEntityType("KE-01BBB222")).toBe("knowledge");
  });

  it("returns incident for INC- prefix", () => {
    expect(resolveEntityType("INC-01CCC333")).toBe("incident");
  });

  it("returns checkpoint for CHK- prefix", () => {
    expect(resolveEntityType("CHK-01DDD444")).toBe("checkpoint");
  });

  it("returns document for IDs containing a slash", () => {
    expect(resolveEntityType("FEAT-01ABC/design-my-feature")).toBe("document");
    expect(resolveEntityType("PROJECT/policy-security")).toBe("document");
    expect(resolveEntityType("P1-kbzv/some-doc")).toBe("document");
  });

  it("returns plan for {Letter}{Digits}- pattern", () => {
    expect(resolveEntityType("P1-kbzv")).toBe("plan");
    expect(resolveEntityType("P12-infra")).toBe("plan");
    expect(resolveEntityType("A1-something")).toBe("plan");
    expect(resolveEntityType("Z99-last")).toBe("plan");
  });

  it("returns null for empty string", () => {
    expect(resolveEntityType("")).toBeNull();
  });

  it("returns null for unknown patterns", () => {
    expect(resolveEntityType("unknown-thing")).toBeNull();
    expect(resolveEntityType("foo")).toBeNull();
    expect(resolveEntityType("123-abc")).toBeNull();
  });

  it("document detection takes priority over plan pattern when slash is present", () => {
    // "P1-kbzv/some-doc" has a slash, so it's a document not a plan
    expect(resolveEntityType("P1-kbzv/some-doc")).toBe("document");
  });

  it("slash check takes priority: document IDs with FEAT-* prefix resolve as document", () => {
    // Document IDs like "FEAT-01ABC/design-my-feature" contain '/' and should
    // resolve to 'document', not 'feature'. The slash check runs first.
    expect(resolveEntityType("FEAT-01ABC/design-my-feature")).toBe("document");
  });
});

// ── resolveEntity ───────────────────────────────────────────────────

describe("resolveEntity", () => {
  function makeEmptyState() {
    return {
      plans: new Map(),
      features: new Map(),
      tasks: new Map(),
      bugs: new Map(),
      decisions: new Map(),
      knowledge: new Map(),
      documents: new Map(),
      incidents: new Map(),
      checkpoints: new Map(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it("returns entity and type when found (plan)", () => {
    const plan = makePlan({ id: "P1-kbzv" });
    const mockState = makeEmptyState();
    mockState.plans = new Map([["P1-kbzv", plan]]);

    const result = resolveEntity("P1-kbzv", mockState);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("plan");
    expect(result!.entity).toBe(plan);
  });

  it("returns entity and type when found (feature)", () => {
    const feature = {
      id: "FEAT-01AAA",
      slug: "test",
      parent: "P1-test",
      status: "active",
      summary: "test",
      created: "2025-01-01T00:00:00Z",
      created_by: "test",
      updated: "2025-01-01T00:00:00Z",
    };
    const mockState = makeEmptyState();
    mockState.features = new Map([["FEAT-01AAA", feature]]);

    const result = resolveEntity("FEAT-01AAA", mockState);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("feature");
    expect(result!.entity).toBe(feature);
  });

  it("returns entity and type when found (task)", () => {
    const task = {
      id: "TASK-01AAA",
      parent_feature: "FEAT-01AAA",
      slug: "test",
      summary: "test",
      status: "active",
    };
    const mockState = makeEmptyState();
    mockState.tasks = new Map([["TASK-01AAA", task]]);

    const result = resolveEntity("TASK-01AAA", mockState);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("task");
    expect(result!.entity).toBe(task);
  });

  it("returns entity and type when found (bug)", () => {
    const bug = {
      id: "BUG-01AAA",
      slug: "test",
      title: "Test Bug",
      status: "reported",
      severity: "high",
      priority: "high",
      type: "implementation-defect",
      reported_by: "test",
      observed: "x",
      expected: "y",
    };
    const mockState = makeEmptyState();
    mockState.bugs = new Map([["BUG-01AAA", bug]]);

    const result = resolveEntity("BUG-01AAA", mockState);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("bug");
    expect(result!.entity).toBe(bug);
  });

  it("returns entity and type when found (knowledge)", () => {
    const ke = {
      id: "KE-01AAA",
      tier: 2,
      topic: "test",
      scope: "project",
      content: "test",
      status: "confirmed",
      created: "",
      created_by: "",
      updated: "",
    };
    const mockState = makeEmptyState();
    mockState.knowledge = new Map([["KE-01AAA", ke]]);

    const result = resolveEntity("KE-01AAA", mockState);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("knowledge");
  });

  it("returns entity and type when found (checkpoint)", () => {
    const chk = {
      id: "CHK-01AAA",
      question: "q",
      context: "c",
      orchestration_summary: "o",
      created_by: "test",
      status: "pending",
      created: "",
    };
    const mockState = makeEmptyState();
    mockState.checkpoints = new Map([["CHK-01AAA", chk]]);

    const result = resolveEntity("CHK-01AAA", mockState);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("checkpoint");
  });

  it("returns null for unknown ID format", () => {
    const mockState = makeEmptyState();
    expect(resolveEntity("unknown-thing", mockState)).toBeNull();
  });

  it("returns null for empty string", () => {
    const mockState = makeEmptyState();
    expect(resolveEntity("", mockState)).toBeNull();
  });

  it("returns null for valid format but non-existent entity", () => {
    const mockState = makeEmptyState();
    expect(resolveEntity("FEAT-01NONEXISTENT", mockState)).toBeNull();
  });

  it("returns null for valid plan format but non-existent plan", () => {
    const mockState = makeEmptyState();
    expect(resolveEntity("P1-nonexistent", mockState)).toBeNull();
  });

  it("entity reference is strict identity (same object)", () => {
    const plan = makePlan({ id: "P1-kbzv" });
    const mockState = makeEmptyState();
    mockState.plans = new Map([["P1-kbzv", plan]]);

    const result = resolveEntity("P1-kbzv", mockState);
    expect(result!.entity).toBe(plan);
  });
});
