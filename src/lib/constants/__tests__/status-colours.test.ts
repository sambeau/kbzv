// src/lib/constants/__tests__/status-colours.test.ts

import { describe, it, expect } from "vitest";
import {
  STATUS_COLOURS,
  getStatusColour,
  getStatusHex,
} from "../status-colours";
import { ENTITY_TYPES } from "../entity-types";

// ── Status Colours ──────────────────────────────────────────────────

describe("Status Colours", () => {
  it("maps known statuses to correct colours", () => {
    expect(getStatusColour("proposed")).toBe("grey");
    expect(getStatusColour("designing")).toBe("blue");
    expect(getStatusColour("active")).toBe("yellow");
    expect(getStatusColour("blocked")).toBe("orange");
    expect(getStatusColour("done")).toBe("green");
    expect(getStatusColour("cancelled")).toBe("red");
    expect(getStatusColour("superseded")).toBe("purple");
  });

  it("returns grey for unknown statuses", () => {
    expect(getStatusColour("xyz-future")).toBe("grey");
    expect(getStatusColour("")).toBe("grey");
  });

  it("returns grey for completely made-up statuses", () => {
    expect(getStatusColour("not-a-real-status")).toBe("grey");
    expect(getStatusColour("ACTIVE")).toBe("grey"); // case-sensitive
  });

  it("returns correct hex values", () => {
    expect(getStatusHex("done")).toBe("#22C55E");
    expect(getStatusHex("active")).toBe("#EAB308");
    expect(getStatusHex("xyz-future")).toBe("#9CA3AF");
  });

  it("returns grey hex for unknown status", () => {
    expect(getStatusHex("unknown")).toBe(STATUS_COLOURS.grey);
    expect(getStatusHex("")).toBe("#9CA3AF");
  });

  it("covers all 38 mapped statuses and each returns a valid colour", () => {
    const allStatuses = [
      "proposed",
      "queued",
      "draft",
      "reported",
      "designing",
      "specifying",
      "dev-planning",
      "ready",
      "planned",
      "contributed",
      "triaged",
      "reproduced",
      "active",
      "in-progress",
      "investigating",
      "developing",
      "root-cause-identified",
      "blocked",
      "needs-review",
      "needs-rework",
      "disputed",
      "pending",
      "mitigated",
      "done",
      "closed",
      "verified",
      "approved",
      "accepted",
      "confirmed",
      "resolved",
      "responded",
      "cancelled",
      "not-planned",
      "rejected",
      "duplicate",
      "retired",
      "cannot-reproduce",
      "superseded",
    ];
    // All of these are explicitly mapped — none should fall through to the grey default
    // (though grey IS a valid mapped colour for proposed/queued/draft/reported)
    for (const status of allStatuses) {
      // Verify each returns a valid colour name (does not crash)
      const colour = getStatusColour(status);
      expect(Object.keys(STATUS_COLOURS)).toContain(colour);
    }
    expect(allStatuses).toHaveLength(38);
  });

  it("grey statuses map to grey colour", () => {
    expect(getStatusColour("proposed")).toBe("grey");
    expect(getStatusColour("queued")).toBe("grey");
    expect(getStatusColour("draft")).toBe("grey");
    expect(getStatusColour("reported")).toBe("grey");
  });

  it("blue statuses map to blue colour", () => {
    expect(getStatusColour("designing")).toBe("blue");
    expect(getStatusColour("specifying")).toBe("blue");
    expect(getStatusColour("dev-planning")).toBe("blue");
    expect(getStatusColour("ready")).toBe("blue");
    expect(getStatusColour("planned")).toBe("blue");
    expect(getStatusColour("contributed")).toBe("blue");
    expect(getStatusColour("triaged")).toBe("blue");
    expect(getStatusColour("reproduced")).toBe("blue");
  });

  it("yellow statuses map to yellow colour", () => {
    expect(getStatusColour("active")).toBe("yellow");
    expect(getStatusColour("in-progress")).toBe("yellow");
    expect(getStatusColour("investigating")).toBe("yellow");
    expect(getStatusColour("developing")).toBe("yellow");
    expect(getStatusColour("root-cause-identified")).toBe("yellow");
  });

  it("orange statuses map to orange colour", () => {
    expect(getStatusColour("blocked")).toBe("orange");
    expect(getStatusColour("needs-review")).toBe("orange");
    expect(getStatusColour("needs-rework")).toBe("orange");
    expect(getStatusColour("disputed")).toBe("orange");
    expect(getStatusColour("pending")).toBe("orange");
    expect(getStatusColour("mitigated")).toBe("orange");
  });

  it("green statuses map to green colour", () => {
    expect(getStatusColour("done")).toBe("green");
    expect(getStatusColour("closed")).toBe("green");
    expect(getStatusColour("verified")).toBe("green");
    expect(getStatusColour("approved")).toBe("green");
    expect(getStatusColour("accepted")).toBe("green");
    expect(getStatusColour("confirmed")).toBe("green");
    expect(getStatusColour("resolved")).toBe("green");
    expect(getStatusColour("responded")).toBe("green");
  });

  it("red statuses map to red colour", () => {
    expect(getStatusColour("cancelled")).toBe("red");
    expect(getStatusColour("not-planned")).toBe("red");
    expect(getStatusColour("rejected")).toBe("red");
    expect(getStatusColour("duplicate")).toBe("red");
    expect(getStatusColour("retired")).toBe("red");
    expect(getStatusColour("cannot-reproduce")).toBe("red");
  });

  it("purple statuses map to purple colour", () => {
    expect(getStatusColour("superseded")).toBe("purple");
  });

  it("STATUS_COLOURS palette has exactly 7 colours", () => {
    expect(Object.keys(STATUS_COLOURS)).toHaveLength(7);
  });

  it("STATUS_COLOURS palette has correct hex values", () => {
    expect(STATUS_COLOURS.grey).toBe("#9CA3AF");
    expect(STATUS_COLOURS.blue).toBe("#3B82F6");
    expect(STATUS_COLOURS.yellow).toBe("#EAB308");
    expect(STATUS_COLOURS.orange).toBe("#F97316");
    expect(STATUS_COLOURS.green).toBe("#22C55E");
    expect(STATUS_COLOURS.red).toBe("#EF4444");
    expect(STATUS_COLOURS.purple).toBe("#A855F7");
  });

  it("getStatusHex returns correct hex for each colour category", () => {
    expect(getStatusHex("proposed")).toBe("#9CA3AF"); // grey
    expect(getStatusHex("designing")).toBe("#3B82F6"); // blue
    expect(getStatusHex("active")).toBe("#EAB308"); // yellow
    expect(getStatusHex("blocked")).toBe("#F97316"); // orange
    expect(getStatusHex("done")).toBe("#22C55E"); // green
    expect(getStatusHex("cancelled")).toBe("#EF4444"); // red
    expect(getStatusHex("superseded")).toBe("#A855F7"); // purple
  });
});

