// src/lib/types/bug.ts

/**
 * A Bug tracks a defect discovered in the project.
 * Standalone entity — cross-linked via origin_feature / origin_task / affects.
 *
 * ID format: BUG-{TSID13}
 *
 * Lifecycle: reported → triaged → reproduced → planned → in-progress → needs-review → verified → closed
 * Also: cannot-reproduce, needs-rework
 * Terminal: closed, duplicate, not-planned
 */
export interface Bug {
  /** Bug identifier. Format: BUG-{TSID13} */
  id: string;

  /** URL-friendly identifier */
  slug: string;

  /** Human-readable title */
  title: string;

  /** Lifecycle status. Known values: reported, triaged, reproduced, planned, in-progress, needs-review, verified, closed, cannot-reproduce, needs-rework, duplicate, not-planned */
  status: string;

  /** Story point estimate on Modified Fibonacci scale */
  estimate?: number;

  /** Severity level. Known values: low, medium, high, critical */
  severity: string;

  /** Priority level. Known values: low, medium, high, critical */
  priority: string;

  /** Bug classification. Known values: implementation-defect, specification-defect, design-problem */
  type: string;

  /** Identity of who reported the bug */
  reported_by: string;

  /** Timestamp when the bug was reported, RFC 3339 UTC */
  reported?: string;

  /** Description of the observed (incorrect) behaviour */
  observed: string;

  /** Description of the expected (correct) behaviour */
  expected: string;

  /** Entity IDs affected by this bug */
  affects?: string[];

  /** Feature ID where the bug originated */
  origin_feature?: string;

  /** Task ID where the bug originated */
  origin_task?: string;

  /** Environment description (OS, version, etc.) */
  environment?: string;

  /** Steps to reproduce the bug */
  reproduction?: string;

  /** Bug ID this is a duplicate of */
  duplicate_of?: string;

  /** Reference to the fix (e.g. commit, PR) */
  fixed_by?: string;

  /** Identity of who verified the fix */
  verified_by?: string;

  /** Target release for the fix */
  release_target?: string;

  /** Classification tags */
  tags?: string[];
}
