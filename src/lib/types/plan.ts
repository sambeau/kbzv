// src/lib/types/plan.ts

/**
 * A Plan is the top-level organising unit in a Kanbanzai project.
 * Plans own Features, which in turn own Tasks.
 *
 * ID format: P{n}-{slug} — e.g. "P1-kbzv", "P12-infra"
 *
 * Lifecycle: proposed → designing → active → done
 * From any non-terminal state: → superseded, → cancelled
 */
export interface Plan {
  /** Plan identifier. Format: P{n}-{slug}. Example: "P1-kbzv" */
  id: string;

  /** URL-friendly identifier. Example: "kbzv" */
  slug: string;

  /** Human-readable title. Example: "Kanbanzai Viewer" */
  title: string;

  /** Lifecycle status. Known values: proposed, designing, active, done, superseded, cancelled */
  status: string;

  /** Brief description of the plan's purpose */
  summary: string;

  /** DocumentRecord ID referencing the plan's design document */
  design?: string;

  /** Classification tags */
  tags?: string[];

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Identity of the creator */
  created_by: string;

  /** Last-modified timestamp, RFC 3339 UTC */
  updated: string;

  /** ID of the plan this one replaces */
  supersedes?: string;

  /** ID of the plan that replaced this one */
  superseded_by?: string;
}