// ── Entity Types ────────────────────────────────────────────────────

describe("Entity Types", () => {
  it("has exactly 9 entries", () => {
    expect(Object.keys(ENTITY_TYPES)).toHaveLength(9);
  });

  it("each entry has required fields", () => {
    for (const info of Object.values(ENTITY_TYPES)) {
      expect(info.type).toBeTruthy();
      expect(info.label).toBeTruthy();
      expect(info.labelPlural).toBeTruthy();
      expect(info.directory).toBeTruthy();
      expect(info.icon).toBeTruthy();
    }
  });

  it("has all nine entity type keys", () => {
    const expectedKeys = [
      "plan",
      "feature",
      "task",
      "bug",
      "decision",
      "knowledge",
      "document",
      "incident",
      "checkpoint",
    ];
    expect(Object.keys(ENTITY_TYPES).sort()).toEqual(expectedKeys.sort());
  });

  it("plan entry has correct values", () => {
    expect(ENTITY_TYPES.plan.type).toBe("plan");
    expect(ENTITY_TYPES.plan.label).toBe("Plan");
    expect(ENTITY_TYPES.plan.labelPlural).toBe("Plans");
    expect(ENTITY_TYPES.plan.directory).toBe("plans");
    expect(ENTITY_TYPES.plan.icon).toBe("Map");
  });

  it("feature entry has correct values", () => {
    expect(ENTITY_TYPES.feature.type).toBe("feature");
    expect(ENTITY_TYPES.feature.label).toBe("Feature");
    expect(ENTITY_TYPES.feature.directory).toBe("features");
    expect(ENTITY_TYPES.feature.icon).toBe("Layers");
  });

  it("task entry has correct values", () => {
    expect(ENTITY_TYPES.task.type).toBe("task");
    expect(ENTITY_TYPES.task.directory).toBe("tasks");
  });

  it("bug entry has correct values", () => {
    expect(ENTITY_TYPES.bug.type).toBe("bug");
    expect(ENTITY_TYPES.bug.directory).toBe("bugs");
  });

  it("each type field matches the key", () => {
    for (const [key, info] of Object.entries(ENTITY_TYPES)) {
      expect(info.type).toBe(key);
    }
  });
});
