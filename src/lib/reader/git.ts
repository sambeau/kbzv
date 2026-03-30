// src/lib/reader/git.ts

import { Command } from '@tauri-apps/plugin-shell';

// ── Interfaces ──────────────────────────────────────────────────────

/**
 * Read-only snapshot of the project's git repository state.
 * All fields are immutable once created — a new object is produced on each refresh.
 */
export interface GitStatus {
  /** Basename of the project directory (e.g. "kbzv") */
  repoName: string;

  /** Current branch name (e.g. "main", "feat/file-watching"). "HEAD" if detached. */
  branch: string;

  /** Number of uncommitted changes (staged + unstaged + untracked) */
  changesCount: number;

  /** Commits ahead of upstream. null if no upstream is configured. */
  ahead: number | null;

  /** Commits behind upstream. null if no upstream is configured. */
  behind: number | null;
}

// ── Internal helpers ────────────────────────────────────────────────

/**
 * Execute a git command in the given directory.
 * Returns { success: boolean; stdout: string; stderr: string }.
 */
async function runGitCommand(
  cwd: string,
  args: string[],
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  try {
    const command = Command.create('git', args, { cwd });
    const output = await command.execute();

    return {
      success: output.code === 0,
      stdout: output.stdout,
      stderr: output.stderr,
    };
  } catch {
    // Command.create or execute threw — git not found or other OS-level error
    return { success: false, stdout: '', stderr: 'Command execution failed' };
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Fetch current git status for a project directory.
 * Returns null if the directory is not a git repository or git is not available.
 */
export async function fetchGitStatus(projectPath: string): Promise<GitStatus | null> {
  // Extract repo name from path
  const repoName = projectPath.replace(/\\/g, '/').split('/').pop() ?? 'unknown';

  // ── Command 1: Branch name ────────────────────────────────────
  // Also serves as a "is this a git repo?" check.
  //
  // Command:  git rev-parse --abbrev-ref HEAD
  // Success:  prints branch name, e.g. "main\n"
  // Detached: prints "HEAD\n"
  // Non-git:  exits non-zero
  //
  const branchResult = await runGitCommand(projectPath, [
    'rev-parse',
    '--abbrev-ref',
    'HEAD',
  ]);

  if (!branchResult.success) {
    // Not a git repo, or git is not installed — return null
    return null;
  }

  const branch = branchResult.stdout.trim();

  // ── Command 2: Uncommitted changes count ──────────────────────
  //
  // Command:  git status --porcelain
  // Output:   one line per changed/untracked file, e.g.:
  //           " M src/lib/reader/watcher.ts\n"
  //           "?? new-file.txt\n"
  // Count:    number of non-empty lines
  //
  const statusResult = await runGitCommand(projectPath, [
    'status',
    '--porcelain',
  ]);

  const changesCount = statusResult.success
    ? statusResult.stdout
        .split('\n')
        .filter((line) => line.length > 0).length
    : 0;

  // ── Command 3: Ahead/behind remote ────────────────────────────
  //
  // Command:  git rev-list --left-right --count HEAD...@{upstream}
  // Output:   "<ahead>\t<behind>\n", e.g. "16\t0\n"
  // No upstream: exits non-zero (error: no upstream configured)
  //
  let ahead: number | null = null;
  let behind: number | null = null;

  const revListResult = await runGitCommand(projectPath, [
    'rev-list',
    '--left-right',
    '--count',
    'HEAD...@{upstream}',
  ]);

  if (revListResult.success) {
    const parts = revListResult.stdout.trim().split('\t');
    if (parts.length === 2) {
      const parsedAhead = parseInt(parts[0], 10);
      const parsedBehind = parseInt(parts[1], 10);

      if (!isNaN(parsedAhead) && !isNaN(parsedBehind)) {
        ahead = parsedAhead;
        behind = parsedBehind;
      }
    }
  }
  // If rev-list fails (no upstream), ahead/behind remain null → UI hides those elements

  return { repoName, branch, changesCount, ahead, behind };
}
