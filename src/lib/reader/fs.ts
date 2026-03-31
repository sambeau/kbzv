// src/lib/reader/fs.ts
//
// Thin wrappers around filesystem access.
//
// When running inside Tauri, these use custom Rust commands via `invoke`.
// When running in a plain browser (e.g. Vite dev server at localhost:1420),
// they fall back to fetch requests against the /__dev/fs/ middleware
// provided by the devFsPlugin in vite.config.ts.
//
// This allows the full UI to be exercised in a browser during development
// by navigating to http://localhost:1420?project=/path/to/kbz/project

export interface DirEntry {
  name: string;
  is_dir: boolean;
}

// ── Runtime detection ───────────────────────────────────────────────

/**
 * Returns true when the Tauri IPC bridge is available (i.e. we are
 * running inside a Tauri webview, not a plain browser tab).
 */
function hasTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

// ── Tauri path (lazy-imported to avoid top-level errors in browser) ─

async function tauriInvoke<T>(
  cmd: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// ── Browser / dev-server fallback ───────────────────────────────────

async function devFsRead(path: string): Promise<string> {
  const url = `/__dev/fs/read?path=${encodeURIComponent(path)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`devFsRead(${path}): ${res.status} ${body}`);
  }
  return res.text();
}

async function devFsDir(path: string): Promise<DirEntry[]> {
  const url = `/__dev/fs/dir?path=${encodeURIComponent(path)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`devFsDir(${path}): ${res.status} ${body}`);
  }
  return res.json();
}

async function devFsExists(path: string): Promise<boolean> {
  const url = `/__dev/fs/exists?path=${encodeURIComponent(path)}`;
  const res = await fetch(url);
  if (!res.ok) return false;
  return res.json();
}

// ── Public API ──────────────────────────────────────────────────────

export async function readTextFile(path: string): Promise<string> {
  if (hasTauri()) {
    return tauriInvoke<string>("read_text_file", { path });
  }
  return devFsRead(path);
}

export async function readDir(path: string): Promise<DirEntry[]> {
  if (hasTauri()) {
    return tauriInvoke<DirEntry[]>("read_directory", { path });
  }
  return devFsDir(path);
}

/**
 * Check whether a path exists on the filesystem.
 * In Tauri this calls the validate_project command for .kbz/config.yaml;
 * in the browser it hits the dev middleware.
 */
export async function validateProject(path: string): Promise<boolean> {
  if (hasTauri()) {
    return tauriInvoke<boolean>("validate_project", { path });
  }
  // In browser dev mode, check if .kbz/config.yaml exists
  return devFsExists(`${path}/.kbz/config.yaml`);
}
