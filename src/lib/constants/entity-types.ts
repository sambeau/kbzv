// src/lib/constants/entity-types.ts

import type { EntityTypeName } from '../types';

/**
 * Metadata for an entity type — used for UI rendering (labels, icons)
 * and for the directory reader (mapping subdirectories to types).
 */
export interface EntityTypeInfo {
  /** Machine identifier, matches EntityTypeName */
  type: EntityTypeName;

  /** Singular human-readable label, e.g. "Feature" */
  label: string;

  /** Plural human-readable label, e.g. "Features" */
  labelPlural: string;

  /** Subdirectory name under .kbz/state/, e.g. "features" */
  directory: string;

  /**
   * Lucide icon component name (PascalCase).
   * Import from lucide-react at the usage site.
   */
  icon: string;
}

/**
 * Complete metadata record for all nine entity types.
 * Keyed by EntityTypeName for O(1) lookup.
 */
export const ENTITY_TYPES: Record<EntityTypeName, EntityTypeInfo> = {
  plan: {
    type: 'plan',
    label: 'Plan',
    labelPlural: 'Plans',
    directory: 'plans',
    icon: 'Map',
  },
  feature: {
    type: 'feature',
    label: 'Feature',
    labelPlural: 'Features',
    directory: 'features',
    icon: 'Layers',
  },
  task: {
    type: 'task',
    label: 'Task',
    labelPlural: 'Tasks',
    directory: 'tasks',
    icon: 'CheckSquare',
  },
  bug: {
    type: 'bug',
    label: 'Bug',
    labelPlural: 'Bugs',
    directory: 'bugs',
    icon: 'Bug',
  },
  decision: {
    type: 'decision',
    label: 'Decision',
    labelPlural: 'Decisions',
    directory: 'decisions',
    icon: 'Scale',
  },
  knowledge: {
    type: 'knowledge',
    label: 'Knowledge Entry',
    labelPlural: 'Knowledge Entries',
    directory: 'knowledge',
    icon: 'BookOpen',
  },
  document: {
    type: 'document',
    label: 'Document',
    labelPlural: 'Documents',
    directory: 'documents',
    icon: 'FileText',
  },
  incident: {
    type: 'incident',
    label: 'Incident',
    labelPlural: 'Incidents',
    directory: 'incidents',
    icon: 'AlertTriangle',
  },
  checkpoint: {
    type: 'checkpoint',
    label: 'Checkpoint',
    labelPlural: 'Checkpoints',
    directory: 'checkpoints',
    icon: 'HelpCircle',
  },
};
