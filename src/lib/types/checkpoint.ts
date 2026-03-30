// src/lib/types/checkpoint.ts

/**
 * A HumanCheckpoint records a decision point that required human input.
 * Standalone entity — shown prominently in the UI when status is "pending".
 *
 * ID format: CHK-{TSID13}
 *
 * Lifecycle: pending → responded (terminal)
 */
export interface HumanCheckpoint {
  /** Checkpoint identifier. Format: CHK-{TSID13} */
  id: string;

  /** The question or decision requiring human input */
  question: string;

  /** Background information to help the human answer */
  context: string;

  /** Brief state of the orchestration session at checkpoint time */
  orchestration_summary: string;

  /** Identity of the orchestrating agent that created this checkpoint */
  created_by: string;

  /** Lifecycle status. Known values: pending, responded */
  status: string;

  /** The human's answer or decision (present only when status is "responded") */
  response?: string;

  /** Creation timestamp, RFC 3339 UTC */
  created: string;

  /** Timestamp when the human responded, RFC 3339 UTC */
  responded_at?: string;
}
