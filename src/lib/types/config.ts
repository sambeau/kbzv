// src/lib/types/config.ts

/**
 * Project configuration, parsed from .kbz/config.yaml.
 *
 * Parsing rules:
 * - `version` is always present and is a string (not a number), currently "2"
 * - `schema_version` is absent in pre-1.0 projects — treat absence as pre-1.0, parse best-effort
 * - `prefixes` may be empty on a fresh project
 * - `documents.roots` may be absent — default to no document roots
 */
export interface ProjectConfig {
  /** Schema version string. Currently "2". Always present. */
  version: string;

  /**
   * Semver schema version. Present from kanbanzai 1.0 onwards.
   * Absent in pre-1.0 projects — treat absence as pre-1.0.
   */
  schema_version?: string;

  /** Plan prefix registry. May be empty on a fresh project. */
  prefixes: PrefixEntry[];

  /** Document root configuration. May be absent. */
  documents?: {
    roots: DocumentRoot[];
  };
}

/**
 * A single plan prefix entry from the config.
 */
export interface PrefixEntry {
  /** Single uppercase character used as the plan prefix, e.g. "P" */
  prefix: string;

  /** Human-readable name for this prefix, e.g. "Plan" */
  name: string;

  /** Whether this prefix is retired and should not be used for new plans */
  retired?: boolean;
}

/**
 * A document root directory configured for the project.
 */
export interface DocumentRoot {
  /** Directory path relative to the repository root, e.g. "work/design" */
  path: string;

  /** Default document type for files in this root, e.g. "design" */
  default_type: string;
}
