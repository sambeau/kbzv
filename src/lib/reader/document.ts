// src/lib/reader/document.ts

import { parse as parseYaml } from "yaml";
import { readTextFile } from "./fs";
import type { DocumentRecord } from "../types";

// ── Public Types ────────────────────────────────────────────────────

export interface DocumentContent {
  markdown: string;
  contentHash: string;
  hashMatches: boolean;
  frontMatter: Record<string, unknown> | null;
  fileMissing: false;
}

export interface DocumentMissing {
  markdown: null;
  contentHash: null;
  hashMatches: false;
  frontMatter: null;
  fileMissing: true;
}

export type DocumentReadResult = DocumentContent | DocumentMissing;

// ── Internal: metadata stripping ────────────────────────────────────

/**
 * Attempts to strip document metadata from the top of the content.
 *
 * Handles three formats (tried in order):
 *
 * 1. **YAML front matter** — content between `---` delimiters at the
 *    very start of the file.
 *
 * 2. **Markdown table metadata** — a two-column `| Field | Value |`
 *    table that immediately follows the first heading.  Table cells may
 *    use bold (`**Feature**`) or plain text for keys.
 *
 * 3. **Bold-field block** — consecutive lines matching
 *    `**Label:** value` that immediately follow the first heading.
 *
 * In all cases the optional `---` separator that sometimes follows the
 * metadata block is also stripped.
 *
 * If none of the patterns match, returns the content unchanged with
 * `frontMatter: null`.
 */
function stripDocumentMetadata(content: string): {
  body: string;
  frontMatter: Record<string, unknown> | null;
} {
  // ── 1. Try YAML front matter ────────────────────────────────────
  const yamlMatch = content.match(
    /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/,
  );
  if (yamlMatch) {
    try {
      const parsed = parseYaml(yamlMatch[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          body: yamlMatch[2],
          frontMatter: parsed as Record<string, unknown>,
        };
      }
    } catch {
      /* YAML parse failure — fall through to other formats */
    }
  }

  // ── 2/3. Try table or bold-field metadata after heading ─────────
  const lines = content.split("\n");
  let i = 0;

  // Skip leading blank lines
  while (i < lines.length && lines[i].trim() === "") i++;

  // Expect a heading line — if there isn't one we can't reliably
  // distinguish a metadata block from normal content, so bail out.
  if (i >= lines.length || !lines[i].startsWith("#")) {
    return { body: content, frontMatter: null };
  }

  // Record the heading position (it stays in the body)
  const headingStart = i;
  i++;

  // Skip blank lines between heading and metadata block
  while (i < lines.length && lines[i].trim() === "") i++;

  const metaStart = i;
  const fields: Record<string, string> = {};
  let metaEnd = i;

  // ── 2. Table format: | Field | Value | ──────────────────────────
  if (i < lines.length && /^\s*\|/.test(lines[i])) {
    // First row — header (skip its content, just advance past it)
    i++;

    // Separator row  |---|---|  or  |:---|:---|  etc.
    if (i < lines.length && /^\s*\|[\s:|-]+\|[\s:|-]+\|/.test(lines[i])) {
      i++;
    }

    // Data rows
    while (i < lines.length && /^\s*\|/.test(lines[i])) {
      const rowMatch = lines[i].match(/^\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
      if (rowMatch) {
        // Strip bold markers and backticks from key; strip backticks from value
        const key = rowMatch[1].replace(/\*\*/g, "").trim();
        const value = rowMatch[2].trim();
        if (key && value) {
          fields[key] = value;
        }
      }
      i++;
    }

    metaEnd = i;
  }

  // ── 3. Bold-field format: **Label:** value ──────────────────────
  else if (i < lines.length && /^\*\*[^*]+:\*\*/.test(lines[i])) {
    while (i < lines.length && /^\*\*[^*]+:\*\*/.test(lines[i])) {
      const fieldMatch = lines[i].match(/^\*\*([^*]+):\*\*\s*(.*)/);
      if (fieldMatch) {
        const key = fieldMatch[1].trim();
        const value = fieldMatch[2].trim();
        if (key) {
          fields[key] = value;
        }
      }
      i++;
    }

    metaEnd = i;
  }

  // Nothing recognised — return unchanged
  if (Object.keys(fields).length === 0) {
    return { body: content, frontMatter: null };
  }

  // Skip trailing blank lines after the metadata block
  while (metaEnd < lines.length && lines[metaEnd].trim() === "") metaEnd++;

  // Skip an optional `---` horizontal-rule separator
  if (metaEnd < lines.length && /^---\s*$/.test(lines[metaEnd])) metaEnd++;

  // Skip blank lines after the separator
  while (metaEnd < lines.length && lines[metaEnd].trim() === "") metaEnd++;

  // Reconstruct the body: heading lines + everything after the
  // metadata block (the metadata itself is omitted).
  const headingLines = lines.slice(headingStart, metaStart);
  const restLines = lines.slice(metaEnd);
  const body = [...headingLines, "", ...restLines].join("\n");

  return { body, frontMatter: fields };
}

// ── Internal: hashing ───────────────────────────────────────────────

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
      frontMatter: null,
      fileMissing: true,
    };
  }

  // Hash is computed on the *original* content (including metadata)
  // so it stays compatible with the kbz state content_hash.
  const contentHash = await computeSHA256(content);

  const hashMatches =
    !record.content_hash || contentHash === record.content_hash;

  const { body, frontMatter } = stripDocumentMetadata(content);

  return {
    markdown: body,
    contentHash,
    hashMatches,
    frontMatter,
    fileMissing: false,
  };
}
