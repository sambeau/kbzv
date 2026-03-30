// src/lib/types/document.ts

/**
 * A DocumentRecord tracks a managed document (design, spec, plan, etc.).
 * Linked from Plan.design, Feature.design / spec / dev_plan.
 *
 * ID format: {owner}/{type}-{slug} or PROJECT/{type}-{slug}
 * Example: "FEAT-01ABC/design-my-feature"
 *
 * Filename encoding: slashes in ID become "--" in the YAML filename.
 * Example: "FEAT-01ABC/design-my-feature" → "FEAT-01ABC--design-my-feature.yaml"
 *
 * Lifecycle: draft → approved
 * Terminal: superseded
 */
export interface DocumentRecord {
  /** Document record identifier. Format: {owner}/{type}-{slug} */
  id: string;

  /** Path to the document file, relative to the repository root */
  path: string;

  /** Document type. Known values: design, specification, dev-plan, research, report, policy, rca */
  type: string;

  /** Human-readable title */
  title: string;

  /** Lifecycle status. Known values: draft, approved, superseded */
  status: string;

  /** Owning entity — Plan ID or Feature ID */
  owner?: string;

  /** Identity of who approved this document */
  approved_by?: string;

  /** Timestamp when the document was approved, RFC 3339 UTC */
  approved_at?: string;

  /** SHA-256 hash of the document content */
  content_hash?: string;

  /** ID of the document this one replaces */
  supersedes?: string;

  /** ID of the document that replaced this one */
  superseded_by?: string;

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Identity of the creator */
  created_by: string;

  /** Last-modified timestamp, RFC 3339 UTC */
  updated: string;
}
