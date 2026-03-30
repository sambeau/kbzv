// src/lib/reader/watcher.ts

import { watch } from "@tauri-apps/plugin-fs";
import type { WatchEvent, UnwatchFn } from "@tauri-apps/plugin-fs";
import type { ProjectConfig } from "../types/config";
import type { EntityTypeName } from "../types";

// ── Public Interfaces ────────────────────────────────────────────────

export interface WatcherHandle {
  /** Unsubscribe function for the .kbz/state/ watcher */
  stateUnsubscribe: UnwatchFn;
  /** Unsubscribe functions for each document root watcher */
  documentUnsubscribes: UnwatchFn[];
}

export interface WatcherCallbacks {
  reloadEntity: (entityType: EntityTypeName, filePath: string) => Promise<void>;
  removeEntity: (entityType: EntityTypeName, entityId: string) => void;
  rebuildDerivedData: () => void;
  refreshGitStatus: () => Promise<void>;
  invalidateContentHash: (paths: string[]) => void;
}

// ── Internal Types ───────────────────────────────────────────────────

interface ClassifiedEvent {
  path: string;
  kind: "create" | "modify" | "delete";
  scope: "state" | "document";
}

// ── Module-level debounce state ──────────────────────────────────────

let pendingEvents: ClassifiedEvent[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isProcessing = false;

const DEBOUNCE_MS = 200;

// Stored reference to callbacks — set by startWatching(), cleared by stopWatching()
let activeCallbacks: WatcherCallbacks | null = null;
let activeProjectPath: string | null = null;

// ── Entity resolution ────────────────────────────────────────────────

/**
 * Directory name → EntityTypeName mapping.
 * Keys are the subdirectory names under .kbz/state/.
 */
const DIRECTORY_TO_ENTITY_TYPE: Record<string, EntityTypeName> = {
  plans: "plan",
  features: "feature",
  tasks: "task",
  bugs: "bug",
  decisions: "decision",
  documents: "document",
  knowledge: "knowledge",
  incidents: "incident",
  checkpoints: "checkpoint",
};

/**
 * Extract entity ID from a YAML filename.
 */
function extractEntityId(directory: string, filename: string): string {
  // Strip .yaml extension
  const base = filename.replace(/\.yaml$/, "");

  // Documents: restore / from --
  if (directory === "documents") {
    return base.replace(/--/g, "/");
  }

  // Simple-ID types: the full base IS the ID
  if (
    directory === "plans" ||
    directory === "knowledge" ||
    directory === "checkpoints"
  ) {
    return base;
  }

  // Slug-bearing types: extract PREFIX-ULID from PREFIX-ULID-slug
  const match = base.match(/^([A-Z]+-[0-9A-Z]{13,26})(?:-.*)?$/);
  if (match) {
    return match[1];
  }

  // Fallback: return the full base (handles unexpected patterns gracefully)
  return base;
}

/**
 * Takes an absolute file path and the project path, returns the entity type and ID.
 * Returns null if the path is not within .kbz/state/ or is not a recognised entity directory.
 */
function resolveEntityFromPath(
  filePath: string,
  projectPath: string,
): { entityType: EntityTypeName; entityId: string } | null {
  // Normalise path separators to forward slash
  const normalised = filePath.replace(/\\/g, "/");
  const prefix = `${projectPath.replace(/\\/g, "/")}/.kbz/state/`;

  if (!normalised.startsWith(prefix)) return null;

  // relativePath is e.g. "features/FEAT-01KMZA9PWFRJF-file-watching-git-status.yaml"
  const relativePath = normalised.slice(prefix.length);

  // Split into directory and filename
  const slashIndex = relativePath.indexOf("/");
  if (slashIndex === -1) return null; // file directly in state/ — ignore

  const directory = relativePath.slice(0, slashIndex);
  const filename = relativePath.slice(slashIndex + 1);

  // Must be a direct child of the entity directory (no deeper nesting)
  if (filename.includes("/")) return null;

  const entityType = DIRECTORY_TO_ENTITY_TYPE[directory];
  if (!entityType) return null;

  const entityId = extractEntityId(directory, filename);
  return { entityType, entityId };
}

/**
 * Keep only the latest event per unique file path.
 */
function deduplicateByPath(events: ClassifiedEvent[]): ClassifiedEvent[] {
  const latest = new Map<string, ClassifiedEvent>();
  for (const event of events) {
    latest.set(event.path, event); // last event per path wins
  }
  return Array.from(latest.values());
}

// ── Event classification ─────────────────────────────────────────────

function getEventKind(
  event: WatchEvent,
): "create" | "modify" | "delete" | null {
  // event.type can be 'any' | 'other' (strings) or an object — filter strings first
  if (typeof event.type === "string") return null;
  if ("create" in event.type) return "create";
  if ("modify" in event.type) return "modify";
  if ("remove" in event.type) return "delete";
  // 'access' events are ignored
  return null;
}

// ── Event handler ────────────────────────────────────────────────────

function onWatchEvent(
  event: WatchEvent,
  _projectPath: string,
  scope: "state" | "document",
): void {
  const kind = getEventKind(event);
  if (kind === null) return; // Ignore access/other events

  for (const filePath of event.paths) {
    // Filter: only process .yaml files for state events
    if (scope === "state" && !filePath.endsWith(".yaml")) continue;

    // Filter: only process .md files for document events
    if (scope === "document" && !filePath.endsWith(".md")) continue;

    pendingEvents.push({ path: filePath, kind, scope });
  }

  // Reset the debounce timer
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushBatch();
  }, DEBOUNCE_MS);
}

