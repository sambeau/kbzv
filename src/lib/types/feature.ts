// src/lib/types/feature.ts

/**
 * A Feature is a deliverable unit of work within a Plan.
 * Features own Tasks and follow a document-driven lifecycle.
 *
 * ID format: FEAT-{TSID13} — e.g. "FEAT-01KMZA9CP9XEX"
 *
 * Lifecycle: proposed → designing → specifying → dev-planning → developing → done
 * From any non-terminal state: → superseded, → cancelled
 * Backward transitions triggered by document supersession.
 */
export interface Feature {
  /** Feature identifier. Format: FEAT-{TSID13} */
  id: string;

  /** URL-friendly identifier */
  slug: string;

  /** Parent Plan ID. Example: "P1-kbzv" */
  parent: string;

  /** Lifecycle status. Known values: proposed, designing, specifying, dev-planning, developing, done, superseded, cancelled */
  status: string;

  /** Story point estimate on Modified Fibonacci scale (0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100) */
  estimate?: number;

  /** Brief description of the feature */
  summary: string;

  /** DocumentRecord ID — design document */
  design?: string;

  /** DocumentRecord ID — specification document */
  spec?: string;

  /** DocumentRecord ID — development plan document */
  dev_plan?: string;

  /** Classification tags */
  tags?: string[];

  /** Denormalised list of child Task IDs */
  tasks?: string[];

  /** Decision IDs linked to this feature */
  decisions?: string[];

  /** Git branch name for this feature's work */
  branch?: string;

  /** ID of the feature this one replaces */
  supersedes?: string;

  /** ID of the feature that replaced this one */
  superseded_by?: string;

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Identity of the creator */
  created_by: string;

  /** Last-modified timestamp, RFC 3339 UTC */
  updated: string;
}
