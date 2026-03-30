// src/lib/types/incident.ts

/**
 * An Incident tracks a production or development incident.
 * Standalone entity — cross-linked via affected_features[] and linked_bugs[].
 *
 * ID format: INC-{TSID13}
 *
 * Lifecycle: reported → triaged → investigating → root-cause-identified → mitigated → resolved → closed
 * Back-transitions allowed.
 */
export interface Incident {
  /** Incident identifier. Format: INC-{TSID13} */
  id: string;

  /** URL-friendly identifier */
  slug: string;

  /** Human-readable title */
  title: string;

  /** Lifecycle status. Known values: reported, triaged, investigating, root-cause-identified, mitigated, resolved, closed */
  status: string;

  /** Severity level. Known values: critical, high, medium, low */
  severity: string;

  /** Identity of who reported the incident */
  reported_by: string;

  /** Timestamp when the incident was detected, RFC 3339 UTC */
  detected_at?: string;

  /** Timestamp when the incident was triaged, RFC 3339 UTC */
  triaged_at?: string;

  /** Timestamp when the incident was mitigated, RFC 3339 UTC */
  mitigated_at?: string;

  /** Timestamp when the incident was resolved, RFC 3339 UTC */
  resolved_at?: string;

  /** Feature IDs affected by this incident */
  affected_features?: string[];

  /** Bug IDs linked to this incident */
  linked_bugs?: string[];

  /** DocumentRecord ID of the root cause analysis */
  linked_rca?: string;

  /** Brief description of the incident */
  summary: string;

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Identity of the creator */
  created_by: string;

  /** Last-modified timestamp, RFC 3339 UTC */
  updated: string;
}
