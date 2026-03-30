// src/lib/__tests__/drift-badge.test.ts

import { describe, it, expect } from "vitest";

// ── Re-implement resolveDriftState for unit testing ─────────────────
//
// DriftBadge's resolveDriftState is not exported; we duplicate the
// pure logic here to drive a fast, dependency-free test suite.
// Any change to the production logic must be mirrored here.

type DriftState = "approved-clean" | "approved-modified" | "draft" | "superseded";

interface DriftBadgeProps {
  status: string;
  contentHashExpected?: string;
  contentHashActual?: string;
  fileMissing?: boolean;
}

function resolveDriftState(props: DriftBadgeProps): DriftState {
  if (props.status === "superseded") return "superseded";
  if (props.status === "draft") return "draft";
  if (props.status === "approved") {
    if (props.fileMissing) return "approved-modified";
    if (!props.contentHashExpected) return "approved-clean"; // no hash to compare
    if (props.contentHashActual === props.contentHashExpected) return "approved-clean";
    return "approved-modified";
  }
  // Unknown status — render as draft-like (grey)
  return "draft";
}

// ── Tests ────────────────────────────────────────────────────────────

describe("resolveDriftState", () => {
  // ── superseded ────────────────────────────────────────────────────

  describe("superseded status", () => {
    it("returns superseded when status is superseded", () => {
      expect(resolveDriftState({ status: "superseded" })).toBe("superseded");
    });

    it("superseded takes priority over any hash state", () => {
      expect(
        resolveDriftState({
          status: "superseded",
          contentHashExpected: "abc123",
          contentHashActual: "abc123",
        }),
      ).toBe("superseded");
    });

    it("superseded takes priority even when file is missing", () => {
      expect(
        resolveDriftState({ status: "superseded", fileMissing: true }),
      ).toBe("superseded");
    });
  });

  // ── draft ─────────────────────────────────────────────────────────

  describe("draft status", () => {
    it("returns draft when status is draft", () => {
      expect(resolveDriftState({ status: "draft" })).toBe("draft");
    });

    it("draft ignores hash values", () => {
      expect(
        resolveDriftState({
          status: "draft",
          contentHashExpected: "abc123",
          contentHashActual: "def456",
        }),
      ).toBe("draft");
    });

    it("draft ignores fileMissing", () => {
      expect(
        resolveDriftState({ status: "draft", fileMissing: true }),
      ).toBe("draft");
    });
  });

  // ── approved-clean ────────────────────────────────────────────────

  describe("approved + clean", () => {
    it("returns approved-clean when hashes match", () => {
      const hash = "a".repeat(64);
      expect(
        resolveDriftState({
          status: "approved",
          contentHashExpected: hash,
          contentHashActual: hash,
        }),
      ).toBe("approved-clean");
    });

    it("returns approved-clean when no content_hash is recorded", () => {
      expect(
        resolveDriftState({
          status: "approved",
          contentHashExpected: undefined,
          contentHashActual: "some-hash",
        }),
      ).toBe("approved-clean");
    });

    it("returns approved-clean when contentHashExpected is absent and file is present", () => {
      expect(
        resolveDriftState({
          status: "approved",
          fileMissing: false,
        }),
      ).toBe("approved-clean");
    });

    it("returns approved-clean for exact hash match (real SHA-256-like value)", () => {
      const hash =
        "ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469348423f656b0450d5";
      expect(
        resolveDriftState({
          status: "approved",
          contentHashExpected: hash,
          contentHashActual: hash,
        }),
      ).toBe("approved-clean");
    });
  });

  // ── approved-modified ─────────────────────────────────────────────

  describe("approved + modified", () => {
    it("returns approved-modified when hashes differ", () => {
      expect(
        resolveDriftState({
          status: "approved",
          contentHashExpected: "a".repeat(64),
          contentHashActual: "b".repeat(64),
        }),
      ).toBe("approved-modified");
    });

    it("returns approved-modified when file is missing", () => {
      expect(
        resolveDriftState({
          status: "approved",
          fileMissing: true,
        }),
      ).toBe("approved-modified");
    });

    it("fileMissing takes priority over hash comparison", () => {
      const hash = "a".repeat(64);
      // Even if hashes match, missing file → modified
      expect(
        resolveDriftState({
          status: "approved",
          contentHashExpected: hash,
          contentHashActual: hash,
          fileMissing: true,
        }),
      ).toBe("approved-modified");
    });

    it("returns approved-modified when only contentHashActual is undefined but expected is set", () => {
      expect(
        resolveDriftState({
          status: "approved",
          contentHashExpected: "a".repeat(64),
          contentHashActual: undefined,
        }),
      ).toBe("approved-modified");
    });

    it("returns approved-modified when hashes differ by a single character", () => {
      const base = "a".repeat(63);
      expect(
        resolveDriftState({
          status: "approved",
          contentHashExpected: base + "0",
          contentHashActual: base + "1",
        }),
      ).toBe("approved-modified");
    });
  });

  // ── unknown status ────────────────────────────────────────────────

  describe("unknown status", () => {
    it("returns draft for an unknown status string", () => {
      expect(resolveDriftState({ status: "pending" })).toBe("draft");
    });

    it("returns draft for an empty status string", () => {
      expect(resolveDriftState({ status: "" })).toBe("draft");
    });

    it("returns draft for 'archived' (not a known status)", () => {
      expect(resolveDriftState({ status: "archived" })).toBe("draft");
    });

    it("returns draft for status with extra whitespace", () => {
      expect(resolveDriftState({ status: " approved" })).toBe("draft");
    });

    it("is case-sensitive — 'Approved' (capital A) is not approved", () => {
      expect(resolveDriftState({ status: "Approved" })).toBe("draft");
    });

    it("is case-sensitive — 'Draft' (capital D) is not draft", () => {
      expect(resolveDriftState({ status: "Draft" })).toBe("draft");
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles all props undefined (except status)", () => {
      expect(resolveDriftState({ status: "approved" })).toBe("approved-clean");
    });

    it("fileMissing: false does not trigger approved-modified", () => {
      const hash = "a".repeat(64);
      expect(
        resolveDriftState({
          status: "approved",
          contentHashExpected: hash,
          contentHashActual: hash,
          fileMissing: false,
        }),
      ).toBe("approved-clean");
    });

    it("draft status with matching hashes still returns draft", () => {
      const hash = "a".repeat(64);
      expect(
        resolveDriftState({
          status: "draft",
          contentHashExpected: hash,
          contentHashActual: hash,
        }),
      ).toBe("draft");
    });
  });
});

// ── Label resolution for unknown statuses ────────────────────────────
//
// When resolveDriftState returns "draft" for an unknown status, the
// DriftBadge component shows the raw status string (not "Draft").
// This table verifies the decision logic behind that label override.

describe("label override for unknown status", () => {
  function shouldShowRawLabel(status: string): boolean {
    const state = resolveDriftState({ status });
    return state === "draft" && status !== "draft";
  }

  it("draft status does NOT get the raw-label override (shows 'Draft')", () => {
    expect(shouldShowRawLabel("draft")).toBe(false);
  });

  it("unknown status 'pending' gets the raw-label override", () => {
    expect(shouldShowRawLabel("pending")).toBe(true);
  });

  it("unknown status 'archived' gets the raw-label override", () => {
    expect(shouldShowRawLabel("archived")).toBe(true);
  });

  it("unknown empty string gets the raw-label override", () => {
    expect(shouldShowRawLabel("")).toBe(true);
  });

  it("superseded does NOT get the raw-label override", () => {
    expect(shouldShowRawLabel("superseded")).toBe(false);
  });
});