// ── Batch processing ─────────────────────────────────────────────────

async function processBatch(
  events: ClassifiedEvent[],
  projectPath: string,
  callbacks: WatcherCallbacks,
): Promise<void> {
  // Step 1: Deduplicate — keep only the latest event per unique file path
  const uniqueEvents = deduplicateByPath(events);

  // Step 2: Separate state events from document events
  const stateEvents: ClassifiedEvent[] = [];
  const documentEvents: ClassifiedEvent[] = [];

  for (const event of uniqueEvents) {
    if (event.scope === "state") {
      stateEvents.push(event);
    } else {
      documentEvents.push(event);
    }
  }

  // Step 3: Process state events (entity create/modify/delete)
  let entitiesChanged = false;

  for (const event of stateEvents) {
    const resolved = resolveEntityFromPath(event.path, projectPath);
    if (!resolved) {
      // File is not in a recognised entity directory — skip
      continue;
    }

    const { entityType, entityId } = resolved;

    if (event.kind === "delete") {
      callbacks.removeEntity(entityType, entityId);
      entitiesChanged = true;
    } else {
      // 'create' or 'modify' — read and upsert
      try {
        await callbacks.reloadEntity(entityType, event.path);
        entitiesChanged = true;
      } catch (err) {
        if (event.kind === "create") {
          // File may have been deleted between event and read (race condition)
          console.warn(
            `[watcher] File gone on read, treating as no-op: ${event.path}`,
          );
        } else {
          // Modify failed — leave previous version in store
          console.warn(
            `[watcher] Failed to reload entity, keeping stale: ${event.path}`,
            err,
          );
        }
      }
    }
  }

  // Step 4: Process document events (Markdown drift invalidation)
  if (documentEvents.length > 0) {
    callbacks.invalidateContentHash(documentEvents.map((e) => e.path));
  }

  // Step 5: Rebuild derived data ONCE for the entire batch
  if (entitiesChanged) {
    callbacks.rebuildDerivedData();
  }

  // Step 6: Refresh git status (file changes likely mean git status changed)
  try {
    await callbacks.refreshGitStatus();
  } catch (err) {
    console.warn("[watcher] Git status refresh failed:", err);
  }
}

async function flushBatch(): Promise<void> {
  if (pendingEvents.length === 0) return;
  if (isProcessing) {
    // A batch is already being processed. Re-arm the timer so these
    // events are picked up after the current batch finishes.
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void flushBatch();
    }, DEBOUNCE_MS);
    return;
  }

  const batch = [...pendingEvents];
  pendingEvents = [];

  if (!activeCallbacks || !activeProjectPath) return;

  isProcessing = true;
  try {
    await processBatch(batch, activeProjectPath, activeCallbacks);
  } catch (err) {
    console.error("[watcher] Batch processing error:", err);
  } finally {
    isProcessing = false;
  }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Start watching a project's .kbz/state/ directory and document roots.
 * Returns a handle that must be passed to stopWatching() on closeProject.
 * Opening a new project always stops the previous watcher first — the
 * caller (project-store.ts) is responsible for stopping any existing handle.
 */
export async function startWatching(
  projectPath: string,
  config: ProjectConfig,
  callbacks: WatcherCallbacks,
): Promise<WatcherHandle> {
  // Store module-level references for the debounce callback
  activeCallbacks = callbacks;
  activeProjectPath = projectPath;

  // Reset debounce state
  pendingEvents = [];
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  isProcessing = false;

  // 1. Watch .kbz/state/ recursively
  const statePath = `${projectPath}/.kbz/state`;
  const stateUnsubscribe = await watch(
    statePath,
    (event: WatchEvent) => onWatchEvent(event, projectPath, "state"),
    { recursive: true },
  );

  // 2. Watch each document root
  const documentUnsubscribes: UnwatchFn[] = [];
  const roots = config.documents?.roots ?? [];

  for (const root of roots) {
    const rootPath = `${projectPath}/${root.path}`;
    try {
      const unsub = await watch(
        rootPath,
        (event: WatchEvent) => onWatchEvent(event, projectPath, "document"),
        { recursive: true },
      );
      documentUnsubscribes.push(unsub);
    } catch (err) {
      console.info(
        `[watcher] Skipping document root "${root.path}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { stateUnsubscribe, documentUnsubscribes };
}

/**
 * Stop all watchers. Safe to call multiple times (handle is consumed by caller).
 */
export function stopWatching(handle: WatcherHandle): void {
  // Clear module-level debounce state
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingEvents = [];
  isProcessing = false;
  activeCallbacks = null;
  activeProjectPath = null;

  // Stop the state watcher
  try {
    handle.stateUnsubscribe();
  } catch (err) {
    console.warn("[watcher] Error stopping state watcher:", err);
  }

  // Stop all document root watchers
  for (const unsub of handle.documentUnsubscribes) {
    try {
      unsub();
    } catch (err) {
      console.warn("[watcher] Error stopping document watcher:", err);
    }
  }
}
