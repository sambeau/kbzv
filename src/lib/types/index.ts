// src/lib/types/index.ts

// ── Entity type imports (needed for local union types) ──────────────
import type { Plan } from "./plan";
import type { Feature } from "./feature";
import type { Task } from "./task";
import type { Bug } from "./bug";
import type { Decision } from "./decision";
import type { KnowledgeEntry } from "./knowledge";
import type { DocumentRecord } from "./document";
import type { Incident } from "./incident";
import type { HumanCheckpoint } from "./checkpoint";

// ── Entity type re-exports ──────────────────────────────────────────
export type { Plan } from "./plan";
export type { Feature } from "./feature";
export type { Task } from "./task";
export type { Bug } from "./bug";
export type { Decision } from "./decision";
export type { KnowledgeEntry } from "./knowledge";
export type { DocumentRecord } from "./document";
export type { Incident } from "./incident";
export type { HumanCheckpoint } from "./checkpoint";

// ── Config re-exports ───────────────────────────────────────────────
export type { ProjectConfig, PrefixEntry, DocumentRoot } from "./config";

// ── Union types ─────────────────────────────────────────────────────

/**
 * Discriminated union of all entity types that appear in the Plan→Feature→Task tree.
 */
export type TreeEntity = Plan | Feature | Task;

/**
 * The type name for the 'entityType' field in TreeNode.
 */
export type TreeEntityTypeName = "plan" | "feature" | "task";

/**
 * All nine entity type names used throughout the application.
 * Used by resolveEntityType(), resolveEntity(), reloadEntity(), ENTITY_TYPES, etc.
 */
export type EntityTypeName =
  | "plan"
  | "feature"
  | "task"
  | "bug"
  | "decision"
  | "knowledge"
  | "document"
  | "incident"
  | "checkpoint";

/**
 * Union of all entity interfaces. Useful for generic entity rendering.
 */
export type AnyEntity =
  | Plan
  | Feature
  | Task
  | Bug
  | Decision
  | KnowledgeEntry
  | DocumentRecord
  | Incident
  | HumanCheckpoint;
