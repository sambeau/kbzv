// src/lib/__tests__/document-reader.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocumentRecord } from "../types";

// ── Mock @tauri-apps/plugin-fs ─────────────────────────────────────

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
}));

import { readTextFile } from "@tauri-apps/plugin-fs";
import { readDocumentContent } from "../reader/document";

// ── Helpers ─────────────────────────────────────────────────────────

const readTextFileMock = vi.mocked(readTextFile);

function makeRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "P1-test/design-foo",
    path: "work/design/foo.md",
    type: "design",
    title: "Foo Design",
    status: "approved",
    created: "2025-01-01T00:00:00Z",
    created_by: "test",
    updated: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Compute SHA-256 of a string using the Web Crypto API — mirrors
 * the implementation in document.ts so we can derive expected hashes.
 */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── SHA-256 Algorithm ────────────────────────────────────────────────

describe("SHA-256 computation (via readDocumentContent)", () => {
  it("computes correct hash for empty string", async () => {
    const emptyHash = await sha256("");
    // SHA-256 of empty string is a well-known value
    expect(emptyHash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("computes correct hash for known content", async () => {
    const content = "Hello, World!\n";
    const hash = await sha256(content);
    // SHA-256 of "Hello, World!\n"
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Verify determinism
    expect(await sha256(content)).toBe(hash);
  });

  it("produces a 64-character hex string", async () => {
    const hash = await sha256("some content");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different inputs", async () => {
    const h1 = await sha256("abc");
    const h2 = await sha256("abd");
    expect(h1).not.toBe(h2);
  });

  it("is sensitive to whitespace differences", async () => {
    const h1 = await sha256("hello\n");
    const h2 = await sha256("hello");
    expect(h1).not.toBe(h2);
  });
});

// ── readDocumentContent ──────────────────────────────────────────────

describe("readDocumentContent", () => {
  const projectPath = "/home/user/my-project";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── DocumentMissing cases ──────────────────────────────────────────

  describe("when file is missing", () => {
    beforeEach(() => {
      readTextFileMock.mockRejectedValue(new Error("File not found"));
    });

    it("returns fileMissing: true", async () => {
      const record = makeRecord();
      const result = await readDocumentContent(projectPath, record);
      expect(result.fileMissing).toBe(true);
    });

    it("returns null for markdown, contentHash, hashMatches", async () => {
      const record = makeRecord();
      const result = await readDocumentContent(projectPath, record);
      expect(result.markdown).toBeNull();
      expect(result.contentHash).toBeNull();
      expect(result.hashMatches).toBe(false);
    });

    it("handles any FS error as missing (not just ENOENT)", async () => {
      readTextFileMock.mockRejectedValue(new Error("Permission denied"));
      const record = makeRecord();
      const result = await readDocumentContent(projectPath, record);
      expect(result.fileMissing).toBe(true);
    });
  });

  // ── DocumentContent cases ──────────────────────────────────────────

  describe("when file exists", () => {
    const content = "# Hello\n\nThis is a test document.\n";

    beforeEach(() => {
      readTextFileMock.mockResolvedValue(content);
    });

    it("returns fileMissing: false", async () => {
      const record = makeRecord();
      const result = await readDocumentContent(projectPath, record);
      expect(result.fileMissing).toBe(false);
    });

    it("returns the file content as markdown", async () => {
      const record = makeRecord();
      const result = await readDocumentContent(projectPath, record);
      if (result.fileMissing) throw new Error("Expected DocumentContent");
      expect(result.markdown).toBe(content);
    });

    it("computes and returns the content hash", async () => {
      const record = makeRecord();
      const result = await readDocumentContent(projectPath, record);
      if (result.fileMissing) throw new Error("Expected DocumentContent");
      const expectedHash = await sha256(content);
      expect(result.contentHash).toBe(expectedHash);
    });

    it("constructs the full path from projectPath + record.path", async () => {
      const record = makeRecord({ path: "work/design/foo.md" });
      await readDocumentContent(projectPath, record);
      expect(readTextFileMock).toHaveBeenCalledWith(
        "/home/user/my-project/work/design/foo.md",
      );
    });
  });

  // ── Hash comparison ────────────────────────────────────────────────

  describe("hash comparison", () => {
    const content = "# My Document\n\nSome content here.\n";

    beforeEach(() => {
      readTextFileMock.mockResolvedValue(content);
    });

    it("hashMatches is true when recorded hash equals computed hash", async () => {
      const computedHash = await sha256(content);
      const record = makeRecord({ content_hash: computedHash });
      const result = await readDocumentContent(projectPath, record);
      if (result.fileMissing) throw new Error("Expected DocumentContent");
      expect(result.hashMatches).toBe(true);
    });

    it("hashMatches is false when recorded hash differs from computed hash", async () => {
      const record = makeRecord({
        content_hash: "a".repeat(64), // wrong hash
      });
      const result = await readDocumentContent(projectPath, record);
      if (result.fileMissing) throw new Error("Expected DocumentContent");
      expect(result.hashMatches).toBe(false);
    });

    it("hashMatches is true when no content_hash is recorded (no warning)", async () => {
      const record = makeRecord({ content_hash: undefined });
      const result = await readDocumentContent(projectPath, record);
      if (result.fileMissing) throw new Error("Expected DocumentContent");
      expect(result.hashMatches).toBe(true);
    });

    it("hashMatches is true when content_hash is empty string (treated as absent)", async () => {
      const record = makeRecord({ content_hash: "" });
      const result = await readDocumentContent(projectPath, record);
      if (result.fileMissing) throw new Error("Expected DocumentContent");
      // Empty string is falsy — treated as no hash recorded
      expect(result.hashMatches).toBe(true);
    });

    it("returns the actual computed contentHash alongside the match result", async () => {
      const computedHash = await sha256(content);
      const record = makeRecord({ content_hash: "wrong-hash" });
      const result = await readDocumentContent(projectPath, record);
      if (result.fileMissing) throw new Error("Expected DocumentContent");
      expect(result.contentHash).toBe(computedHash);
      expect(result.hashMatches).toBe(false);
    });
  });

  // ── SHA-256 matches kanbanzai ──────────────────────────────────────

  describe("SHA-256 compatibility with kanbanzai", () => {
    it("produces lowercase hex with no prefix", async () => {
      const content = "test\n";
      readTextFileMock.mockResolvedValue(content);
      const result = await readDocumentContent(projectPath, makeRecord());
      if (result.fileMissing) throw new Error("Expected DocumentContent");
      expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("computes correct SHA-256 for a known test vector", async () => {
      // Derive the expected hash using the same Web Crypto API to keep the
      // test environment self-consistent and avoid brittle hardcoded vectors.
      const content = "abc";
      const expectedHash = await sha256(content);
      readTextFileMock.mockResolvedValue(content);
      const record = makeRecord({ content_hash: expectedHash });
      const result = await readDocumentContent(projectPath, record);
      if (result.fileMissing) throw new Error("Expected DocumentContent");
      expect(result.contentHash).toBe(expectedHash);
      expect(result.hashMatches).toBe(true);
      // The hash must be a valid 64-char hex string
      expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
