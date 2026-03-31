// src/lib/reader/loader.ts

import { readTextFile, readDir } from "./fs";
import { parse as parseYaml } from "yaml";
import type {
  ProjectConfig,
  Plan,
  Feature,
  Task,
  Bug,
  Decision,
  KnowledgeEntry,
  DocumentRecord,
  Incident,
  HumanCheckpoint,
} from "../types";

// ── Types ───────────────────────────────────────────────────────────

/**
 * The result of loading all data from a Kanbanzai project directory.
 * Contains the parsed config and all nine entity maps.
 */
export interface LoadResult {
  config: ProjectConfig;
  plans: Map<string, Plan>;
  features: Map<string, Feature>;
  tasks: Map<string, Task>;
  bugs: Map<string, Bug>;
  decisions: Map<string, Decision>;
  knowledge: Map<string, KnowledgeEntry>;
  documents: Map<string, DocumentRecord>;
  incidents: Map<string, Incident>;
  checkpoints: Map<string, HumanCheckpoint>;
}

// ── Constants ───────────────────────────────────────────────────────

/**
 * Mapping from .kbz/state/ subdirectory names to LoadResult keys.
 * Iterated in order during loadProject().
 */
const ENTITY_DIRECTORIES: Array<{
  dir: string;
  key: keyof Omit<LoadResult, "config">;
}> = [
  { dir: "plans", key: "plans" },
  { dir: "features", key: "features" },
  { dir: "tasks", key: "tasks" },
  { dir: "bugs", key: "bugs" },
  { dir: "decisions", key: "decisions" },
  { dir: "documents", key: "documents" },
  { dir: "knowledge", key: "knowledge" },
  { dir: "incidents", key: "incidents" },
  { dir: "checkpoints", key: "checkpoints" },
];

/** Log prefix for all console output from this module. */
const LOG_PREFIX = "[kbzv]";

// ── Main Loader ─────────────────────────────────────────────────────

/**
 * Loads a Kanbanzai project from the filesystem.
 *
 * @param projectPath - Absolute path to the project root directory
 *   (the directory containing `.kbz/`).
 *
 * @returns A LoadResult containing the parsed config and all entity maps.
 *
 * @throws Error with message "Not a Kanbanzai project: .kbz/config.yaml not found"
 *   if the config file does not exist.
 * @throws Error with message "Failed to parse .kbz/config.yaml: {details}"
 *   if the config file cannot be parsed as YAML.
 * @throws Error with message ".kbz/config.yaml is missing required 'version' field"
 *   if the config file does not contain a `version` field.
 *
 * Individual entity files that fail to parse are logged as warnings
 * and skipped — they do not cause loadProject to throw.
 */
export async function loadProject(projectPath: string): Promise<LoadResult> {
  const kbzPath = `${projectPath}/.kbz`;
  const statePath = `${kbzPath}/state`;

  // ── Step 1: Read and parse config ───────────────────────────────

  let configYaml: string;
  try {
    configYaml = await readTextFile(`${kbzPath}/config.yaml`);
  } catch {
    throw new Error("Not a Kanbanzai project: .kbz/config.yaml not found");
  }

  let config: ProjectConfig;
  try {
    config = parseYaml(configYaml) as ProjectConfig;
  } catch (err) {
    throw new Error(`Failed to parse .kbz/config.yaml: ${String(err)}`);
  }

  if (!config || typeof config !== "object" || !("version" in config)) {
    throw new Error(".kbz/config.yaml is missing required 'version' field");
  }

  // Normalise optional fields
  if (!config.prefixes) {
    config.prefixes = [];
  }

  // ── Step 2: Walk entity directories ─────────────────────────────

  const result: LoadResult = {
    config,
    plans: new Map(),
    features: new Map(),
    tasks: new Map(),
    bugs: new Map(),
    decisions: new Map(),
    knowledge: new Map(),
    documents: new Map(),
    incidents: new Map(),
    checkpoints: new Map(),
  };

  for (const { dir, key } of ENTITY_DIRECTORIES) {
    const dirPath = `${statePath}/${dir}`;

    // List directory entries; skip silently if directory does not exist
    let entries: Array<{ name: string }>;
    try {
      entries = await readDir(dirPath);
    } catch {
      // Directory doesn't exist — this is normal for entity types
      // the project hasn't used yet (e.g. no bugs, no incidents)
      continue;
    }

    // Filter to .yaml files only
    const yamlFiles = entries
      .map((e) => e.name)
      .filter(
        (name): name is string =>
          typeof name === "string" && name.endsWith(".yaml"),
      );

    for (const filename of yamlFiles) {
      try {
        const content = await readTextFile(`${dirPath}/${filename}`);

        // Skip empty files
        if (!content || content.trim().length === 0) {
          console.warn(`${LOG_PREFIX} Skipping ${dir}/${filename}: empty file`);
          continue;
        }

        const parsed = parseYaml(content);

        // Validate that the parsed result is an object with an 'id' field
        if (parsed && typeof parsed === "object" && "id" in parsed) {
          (result[key] as Map<string, unknown>).set(
            (parsed as { id: string }).id,
            parsed,
          );
        } else {
          console.warn(
            `${LOG_PREFIX} Skipping ${dir}/${filename}: no 'id' field found`,
          );
        }
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} Skipping ${dir}/${filename}: ${String(err)}`,
        );
        // Continue with remaining files
      }
    }
  }

  return result;
}
