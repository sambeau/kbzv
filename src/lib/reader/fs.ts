// src/lib/reader/fs.ts
//
// Thin wrappers around custom Tauri Rust commands for filesystem access.
// These bypass the fs plugin's scope restrictions, which don't work
// reliably for user-selected project directories.

import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  is_dir: boolean;
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export async function readDir(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("read_directory", { path });
}
