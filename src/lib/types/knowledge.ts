// src/lib/types/knowledge.ts

/**
 * A KnowledgeEntry captures a learned fact or convention.
 * Standalone entity — scoped to a role profile or "project".
 *
 * ID format: KE-{TSID13}
 *
 * Lifecycle: contributed → confirmed (auto: use_count ≥ 3, miss_count = 0) or → disputed
 * Terminal: retired
 */
export interface KnowledgeEntry {
  /** Knowledge entry identifier. Format: KE-{TSID13} */
  id: string;

  /** Knowledge tier. 2 = project-level, 3 = session-level */
  tier: number;

  /** Topic identifier — normalised, lowercase, hyphenated */
  topic: string;

  /** Scope — a role profile name (e.g. "backend") or "project" */
  scope: string;

  /** The knowledge content — concise, actionable statement */
  content: string;

  /** Provenance — Task ID or other reference where this was learned */
  learned_from?: string;

  /** Lifecycle status. Known values: contributed, confirmed, disputed, retired */
  status: string;

  /** Number of times this knowledge entry was used */
  use_count?: number;

  /** Number of times this knowledge entry was missed */
  miss_count?: number;

  /** Confidence score, 0.0–1.0 */
  confidence?: number;

  /** Time-to-live in days. 30 (tier 3), 90 (tier 2), 0 (exempt) */
  ttl_days?: number;

  /** Git file paths anchoring this knowledge to source code */
  git_anchors?: string[];

  /** Classification tags */
  tags?: string[];

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Identity of the creator */
  created_by: string;

  /** Last-modified timestamp, RFC 3339 UTC */
  updated: string;
}
