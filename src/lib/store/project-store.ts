// src/lib/store/project-store.ts

import { create } from "zustand";
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
} from "../types";
import { loadProject } from "../reader/loader";
import type { LoadResult } from "../reader/loader";
import { buildTree } from "../query/tree";
import type { TreeNode } from "../query/tree";
import type { GitStatus } from "../reader/git";
import { fetchGitStatus } from "../reader/git";
import { startWatching, stopWatching } from "../reader/watcher";
import type { WatcherHandle } from "../reader/watcher";

// ── Module-level watcher handle ─────────────────────────────────────

let watcherHandle: WatcherHandle | null = null;

// ── Entity type → state key mapping ────────────────────────────────

const ENTITY_TYPE_TO_MAP_KEY: Record<EntityTypeName, keyof ProjectState> = {
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

  // ── F6: Git + content hash ─────────────────────────────────────
  /** Current git status. null = no project open or not a git repo. */
  gitStatus: GitStatus | null;

  /**
   * Monotonically increasing counter. Incremented when document root files
   * change. DriftBadge components use this as a cache-busting dependency.
   */
  contentHashVersion: number;

  // ── Actions ────────────────────────────────────────────────────
  /**
   * Open a Kanbanzai project directory.
   * Reads config, walks state directories, parses all YAML, builds tree.
   * Stops any previously running file watcher before starting.
   *
   * @param path - Absolute filesystem path to the project root
   */
  openProject: (path: string) => Promise<void>;

  /**
   * Re-parse a single entity YAML file and upsert into the appropriate map.
   *
   * @param entityType - Which entity map to update
   * @param filePath - Absolute path to the YAML file that changed
   */
  reloadEntity: (entityType: EntityTypeName, filePath: string) => Promise<void>;

  /**
   * Remove an entity from its typed map by type and ID.
   */
  removeEntity: (entityType: EntityTypeName, entityId: string) => void;

  /**
   * Rebuild tree hierarchy and pendingCheckpoints from current entity maps.
   */
  rebuildDerivedData: () => void;

  /**
   * Re-fetch git status by running git commands against the project path.
   */
  refreshGitStatus: () => Promise<void>;

  /**
   * Close the current project and reset all state to initial values.
   * Stops any running file watchers.
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
export const useProjectStore = create<ProjectState>((set, get) => ({
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
  gitStatus: null,
  contentHashVersion: 0,

  // ── openProject ───────────────────────────────────────────────
  openProject: async (path: string) => {
    // Stop any previous watcher before opening a new project
    if (watcherHandle) {
      stopWatching(watcherHandle);
      watcherHandle = null;
    }

    set({ loading: true, error: null });
    try {
      const result: LoadResult = await loadProject(path);

      // Build derived state
      const tree = buildTree(result.plans, result.features, result.tasks);
      const pendingCheckpoints = [...result.checkpoints.values()].filter(
        (c) => c.status === "pending",
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

      // Fetch initial git status
      try {
        const gitStatus = await fetchGitStatus(path);
        set({ gitStatus });
      } catch (err) {
        console.warn("[store] Initial git status fetch failed:", err);
      }

      // Start file watcher
      try {
        watcherHandle = await startWatching(path, result.config, {
          reloadEntity: (et, fp) => get().reloadEntity(et, fp),
          removeEntity: (et, eid) => get().removeEntity(et, eid),
          rebuildDerivedData: () => get().rebuildDerivedData(),
          refreshGitStatus: () => get().refreshGitStatus(),
          invalidateContentHash: (_paths) => {
            set((s) => ({ contentHashVersion: s.contentHashVersion + 1 }));
          },
        });
      } catch (err) {
        console.error("[store] Failed to start file watching:", err);
        // App continues with stale data — no crash
      }
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // ── reloadEntity ──────────────────────────────────────────────
  reloadEntity: async (entityType: EntityTypeName, filePath: string) => {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const { parse: parseYaml } = await import("yaml");

    const content = await readTextFile(filePath);
    if (!content || content.trim().length === 0) {
      console.warn(`[store] Empty file, skipping: ${filePath}`);
      return;
    }

    const parsed = parseYaml(content);
    if (!parsed || typeof parsed !== "object" || !("id" in parsed)) {
      console.warn(`[store] No 'id' field in: ${filePath}`);
      return;
    }

    const entity = parsed as { id: string };
    const state = get();

    const mapKey = ENTITY_TYPE_TO_MAP_KEY[entityType];
    if (!mapKey) return;

    const currentMap = state[mapKey] as Map<string, unknown>;
    const newMap = new Map(currentMap);
    newMap.set(entity.id, entity);

    set({ [mapKey]: newMap } as Partial<ProjectState>);
  },

  // ── removeEntity ──────────────────────────────────────────────
  removeEntity: (entityType: EntityTypeName, entityId: string) => {
    const state = get();
    const mapKey = ENTITY_TYPE_TO_MAP_KEY[entityType];
    if (!mapKey) return;

    const currentMap = state[mapKey] as Map<string, unknown>;
    if (!currentMap.has(entityId)) return;

    const newMap = new Map(currentMap);
    newMap.delete(entityId);

    set({ [mapKey]: newMap } as Partial<ProjectState>);
  },

  // ── rebuildDerivedData ────────────────────────────────────────
  rebuildDerivedData: () => {
    const state = get();

    const tree = buildTree(state.plans, state.features, state.tasks);
    const pendingCheckpoints = [...state.checkpoints.values()].filter(
      (c) => c.status === "pending",
    );

    set({ tree, pendingCheckpoints });
  },

  // ── refreshGitStatus ─────────────────────────────────────────
  refreshGitStatus: async () => {
    const projectPath = get().projectPath;
    if (!projectPath) return;

    try {
      const gitStatus = await fetchGitStatus(projectPath);
      set({ gitStatus });
    } catch (err) {
      console.warn("[store] Git status refresh failed:", err);
      // Leave previous gitStatus in place — stale data is better than no data
    }
  },

  // ── closeProject ──────────────────────────────────────────────
  closeProject: () => {
    if (watcherHandle) {
      stopWatching(watcherHandle);
      watcherHandle = null;
    }

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
      gitStatus: null,
      contentHashVersion: 0,
    });
  },
}));
