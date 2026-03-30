// src/lib/types/decision.ts

/**
 * A Decision records an architectural or design choice.
 * Standalone entity — cross-linked via affects[].
 *
 * ID format: DEC-{TSID13}
 *
 * Lifecycle: proposed → accepted
 * Terminal: rejected, superseded
 */
export interface Decision {
  /** Decision identifier. Format: DEC-{TSID13} */
  id: string;

  /** URL-friendly identifier */
  slug: string;

  /** Brief description of the decision */
  summary: string;

  /** Explanation of why this decision was made */
  rationale: string;

  /** Identity of the decision maker */
  decided_by: string;

  /** Date the decision was made, RFC 3339 UTC */
  date?: string;

  /** Lifecycle status. Known values: proposed, accepted, rejected, superseded */
  status: string;

  /** Entity IDs affected by this decision */
  affects?: string[];

  /** ID of the decision this one replaces */
  supersedes?: string;

  /** ID of the decision that replaced this one */
  superseded_by?: string;

  /** Classification tags */
  tags?: string[];
}
