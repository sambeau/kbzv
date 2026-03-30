// src/lib/store/project-store.ts

import { create } from 'zustand';
import type {
  Plan,
  Feature,
  Task,
  Bug,
  Decision,
  KnowledgeEntry,
  DocumentRecord,
  Incident,
  HumanCheckpoint,
  ProjectConfig,
  EntityTypeName,
} from '../types';
import { loadProject } from '../reader/loader';
import type { LoadResult } from '../reader/loader';
import { buildTree } from '../query/tree';
import type { TreeNode } from '../query/tree';

// ── State Interface ─────────────────────────────────────────────────

export interface ProjectState {
  // ── Project root ────────────────────────────────────────────────
  /** Absolute path to the project directory, or null if no project is open */
  projectPath: string | null;

  /** Parsed .kbz/config.yaml, or null if no project is open */
  config: ProjectConfig | null;

  // ── Entity maps (ID → entity) ──────────────────────────────────
  plans: Map<string, Plan>;
  features: Map<string, Feature>;
  tasks: Map<string, Task>;
  bugs: Map<string, Bug>;
  decisions: Map<string, Decision>;
  knowledge: Map<string, KnowledgeEntry>;
  documents: Map<string, DocumentRecord>;
  incidents: Map<string, Incident>;
  checkpoints: Map<string, HumanCheckpoint>;

  // ── Derived state ──────────────────────────────────────────────
  /**
   * Plan→Feature→Task hierarchy.
   * Recomputed by calling buildTree() after any change to plans, features, or tasks.
   */
  tree: TreeNode[];

  /**
   * Checkpoints with status === 'pending'.
   * Recomputed by filtering the checkpoints map after any change.
   */
  pendingCheckpoints: HumanCheckpoint[];

  // ── Loading state ──────────────────────────────────────────────
  /** True while loadProject() is in progress */
  loading: boolean;

  /** Error message from the last failed openProject() call, or null */
  error: string | null;

  // ── Actions ────────────────────────────────────────────────────
  /**
   * Open a Kanbanzai project directory.
   * Reads config, walks state directories, parses all YAML, builds tree.
   *
   * @param path - Absolute filesystem path to the project root
   *
   * On success: populates all entity maps, config, tree, pendingCheckpoints.
   * On failure: sets error with descriptive message, all maps remain empty.
   */
  openProject: (path: string) => Promise<void>;

  /**
   * Re-parse a single entity file and update the appropriate map.
   * Recomputes tree and pendingCheckpoints after the update.
   *
   * Stub in F2 — fully implemented in F6 (File Watching & Git Status).
   *
   * @param entityType - Which entity map to update
   * @param filePath - Absolute path to the YAML file that changed
   */
  reloadEntity: (entityType: EntityTypeName, filePath: string) => Promise<void>;

  /**
   * Close the current project and reset all state to initial values.
   */
  closeProject: () => void;
}

// ── Store Creation ──────────────────────────────────────────────────

/**
 * The primary application store. Holds all project data.
 *
 * Usage in React components:
 *   const plans = useProjectStore((s) => s.plans);
 *   const openProject = useProjectStore((s) => s.openProject);
 */
export const useProjectStore = create<ProjectState>((set, _get) => ({
  // ── Initial state ─────────────────────────────────────────────
  projectPath: null,
  config: null,
  plans: new Map(),
  features: new Map(),
  tasks: new Map(),
  bugs: new Map(),
  decisions: new Map(),
  knowledge: new Map(),
  documents: new Map(),
  incidents: new Map(),
  checkpoints: new Map(),
  tree: [],
  pendingCheckpoints: [],
  loading: false,
  error: null,

  // ── openProject ───────────────────────────────────────────────
  openProject: async (path: string) => {
    set({ loading: true, error: null });
    try {
      const result: LoadResult = await loadProject(path);

      // Build derived state
      const tree = buildTree(result.plans, result.features, result.tasks);
      const pendingCheckpoints = [...result.checkpoints.values()].filter(
        (c) => c.status === 'pending',
      );

      set({
        projectPath: path,
        config: result.config,
        plans: result.plans,
        features: result.features,
        tasks: result.tasks,
        bugs: result.bugs,
        decisions: result.decisions,
        knowledge: result.knowledge,
        documents: result.documents,
        incidents: result.incidents,
        checkpoints: result.checkpoints,
        tree,
        pendingCheckpoints,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // ── reloadEntity (stub for F6) ────────────────────────────────
  reloadEntity: async (_entityType: EntityTypeName, _filePath: string) => {
    // F6 will implement:
    // 1. Parse the single YAML file at _filePath
    // 2. Update the entity in the appropriate map
    // 3. If _entityType is 'plan', 'feature', or 'task': rebuild tree
    // 4. If _entityType is 'checkpoint': refilter pendingCheckpoints
    // 5. Call set() with updated maps and derived state
  },

  // ── closeProject ──────────────────────────────────────────────
  closeProject: () => {
    set({
      projectPath: null,
      config: null,
      plans: new Map(),
      features: new Map(),
      tasks: new Map(),
      bugs: new Map(),
      decisions: new Map(),
      knowledge: new Map(),
      documents: new Map(),
      incidents: new Map(),
      checkpoints: new Map(),
      tree: [],
      pendingCheckpoints: [],
      loading: false,
      error: null,
    });
  },
}));
