// src/lib/reader/document.ts

import { readTextFile } from "@tauri-apps/plugin-fs";
import type { DocumentRecord } from "../types";

// ── Public Types ────────────────────────────────────────────────────

export interface DocumentContent {
  markdown: string;
  contentHash: string;
  hashMatches: boolean;
  fileMissing: false;
}

export interface DocumentMissing {
  markdown: null;
  contentHash: null;
  hashMatches: false;
  fileMissing: true;
}

export type DocumentReadResult = DocumentContent | DocumentMissing;

// ── Internal ────────────────────────────────────────────────────────

async function computeSHA256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Public API ──────────────────────────────────────────────────────

export async function readDocumentContent(
  projectPath: string,
  record: DocumentRecord,
): Promise<DocumentReadResult> {
  const fullPath = `${projectPath}/${record.path}`;

  let content: string;
  try {
    content = await readTextFile(fullPath);
  } catch {
    return {
      markdown: null,
      contentHash: null,
      hashMatches: false,
      fileMissing: true,
    };
  }

  const contentHash = await computeSHA256(content);

  const hashMatches =
    !record.content_hash || contentHash === record.content_hash;

  return {
    markdown: content,
    contentHash,
    hashMatches,
    fileMissing: false,
  };
}
