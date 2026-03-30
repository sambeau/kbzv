// src/lib/query/references.ts

import type { EntityTypeName } from "../types";
import type { ProjectState } from "../store/project-store";

// ── getRelatedEntities ──────────────────────────────────────────────

export interface RelatedEntity {
  id: string;
  type: "plan" | "feature";
  summary: string;
}

/**
 * Reverse lookup: find all plans and features that reference the given document ID
 * via their `design` field.
 */
export function getRelatedEntities(
  documentId: string,
  state: ProjectState,
): RelatedEntity[] {
  const related: RelatedEntity[] = [];

  for (const [id, plan] of state.plans) {
    if (plan.design === documentId) {
      related.push({ id, type: "plan", summary: plan.title });
    }
  }

  for (const [id, feature] of state.features) {
    if (feature.design === documentId) {
      related.push({ id, type: "feature", summary: feature.summary });
    }
  }

  return related;
}

// ── resolveEntityType ───────────────────────────────────────────────

/**
 * Determines entity type from an ID string by examining its prefix.
 *
 * The order of checks is significant:
 * 1. Exact prefix matches (FEAT-, TASK-, BUG-, DEC-, KE-, INC-, CHK-) — checked first
 * 2. Document detection (contains "/") — checked before the plan regex
 *    because document IDs like "FEAT-01ABC/design-my-feature" would
 *    otherwise partially match the plan pattern
 * 3. Plan pattern ({Letter}{Digit}+-) — checked last as a fallback
 *
 * @param id - An entity ID string
 * @returns The EntityTypeName, or null if the ID doesn't match any known pattern
 */
export function resolveEntityType(id: string): EntityTypeName | null {
  // 1. Document IDs contain a "/" (e.g. "FEAT-01ABC/design-my-feature",
  //    "PROJECT/policy-security"). Must be checked FIRST because document
  //    IDs can start with entity prefixes (e.g. FEAT-) followed by a slash,
  //    and would otherwise be mis-classified as features.
  if (id.includes("/")) return "document";

  // 2. Exact prefix matches (most specific first)
  if (id.startsWith("FEAT-")) return "feature";
  if (id.startsWith("TASK-")) return "task";
  if (id.startsWith("BUG-")) return "bug";
  if (id.startsWith("DEC-")) return "decision";
  if (id.startsWith("KE-")) return "knowledge";
  if (id.startsWith("INC-")) return "incident";
  if (id.startsWith("CHK-")) return "checkpoint";

  // 3. Plan IDs match {UppercaseLetter}{Digits}- (e.g. "P1-", "P12-")
  if (/^[A-Z]\d+-/.test(id)) return "plan";

  // 4. No match
  return null;
}

// ── resolveEntity ───────────────────────────────────────────────────

/**
 * Mapping from EntityTypeName to the corresponding property key on ProjectState.
 * Used by resolveEntity() to look up the correct entity map.
 */
const ENTITY_TYPE_TO_STATE_KEY: Record<EntityTypeName, keyof ProjectState> = {
  plan: "plans",
  feature: "features",
  task: "tasks",
  bug: "bugs",
  decision: "decisions",
  knowledge: "knowledge",
  document: "documents",
  incident: "incidents",
  checkpoint: "checkpoints",
};

/**
 * Result of resolving an entity reference.
 */
export interface ResolvedEntity {
  /** The type of the resolved entity */
  entityType: EntityTypeName;

  /** The entity object itself. Typed as unknown — callers should narrow based on entityType. */
  entity: unknown;
}

/**
 * Look up an entity by ID across all entity maps in the store.
 *
 * Steps:
 * 1. Call resolveEntityType(id) to determine which map to search
 * 2. If the type is unknown (null), return null
 * 3. Look up the entity in the appropriate map
 * 4. If found, return { entityType, entity }; otherwise return null
 *
 * @param id - The entity ID to resolve
 * @param state - The current ProjectState (pass from store or selector)
 * @returns { entityType, entity } if found, null otherwise
 */
export function resolveEntity(
  id: string,
  state: ProjectState,
): ResolvedEntity | null {
  const type = resolveEntityType(id);
  if (!type) return null;

  const stateKey = ENTITY_TYPE_TO_STATE_KEY[type];
  const map = state[stateKey] as Map<string, unknown>;
  const entity = map.get(id);

  return entity ? { entityType: type, entity } : null;
}
