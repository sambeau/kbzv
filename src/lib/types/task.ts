// src/lib/types/task.ts

/**
 * A Task is an atomic unit of work within a Feature.
 *
 * ID format: TASK-{TSID13} — e.g. "TASK-01KMZA9XXXYYY"
 *
 * Lifecycle: queued → ready → active → done
 * Also: blocked, needs-review, needs-rework
 * Terminal: done, not-planned, duplicate
 */
export interface Task {
  /** Task identifier. Format: TASK-{TSID13} */
  id: string;

  /** Parent Feature ID. Format: FEAT-{TSID13} */
  parent_feature: string;

  /** URL-friendly identifier */
  slug: string;

  /** Brief description of the task */
  summary: string;

  /** Lifecycle status. Known values: queued, ready, active, done, blocked, needs-review, needs-rework, not-planned, duplicate */
  status: string;

  /** Story point estimate on Modified Fibonacci scale */
  estimate?: number;

  /** Who is assigned to this task */
  assignee?: string;

  /** Task IDs this task depends on */
  depends_on?: string[];

  /** Files expected to be modified */
  files_planned?: string[];

  /** Timestamp when work started, RFC 3339 UTC */
  started?: string;

  /** Timestamp when work completed, RFC 3339 UTC */
  completed?: string;

  /** Timestamp when the task was claimed, RFC 3339 UTC */
  claimed_at?: string;

  /** Identity of the agent the task was dispatched to */
  dispatched_to?: string;

  /** Timestamp when the task was dispatched, RFC 3339 UTC */
  dispatched_at?: string;

  /** Identity of who dispatched the task */
  dispatched_by?: string;

  /** Summary of what was accomplished on completion */
  completion_summary?: string;

  /** Reason the task needs rework */
  rework_reason?: string;

  /** Description of testing/verification performed */
  verification?: string;

  /** Classification tags */
  tags?: string[];
}
